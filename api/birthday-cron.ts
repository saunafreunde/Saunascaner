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
import { cronBearerOk, cronSecretFehlt } from './_cron.js';
import { escHtml, tgBroadcast, vereinsChats } from './_telegram.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Cron-Schutz, fail closed (api/_cron.ts): der Vercel-Cron schickt bei
  // gesetztem CRON_SECRET selbst „Authorization: Bearer <CRON_SECRET>".
  if (!cronBearerOk(req)) {
    if (cronSecretFehlt()) console.error('[birthday-cron] abgelehnt: CRON_SECRET fehlt oder ist zu kurz');
    return res.status(401).json({ error: 'unauthorized' });
  }

  // Audit-Runde 2 (25.09.2026): Telegram und Web-Push laufen unabhängig
  // voneinander. Vorher brach der Lauf ohne TELEGRAM_BOT_TOKEN (500) bzw. bei
  // leerem Verteiler („ok … no chats“) ab, BEVOR ein einziger Push rausging —
  // still, der Cron sah Erfolg. Jetzt ist nur die Datenbank Pflicht; Token und
  // Chats gelten nur für den Telegram-Teil, und die Antwort nennt den Zustand.
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const sb = serviceClient();
  if (!sb) {
    return res.status(500).json({ error: 'env missing (SUPABASE_SERVICE_ROLE_KEY)' });
  }
  if (!token) console.error('[birthday-cron] TELEGRAM_BOT_TOKEN fehlt – nur Web-Push');

  // Geburtstagskinder heute
  const { data: birthdays, error } = await sb.rpc('get_birthdays_today');
  if (error) return res.status(500).json({ error: error.message });

  const list = (birthdays ?? []) as { member_id: string; name: string; sauna_name: string | null }[];
  if (list.length === 0) return res.status(200).json({ ok: true, sent: 0, note: 'no birthdays today' });

  // Freigegebener Telegram-Verteiler (0187: neue Chats erst nach Admin-Freigabe)
  const chats = token ? await vereinsChats(sb) : [];
  const telegramZustand = !token ? 'token_fehlt' : chats.length === 0 ? 'keine_chats' : 'ok';

  let telegramSent = 0;
  if (token && chats.length > 0) {
    for (const person of list) {
      // Namen sind frei eingebbar → für parse_mode HTML entschärfen.
      const display = person.sauna_name ? `${escHtml(person.name)} („${escHtml(person.sauna_name)}")` : escHtml(person.name);
      const text = `🎂 Heute hat <b>${display}</b> Geburtstag!\nWir wünschen einen wunderbaren Tag — auf viele weitere Aufgüsse! 🥂`;
      const results = await tgBroadcast(token, 'sendMessage', chats, (chat_id) => ({
        chat_id, text, parse_mode: 'HTML',
      }));
      telegramSent += results.filter((r) => r.ok).length;
    }
  }

  // Web-Push an alle außer Geburtstagskindern — immer, unabhängig von Telegram.
  // (Eigene Logik statt pushAnAlle: die Geburtstagskinder bekommen ihren
  // eigenen Glückwunsch nicht.)
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
            payload,
            // Zeitgrenze je Push-Dienst; ein Geburtstagsgruß gilt nur heute.
            { timeout: 8000, TTL: 12 * 3600 }
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

  if (!vapidPub || !vapidPriv) console.error('[birthday-cron] VAPID-Schlüssel fehlen – kein Web-Push');
  return res.status(200).json({
    ok: true,
    birthdays: list.length,
    telegram: telegramZustand,
    telegram_chats: chats.length,
    telegram_sent: telegramSent,
    push: vapidPub && vapidPriv ? 'ok' : 'vapid_fehlt',
    push_sent: pushSent,
    push_stale_pruned: pushStale.length,
  });
}
