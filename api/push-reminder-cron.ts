// api/push-reminder-cron.ts — Cron-Endpoint, alle 30 Min via Supabase pg_cron.
//
// Sendet Bewertungs-Fenster-Reminder für anwesende Mitglieder mit offenen Bewertungen.
//
// Idempotent durch tag-basiertes Dedupen im Browser (Notification-API merged
// gleichen tag). Pro Member nur ein Rating-Reminder pro Run.
//
// Hinweis: war zwischenzeitlich in api/cron.ts konsolidiert (Vercel-Hobby-
// 12-Function-Limit). Seit Wechsel auf Pro wieder eigener File.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

interface RatingReminder {
  member_id: string;
  member_name: string;
  infusion_id: string;
  infusion_title: string;
  end_time: string;
  meister_name: string;
}

interface PushSub {
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  member_id: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Optional Cron-Schutz
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization ?? '';
    if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'unauthorized' });
  }

  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPub = process.env.VAPID_PUBLIC_KEY;
  const vapidPriv = process.env.VAPID_PRIVATE_KEY;
  const vapidSub = process.env.VAPID_SUBJECT ?? 'mailto:admin@saunascaner.local';
  if (!supaUrl || !serviceKey || !vapidPub || !vapidPriv) {
    return res.status(500).json({ error: 'env missing' });
  }
  webpush.setVapidDetails(vapidSub, vapidPub, vapidPriv);

  const sb = createClient(supaUrl, serviceKey);

  // Bewertungs-Reminder (laufende 3h-Fenster)
  const { data: ratingList = [] } = await sb.rpc('rating_pending_reminders') as { data: RatingReminder[] | null };
  const ratingByMember = new Map<string, RatingReminder>();
  for (const r of (ratingList ?? [])) {
    const existing = ratingByMember.get(r.member_id);
    if (!existing || new Date(r.end_time) > new Date(existing.end_time)) ratingByMember.set(r.member_id, r);
  }

  const allMemberIds = new Set<string>(ratingByMember.keys());
  if (allMemberIds.size === 0) return res.status(200).json({ ok: true, sent: 0, note: 'nothing to send' });

  const { data: subsRaw, error: subsErr } = await sb
    .from('push_subscriptions')
    .select('endpoint, p256dh_key, auth_key, member_id')
    .in('member_id', Array.from(allMemberIds));
  if (subsErr) return res.status(500).json({ error: subsErr.message });
  const subs = (subsRaw ?? []) as PushSub[];

  const subsByMember = new Map<string, PushSub[]>();
  for (const s of subs) {
    const arr = subsByMember.get(s.member_id) ?? [];
    arr.push(s);
    subsByMember.set(s.member_id, arr);
  }

  const stale: string[] = [];
  let ratingSent = 0;

  async function sendTo(memberId: string, title: string, body: string, url: string, tag: string) {
    const targets = subsByMember.get(memberId) ?? [];
    if (targets.length === 0) return 0;
    const payload = JSON.stringify({ title, body, url, tag });
    const results = await Promise.allSettled(
      targets.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } },
          payload
        )
      )
    );
    let sent = 0;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') sent++;
      else {
        const err = r.reason as { statusCode?: number };
        if (err?.statusCode === 410 || err?.statusCode === 404) stale.push(targets[i].endpoint);
      }
    });
    return sent;
  }

  for (const [memberId, r] of ratingByMember.entries()) {
    const endDate = new Date(r.end_time);
    const minsLeft = Math.round((endDate.getTime() + 3 * 60 * 60 * 1000 - Date.now()) / 60000);
    if (minsLeft < 5) continue;
    ratingSent += await sendTo(
      memberId,
      `⏱️ Aufguss von ${r.meister_name} bewerten`,
      `„${r.infusion_title}" — noch ${minsLeft} Min bis das Bewertungsfenster zugeht.`,
      '/planner',
      `rating-${r.infusion_id}`
    );
  }

  if (stale.length > 0) await sb.from('push_subscriptions').delete().in('endpoint', stale);

  return res.status(200).json({
    ok: true,
    rating_pending: ratingByMember.size,
    rating_sent: ratingSent,
    stale_pruned: stale.length,
  });
}
