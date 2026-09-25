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
// Ticket-Polling:
//   GET|POST /api/postfach?action=poll-shared-tickets
//   - pg_cron-Job 'vereinspostfach-abruf' (Migration 0203): alle 5 Min von
//     05:00 bis 21:55 UTC, nur Header x-cron-secret (Vault 'cron_secret')
//   - Frontend (SharedTicketsView beim Öffnen und „↻ Synchronisieren“):
//     JWT eines Shared-Inbox-Admins

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { authenticate } from './_auth.js';
import { cronHeaderOk, cronSecretFehlt } from './_cron.js';
import { makeServiceClient } from './_email_helpers.js';
import { queryParam } from './_query.js';

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
  const q = queryParam(req, 'account') ?? queryParam(req, 'account_id');
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
  const action = String(queryParam(req, 'action') ?? '');

  // poll-shared-tickets: entweder der pg_cron-Job 'vereinspostfach-abruf' (0203)
  // mit Header x-cron-secret ODER ein eingeloggter Shared-Inbox-Admin (Frontend).
  // Vorher lief der Handler vor jeder Auth und war ohne gesetztes CRON_SECRET
  // komplett offen → anonymer, teurer IMAP-Poll-DoS gegen alle Shared-Accounts.
  if (action === 'poll-shared-tickets') {
    // Cron-Weg: Trägt der Aufruf den Header x-cron-secret, entscheidet NUR er
    // (zeitkonstant, api/_cron.ts). Ein falsches oder leeres Geheimnis (z. B.
    // Vault und Vercel nicht mehr gleich) endet mit 401 und einem Log-Eintrag —
    // es fällt nie auf die Nutzer-Anmeldung zurück. Der frühere Query-Parameter
    // ?cron_secret= ist weg: er hätte das Geheimnis in URL-Logs getragen.
    if (req.headers['x-cron-secret'] !== undefined) {
      if (!cronHeaderOk(req)) {
        console.error(cronSecretFehlt()
          ? '[postfach] Cron-Abruf abgelehnt: CRON_SECRET fehlt oder ist kürzer als 32 Zeichen'
          : '[postfach] Cron-Abruf abgelehnt: x-cron-secret passt nicht zu CRON_SECRET');
        return res.status(401).json({ error: 'unauthorized' });
      }
      return await handlePollSharedTickets(req, res);
    }
    // Nutzer-Weg: nur mit JWT eines freigeschalteten, nicht gesperrten
    // Mitglieds, das Bearbeiter eines Vereins-Postfachs ist.
    const cronAuth = await authenticate(req);
    if (!cronAuth.ok) return res.status(cronAuth.status).json({ error: cronAuth.error });
    const { data: adminRows, error: adminErr } = await cronAuth.service
      .from('shared_email_admins')
      .select('account_id')
      .eq('member_id', cronAuth.member.id)
      .limit(1);
    if (adminErr) return res.status(500).json({ error: adminErr.message });
    if (!adminRows || adminRows.length === 0) return res.status(403).json({ error: 'forbidden' });
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
  const folder = String(queryParam(req, 'folder') ?? 'INBOX');
  const limit  = Math.min(Number(queryParam(req, 'limit') ?? 50), 200);

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
  const folder = String(queryParam(req, 'folder') ?? 'INBOX');
  const uid = Number(queryParam(req, 'uid'));
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
  const folder = String(queryParam(req, 'folder') ?? 'INBOX');
  const uid = Number(queryParam(req, 'uid'));
  const idx = Number(queryParam(req, 'part') ?? 0);
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

// Bezüge einer eingehenden Mail für die Ticket-Zuordnung (0208): alle
// Message-IDs aus In-Reply-To und References, der direkteste Bezug zuerst
// (In-Reply-To, dann References von hinten). Das IMAP-ENVELOPE hat KEIN
// References-Feld — der Header kommt per fetch({ headers: ['references'] })
// als roher Buffer („References: <a@x>\r\n <b@y>“) und wird hier entfaltet.
function bezugsKandidaten(inReplyTo: string | null | undefined, kopf: Buffer | undefined): string[] {
  const ids = (s: string): string[] => [...(s.match(/<[^<>]+>/g) ?? [])];
  const antwortAuf = inReplyTo ? ids(inReplyTo) : [];
  if (inReplyTo && antwortAuf.length === 0 && inReplyTo.trim()) antwortAuf.push(inReplyTo.trim());
  const refs = kopf ? ids(kopf.toString('utf8').replace(/\r?\n[ \t]+/g, ' ')) : [];
  const alle = [...antwortAuf, ...refs.reverse()]
    .map(normalizeThreadKey)
    .filter((k): k is string => !!k && k.length <= 998);
  return [...new Set(alle)].slice(0, 100);
}

// Reine Adresse aus „Name <a@b.de>“ bzw. „a@b.de“ (klein), sonst null.
function reineAdresse(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const a = raw.replace(/^.*<([^>]+)>\s*$/, '$1').trim().toLowerCase();
  return a.includes('@') ? a : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── send ────────────────────────────────────────────────────────────────
async function handleSend(
  req: VercelRequest, res: VercelResponse, cred: Cred,
  memberId: string, sharedAccountId: string | null,
) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const {
    to, cc, bcc, subject, text, html,
    in_reply_to, references, attachments,
    ticket_id, antwort_uid,
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
    // Vereins-Postfach (0208): beantwortetes Ticket und UID der beantworteten Mail
    ticket_id?: string | null;
    antwort_uid?: number | null;
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

  // Nur reine Texte annehmen (Audit 25.09.2026): nodemailer liest bei einem
  // Objekt wie { path: '/datei' } oder { href: 'https://…' } statt Text selbst
  // eine Serverdatei bzw. eine fremde Adresse ein und verschickt das Ergebnis.
  // Der Transport unten sperrt beides zusätzlich (disableFileAccess/UrlAccess).
  const istText = (v: unknown) => v === undefined || v === null || typeof v === 'string';
  const istTextListe = (v: unknown) =>
    istText(v) || (Array.isArray(v) && v.every((x) => typeof x === 'string'));
  if (!istText(subject) || !istText(text) || !istText(html)
      || !istText(in_reply_to) || !istTextListe(references)) {
    return res.status(400).json({ error: 'subject/text/html/in_reply_to/references must be strings' });
  }
  if (attachments !== undefined && attachments !== null && (
    !Array.isArray(attachments)
    || !attachments.every((a) => !!a && typeof a === 'object'
      && typeof a.filename === 'string' && typeof a.content === 'string'
      && istText(a.contentType))
  )) {
    return res.status(400).json({ error: 'attachments must be [{ filename, content (base64), contentType? }]' });
  }
  if (ticket_id !== undefined && ticket_id !== null
      && (typeof ticket_id !== 'string' || !UUID_RE.test(ticket_id))) {
    return res.status(400).json({ error: 'ticket_id must be a uuid' });
  }
  if (antwort_uid !== undefined && antwort_uid !== null
      && !(typeof antwort_uid === 'number' && Number.isSafeInteger(antwort_uid) && antwort_uid > 0)) {
    return res.status(400).json({ error: 'antwort_uid must be a positive integer' });
  }
  if (ticket_id && !sharedAccountId) {
    return res.status(400).json({ error: 'ticket_id only for a shared account' });
  }

  const svc = makeServiceClient();

  // Vereins-Postfach (0208): Das Ticket muss zu DIESEM Postfach gehören — vor
  // dem Versand prüfen, damit keine Antwort ein fremdes Ticket „erledigt“.
  if (sharedAccountId && ticket_id) {
    const { data: t, error: tErr } = await svc
      .from('email_tickets')
      .select('id')
      .eq('id', ticket_id)
      .eq('account_id', sharedAccountId)
      .maybeSingle();
    if (tErr) return res.status(500).json({ error: tErr.message });
    if (!t) return res.status(400).json({ error: 'ticket_not_in_account' });
  }

  const { data: m } = await svc.from('members').select('name').eq('id', memberId).maybeSingle();
  const fromName = m?.name ?? 'Saunafreunde';

  const transporter = nodemailer.createTransport({
    host: cred.smtp_host,
    port: cred.smtp_port,
    secure: cred.smtp_port === 465,
    auth: { user: cred.email_address, pass: cred.password },
    connectionTimeout: 20_000,
    // Inhalte kommen nur als Text oder Buffer: nodemailer darf weder Dateien
    // des Servers noch fremde URLs selbst einlesen (Audit 25.09.2026).
    disableFileAccess: true,
    disableUrlAccess: true,
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

  // Vereins-Postfach: Antwort dem Ticket zuordnen (0208, vorher 0080 über den
  // Schlüssel = In-Reply-To, der ab der zweiten Mail eines Tickets nie traf).
  // email_ticket_antwort_vermerken (nur service_role) setzt GENAU das Ticket
  // mit ticket_id und diesem Postfach auf „Beantwortet“ — außer seit dem Laden
  // kam eine neuere Kundenmail (antwort_uid) —, gibt die Sperre frei und merkt
  // die Message-ID der Antwort, damit die Rückantwort des Kunden im selben
  // Ticket landet. Ohne ticket_id (altes App-Bundle) sucht die DB über
  // In-Reply-To = Message-ID der beantworteten Mail. Die Mail ist schon
  // verschickt: Fehler hier nur protokollieren, nicht als Fehlschlag melden.
  let ticketVermerkt: boolean | undefined;
  if (sharedAccountId) {
    const empfaenger = [...toArr, ...ccArr]
      .map((a) => reineAdresse(a))
      .filter((a): a is string => !!a);
    try {
      const { data: vermerkt, error: vErr } = await svc.rpc('email_ticket_antwort_vermerken', {
        p_account_id: sharedAccountId,
        p_ticket_id: ticket_id ?? null,
        p_in_reply_to: in_reply_to ?? null,
        p_antwort_uid: antwort_uid ?? null,
        p_message_id: info.messageId ?? null,
        p_empfaenger: empfaenger,
      });
      if (vErr) console.error('[postfach.send] Ticket-Vermerk fehlgeschlagen:', vErr.message);
      ticketVermerkt = !vErr && !!vermerkt;
    } catch (e) {
      console.error('[postfach.send] Ticket-Vermerk fehlgeschlagen:', (e as Error).message);
      ticketVermerkt = false;
    }
  }

  return res.status(200).json({
    ok: true, messageId: info.messageId,
    ...(ticketVermerkt !== undefined ? { ticket_vermerkt: ticketVermerkt } : {}),
  });
}

// ─── poll-shared-tickets ─────────────────────────────────────────────────
// Holt für jeden shared Account die letzten 50 INBOX-Mails und ruft pro Mail
// email_ticket_upsert_from_inbound auf (Server entscheidet INSERT vs UPDATE).
// Auth (Cron-Secret ODER eingeloggter Shared-Admin) wird im Entry-Point geprüft.
//
// Wiederholte oder gleichzeitige Abrufe (Cron alle 5 Min + Tab öffnen) sind
// gefahrlos: Die DB meldet keine Mail doppelt (Meldung nur bei neuem Ticket,
// Wiederöffnen eines beantworteten/geschlossenen oder einer Kundenantwort auf
// eine Vereinsmail, 0208) — bekannte UIDs kehren früh
// zurück, ein paralleles Anlegen desselben Tickets scheitert am Unique-Index
// (hier nur als upsert_fehler gezählt), dedup_key je Empfänger (0185).
//
// Scheitert ein Konto (z. B. IMAP-Passwort veraltet), antwortet der Endpunkt
// mit 502 statt 200 — sonst sähe der Cron-Job in net._http_response gesund aus,
// obwohl seit Tagen nichts abgerufen wird. Die Einzelheiten stehen im JSON und
// im Vercel-Log.
async function handlePollSharedTickets(_req: VercelRequest, res: VercelResponse) {
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

  const summary: Array<{
    account_id: string; tickets_touched: number; upsert_fehler?: number; error?: string;
  }> = [];

  for (const acc of accounts) {
    let upsertFehler = 0;
    try {
      const { data: credData, error: credErr } = await svc.rpc('get_shared_email_credentials', {
        p_account_id: acc.id,
      });
      if (credErr) {
        // RPC-Fehler (Rechte, Vault) nicht als „keine Zugangsdaten“ tarnen —
        // sonst trägt jemand das Passwort neu ein, obwohl die DB-Seite klemmt.
        console.error(`[postfach] Vereins-Postfach ${acc.id}: Zugangsdaten-RPC fehlgeschlagen:`, credErr.message);
        summary.push({ account_id: acc.id, tickets_touched: 0, error: 'credentials_rpc_error' });
        continue;
      }
      if (!credData || credData.length === 0) {
        console.error(`[postfach] Vereins-Postfach ${acc.id}: keine Zugangsdaten`);
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
          // headers: ['references'] → msg.headers (roher Buffer); das ENVELOPE
          // kennt nur In-Reply-To und Message-ID (RFC 3501).
          for await (const msg of client.fetch(range, {
            envelope: true, uid: true, internalDate: true, headers: ['references'],
          })) {
            const env = msg.envelope;
            if (!env) continue;
            // Schlüssel = EIGENE Message-ID der Mail (0208). Die Zuordnung zu
            // einem bestehenden Ticket macht die DB über die Bezüge
            // (In-Reply-To + References) und den Absender — so landet die
            // Kundenantwort auf eine Vereinsantwort im selben Ticket, und
            // Antworten verschiedener Personen verschmelzen nicht.
            // Ohne Message-ID: Ersatzschlüssel aus der UID (sonst ginge die
            // Mail verloren).
            const threadKey = normalizeThreadKey(env.messageId as string | null | undefined)
              ?? (msg.uid ? `uid-${msg.uid}@ohne-message-id` : null);
            if (!threadKey) continue;
            const kandidaten = bezugsKandidaten(env.inReplyTo as string | null | undefined, msg.headers);
            const fromAddr = env.from?.[0]?.address ?? null;
            const fromName = env.from?.[0]?.name ?? null;
            const fromCombined = fromName ? `${fromName} <${fromAddr ?? ''}>` : fromAddr;
            // Eingangszeit (Server-Zeitstempel, sonst Date-Header): Über Mails, die
            // älter als 3 Tage sind, benachrichtigt die DB niemanden (0185); für
            // Mails älter als 24 Monate legt sie kein Ticket mehr an (0208).
            const eingang = msg.internalDate ?? env.date ?? null;
            const eingangMs = eingang ? new Date(eingang).getTime() : NaN;
            const { error: upErr } = await svc.rpc('email_ticket_upsert_from_inbound', {
              p_account_id: acc.id,
              p_thread_key: threadKey,
              p_subject: env.subject ?? null,
              p_from: fromCombined ?? 'Unbekannt',
              p_imap_uid: msg.uid ?? null,
              p_received_at: Number.isFinite(eingangMs) ? new Date(eingangMs).toISOString() : null,
              p_kandidaten: kandidaten,
              p_absender: reineAdresse(fromAddr),
            });
            if (upErr) {
              console.error('[postfach] Ticket-Upsert fehlgeschlagen:', upErr.message);
              upsertFehler++;
              continue;
            }
            count++;
          }
          return count;
        } finally {
          lock.release();
        }
      });

      await svc.from('email_accounts').update({ last_sync_at: new Date().toISOString() })
        .eq('id', acc.id);
      // Einzelne Fehlschläge (paralleler Abruf legte dasselbe Ticket an) sind
      // harmlos; scheitert JEDE Mail, ist die DB-Seite kaputt → als Fehler melden.
      summary.push({
        account_id: acc.id, tickets_touched: touched,
        ...(upsertFehler > 0 ? { upsert_fehler: upsertFehler } : {}),
        ...(upsertFehler > 0 && touched === 0 ? { error: 'alle Ticket-Upserts fehlgeschlagen' } : {}),
      });
    } catch (e) {
      console.error(`[postfach] Vereins-Postfach ${acc.id}: Abruf fehlgeschlagen:`, (e as Error).message);
      summary.push({ account_id: acc.id, tickets_touched: 0, error: (e as Error).message });
    }
  }

  const kontoFehler = summary.some((s) => s.error);
  return res.status(kontoFehler ? 502 : 200)
    .json({ ok: !kontoFehler, polled: accounts.length, summary });
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
