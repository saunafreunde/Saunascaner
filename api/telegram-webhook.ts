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

  // GET ?announce=1 → Cron-Hook (Personal-Fallback-Announce)
  if (req.method === 'GET' && req.query.announce === '1') {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers['x-cron-secret'] !== cronSecret) {
      return res.status(401).json({ error: 'cron secret mismatch' });
    }
    const announced = await announceFallbacks(sb, token);
    return res.status(200).json({ ok: true, announced });
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

  // Personal-Fallbacks in den nächsten 2 Stunden, die noch nicht angekündigt sind
  const { data: slots } = await sb.rpc('get_personal_fallbacks_to_announce', { p_hours: 2 });
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

  // Plain /start — Broadcast-Registrierung (Bestandsverhalten)
  if (text === '/start' || text.startsWith('/start@')) {
    await sb.rpc('register_telegram_chat', { p_chat_id: chatId });
    const brand = await getBrandSettings(sb);
    await tgSend(token, chatId,
      `🌲 <b>Willkommen bei ${brand.org.name}!</b>\n\n` +
      `Du bist für Benachrichtigungen registriert.\n\n` +
      `Wenn du dein Konto verknüpfen möchtest (um Aufgüsse zu sehen, Personal-Slots zu übernehmen, …):\n` +
      `<b>App öffnen → Profil → 🔗 Telegram verknüpfen</b> → den dort generierten Link klicken.`);
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

  // /heute, /morgen — öffentliche Aufguss-Listen
  if (text === '/heute' || text === '/morgen') {
    const day = text === '/heute' ? 'today' : 'tomorrow';
    await sendDayList(sb, token, chatId, day);
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

  // Default: Hilfe
  if (text.startsWith('/')) {
    await tgSend(token, chatId,
      `Befehle:\n/heute · /morgen — Aufguss-Übersicht\n/meine — meine Aufgüsse\n/link — Konto verknüpfen\n/unlink — Verknüpfung lösen\n/start — Broadcast aktivieren\n/stop — abmelden`);
  }
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
        await tgAnswerCallback(token, cb.id, '⚠️ Dein Telegram ist nicht mit einem Saunascaner-Konto verknüpft.', true);
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

  // Default
  await tgAnswerCallback(token, cb.id, '');
}

// ─── Helpers: Day-List + My-List ─────────────────────────────────────────
async function sendDayList(sb: SupabaseClient, token: string, chatId: number, day: 'today' | 'tomorrow') {
  const offset = day === 'tomorrow' ? 1 : 0;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offset);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data, error } = await sb
    .from('infusions')
    .select('id, title, start_time, end_time, sauna_id, saunameister_id, is_personal_fallback, team_infusion, saunas(name, temperature_label)')
    .gte('start_time', start.toISOString())
    .lt('start_time', end.toISOString())
    .order('start_time');

  if (error) {
    await tgSend(token, chatId, '❌ Fehler: ' + error.message);
    return;
  }
  if (!data || data.length === 0) {
    await tgSend(token, chatId, day === 'today' ? 'Heute keine Aufgüsse.' : 'Morgen keine Aufgüsse.');
    return;
  }

  // Meister-Namen
  const meisterIds = Array.from(new Set(data.map((i) => i.saunameister_id).filter(Boolean) as string[]));
  const { data: members } = meisterIds.length
    ? await sb.from('members').select('id, name').in('id', meisterIds)
    : { data: [] };
  const meisterName = (id: string | null) => (id && members?.find((m) => m.id === id)?.name) || 'Personal';

  const lines = data.map((i) => {
    const s = (i.saunas as unknown as { name: string; temperature_label: string }) ?? { name: '?', temperature_label: '?' };
    const name = i.is_personal_fallback ? '👨‍🍳 Personal' : meisterName(i.saunameister_id);
    const team = i.team_infusion ? ' 👥' : '';
    return `🔥 <b>${fmtClock(i.start_time)}</b> · ${s.name} ${s.temperature_label}\n   ${i.title}${team} — ${name}`;
  });

  const header = day === 'today' ? '<b>📋 Heute</b>' : '<b>📋 Morgen</b>';
  await tgSend(token, chatId, `${header}\n\n${lines.join('\n\n')}`);
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
