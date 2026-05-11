// Server-side Helpers für Mail-Versand. Nicht für Client-Imports gedacht.
// Templates kommen aus _email_templates.ts (inline TS-Module).
import nodemailer, { type Transporter } from 'nodemailer';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ─── SMTP-Transporter ────────────────────────────────────────────────────
function makeTransporter(opts: {
  host: string; port: number; secure: boolean;
  user: string; pass: string; fromName?: string;
}): Transporter {
  // nodemailer.createTransport akzeptiert ein generisches Options-Objekt;
  // wir bauen es Schritt für Schritt um TS6133 / Type-Mismatch-Probleme
  // mit deep imports zu vermeiden.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return nodemailer.createTransport({
    host: opts.host,
    port: opts.port,
    secure: opts.secure,
    auth: { user: opts.user, pass: opts.pass },
    pool: false,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

// ─── System-Mail (info@sauna-fds.de) ─────────────────────────────────────
export async function sendSystemMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<{ messageId: string }> {
  const host = process.env.SAUNA_SMTP_HOST;
  const port = Number(process.env.SAUNA_SMTP_PORT ?? 465);
  const secure = (process.env.SAUNA_SMTP_SECURE ?? 'true') !== 'false';
  const user = process.env.SAUNA_SMTP_USER;
  const pass = process.env.SAUNA_SMTP_PASS;
  const from = process.env.SAUNA_SMTP_FROM ?? `Saunafreunde Schwarzwald <${user}>`;
  if (!host || !user || !pass) throw new Error('SMTP env missing (SAUNA_SMTP_*)');

  const transporter = makeTransporter({ host, port, secure, user, pass });
  const info = await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
  });
  return { messageId: info.messageId };
}

// ─── Mail im Namen eines Admin-Members (via dessen email_account) ───────
// Holt Credentials aus Vault über RPC get_email_credentials (service_role).
// Returnt null wenn der Admin kein Postfach hat (Caller soll fallback nutzen).
export async function sendFromAdmin(
  service: SupabaseClient,
  adminMemberId: string,
  opts: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
  }
): Promise<{ messageId: string; fromEmail: string } | null> {
  const { data, error } = await service.rpc('get_email_credentials', { p_member_id: adminMemberId });
  if (error || !data || data.length === 0) return null;
  const cred = data[0] as {
    email_address: string; smtp_host: string; smtp_port: number; password: string;
  };

  // Display-Name aus members lookup
  const { data: m } = await service
    .from('members')
    .select('name')
    .eq('id', adminMemberId)
    .maybeSingle();
  const fromName = m?.name ?? 'Saunafreunde Schwarzwald';

  const transporter = makeTransporter({
    host: cred.smtp_host,
    port: cred.smtp_port,
    secure: cred.smtp_port === 465,
    user: cred.email_address,
    pass: cred.password,
  });
  const info = await transporter.sendMail({
    from: `${fromName} <${cred.email_address}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
  });
  return { messageId: info.messageId, fromEmail: cred.email_address };
}

// ─── Service-Role-Client (nur für Server-Side) ──────────────────────────
export function makeServiceClient(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env missing');
  return createClient(url, key);
}

// ─── Log-Helper (schreibt nach email_log via RPC) ────────────────────────
export async function logEmailSend(
  service: SupabaseClient,
  p: {
    recipient: string;
    subject: string;
    templateName: string;
    status: 'sent' | 'failed';
    error?: string;
    invitationId?: string;
    memberId?: string;
    senderEmail?: string;
    senderMemberId?: string;
  }
) {
  await service.rpc('log_email_send', {
    p_recipient: p.recipient,
    p_subject: p.subject,
    p_template_name: p.templateName,
    p_status: p.status,
    p_error: p.error ?? null,
    p_related_invitation_id: p.invitationId ?? null,
    p_related_member_id: p.memberId ?? null,
    p_sender_email: p.senderEmail ?? null,
    p_sender_member_id: p.senderMemberId ?? null,
  });
}
