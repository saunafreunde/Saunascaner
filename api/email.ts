// Single-Endpoint für System-Mail-Aktionen (Stufe 1+2).
// Routing via ?action=... Query-Param oder POST-Body.field
// Aktionen:
//   POST  /api/email?action=send-invite       — Invite-Email versenden (Admin)
//   POST  /api/email?action=test-connection   — IMAP+SMTP-Login-Test (Admin)
//   POST  /api/email?action=send-welcome      — Welcome-Mail (Admin oder System)
//
// Stufe 3 (Postfach: Inbox/Send/Read/etc) liegt in /api/postfach.ts, weil
// dort die schwergewichtigen IMAP-Deps (imapflow) gebraucht werden.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { authenticate } from './_auth.js';
import {
  sendSystemMail,
  sendFromAdmin,
  makeServiceClient,
  logEmailSend,
  getBrandSettings,
} from './_email_helpers.js';
import { renderInviteEmail, renderWelcomeEmail, renderMagicLinkEmail, renderSetPasswordEmail } from './_email_templates.js';
import { drosselBuchen, emailSchluessel, ipSchluessel, ohneAdressen } from './_schutz.js';
import { queryParam } from './_query.js';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(queryParam(req, 'action') ?? '');
  try {
    switch (action) {
      case 'send-invite':       return await handleSendInvite(req, res);
      case 'test-connection':   return await handleTestConnection(req, res);
      case 'send-welcome':      return await handleSendWelcome(req, res);
      case 'magic-link':        return await handleMagicLink(req, res);
      case 'reset-link':        return await handleResetLink(req, res);
      case 'send-set-password': return await handleSendSetPassword(req, res);
      case 'calendar':          return await handleCalendarFeed(req, res);
      case 'send-handbook':     return await handleSendHandbook(req, res);
      default:
        return res.status(400).json({ error: 'unknown action', actions: ['send-invite', 'test-connection', 'send-welcome', 'magic-link', 'reset-link', 'send-set-password', 'calendar', 'send-handbook'] });
    }
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(500).json({ error: msg });
  }
}

// ─── send-handbook (Admin schickt Handbuch-Link an Empfänger) ───────────
async function handleSendHandbook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const auth = await authenticate(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (auth.member.role !== 'admin') return res.status(403).json({ error: 'admin only' });

  const { recipients, audience } = req.body as {
    recipients?: string[];
    audience?: 'all' | 'aufgieser' | 'admins';
  };

  // Empfänger zusammenstellen
  let targetEmails: string[] = [];
  if (Array.isArray(recipients) && recipients.length > 0) {
    targetEmails = recipients.filter((e) => /\S+@\S+\.\S+/.test(e));
  } else if (audience) {
    let query = auth.service.from('members').select('email').not('email', 'is', null).eq('approved', true).is('revoked_at', null);
    if (audience === 'aufgieser') query = query.or('is_aufgieser.eq.true,role.eq.guest_aufgieser');
    if (audience === 'admins') query = query.eq('role', 'admin');
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    targetEmails = (data ?? []).map((m) => m.email as string).filter(Boolean);
  }

  if (targetEmails.length === 0) return res.status(400).json({ error: 'no recipients' });

  const brand = await getBrandSettings(auth.service);
  const origin = process.env.PUBLIC_APP_URL ?? 'https://saunascaner.vercel.app';
  const handbookUrl = `${origin}/hilfe`;
  const subject = `📖 Mitglieder-Handbuch — ${brand.org.short_name}`;

  // Einfaches HTML-Mail via wrap-Template-Stil (inline, keine eigene Render-Funktion)
  const COLORS = { bg: '#0a1810', panel: '#0f2418', panelLight: '#16321f', textPrimary: '#e8f5e8', textSecondary: '#a8c8a8', accent: '#fbbf24', accentDark: '#7c4a1a' };
  const logoUrl = brand.logo.icon
    ? `${process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL}/storage/v1/object/public/assets/${brand.logo.icon}`
    : 'https://saunascaner.vercel.app/icons/icon-512.png';

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8" /><title>${subject}</title></head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,Segoe UI,sans-serif;color:${COLORS.textPrimary};">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:32px 16px;"><tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:${COLORS.panel};border-radius:16px;overflow:hidden;border:1px solid ${COLORS.accentDark}33;">
<tr><td style="background:linear-gradient(135deg,#1a2f1f 0%,#0f2418 100%);padding:36px 32px 28px;text-align:center;border-bottom:2px solid ${COLORS.accent}33;">
<img src="${logoUrl}" width="120" height="120" alt="${brand.org.name}" style="display:block;margin:0 auto 12px;width:120px;height:120px;object-fit:contain;border-radius:24px;" />
<h1 style="margin:0;font-size:24px;color:${COLORS.accent};font-weight:800;">${brand.org.short_name}</h1>
</td></tr>
<tr><td style="padding:32px;">
<h2 style="margin:0 0 16px;font-size:22px;color:${COLORS.textPrimary};">📖 Das Mitglieder-Handbuch</h2>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
Liebe Saunafreunde, wir haben das komplette Handbuch zu unserer App für euch zusammengestellt. Vom Anmelden über Aufguss-Planung bis zum WM-Tipspiel — alles auf einer Seite, immer aktuell.
</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto;">
<tr><td style="background:${COLORS.accent};border-radius:12px;"><a href="${handbookUrl}" style="display:inline-block;padding:14px 32px;color:${COLORS.bg};text-decoration:none;font-weight:700;font-size:15px;">📖 Handbuch öffnen</a></td></tr>
</table>
<p style="margin:24px 0 0;font-size:13px;color:${COLORS.textSecondary};line-height:1.6;">
Im Handbuch findest du u.a.: Anmelden mit Login-Link · Aufgüsse planen · Stamm-Slots beantragen · Mitglieder-Galerie · WM-Tipspiel · Kalender-Abo · Telegram-Bot · und vieles mehr.
</p>
</td></tr>
<tr><td style="background:${COLORS.panelLight};padding:20px 32px;text-align:center;border-top:1px solid ${COLORS.accentDark}33;">
<p style="margin:0 0 4px;font-size:12px;color:${COLORS.textPrimary};font-weight:600;">${brand.org.name}</p>
<p style="margin:0;font-size:11px;color:${COLORS.textSecondary};">${brand.org.location}${brand.org.contact_email ? ` &middot; <a href="mailto:${brand.org.contact_email}" style="color:${COLORS.accent};text-decoration:none;">${brand.org.contact_email}</a>` : ''}</p>
</td></tr>
</table></td></tr></table></body></html>`;

  const text = `📖 Mitglieder-Handbuch — ${brand.org.short_name}\n\nDas komplette Handbuch zu unserer App:\n${handbookUrl}\n\n— ${brand.org.name}`;

  const results = await Promise.allSettled(
    targetEmails.map((to) => sendSystemMail({ to, subject, html, text }))
  );
  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - sent;

  await logEmailSend(auth.service, {
    recipient: `${sent} Empfänger`,
    subject,
    templateName: 'handbook',
    status: failed === 0 ? 'sent' : 'failed',
    error: failed > 0 ? `${failed} failed` : undefined,
    senderEmail: process.env.SAUNA_SMTP_USER,
    senderMemberId: auth.member.id,
  });

  return res.status(200).json({ ok: true, sent, failed, recipient_count: targetEmails.length });
}

// ─── calendar (public iCal-Feed via Token) ───────────────────────────────
async function handleCalendarFeed(req: VercelRequest, res: VercelResponse) {
  const token = String(queryParam(req, 'token') ?? '');
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(400).send('Invalid token');
  }

  const svc = makeServiceClient();
  const { data: memberRows } = await svc.rpc('get_calendar_member_by_token', { p_token: token });
  const member = Array.isArray(memberRows) ? memberRows[0] : memberRows;
  if (!member) {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(404).send('Token not found or revoked');
  }

  const { data: events } = await svc.rpc('get_member_calendar_events', { p_member_id: member.member_id });
  const list = (events ?? []) as Array<{
    id: string; sauna_name: string; sauna_temp: string;
    title: string; description: string | null;
    start_time: string; end_time: string;
    team_infusion: boolean; is_co_aufgieser: boolean; is_personal_fallback: boolean;
  }>;

  const ics = buildICS(list, member.member_name);
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="saunafreunde.ics"');
  res.setHeader('Cache-Control', 'private, max-age=300'); // 5 Min Cache
  return res.status(200).send(ics);
}

function buildICS(events: Array<{
  id: string; sauna_name: string; sauna_temp: string;
  title: string; description: string | null;
  start_time: string; end_time: string;
  team_infusion: boolean; is_co_aufgieser: boolean; is_personal_fallback: boolean;
}>, memberName: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const Y = d.getUTCFullYear();
    const M = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    const s = String(d.getUTCSeconds()).padStart(2, '0');
    return `${Y}${M}${D}T${h}${m}${s}Z`;
  };
  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Saunafreunde Schwarzwald//Saunascaner//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Saunafreunde — ${escape(memberName)}`,
    'X-WR-CALDESC:Deine Aufgüsse bei Saunafreunde Schwarzwald',
    'X-WR-TIMEZONE:Europe/Berlin',
  ];

  for (const e of events) {
    const role = e.is_co_aufgieser ? '👥 Co-Aufgießer' : e.is_personal_fallback ? '👨‍🍳 Personal' : e.team_infusion ? '🧖 Aufgießer (Team)' : '🧖 Aufgießer';
    const summary = `${e.title} — ${e.sauna_name} ${e.sauna_temp}`;
    const description = `${role}\\nSauna: ${e.sauna_name} (${e.sauna_temp})${e.description ? '\\n\\n' + escape(e.description) : ''}`;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.id}@saunascaner.vercel.app`);
    lines.push(`DTSTAMP:${fmt(new Date().toISOString())}`);
    lines.push(`DTSTART:${fmt(e.start_time)}`);
    lines.push(`DTEND:${fmt(e.end_time)}`);
    lines.push(`SUMMARY:${escape(summary)}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push(`LOCATION:Saunafreunde Schwarzwald, Freudenstadt`);
    lines.push(`URL:https://saunascaner.vercel.app/planner`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// ─── Bremse für Mails an frei eingegebene Adressen (Audit 25.09.2026, 0189) ─
// magic-link und reset-link verschicken ohne Anmeldung Mails von
// info@sauna-fds.de an eine frei eingegebene Adresse. Vorher ungebremst
// (Mail-Bombing, Sperrlisten-Gefahr für die Vereinsdomain). Jetzt Grenzen in
// der Datenbank: je IP (jede Anfrage), je Adresse (nur als sha256) und für
// alle zusammen. Ist die ADRESSE voll, kommt dieselbe Antwort wie beim
// Versand — sonst ließe sich abfragen, wer ein Konto hat.
//
// Audit-Runde 2 (25.09.2026, 0194): Der gemeinsame Topf ('alle', 60/h) wurde
// für JEDE Anfrage gebucht, auch für Fantasie-Adressen ohne Konto, an die gar
// keine Mail ging. 60 Anfragen von zwei IPs sperrten damit „Passwort
// vergessen“ und die QR-Gast-Anmeldung für alle eine Stunde lang. Jetzt:
//  * Stufe 1 (jede Anfrage): nur der Topf je IP — IPv6 je /64-Präfix
//    (ipSchluessel), sonst hätte ein einziger Anschluss beliebig viele Töpfe.
//    Dabei merkt sich die Bremse, ob die IP in dieser Stunde noch unauffällig
//    ist (höchstens 3 Anfragen).
//  * Stufe 2 erst, wenn feststeht, dass wirklich eine Mail rausgeht: der
//    gemeinsame Topf und der Topf je Adresse. Der gemeinsame Topf ist für
//    unauffällige IPs nur noch eine Notbremse (300/h); nur IPs, die in dieser
//    Stunde schon mehr als 3 Anfragen geschickt haben, stoßen bei 60/h an.
//    Wer den Topf mit Zufallsadressen füllt, bremst damit andere Vielsender —
//    eine normale Einzelperson erst bei 300 Mails in der Stunde.
//  * „Passwort vergessen“ für eine unbekannte Adresse bucht nur Stufe 1 und
//    ruft generateLink gar nicht erst auf. Die Antwort bleibt dieselbe wie
//    bei einem echten Konto (auch „zu viele“ nur, wenn der gemeinsame Topf
//    voll ist) — sonst ließe sich abfragen, wer ein Konto hat.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAIL_IP_STUNDE = 30;     // wie die Tablet-Anmeldung: Vereins-WLAN am Saunafest
const MAIL_IP_UNAUFFAELLIG = 3; // die ersten 3 Anfragen einer IP je Stunde
const MAIL_ADR_STUNDE = 3;
const MAIL_ADR_TAG = 8;
const MAIL_ALLE_VIELSENDER_STUNDE = 60; // gemeinsamer Topf für auffällige IPs
const MAIL_ALLE_NOTBREMSE_STUNDE = 300; // gemeinsamer Topf für alle anderen
const ZU_VIELE_MAILS = 'Gerade kommen sehr viele Anfragen an – bitte in einer Stunde noch einmal versuchen.';

type MailBremse = 'frei' | 'zu_viele' | 'adresse_voll';
type MailIpStufe = { zuViele: boolean; unauffaellig: boolean };

function mailAlleMax(ipStufe: MailIpStufe): number {
  return ipStufe.unauffaellig ? MAIL_ALLE_NOTBREMSE_STUNDE : MAIL_ALLE_VIELSENDER_STUNDE;
}

/** Stufe 1: Topf je IP (jede Anfrage). Merkt sich zusätzlich, ob die IP in
 *  dieser Stunde noch unauffällig ist (höchstens 3 Anfragen). */
async function mailBremseIp(svc: SupabaseClient, req: VercelRequest): Promise<MailIpStufe> {
  const ip = ipSchluessel(req);
  const r = await drosselBuchen(svc, 'mail', [{ schluessel: 'ip:' + ip, max: MAIL_IP_STUNDE, fensterS: 3600 }]);
  // Datenbankfehler (oder 0189 noch nicht eingespielt): durchlassen wie bisher —
  // Login- und Passwort-Links sind wichtiger als die Bremse.
  if (r === null) return { zuViele: false, unauffaellig: true };
  if (r !== 0) return { zuViele: true, unauffaellig: false };
  const f = await drosselBuchen(svc, 'mail', [{ schluessel: 'ipf:' + ip, max: MAIL_IP_UNAUFFAELLIG, fensterS: 3600 }]);
  return { zuViele: false, unauffaellig: f === null || f === 0 };
}

/** Stufe 2: gemeinsamer Topf + Topf je Adresse — erst, wenn wirklich eine Mail
 *  rausgeht. Der gemeinsame Topf steht vorn: ist er voll, lautet die Antwort
 *  „zu viele“, egal ob die Adresse ein Konto hat (kein Konten-Orakel). */
async function mailBremseAdresse(svc: SupabaseClient, email: string, ipStufe: MailIpStufe): Promise<MailBremse> {
  const adr = 'adr:' + emailSchluessel(email);
  const r = await drosselBuchen(svc, 'mail', [
    { schluessel: 'alle', max: mailAlleMax(ipStufe), fensterS: 3600 },
    { schluessel: adr, max: MAIL_ADR_STUNDE, fensterS: 3600 },
    { schluessel: adr, max: MAIL_ADR_TAG, fensterS: 86400 },
  ]);
  if (r === null || r === 0) return 'frei';
  return r === 1 ? 'zu_viele' : 'adresse_voll';
}

/** Ist der gemeinsame Topf für diese IP gerade voll? Nur prüfen, nichts buchen
 *  (für Anfragen, bei denen keine Mail rausgeht). Datenbankfehler: nein. */
async function mailAlleVoll(svc: SupabaseClient, ipStufe: MailIpStufe): Promise<boolean> {
  const { data, error } = await svc.rpc('kiosk_gesperrt', {
    p_art: 'mail', p_schluessel: 'alle', p_max: mailAlleMax(ipStufe), p_fenster_sekunden: 3600,
  });
  if (error) {
    console.error('[email] kiosk_gesperrt fehlgeschlagen', error.code ?? '');
    return false;
  }
  return data === true;
}

/** E-Mail aus dem Body: getrimmt, klein, plausibel — sonst null. */
function emailAusBody(v: unknown): string | null {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return EMAIL_RE.test(e) && e.length <= 254 ? e : null;
}

/** Kurzer Freitext aus dem Body (Name, Herkunft): ohne Steuerzeichen, gekappt. */
function textAusBody(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const t = v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
  return t || null;
}

/** redirect_to nur auf die eigene App und bekannte Pfade — der Link in der Mail
 *  darf nie woanders hinführen (vorher ungeprüft an GoTrue durchgereicht). */
function sicherRedirect(raw: unknown, pfade: string[], standardPfad: string): string {
  const app = (process.env.PUBLIC_APP_URL ?? 'https://saunascaner.vercel.app').replace(/\/+$/, '');
  const erlaubt = new Set(['https://app.sauna-fds.de', 'https://saunascaner.vercel.app']);
  try { erlaubt.add(new URL(app).origin); } catch { /* PUBLIC_APP_URL kaputt → nur die festen */ }
  if (typeof raw === 'string') {
    try {
      const u = new URL(raw);
      if (erlaubt.has(u.origin) && pfade.includes(u.pathname)) return u.origin + u.pathname;
    } catch { /* ungültig → Standard */ }
  }
  return app + standardPfad;
}

// ─── magic-link (öffentlich, keine Auth nötig) ───────────────────────────
// Generiert via Supabase Admin-API einen Magic-Link UND versendet ihn
// selbst über info@sauna-fds.de mit eigenem Schwarzwald-Template.
// Einziger Aufrufer: GastSignup (QR-Plakate). Seit 25.09.2026:
//  * gebremst (mailBremseIp/mailBremseAdresse), Antwort immer { ok: true } — ob die Adresse
//    schon ein Konto hat, verrät sie nicht mehr (vorher is_signup);
//  * bei einer neuen Adresse entsteht nur der Anmelde-Datensatz; das
//    Mitglieds-Konto (PIN, Freigabe, Einwilligung) legt handle_new_user erst
//    an, wenn die Person den Link anklickt (Migration 0189);
//  * keine Einladungs-Codes mehr über diesen öffentlichen Weg (Einladungen
//    laufen über /login), Freitexte gekürzt.
async function handleMagicLink(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = (req.body ?? {}) as Record<string, unknown>;
  const email = emailAusBody(b.email);
  if (!email) return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse eingeben.' });

  const svc = makeServiceClient();
  const ipStufe = await mailBremseIp(svc, req);
  if (ipStufe.zuViele) return res.status(429).json({ error: ZU_VIELE_MAILS });

  // Gibt es die Adresse schon? listUsers ist paginiert (Default 50!) — ohne
  // Loop würde ab User 51 jeder Bestands-User fälschlich als neu gelten.
  // (Nur lesen — deshalb vor der Adress-Bremse, die davon abhängt.)
  let vorhanden: User | undefined;
  for (let page = 1; page <= 40; page++) {
    const { data: userPage, error: listErr } = await svc.auth.admin.listUsers({ page, perPage: 500 });
    if (listErr) {
      console.error('[magic-link] listUsers fehlgeschlagen', listErr.status ?? '', ohneAdressen(listErr.message));
      return res.status(500).json({ error: 'Der Link konnte gerade nicht erstellt werden. Bitte später noch einmal versuchen.' });
    }
    const users = userPage?.users ?? [];
    vorhanden = users.find((u) => u.email?.toLowerCase() === email);
    if (vorhanden || users.length < 500) break;
  }

  // Hier geht in jedem Fall eine Mail raus (Anmelde- bzw. Login-Link).
  const bremse = await mailBremseAdresse(svc, email, ipStufe);
  if (bremse === 'zu_viele') return res.status(429).json({ error: ZU_VIELE_MAILS });
  if (bremse === 'adresse_voll') return res.status(200).json({ ok: true });

  const redirectTo = sicherRedirect(b.redirect_to, ['/gast', '/planner'], '/planner');

  // Metadaten für handle_new_user — nur, was GastSignup schickt, gekürzt.
  const istGast = b.signup_kind === 'gast';
  const herkunft = textAusBody(b.gast_origin, 20);
  const meta: Record<string, string | null> = {
    name: textAusBody(b.name, 80),
    signup_kind: istGast ? 'gast' : null,
    gast_referral: istGast ? textAusBody(b.gast_referral, 80) : null,
    gast_origin: istGast ? (herkunft && /^[a-z0-9_]+$/.test(herkunft) && herkunft !== 'tablet_signup' ? herkunft : 'qr') : null,
    // Welche Fassung der Datenschutzhinweise GastSignup gezeigt hat (0186:
    // ein Trigger auf members übernimmt sie beim Anlegen des Kontos).
    datenschutz_fassung: istGast && typeof b.datenschutz_fassung === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.datenschutz_fassung)
      ? b.datenschutz_fassung : null,
  };

  // Schon angelegt, aber nie bestätigt? Die Adresse ist dann nie nachgewiesen:
  //  * Passwort immer neu würfeln — sonst hätte, wer die offene Anmeldung mit
  //    einer fremden Adresse angelegt hat, nach dem Klick der echten Person auf
  //    diesen Link ein bestätigtes Konto mit SEINEM Passwort.
  //  * Angaben nur bei einer offenen Gast-Anmeldung ohne Einladung ersetzen
  //    (die jüngste Anfrage gilt, nicht die eines Fremden). Eine offene
  //    Registrierung über /login samt Einladungs-Code bleibt, wie sie ist.
  if (vorhanden && !vorhanden.email_confirmed_at) {
    const alt = (vorhanden.user_metadata ?? {}) as Record<string, unknown>;
    const offeneGastAnmeldung = alt.signup_kind === 'gast' && !alt.invite_code;
    const { error: updErr } = await svc.auth.admin.updateUserById(vorhanden.id, {
      password: cryptoRandomPassword(),
      ...(offeneGastAnmeldung && istGast ? { user_metadata: { ...meta, invite_code: null } } : {}),
    });
    if (updErr) {
      console.error('[magic-link] offene Anmeldung nicht aktualisiert', updErr.status ?? '', ohneAdressen(updErr.message));
      return res.status(500).json({ error: 'Der Link konnte gerade nicht erstellt werden. Bitte später noch einmal versuchen.' });
    }
  }

  // Magic-Link generieren (KEIN Auto-Send durch Supabase!)
  // Discriminated union: 'signup' braucht password, 'magiclink' nicht.
  const neueDaten = Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== null)) as Record<string, string>;
  const { data: linkData, error: linkErr } = vorhanden
    ? await svc.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })
    : await svc.auth.admin.generateLink({
        type: 'signup',
        email,
        password: cryptoRandomPassword(),
        options: { redirectTo, data: Object.keys(neueDaten).length > 0 ? neueDaten : undefined },
      });
  if (linkErr || !linkData?.properties?.action_link) {
    console.error('[magic-link] generateLink fehlgeschlagen', linkErr?.status ?? '', ohneAdressen(linkErr?.message ?? 'kein action_link'));
    return res.status(500).json({ error: 'Der Link konnte gerade nicht erstellt werden. Bitte später noch einmal versuchen.' });
  }

  const brand = await getBrandSettings(svc);
  const { html, text, subject } = renderMagicLinkEmail({
    magicLink: linkData.properties.action_link,
    isSignup: !vorhanden || !vorhanden.email_confirmed_at,
    brand,
  });

  try {
    await sendSystemMail({ to: email, subject, html, text });
  } catch (e) {
    console.error('[magic-link] Versand fehlgeschlagen', ohneAdressen((e as Error).message));
    return res.status(500).json({ error: 'Die Mail konnte gerade nicht verschickt werden. Bitte später noch einmal versuchen.' });
  }

  return res.status(200).json({ ok: true });
}

function cryptoRandomPassword(): string {
  // 24-Zeichen Zufalls-Passwort für Neu-User. User braucht es nie zu sehen — Login geht via Magic-Link.
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!#=*';
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes).map((n) => charset[n % charset.length]).join('');
}

// ─── reset-link (öffentlich, Self-Service „Passwort vergessen") ──────────
// Generiert einen Recovery-Link via Admin-API und verschickt ihn über den
// EIGENEN Mailer (info@sauna-fds.de) — gleiche zuverlässige Zustellung wie
// beim Magic-Link. Antwortet IMMER generisch (kein User-Enumeration-Leak).
// Seit 25.09.2026 gebremst wie magic-link (mailBremseIp/mailBremseAdresse) und ohne E-Mail-Adresse
// im Server-Log (vorher landete jede Tippfehler-Adresse im Klartext bei Vercel).
async function handleResetLink(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = (req.body ?? {}) as Record<string, unknown>;
  const email = emailAusBody(b.email);
  if (!email) return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse eingeben.' });

  const svc = makeServiceClient();
  const ipStufe = await mailBremseIp(svc, req);
  if (ipStufe.zuViele) return res.status(429).json({ error: ZU_VIELE_MAILS });

  // Gibt es ein Konto? Nur lesen (0194) — generateLink legt bei JEDEM Aufruf
  // ein neues Token an und entwertet damit den zuletzt verschickten Link; es
  // darf deshalb erst nach der Adress-Bremse laufen. Unbekannte Adresse:
  // keine Mail, kein Eintrag in Adress- oder Gesamt-Topf — und dieselbe
  // Antwort wie bei einem Konto (429 nur, wenn der gemeinsame Topf voll ist).
  // Schlägt die Abfrage fehl (z. B. 0194 fehlt), wie bisher weiter.
  const { data: kontoStatus, error: kontoErr } = await svc.rpc('api_mail_konto_status', { p_email: email });
  if (kontoErr) console.error('[reset-link] api_mail_konto_status fehlgeschlagen', kontoErr.code ?? '');
  if (!kontoErr && kontoStatus === 'unbekannt') {
    if (await mailAlleVoll(svc, ipStufe)) return res.status(429).json({ error: ZU_VIELE_MAILS });
    return res.status(200).json({ ok: true });
  }

  const bremse = await mailBremseAdresse(svc, email, ipStufe);
  if (bremse === 'zu_viele') return res.status(429).json({ error: ZU_VIELE_MAILS });
  if (bremse === 'adresse_voll') return res.status(200).json({ ok: true });

  const redirectTo = sicherRedirect(b.redirect_to, ['/reset-password'], '/reset-password');

  try {
    const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
      type: 'recovery', email, options: { redirectTo },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      // Unbekannte E-Mail o.ä. → generisch OK antworten (kein Leak). Ins Log nur
      // der Fehlercode, nie die Adresse.
      console.warn('[reset-link] kein Link erzeugt', linkErr?.status ?? '', ohneAdressen(linkErr?.message ?? 'kein action_link'));
      return res.status(200).json({ ok: true });
    }
    const brand = await getBrandSettings(svc);
    const { html, text, subject } = renderSetPasswordEmail({
      resetLink: linkData.properties.action_link,
      isProactive: false,
      brand,
    });
    await sendSystemMail({ to: email, subject, html, text });
  } catch (e) {
    // Fehler trotzdem generisch behandeln (kein Enumeration-Leak), aber loggen —
    // ohne Adresse (nodemailer nennt sie teils in der Meldung).
    console.error('[reset-link] Versand fehlgeschlagen', ohneAdressen((e as Error).message));
  }
  return res.status(200).json({ ok: true });
}

// ─── send-set-password (Admin-Broadcast: Umstellung Magic-Link → Passwort) ─
// Schickt allen ausgewählten Mitgliedern einen „Passwort festlegen"-Link
// (Recovery-Link via Admin-API) über den eigenen Mailer. Für die einmalige
// Umstellung auf Passwort-Login.
async function handleSendSetPassword(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const auth = await authenticate(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (auth.member.role !== 'admin') return res.status(403).json({ error: 'admin only' });

  const { recipients, audience } = req.body as {
    recipients?: string[];
    audience?: 'all' | 'aufgieser' | 'admins';
  };

  // Zielgruppe zusammenstellen (email + name)
  let targets: { email: string; name: string | null }[] = [];
  if (Array.isArray(recipients) && recipients.length > 0) {
    const wanted = recipients.filter((e) => /\S+@\S+\.\S+/.test(e)).map((e) => e.toLowerCase());
    const { data } = await auth.service.from('members').select('email, name').not('email', 'is', null);
    const byEmail = new Map((data ?? []).map((m) => [String(m.email).toLowerCase(), (m.name as string | null) ?? null]));
    targets = wanted.map((e) => ({ email: e, name: byEmail.get(e) ?? null }));
  } else if (audience) {
    let query = auth.service.from('members').select('email, name').not('email', 'is', null).eq('approved', true).is('revoked_at', null);
    if (audience === 'aufgieser') query = query.or('is_aufgieser.eq.true,role.eq.guest_aufgieser');
    if (audience === 'admins') query = query.eq('role', 'admin');
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    targets = (data ?? [])
      .map((m) => ({ email: m.email as string, name: (m.name as string | null) ?? null }))
      .filter((t) => t.email);
  }
  if (targets.length === 0) return res.status(400).json({ error: 'no recipients' });

  const svc = makeServiceClient();
  const origin = process.env.PUBLIC_APP_URL ?? 'https://saunascaner.vercel.app';
  const redirectTo = `${origin}/reset-password`;
  const brand = await getBrandSettings(svc);

  const results = await Promise.allSettled(
    targets.map(async (t) => {
      const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
        type: 'recovery', email: t.email, options: { redirectTo },
      });
      if (linkErr || !linkData?.properties?.action_link) throw new Error(linkErr?.message ?? 'link failed');
      const { html, text, subject } = renderSetPasswordEmail({
        resetLink: linkData.properties.action_link,
        recipientName: t.name ?? undefined,
        isProactive: true,
        brand,
      });
      await sendSystemMail({ to: t.email, subject, html, text });
    })
  );
  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - sent;

  await logEmailSend(auth.service, {
    recipient: `${sent} Empfänger`,
    subject: 'Passwort festlegen (Umstellung)',
    templateName: 'set-password',
    status: failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'sent',
    error: failed > 0 ? `${failed} failed` : undefined,
    senderEmail: process.env.SAUNA_SMTP_USER,
    senderMemberId: auth.member.id,
  });

  return res.status(200).json({ ok: true, sent, failed, recipient_count: targets.length });
}

// ─── send-invite ──────────────────────────────────────────────────────────
async function handleSendInvite(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const auth = await authenticate(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (auth.member.role !== 'admin') return res.status(403).json({ error: 'admin only' });

  const { invitation_id, recipient_email, recipient_name } = req.body as {
    invitation_id: string;
    recipient_email: string;
    recipient_name?: string;
  };
  if (!invitation_id || !recipient_email) {
    return res.status(400).json({ error: 'invitation_id + recipient_email required' });
  }

  // Invitation aus DB holen (via service client → keine RLS-Sorgen)
  const { data: inv, error: invErr } = await auth.service
    .from('invitations')
    .select('id, code, target_role, target_is_aufgieser, note, used_by, expires_at')
    .eq('id', invitation_id)
    .maybeSingle();
  if (invErr || !inv) return res.status(404).json({ error: 'invitation not found' });
  if (inv.used_by) return res.status(400).json({ error: 'invitation already used' });
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
    return res.status(400).json({ error: 'invitation expired' });
  }

  // Admin-Name + Email
  const { data: admin } = await auth.service
    .from('members')
    .select('name, email')
    .eq('id', auth.member.id)
    .maybeSingle();
  const adminName = admin?.name ?? 'ein Admin';
  const adminReplyTo = admin?.email ?? undefined;

  // Origin für Link
  const origin = process.env.PUBLIC_APP_URL ?? 'https://saunascaner.vercel.app';
  const inviteLink = `${origin}/login?invite=${encodeURIComponent(inv.code)}`;

  // Template rendern
  const brand = await getBrandSettings(auth.service);
  const { html, text, subject } = renderInviteEmail({
    recipientName: recipient_name,
    inviteLink,
    inviteCode: inv.code,
    targetRole: inv.target_role as string,
    targetIsAufgieser: !!inv.target_is_aufgieser,
    adminName,
    note: inv.note ?? undefined,
    brand,
  });

  // Versuche zunächst im Namen des Admins zu senden (falls Postfach vorhanden)
  let sentVia: 'admin_account' | 'system_fallback' = 'system_fallback';
  let senderEmail = process.env.SAUNA_SMTP_USER ?? 'info@sauna-fds.de';

  try {
    const adminSend = await sendFromAdmin(auth.service, auth.member.id, {
      to: recipient_email, subject, html, text,
    });
    if (adminSend) {
      sentVia = 'admin_account';
      senderEmail = adminSend.fromEmail;
    } else {
      // Fallback: System-Mail mit Reply-To auf Admin
      await sendSystemMail({
        to: recipient_email, subject, html, text,
        replyTo: adminReplyTo,
      });
    }
  } catch (err) {
    // Mail-Versand fehlgeschlagen — loggen + Fehler an Client
    await logEmailSend(auth.service, {
      recipient: recipient_email,
      subject,
      templateName: 'invite',
      status: 'failed',
      error: (err as Error).message,
      invitationId: invitation_id,
      senderEmail,
      senderMemberId: auth.member.id,
    });
    return res.status(500).json({ error: 'send failed: ' + (err as Error).message });
  }

  // Erfolgreich versendet — invitations.sent_* setzen, log_email_send schreiben.
  // mark_invitation_sent ist seit 0187 nur für service_role; der Absender kommt
  // als Parameter (vorher per auth.uid() — beim Service-Client NULL, die
  // Funktion warf still 'not_admin', und keine Einladung stand je als gesendet).
  // Die Admin-Prüfung steht oben in diesem Handler.
  const { error: markErr } = await auth.service.rpc('mark_invitation_sent', {
    p_invitation_id: invitation_id,
    p_recipient_email: recipient_email,
    p_via: sentVia,
    p_sender_member_id: auth.member.id,
  });
  // Die Mail ist schon raus — nur protokollieren, nicht abbrechen.
  if (markErr) console.error('[invite] mark_invitation_sent fehlgeschlagen:', markErr.code, markErr.message);
  await logEmailSend(auth.service, {
    recipient: recipient_email,
    subject,
    templateName: 'invite',
    status: 'sent',
    invitationId: invitation_id,
    senderEmail,
    senderMemberId: auth.member.id,
  });

  return res.status(200).json({ ok: true, sent_via: sentVia, sender_email: senderEmail });
}

// ─── test-connection ──────────────────────────────────────────────────────
// Testet IMAP+SMTP für ein konkretes member_id (Admin-Action nach grant_email_account).
async function handleTestConnection(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const auth = await authenticate(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (auth.member.role !== 'admin') return res.status(403).json({ error: 'admin only' });

  const { member_id } = req.body as { member_id: string };
  if (!member_id) return res.status(400).json({ error: 'member_id required' });

  const svc = makeServiceClient();
  const { data, error } = await svc.rpc('get_email_credentials', { p_member_id: member_id });
  if (error || !data || data.length === 0) {
    return res.status(404).json({ error: 'no email account for member' });
  }
  const cred = data[0] as { email_address: string; imap_host: string; imap_port: number; smtp_host: string; smtp_port: number; password: string };

  // IMAP-Test
  let imapOk = false;
  let imapErr: string | undefined;
  try {
    const client = new ImapFlow({
      host: cred.imap_host,
      port: cred.imap_port,
      secure: true,
      auth: { user: cred.email_address, pass: cred.password },
      logger: false,
    });
    await client.connect();
    await client.logout();
    imapOk = true;
  } catch (e) { imapErr = (e as Error).message; }

  // SMTP-Test
  let smtpOk = false;
  let smtpErr: string | undefined;
  try {
    const t = nodemailer.createTransport({
      host: cred.smtp_host, port: cred.smtp_port, secure: cred.smtp_port === 465,
      auth: { user: cred.email_address, pass: cred.password },
      connectionTimeout: 15_000,
    });
    await t.verify();
    smtpOk = true;
  } catch (e) { smtpErr = (e as Error).message; }

  return res.status(200).json({
    ok: imapOk && smtpOk,
    imap: { ok: imapOk, error: imapErr },
    smtp: { ok: smtpOk, error: smtpErr },
    email: cred.email_address,
  });
}

// ─── send-welcome ─────────────────────────────────────────────────────────
async function handleSendWelcome(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const auth = await authenticate(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (auth.member.role !== 'admin') return res.status(403).json({ error: 'admin only' });

  const { member_id, role_label } = req.body as { member_id: string; role_label: string };
  if (!member_id) return res.status(400).json({ error: 'member_id required' });

  const { data: m } = await auth.service
    .from('members')
    .select('name, email')
    .eq('id', member_id)
    .maybeSingle();
  if (!m?.email) return res.status(404).json({ error: 'member or email not found' });

  const origin = process.env.PUBLIC_APP_URL ?? 'https://saunascaner.vercel.app';
  const brand = await getBrandSettings(auth.service);
  const { html, text, subject } = renderWelcomeEmail({
    recipientName: m.name,
    loginLink: `${origin}/planner`,
    roleLabel: role_label ?? 'Mitglied',
    brand,
  });

  try {
    await sendSystemMail({ to: m.email, subject, html, text });
    await logEmailSend(auth.service, {
      recipient: m.email,
      subject,
      templateName: 'welcome',
      status: 'sent',
      memberId: member_id,
      senderEmail: process.env.SAUNA_SMTP_USER,
      senderMemberId: auth.member.id,
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    await logEmailSend(auth.service, {
      recipient: m.email,
      subject,
      templateName: 'welcome',
      status: 'failed',
      error: (e as Error).message,
      memberId: member_id,
      senderMemberId: auth.member.id,
    });
    return res.status(500).json({ error: (e as Error).message });
  }
}
