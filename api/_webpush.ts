// Web-Push an ALLE Abos — für Meldungen, die der Server selbst auslöst
// (Evakuierungsalarm, 25.09.2026). Normale Pushes laufen über push-send.ts.
//
// Liefert die Zahl der Zustellungen und räumt tote Abos (404/410) weg.

import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';

const PUSH_OPTS = { timeout: 8000, TTL: 3600 };

export type ServerPush = { title: string; body: string; url: string; tag: string; requireInteraction?: boolean };

export async function pushAnAlle(sb: SupabaseClient, inhalt: ServerPush): Promise<{ gesendet: number; gesamt: number; fehlt?: string }> {
  const vapidPub = process.env.VAPID_PUBLIC_KEY;
  const vapidPriv = process.env.VAPID_PRIVATE_KEY;
  const vapidSub = process.env.VAPID_SUBJECT ?? 'mailto:admin@saunascaner.local';
  if (!vapidPub || !vapidPriv) return { gesendet: 0, gesamt: 0, fehlt: 'vapid' };
  webpush.setVapidDetails(vapidSub, vapidPub, vapidPriv);

  const { data: subs, error } = await sb.from('push_subscriptions').select('endpoint, p256dh_key, auth_key');
  if (error || !subs) return { gesendet: 0, gesamt: 0, fehlt: 'abos' };

  const payload = JSON.stringify({
    title: inhalt.title.slice(0, 120),
    body: inhalt.body.slice(0, 400),
    url: inhalt.url,
    tag: inhalt.tag,
    requireInteraction: !!inhalt.requireInteraction,
  });
  const ergebnisse = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } },
      payload,
      PUSH_OPTS,
    )),
  );
  let gesendet = 0;
  const tot: string[] = [];
  ergebnisse.forEach((r, i) => {
    if (r.status === 'fulfilled') gesendet++;
    else {
      const code = (r.reason as { statusCode?: number } | undefined)?.statusCode;
      if (code === 404 || code === 410) tot.push(subs[i].endpoint);
    }
  });
  if (tot.length) await sb.from('push_subscriptions').delete().in('endpoint', tot);
  return { gesendet, gesamt: subs.length };
}
