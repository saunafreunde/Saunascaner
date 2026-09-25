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
//
// Audit-Runde 3 (25.09.2026, Migration 0199):
//  * Der Versand hängt nie mehr still: Push und Telegram laufen parallel,
//    jeder Telegram-Aufruf hat eine Zeitgrenze, 429-Wartezeiten sind
//    gedeckelt, und ab FRIST_TG_MS nach Start beginnt kein Telegram-Versuch
//    mehr. Den Endstatus schreibt ein finally — auch nach einem Fehler.
//  * Beanspruchen über evakuierung_versand_beanspruchen() (Datenbankzeit):
//    NULL → „sende“, oder ein „sende“, das seit über 90 s hängt (die Function
//    ist dann sicher tot, maxDuration 30 s) — höchstens einmal übernehmen.
//    Der pg_cron-Job „evakuierung-nachfassen“ ruft diesen Endpunkt jede Minute
//    für solche Alarme erneut auf; der Browser-Rückfall tut das nur in den
//    ersten Sekunden.
//  * Ehrlicher Status: 'gesendet k/n' (k ≥ 1) bzw. 'fehlgeschlagen 0/n', dazu
//    ' · push a/b' (oder ' · push fehlt:<grund>'); 'kein_token · push …',
//    'keine_chats · push …', 'fehler · push …'. Ältere Werte ('gesendet k/n'
//    ohne Push-Teil) liest das Vollbild weiterhin.
//  * Tote Chats (Bot blockiert …) werden danach pausiert (_telegram.ts).
//
// Audit-Runde 4 (25.09.2026, Migration 0207):
//  * Telegram-Text mit zweitem Versuch auch bei 5xx, Netzfehler und
//    Zeitüberschreitung (tgSendOnce, Opt-in wiederholen) — innerhalb der Frist.
//  * Nur-Telegram-Nachversand: Kam der Text bei KEINEM Chat an
//    ('fehlgeschlagen 0/n · …' bzw. 'fehler · …'), beansprucht
//    evakuierung_telegram_nachversand_beanspruchen() den Alarm frühestens
//    60 s später erneut (höchstens 2×, nur laufende Alarme der letzten
//    15 Minuten; der Nachfass-Job ruft dafür an). Status währenddessen
//    'nachsende · <alter Push-Teil>'. Verschickt wird NUR Telegram — der Push
//    kam schon und wird nicht wiederholt; sein Teil im Status bleibt stehen.
//    Teilausfälle ('gesendet k/n', k ≥ 1) werden nicht nachgesendet.
//  * Ist der Verteiler (system_config) nicht lesbar, lautet der Status jetzt
//    'fehler · …' (und wird nachgesendet) statt still 'keine_chats'.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticate, serviceClient } from './_auth.js';
import { cronHeaderOk } from './_cron.js';
import { tgBroadcast, toteChatsMerken, vereinsChats, vereinsChatsStreng, type TgResult } from './_telegram.js';
import { pushAnAlle } from './_webpush.js';

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // Telegram erlaubt 10 MB für sendPhoto
const ALARM_FENSTER_MS = 15 * 60_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALARM_ROLLEN = ['admin', 'staff', 'member', 'guest_aufgieser'];
// Zeitplan innerhalb von maxDuration 30 s (vercel.json), gemessen ab Aufruf:
const FRIST_TG_MS = 22_000;     // danach beginnt kein Telegram-Versuch mehr
const FRIST_PUSH_MS = 12_000;   // Push wird nach so langer Zeit nicht mehr abgewartet
const FRIST_FOTO_MS = 27_000;   // letzter Beginn eines Foto-Versuchs
const MIN_FOTO_REST_MS = 5_000; // weniger Restzeit → Foto gar nicht erst beanspruchen
/** Stände, bei denen Telegram allein nachgesendet werden darf (0207) — die
 *  Datenbank prüft Frist und Zähler (evakuierung_telegram_nachversand_beanspruchen). */
const NACHSENDBAR_RE = /^(?:fehlgeschlagen 0\/|fehler · |nachsende)/;

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

type PushErgebnis = { gesendet: number; gesamt: number; fehlt?: string };

/** Wartet höchstens ms auf p; danach gilt ersatz (p läuft im Hintergrund weiter). */
function mitFrist<T>(p: Promise<T>, ms: number, ersatz: T): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const zeit = new Promise<T>((res) => { t = setTimeout(() => res(ersatz), Math.max(0, ms)); });
  return Promise.race([p, zeit]).finally(() => { if (t) clearTimeout(t); });
}

function pushTeil(p: PushErgebnis | null): string {
  if (!p) return 'push fehlt:fehler';
  if (p.fehlt) return `push fehlt:${p.fehlt}`;
  return `push ${p.gesendet}/${p.gesamt}`;
}

/** Endstatus schreiben — bei einem Datenbankfehler einmal wiederholen (sonst
 *  bliebe „sende“ stehen und der Nachfass-Job schickte alles noch einmal). */
async function statusSchreiben(sb: SupabaseClient, id: string, status: string): Promise<void> {
  for (let versuch = 1; versuch <= 2; versuch++) {
    const { error } = await sb.from('evacuation_events')
      .update({ telegram_status: status, telegram_status_seit: new Date().toISOString() })
      .eq('id', id);
    if (!error) return;
    // Vor 0199 fehlt die Spalte telegram_status_seit — dann nur den Status.
    if (error.code === 'PGRST204' || /telegram_status_seit/.test(error.message ?? '')) {
      const alt = await sb.from('evacuation_events').update({ telegram_status: status }).eq('id', id);
      if (!alt.error) return;
    }
    console.error('[send-evacuation] Status schreiben fehlgeschlagen', error.code ?? '');
  }
}

/** Ergebnis des Telegram-Texts (Teil vor „ · “ im Status). */
type TgErgebnis = { teil: string; sent: number; total: number; note?: string; results: TgResult[] };

/**
 * Telegram-Text an alle Vereins-Chats (parallel, mit Frist und — 0207 — mit
 * zweitem Versuch bei 5xx/Netz-/Zeitfehler). Wirft, wenn der Verteiler nicht
 * lesbar ist (→ Status 'fehler', wird nachgesendet).
 */
async function telegramText(
  sb: SupabaseClient, tgToken: string | undefined, ev: Alarm, ausloeser: string, t0: number, nachversand: boolean,
): Promise<TgErgebnis> {
  if (!tgToken) return { teil: 'kein_token', sent: 0, total: 0, note: 'telegram_token_fehlt', results: [] };
  // Freigegebener Verteiler, ohne Chats gesperrter Mitglieder (0187) und
  // ohne pausierte tote Chats (0199). Lesefehler ≠ „keine Chats“ (0207).
  const chats = await vereinsChatsStreng(sb);
  if (chats === null) throw new Error('verteiler_nicht_lesbar');
  if (chats.length === 0) return { teil: 'keine_chats', sent: 0, total: 0, note: 'no chats subscribed', results: [] };
  const namen: string[] = Array.isArray(ev.present_names) ? (ev.present_names as string[]) : [];
  const text = [
    '🚨 *EVAKUIERUNG ausgelöst*',
    // Nachversand: ohne MarkdownV2-Sonderzeichen (. - ! ( ) …) formuliert.
    ...(nachversand ? ['_Nachversand, der erste Versand kam bei keinem Chat an_'] : []),
    `Auslöser: ${esc(ausloeser)}`,
    `Zeit: ${esc(zeitText(ev.triggered_at))}`,
    '',
    `Anwesend \\(${namen.length}\\):`,
    ...(namen.length ? namen.map((n) => `• ${esc(n)}`) : ['_keine Personen erfasst_']),
  ].join('\n').slice(0, 4000);
  const results = await tgBroadcast(tgToken, 'sendMessage', chats, (chat_id) => ({ chat_id, text, parse_mode: 'MarkdownV2' }), {
    parallel: true,
    timeoutMs: 8_000,
    max429WarteMs: 3_000,
    fristBis: t0 + FRIST_TG_MS,
    toteMerken: false, // erst nach dem Status (Aufrufer)
    wiederholen: true, // 0207: auch bei 5xx/Netz/Zeit ein zweites Mal, solange die Frist reicht
  });
  const sent = results.filter((r) => r.ok).length;
  return {
    teil: sent > 0 ? `gesendet ${sent}/${chats.length}` : `fehlgeschlagen 0/${chats.length}`,
    sent,
    total: chats.length,
    results,
  };
}

/**
 * Push an alle + Telegram-Text an alle Chats, parallel und mit Frist.
 * Nur aufrufen, wenn telegram_status beansprucht ist. Schreibt IMMER einen
 * Endstatus (finally).
 */
async function textUndPush(sb: SupabaseClient, tgToken: string | undefined, ev: Alarm, t0: number) {
  let push: PushErgebnis | null = null;
  let tgTeil = 'fehler';
  let sent = 0;
  let total = 0;
  let note: string | undefined;
  let results: TgResult[] = [];
  try {
    const ausloeser = await ausloeserName(sb, ev);

    // Push unabhängig von Telegram (parallel). Ziel '/': dort zeigt das
    // globale Overlay den Alarm mit „Beenden"-Knopf; /dashboard hat keinen.
    const pushP = mitFrist<PushErgebnis>(
      pushAnAlle(sb, {
        title: '🚨 EVAKUIERUNG',
        body: `Bitte sofort das Gebäude verlassen — ausgelöst von ${ausloeser}`,
        url: '/',
        tag: 'evacuation',
        requireInteraction: true,
      }).catch(() => ({ gesendet: 0, gesamt: 0, fehlt: 'fehler' })),
      t0 + FRIST_PUSH_MS - Date.now(),
      { gesendet: 0, gesamt: 0, fehlt: 'zeit' },
    );

    const tgP = telegramText(sb, tgToken, ev, ausloeser, t0, false);

    const [p, tg] = await Promise.allSettled([pushP, tgP]);
    push = p.status === 'fulfilled' ? p.value : null;
    if (tg.status === 'fulfilled') {
      ({ teil: tgTeil, sent, total, note, results } = tg.value);
    } else {
      console.error('[send-evacuation] Telegram-Versand abgebrochen', (tg.reason as Error)?.message ?? '');
    }
  } catch (e) {
    console.error('[send-evacuation] Versand abgebrochen', (e as Error)?.message ?? '');
  } finally {
    await statusSchreiben(sb, ev.id, `${tgTeil} · ${pushTeil(push)}`);
  }
  await toteChatsMerken(sb, results);
  return {
    sent,
    total,
    ...(note ? { note } : {}),
    push: push ?? { gesendet: 0, gesamt: 0, fehlt: 'fehler' },
    status: `${tgTeil} · ${pushTeil(push)}`,
  };
}

/** Push-Teil eines Status ('… · push 4/4' → 'push 4/4'), sonst null. */
function pushTeilAus(status: string | null): string | null {
  if (!status) return null;
  const i = status.indexOf(' · ');
  return i >= 0 ? status.slice(i + 3) : null;
}

/**
 * Nur-Telegram-Nachversand (0207): nur aufrufen, wenn
 * evakuierung_telegram_nachversand_beanspruchen den Alarm beansprucht hat.
 * Push wird NICHT erneut verschickt — der Push-Teil des bisherigen Status
 * bleibt stehen. Schreibt IMMER einen Endstatus (finally).
 */
async function telegramNachsenden(sb: SupabaseClient, tgToken: string | undefined, ev: Alarm, t0: number, nr: number) {
  const alterPush = pushTeilAus(ev.telegram_status);
  let tg: TgErgebnis | null = null;
  const status = () => `${tg?.teil ?? 'fehler'}${alterPush ? ` · ${alterPush}` : ''}`;
  try {
    const ausloeser = await ausloeserName(sb, ev);
    tg = await telegramText(sb, tgToken, ev, ausloeser, t0, true);
  } catch (e) {
    console.error('[send-evacuation] Telegram-Nachversand abgebrochen', (e as Error)?.message ?? '');
  } finally {
    await statusSchreiben(sb, ev.id, status());
  }
  await toteChatsMerken(sb, tg?.results ?? []);
  console.warn('[send-evacuation] Telegram-Nachversand', nr, tg?.teil ?? 'fehler');
  return {
    nachversand: nr,
    sent: tg?.sent ?? 0,
    total: tg?.total ?? 0,
    ...(tg?.note ? { note: tg.note } : {}),
    status: status(),
  };
}

/**
 * Nur-Telegram-Nachversand beanspruchen (0207). Ergebnis: Nummer des
 * Nachversuchs (1–2), 0 = nicht (noch zu früh, schon beansprucht, Zähler
 * voll, Alarm beendet), null = Datenbankfehler. Fehlt die Funktion noch
 * (Code vor der Migration ausgeliefert): 0 — dann wie bisher kein Nachversand.
 */
async function nachversandBeanspruchen(sb: SupabaseClient, ev: Alarm): Promise<number | null> {
  const { data, error } = await sb.rpc('evakuierung_telegram_nachversand_beanspruchen', { p_alarm: ev.id });
  if (!error) return typeof data === 'number' ? data : 0;
  if (error.code === 'PGRST202' || error.code === '42883') return 0;
  console.error('[send-evacuation] Nachversand beanspruchen fehlgeschlagen', error.code ?? '');
  return null;
}

/** Foto als eigene Nachricht — genau einmal je Alarm (foto_status). */
async function fotoNachschicken(sb: SupabaseClient, tgToken: string | undefined, ev: Alarm, foto: Buffer, t0: number): Promise<string> {
  // Zu wenig Zeit übrig (der Aufruf hat vorher selbst Text + Push verschickt):
  // gar nicht erst beanspruchen, sonst bliebe foto_status auf „sende“ stehen.
  if (t0 + FRIST_FOTO_MS - Date.now() < MIN_FOTO_REST_MS) return 'keine_zeit';
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
  }, { parallel: true, timeoutMs: 20_000, max429WarteMs: 3_000, fristBis: t0 + FRIST_FOTO_MS, toteMerken: false });
  const angekommen = results.filter((r) => r.ok).length;
  const status = `${angekommen > 0 ? 'gesendet' : 'fehlgeschlagen'} ${angekommen}/${chats.length}`;
  await sb.from('evacuation_events').update({ foto_status: status }).eq('id', ev.id);
  // Wie beim Text: tote Chats erst NACH dem Status pausieren — das Foto endet
  // knapp vor maxDuration, der Status darf nicht an einer Nebenabfrage hängen.
  await toteChatsMerken(sb, results);
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

/**
 * Text + Push beanspruchen (0199). Ergebnis: Nummer des Versuchs (1 = erster
 * Versand, 2 = Übernahme eines hängenden Versands), 0 = schon beansprucht,
 * null = Datenbankfehler. Fehlt die Funktion noch (Code vor der Migration
 * ausgeliefert), gilt die alte Regel „nur von NULL auf sende“.
 */
async function beanspruchen(sb: SupabaseClient, ev: Alarm): Promise<number | null> {
  const { data, error } = await sb.rpc('evakuierung_versand_beanspruchen', { p_alarm: ev.id });
  if (!error) return typeof data === 'number' ? data : 0;
  const fehltNoch = error.code === 'PGRST202' || error.code === '42883';
  if (!fehltNoch) {
    console.error('[send-evacuation] Beanspruchen fehlgeschlagen', error.code ?? '');
    return null;
  }
  if (ev.telegram_status) return 0;
  const { data: claim, error: claimErr } = await sb
    .from('evacuation_events')
    .update({ telegram_status: 'sende' })
    .eq('id', ev.id)
    .is('telegram_status', null)
    .select('id');
  if (claimErr) return null;
  return claim && claim.length > 0 ? 1 : 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const t0 = Date.now();

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
  //    NULL auf „sende" setzt (oder ein seit über 90 s hängendes „sende“
  //    übernimmt, höchstens einmal — 0199), sendet. Wer nicht sendet, bekommt
  //    den tatsächlichen Stand zurück statt einer pauschalen Erfolgsmeldung.
  let text: Record<string, unknown> = { schon_gesendet: true, sent: 0, status: ev.telegram_status };
  if (!ev.telegram_status || ev.telegram_status === 'sende') {
    const versuch = await beanspruchen(sb, ev);
    if (versuch === null) return res.status(500).json({ error: 'beanspruchen_fehlgeschlagen' });
    if (versuch > 0) {
      if (ev.telegram_status === 'sende') console.warn('[send-evacuation] hängenden Versand übernommen, Versuch', versuch);
      text = await textUndPush(sb, tgToken, ev, t0);
    }
  } else if (NACHSENDBAR_RE.test(ev.telegram_status)) {
    // 1b) Telegram kam bei KEINEM Chat an (oder ein Nachversand hängt): nur
    //     Telegram nachsenden, ohne Push (0207). Frist (60 s bzw. 90 s) und
    //     Zähler (höchstens 2×) prüft die Datenbank. Ein Datenbankfehler hier
    //     bricht den Aufruf nicht ab (das Foto soll trotzdem raus).
    const nr = await nachversandBeanspruchen(sb, ev);
    if (nr !== null && nr > 0) text = await telegramNachsenden(sb, tgToken, ev, t0, nr);
  }

  // 2) Foto (Öl-Raum-Kamera) als eigene Nachricht — nie im Übergang.
  const foto = fotoAusBody(req.body);
  let fotoStatus: string | undefined;
  if (foto) {
    fotoStatus = z === 'geraet' || z === 'mitglied'
      ? await fotoNachschicken(sb, tgToken, ev, foto, t0)
      : 'nicht_erlaubt';
  }

  return res.status(200).json({ ok: true, via: 'telegram', ...text, ...(fotoStatus ? { foto: fotoStatus } : {}) });
}
