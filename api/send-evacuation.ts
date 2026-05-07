// Vercel Serverless Function — POST /api/send-evacuation
// Sends an evacuation notification to all chat_ids stored in system_config.telegram_chats.
// Bot token stays server-side (TELEGRAM_BOT_TOKEN env var).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

type EvacPayload = {
  triggeredBy: string;
  triggeredAt: string;
  presentNames: string[];
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN missing' });
  if (!supaUrl || !anonKey) return res.status(500).json({ error: 'Supabase env missing' });

  const p = req.body as EvacPayload;
  if (!p?.triggeredBy || !p?.triggeredAt) return res.status(400).json({ error: 'bad payload' });

  // Read chat_ids from public system_config (anon-readable)
  const sb = createClient(supaUrl, anonKey);
  const { data: cfg } = await sb.from('system_config').select('value').eq('key', 'telegram_chats').maybeSingle();
  const chats: number[] = Array.isArray(cfg?.value?.chat_ids) ? cfg.value.chat_ids : [];

  if (chats.length === 0) {
    return res.status(200).json({ ok: true, via: 'telegram', sent: 0, note: 'no chats subscribed' });
  }

  const text = [
    '🚨 *EVAKUIERUNG ausgelöst*',
    `Auslöser: ${p.triggeredBy}`,
    `Zeit: ${new Date(p.triggeredAt).toLocaleString('de-DE')}`,
    '',
    `Anwesend (${p.presentNames.length}):`,
    ...(p.presentNames.length ? p.presentNames.map((n) => `• ${n}`) : ['_keine Personen erfasst_']),
  ].join('\n');

  const results = await Promise.allSettled(
    chats.map((chat_id) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id, text, parse_mode: 'Markdown' }),
      }).then(async (r) => ({ chat_id, ok: r.ok, status: r.status, body: r.ok ? null : await r.text() }))
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
  return res.status(200).json({ ok: true, via: 'telegram', sent, total: chats.length, results });
}
