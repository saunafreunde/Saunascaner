import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

async function authHeaders(): Promise<Record<string, string>> {
  if (!supabase) throw new Error('Supabase nicht konfiguriert');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token
    ? { 'content-type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'content-type': 'application/json' };
}

async function postfachRequest<T>(
  action: string,
  params?: Record<string, string | number>,
  body?: unknown,
  accountId?: string | null,
): Promise<T> {
  const queryObj: Record<string, string> = { action, ...(params ?? {}) } as Record<string, string>;
  if (accountId) queryObj.account = accountId;
  const query = new URLSearchParams(queryObj);
  // Bei POST mit accountId: account_id auch in body (server akzeptiert beide Wege)
  const finalBody = body && accountId
    ? { ...(body as Record<string, unknown>), account_id: accountId }
    : body;
  const r = await fetch(`/api/postfach?${query}`, {
    method: finalBody ? 'POST' : 'GET',
    headers: await authHeaders(),
    body: finalBody ? JSON.stringify(finalBody) : undefined,
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error ?? 'request failed');
  return json as T;
}

// ─── Types ───────────────────────────────────────────────────────────────
export type EmailFolder = {
  path: string;
  name: string;
  delimiter: string;
  flags: string[];
  specialUse: string | null;
  subscribed: boolean;
};

export type EmailAddress = { name?: string; address?: string };

export type EmailMessageHeader = {
  uid: number;
  seq: number;
  flags: string[];
  size: number;
  envelope: {
    date: string | null;
    subject: string;
    from: EmailAddress[];
    to: EmailAddress[];
    cc: EmailAddress[];
    messageId: string | null;
    inReplyTo: string | null;
  };
};

export type EmailMessage = {
  uid: number;
  date: string | null;
  from: EmailAddress[];
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  subject: string;
  text: string;
  html: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  attachments: {
    index: number;
    filename: string;
    contentType: string;
    size: number;
    contentId: string | null;
  }[];
};

// ─── Hooks ───────────────────────────────────────────────────────────────
// Alle Hooks akzeptieren optional `accountId` für geteilte Postfächer
// (Migration 0080). Wenn null/undefined → persönlicher Account des Users.

export function useFolders(accountId?: string | null) {
  return useQuery({
    queryKey: ['postfach', 'folders', accountId ?? 'self'],
    queryFn: async () => {
      const r = await postfachRequest<{ folders: EmailFolder[] }>('folders', undefined, undefined, accountId);
      return r.folders;
    },
    staleTime: 5 * 60_000,
  });
}

export function useMessages(folder: string, limit = 50, accountId?: string | null) {
  return useQuery({
    queryKey: ['postfach', 'messages', accountId ?? 'self', folder, limit],
    queryFn: async () => {
      const r = await postfachRequest<{ folder: string; messages: EmailMessageHeader[] }>('messages', { folder, limit }, undefined, accountId);
      return r.messages;
    },
    refetchInterval: 60_000,
    enabled: !!folder,
  });
}

export function useMessage(folder: string, uid: number | null, accountId?: string | null) {
  return useQuery({
    queryKey: ['postfach', 'message', accountId ?? 'self', folder, uid],
    enabled: !!folder && !!uid,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await postfachRequest<EmailMessage>('message', { folder, uid: uid! }, undefined, accountId);
      return r;
    },
  });
}

export function useSendMail(accountId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      to: string | string[];
      cc?: string | string[];
      bcc?: string | string[];
      subject: string;
      text?: string;
      html?: string;
      in_reply_to?: string;
      references?: string[];
      attachments?: { filename: string; content: string; contentType?: string }[];
    }) => {
      return await postfachRequest<{ ok: true; messageId: string }>('send', undefined, p, accountId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['postfach', 'messages'] });
      qc.invalidateQueries({ queryKey: ['account-tickets'] });
    },
  });
}

export function useMarkMessage(accountId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { folder: string; uid: number; seen?: boolean; flagged?: boolean }) => {
      return await postfachRequest<{ ok: true }>('mark', undefined, p, accountId);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['postfach', 'messages', accountId ?? 'self', vars.folder] }),
  });
}

export function useMoveMessage(accountId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { folder: string; uid: number; to: string }) => {
      return await postfachRequest<{ ok: true }>('move', undefined, p, accountId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['postfach', 'messages'] }),
  });
}

export function useDeleteMessage(accountId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { folder: string; uid: number }) => {
      return await postfachRequest<{ ok: true }>('delete', undefined, p, accountId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['postfach', 'messages'] }),
  });
}

// Trigger des Shared-Ticket-Pollings für sofortigen Refresh. Sendet das User-JWT mit —
// das Backend verlangt einen eingeloggten Shared-Inbox-Admin (oder ein gültiges
// CRON_SECRET). Ohne Auth-Header würde der Endpoint sonst anonymen IMAP-Poll-DoS erlauben.
export async function pollSharedTickets(): Promise<{ ok: boolean; polled: number }> {
  try {
    const r = await fetch('/api/postfach?action=poll-shared-tickets', {
      method: 'GET',
      headers: await authHeaders(),
    });
    const json = await r.json();
    return json;
  } catch {
    return { ok: false, polled: 0 };
  }
}

// Anhang-Download-URL bauen — NUR für Backend-Calls per fetch+JWT.
// FIX 0107 (Audit Phase 8 CRITICAL): direkter <a href={url} download> funktioniert
// NICHT, weil Browser-Navigation den Authorization-Header NICHT setzt → Backend
// returnt 401-JSON statt der Datei. Funktionierte vermutlich seit Day 1 nicht.
// Stattdessen `downloadAttachment()` nutzen (fetch + blob + URL.createObjectURL).
export function attachmentUrl(folder: string, uid: number, part: number, accountId?: string | null): string {
  const q = new URLSearchParams({
    action: 'attachment',
    folder, uid: String(uid), part: String(part),
    ...(accountId ? { account: accountId } : {}),
  });
  return `/api/postfach?${q}`;
}

/**
 * FIX 0107 (Audit Phase 8 CRITICAL): Lädt einen Anhang via fetch mit JWT-Header
 * und triggert den Browser-Download via Blob-URL. Funktioniert für alle Auth-
 * geschützten Anhänge.
 */
export async function downloadAttachment(
  folder: string,
  uid: number,
  part: number,
  filename: string,
  accountId?: string | null,
): Promise<void> {
  const url = attachmentUrl(folder, uid, part, accountId);
  const headers = await authHeaders();
  // content-type braucht's beim GET nicht
  delete (headers as Record<string, string>)['content-type'];
  const r = await fetch(url, { headers });
  if (!r.ok) {
    let msg = `Download fehlgeschlagen (${r.status})`;
    try {
      const json = await r.json() as { error?: string };
      if (json?.error) msg += ': ' + json.error;
    } catch { /* ignore body parse */ }
    throw new Error(msg);
  }
  const blob = await r.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Speicher freigeben — 5 Sek delay damit Browser Zeit hat zu starten
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}
