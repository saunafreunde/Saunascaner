// Vercel Serverless Function — POST /api/send-poll-results
// Generates a PDF with poll results and sends it to all Telegram chats.
//
// FIX 0107 (Audit Phase 8 CRITICAL+HIGH): serviceClient + tgBroadcast.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from './_auth.js';
import { tgBroadcast, vereinsChats } from './_telegram.js';

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

// MarkdownV2: diese Zeichen müssen mit \ entschärft werden.
function esc(s: string): string {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

/** Kürzt VOR dem Escapen nach Zeichen (trennt keine Emojis) und entfernt Zeilenumbrüche. */
function kurz(s: unknown, max: number): string {
  const zeichen = Array.from(String(s ?? '').replace(/\s+/g, ' ').trim());
  return zeichen.length > max ? zeichen.slice(0, max - 1).join('') + '…' : zeichen.join('');
}

// Telegram erlaubt 4096 Zeichen; etwas Luft für Kopf und Schlusszeile.
const BUDGET = 3900;

/**
 * Audit-Runde 2 (25.09.2026): vorher wurde der fertige MarkdownV2-Text blind
 * bei 4000 Zeichen abgeschnitten. Lag der Schnitt in einer kursiven Antwort
 * (_…_) oder direkt hinter einem Escape-\, lehnte Telegram die Nachricht für
 * JEDEN Chat ab (400 „can't parse entities“) — bei längeren Freitext-Umfragen
 * der Normalfall. Jetzt: jede Antwort einzeln gekürzt, ganze Zeilen bis zum
 * Budget, der Rest als „… und N weitere“. Nie mitten in den Markdown-Text.
 */
function buildTelegramMessage(payload: PollResultPayload): string {
  const { pollTitle, pollDescription, results, totalMembers } = payload;
  const gesamt = Number.isFinite(totalMembers) && totalMembers > 0 ? Math.floor(totalMembers) : 0;
  const responseRate = gesamt > 0 ? Math.round((results.length / gesamt) * 100) : 0;

  // Leere Teile nie in *…*/_…_ setzen: „__“ liest MarkdownV2 als Beginn einer
  // Unterstreichung ohne Ende → 400 für jeden Chat. Eine leere Antwort kann
  // jedes Mitglied speichern (poll_responses.answer ohne Mindestlänge).
  const titel = kurz(pollTitle, 200) || 'Abfrage';
  const beschreibung = kurz(pollDescription, 500);
  const kopf = [
    `📊 *Abfrage\\-Ergebnis*`,
    ``,
    `*${esc(titel)}*`,
    ...(beschreibung ? [`_${esc(beschreibung)}_`, ''] : ['']),
    `Antworten: ${results.length} von ${gesamt} Mitgliedern \\(${responseRate}%\\)`,
    ``,
    `*Einzelantworten:*`,
  ];

  let text = kopf.join('\n');
  let aufgenommen = 0;
  for (const r of results) {
    const antwort = kurz(r?.answer, 300);
    const zeile = `• ${esc(fmtMemberNumber(r?.member_number ?? null))} ${esc(kurz(r?.member_name, 60))}: ${antwort ? `_${esc(antwort)}_` : esc('(leer)')}`;
    // Platz für die Schlusszeile („… und N weitere“) freihalten.
    if (text.length + 1 + zeile.length > BUDGET - 80) break;
    text += '\n' + zeile;
    aufgenommen++;
  }
  const rest = results.length - aufgenommen;
  if (rest > 0) text += '\n' + esc(`… und ${rest} weitere Antworten in der App.`);
  return text;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN missing' });

  // Nur Admins (Audit 25.09.2026: vorher ohne Anmeldung — jeder konnte
  // beliebige „Umfrageergebnisse" in alle Vereins-Chats schicken).
  const auth = await authenticate(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (auth.member.role !== 'admin') return res.status(403).json({ error: 'admin only' });
  const sb = auth.service;

  const p = req.body as PollResultPayload;
  if (!p?.pollTitle || typeof p.pollTitle !== 'string' || !Array.isArray(p?.results)) {
    return res.status(400).json({ error: 'Ungültige Anfrage (Titel oder Antworten fehlen).' });
  }
  // Mehr Antworten als Mitglieder gibt es nicht — Obergrenze gegen Riesen-Bodys.
  if (p.results.length > 2000) return res.status(400).json({ error: 'Zu viele Antworten in der Anfrage.' });

  const chats = await vereinsChats(sb);

  if (chats.length === 0) {
    return res.status(200).json({ ok: true, via: 'telegram', sent: 0, total: 0, note: 'no chats subscribed' });
  }

  const text = buildTelegramMessage(p);

  const results = await tgBroadcast(token, 'sendMessage', chats, (chat_id) => ({
    chat_id, text, parse_mode: 'MarkdownV2',
  }));

  const sent = results.filter((r) => r.ok).length;
  const fehlStatus = Array.from(new Set(results.filter((r) => !r.ok).map((r) => r.status)));
  if (sent < chats.length) console.error('[send-poll-results] nicht zugestellt', chats.length - sent, 'Status', fehlStatus.join(','));
  return res.status(200).json({ ok: sent > 0, sent, failed: chats.length - sent, total: chats.length, fehler_status: fehlStatus });
}
