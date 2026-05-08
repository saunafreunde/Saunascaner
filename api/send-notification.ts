// Vercel Serverless Function — POST /api/send-notification
// Sends a text notification to all configured Telegram chats.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN missing' });
  if (!supaUrl || !anonKey) return res.status(500).json({ error: 'Supabase env missing' });

  const { text } = req.body as { text?: string };
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });

  const sb = createClient(supaUrl, anonKey);
  const { data: cfg } = await sb.from('system_config').select('value').eq('key', 'telegram_chats').maybeSingle();
  const chats: number[] = Array.isArray(cfg?.value?.chat_ids) ? cfg.value.chat_ids : [];

  if (chats.length === 0) {
    return res.status(200).json({ ok: true, sent: 0, note: 'no chats subscribed' });
  }

  const results = await Promise.allSettled(
    chats.map((chat_id) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }),
      })
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled' && (r.value as Response).ok).length;
  return res.status(200).json({ ok: true, sent, total: chats.length });
}
