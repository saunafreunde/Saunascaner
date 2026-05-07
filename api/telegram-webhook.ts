// Vercel Serverless Function — POST /api/telegram-webhook
// Receives Telegram updates. On /start → captures chat_id into system_config.telegram_chats.
// Configure once via:
//   curl -F "url=https://saunascaner.vercel.app/api/telegram-webhook?secret=<random>" \
//        https://api.telegram.org/bot<TOKEN>/setWebhook

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.query.secret !== secret) return res.status(401).end();

  const update = req.body;
  const msg = update?.message;
  if (!msg) return res.status(200).json({ ok: true, ignored: true });

  const chatId: number | undefined = msg.chat?.id;
  const text: string = msg.text ?? '';
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!chatId || !token || !supaUrl || !anonKey) return res.status(200).json({ ok: false });

  const sb = createClient(supaUrl, anonKey);

  if (text.startsWith('/start')) {
    // Read existing list, add this chat_id if missing.
    const { data: existing } = await sb.from('system_config').select('value').eq('key', 'telegram_chats').maybeSingle();
    const cur: number[] = Array.isArray(existing?.value?.chat_ids) ? existing.value.chat_ids : [];
    if (!cur.includes(chatId)) cur.push(chatId);

    // We need write — but anon can't update system_config. Use the bot's reply to instruct user.
    // Instead: we save via a SECURITY DEFINER RPC `register_telegram_chat`.
    await sb.rpc('register_telegram_chat', { p_chat_id: chatId });

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `✅ Saunafreunde Schwarzwald — Bot verbunden.\nDeine Chat-ID: ${chatId}\nDu erhältst ab jetzt Evakuierungs-Benachrichtigungen.`,
      }),
    });
  } else if (text.startsWith('/stop')) {
    await sb.rpc('unregister_telegram_chat', { p_chat_id: chatId });
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: '🛑 Abgemeldet — du erhältst keine Benachrichtigungen mehr.' }),
    });
  }

  return res.status(200).json({ ok: true });
}
