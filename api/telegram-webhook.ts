// Vercel Serverless Function — POST /api/telegram-webhook
// Empfängt Telegram-Updates und verarbeitet:
//   /start <token>     — Account-Verknüpfung mit Saunafreunde-Member
//   /start             — Vereins-Meldungen beantragen: neue Chats kommen erst nach
//                        Freigabe durch einen Admin in den Verteiler (0187,
//                        Admin → Handbuch → Telegram); bestehende Chats bleiben
//   /stop              — Chat-ID abmelden
//   /heute, /morgen    — Aufguss-Übersicht
//   /meine             — eigene geplante Aufgüsse
//   /link              — Anleitung zur Verknüpfung
//   /unlink            — Verknüpfung lösen
//   callback_query     — "Ich übernehme!"-Button bei Personal-Fallback-Slots

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getBrandSettings } from './_email_helpers.js';
import { authenticate } from './_auth.js';
import { cronHeaderOk, cronSecretFehlt, geheimnisGleich } from './_cron.js';
import { escHtml as h, vereinsChats } from './_telegram.js';
import { queryParam } from './_query.js';

const TG_API = (token: string) => `https://api.telegram.org/bot${token}`;

// Telegram erlaubt 4.096 Zeichen je Nachricht; darunter bleiben mit Luft.
const TG_MAX_ZEICHEN = 3800;
const FEHLER_TEXT = '❌ Da ist etwas schiefgelaufen. Bitte später noch einmal versuchen.';

/**
 * Nachricht senden. Liefert true nur, wenn Telegram sie angenommen hat —
 * vorher galt jede Antwort als Erfolg (auch 400 „can't parse entities“ oder
 * 403 „bot was blocked“), und Slots galten trotzdem als angekündigt.
 * Bei 429 (zu schnell) einmal kurz warten und erneut senden.
 * Alle Texte aus der Datenbank gehen durch h() (parse_mode HTML).
 */
async function tgSend(token: string, chatId: number, text: string, opts: { parse_mode?: string; reply_markup?: unknown } = {}): Promise<boolean> {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: opts.parse_mode ?? 'HTML', reply_markup: opts.reply_markup }),
  };
  for (let versuch = 1; versuch <= 2; versuch++) {
    let r: Response;
    try {
      r = await fetch(`${TG_API(token)}/sendMessage`, init);
    } catch (e) {
      console.error('[telegram-webhook] sendMessage Netzfehler:', (e as Error).message);
      return false;
    }
    if (r.ok) return true;
    const antwort = await r.text().catch(() => '');
    if (r.status === 429 && versuch === 1) {
      let warteS = 1;
      try { warteS = Number((JSON.parse(antwort) as { parameters?: { retry_after?: number } }).parameters?.retry_after) || 1; } catch { /* Standard */ }
      if (warteS <= 5) {
        await new Promise((res) => setTimeout(res, warteS * 1000));
        continue;
      }
    }
    // Ohne chat_id und ohne Nachrichtentext loggen.
    console.error(`[telegram-webhook] sendMessage ${r.status}: ${antwort.slice(0, 200)}`);
    return false;
  }
  return false;
}

async function tgAnswerCallback(token: string, callbackQueryId: string, text: string, alert = false) {
  await fetch(`${TG_API(token)}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: alert }),
  });
}

async function tgEditMessage(token: string, chatId: number, messageId: number, text: string, reply_markup?: unknown) {
  const r = await fetch(`${TG_API(token)}/editMessageText`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', reply_markup }),
  }).catch(() => null);
  if (r && !r.ok) console.error(`[telegram-webhook] editMessageText ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
}

function fmtClock(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
}

// ─── Zugang ──────────────────────────────────────────────────────────────
// Telegram-Updates: jedes Update muss TELEGRAM_WEBHOOK_SECRET im Header
// X-Telegram-Bot-Api-Secret-Token mitbringen (so schickt Telegram es, seit
// ?reregister=1 den Webhook mit secret_token registriert hat — 25.09.2026).
// Fehlt die Env, wird abgelehnt (fail closed). Neues Geheimnis: siehe
// docs/TECHNICAL_OVERVIEW.md §13.3 (setzen → deployen → sofort reregister).
// Die Prüfung sitzt bewusst NUR am Update-Pfad: Cron-Hooks, Diagnose und der
// Handbuch-Broadcast haben eigene Zugänge (vorher galt sie für alles, ein
// gesetztes Geheimnis hätte die Cron-Hooks ausgesperrt).
/** TELEGRAM_WEBHOOK_SECRET ohne Leerraum/BOM (eine PowerShell-Pipe setzt gern ein BOM davor). */
function webhookGeheimnis(): string {
  return (process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim();
}

/** Telegram erlaubt für secret_token nur A-Z a-z 0-9 _ - (1–256 Zeichen); wir verlangen mindestens 32. */
const WEBHOOK_GEHEIMNIS_FORMAT = /^[A-Za-z0-9_-]{32,256}$/;

function telegramUpdateErlaubt(req: VercelRequest): boolean {
  const geheim = webhookGeheimnis();
  // Seit 25.09.2026 ist das Geheimnis gesetzt und Pflicht (fail closed): fehlt
  // es in der Umgebung, wird jedes Update abgelehnt statt ungeprüft angenommen.
  if (!geheim) {
    console.error('[telegram-webhook] TELEGRAM_WEBHOOK_SECRET fehlt — Update abgelehnt');
    return false;
  }
  return geheimnisGleich(req.headers['x-telegram-bot-api-secret-token'], geheim);
}

// Diagnose + Neu-Registrierung: nur eingeloggte Admins (JWT) oder Server mit
// x-cron-secret (z. B. pg_net aus der Datenbank). Vorher offen für jeden.
async function adminOderCron(req: VercelRequest): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (cronHeaderOk(req)) return { ok: true };
  if (!req.headers.authorization) return { ok: false, status: 401, error: 'admin login required' };
  const auth = await authenticate(req);
  if (!auth.ok) return { ok: false, status: auth.status, error: auth.error };
  if (auth.member.role !== 'admin') return { ok: false, status: 403, error: 'admin only' };
  return { ok: true };
}

/** Webhook-URL ohne Query — eine alte Registrierung trug das Geheimnis als ?secret=. */
function ohneQuery(url: unknown): unknown {
  return typeof url === 'string' ? url.split('?')[0] : url;
}

/** getWebhookInfo-Antwort mit maskierter URL (auch Admins sehen das Geheimnis nie). */
function webhookInfoMaskiert(info: unknown): unknown {
  const i = info as { result?: { url?: unknown } } | null;
  if (!i || typeof i !== 'object' || !i.result || typeof i.result !== 'object') return info;
  return { ...i, result: { ...i.result, url: ohneQuery(i.result.url) } };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !supaUrl || !serviceKey) return res.status(200).json({ ok: false, missing_env: true });

  const sb = createClient(supaUrl, serviceKey);

  // GET ?diag=1 → Telegram-Webhook-Diagnose (Bot-Info + Webhook-Status + letzte Fehler)
  // Nur Admin (Authorization: Bearer <JWT>) oder x-cron-secret — ein bloßer
  // Browser-Link genügt nicht mehr. Liefert:
  //   - getMe: Bot-Username + ID (Token-Validität)
  //   - getWebhookInfo: registrierte URL (ohne Query) + pending_update_count +
  //     last_error_date + last_error_message + max_connections
  //   - geheimnis_aktiv: ob TELEGRAM_WEBHOOK_SECRET gesetzt ist (nie der Wert)
  // Wenn last_error_message gesetzt ist oder url leer → Webhook ist defekt.
  if (req.method === 'GET' && queryParam(req, 'diag') === '1') {
    const zugang = await adminOderCron(req);
    if (!zugang.ok) return res.status(zugang.status).json({ error: zugang.error });
    const [meRes, whRes] = await Promise.all([
      fetch(`${TG_API(token)}/getMe`).then((r) => r.json()).catch(() => ({ error: 'getMe fehlgeschlagen' })),
      fetch(`${TG_API(token)}/getWebhookInfo`).then((r) => r.json()).catch(() => ({ error: 'getWebhookInfo fehlgeschlagen' })),
    ]);
    return res.status(200).json({
      bot: meRes,
      webhook: webhookInfoMaskiert(whRes),
      geheimnis_aktiv: !!webhookGeheimnis(),
      geheimnis_format_ok: !webhookGeheimnis() || WEBHOOK_GEHEIMNIS_FORMAT.test(webhookGeheimnis()),
      expected_url: `${process.env.PUBLIC_APP_URL ?? 'https://saunascaner.vercel.app'}/api/telegram-webhook`,
      hint: 'Wenn webhook.result.url leer oder ungleich expected_url → ?reregister=1 aufrufen (ebenfalls nur als Admin oder mit x-cron-secret).',
    });
  }

  // GET ?reregister=1 → Webhook bei Telegram (neu) registrieren. Zugang wie diag.
  // Ist TELEGRAM_WEBHOOK_SECRET gesetzt, geht es als secret_token mit: Telegram
  // schickt es dann bei jedem Update im Header X-Telegram-Bot-Api-Secret-Token.
  // Die URL bleibt ohne Query — so taucht das Geheimnis weder in
  // getWebhookInfo noch in Zugriffs-Logs auf.
  if (req.method === 'GET' && queryParam(req, 'reregister') === '1') {
    const zugang = await adminOderCron(req);
    if (!zugang.ok) return res.status(zugang.status).json({ error: zugang.error });
    const baseUrl = process.env.PUBLIC_APP_URL ?? 'https://saunascaner.vercel.app';
    const webhookSecret = webhookGeheimnis();
    // Ungültiges Format → Telegram würde setWebhook ablehnen, die alte
    // Registrierung bliebe ohne Header aktiv und jedes Update bekäme 401.
    // Darum gar nicht erst registrieren (der Wert erscheint nie in der Antwort).
    if (webhookSecret && !WEBHOOK_GEHEIMNIS_FORMAT.test(webhookSecret)) {
      console.error('[telegram-webhook] reregister abgebrochen: TELEGRAM_WEBHOOK_SECRET braucht 32–256 Zeichen aus A-Z a-z 0-9 _ -');
      return res.status(500).json({ error: 'TELEGRAM_WEBHOOK_SECRET hat ein ungültiges Format (erlaubt: A-Z a-z 0-9 _ -, 32–256 Zeichen)', geheimnis_aktiv: true });
    }
    const url = `${baseUrl}/api/telegram-webhook`;
    const setRes = await fetch(`${TG_API(token)}/setWebhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: false,
        ...(webhookSecret ? { secret_token: webhookSecret } : {}),
      }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: 'setWebhook fehlgeschlagen' }));
    const whInfo = await fetch(`${TG_API(token)}/getWebhookInfo`).then((r) => r.json()).catch(() => ({}));
    const setOk = !!setRes && typeof setRes === 'object' && (setRes as { ok?: unknown }).ok === true;
    return res.status(setOk ? 200 : 502).json({
      set: setRes,
      webhook_now: webhookInfoMaskiert(whInfo),
      registered_url: url,
      geheimnis_aktiv: !!webhookSecret,
    });
  }

  // GET ?announce=1 → Cron-Hook (Personal-Fallback-Announce)
  // Beide Cron-Hooks verlangen x-cron-secret aus dem Vault (pg_cron, 0168/0169),
  // fail closed über api/_cron.ts.
  if (req.method === 'GET' && queryParam(req, 'announce') === '1') {
    if (!cronHeaderOk(req)) {
      if (cronSecretFehlt()) console.error('[telegram-webhook] announce abgelehnt: CRON_SECRET fehlt oder ist zu kurz');
      return res.status(401).json({ error: 'cron secret mismatch' });
    }
    const announced = await announceFallbacks(sb, token);
    return res.status(200).json({ ok: true, announced });
  }

  // GET ?rating_push=1 → Cron-Hook (Rating-Push 15 Min nach Aufguss-Ende)
  if (req.method === 'GET' && queryParam(req, 'rating_push') === '1') {
    if (!cronHeaderOk(req)) {
      if (cronSecretFehlt()) console.error('[telegram-webhook] rating_push abgelehnt: CRON_SECRET fehlt oder ist zu kurz');
      return res.status(401).json({ error: 'cron secret mismatch' });
    }
    const pushed = await sendRatingPushes(sb, token);
    return res.status(200).json({ ok: true, pushed });
  }

  // POST ?action=broadcast_handbook → Handbuch-Link an alle Chats
  if (req.method === 'POST' && queryParam(req, 'action') === 'broadcast_handbook') {
    // Nur Admins, über die zentrale Prüfung authenticate() (Audit-Runde 2,
    // 25.09.2026): vorher eigene Prüfung ohne Sperre/Freigabe — ein
    // gesperrter Admin konnte den Rundruf weiter beliebig oft auslösen.
    const auth = await authenticate(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (auth.member.role !== 'admin') return res.status(403).json({ error: 'admin only' });

    // Höchstens ein Handbuch-Rundruf je Tag (Europe/Berlin) — schützt die
    // Vereins-Chats vor Doppelklicks und Schleifen (Telegram-Flood-Grenze).
    const heute = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
    const einmal = `tg_handbuch:${heute}`;
    const { error: claimErr } = await sb.from('push_vorlagen_versand').insert({ schluessel: einmal, member_id: auth.member.id });
    if (claimErr) {
      if ((claimErr as { code?: string }).code === '23505') {
        return res.status(409).json({ error: 'Das Handbuch ging heute schon an alle Telegram-Chats. Morgen ist ein neuer Rundruf möglich.' });
      }
      console.error('[telegram-webhook] broadcast_handbook: Einmal-Schutz fehlgeschlagen', claimErr.code ?? '');
      return res.status(500).json({ error: 'Rundruf gerade nicht möglich. Bitte später noch einmal versuchen.' });
    }

    const brand = await getBrandSettings(sb);
    const origin = process.env.PUBLIC_APP_URL ?? 'https://saunascaner.vercel.app';
    const text =
      `📖 <b>Mitglieder-Handbuch</b>\n\n` +
      `Liebe Saunafreunde, hier findet ihr das komplette Handbuch zu unserer App — Aufgüsse planen, WM-Tipspiel, Kalender-Abo, alles drin:\n\n` +
      `🌲 ${origin}/hilfe\n\n` +
      `— ${h(brand.org.name)}`;

    const chatIds = await vereinsChats(sb);
    if (chatIds.length === 0) {
      // Nichts verschickt → der Tag bleibt frei.
      await sb.from('push_vorlagen_versand').delete().eq('schluessel', einmal);
      return res.status(200).json({ ok: true, sent: 0, note: 'no chats registered' });
    }

    // Nacheinander (Telegram-Grenze) und nur echte Zustellungen zählen.
    let sent = 0;
    for (const id of chatIds) {
      if (await tgSend(token, id, text)) sent++;
    }
    // Ging gar nichts raus, darf der Admin es heute noch einmal versuchen.
    if (sent === 0) await sb.from('push_vorlagen_versand').delete().eq('schluessel', einmal);
    return res.status(200).json({ ok: true, sent, failed: chatIds.length - sent });
  }

  if (req.method !== 'POST') return res.status(405).end();

  // Ab hier: Update von Telegram (siehe telegramUpdateErlaubt).
  if (!telegramUpdateErlaubt(req)) return res.status(401).end();

  const update = req.body as TelegramUpdate;

  try {
    if (update.callback_query) {
      await handleCallback(sb, token, update.callback_query);
    } else if (update.message) {
      await handleMessage(sb, token, update.message);
    }
  } catch (e) {
    console.error('telegram-webhook error', e);
  }
  return res.status(200).json({ ok: true });
}

// ─── Announce Personal-Fallbacks in Telegram-Channel ─────────────────────
async function announceFallbacks(sb: SupabaseClient, token: string): Promise<number> {
  // Welche Chats bekommen Announcements? Der freigegebene Vereins-Verteiler.
  const chatIds = await vereinsChats(sb);
  if (chatIds.length === 0) return 0;

  // Personal-Fallbacks in den nächsten 90 Minuten, die noch nicht angekündigt sind
  const { data: slots } = await sb.rpc('get_personal_fallbacks_to_announce', { p_minutes: 90 });
  const list = (slots ?? []) as Array<{
    infusion_id: string;
    sauna_name: string;
    sauna_accent: string;
    start_time: string;
    temperature_c: number;
  }>;
  if (list.length === 0) return 0;

  let announced = 0;
  for (const slot of list) {
    const startTime = fmtClock(slot.start_time);
    const text =
      `🔥 <b>Personal-Aufguss ohne Aufgießer</b>\n\n` +
      `<b>${startTime} Uhr</b> · ${h(slot.sauna_name)} ${h(slot.temperature_c)}°C\n\n` +
      `Niemand hat diesen Slot übernommen. Wer macht ihn?`;
    const reply_markup = {
      inline_keyboard: [[
        { text: '✋ Ich übernehme!', callback_data: `takeover:${slot.infusion_id}` },
      ]],
    };

    // Nur als angekündigt markieren, wenn mindestens ein Chat die Nachricht
    // angenommen hat — sonst versucht es der nächste 15-Minuten-Lauf erneut
    // (das 90-Minuten-Fenster begrenzt das auf wenige Versuche).
    let angekommen = false;
    for (const chatId of chatIds) {
      if (await tgSend(token, chatId, text, { reply_markup })) angekommen = true;
    }
    if (!angekommen) {
      console.error('[telegram-webhook] Personal-Slot-Ankündigung an keinen Chat zugestellt — nächster Lauf versucht es erneut');
      continue;
    }
    await sb.rpc('mark_telegram_announced', { p_infusion_id: slot.infusion_id });
    announced++;
  }
  return announced;
}

// ─── Verteiler: Anmeldung mit Admin-Freigabe (0187) ──────────────────────
// Ergebnis von telegram_chat_anmelden: 'aktiv' | 'neu' | 'wartet' |
// 'abgelehnt' | 'voll'. Bei einem Fehler 'fehler'. Eine Ablehnung wird dem
// Chat nicht verraten (gleicher Text wie „wartet“).
async function chatAnmelden(sb: SupabaseClient, msg: TelegramMessage): Promise<string> {
  const { data, error } = await sb.rpc('telegram_chat_anmelden', {
    p_chat_id: msg.chat?.id,
    p_telegram_user_id: msg.from?.id ?? null,
    // Gruppe: deren Titel; privat: Vorname des Absenders (beides nur zur Anzeige für die Admins).
    p_vorname: (msg.chat?.type && msg.chat.type !== 'private' ? msg.chat.title : undefined) ?? msg.from?.first_name ?? null,
    p_benutzername: msg.from?.username ?? null,
    p_chat_typ: msg.chat?.type ?? null,
  });
  if (error) {
    console.error('[telegram-webhook] telegram_chat_anmelden:', error.message);
    return 'fehler';
  }
  return typeof data === 'string' ? data : 'fehler';
}

function verteilerHinweis(status: string): string {
  if (status === 'aktiv') return 'Du bekommst die Vereins-Meldungen (Personal-Aufgüsse, Notfall-Alarm, Ankündigungen).';
  if (status === 'fehler') return 'Die Anmeldung für die Vereins-Meldungen hat gerade nicht geklappt — bitte später noch einmal /start senden.';
  return 'Deine Anmeldung für die Vereins-Meldungen ist eingegangen. Ein Admin schaltet dich frei — bis dahin bekommst du hier noch keine Rundnachrichten.';
}

// ─── Message Handler ─────────────────────────────────────────────────────
async function handleMessage(sb: SupabaseClient, token: string, msg: TelegramMessage) {
  const chatId = msg.chat?.id;
  const fromId = msg.from?.id;
  const text = (msg.text ?? '').trim();
  if (!chatId || !fromId) return;

  // /start <link_token> — Account-Verknüpfung
  const startMatch = text.match(/^\/start(?:@\w+)?\s+([0-9a-f-]{36})$/i);
  if (startMatch) {
    const linkToken = startMatch[1];
    // supabase-js wirft nicht — der Fehler steht in `error`.
    const { data, error } = await sb.rpc('claim_telegram_link', { p_token: linkToken, p_telegram_user_id: fromId });
    const member = Array.isArray(data) ? data[0] : data;
    if (error || !member) {
      if (!error || (error.message ?? '').includes('invalid_or_expired_token')) {
        await tgSend(token, chatId, '❌ Token ungültig oder schon eingelöst. Generiere einen neuen in der App: <i>Profil → Telegram verknüpfen</i>.');
      } else {
        console.error('[telegram-webhook] claim_telegram_link:', error.message);
        await tgSend(token, chatId, FEHLER_TEXT);
      }
      return;
    }
    // Vereins-Meldungen: neue Chats erst nach Admin-Freigabe (0187).
    const status = await chatAnmelden(sb, msg);
    await tgSend(token, chatId,
      `✅ <b>Konto verknüpft!</b>\n\nHallo ${h(member.name)}, dein Telegram ist jetzt mit Saunascaner verknüpft.\n\n` +
      `${verteilerHinweis(status)}\n\n` +
      `Verfügbare Befehle:\n` +
      `/heute — Aufgüsse heute\n/morgen — Aufgüsse morgen\n/meine — Meine Aufgüsse\n/unlink — Verknüpfung lösen`);
    return;
  }

  // Plain /start — Vereins-Meldungen beantragen + Verknüpfen-Button wenn unverknüpft
  if (text === '/start' || text.startsWith('/start@')) {
    const status = await chatAnmelden(sb, msg);
    const brand = await getBrandSettings(sb);
    const { data: linkedMember } = await sb.from('members').select('id, name').eq('telegram_user_id', fromId).is('revoked_at', null).maybeSingle();
    if (linkedMember) {
      await tgSend(token, chatId,
        `🌲 <b>Hallo ${h(linkedMember.name)}!</b>\n\nDein Konto ist verknüpft. ${verteilerHinweis(status)}\n\nSchreibe /help um alle Befehle zu sehen.`);
    } else {
      await tgSend(token, chatId,
        `🌲 <b>Willkommen bei ${h(brand.org.name)}!</b>\n\n` +
        `${verteilerHinweis(status)}\n\n` +
        `Damit du Personal-Aufgüsse übernehmen und Aufgüsse direkt im Chat bewerten kannst, verknüpfe dein Konto:`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '🔗 Konto verknüpfen', url: 'https://saunascaner.vercel.app/planner#telegram' },
            ]],
          },
        });
    }
    return;
  }

  // /stop — Broadcast abmelden
  if (text === '/stop') {
    await sb.rpc('unregister_telegram_chat', { p_chat_id: chatId });
    await tgSend(token, chatId, '🛑 Abgemeldet — du erhältst keine Benachrichtigungen mehr.');
    return;
  }

  // /unlink — Telegram-Account-Verknüpfung lösen. Im privaten Chat endet
  // damit auch der Empfang der Vereins-Meldungen (vorher blieb der Chat im
  // Verteiler, auch nach einer Sperre); neu beantragen geht mit /start.
  // Audit-Runde 2: Auch in einer Gruppe nimmt das Lösen den PRIVATEN Chat aus
  // dem Verteiler (Trigger trg_telegram_chat_entknuepft, 0187 — gewollt, auch
  // für App und Löschen). Die Antwort sagt das jetzt überall, und „gelöst“
  // nur, wenn wirklich ein Konto verknüpft war. /unlink@Bot (Befehlsmenü in
  // Gruppen) zählt wie /unlink.
  if (text === '/unlink' || /^\/unlink@\w+$/i.test(text)) {
    const { data: geloest, error: unlinkErr } = await sb
      .from('members')
      .update({ telegram_user_id: null, telegram_link_token: null })
      .eq('telegram_user_id', fromId)
      .select('id');
    if (unlinkErr) {
      console.error('[telegram-webhook] /unlink:', unlinkErr.message);
      await tgSend(token, chatId, FEHLER_TEXT);
      return;
    }
    const warVerknuepft = (geloest ?? []).length > 0;
    const privat = msg.chat?.type === 'private' && chatId === fromId;
    if (!warVerknuepft) {
      await tgSend(token, chatId, privat
        ? 'ℹ️ Kein verknüpftes Konto gefunden. Vereins-Meldungen abbestellen: /stop'
        : 'ℹ️ Kein verknüpftes Konto gefunden.');
      return;
    }
    if (privat) {
      await sb.rpc('unregister_telegram_chat', { p_chat_id: chatId });
      await tgSend(token, chatId, '🔓 Konto-Verknüpfung gelöst. Vereins-Meldungen bekommst du hier nicht mehr — mit /start kannst du sie neu beantragen.');
    } else {
      await tgSend(token, chatId,
        '🔓 Konto-Verknüpfung gelöst. Vereins-Meldungen in deinem privaten Chat mit dem Bot sind damit ebenfalls beendet — mit /start dort kannst du sie neu beantragen.');
    }
    return;
  }

  // /link — Anleitung
  if (text === '/link') {
    await tgSend(token, chatId,
      `🔗 <b>Konto verknüpfen</b>\n\n` +
      `1. App öffnen: https://saunascaner.vercel.app\n` +
      `2. Profil → 🔗 <i>Telegram verknüpfen</i>\n` +
      `3. Auf den dort generierten Link klicken — fertig.`);
    return;
  }

  // /heute, /morgen — öffentliche Aufguss-Listen (mit freien Slots)
  if (text === '/heute' || text === '/morgen') {
    const day = text === '/heute' ? 'today' : 'tomorrow';
    await sendDayList(sb, token, chatId, day, fromId);
    return;
  }

  // /meine — eigene geplante Aufgüsse (braucht Verknüpfung)
  if (text === '/meine') {
    const { data: m } = await sb.from('members').select('id, name').eq('telegram_user_id', fromId).maybeSingle();
    if (!m) {
      await tgSend(token, chatId, '⚠️ Konto nicht verknüpft. Sende /link für die Anleitung.');
      return;
    }
    await sendMyInfusions(sb, token, chatId, m.id, m.name);
    return;
  }

  // /woche — Übersicht der nächsten 7 Tage
  if (text === '/woche') {
    await sendWeekList(sb, token, chatId);
    return;
  }

  // /pin — eigenen Tablet-PIN anzeigen (braucht Verknüpfung). Nur im privaten
  // Chat: in einer Gruppe läse sonst jeder den PIN mit.
  if (text === '/pin' || text.startsWith('/pin@')) {
    if (msg.chat?.type !== 'private') {
      await tgSend(token, chatId, '🔒 Deinen PIN gibt es nur im privaten Chat mit dem Bot.');
      return;
    }
    const { data: rows } = await sb.rpc('get_my_checkin_pin_by_telegram', { p_telegram_user_id: fromId });
    const pinRow = Array.isArray(rows) ? rows[0] : rows;
    if (!pinRow?.pin) {
      await tgSend(token, chatId, '⚠️ Konto nicht verknüpft oder kein PIN gesetzt. Sende /link für die Anleitung.');
      return;
    }
    await tgSend(token, chatId,
      `🔢 <b>Dein Sauna-Tablet-PIN</b>\n\n<code>${h(pinRow.pin)}</code>\n\n` +
      `Damit checkst du am Sauna-Tablet ein. Niemandem zeigen!`);
    return;
  }

  // /feed — Link zum Mini-Insta-Feed
  if (text === '/feed') {
    await tgSend(token, chatId,
      `📸 <b>Sauna-Feed</b>\n\nFotos, Reactions, Aroma-Tags zum Aufguss.`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '📸 Feed öffnen', url: 'https://saunascaner.vercel.app/feed' },
          ]],
        },
      });
    return;
  }

  // /help — Alle Befehle
  if (text === '/help' || text === '/hilfe' || text === '/?') {
    await tgSend(token, chatId, helpText());
    return;
  }

  // Default: Hilfe-Hinweis
  if (text.startsWith('/')) {
    await tgSend(token, chatId, helpText());
  }
}

function helpText(): string {
  return (
    `<b>📚 Saunascaner-Bot — Befehle</b>\n\n` +
    `<b>📋 Aufgüsse</b>\n` +
    `/heute — heutige Aufgüsse\n` +
    `/morgen — morgige Aufgüsse\n` +
    `/woche — die nächsten 7 Tage\n` +
    `/meine — meine geplanten Aufgüsse\n\n` +
    `<b>🔢 Mein Konto</b>\n` +
    `/pin — mein Sauna-Tablet-PIN\n` +
    `/link — Konto verknüpfen\n` +
    `/unlink — Verknüpfung lösen\n\n` +
    `<b>🌐 App-Links</b>\n` +
    `/feed — Mini-Insta-Feed öffnen\n\n` +
    `<b>🔔 Vereins-Meldungen</b>\n` +
    `/start — beantragen (ein Admin schaltet frei)\n` +
    `/stop — abmelden\n\n` +
    `<i>Bei „✋ Ich übernehme"- und ⭐-Buttons in Nachrichten: einfach tippen — funktioniert nur mit verknüpftem Konto.</i>`
  );
}

// ─── Callback Handler (Inline-Buttons) ───────────────────────────────────
async function handleCallback(sb: SupabaseClient, token: string, cb: TelegramCallbackQuery) {
  const data = cb.data ?? '';
  const fromId = cb.from?.id;
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  if (!fromId || !chatId || !messageId) return;

  // takeover:<infusion_id>
  const takeoverMatch = data.match(/^takeover:([0-9a-f-]{36})$/i);
  if (takeoverMatch) {
    const infusionId = takeoverMatch[1];
    try {
      const { data: result, error } = await sb.rpc('takeover_personal_fallback_by_telegram', {
        p_telegram_user_id: fromId,
        p_infusion_id: infusionId,
      });
      if (error) throw error;
      const row = Array.isArray(result) ? result[0] : result;
      if (row) {
        await tgAnswerCallback(token, cb.id, `✓ Übernommen! Du machst jetzt den Aufguss um ${cb.message?.text?.match(/\d{2}:\d{2}/)?.[0] ?? ''} Uhr.`, true);
        // Original-Nachricht updaten — Button entfernen, Status anzeigen.
        // cb.message.text ist Klartext: vor dem erneuten Senden als HTML escapen.
        const oldText = cb.message?.text ?? '';
        await tgEditMessage(token, chatId, messageId,
          `${h(oldText)}\n\n✅ <b>Übernommen von ${h(row.member_name)}</b>`,
          undefined);
        return;
      }
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('telegram_not_linked')) {
        await tgAnswerCallback(token, cb.id,
          '⚠️ Dein Telegram ist nicht verknüpft.\n\n' +
          'So gehts:\n' +
          '1. Öffne saunascaner.vercel.app/planner\n' +
          '2. Scroll zum Block „✈️ Telegram-Bot"\n' +
          '3. Klick „Verknüpfen" → Telegram öffnet sich → folge dem Link\n\n' +
          'Danach funktioniert der „Ich übernehme"-Button.',
          true);
      } else if (msg.includes('already_taken')) {
        await tgAnswerCallback(token, cb.id, 'Der Slot wurde schon übernommen.', true);
        // Aktualisierte Anzeige nachholen
        const oldText = cb.message?.text ?? '';
        await tgEditMessage(token, chatId, messageId, `${h(oldText)}\n\n✅ Bereits übernommen.`, undefined);
      } else if (msg.includes('not_authorized')) {
        await tgAnswerCallback(token, cb.id, '⚠️ Nur Aufgießer/Personal können Slots übernehmen.', true);
      } else if (msg.includes('slot_in_past')) {
        await tgAnswerCallback(token, cb.id, 'Dieser Slot ist schon vorbei.', true);
      } else {
        console.error('[telegram-webhook] Knopf fehlgeschlagen:', msg);
        await tgAnswerCallback(token, cb.id, FEHLER_TEXT, true);
      }
      return;
    }
  }

  // attend:<infusion_id> — "Ich komme"-Button aus /heute /morgen
  const attendMatch = data.match(/^attend:([0-9a-f-]{36})$/i);
  if (attendMatch) {
    const infusionId = attendMatch[1];
    try {
      const { data: result, error } = await sb.rpc('telegram_announce_attendance', {
        p_telegram_user_id: fromId,
        p_infusion_id: infusionId,
      });
      if (error) throw error;
      const row = Array.isArray(result) ? result[0] : result;
      if (row) {
        await tgAnswerCallback(token, cb.id, `🙋 Eingetragen — bis bald bei „${row.infusion_title}"!`, false);
      }
      return;
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('telegram_not_linked')) {
        await tgAnswerCallback(token, cb.id,
          '⚠️ Verknüpfe erst dein Konto: saunascaner.vercel.app/planner#telegram', true);
      } else if (msg.includes('infusion_already_started')) {
        await tgAnswerCallback(token, cb.id, 'Aufguss hat schon begonnen.', true);
      } else if (msg.includes('infusion_not_found')) {
        await tgAnswerCallback(token, cb.id, 'Diesen Aufguss gibt es nicht mehr.', true);
      } else {
        console.error('[telegram-webhook] Knopf fehlgeschlagen:', msg);
        await tgAnswerCallback(token, cb.id, FEHLER_TEXT, true);
      }
      return;
    }
  }

  // rate:<infusion_id>:<stars> — 1-5-Stern Quick-Rating aus Push
  const rateMatch = data.match(/^rate:([0-9a-f-]{36}):([1-5])$/i);
  if (rateMatch) {
    const infusionId = rateMatch[1];
    const stars = parseInt(rateMatch[2], 10);
    try {
      const { data: result, error } = await sb.rpc('telegram_quick_rate', {
        p_telegram_user_id: fromId,
        p_infusion_id: infusionId,
        p_stars: stars,
      });
      if (error) throw error;
      const row = Array.isArray(result) ? result[0] : result;
      const title = row?.infusion_title ?? 'Aufguss';
      await tgAnswerCallback(token, cb.id, `⭐ ${stars}/5 für „${title}" gespeichert. Danke!`, false);
      const oldText = cb.message?.text ?? '';
      await tgEditMessage(token, chatId, messageId,
        `${h(oldText)}\n\n✅ <b>Deine Bewertung: ${'⭐'.repeat(stars)}${'☆'.repeat(5-stars)}</b>`,
        { inline_keyboard: [[
          { text: '✏️ Detailliert in App', url: `https://saunascaner.vercel.app/planner` },
        ]]});
      return;
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('telegram_not_linked')) {
        await tgAnswerCallback(token, cb.id, '⚠️ Konto nicht verknüpft.', true);
      } else if (msg.includes('self_rating_not_allowed')) {
        await tgAnswerCallback(token, cb.id, 'Bei diesem Aufguss hast du selbst mitgewedelt – den kannst du nicht bewerten.', true);
      } else if (msg.includes('rating_window_expired')) {
        // Aufgießer: 3 Std. nach Ende; alle anderen: bis 12 Uhr am Folgetag (wie in der App)
        await tgAnswerCallback(token, cb.id, 'Das Bewertungsfenster ist schon geschlossen.', true);
      } else if (msg.includes('infusion_not_finished')) {
        await tgAnswerCallback(token, cb.id, 'Aufguss läuft noch.', true);
      } else if (msg.includes('not_attended_that_day')) {
        await tgAnswerCallback(token, cb.id, 'Du warst an diesem Tag nicht eingecheckt – Bewertung nicht möglich.', true);
      } else if (msg.includes('stunde_schon_bewertet')) {
        await tgAnswerCallback(token, cb.id, 'Für diese Stunde hast du schon einen Aufguss bewertet.', true);
      } else if (msg.includes('infusion_not_found')) {
        await tgAnswerCallback(token, cb.id, 'Diesen Aufguss gibt es nicht mehr.', true);
      } else {
        console.error('[telegram-webhook] Knopf fehlgeschlagen:', msg);
        await tgAnswerCallback(token, cb.id, FEHLER_TEXT, true);
      }
      return;
    }
  }

  // Default
  await tgAnswerCallback(token, cb.id, '');
}

// ─── Helpers: Day-List + My-List ─────────────────────────────────────────
function slotHoursForWeekday(weekday: number): number[] {
  // Mo: nichts. Di/Mi/Do: 14-20 (7 Slots). Fr/Sa/So: 11-20 (10 Slots).
  if (weekday === 1) return [];
  if (weekday === 2 || weekday === 3 || weekday === 4) return [14, 15, 16, 17, 18, 19, 20];
  return [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
}

// ─── Berlin-Zeit-Helper ──────────────────────────────────────────────────
// Der Server läuft auf Vercel in UTC. Aufguss-Zeiten/Slots gelten aber in
// Europe/Berlin. Bare new Date(iso).getHours()/.getDay() liefert hier die
// UTC-Werte → z.B. ein 14:00-Berlin-Aufguss (12:00Z im Sommer) wurde mit
// Slot-Stunde 14 nie gematcht und erschien fälschlich als „frei".
function berlinYmdOffsetDays(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(d); // YYYY-MM-DD
}
function berlinUtcOffset(ymd: string): string {
  // '+01:00' oder '+02:00' für das gegebene Berliner Datum (DST-bewusst).
  const probe = new Date(`${ymd}T12:00:00Z`);
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', timeZoneName: 'longOffset' })
    .formatToParts(probe).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+01:00';
  const m = name.match(/([+-]\d{2}:\d{2})/);
  return m ? m[1] : '+01:00';
}
function berlinInstant(ymd: string, hour = 0): Date {
  return new Date(`${ymd}T${String(hour).padStart(2, '0')}:00:00${berlinUtcOffset(ymd)}`);
}
function berlinHourOf(d: Date): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hour12: false })
    .formatToParts(d).find((p) => p.type === 'hour')?.value ?? '0';
  return Number(h) % 24;
}
function berlinWeekdayOf(d: Date): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', weekday: 'short' }).format(d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

async function sendDayList(sb: SupabaseClient, token: string, chatId: number, day: 'today' | 'tomorrow', fromTelegramId?: number) {
  const offset = day === 'tomorrow' ? 1 : 0;
  const targetYmd = berlinYmdOffsetDays(offset);
  const start = berlinInstant(targetYmd, 0);
  const end = berlinInstant(berlinYmdOffsetDays(offset + 1), 0);

  // Aktiver User (verknüpft?) für „eigener Aufguss"-Markierung
  let myMemberId: string | null = null;
  if (fromTelegramId) {
    const { data: me } = await sb.from('members').select('id').eq('telegram_user_id', fromTelegramId).maybeSingle();
    myMemberId = me?.id ?? null;
  }

  // 1) Alle Infusions des Tages
  const { data: infs, error } = await sb
    .from('infusions')
    .select('id, title, start_time, end_time, sauna_id, saunameister_id, is_personal_fallback, team_infusion, saunas(name, temperature_label)')
    .gte('start_time', start.toISOString())
    .lt('start_time', end.toISOString())
    .order('start_time');
  if (error) { console.error('[telegram-webhook] Tagesliste:', error.message); await tgSend(token, chatId, FEHLER_TEXT); return; }

  // 2) Aktive Saunen + erlaubte Stunden für den Tag → freie Slots ermitteln
  const { data: saunas } = await sb.from('saunas').select('id, name, temperature_label').eq('is_active', true);
  const weekday = berlinWeekdayOf(start);
  const hours = slotHoursForWeekday(weekday);

  // Header
  const dayLabel = day === 'today' ? '<b>📋 Heute</b>' : '<b>📋 Morgen</b>';
  if (weekday === 1) {
    await tgSend(token, chatId, `${dayLabel}\n\nMontag — Ruhetag, keine Aufgüsse.`);
    return;
  }

  // Meister-Namen
  const meisterIds = Array.from(new Set((infs ?? []).map((i) => i.saunameister_id).filter(Boolean) as string[]));
  const { data: members } = meisterIds.length
    ? await sb.from('members').select('id, name').in('id', meisterIds)
    : { data: [] };
  const meisterName = (id: string | null) => (id && members?.find((m) => m.id === id)?.name) || 'Personal';

  // Map: (sauna_id|hour) → infusion
  type Inf = NonNullable<typeof infs>[number];
  const infByKey = new Map<string, Inf>();
  for (const i of (infs ?? [])) {
    const h = berlinHourOf(new Date(i.start_time));
    infByKey.set(`${i.sauna_id}|${h}`, i);
  }

  await tgSend(token, chatId, dayLabel);

  let freeCount = 0;
  const planUrl = 'https://saunascaner.vercel.app/planner';

  // Pro Slot (Sauna × Stunde) eine Nachricht
  for (const stunde of hours) {
    for (const sa of (saunas ?? [])) {
      const i = infByKey.get(`${sa.id}|${stunde}`);
      const hh = String(stunde).padStart(2, '0');
      const isFuture = berlinInstant(targetYmd, stunde).getTime() > Date.now();

      if (!i) {
        // FREIER Slot
        if (!isFuture) continue; // vergangene leere Slots überspringen
        freeCount++;
        const text = `🟢 <b>${hh}:00</b> · ${h(sa.name)} ${h(sa.temperature_label)}\n<i>— frei —</i>`;
        await tgSend(token, chatId, text, {
          reply_markup: {
            inline_keyboard: [[{ text: '📲 In App belegen', url: planUrl }]],
          },
        });
        continue;
      }

      const isMine = myMemberId && i.saunameister_id === myMemberId;
      const name = i.is_personal_fallback ? '👨‍🍳 Personal' : (isMine ? `<i>du selbst</i>` : h(meisterName(i.saunameister_id)));
      const team = i.team_infusion ? ' 👥' : '';
      const mineMark = isMine ? ' ✓' : '';
      const text = `🔥 <b>${hh}:00</b> · ${h(sa.name)} ${h(sa.temperature_label)}\n${h(i.title)}${team}${mineMark} — ${name}`;

      const buttons: Array<{ text: string; callback_data: string }> = [];
      if (isFuture && !isMine && !i.is_personal_fallback) {
        buttons.push({ text: '🙋 Ich komme', callback_data: `attend:${i.id}` });
      }
      if (isFuture && i.is_personal_fallback) {
        buttons.push({ text: '✋ Ich übernehme', callback_data: `takeover:${i.id}` });
      }

      await tgSend(token, chatId, text, buttons.length ? {
        reply_markup: { inline_keyboard: [buttons] },
      } : {});
    }
  }

  if (freeCount > 0) {
    await tgSend(token, chatId,
      `💡 <b>${freeCount} freie Slot${freeCount === 1 ? '' : 's'}</b> — neu anlegen geht nur in der App (Titel, Aromen, Eigenschaften).`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '📲 Slot belegen in der App', url: planUrl }]],
        },
      });
  }
}

async function sendWeekList(sb: SupabaseClient, token: string, chatId: number) {
  const start = berlinInstant(berlinYmdOffsetDays(0), 0);
  const end = berlinInstant(berlinYmdOffsetDays(7), 0);

  const { data, error } = await sb
    .from('infusions')
    .select('id, title, start_time, end_time, sauna_id, saunameister_id, is_personal_fallback, team_infusion, saunas(name, temperature_label)')
    .gte('start_time', start.toISOString())
    .lt('start_time', end.toISOString())
    .order('start_time');

  if (error) { console.error('[telegram-webhook] Wochenliste:', error.message); await tgSend(token, chatId, FEHLER_TEXT); return; }
  if (!data || data.length === 0) { await tgSend(token, chatId, 'Diese Woche keine Aufgüsse.'); return; }

  const meisterIds = Array.from(new Set(data.map((i) => i.saunameister_id).filter(Boolean) as string[]));
  const { data: members } = meisterIds.length
    ? await sb.from('members').select('id, name').in('id', meisterIds)
    : { data: [] };
  const meisterName = (id: string | null) => (id && members?.find((m) => m.id === id)?.name) || 'Personal';

  // Gruppiert nach Datum
  const byDay = new Map<string, typeof data>();
  for (const i of data) {
    const key = fmtDayKey(i.start_time);
    if (!byDay.has(key)) byDay.set(key, [] as typeof data);
    byDay.get(key)!.push(i);
  }

  const parts: string[] = ['<b>📋 Diese Woche</b>'];
  for (const [day, list] of byDay) {
    parts.push(`\n<b>${day}</b>`);
    for (const i of list) {
      const s = (i.saunas as unknown as { name: string; temperature_label: string }) ?? { name: '?', temperature_label: '?' };
      const name = i.is_personal_fallback ? '👨‍🍳 Personal' : h(meisterName(i.saunameister_id));
      const team = i.team_infusion ? ' 👥' : '';
      parts.push(`${fmtClock(i.start_time)} · ${h(s.name)} ${h(s.temperature_label)} · ${h(i.title)}${team} — ${name}`);
    }
  }
  // Eine volle Woche ist länger als die 4.096 Zeichen, die Telegram je
  // Nachricht annimmt (bisher kam dann still gar nichts an) → an
  // Zeilengrenzen aufteilen. Tags stehen nur in ganzen Zeilen, es wird also
  // kein <b> zerschnitten.
  const teile: string[] = [];
  let aktuell = '';
  for (const p of parts) {
    if (aktuell && aktuell.length + p.length + 1 > TG_MAX_ZEICHEN) {
      teile.push(aktuell);
      aktuell = p.replace(/^\n/, '');
    } else {
      aktuell = aktuell ? `${aktuell}\n${p}` : p;
    }
  }
  if (aktuell) teile.push(aktuell);
  for (const t of teile) await tgSend(token, chatId, t);
}

function fmtDayKey(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });
}

// ─── Cron: Rating-Pushes 15 Min nach Aufguss-Ende ────────────────────────
async function sendRatingPushes(sb: SupabaseClient, token: string): Promise<number> {
  const { data: pending } = await sb.rpc('get_pending_telegram_rating_pushes');
  const list = (pending ?? []) as Array<{
    member_id: string;
    telegram_user_id: number;
    member_name: string;
    infusion_id: string;
    infusion_title: string;
    meister_name: string;
    end_time: string;
  }>;
  if (list.length === 0) return 0;

  let sent = 0;
  for (const r of list) {
    const text =
      `⭐ <b>Bewertung — wie war's?</b>\n\n` +
      `<b>${h(r.infusion_title)}</b>\n` +
      `${h(r.meister_name)} · ${fmtClock(r.end_time)}\n\n` +
      `Schnell-Bewertung — alle 6 Kategorien auf einen Stern-Wert. Detaillierter geht's in der App.`;
    const reply_markup = {
      inline_keyboard: [
        [
          { text: '1⭐', callback_data: `rate:${r.infusion_id}:1` },
          { text: '2⭐', callback_data: `rate:${r.infusion_id}:2` },
          { text: '3⭐', callback_data: `rate:${r.infusion_id}:3` },
          { text: '4⭐', callback_data: `rate:${r.infusion_id}:4` },
          { text: '5⭐', callback_data: `rate:${r.infusion_id}:5` },
        ],
        [
          { text: '✏️ Detailliert in App', url: 'https://saunascaner.vercel.app/planner' },
        ],
      ],
    };
    // Nur bei echter Zustellung als gesendet vermerken — sonst versucht es
    // der nächste 5-Minuten-Lauf im Bewertungsfenster erneut.
    if (await tgSend(token, r.telegram_user_id, text, { reply_markup })) {
      await sb.rpc('mark_telegram_rating_pushed', { p_member_id: r.member_id, p_infusion_id: r.infusion_id });
      sent++;
    }
  }
  return sent;
}

async function sendMyInfusions(sb: SupabaseClient, token: string, chatId: number, memberId: string, memberName: string) {
  const { data, error } = await sb
    .from('infusions')
    .select('id, title, start_time, sauna_id, team_infusion, saunas(name, temperature_label)')
    .eq('saunameister_id', memberId)
    .gte('end_time', new Date().toISOString())
    .order('start_time')
    .limit(15);

  if (error) { console.error('[telegram-webhook] /meine:', error.message); await tgSend(token, chatId, FEHLER_TEXT); return; }
  if (!data || data.length === 0) {
    await tgSend(token, chatId, `Hi ${h(memberName)}, du hast keine geplanten Aufgüsse.`);
    return;
  }

  const lines = data.map((i) => {
    const s = (i.saunas as unknown as { name: string; temperature_label: string }) ?? { name: '?', temperature_label: '?' };
    return `🔥 <b>${fmtTime(i.start_time)}</b>\n   ${h(i.title)} — ${h(s.name)} ${h(s.temperature_label)}${i.team_infusion ? ' 👥' : ''}`;
  });
  await tgSend(token, chatId, `<b>🧖 Deine kommenden Aufgüsse</b>\n\n${lines.join('\n\n')}`);
}

// ─── Telegram Types ──────────────────────────────────────────────────────
type TelegramUpdate = {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};
type TelegramMessage = {
  message_id: number;
  from?: { id: number; first_name?: string; username?: string };
  // type: 'private' | 'group' | 'supergroup' | 'channel' (Telegram-API)
  chat?: { id: number; type?: string; title?: string };
  text?: string;
};
type TelegramCallbackQuery = {
  id: string;
  from?: { id: number };
  message?: TelegramMessage;
  data?: string;
};
