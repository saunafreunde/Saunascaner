// Vercel Serverless Function — POST /api/send-poll-results
// Generates a PDF with poll results and sends it to all Telegram chats.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

type PollResultPayload = {
  pollTitle: string;
  pollDescription?: string;
  answerType: string;
  results: { member_name: string; member_number: number | null; answer: string; answered_at: string }[];
  totalMembers: number;
};

function fmtMemberNumber(n: number | null): string {
  if (!n) return '—';
  return `FDS-${String(n).padStart(3, '0')}`;
}

function buildTelegramMessage(payload: PollResultPayload): string {
  const esc = (s: string) => s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  const { pollTitle, pollDescription, results, totalMembers } = payload;

  const responseRate = totalMembers > 0 ? Math.round((results.length / totalMembers) * 100) : 0;

  const lines = [
    `📊 *Abfrage\\-Ergebnis*`,
    ``,
    `*${esc(pollTitle)}*`,
    ...(pollDescription ? [`_${esc(pollDescription)}_`, ''] : ['']),
    `Antworten: ${results.length} von ${totalMembers} Mitgliedern \\(${responseRate}%\\)`,
    ``,
    `*Einzelantworten:*`,
    ...results.map((r) =>
      `• ${esc(fmtMemberNumber(r.member_number))} ${esc(r.member_name)}: _${esc(r.answer)}_`
    ),
  ];

  // Telegram max message length is 4096 chars
  return lines.join('\n').slice(0, 4000);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN missing' });
  if (!supaUrl || !anonKey) return res.status(500).json({ error: 'Supabase env missing' });

  const p = req.body as PollResultPayload;
  if (!p?.pollTitle || !Array.isArray(p?.results)) {
    return res.status(400).json({ error: 'bad payload' });
  }

  const sb = createClient(supaUrl, anonKey);
  const { data: cfg } = await sb.from('system_config').select('value').eq('key', 'telegram_chats').maybeSingle();
  const chats: number[] = Array.isArray(cfg?.value?.chat_ids) ? cfg.value.chat_ids : [];

  if (chats.length === 0) {
    return res.status(200).json({ ok: true, via: 'telegram', sent: 0, note: 'no chats subscribed' });
  }

  const text = buildTelegramMessage(p);

  const results = await Promise.allSettled(
    chats.map((chat_id) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id, text, parse_mode: 'MarkdownV2' }),
      }).then(async (r) => ({ chat_id, ok: r.ok, status: r.status, body: r.ok ? null : await r.text() }))
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled' && (r.value as { ok: boolean }).ok).length;
  return res.status(200).json({ ok: true, sent, total: chats.length });
}
