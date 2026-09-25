// Vercel Serverless Function — POST /api/send-notification
// Vereins-Meldungen an alle Telegram-Chats.
//
// Neu 25.09.2026 (Audit): vorher ohne Anmeldung und mit beliebigem HTML-Text
// aus dem Browser — jeder im Internet konnte über den offiziellen Vereins-Bot
// in alle Chats schreiben. Jetzt nur für eingeloggte Mitglieder und nur zwei
// feste Meldungsarten, deren Text der Server selbst baut:
//   { art: 'badge', badge_id } — nur wenn das Abzeichen in den letzten
//      15 Minuten wirklich verliehen wurde. Emoji, Name und Beschreibung
//      kommen aus dem Katalog api/_badges.ts; was der Browser zusätzlich
//      mitschickt (emoji/label/description), wird ignoriert.
//   { art: 'sauna_name' } — nur wenn der Aufguss-Name gerade geändert wurde
// Alles wird HTML-escaped (parse_mode HTML).
//
// Audit-Runde 2 (25.09.2026, Migration 0194): vorher ging dieselbe Meldung
// bei jedem Aufruf erneut an alle Chats (set_sauna_name erneuert den
// Zeitstempel beliebig oft) — Spam und Telegrams Flood-Grenze, die dann auch
// echte Meldungen bremst. Jetzt:
//   * Einmal-Schutz (Tabelle push_vorlagen_versand): je Mitglied und Abzeichen
//     bzw. je Namensänderung höchstens EINE Meldung;
//   * Drossel je Mitglied (kiosk_versuche, Art 'tg_meldung'): höchstens
//     10 Meldungen je Stunde, davon höchstens 2 Namens-Meldungen je 6 Stunden.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from './_auth.js';
import { ABZEICHEN } from './_badges.js';
import { drosselBuchen, type Topf } from './_schutz.js';
import { tgBroadcast, vereinsChats } from './_telegram.js';

const FRISCH_MS = 15 * 60_000;
const MELDUNGEN_JE_STUNDE = 10;
const NAMENS_MELDUNGEN_JE_6H = 2;

/** Kürzt nach Zeichen (nicht UTF-16-Einheiten — trennt keine Emojis) und escaped für HTML. */
function esc(s: unknown, max = 120): string {
  const zeichen = Array.from(String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim());
  const kurz = zeichen.length > max ? zeichen.slice(0, max - 1).join('') + '…' : zeichen.join('');
  return kurz.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN missing' });

  const auth = await authenticate(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (auth.member.role === 'gast' || auth.member.role === 'fan') return res.status(403).json({ error: 'nicht_erlaubt' });
  const sb = auth.service;
  const memberId = auth.member.id;

  const body = (req.body ?? {}) as { art?: string; badge_id?: string };
  const { data: ich } = await sb.from('members').select('name, sauna_name, sauna_name_changed_at').eq('id', memberId).maybeSingle();
  const name = esc(ich?.name ?? 'Jemand', 60);
  const seit = new Date(Date.now() - FRISCH_MS).toISOString();

  let text: string;
  let einmalSchluessel: string;
  const toepfe: Topf[] = [{ schluessel: `m:${memberId}`, max: MELDUNGEN_JE_STUNDE, fensterS: 3600 }];

  if (body.art === 'badge') {
    const badgeId = String(body.badge_id ?? '').trim().slice(0, 80);
    if (!badgeId) return res.status(400).json({ error: 'badge_id fehlt' });
    const { data: ach } = await sb
      .from('member_achievements')
      .select('id')
      .eq('member_id', memberId)
      .eq('badge_id', badgeId)
      .gte('earned_at', seit)
      .limit(1);
    if (!ach || ach.length === 0) return res.status(409).json({ error: 'abzeichen_nicht_frisch' });
    const eintrag = ABZEICHEN[badgeId];
    text = eintrag
      ? `🏅 <b>${name}</b> hat gerade <b>${esc(eintrag[1], 60)}</b> freigeschaltet! ${esc(eintrag[0], 8)}\n<i>${esc(eintrag[2], 200)}</i>`
      : `🏅 <b>${name}</b> hat gerade ein neues Abzeichen freigeschaltet!`;
    // Je Mitglied und Abzeichen genau eine Meldung (member_achievements hat
    // UNIQUE (member_id, badge_id) — ein Abzeichen gibt es nur einmal).
    einmalSchluessel = `tg_badge:${memberId}:${badgeId}`;
  } else if (body.art === 'sauna_name') {
    const geaendert = ich?.sauna_name_changed_at ? Date.parse(ich.sauna_name_changed_at) : 0;
    if (!geaendert || Date.now() - geaendert > FRISCH_MS) return res.status(409).json({ error: 'name_nicht_frisch' });
    // Audit-Runde 3 (0199): der frei gewählte Name steht in <code> — dort
    // macht Telegram aus „etwas.de“ oder „@name“ keinen anklickbaren Link.
    // set_sauna_name lehnt solche Namen zusätzlich schon beim Speichern ab.
    text = ich?.sauna_name
      ? `🎭 <b>${name}</b> heißt beim Aufguss jetzt <code>${esc(ich.sauna_name, 40)}</code>.`
      : `🎭 <b>${name}</b> tritt beim Aufguss wieder unter eigenem Namen auf.`;
    // Je Namensänderung genau eine Meldung; die Drossel unten bremst, wer den
    // Namen immer wieder ändert (set_sauna_name hat bewusst keine Sperrfrist).
    einmalSchluessel = `tg_saunaname:${memberId}:${new Date(geaendert).toISOString()}`;
    toepfe.push({ schluessel: `name:${memberId}`, max: NAMENS_MELDUNGEN_JE_6H, fensterS: 6 * 3600 });
  } else {
    return res.status(400).json({ error: 'unbekannte_art' });
  }

  // Schon gemeldet? (vor der Drossel — ein doppelter Aufruf verbraucht nichts)
  const { count: schon } = await sb
    .from('push_vorlagen_versand')
    .select('schluessel', { count: 'exact', head: true })
    .eq('schluessel', einmalSchluessel);
  if ((schon ?? 0) > 0) return res.status(200).json({ ok: true, sent: 0, schon_gesendet: true });

  // Drossel je Mitglied. Keine Notfall-Meldung: bei einem Datenbankfehler
  // (null) lieber nichts senden.
  const voll = await drosselBuchen(sb, 'tg_meldung', toepfe);
  if (voll === null) return res.status(503).json({ error: 'drossel_nicht_verfuegbar' });
  if (voll !== 0) return res.status(429).json({ error: 'zu_viele_meldungen' });

  // Einmal-Schutz: Schlüssel beanspruchen, BEVOR etwas rausgeht (gleichzeitige
  // Aufrufe: nur einer gewinnt, der andere bekommt 23505).
  const { error: claimErr } = await sb.from('push_vorlagen_versand').insert({ schluessel: einmalSchluessel, member_id: memberId });
  if (claimErr) {
    if ((claimErr as { code?: string }).code === '23505') return res.status(200).json({ ok: true, sent: 0, schon_gesendet: true });
    console.error('[send-notification] Einmal-Schutz fehlgeschlagen', claimErr.code ?? '');
    return res.status(500).json({ error: 'meldung_fehlgeschlagen' });
  }

  const chats = await vereinsChats(sb);
  if (chats.length === 0) return res.status(200).json({ ok: true, sent: 0, note: 'no chats subscribed' });

  const results = await tgBroadcast(token, 'sendMessage', chats, (chat_id) => ({
    chat_id, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true },
  }));
  const sent = results.filter((r) => r.ok).length;
  return res.status(200).json({ ok: true, sent, total: chats.length });
}
