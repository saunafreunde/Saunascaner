// Vercel Serverless Function — POST /api/send-notification
// Sends a text notification to all configured Telegram chats.
//
// FIX 0107 (Audit Phase 8 CRITICAL+HIGH): serviceClient + tgBroadcast.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serviceClient } from './_auth.js';
import { tgBroadcast } from './_telegram.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const sb = serviceClient();
  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN missing' });
  if (!sb) return res.status(500).json({ error: 'Supabase service env missing' });

  const { text } = req.body as { text?: string };
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });

  const { data: cfg } = await sb.from('system_config').select('value').eq('key', 'telegram_chats').maybeSingle();
  const chats: number[] = Array.isArray(cfg?.value?.chat_ids) ? cfg.value.chat_ids : [];

  if (chats.length === 0) {
    return res.status(200).json({ ok: true, sent: 0, note: 'no chats subscribed' });
  }

  const results = await tgBroadcast(token, 'sendMessage', chats, (chat_id) => ({
    chat_id, text, parse_mode: 'HTML',
  }));

  const sent = results.filter((r) => r.ok).length;
  return res.status(200).json({ ok: true, sent, total: chats.length });
}
