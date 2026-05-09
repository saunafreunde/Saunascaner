// POST /api/push-send — sendet Push-Notifications an Mitglieder.
// Body: { member_ids?: string[], title: string, body: string, url?: string, tag?: string }
// Wenn member_ids leer/missing: an alle Subscriptions (nur Admin/Aufgieser/Cron).
//
// Authentifizierung:
//  - Bearer <JWT>: Eingeloggtes Mitglied
//      • Self-Test: member_ids === [eigene_id]
//      • Broadcast (kein/leer member_ids): nur Admin oder is_aufgieser (z.B. Evakuierung)
//      • Beliebige andere Empfänger: nur Admin
//  - Cron-Aufruf (Server→Server): Header `x-cron-secret: <CRON_SECRET>` → unbeschränkt
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { authenticate } from './_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPub = process.env.VAPID_PUBLIC_KEY;
  const vapidPriv = process.env.VAPID_PRIVATE_KEY;
  const vapidSub = process.env.VAPID_SUBJECT ?? 'mailto:admin@saunascaner.local';
  if (!supaUrl || !serviceKey || !vapidPub || !vapidPriv) {
    return res.status(500).json({ error: 'env missing (Supabase/VAPID)' });
  }

  const { member_ids, title, body, url, tag, requireInteraction } = req.body as {
    member_ids?: string[];
    title: string;
    body: string;
    url?: string;
    tag?: string;
    requireInteraction?: boolean;
  };
  if (!title || !body) return res.status(400).json({ error: 'title + body required' });

  // Authorization
  const cronSecret = process.env.CRON_SECRET;
  const cronHeader = req.headers['x-cron-secret'];
  const isCron = !!cronSecret && cronHeader === cronSecret;

  let sb;
  if (!isCron) {
    const auth = await authenticate(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const isAdmin = auth.member.role === 'admin';
    const isAufgieser = !!auth.member.is_aufgieser;
    const targets = Array.isArray(member_ids) ? member_ids : [];
    const isBroadcast = targets.length === 0;
    const isSelfOnly = targets.length === 1 && targets[0] === auth.member.id;

    if (isBroadcast) {
      if (!isAdmin && !isAufgieser) return res.status(403).json({ error: 'broadcast not allowed' });
    } else if (!isAdmin && !isSelfOnly) {
      return res.status(403).json({ error: 'cannot push to other members' });
    }
    sb = auth.service;
  } else {
    sb = createClient(supaUrl, serviceKey);
  }

  webpush.setVapidDetails(vapidSub, vapidPub, vapidPriv);

  let q = sb.from('push_subscriptions').select('id, endpoint, p256dh_key, auth_key, member_id');
  if (Array.isArray(member_ids) && member_ids.length > 0) {
    q = q.in('member_id', member_ids);
  }
  const { data: subs, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  if (!subs || subs.length === 0) return res.status(200).json({ ok: true, sent: 0, note: 'no subs' });

  const payload = JSON.stringify({ title, body, url: url ?? '/', tag: tag ?? 'saunafreunde', requireInteraction: !!requireInteraction });

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } },
        payload
      )
    )
  );

  // 410 Gone / 404: Subscription ist tot — bereinigen
  const stale: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const err = r.reason as { statusCode?: number };
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        stale.push(subs[i].endpoint);
      }
    }
  });
  if (stale.length > 0) {
    await sb.from('push_subscriptions').delete().in('endpoint', stale);
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return res.status(200).json({ ok: true, sent, failed: results.length - sent, stale_pruned: stale.length });
}
