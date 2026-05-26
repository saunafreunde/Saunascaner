// Vercel Serverless Function — POST /api/send-poll-results
// Generates a PDF with poll results and sends it to all Telegram chats.
//
// FIX 0107 (Audit Phase 8 CRITICAL+HIGH): serviceClient + tgBroadcast.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serviceClient } from './_auth.js';
import { tgBroadcast } from './_telegram.js';

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
  const sb = serviceClient();
  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN missing' });
  if (!sb) return res.status(500).json({ error: 'Supabase service env missing' });

  const p = req.body as PollResultPayload;
  if (!p?.pollTitle || !Array.isArray(p?.results)) {
    return res.status(400).json({ error: 'bad payload' });
  }

  const { data: cfg } = await sb.from('system_config').select('value').eq('key', 'telegram_chats').maybeSingle();
  const chats: number[] = Array.isArray(cfg?.value?.chat_ids) ? cfg.value.chat_ids : [];

  if (chats.length === 0) {
    return res.status(200).json({ ok: true, via: 'telegram', sent: 0, note: 'no chats subscribed' });
  }

  const text = buildTelegramMessage(p);

  const results = await tgBroadcast(token, 'sendMessage', chats, (chat_id) => ({
    chat_id, text, parse_mode: 'MarkdownV2',
  }));

  const sent = results.filter((r) => r.ok).length;
  return res.status(200).json({ ok: true, sent, total: chats.length });
}
