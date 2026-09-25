// Vercel Serverless Function — POST /api/send-notification
// Vereins-Meldungen an alle Telegram-Chats.
//
// Neu 25.09.2026 (Audit): vorher ohne Anmeldung und mit beliebigem HTML-Text
// aus dem Browser — jeder im Internet konnte über den offiziellen Vereins-Bot
// in alle Chats schreiben. Jetzt nur für eingeloggte Mitglieder und nur zwei
// feste Meldungsarten, deren Text der Server selbst baut und prüft:
//   { art: 'badge', badge_id, emoji, label, description } — nur wenn das
//      Abzeichen in den letzten 15 Minuten wirklich verliehen wurde
//   { art: 'sauna_name' } — nur wenn der Aufguss-Name gerade geändert wurde
// Alles wird HTML-escaped (parse_mode HTML).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from './_auth.js';
import { tgBroadcast } from './_telegram.js';

const FRISCH_MS = 15 * 60_000;

function esc(s: unknown, max = 120): string {
  return String(s ?? '').slice(0, max).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN missing' });

  const auth = await authenticate(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (auth.member.role === 'gast' || auth.member.role === 'fan') return res.status(403).json({ error: 'nicht_erlaubt' });
  const sb = auth.service;

  const body = (req.body ?? {}) as { art?: string; badge_id?: string; emoji?: string; label?: string; description?: string };
  const { data: ich } = await sb.from('members').select('name, sauna_name, sauna_name_changed_at').eq('id', auth.member.id).maybeSingle();
  const name = esc(ich?.name ?? 'Jemand', 80);
  const seit = new Date(Date.now() - FRISCH_MS).toISOString();

  let text: string;
  if (body.art === 'badge') {
    const badgeId = String(body.badge_id ?? '').slice(0, 80);
    if (!badgeId) return res.status(400).json({ error: 'badge_id fehlt' });
    const { data: ach } = await sb
      .from('member_achievements')
      .select('id')
      .eq('member_id', auth.member.id)
      .eq('badge_id', badgeId)
      .gte('earned_at', seit)
      .limit(1);
    if (!ach || ach.length === 0) return res.status(409).json({ error: 'abzeichen_nicht_frisch' });
    text = `🏅 <b>${name}</b> hat gerade <b>${esc(body.label, 60)}</b> freigeschaltet! ${esc(body.emoji, 8)}\n<i>${esc(body.description, 200)}</i>`;
  } else if (body.art === 'sauna_name') {
    const geaendert = ich?.sauna_name_changed_at ? Date.parse(ich.sauna_name_changed_at) : 0;
    if (!geaendert || Date.now() - geaendert > FRISCH_MS) return res.status(409).json({ error: 'name_nicht_frisch' });
    text = ich?.sauna_name
      ? `🎭 <b>${name}</b> heißt beim Aufguss jetzt <b>${esc(ich.sauna_name, 60)}</b>.`
      : `🎭 <b>${name}</b> tritt beim Aufguss wieder unter eigenem Namen auf.`;
  } else {
    return res.status(400).json({ error: 'unbekannte_art' });
  }

  const { data: cfg } = await sb.from('system_config').select('value').eq('key', 'telegram_chats').maybeSingle();
  const chats: number[] = Array.isArray(cfg?.value?.chat_ids) ? cfg.value.chat_ids : [];
  if (chats.length === 0) return res.status(200).json({ ok: true, sent: 0, note: 'no chats subscribed' });

  const results = await tgBroadcast(token, 'sendMessage', chats, (chat_id) => ({ chat_id, text, parse_mode: 'HTML' }));
  const sent = results.filter((r) => r.ok).length;
  return res.status(200).json({ ok: true, sent, total: chats.length });
}
