// Vercel Serverless Function — POST /api/telegram-webhook
// Empfängt Telegram-Updates und verarbeitet:
//   /start <token>     — Account-Verknüpfung mit Saunafreunde-Member
//   /start             — Chat-ID für Broadcasts registrieren (Bestandsverhalten)
//   /stop              — Chat-ID abmelden
//   /heute, /morgen    — Aufguss-Übersicht
//   /meine             — eigene geplante Aufgüsse
//   /link              — Anleitung zur Verknüpfung
//   /unlink            — Verknüpfung lösen
//   callback_query     — "Ich übernehme!"-Button bei Personal-Fallback-Slots

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getBrandSettings } from './_email_helpers.js';

const TG_API = (token: string) => `https://api.telegram.org/bot${token}`;

async function tgSend(token: string, chatId: number, text: string, opts: { parse_mode?: string; reply_markup?: unknown } = {}) {
  await fetch(`${TG_API(token)}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: opts.parse_mode ?? 'HTML', reply_markup: opts.reply_markup }),
  });
}

async function tgAnswerCallback(token: string, callbackQueryId: string, text: string, alert = false) {
  await fetch(`${TG_API(token)}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: alert }),
  });
}

async function tgEditMessage(token: string, chatId: number, messageId: number, text: string, reply_markup?: unknown) {
  await fetch(`${TG_API(token)}/editMessageText`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', reply_markup }),
  });
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
}

function fmtClock(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.query.secret !== secret) return res.status(401).end();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !supaUrl || !serviceKey) return res.status(200).json({ ok: false, missing_env: true });

  const sb = createClient(supaUrl, serviceKey);

  // GET ?diag=1 → Telegram-Webhook-Diagnose (Bot-Info + Webhook-Status + letzte Fehler)
  // Aufruf direkt im Browser: /api/telegram-webhook?diag=1
  // Liefert:
  //   - getMe: Bot-Username + ID (Token-Validität)
  //   - getWebhookInfo: aktuell registrierte URL + pending_update_count +
  //     last_error_date + last_error_message + max_connections
  // Wenn last_error_message gesetzt ist oder url leer → Webhook ist defekt.
  if (req.method === 'GET' && req.query.diag === '1') {
    const [meRes, whRes] = await Promise.all([
      fetch(`${TG_API(token)}/getMe`).then((r) => r.json()).catch((e) => ({ error: String(e) })),
      fetch(`${TG_API(token)}/getWebhookInfo`).then((r) => r.json()).catch((e) => ({ error: String(e) })),
    ]);
    return res.status(200).json({
      bot: meRes,
      webhook: whRes,
      expected_url: `${process.env.PUBLIC_APP_URL ?? 'https://saunascaner.vercel.app'}/api/telegram-webhook`,
      hint: 'Wenn webhook.result.url leer oder ungleich expected_url → /api/telegram-webhook?reregister=1 aufrufen.',
    });
  }

  // GET ?reregister=1 → Webhook bei Telegram (neu) registrieren
  // Liest TELEGRAM_WEBHOOK_SECRET aus Env und hängt es als ?secret=... an
  // damit nur Telegram die URL hitten kann (sonst kann jeder die URL fluten).
  if (req.method === 'GET' && req.query.reregister === '1') {
    const baseUrl = process.env.PUBLIC_APP_URL ?? 'https://saunascaner.vercel.app';
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const url = webhookSecret
      ? `${baseUrl}/api/telegram-webhook?secret=${encodeURIComponent(webhookSecret)}`
      : `${baseUrl}/api/telegram-webhook`;
    const setRes = await fetch(`${TG_API(token)}/setWebhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: false,
      }),
    }).then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
    const whInfo = await fetch(`${TG_API(token)}/getWebhookInfo`).then((r) => r.json()).catch(() => ({}));
    return res.status(200).json({ set: setRes, webhook_now: whInfo, registered_url: url });
  }

  // GET ?announce=1 → Cron-Hook (Personal-Fallback-Announce)
  if (req.method === 'GET' && req.query.announce === '1') {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers['x-cron-secret'] !== cronSecret) {
      return res.status(401).json({ error: 'cron secret mismatch' });
    }
    const announced = await announceFallbacks(sb, token);
    return res.status(200).json({ ok: true, announced });
  }

  // GET ?rating_push=1 → Cron-Hook (Rating-Push 15 Min nach Aufguss-Ende)
  if (req.method === 'GET' && req.query.rating_push === '1') {
    const pushed = await sendRatingPushes(sb, token);
    return res.status(200).json({ ok: true, pushed });
  }

  // POST ?action=broadcast_handbook → Handbuch-Link an alle Chats
  if (req.method === 'POST' && req.query.action === 'broadcast_handbook') {
    // Auth via Bearer-Token: nur Admin darf broadcasten
    const authHeader = req.headers.authorization ?? '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!bearerToken) return res.status(401).json({ error: 'missing bearer' });
    const supaUrl2 = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!supaUrl2 || !anonKey) return res.status(500).json({ error: 'env missing' });
    const userClient = createClient(supaUrl2, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    });
    const { data: userData } = await userClient.auth.getUser(bearerToken);
    if (!userData?.user) return res.status(401).json({ error: 'invalid token' });
    const { data: m } = await sb.from('members').select('role').eq('auth_user_id', userData.user.id).maybeSingle();
    if (m?.role !== 'admin') return res.status(403).json({ error: 'admin only' });

    const brand = await getBrandSettings(sb);
    const origin = process.env.PUBLIC_APP_URL ?? 'https://saunascaner.vercel.app';
    const text =
      `📖 <b>Mitglieder-Handbuch</b>\n\n` +
      `Liebe Saunafreunde, hier findet ihr das komplette Handbuch zu unserer App — Aufgüsse planen, WM-Tipspiel, Kalender-Abo, alles drin:\n\n` +
      `🌲 ${origin}/hilfe\n\n` +
      `— ${brand.org.name}`;

    const { data: cfg } = await sb.from('system_config').select('value').eq('key', 'telegram_chats').maybeSingle();
    const cfgVal = (cfg?.value as { chat_ids?: number[] } | null) ?? null;
    const chatIds = cfgVal?.chat_ids ?? [];
    if (chatIds.length === 0) return res.status(200).json({ ok: true, sent: 0, note: 'no chats registered' });

    const results = await Promise.allSettled(chatIds.map((id) => tgSend(token, id, text)));
    const sent = results.filter((r) => r.status === 'fulfilled').length;
    return res.status(200).json({ ok: true, sent, failed: results.length - sent });
  }

  if (req.method !== 'POST') return res.status(405).end();

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
  // Welche Channels bekommen Announcements? Aus system_config.telegram_chats
  const { data: cfg } = await sb.from('system_config').select('value').eq('key', 'telegram_chats').maybeSingle();
  const cfgVal = (cfg?.value as { chat_ids?: number[] } | null) ?? null;
  const chatIds = cfgVal?.chat_ids ?? [];
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
      `<b>${startTime} Uhr</b> · ${slot.sauna_name} ${slot.temperature_c}°C\n\n` +
      `Niemand hat diesen Slot übernommen. Wer macht ihn?`;
    const reply_markup = {
      inline_keyboard: [[
        { text: '✋ Ich übernehme!', callback_data: `takeover:${slot.infusion_id}` },
      ]],
    };

    for (const chatId of chatIds) {
      try {
        await tgSend(token, chatId, text, { reply_markup });
      } catch (e) {
        console.error(`failed to announce to chat ${chatId}`, e);
      }
    }
    await sb.rpc('mark_telegram_announced', { p_infusion_id: slot.infusion_id });
    announced++;
  }
  return announced;
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
    try {
      const { data } = await sb.rpc('claim_telegram_link', { p_token: linkToken, p_telegram_user_id: fromId });
      const member = Array.isArray(data) ? data[0] : data;
      if (member) {
        await tgSend(token, chatId,
          `✅ <b>Konto verknüpft!</b>\n\nHallo ${member.name}, dein Telegram ist jetzt mit Saunascaner verknüpft.\n\n` +
          `Verfügbare Befehle:\n` +
          `/heute — Aufgüsse heute\n/morgen — Aufgüsse morgen\n/meine — Meine Aufgüsse\n/unlink — Verknüpfung lösen`);
        // Auch klassisch für Broadcasts registrieren
        await sb.rpc('register_telegram_chat', { p_chat_id: chatId });
        return;
      }
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('invalid_or_expired_token')) {
        await tgSend(token, chatId, '❌ Token ungültig oder schon eingelöst. Generiere einen neuen in der App: <i>Profil → Telegram verknüpfen</i>.');
        return;
      }
      await tgSend(token, chatId, '❌ Fehler bei Verknüpfung: ' + msg);
      return;
    }
  }

  // Plain /start — Broadcast-Registrierung + Verknüpfen-Button wenn unverknüpft
  if (text === '/start' || text.startsWith('/start@')) {
    await sb.rpc('register_telegram_chat', { p_chat_id: chatId });
    const brand = await getBrandSettings(sb);
    const { data: linkedMember } = await sb.from('members').select('id, name').eq('telegram_user_id', fromId).maybeSingle();
    if (linkedMember) {
      await tgSend(token, chatId,
        `🌲 <b>Hallo ${linkedMember.name}!</b>\n\nDein Konto ist verknüpft, du bekommst Benachrichtigungen.\n\nSchreibe /help um alle Befehle zu sehen.`);
    } else {
      await tgSend(token, chatId,
        `🌲 <b>Willkommen bei ${brand.org.name}!</b>\n\n` +
        `Du bist für Benachrichtigungen registriert. Damit du Personal-Aufgüsse übernehmen und Aufgüsse direkt im Chat bewerten kannst, verknüpfe dein Konto:`,
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

  // /unlink — Telegram-Account-Verknüpfung lösen
  if (text === '/unlink') {
    await sb.from('members').update({ telegram_user_id: null, telegram_link_token: null }).eq('telegram_user_id', fromId);
    await tgSend(token, chatId, '🔓 Konto-Verknüpfung gelöst.');
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

  // /pin — eigenen Tablet-PIN anzeigen (braucht Verknüpfung)
  if (text === '/pin') {
    const { data: rows } = await sb.rpc('get_my_checkin_pin_by_telegram', { p_telegram_user_id: fromId });
    const pinRow = Array.isArray(rows) ? rows[0] : rows;
    if (!pinRow?.pin) {
      await tgSend(token, chatId, '⚠️ Konto nicht verknüpft oder kein PIN gesetzt. Sende /link für die Anleitung.');
      return;
    }
    await tgSend(token, chatId,
      `🔢 <b>Dein Sauna-Tablet-PIN</b>\n\n<code>${pinRow.pin}</code>\n\n` +
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
    `<b>🔔 Broadcasts</b>\n` +
    `/start — Benachrichtigungen aktivieren\n` +
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
        // Original-Nachricht updaten — Button entfernen, Status anzeigen
        const oldText = cb.message?.text ?? '';
        await tgEditMessage(token, chatId, messageId,
          `${oldText}\n\n✅ <b>Übernommen von ${row.member_name}</b>`,
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
        await tgEditMessage(token, chatId, messageId, `${oldText}\n\n✅ Bereits übernommen.`, undefined);
      } else if (msg.includes('not_authorized')) {
        await tgAnswerCallback(token, cb.id, '⚠️ Nur Aufgießer/Personal können Slots übernehmen.', true);
      } else if (msg.includes('slot_in_past')) {
        await tgAnswerCallback(token, cb.id, 'Dieser Slot ist schon vorbei.', true);
      } else {
        await tgAnswerCallback(token, cb.id, '❌ Fehler: ' + msg, true);
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
      } else {
        await tgAnswerCallback(token, cb.id, '❌ Fehler: ' + msg, true);
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
        `${oldText}\n\n✅ <b>Deine Bewertung: ${'⭐'.repeat(stars)}${'☆'.repeat(5-stars)}</b>`,
        { inline_keyboard: [[
          { text: '✏️ Detailliert in App', url: `https://saunascaner.vercel.app/planner` },
        ]]});
      return;
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('telegram_not_linked')) {
        await tgAnswerCallback(token, cb.id, '⚠️ Konto nicht verknüpft.', true);
      } else if (msg.includes('self_rating_not_allowed')) {
        await tgAnswerCallback(token, cb.id, 'Eigene Aufgüsse kannst du nicht bewerten.', true);
      } else if (msg.includes('rating_window_expired')) {
        await tgAnswerCallback(token, cb.id, 'Bewertungsfenster ist zu (3h nach Ende).', true);
      } else if (msg.includes('infusion_not_finished')) {
        await tgAnswerCallback(token, cb.id, 'Aufguss läuft noch.', true);
      } else {
        await tgAnswerCallback(token, cb.id, '❌ Fehler: ' + msg, true);
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
  if (error) { await tgSend(token, chatId, '❌ Fehler: ' + error.message); return; }

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
  for (const h of hours) {
    for (const sa of (saunas ?? [])) {
      const i = infByKey.get(`${sa.id}|${h}`);
      const hh = String(h).padStart(2, '0');
      const isFuture = berlinInstant(targetYmd, h).getTime() > Date.now();

      if (!i) {
        // FREIER Slot
        if (!isFuture) continue; // vergangene leere Slots überspringen
        freeCount++;
        const text = `🟢 <b>${hh}:00</b> · ${sa.name} ${sa.temperature_label}\n<i>— frei —</i>`;
        await tgSend(token, chatId, text, {
          reply_markup: {
            inline_keyboard: [[{ text: '📲 In App belegen', url: planUrl }]],
          },
        });
        continue;
      }

      const isMine = myMemberId && i.saunameister_id === myMemberId;
      const name = i.is_personal_fallback ? '👨‍🍳 Personal' : (isMine ? `<i>du selbst</i>` : meisterName(i.saunameister_id));
      const team = i.team_infusion ? ' 👥' : '';
      const mineMark = isMine ? ' ✓' : '';
      const text = `🔥 <b>${hh}:00</b> · ${sa.name} ${sa.temperature_label}\n${i.title}${team}${mineMark} — ${name}`;

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

  if (error) { await tgSend(token, chatId, '❌ Fehler: ' + error.message); return; }
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
      const name = i.is_personal_fallback ? '👨‍🍳 Personal' : meisterName(i.saunameister_id);
      const team = i.team_infusion ? ' 👥' : '';
      parts.push(`${fmtClock(i.start_time)} · ${s.name} ${s.temperature_label} · ${i.title}${team} — ${name}`);
    }
  }
  await tgSend(token, chatId, parts.join('\n'));
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
      `<b>${r.infusion_title}</b>\n` +
      `${r.meister_name} · ${fmtClock(r.end_time)}\n\n` +
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
    try {
      await tgSend(token, r.telegram_user_id, text, { reply_markup });
      await sb.rpc('mark_telegram_rating_pushed', { p_member_id: r.member_id, p_infusion_id: r.infusion_id });
      sent++;
    } catch (e) {
      console.error('rating push failed', r.member_id, e);
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

  if (error) { await tgSend(token, chatId, '❌ Fehler: ' + error.message); return; }
  if (!data || data.length === 0) {
    await tgSend(token, chatId, `Hi ${memberName}, du hast keine geplanten Aufgüsse.`);
    return;
  }

  const lines = data.map((i) => {
    const s = (i.saunas as unknown as { name: string; temperature_label: string }) ?? { name: '?', temperature_label: '?' };
    return `🔥 <b>${fmtTime(i.start_time)}</b>\n   ${i.title} — ${s.name} ${s.temperature_label}${i.team_infusion ? ' 👥' : ''}`;
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
  from?: { id: number; first_name?: string };
  chat?: { id: number };
  text?: string;
};
type TelegramCallbackQuery = {
  id: string;
  from?: { id: number };
  message?: TelegramMessage;
  data?: string;
};
