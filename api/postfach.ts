// Single-Endpoint für alle Postfach-Operationen (Stufe 3).
// Routing via ?action=... Param.
//
// Persönliche Mail:
//   GET   /api/postfach?action=folders                              — Ordner-Liste
//   GET   /api/postfach?action=messages&folder=INBOX&limit=50       — Header-Liste
//   GET   /api/postfach?action=message&folder=INBOX&uid=123         — Voller Body
//   GET   /api/postfach?action=attachment&folder=INBOX&uid=123&part=2 — Anhang stream
//   POST  /api/postfach?action=send                                 — SMTP-Send
//   POST  /api/postfach?action=mark    body: {folder, uid, seen}     — Flag setzen
//   POST  /api/postfach?action=move    body: {folder, uid, to}       — Verschieben
//   POST  /api/postfach?action=delete  body: {folder, uid}           — Löschen (move to Trash)
//
// Geteiltes Postfach (Migration 0080): zusätzlicher Query-Param `account=<uuid>` oder
// Body-Feld `account_id`. Backend prüft shared_email_admins-Membership.
//
// Cron-only:
//   GET /api/postfach?action=poll-shared-tickets  (Header X-Cron-Secret)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { authenticate } from './_auth.js';
import { makeServiceClient } from './_email_helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────

// Vollständige E-Mail: local@host.tld mit mind. 2-Zeichen TLD nach dem letzten Punkt.
// Akzeptiert auch das "Name <addr@host.de>"-Format aus Adressbüchern.
function isValidEmailAddress(addr: string): boolean {
  if (typeof addr !== 'string') return false;
  const stripped = addr.replace(/^.*<([^>]+)>\s*$/, '$1').trim();
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(stripped);
}

// ─── Credentials-Helper ──────────────────────────────────────────────────
type EmailCreds = {
  email_address: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  password: string;
};

async function getCredsForCurrentUser(memberId: string): Promise<EmailCreds | null> {
  const svc = makeServiceClient();
  const { data, error } = await svc.rpc('get_email_credentials', { p_member_id: memberId });
  if (error || !data || data.length === 0) return null;
  return data[0] as EmailCreds;
}

// Geteiltes Postfach (Migration 0080): Caller muss Mitglied in shared_email_admins sein.
// Wir prüfen das per RLS via Anon-Client mit User-JWT (SELECT auf shared_email_admins)
// und lesen Credentials dann via service_role.
async function getCredsForSharedAccount(
  req: VercelRequest,
  memberId: string,
  accountId: string,
): Promise<EmailCreds | null> {
  const svc = makeServiceClient();
  // Membership-Check
  const { data: memberRows, error: memberErr } = await svc
    .from('shared_email_admins')
    .select('account_id')
    .eq('account_id', accountId)
    .eq('member_id', memberId)
    .limit(1);
  if (memberErr) throw new Error(`shared_email_admin lookup failed: ${memberErr.message}`);
  if (!memberRows || memberRows.length === 0) return null;

  const { data, error } = await svc.rpc('get_shared_email_credentials', { p_account_id: accountId });
  if (error || !data || data.length === 0) return null;
  return data[0] as EmailCreds;
  // Memberid + req nur für zukünftige Audit-Logs gehalten
  void req;
}

// Account-Id aus Request lesen (query oder body)
function extractAccountId(req: VercelRequest): string | null {
  const q = (req.query.account ?? req.query.account_id) as string | undefined;
  if (q && typeof q === 'string') return q;
  const b = (req.body as { account_id?: unknown } | undefined)?.account_id;
  if (b && typeof b === 'string') return b;
  return null;
}

async function withImap<T>(
  cred: { email_address: string; imap_host: string; imap_port: number; password: string },
  fn: (client: ImapFlow) => Promise<T>
): Promise<T> {
  const client = new ImapFlow({
    host: cred.imap_host,
    port: cred.imap_port,
    secure: true,
    auth: { user: cred.email_address, pass: cred.password },
    logger: false,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => { /* ignore */ });
  }
}

// ─── Entry-Point ─────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? '');

  // Cron-Action: ohne User-Auth, mit Cron-Secret-Header (Migration 0080)
  if (action === 'poll-shared-tickets') {
    return await handlePollSharedTickets(req, res);
  }

  const auth = await authenticate(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  // Optional: ?account=<uuid> → geteiltes Postfach (Migration 0080)
  const sharedAccountId = extractAccountId(req);
  let cred: EmailCreds | null;
  if (sharedAccountId) {
    cred = await getCredsForSharedAccount(req, auth.member.id, sharedAccountId);
    if (!cred) return res.status(403).json({ error: 'no access to shared account' });
  } else {
    cred = await getCredsForCurrentUser(auth.member.id);
    if (!cred) return res.status(404).json({ error: 'no email account for current user' });
  }

  try {
    switch (action) {
      case 'folders':    return await handleFolders(req, res, cred);
      case 'messages':   return await handleMessages(req, res, cred);
      case 'message':    return await handleMessage(req, res, cred);
      case 'attachment': return await handleAttachment(req, res, cred);
      case 'send':       return await handleSend(req, res, cred, auth.member.id, sharedAccountId);
      case 'mark':       return await handleMark(req, res, cred);
      case 'move':       return await handleMove(req, res, cred);
      case 'delete':     return await handleDelete(req, res, cred);
      default:
        return res.status(400).json({ error: 'unknown action' });
    }
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
}

// ─── folders ─────────────────────────────────────────────────────────────
type Cred = Awaited<ReturnType<typeof getCredsForCurrentUser>> & object;

async function handleFolders(_req: VercelRequest, res: VercelResponse, cred: Cred) {
  const list = await withImap(cred, async (client) => {
    const folders = await client.list();
    return folders.map((f) => ({
      path: f.path,
      name: f.name,
      delimiter: f.delimiter,
      flags: Array.from(f.flags ?? []),
      specialUse: f.specialUse ?? null,
      subscribed: f.subscribed ?? true,
    }));
  });
  return res.status(200).json({ folders: list });
}

// ─── messages (Header-Liste eines Ordners) ────────────────────────────────
async function handleMessages(req: VercelRequest, res: VercelResponse, cred: Cred) {
  const folder = String(req.query.folder ?? 'INBOX');
  const limit  = Math.min(Number(req.query.limit ?? 50), 200);

  const messages = await withImap(cred, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const mailbox = client.mailbox as { exists: number };
      const totalCount = mailbox?.exists ?? 0;
      if (totalCount === 0) return [];
      const from = Math.max(totalCount - limit + 1, 1);
      const range = `${from}:${totalCount}`;
      const result: Array<Record<string, unknown>> = [];
      for await (const msg of client.fetch(range, { envelope: true, flags: true, size: true, uid: true })) {
        result.push({
          uid: msg.uid,
          seq: msg.seq,
          flags: Array.from(msg.flags ?? []),
          size: msg.size,
          envelope: {
            date: msg.envelope?.date ?? null,
            subject: msg.envelope?.subject ?? '',
            from: (msg.envelope?.from ?? []).map((a) => ({ name: a.name, address: a.address })),
            to: (msg.envelope?.to ?? []).map((a) => ({ name: a.name, address: a.address })),
            cc: (msg.envelope?.cc ?? []).map((a) => ({ name: a.name, address: a.address })),
            messageId: msg.envelope?.messageId ?? null,
            inReplyTo: msg.envelope?.inReplyTo ?? null,
          },
        });
      }
      // Newest first
      result.sort((a, b) => Number(b.uid) - Number(a.uid));
      return result;
    } finally {
      lock.release();
    }
  });

  return res.status(200).json({ folder, messages });
}

// ─── message (Body + Anhänge) ────────────────────────────────────────────
async function handleMessage(req: VercelRequest, res: VercelResponse, cred: Cred) {
  const folder = String(req.query.folder ?? 'INBOX');
  const uid = Number(req.query.uid);
  if (!uid) return res.status(400).json({ error: 'uid required' });

  const result = await withImap(cred, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const download = await client.download(String(uid), undefined, { uid: true });
      if (!download) return null;
      const parsed = await simpleParser(download.content);
      // Mark seen
      await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
      return {
        uid,
        date: parsed.date?.toISOString() ?? null,
        from: parsed.from?.value.map((a) => ({ name: a.name, address: a.address })) ?? [],
        to: parseAddrField(parsed.to),
        cc: parseAddrField(parsed.cc),
        bcc: parseAddrField(parsed.bcc),
        subject: parsed.subject ?? '',
        text: parsed.text ?? '',
        html: parsed.html || null,
        messageId: parsed.messageId ?? null,
        inReplyTo: parsed.inReplyTo ?? null,
        references: Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [],
        attachments: parsed.attachments.map((a, idx) => ({
          index: idx,
          filename: a.filename ?? `attachment-${idx}`,
          contentType: a.contentType,
          size: a.size,
          contentId: a.contentId ?? null,
        })),
      };
    } finally {
      lock.release();
    }
  });

  if (!result) return res.status(404).json({ error: 'message not found' });
  return res.status(200).json(result);
}

function parseAddrField(field: unknown): { name?: string; address?: string }[] {
  if (!field) return [];
  if (Array.isArray(field)) {
    return field.flatMap((f) => (f && typeof f === 'object' && 'value' in f ? (f as { value: { name?: string; address?: string }[] }).value : []));
  }
  if (typeof field === 'object' && 'value' in field) {
    return (field as { value: { name?: string; address?: string }[] }).value ?? [];
  }
  return [];
}

// ─── attachment ──────────────────────────────────────────────────────────
async function handleAttachment(req: VercelRequest, res: VercelResponse, cred: Cred) {
  const folder = String(req.query.folder ?? 'INBOX');
  const uid = Number(req.query.uid);
  const idx = Number(req.query.part ?? 0);
  if (!uid) return res.status(400).json({ error: 'uid required' });

  const result = await withImap(cred, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const download = await client.download(String(uid), undefined, { uid: true });
      if (!download) return null;
      const parsed = await simpleParser(download.content);
      const att = parsed.attachments[idx];
      if (!att) return null;
      return {
        filename: att.filename ?? `attachment-${idx}`,
        contentType: att.contentType,
        content: att.content,
      };
    } finally { lock.release(); }
  });

  if (!result) return res.status(404).json({ error: 'attachment not found' });
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename.replace(/"/g, '')}"`);
  return res.status(200).send(result.content);
}

// Normalisiert IMAP-Message-IDs auf den Schlüssel der DB-Tabelle email_tickets.
// "<abc@host>" → "abc@host", lowercase, ohne Whitespace.
function normalizeThreadKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[<>\s]/g, '').toLowerCase();
  return cleaned.length > 0 ? cleaned : null;
}

// ─── send ────────────────────────────────────────────────────────────────
async function handleSend(
  req: VercelRequest, res: VercelResponse, cred: Cred,
  memberId: string, sharedAccountId: string | null,
) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const {
    to, cc, bcc, subject, text, html,
    in_reply_to, references, attachments,
  } = req.body as {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    text?: string;
    html?: string;
    in_reply_to?: string;
    references?: string[];
    attachments?: { filename: string; content: string; contentType?: string }[];
  };
  if (!to || (!text && !html)) return res.status(400).json({ error: 'to + text|html required' });

  // Defense in Depth: Server-side Email-Validierung verhindert SMTP-Reject 504 5.5.2
  // (unvollständige Adressen wie "christoph@sauna-fds" ohne TLD).
  const toArr = Array.isArray(to) ? to : [to];
  const ccArr = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
  const bccArr = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];
  const allRecipients = [...toArr, ...ccArr, ...bccArr];
  const invalids = allRecipients.filter((addr) => !isValidEmailAddress(addr));
  if (invalids.length > 0) {
    return res.status(400).json({
      error: `invalid_recipient: ${invalids.join(', ')} (need fully-qualified address like name@example.de)`,
      invalid_recipients: invalids,
    });
  }

  const svc = makeServiceClient();
  const { data: m } = await svc.from('members').select('name').eq('id', memberId).maybeSingle();
  const fromName = m?.name ?? 'Saunafreunde';

  const transporter = nodemailer.createTransport({
    host: cred.smtp_host,
    port: cred.smtp_port,
    secure: cred.smtp_port === 465,
    auth: { user: cred.email_address, pass: cred.password },
    connectionTimeout: 20_000,
  });

  const info = await transporter.sendMail({
    from: `${fromName} <${cred.email_address}>`,
    to, cc, bcc, subject,
    text, html,
    inReplyTo: in_reply_to,
    references,
    attachments: attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
      contentType: a.contentType,
    })),
  });

  // Optional: in Sent-Folder appenden (IMAP APPEND)
  // Lassen wir erst weg — viele IMAP-Server appenden automatisch via "Sent on submission"
  // BCC-Logs könnten wir noch in email_log schreiben.

  // Migration 0080: bei shared Account → Ticket-Reply-Hook aufrufen
  // (Status → 'answered', Lock weg). Best-Effort, kein Block bei Fehler.
  if (sharedAccountId) {
    const threadKey = normalizeThreadKey(in_reply_to)
      ?? normalizeThreadKey(references?.[0]);
    if (threadKey) {
      try {
        const { data: ticketRows } = await svc
          .from('email_tickets')
          .select('id')
          .eq('account_id', sharedAccountId)
          .eq('thread_key', threadKey)
          .limit(1);
        const ticketId = ticketRows?.[0]?.id;
        if (ticketId) {
          // record_reply ist authenticated — wir nutzen Service-Role-Client
          // mit RPC-Call (der intern auth.uid() liest). Hier müssen wir per
          // Service-Role direkt updaten, da der Service-Client kein auth.uid hat.
          await svc.from('email_tickets').update({
            status: 'answered',
            last_outbound_at: new Date().toISOString(),
            locked_by: null,
            locked_at: null,
          }).eq('id', ticketId);
        }
      } catch (e) {
        console.error('[postfach.send] ticket update failed:', (e as Error).message);
      }
    }
  }

  return res.status(200).json({ ok: true, messageId: info.messageId });
}

// ─── poll-shared-tickets (Cron-only) ─────────────────────────────────────
// Wird vom pg_cron alle 2 Min via net.http_post aufgerufen. Holt für jeden
// shared Account die letzten 50 INBOX-Mails und ruft pro Mail
// email_ticket_upsert_from_inbound auf (Server entscheidet INSERT vs UPDATE).
async function handlePollSharedTickets(req: VercelRequest, res: VercelResponse) {
  // Wenn CRON_SECRET in env gesetzt ist, dann strikt prüfen. Sonst offen
  // (analog zu push-reminder-cron — der pg_cron-Job sendet keinen Header).
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const got = req.headers['x-cron-secret'] ?? req.query.cron_secret;
    if (got !== expected) return res.status(401).json({ error: 'unauthorized' });
  }

  const svc = makeServiceClient();
  const { data: accounts, error } = await svc
    .from('email_accounts')
    .select('id, email_address, imap_host, imap_port, smtp_host, smtp_port, vault_secret_id')
    .eq('is_shared', true)
    .eq('active', true);
  if (error) return res.status(500).json({ error: error.message });
  if (!accounts || accounts.length === 0) {
    return res.status(200).json({ ok: true, polled: 0 });
  }

  const summary: Array<{ account_id: string; tickets_touched: number; error?: string }> = [];

  for (const acc of accounts) {
    try {
      const { data: credData } = await svc.rpc('get_shared_email_credentials', {
        p_account_id: acc.id,
      });
      if (!credData || credData.length === 0) {
        summary.push({ account_id: acc.id, tickets_touched: 0, error: 'no_credentials' });
        continue;
      }
      const cred = credData[0] as EmailCreds;

      const touched = await withImap(cred, async (client) => {
        const lock = await client.getMailboxLock('INBOX');
        try {
          const mailbox = client.mailbox as { exists: number };
          const total = mailbox?.exists ?? 0;
          if (total === 0) return 0;
          const from = Math.max(total - 50 + 1, 1);
          const range = `${from}:${total}`;
          let count = 0;
          for await (const msg of client.fetch(range, { envelope: true, uid: true })) {
            const env = msg.envelope;
            if (!env) continue;
            const refsArr = (env as { references?: string[] | string | null }).references;
            const refs = Array.isArray(refsArr) ? refsArr : refsArr ? [refsArr] : [];
            const threadKey = normalizeThreadKey(refs[0])
              ?? normalizeThreadKey(env.inReplyTo as string | null | undefined)
              ?? normalizeThreadKey(env.messageId as string | null | undefined);
            if (!threadKey) continue;
            const fromAddr = env.from?.[0]?.address ?? null;
            const fromName = env.from?.[0]?.name ?? null;
            const fromCombined = fromName ? `${fromName} <${fromAddr ?? ''}>` : fromAddr;
            await svc.rpc('email_ticket_upsert_from_inbound', {
              p_account_id: acc.id,
              p_thread_key: threadKey,
              p_subject: env.subject ?? null,
              p_from: fromCombined ?? 'Unbekannt',
              p_imap_uid: msg.uid ?? null,
            });
            count++;
          }
          return count;
        } finally {
          lock.release();
        }
      });

      await svc.from('email_accounts').update({ last_sync_at: new Date().toISOString() })
        .eq('id', acc.id);
      summary.push({ account_id: acc.id, tickets_touched: touched });
    } catch (e) {
      summary.push({ account_id: acc.id, tickets_touched: 0, error: (e as Error).message });
    }
  }

  return res.status(200).json({ ok: true, polled: accounts.length, summary });
}

// ─── mark / move / delete ────────────────────────────────────────────────
async function handleMark(req: VercelRequest, res: VercelResponse, cred: Cred) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { folder, uid, seen, flagged } = req.body as {
    folder: string; uid: number; seen?: boolean; flagged?: boolean;
  };
  if (!folder || !uid) return res.status(400).json({ error: 'folder + uid required' });
  await withImap(cred, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      if (typeof seen === 'boolean') {
        if (seen) await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
        else      await client.messageFlagsRemove(String(uid), ['\\Seen'], { uid: true });
      }
      if (typeof flagged === 'boolean') {
        if (flagged) await client.messageFlagsAdd(String(uid), ['\\Flagged'], { uid: true });
        else         await client.messageFlagsRemove(String(uid), ['\\Flagged'], { uid: true });
      }
    } finally { lock.release(); }
  });
  return res.status(200).json({ ok: true });
}

async function handleMove(req: VercelRequest, res: VercelResponse, cred: Cred) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { folder, uid, to } = req.body as { folder: string; uid: number; to: string };
  if (!folder || !uid || !to) return res.status(400).json({ error: 'folder + uid + to required' });
  await withImap(cred, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageMove(String(uid), to, { uid: true });
    } finally { lock.release(); }
  });
  return res.status(200).json({ ok: true });
}

async function handleDelete(req: VercelRequest, res: VercelResponse, cred: Cred) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { folder, uid } = req.body as { folder: string; uid: number };
  if (!folder || !uid) return res.status(400).json({ error: 'folder + uid required' });
  await withImap(cred, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      // Versuche zuerst Move to Trash, fallback auf Flag + Expunge
      const folders = await client.list();
      const trash = folders.find((f) => f.specialUse === '\\Trash')?.path ?? 'Trash';
      try {
        await client.messageMove(String(uid), trash, { uid: true });
      } catch {
        await client.messageFlagsAdd(String(uid), ['\\Deleted'], { uid: true });
      }
    } finally { lock.release(); }
  });
  return res.status(200).json({ ok: true });
}
