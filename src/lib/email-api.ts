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

async function postfachRequest<T>(action: string, params?: Record<string, string | number>, body?: unknown): Promise<T> {
  const query = new URLSearchParams({ action, ...(params ?? {}) } as Record<string, string>);
  const r = await fetch(`/api/postfach?${query}`, {
    method: body ? 'POST' : 'GET',
    headers: await authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
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
export function useFolders() {
  return useQuery({
    queryKey: ['postfach', 'folders'],
    queryFn: async () => {
      const r = await postfachRequest<{ folders: EmailFolder[] }>('folders');
      return r.folders;
    },
    staleTime: 5 * 60_000,
  });
}

export function useMessages(folder: string, limit = 50) {
  return useQuery({
    queryKey: ['postfach', 'messages', folder, limit],
    queryFn: async () => {
      const r = await postfachRequest<{ folder: string; messages: EmailMessageHeader[] }>('messages', { folder, limit });
      return r.messages;
    },
    refetchInterval: 60_000,
    enabled: !!folder,
  });
}

export function useMessage(folder: string, uid: number | null) {
  return useQuery({
    queryKey: ['postfach', 'message', folder, uid],
    enabled: !!folder && !!uid,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await postfachRequest<EmailMessage>('message', { folder, uid: uid! });
      return r;
    },
  });
}

export function useSendMail() {
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
      return await postfachRequest<{ ok: true; messageId: string }>('send', undefined, p);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['postfach', 'messages'] }),
  });
}

export function useMarkMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { folder: string; uid: number; seen?: boolean; flagged?: boolean }) => {
      return await postfachRequest<{ ok: true }>('mark', undefined, p);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['postfach', 'messages', vars.folder] }),
  });
}

export function useMoveMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { folder: string; uid: number; to: string }) => {
      return await postfachRequest<{ ok: true }>('move', undefined, p);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['postfach', 'messages'] }),
  });
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { folder: string; uid: number }) => {
      return await postfachRequest<{ ok: true }>('delete', undefined, p);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['postfach', 'messages'] }),
  });
}

// Anhang-Download-URL bauen (für direkten <a href>-Download oder fetch)
export function attachmentUrl(folder: string, uid: number, part: number): string {
  return `/api/postfach?action=attachment&folder=${encodeURIComponent(folder)}&uid=${uid}&part=${part}`;
}
