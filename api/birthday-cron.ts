// Vercel Cron — täglich um 09:00 CET (siehe vercel.json)
// Prüft Geburtstagskinder via RPC und sendet:
//   1) Telegram-Glückwunsch an alle Saunafreunde-Chats
//   2) Web-Push an alle Mitglieder mit Subscription

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel-Cron sendet GET. Schützen via CRON_SECRET (kann optional gesetzt werden).
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization ?? '';
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!token || !supaUrl || !anonKey) {
    return res.status(500).json({ error: 'env missing' });
  }

  const sb = createClient(supaUrl, anonKey);

  // Geburtstagskinder heute
  const { data: birthdays, error } = await sb.rpc('get_birthdays_today');
  if (error) return res.status(500).json({ error: error.message });

  const list = (birthdays ?? []) as { member_id: string; name: string; sauna_name: string | null }[];
  if (list.length === 0) return res.status(200).json({ ok: true, sent: 0, note: 'no birthdays today' });

  // Telegram-Chat-IDs aus system_config
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

  // 2) Web-Push an alle Mitglieder mit Subscription (außer das Geburtstagskind selbst)
  const vapidPub = process.env.VAPID_PUBLIC_KEY;
  const vapidPriv = process.env.VAPID_PRIVATE_KEY;
  const vapidSub = process.env.VAPID_SUBJECT ?? 'mailto:admin@saunascaner.local';
  let pushSent = 0, pushStale: string[] = [];

  if (vapidPub && vapidPriv) {
    webpush.setVapidDetails(vapidSub, vapidPub, vapidPriv);
    const birthdayMemberIds = list.map((p) => p.member_id);

    const { data: subsRaw } = await sb
      .from('push_subscriptions')
      .select('endpoint, p256dh_key, auth_key, member_id')
      .not('member_id', 'in', `(${birthdayMemberIds.map((id) => `'${id}'`).join(',') || "'00000000-0000-0000-0000-000000000000'"})`);

    type Sub = { endpoint: string; p256dh_key: string; auth_key: string; member_id: string };
    const subs = (subsRaw ?? []) as Sub[];

    if (subs.length > 0) {
      // Nachricht zusammenfassen für mehrere Geburtstagskinder
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
