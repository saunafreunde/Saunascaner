// Vercel Serverless Function — POST /api/send-evacuation
// Schickt den LAUFENDEN Evakuierungsalarm (Text + optional Foto) an alle
// Vereins-Telegram-Chats. Bot-Token bleibt serverseitig.
//
// Neu 25.09.2026 (Audit): vorher ohne jede Anmeldung, und Auslöser, Zeit und
// Namensliste kamen aus dem Browser — jeder im Internet konnte einen falschen
// Alarm samt Foto an alle Chats schicken. Jetzt:
//  * Zugang: eingeloggtes Mitglied (nicht Gast/Fan) ODER gekoppeltes
//    Kiosk-Gerät (Header x-kiosk-geraet, Migration 0177) — übergangsweise jeder
//    Kiosk, solange noch KEIN Gerät gekoppelt ist (ein echter Alarm darf nie
//    scheitern).
//  * Inhalt: kommt aus der Datenbank (laufender Alarm der letzten 15 Minuten,
//    Anwesenheitsliste vom Server gesetzt). Body-Felder außer dem Foto werden
//    ignoriert.
//  * Genau einmal je Alarm: telegram_status wird vor dem Senden „beansprucht".
//  * Seit 25.09.2026 geht mit dem Telegram-Text auch der Web-Push an alle
//    Abos raus (api/_webpush.ts) — der Browser schickt keinen eigenen mehr.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, serviceClient } from './_auth.js';
import { tgBroadcast, vereinsChats } from './_telegram.js';
import { pushAnAlle } from './_webpush.js';

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // Telegram erlaubt 10 MB für sendPhoto
const ALARM_FENSTER_MS = 15 * 60_000;

async function zugangOk(req: VercelRequest, sb: NonNullable<ReturnType<typeof serviceClient>>): Promise<boolean> {
  const geraet = req.headers['x-kiosk-geraet'];
  const token = Array.isArray(geraet) ? geraet[0] : geraet;
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    const { data } = await sb.rpc('kiosk_geraet_art', { p_token: token });
    if (typeof data === 'string' && data) return true;
  }
  if (req.headers.authorization) {
    const auth = await authenticate(req);
    if (auth.ok && ['admin', 'staff', 'member', 'guest_aufgieser'].includes(auth.member.role)) return true;
  }
  // Übergang: noch kein Kiosk-Gerät gekoppelt → wie bisher offen (nur der
  // laufende Alarm kann gesendet werden, und nur einmal).
  const { count } = await sb.from('kiosk_geraete').select('id', { count: 'exact', head: true }).is('widerrufen_at', null);
  return (count ?? 0) === 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const sb = serviceClient();
  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN missing' });
  if (!sb) return res.status(500).json({ error: 'Supabase service env missing' });

  if (!(await zugangOk(req, sb))) return res.status(403).json({ error: 'nicht_berechtigt' });

  const seit = new Date(Date.now() - ALARM_FENSTER_MS).toISOString();
  const { data: ev, error: evErr } = await sb
    .from('evacuation_events')
    .select('id, triggered_by, triggered_at, present_names, telegram_status')
    .is('ended_at', null)
    .gte('triggered_at', seit)
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (evErr) return res.status(500).json({ error: 'alarm_lesen_fehlgeschlagen' });
  if (!ev) return res.status(409).json({ error: 'kein_aktiver_alarm' });
  if (ev.telegram_status) return res.status(200).json({ ok: true, via: 'telegram', schon_gesendet: true, sent: 0 });

  // Beanspruchen: nur wer telegram_status von NULL auf „sende" setzt, sendet.
  const { data: claim } = await sb
    .from('evacuation_events')
    .update({ telegram_status: 'sende' })
    .eq('id', ev.id)
    .is('telegram_status', null)
    .select('id');
  if (!claim || claim.length === 0) return res.status(200).json({ ok: true, via: 'telegram', schon_gesendet: true, sent: 0 });

  let ausloeser = 'Kiosk-Gerät';
  if (ev.triggered_by) {
    const { data: m } = await sb.from('members').select('name').eq('id', ev.triggered_by).maybeSingle();
    if (m?.name) ausloeser = m.name;
  }

  // Web-Push an ALLE Abos — genau einmal je Alarm (wir haben ihn eben
  // beansprucht) und egal, wer ausgelöst hat: auch das Öl-Raum-Tablet ohne
  // Login. Vorher schickte nur der Admin-Knopf im Browser einen Rundruf.
  const push = await pushAnAlle(sb, {
    title: '🚨 EVAKUIERUNG',
    body: `Bitte sofort das Gebäude verlassen — ausgelöst von ${ausloeser}`,
    url: '/dashboard',
    tag: 'evacuation',
    requireInteraction: true,
  }).catch(() => ({ gesendet: 0, gesamt: 0, fehlt: 'fehler' }));

  // Freigegebener Verteiler, ohne Chats gesperrter Mitglieder (0187).
  const chats = await vereinsChats(sb);
  if (chats.length === 0) {
    await sb.from('evacuation_events').update({ telegram_status: 'keine_chats' }).eq('id', ev.id);
    return res.status(200).json({ ok: true, via: 'telegram', sent: 0, note: 'no chats subscribed', push });
  }
  const namen: string[] = Array.isArray(ev.present_names) ? ev.present_names : [];

  const esc = (s: string) => s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  const caption = [
    '🚨 *EVAKUIERUNG ausgelöst*',
    `Auslöser: ${esc(ausloeser)}`,
    `Zeit: ${esc(new Date(ev.triggered_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }))}`,
    '',
    `Anwesend \\(${namen.length}\\):`,
    ...(namen.length ? namen.map((n) => `• ${esc(n)}`) : ['_keine Personen erfasst_']),
  ].join('\n').slice(0, 1000);

  // Foto (optional) — nur JPEG/PNG, mit Größenbremse.
  let photoBuffer: Buffer | null = null;
  const photoBase64 = (req.body as { photoBase64?: unknown } | undefined)?.photoBase64;
  if (typeof photoBase64 === 'string' && /^data:image\/(jpeg|png);base64,/.test(photoBase64)) {
    try {
      const buf = Buffer.from(photoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      if (buf.length > 0 && buf.length <= MAX_PHOTO_BYTES) photoBuffer = buf;
    } catch { /* ohne Foto weiter */ }
  }

  let results;
  if (photoBuffer) {
    const ab = photoBuffer.buffer.slice(photoBuffer.byteOffset, photoBuffer.byteOffset + photoBuffer.byteLength) as ArrayBuffer;
    results = await tgBroadcast(token, 'sendPhoto', chats, (chat_id) => {
      const fd = new FormData();
      fd.append('chat_id', String(chat_id));
      fd.append('photo', new Blob([ab], { type: 'image/jpeg' }), 'evac.jpg');
      fd.append('caption', caption);
      fd.append('parse_mode', 'MarkdownV2');
      return fd;
    });
    const failed = results.filter((r) => !r.ok).map((r) => r.chat_id);
    if (failed.length > 0) {
      const textResults = await tgBroadcast(token, 'sendMessage', failed, (chat_id) => ({ chat_id, text: caption, parse_mode: 'MarkdownV2' }));
      results = results.map((r) => (r.ok ? r : textResults.find((t) => t.chat_id === r.chat_id) ?? r));
    }
  } else {
    results = await tgBroadcast(token, 'sendMessage', chats, (chat_id) => ({ chat_id, text: caption, parse_mode: 'MarkdownV2' }));
  }

  const sent = results.filter((r) => r.ok).length;
  await sb.from('evacuation_events').update({ telegram_status: `gesendet ${sent}/${chats.length}` }).eq('id', ev.id);
  return res.status(200).json({ ok: true, via: 'telegram', sent, total: chats.length, withPhoto: !!photoBuffer, push });
}
