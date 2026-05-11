// Single-Endpoint für alle Postfach-Operationen (Stufe 3).
// Routing via ?action=... Param.
//
// GET   /api/postfach?action=folders                              — Ordner-Liste
// GET   /api/postfach?action=messages&folder=INBOX&limit=50       — Header-Liste
// GET   /api/postfach?action=message&folder=INBOX&uid=123         — Voller Body
// GET   /api/postfach?action=attachment&folder=INBOX&uid=123&part=2 — Anhang stream
// POST  /api/postfach?action=send                                 — SMTP-Send
// POST  /api/postfach?action=mark    body: {folder, uid, seen}     — Flag setzen
// POST  /api/postfach?action=move    body: {folder, uid, to}       — Verschieben
// POST  /api/postfach?action=delete  body: {folder, uid}           — Löschen (move to Trash)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { authenticate } from './_auth';
import { makeServiceClient } from './_email_helpers';

// ─── Credentials-Helper ──────────────────────────────────────────────────
async function getCredsForCurrentUser(memberId: string) {
  const svc = makeServiceClient();
  const { data, error } = await svc.rpc('get_email_credentials', { p_member_id: memberId });
  if (error || !data || data.length === 0) return null;
  return data[0] as {
    email_address: string;
    imap_host: string;
    imap_port: number;
    smtp_host: string;
    smtp_port: number;
    password: string;
  };
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
  const auth = await authenticate(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const cred = await getCredsForCurrentUser(auth.member.id);
  if (!cred) return res.status(404).json({ error: 'no email account for current user' });

  const action = String(req.query.action ?? '');
  try {
    switch (action) {
      case 'folders':    return await handleFolders(req, res, cred);
      case 'messages':   return await handleMessages(req, res, cred);
      case 'message':    return await handleMessage(req, res, cred);
      case 'attachment': return await handleAttachment(req, res, cred);
      case 'send':       return await handleSend(req, res, cred, auth.member.id);
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

// ─── send ────────────────────────────────────────────────────────────────
async function handleSend(req: VercelRequest, res: VercelResponse, cred: Cred, memberId: string) {
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

  return res.status(200).json({ ok: true, messageId: info.messageId });
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
