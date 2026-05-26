// api/birthday-cron.ts — Vercel Cron, täglich 07:00 (siehe vercel.json).
// Prüft Geburtstagskinder und versendet:
//   1) Telegram-Glückwunsch an alle konfigurierten Chats
//   2) Web-Push an alle Mitglieder mit Subscription (außer Geburtstagskind)
//
// FIX 0107 (Audit Phase 8 CRITICAL):
//  - serviceClient() statt anon-Key → DELETE auf push_subscriptions funktioniert
//  - tgBroadcast() für Telegram-Sends mit Throttle + 429-Retry
//  - safer push_subscription NOT-IN-Query (Array-Form)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { serviceClient } from './_auth.js';
import { tgBroadcast } from './_telegram.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization ?? '';
    if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'unauthorized' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const sb = serviceClient();
  if (!token || !sb) {
    return res.status(500).json({ error: 'env missing (TELEGRAM_BOT_TOKEN or SUPABASE_SERVICE_ROLE_KEY)' });
  }

  // Geburtstagskinder heute
  const { data: birthdays, error } = await sb.rpc('get_birthdays_today');
  if (error) return res.status(500).json({ error: error.message });

  const list = (birthdays ?? []) as { member_id: string; name: string; sauna_name: string | null }[];
  if (list.length === 0) return res.status(200).json({ ok: true, sent: 0, note: 'no birthdays today' });

  // Telegram-Chats aus system_config
  const { data: cfg } = await sb.from('system_config').select('value').eq('key', 'telegram_chats').maybeSingle();
  const chats: number[] = Array.isArray(cfg?.value?.chat_ids) ? cfg.value.chat_ids : [];
  if (chats.length === 0) return res.status(200).json({ ok: true, sent: 0, note: 'no chats' });

  let telegramSent = 0;
  for (const person of list) {
    const display = person.sauna_name ? `${person.name} („${person.sauna_name}")` : person.name;
    const text = `🎂 Heute hat <b>${display}</b> Geburtstag!\nWir wünschen einen wunderbaren Tag — auf viele weitere Aufgüsse! 🥂`;
    const results = await tgBroadcast(token, 'sendMessage', chats, (chat_id) => ({
      chat_id, text, parse_mode: 'HTML',
    }));
    telegramSent += results.filter((r) => r.ok).length;
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
    // FIX 0107 (Audit Phase 4 HIGH): UUID-Array sicher quoten statt nackt join(',')
    const notInList = birthdayMemberIds.length > 0
      ? `(${birthdayMemberIds.map((id) => `"${id}"`).join(',')})`
      : '("00000000-0000-0000-0000-000000000000")';
    const { data: subsRaw } = await sb
      .from('push_subscriptions')
      .select('endpoint, p256dh_key, auth_key, member_id')
      .not('member_id', 'in', notInList);

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
        // FIX 0107 (Audit Phase 8 CRITICAL): mit serviceClient() funktioniert
        // dieses DELETE jetzt wirklich (vorher silent NULL-Filter wegen anon-RLS).
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
