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
import { renderInviteEmail, renderWelcomeEmail, renderMagicLinkEmail } from './_email_templates.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? '');
  try {
    switch (action) {
      case 'send-invite':       return await handleSendInvite(req, res);
      case 'test-connection':   return await handleTestConnection(req, res);
      case 'send-welcome':      return await handleSendWelcome(req, res);
      case 'magic-link':        return await handleMagicLink(req, res);
      case 'calendar':          return await handleCalendarFeed(req, res);
      default:
        return res.status(400).json({ error: 'unknown action', actions: ['send-invite', 'test-connection', 'send-welcome', 'magic-link', 'calendar'] });
    }
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(500).json({ error: msg });
  }
}

// ─── calendar (public iCal-Feed via Token) ───────────────────────────────
async function handleCalendarFeed(req: VercelRequest, res: VercelResponse) {
  const token = String(req.query.token ?? '');
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

// ─── magic-link (öffentlich, keine Auth nötig) ───────────────────────────
// Generiert via Supabase Admin-API einen Magic-Link UND versendet ihn
// selbst über info@sauna-fds.de mit eigenem Schwarzwald-Template.
async function handleMagicLink(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { email, redirect_to, invite_code } = req.body as {
    email: string;
    redirect_to?: string;
    invite_code?: string;
  };
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'valid email required' });

  const svc = makeServiceClient();

  // Prüfen ob User existiert — entscheidet ob magiclink (für Existing) oder invite (für Neue)
  const { data: existingUser } = await svc.auth.admin.listUsers();
  const userExists = existingUser?.users.some((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? false;

  const origin = process.env.PUBLIC_APP_URL ?? 'https://saunascaner.vercel.app';
  const redirectTo = redirect_to ?? `${origin}/planner`;

  // Magic-Link generieren (KEIN Auto-Send durch Supabase!)
  const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
    type: userExists ? 'magiclink' : 'signup',
    email,
    password: !userExists ? cryptoRandomPassword() : undefined,
    options: {
      redirectTo,
      data: invite_code ? { invite_code: invite_code.toUpperCase() } : undefined,
    },
  });
  if (linkErr || !linkData?.properties?.action_link) {
    return res.status(500).json({ error: linkErr?.message ?? 'could not generate link' });
  }

  const brand = await getBrandSettings(svc);
  const { html, text, subject } = renderMagicLinkEmail({
    magicLink: linkData.properties.action_link,
    isSignup: !userExists,
    brand,
  });

  try {
    await sendSystemMail({ to: email, subject, html, text });
  } catch (e) {
    return res.status(500).json({ error: 'send failed: ' + (e as Error).message });
  }

  return res.status(200).json({ ok: true, is_signup: !userExists });
}

function cryptoRandomPassword(): string {
  // 24-Zeichen Zufalls-Passwort für Neu-User. User braucht es nie zu sehen — Login geht via Magic-Link.
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!#=*';
  const bytes = new Uint8Array(24);
  // @ts-expect-error — Node 18+ hat globalThis.crypto
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes).map((n) => charset[n % charset.length]).join('');
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

  // Erfolgreich versendet — invitations.sent_* setzen, log_email_send schreiben
  await auth.service.rpc('mark_invitation_sent', {
    p_invitation_id: invitation_id,
    p_recipient_email: recipient_email,
    p_via: sentVia,
  });
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
