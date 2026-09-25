// Vercel Serverless Function — POST /api/send-evacuation
// Verschickt den LAUFENDEN Evakuierungsalarm: Web-Push an alle Abos und
// Telegram-Text an alle Vereins-Chats (genau einmal je Alarm), dazu optional
// ein Foto vom Öl-Raum-Tablet als eigene Nachricht (ebenfalls genau einmal).
// Bot-Token bleibt serverseitig.
//
// Stand Audit-Runde 2 (25.09.2026, Migration 0191):
//  * Wer ruft? Zuerst die DATENBANK selbst: Nach dem INSERT eines Alarms stößt
//    der Trigger trg_evakuierung_versand per pg_net diesen Endpunkt an
//    (Header x-cron-secret, Body { alarm_id }). Text und Push hängen damit
//    nicht mehr am Browser. Der Browser-Aufruf danach ist nur noch Rückfall
//    (falls der Server-Aufruf scheiterte) bzw. bringt das Öl-Raum-Foto.
//  * Zugang: Cron-Geheimnis, gekoppeltes Kiosk-Gerät (Header x-kiosk-geraet),
//    eingeloggtes Mitglied (nicht Gast/Fan) — und übergangsweise ein
//    ungekoppelter Kiosk, solange public.evakuierung_uebergang_offen() true
//    liefert (noch nie ein Öl-Raum-Tablet gekoppelt, längstens bis 08.10.2026).
//    Scheitert die Prüfung selbst (DB-Fehler), wird abgelehnt.
//  * Inhalt: kommt aus der Datenbank (Alarm der letzten 15 Minuten, Namens-
//    liste vom Server gesetzt). Body-Felder außer alarm_id (nur Cron) und dem
//    Foto werden ignoriert.
//  * Genau einmal: Text + Push über telegram_status, Foto über foto_status —
//    jeweils vor dem Senden „beansprucht".
//  * Foto nur von gekoppelten Geräten oder angemeldeten Mitgliedern, nie im
//    Übergang (sonst ließe sich ein beliebiges Bild an alle Chats schicken).
//  * Fehlt das Telegram-Token, geht der Push trotzdem raus.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticate, serviceClient } from './_auth.js';
import { cronHeaderOk } from './_cron.js';
import { tgBroadcast, vereinsChats } from './_telegram.js';
import { pushAnAlle } from './_webpush.js';

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // Telegram erlaubt 10 MB für sendPhoto
const ALARM_FENSTER_MS = 15 * 60_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALARM_ROLLEN = ['admin', 'staff', 'member', 'guest_aufgieser'];

type Zugang = 'cron' | 'geraet' | 'mitglied' | 'uebergang';

type Alarm = {
  id: string;
  triggered_by: string | null;
  triggered_at: string;
  present_names: unknown;
  telegram_status: string | null;
  foto_status?: string | null;
  quelle?: string | null;
};

async function zugang(req: VercelRequest, sb: SupabaseClient): Promise<Zugang | null> {
  if (cronHeaderOk(req)) return 'cron';
  const geraet = req.headers['x-kiosk-geraet'];
  const token = Array.isArray(geraet) ? geraet[0] : geraet;
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    const { data } = await sb.rpc('kiosk_geraet_art', { p_token: token });
    if (typeof data === 'string' && data) return 'geraet';
  }
  if (req.headers.authorization) {
    const auth = await authenticate(req);
    if (auth.ok && ALARM_ROLLEN.includes(auth.member.role)) return 'mitglied';
  }
  // Übergang — dieselbe Regel wie in evakuierung_ausloesen (0191). Fehler → zu.
  const { data, error } = await sb.rpc('evakuierung_uebergang_offen');
  if (error) {
    console.error('[send-evacuation] Übergangsprüfung fehlgeschlagen', error.code ?? '');
    return null;
  }
  return data === true ? 'uebergang' : null;
}

const esc = (s: string) => s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
const zeitText = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });

async function ausloeserName(sb: SupabaseClient, ev: Alarm): Promise<string> {
  if (ev.triggered_by) {
    const { data: m } = await sb.from('members').select('name').eq('id', ev.triggered_by).maybeSingle();
    if (m?.name) return m.name as string;
  }
  return ev.quelle === 'uebergang' ? 'ungekoppeltes Kiosk-Gerät' : 'Kiosk-Gerät';
}

/** Push an alle + Telegram-Text an alle Chats. Nur aufrufen, wenn telegram_status beansprucht ist. */
async function textUndPush(sb: SupabaseClient, tgToken: string | undefined, ev: Alarm) {
  const ausloeser = await ausloeserName(sb, ev);

  // Push zuerst und unabhängig von Telegram. Ziel '/': dort zeigt das globale
  // Overlay den Alarm mit „Beenden"-Knopf; /dashboard (TV-Tafel) hat keinen.
  const push = await pushAnAlle(sb, {
    title: '🚨 EVAKUIERUNG',
    body: `Bitte sofort das Gebäude verlassen — ausgelöst von ${ausloeser}`,
    url: '/',
    tag: 'evacuation',
    requireInteraction: true,
  }).catch(() => ({ gesendet: 0, gesamt: 0, fehlt: 'fehler' }));

  if (!tgToken) {
    await sb.from('evacuation_events').update({ telegram_status: 'kein_token' }).eq('id', ev.id);
    return { sent: 0, total: 0, note: 'telegram_token_fehlt', push };
  }
  // Freigegebener Verteiler, ohne Chats gesperrter Mitglieder (0187).
  const chats = await vereinsChats(sb);
  if (chats.length === 0) {
    await sb.from('evacuation_events').update({ telegram_status: 'keine_chats' }).eq('id', ev.id);
    return { sent: 0, total: 0, note: 'no chats subscribed', push };
  }

  const namen: string[] = Array.isArray(ev.present_names) ? (ev.present_names as string[]) : [];
  const text = [
    '🚨 *EVAKUIERUNG ausgelöst*',
    `Auslöser: ${esc(ausloeser)}`,
    `Zeit: ${esc(zeitText(ev.triggered_at))}`,
    '',
    `Anwesend \\(${namen.length}\\):`,
    ...(namen.length ? namen.map((n) => `• ${esc(n)}`) : ['_keine Personen erfasst_']),
  ].join('\n').slice(0, 4000);

  const results = await tgBroadcast(tgToken, 'sendMessage', chats, (chat_id) => ({ chat_id, text, parse_mode: 'MarkdownV2' }));
  const sent = results.filter((r) => r.ok).length;
  await sb.from('evacuation_events').update({ telegram_status: `gesendet ${sent}/${chats.length}` }).eq('id', ev.id);
  return { sent, total: chats.length, push };
}

/** Foto als eigene Nachricht — genau einmal je Alarm (foto_status). */
async function fotoNachschicken(sb: SupabaseClient, tgToken: string | undefined, ev: Alarm, foto: Buffer): Promise<string> {
  const { data: claim, error } = await sb
    .from('evacuation_events')
    .update({ foto_status: 'sende' })
    .eq('id', ev.id)
    .is('foto_status', null)
    .select('id');
  if (error) return 'fehler';
  if (!claim || claim.length === 0) return 'schon_gesendet';
  if (!tgToken) {
    await sb.from('evacuation_events').update({ foto_status: 'kein_token' }).eq('id', ev.id);
    return 'kein_token';
  }
  const chats = await vereinsChats(sb);
  if (chats.length === 0) {
    await sb.from('evacuation_events').update({ foto_status: 'keine_chats' }).eq('id', ev.id);
    return 'keine_chats';
  }
  const caption = `📷 *Foto zum Evakuierungsalarm* \\(${esc(zeitText(ev.triggered_at))}\\)`;
  const ab = foto.buffer.slice(foto.byteOffset, foto.byteOffset + foto.byteLength) as ArrayBuffer;
  const results = await tgBroadcast(tgToken, 'sendPhoto', chats, (chat_id) => {
    const fd = new FormData();
    fd.append('chat_id', String(chat_id));
    fd.append('photo', new Blob([ab], { type: 'image/jpeg' }), 'evac.jpg');
    fd.append('caption', caption);
    fd.append('parse_mode', 'MarkdownV2');
    return fd;
  });
  const status = `gesendet ${results.filter((r) => r.ok).length}/${chats.length}`;
  await sb.from('evacuation_events').update({ foto_status: status }).eq('id', ev.id);
  return status;
}

function fotoAusBody(body: unknown): Buffer | null {
  const photoBase64 = (body as { photoBase64?: unknown } | undefined)?.photoBase64;
  if (typeof photoBase64 !== 'string' || !/^data:image\/(jpeg|png);base64,/.test(photoBase64)) return null;
  try {
    const buf = Buffer.from(photoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    return buf.length > 0 && buf.length <= MAX_PHOTO_BYTES ? buf : null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const tgToken = process.env.TELEGRAM_BOT_TOKEN || undefined;
  const sb = serviceClient();
  if (!sb) return res.status(500).json({ error: 'Supabase service env missing' });

  const z = await zugang(req, sb);
  if (!z) return res.status(403).json({ error: 'nicht_berechtigt' });

  // Der Server-Aufruf nennt seinen Alarm; der Browser nimmt den jüngsten laufenden.
  const alarmId = (req.body as { alarm_id?: unknown } | undefined)?.alarm_id;
  const seit = new Date(Date.now() - ALARM_FENSTER_MS).toISOString();
  let q = sb.from('evacuation_events').select('*').is('ended_at', null).gte('triggered_at', seit);
  if (z === 'cron' && typeof alarmId === 'string' && UUID_RE.test(alarmId)) q = q.eq('id', alarmId);
  const { data: ev, error: evErr } = await q.order('triggered_at', { ascending: false }).limit(1).maybeSingle<Alarm>();
  if (evErr) return res.status(500).json({ error: 'alarm_lesen_fehlgeschlagen' });
  if (!ev) return res.status(409).json({ error: 'kein_aktiver_alarm' });

  // 1) Text + Push — genau einmal. Beanspruchen: nur wer telegram_status von
  //    NULL auf „sende" setzt, sendet.
  let text: Record<string, unknown> = { schon_gesendet: true, sent: 0 };
  if (!ev.telegram_status) {
    const { data: claim, error: claimErr } = await sb
      .from('evacuation_events')
      .update({ telegram_status: 'sende' })
      .eq('id', ev.id)
      .is('telegram_status', null)
      .select('id');
    if (claimErr) return res.status(500).json({ error: 'beanspruchen_fehlgeschlagen' });
    if (claim && claim.length > 0) text = await textUndPush(sb, tgToken, ev);
  }

  // 2) Foto (Öl-Raum-Kamera) als eigene Nachricht — nie im Übergang.
  const foto = fotoAusBody(req.body);
  let fotoStatus: string | undefined;
  if (foto) {
    fotoStatus = z === 'geraet' || z === 'mitglied'
      ? await fotoNachschicken(sb, tgToken, ev, foto)
      : 'nicht_erlaubt';
  }

  return res.status(200).json({ ok: true, via: 'telegram', ...text, ...(fotoStatus ? { foto: fotoStatus } : {}) });
}
