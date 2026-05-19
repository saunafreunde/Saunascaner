// api/cron.ts — Multi-Action Cron-Endpoint.
//
// Konsolidiert ehemals zwei separate Endpoints (birthday-cron.ts und
// push-reminder-cron.ts) in einen, weil Vercel Hobby nur 12 Serverless
// Functions erlaubt und der neue api/ai.ts den 13. wäre.
//
// Actions:
//   GET /api/cron?action=birthday        — täglich 7 Uhr (vercel.json crons)
//   POST /api/cron?action=push-reminder  — alle 30 Min via Supabase pg_cron
//
// Beide alten Endpoints würden bei direkten Aufrufen jetzt 404 liefern —
// das pg_cron-Schedule wurde via Migration 0094 auf die neue URL umgestellt
// und vercel.json crons ebenfalls.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Optional: Cron-Schutz via CRON_SECRET (gilt für beide Actions)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization ?? '';
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const action = String(req.query.action ?? '');
  try {
    if (action === 'birthday') return await birthdayHandler(res);
    if (action === 'push-reminder') return await pushReminderHandler(res);
    return res.status(400).json({ error: `unknown action: ${action}` });
  } catch (e) {
    const msg = (e as Error).message;
    console.error('[api/cron] error', action, msg);
    return res.status(500).json({ error: msg });
  }
}

// ─── Action: birthday ─────────────────────────────────────────────────────
async function birthdayHandler(res: VercelResponse) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!token || !supaUrl || !anonKey) {
    return res.status(500).json({ error: 'env missing' });
  }
  const sb = createClient(supaUrl, anonKey);

  const { data: birthdays, error } = await sb.rpc('get_birthdays_today');
  if (error) return res.status(500).json({ error: error.message });

  const list = (birthdays ?? []) as { member_id: string; name: string; sauna_name: string | null }[];
  if (list.length === 0) return res.status(200).json({ ok: true, sent: 0, note: 'no birthdays today' });

  const { data: cfg } = await sb.from('system_config').select('value').eq('key', 'telegram_chats').maybeSingle();
  const chats: number[] = Array.isArray(cfg?.value?.chat_ids) ? cfg.value.chat_ids : [];
  if (chats.length === 0) return res.status(200).json({ ok: true, sent: 0, note: 'no chats' });

  let telegramSent = 0;
  for (const person of list) {
    const display = person.sauna_name ? `${person.name} („${person.sauna_name}")` : person.name;
    const text = `🎂 Heute hat <b>${display}</b> Geburtstag!\nWir wünschen einen wunderbaren Tag — auf viele weitere Aufgüsse! 🥂`;
    const results = await Promise.allSettled(
      chats.map((chat_id) =>
        fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }),
        })
      )
    );
    telegramSent += results.filter((r) => r.status === 'fulfilled' && (r.value as Response).ok).length;
  }

  // Web-Push an alle außer Geburtstagskindern
  const vapidPub = process.env.VAPID_PUBLIC_KEY;
  const vapidPriv = process.env.VAPID_PRIVATE_KEY;
  const vapidSub = process.env.VAPID_SUBJECT ?? 'mailto:admin@saunascaner.local';
  let pushSent = 0;
  const pushStale: string[] = [];

  if (vapidPub && vapidPriv) {
    webpush.setVapidDetails(vapidSub, vapidPub, vapidPriv);
    const birthdayMemberIds = list.map((p) => p.member_id);
    const { data: subsRaw } = await sb
      .from('push_subscriptions')
      .select('endpoint, p256dh_key, auth_key, member_id')
      .not('member_id', 'in', `(${birthdayMemberIds.join(',') || '00000000-0000-0000-0000-000000000000'})`);

    type Sub = { endpoint: string; p256dh_key: string; auth_key: string; member_id: string };
    const subs = (subsRaw ?? []) as Sub[];

    if (subs.length > 0) {
      const namesShort = list.map((p) => p.sauna_name || p.name).join(', ');
      const title = list.length === 1 ? `🎂 Heute hat ${namesShort} Geburtstag!` : `🎂 Heute haben ${list.length} Saunafreunde Geburtstag!`;
      const body = list.length === 1 ? 'Schick einen Glückwunsch oder bring einen Aufguss vorbei.' : `Glückwunsch an ${namesShort}.`;
      const payload = JSON.stringify({ title, body, url: '/dashboard', tag: 'birthday' });
      const results = await Promise.allSettled(
        subs.map((s) =>
          webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } },
            payload
          )
        )
      );
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') pushSent++;
        else {
          const err = r.reason as { statusCode?: number };
          if (err?.statusCode === 410 || err?.statusCode === 404) pushStale.push(subs[i].endpoint);
        }
      });
      if (pushStale.length > 0) {
        await sb.from('push_subscriptions').delete().in('endpoint', pushStale);
      }
    }
  }

  return res.status(200).json({
    ok: true,
    birthdays: list.length,
    telegram_sent: telegramSent,
    push_sent: pushSent,
    push_stale_pruned: pushStale.length,
  });
}

// ─── Action: push-reminder ────────────────────────────────────────────────
interface WmReminder { member_id: string; member_name: string; match_id: string; match_no: number; kickoff: string; home_label: string; away_label: string; }
interface RatingReminder { member_id: string; member_name: string; infusion_id: string; infusion_title: string; end_time: string; meister_name: string; }
interface PushSub { endpoint: string; p256dh_key: string; auth_key: string; member_id: string; }

async function pushReminderHandler(res: VercelResponse) {
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

  // WM-Tipp-Reminder
  const { data: wmList = [] } = await sb.rpc('wm_pending_tip_reminders', { p_within_hours: 6 }) as { data: WmReminder[] | null };
  const wmByMember = new Map<string, WmReminder>();
  for (const r of (wmList ?? [])) {
    const existing = wmByMember.get(r.member_id);
    if (!existing || new Date(r.kickoff) < new Date(existing.kickoff)) wmByMember.set(r.member_id, r);
  }

  // Bewertungs-Reminder
  const { data: ratingList = [] } = await sb.rpc('rating_pending_reminders') as { data: RatingReminder[] | null };
  const ratingByMember = new Map<string, RatingReminder>();
  for (const r of (ratingList ?? [])) {
    const existing = ratingByMember.get(r.member_id);
    if (!existing || new Date(r.end_time) > new Date(existing.end_time)) ratingByMember.set(r.member_id, r);
  }

  const allMemberIds = new Set<string>([...wmByMember.keys(), ...ratingByMember.keys()]);
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
  let wmSent = 0, ratingSent = 0;

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

  for (const [memberId, r] of wmByMember.entries()) {
    const kickoffDate = new Date(r.kickoff);
    const minsUntil = Math.round((kickoffDate.getTime() - Date.now()) / 60000);
    const timeLabel = minsUntil < 60 ? `in ${minsUntil} Min` : `in ${Math.round(minsUntil / 60)}h`;
    wmSent += await sendTo(memberId, `🏆 Tipp vergessen? ${r.home_label} vs ${r.away_label}`, `Anpfiff ${timeLabel}. Gib jetzt deinen Tipp ab.`, '/wm', `wm-tip-${r.match_id}`);
  }

  for (const [memberId, r] of ratingByMember.entries()) {
    const endDate = new Date(r.end_time);
    const minsLeft = Math.round((endDate.getTime() + 3 * 60 * 60 * 1000 - Date.now()) / 60000);
    if (minsLeft < 5) continue;
    ratingSent += await sendTo(memberId, `⏱️ Aufguss von ${r.meister_name} bewerten`, `„${r.infusion_title}" — noch ${minsLeft} Min bis das Bewertungsfenster zugeht.`, '/planner', `rating-${r.infusion_id}`);
  }

  if (stale.length > 0) await sb.from('push_subscriptions').delete().in('endpoint', stale);

  return res.status(200).json({
    ok: true,
    wm_pending: wmByMember.size,
    rating_pending: ratingByMember.size,
    wm_sent: wmSent,
    rating_sent: ratingSent,
    stale_pruned: stale.length,
  });
}
