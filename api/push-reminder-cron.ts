// api/push-reminder-cron.ts — Cron-Endpoint, alle 30 Min via Supabase pg_cron.
//
// Sendet Bewertungs-Fenster-Reminder für anwesende Mitglieder mit offenen Bewertungen.
//
// Seit 0195 (Audit-Runde 2, 25.09.2026):
//  * rating_pending_reminders liefert nur Aufgüsse, bei denen die Person
//    tatsächlich da war (_war_beim_aufguss), und die echte Frist (frist):
//    Aufgießer 3 Stunden nach dem Ende, alle anderen bis 12:00 am Folgetag.
//    Vorher stand bei allen „noch X Min" mit der 3-Stunden-Frist.
//  * Je Person und Aufguss genau EINE Erinnerung: Die Aufgüsse werden VOR dem
//    Senden in bewertung_push_erinnerungen eingetragen; was dort steht, liefert
//    die Funktion nicht mehr. Vorher kam alle 30 Minuten dieselbe Erinnerung.
// Pro Member höchstens ein Push je Lauf (der jüngste offene Aufguss, weitere
// werden im Text mitgezählt und mit beansprucht).
//
// Hinweis: war zwischenzeitlich in api/cron.ts konsolidiert (Vercel-Hobby-
// 12-Function-Limit). Seit Wechsel auf Pro wieder eigener File.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { cronBearerOk, cronSecretFehlt } from './_cron.js';

interface RatingReminder {
  member_id: string;
  member_name: string;
  infusion_id: string;
  infusion_title: string;
  end_time: string;
  meister_name: string;
  // Ende des Bewertungsfensters (0195). Fehlt bei alter DB-Fassung → 3 h.
  frist?: string | null;
}

const DREI_STUNDEN_MS = 3 * 60 * 60 * 1000;

function fristMs(r: RatingReminder): number {
  const f = r.frist ? Date.parse(r.frist) : NaN;
  return Number.isFinite(f) ? f : new Date(r.end_time).getTime() + DREI_STUNDEN_MS;
}

function berlinTag(ms: number): string {
  return new Date(ms).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
}

/** „noch 25 Min" bei kurzen Fristen, sonst „bis heute/morgen 12 Uhr" (Berliner Zeit). */
function fristText(frist: number, jetzt: number): string {
  const minuten = Math.round((frist - jetzt) / 60000);
  if (minuten <= 180) return `noch ${minuten} Min bis das Bewertungsfenster zugeht.`;
  const uhr = new Date(frist).toLocaleTimeString('de-DE', {
    timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit',
  }).replace(/:00$/, '');
  const tag = berlinTag(frist) === berlinTag(jetzt) ? 'heute' : 'morgen';
  return `du kannst noch bis ${tag} ${uhr} Uhr bewerten.`;
}

interface PushSub {
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  member_id: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Cron-Schutz, fail closed (api/_cron.ts): pg_cron „push-reminder-30min"
  // schickt Authorization: Bearer aus dem Vault-Eintrag cron_secret (0168).
  if (!cronBearerOk(req)) {
    if (cronSecretFehlt()) console.error('[push-reminder-cron] abgelehnt: CRON_SECRET fehlt oder ist zu kurz');
    return res.status(401).json({ error: 'unauthorized' });
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

  // Bewertungs-Reminder: Aufgüsse der letzten 3 Stunden, bei denen die Person
  // da war und an die noch nicht per Push erinnert wurde (0195).
  const { data: ratingList, error: ratingErr } = await sb.rpc('rating_pending_reminders') as {
    data: RatingReminder[] | null; error: { message: string } | null;
  };
  if (ratingErr) return res.status(500).json({ error: 'rating_pending_reminders fehlgeschlagen' });
  const jetzt = Date.now();
  const ratingByMember = new Map<string, RatingReminder[]>();
  for (const r of (ratingList ?? [])) {
    // Fenster schließt in weniger als 5 Minuten → keine Erinnerung mehr.
    if (fristMs(r) - jetzt < 5 * 60000) continue;
    const arr = ratingByMember.get(r.member_id) ?? [];
    arr.push(r);
    ratingByMember.set(r.member_id, arr);
  }
  // Jüngster Aufguss zuerst.
  for (const arr of ratingByMember.values()) {
    arr.sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime());
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
          payload,
          // Zeitgrenze je Push-Dienst; die Erinnerung ist nach dem Fenster wertlos.
          { timeout: 8000, TTL: 3 * 3600 }
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

  let beansprucht = 0;
  for (const [memberId, offen] of ratingByMember.entries()) {
    if ((subsByMember.get(memberId) ?? []).length === 0) continue;
    // Genau einmal: VOR dem Senden eintragen. Was schon drinsteht (paralleler
    // Lauf), kommt nicht zurück — ist nichts neu, wird nichts gesendet.
    const { data: neu, error: claimErr } = await sb
      .from('bewertung_push_erinnerungen')
      .upsert(
        offen.map((r) => ({ member_id: memberId, infusion_id: r.infusion_id })),
        { onConflict: 'member_id,infusion_id', ignoreDuplicates: true },
      )
      .select('infusion_id');
    if (claimErr) {
      console.error('[push-reminder-cron] Erinnerung nicht vermerkt, nichts gesendet:', claimErr.code ?? '', claimErr.message);
      continue;
    }
    const neuIds = new Set((neu ?? []).map((x) => (x as { infusion_id: string }).infusion_id));
    const zuSenden = offen.filter((r) => neuIds.has(r.infusion_id));
    if (zuSenden.length === 0) continue;
    beansprucht += zuSenden.length;
    const r = zuSenden[0];
    const weitere = zuSenden.length > 1 ? ` (+${zuSenden.length - 1} weitere)` : '';
    ratingSent += await sendTo(
      memberId,
      `⏱️ Aufguss von ${r.meister_name} bewerten`,
      `„${r.infusion_title}"${weitere} — ${fristText(fristMs(r), jetzt)}`,
      '/bewerten',
      `rating-${r.infusion_id}`
    );
  }

  if (stale.length > 0) await sb.from('push_subscriptions').delete().in('endpoint', stale);

  return res.status(200).json({
    ok: true,
    rating_pending: ratingByMember.size,
    rating_vermerkt: beansprucht,
    rating_sent: ratingSent,
    stale_pruned: stale.length,
  });
}
