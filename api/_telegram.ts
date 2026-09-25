// Zentraler Helper für Telegram-Bot-API Calls mit Rate-Limit und 429-Retry.
//
// FIX 0107 (Audit Phase 8 HIGH): vorher hatten alle send-*.ts Endpoints
// `Promise.allSettled(chats.map((c) => fetch(...)))` ohne Throttle und ohne
// 429-Handling. Telegram-Limits: 30 messages/sec global, 20/min pro Chat.
// Bei 50+ Chats schlug die Birthday-Welle gegen das Flood-Limit, viele
// Messages wurden gedroppt ohne Log.
//
// Dieser Helper:
//  - sequenziert Sends mit min. 50ms-Pause (max 20/s, sicher unter Limit)
//  - parsed 429-Response, wartet retry_after Sekunden, retried 1×
//  - gibt strukturiertes Result-Array zurück
//
// Seit 25.09.2026 (Audit, Migration 0187) außerdem:
//  - vereinsChats(): die EINE Stelle, die den Vereins-Verteiler liest. Neue
//    Chats kommen erst nach Admin-Freigabe hinein (telegram_chat_anfragen);
//    Chats gesperrter Mitglieder werden beim Versand übersprungen.
//  - escHtml(): Text aus der Datenbank für parse_mode HTML entschärfen.
//
// Audit-Runde 3 (25.09.2026, Migration 0199):
//  - Jeder fetch hat eine Zeitgrenze (AbortSignal.timeout, je Versuch neu).
//    Vorher hing ein Aufruf ohne Antwort bis zum Abbruch der Function — beim
//    Evakuierungsalarm blieb der Versand dann für immer auf „sende“.
//  - 429-Wartezeit gedeckelt (Standard 10 s, einstellbar) und optional eine
//    Frist (fristBis), nach der kein neuer Versuch mehr beginnt.
//  - tgBroadcast kann parallel senden (Alarm: alle Chats gleichzeitig, in
//    Paketen von 20 je Sekunde — unter Telegrams 30/s).
//  - Tote Chats (Bot blockiert, Telegram-Konto gelöscht, Bot aus der Gruppe
//    entfernt, Chat nicht gefunden) werden erkannt und in
//    telegram_chat_deaktiviert pausiert — nicht gelöscht. vereinsChats()
//    überspringt sie, der Admin sieht sie (Admin → Handbuch → Telegram) und
//    kann sie wieder aktivieren; ein /start aus dem Chat hebt die Pause auf.
//
// Audit-Runde 4 (25.09.2026, Migration 0207):
//  - SendeOptionen.wiederholen (OPT-IN, nur der Evakuierungsalarm): zweiter
//    Versuch nach 1 s auch bei HTTP ≥ 500, Netzfehler und Zeitüberschreitung,
//    solange die Frist (fristBis) reicht. Alle anderen Rundrufe bleiben beim
//    zweiten Versuch nur nach 429 (sie laufen nacheinander ohne Frist — eine
//    Wiederholung würde dort die Wartezeit je Chat verdoppeln).
//  - vereinsChatsStreng(): wie vereinsChats(), meldet einen Lesefehler des
//    Verteilers aber als null statt als leere Liste. Nur der Alarm nutzt sie
//    (Status 'fehler' → Nachversand statt still 'keine_chats').

import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from './_auth.js';

type TgPayload = Record<string, unknown>;

/** Für parse_mode HTML: & < > " entschärfen (Titel, Namen … sind frei eingebbar). */
export function escHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Chat-IDs des Vereins-Verteilers (system_config.telegram_chats).
 * Übersprungen werden Chats, deren verknüpftes Konto gesperrt ist, und Chats,
 * die als nicht erreichbar pausiert sind (0199). Schlägt eine dieser Prüfungen
 * fehl, bleibt die Liste insoweit ungefiltert (ein Notfall-Alarm darf nicht an
 * einer Nebenabfrage scheitern).
 */
export async function vereinsChats(sb: SupabaseClient): Promise<number[]> {
  return (await vereinsChatsStreng(sb)) ?? [];
}

/**
 * Wie vereinsChats(), aber ein Lesefehler des Verteilers (system_config)
 * ergibt null statt [] — „nicht lesbar“ ist dann von „keine Chats“ zu
 * unterscheiden (0207, Evakuierungsalarm). Die Filter (gesperrt, pausiert)
 * bleiben nachsichtig wie in vereinsChats().
 */
export async function vereinsChatsStreng(sb: SupabaseClient): Promise<number[] | null> {
  const { data: cfg, error } = await sb.from('system_config').select('value').eq('key', 'telegram_chats').maybeSingle();
  if (error) return null;
  const roh = (cfg?.value as { chat_ids?: unknown } | null)?.chat_ids;
  const ids = Array.isArray(roh)
    ? Array.from(new Set(roh.map((c) => Number(c)).filter((c) => Number.isSafeInteger(c) && c !== 0)))
    : [];
  if (ids.length === 0) return [];
  const [gesperrt, pausiert] = await Promise.all([
    sb.from('members').select('telegram_user_id').in('telegram_user_id', ids).not('revoked_at', 'is', null),
    sb.from('telegram_chat_deaktiviert').select('chat_id').in('chat_id', ids),
  ]);
  const raus = new Set<number>();
  if (!gesperrt.error) {
    for (const m of gesperrt.data ?? []) raus.add(Number((m as { telegram_user_id: unknown }).telegram_user_id));
  }
  if (!pausiert.error) {
    for (const c of pausiert.data ?? []) raus.add(Number((c as { chat_id: unknown }).chat_id));
  }
  return ids.filter((c) => !raus.has(c));
}

/**
 * Warum ein Chat dauerhaft nicht erreichbar ist (0199). 'nicht_gefunden' und
 * 'nicht_gestartet' können auch ALLE Chats treffen (z. B. nach einem Wechsel
 * auf einen anderen Bot) — die werden nur pausiert, wenn im selben Rundruf
 * mindestens ein Chat die Nachricht angenommen hat (siehe toteChatsMerken).
 */
export type TotGrund = 'blockiert' | 'konto_geloescht' | 'entfernt' | 'nicht_gefunden' | 'nicht_gestartet';

/** Telegram-Fehlerbeschreibung → Grund, wenn der Chat dauerhaft tot ist; sonst undefined. */
export function totGrund(status: number, beschreibung: string | undefined): TotGrund | undefined {
  const d = (beschreibung ?? '').toLowerCase();
  if (status === 403) {
    if (d.includes('bot was blocked')) return 'blockiert';
    if (d.includes('user is deactivated')) return 'konto_geloescht';
    if (d.includes('bot was kicked') || d.includes('bot is not a member')) return 'entfernt';
    if (d.includes("can't initiate conversation")) return 'nicht_gestartet';
    if (d.includes('chat not found')) return 'nicht_gefunden';
  }
  if (status === 400 && d.includes('chat not found')) return 'nicht_gefunden';
  return undefined;
}

export type TgResult = {
  chat_id: number;
  ok: boolean;
  status: number;
  attempt: number;
  error?: string;
  /** Telegrams „description“ bei einem Fehler (ohne chat_id, ohne Text). */
  beschreibung?: string;
  /** Gesetzt, wenn der Chat dauerhaft nicht erreichbar ist (0199). */
  tot?: TotGrund;
};

/** Grenzen für einen Versand (0199). */
export type SendeOptionen = {
  /** Zeitgrenze je fetch-Versuch. Standard: sendMessage 8 s, sendPhoto 20 s. */
  timeoutMs?: number;
  /** Längste Wartezeit bei 429 vor dem zweiten Versuch. Standard 10 s; länger → kein zweiter Versuch. */
  max429WarteMs?: number;
  /** Date.now()-Zeitpunkt, nach dem kein Versuch mehr beginnt (Gesamtfrist). */
  fristBis?: number;
  /**
   * OPT-IN (0207, nur der Evakuierungsalarm): zweiter Versuch nach
   * WIEDERHOLEN_PAUSE_MS auch bei HTTP ≥ 500, Netzfehler und
   * Zeitüberschreitung — nur, wenn danach bis fristBis noch mindestens
   * MIN_WIEDERHOLEN_REST_MS bleiben. Bewusst in Kauf genommen: Nach einer
   * Zeitüberschreitung oder einem 5xx kann Telegram die Nachricht trotzdem
   * angenommen haben, dann kommt sie doppelt an. Beim Alarm ist ein Duplikat
   * besser als ein fehlender Alarm; für Massen-Rundrufe bleibt es aus.
   */
  wiederholen?: boolean;
};

export type BroadcastOptionen = SendeOptionen & {
  /** Alle Chats gleichzeitig (in Paketen von 20 je Sekunde) statt nacheinander. */
  parallel?: boolean;
  /**
   * Tote Chats nach dem Rundruf selbst pausieren (Standard: ja, über einen
   * eigenen Service-Client). false: der Aufrufer ruft toteChatsMerken selbst
   * auf — der Evakuierungsalarm tut das erst, nachdem sein Status steht.
   */
  toteMerken?: boolean;
};

const MIN_DELAY_MS = 50; // 20/s — safe unter Telegram-Global-Limit 30/s
const PAKET_GROESSE = 20;
const STANDARD_429_WARTE_MS = 10_000;
/** Unter dieser Restzeit beginnt kein Versuch mehr — er könnte nicht fertig werden. */
const MIN_RESTZEIT_MS = 1_000;
/** Pause vor dem zweiten Versuch nach 5xx/Netz-/Zeitfehler (nur mit wiederholen). */
const WIEDERHOLEN_PAUSE_MS = 1_000;
/** So viel Zeit muss nach der Pause bis fristBis bleiben, sonst kein zweiter Versuch. */
const MIN_WIEDERHOLEN_REST_MS = 3_000;

/** Zweiter Versuch nach einem vorübergehenden Fehler (5xx, Netz, Zeit)? Nur mit Opt-in. */
function nochmalVersuchen(opts: SendeOptionen, attempt: number): boolean {
  if (!opts.wiederholen || attempt !== 1) return false;
  return opts.fristBis === undefined
    || Date.now() + WIEDERHOLEN_PAUSE_MS + MIN_WIEDERHOLEN_REST_MS <= opts.fristBis;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fehlerantwort der Bot-API (nur die gelesenen Felder). */
type TgFehlerAntwort = { description?: unknown; parameters?: { retry_after?: unknown } };

/** Zeitgrenze für den nächsten Versuch — oder null, wenn die Frist schon (fast) um ist. */
function versuchsGrenze(standardMs: number, fristBis?: number): number | null {
  if (fristBis === undefined) return standardMs;
  const rest = fristBis - Date.now();
  if (rest < MIN_RESTZEIT_MS) return null;
  return Math.min(standardMs, rest);
}

/**
 * Sendet einen einzelnen Telegram-API-Call mit 1× Retry bei 429 — mit
 * opts.wiederholen (0207) auch bei 5xx, Netzfehler und Zeitüberschreitung.
 * Wirft nie.
 */
export async function tgSendOnce(
  token: string,
  method: 'sendMessage' | 'sendPhoto',
  payload: TgPayload | FormData,
  chat_id: number,
  opts: SendeOptionen = {},
): Promise<TgResult> {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const init: RequestInit = (payload instanceof FormData)
    ? { method: 'POST', body: payload }
    : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };
  const timeoutMs = opts.timeoutMs ?? (method === 'sendPhoto' ? 20_000 : 8_000);
  const max429 = opts.max429WarteMs ?? STANDARD_429_WARTE_MS;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const grenze = versuchsGrenze(timeoutMs, opts.fristBis);
    if (grenze === null) return { chat_id, ok: false, status: 0, attempt, error: 'frist_abgelaufen' };
    let r: Response;
    try {
      // Signal je Versuch neu — ein gemeinsames wäre nach einer 429-Pause schon abgelaufen.
      r = await fetch(url, { ...init, signal: AbortSignal.timeout(grenze) });
    } catch (e) {
      const name = (e as Error)?.name;
      const fehler = name === 'TimeoutError' || name === 'AbortError' ? 'zeitueberschreitung' : (e as Error)?.message;
      // Netzfehler/Zeitüberschreitung: nur mit Opt-in ein zweites Mal (0207).
      if (nochmalVersuchen(opts, attempt)) {
        await sleep(WIEDERHOLEN_PAUSE_MS);
        continue;
      }
      return { chat_id, ok: false, status: 0, attempt, error: fehler };
    }
    if (r.ok) {
      // Antwort nicht lesen (spart Zeit), Verbindung aber freigeben.
      await r.body?.cancel().catch(() => undefined);
      return { chat_id, ok: true, status: r.status, attempt };
    }
    let antwort: TgFehlerAntwort | null = null;
    try {
      antwort = await r.json() as TgFehlerAntwort;
    } catch { /* Antwort ohne JSON */ }
    const beschreibung = typeof antwort?.description === 'string' ? antwort.description.slice(0, 200) : undefined;

    // 429: retry_after respektieren und einmal neu versuchen — aber nur, wenn
    // die Wartezeit in die Grenzen passt (sonst würde die Function mitten im
    // Warten beendet).
    if (r.status === 429 && attempt === 1) {
      const retryAfterS = Number(antwort?.parameters?.retry_after) || 1;
      const waitMs = retryAfterS * 1000;
      const passtInFrist = opts.fristBis === undefined || Date.now() + waitMs + MIN_RESTZEIT_MS < opts.fristBis;
      if (waitMs <= max429 && passtInFrist) {
        await sleep(waitMs);
        continue;
      }
    }
    // Serverfehler bei Telegram (502/503 …): nur mit Opt-in ein zweites Mal (0207).
    // 4xx (außer 429) bleiben endgültig — ein toter Chat wird nicht wiederholt.
    if (r.status >= 500 && nochmalVersuchen(opts, attempt)) {
      await sleep(WIEDERHOLEN_PAUSE_MS);
      continue;
    }
    return { chat_id, ok: false, status: r.status, attempt, beschreibung, tot: totGrund(r.status, beschreibung) };
  }
  return { chat_id, ok: false, status: 429, attempt: 2 };
}

/**
 * Mehrere Chats benachrichtigen — nacheinander mit MIN_DELAY_MS Pause oder
 * (parallel) paketweise gleichzeitig. Nach Ablauf von opts.fristBis beginnt
 * kein neuer Versuch mehr; nicht bediente Chats kommen als Fehlschlag zurück.
 */
export async function tgBroadcast(
  token: string,
  method: 'sendMessage' | 'sendPhoto',
  chats: number[],
  buildPayload: (chat_id: number) => TgPayload | FormData,
  opts: BroadcastOptionen = {},
): Promise<TgResult[]> {
  const results: TgResult[] = [];
  if (opts.parallel) {
    for (let i = 0; i < chats.length; i += PAKET_GROESSE) {
      if (i > 0) await sleep(1_000);
      const paket = chats.slice(i, i + PAKET_GROESSE);
      results.push(...await Promise.all(paket.map((chat_id) => tgSendOnce(token, method, buildPayload(chat_id), chat_id, opts))));
    }
  } else {
    for (const chat_id of chats) {
      const r = await tgSendOnce(token, method, buildPayload(chat_id), chat_id, opts);
      results.push(r);
      if (results.length < chats.length) await sleep(MIN_DELAY_MS);
    }
  }
  if (opts.toteMerken !== false) await toteChatsMerken(null, results);
  return results;
}

/**
 * Tote Chats pausieren (0199, Tabelle telegram_chat_deaktiviert) — nicht aus
 * dem Verteiler löschen. 'nicht_gefunden'/'nicht_gestartet' nur, wenn im
 * selben Rundruf mindestens ein Chat angenommen hat (sonst ist eher der Bot
 * selbst das Problem, und der ganze Verteiler würde stillgelegt).
 * Wirft nie; ohne tote Chats keine Datenbankabfrage.
 */
export async function toteChatsMerken(sb: SupabaseClient | null, results: TgResult[]): Promise<number> {
  const einerAngekommen = results.some((r) => r.ok);
  const tote = results.filter((r) => r.tot
    && (einerAngekommen || (r.tot !== 'nicht_gefunden' && r.tot !== 'nicht_gestartet')));
  if (tote.length === 0) return 0;
  try {
    const client = sb ?? serviceClient();
    if (!client) return 0;
    const zeilen = Array.from(new Map(tote.map((r) => [r.chat_id, {
      chat_id: r.chat_id,
      grund: r.tot as string,
      fehler_code: r.status,
      beschreibung: r.beschreibung ?? null,
    }])).values());
    const { error } = await client
      .from('telegram_chat_deaktiviert')
      .upsert(zeilen, { onConflict: 'chat_id', ignoreDuplicates: true });
    if (error) {
      console.error('[telegram] Pausieren toter Chats fehlgeschlagen', error.code ?? '');
      return 0;
    }
    // Einmal als Hinweis, ohne chat_id (vorher je Rundruf ein Fehler-Eintrag).
    console.warn(`[telegram] ${zeilen.length} nicht erreichbare(r) Chat(s) pausiert: ${Array.from(new Set(zeilen.map((z) => z.grund))).join(', ')}`);
    return zeilen.length;
  } catch (e) {
    console.error('[telegram] Pausieren toter Chats fehlgeschlagen', (e as Error).message);
    return 0;
  }
}
