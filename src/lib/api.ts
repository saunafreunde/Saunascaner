import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Sauna, Infusion, MemberCustomAttr, RecurringSlot, AufgieserAbsence, MemberRole, Invitation } from '@/types/database';
import type { InfusionAttribute } from './attributes';
import { type BrandSettings, mergeBrandDefaults, defaultBrandSettings } from '@/types/branding';

function need() {
  if (!supabase) throw new Error('Supabase nicht konfiguriert');
  return supabase;
}

// ─── Saunas ───────────────────────────────────────────────────────────────
export function useSaunas() {
  return useQuery({
    queryKey: ['saunas'],
    queryFn: async () => {
      const { data, error } = await need()
        .from('saunas')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as Sauna[];
    },
  });
}

export function useToggleSauna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await need().from('saunas').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saunas'] }),
  });
}

// ─── Infusions ────────────────────────────────────────────────────────────
export function useInfusions() {
  return useQuery({
    queryKey: ['infusions'],
    queryFn: async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const { data, error } = await need()
        .from('infusions')
        .select('*')
        .gte('end_time', since.toISOString())
        .order('start_time');
      if (error) throw error;
      return data as Infusion[];
    },
  });
}

export type NewInfusion = {
  sauna_id: string;
  saunameister_id: string | null;
  template_id: string | null;
  title: string;
  description: string | null;
  attributes: InfusionAttribute[];
  oils?: (string | null)[] | null;
  start_time: string;
  duration_minutes: number;
  team_infusion?: boolean;
};

export function useAddInfusion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: NewInfusion) => {
      const { error } = await need().from('infusions').insert(i);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infusions'] }),
  });
}

export function useDeleteInfusion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().from('infusions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infusions'] }),
  });
}

// ─── Templates ────────────────────────────────────────────────────────────
export type Template = {
  id: string;
  member_id: string | null;
  title: string;
  description: string | null;
  duration_minutes: number;
  attributes: InfusionAttribute[];
  oils: (string | null)[] | null;
};

export function useTemplates(memberId: string | null) {
  return useQuery({
    queryKey: ['templates', memberId ?? 'global'],
    enabled: true,
    queryFn: async () => {
      const q = need().from('infusion_templates').select('*');
      const safeId = memberId && /^[0-9a-f-]{36}$/i.test(memberId) ? memberId : null;
      const { data, error } = safeId
        ? await q.or(`member_id.eq.${safeId},member_id.is.null`).order('title')
        : await q.is('member_id', null).order('title');
      if (error) throw error;
      return data as Template[];
    },
  });
}

export function useAddTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Omit<Template, 'id'>) => {
      const { error } = await need().from('infusion_templates').insert(t);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().from('infusion_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

// ─── Members (admin) ──────────────────────────────────────────────────────
export type Member = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  name: string;
  member_code: string;
  member_number: number | null;
  role: MemberRole;
  is_aufgieser: boolean;
  is_wm_admin: boolean;
  entry_code: string | null;
  sauna_name: string | null;
  sauna_name_changed_at: string | null;
  custom_attrs_enabled: boolean;
  approved: boolean;
  is_present: boolean;
  last_scan_at: string | null;
  revoked_at: string | null;
  birthday: string | null;
  motto: string | null;
  avatar_path: string | null;
  home_group: string | null;
  calendar_feed_token: string | null;
  telegram_user_id: number | null;
  telegram_link_token: string | null;
  // Social-Layer / Star-Profil (Migration 0041)
  bio: string | null;
  aufgieser_story: string | null;
  signature_aufguss: string | null;
  specialties: string[];
  style_quote: string | null;
  star_card_visible: boolean;
  star_accent_color: string | null;
  // Lieblings-Aromen (Migration 0046)
  favorite_oils: string[];
  // Gast-Felder (Migration 0040)
  gast_referral_source: string | null;
  gast_consent_at: string | null;
  gast_signup_origin: string | null;
  created_at: string;
};

export function useMember(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['member', memberId ?? 'none'],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need().rpc('get_member_public', { p_member_id: memberId! });
      if (error) throw error;
      const row = (data ?? [])[0] as undefined | { id: string; name: string; sauna_name: string | null; member_number: number | null; is_aufgieser: boolean; role: string; birthday: string | null; motto: string | null; avatar_path: string | null; created_at: string };
      return row ?? null;
    },
  });
}

export function useSetBirthday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (birthday: string | null) => {
      const { data, error } = await need().rpc('set_my_birthday', { p_birthday: birthday });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-member'] });
      qc.invalidateQueries({ queryKey: ['member'] });
      qc.invalidateQueries({ queryKey: ['birthdays-today'] });
    },
  });
}

export function useSetMotto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (motto: string) => {
      const { data, error } = await need().rpc('set_my_motto', { p_motto: motto });
      if (error) throw error;
      if (data === 'too_long') throw new Error('Motto darf max. 200 Zeichen lang sein.');
      if (data === 'not_authorized') throw new Error('Nicht berechtigt.');
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-member'] });
      qc.invalidateQueries({ queryKey: ['member'] });
      qc.invalidateQueries({ queryKey: ['members-directory'] });
    },
  });
}

// ─── Avatar ──────────────────────────────────────────────────────────────
export function useSetAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (avatarPath: string | null) => {
      const { data, error } = await need().rpc('set_my_avatar', { p_path: avatarPath ?? '' });
      if (error) throw error;
      if (data === 'not_authorized') throw new Error('Nicht berechtigt.');
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-member'] });
      qc.invalidateQueries({ queryKey: ['member'] });
      qc.invalidateQueries({ queryKey: ['members-directory'] });
      qc.invalidateQueries({ queryKey: ['member-photos'] });
    },
  });
}

// ─── Member-Foto-Galerie ─────────────────────────────────────────────────
export type MemberPhoto = {
  id: string;
  uploader_id: string;
  uploader_name: string;
  uploader_sauna_name: string | null;
  uploader_avatar_path: string | null;
  photo_path: string;
  caption: string | null;
  approved: boolean;
  created_at: string;
};

export function useMemberPhotos(limit = 30, includePending = false) {
  return useQuery({
    queryKey: ['member-photos', limit, includePending],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_member_photos', {
        p_limit: limit,
        p_include_pending: includePending,
      });
      if (error) throw error;
      return (data ?? []) as MemberPhoto[];
    },
  });
}

export function useUploadMemberPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ uploaderId, file, caption }: { uploaderId: string; file: File; caption: string | null }) => {
      // uploadAsset komprimiert intern bereits (1920px / 500KB / JPEG)
      const path = await uploadAsset(file, 'member-photos');
      const cleanedCaption = caption?.trim() ? caption.trim().slice(0, 280) : null;
      const { error } = await need().from('member_photos').insert({
        uploader_id: uploaderId,
        photo_path: path,
        caption: cleanedCaption,
      });
      if (error) {
        // Bei DB-Fehler: hochgeladenes Bild wieder entfernen
        try { await deleteAsset(path); } catch { /* ignore */ }
        throw error;
      }
      return path;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-photos'] }),
  });
}

export function useDeleteMemberPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photo: { id: string; photo_path: string }) => {
      const { error } = await need().from('member_photos').delete().eq('id', photo.id);
      if (error) throw error;
      try { await deleteAsset(photo.photo_path); } catch { /* ignore */ }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-photos'] }),
  });
}

export function useTogglePhotoApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await need().from('member_photos').update({ approved }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-photos'] }),
  });
}

export function useFavoriteOils(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['favorite-oils', memberId ?? 'none'],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need().rpc('get_member_favorite_oils', { p_member_id: memberId! });
      if (error) throw error;
      return (data ?? []) as { oil_id: string; usage_count: number }[];
    },
  });
}

export function useSignatureInfusion(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['signature-infusion', memberId ?? 'none'],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need().rpc('get_member_signature_infusion', { p_member_id: memberId! });
      if (error) throw error;
      const row = (data ?? [])[0] as { title: string; count: number } | undefined;
      return row ?? null;
    },
  });
}

export function useBirthdaysToday() {
  return useQuery({
    queryKey: ['birthdays-today'],
    refetchInterval: 60 * 60_000, // 1h
    queryFn: async () => {
      const { data, error } = await need().rpc('get_birthdays_today');
      if (error) throw error;
      return (data ?? []) as { member_id: string; name: string; sauna_name: string | null }[];
    },
  });
}

export async function fetchVapidPublicKey(): Promise<string> {
  const r = await fetch('/api/push-vapid-public');
  const data = await r.json();
  if (!data.publicKey) throw new Error('No VAPID key');
  return data.publicKey as string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const sb = need();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  return token
    ? { 'content-type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'content-type': 'application/json' };
}

export async function subscribePush(memberId: string, subscription: PushSubscription) {
  const json = subscription.toJSON();
  const r = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      member_id: memberId,
      subscription: { endpoint: json.endpoint, keys: json.keys },
      user_agent: navigator.userAgent,
    }),
  });
  if (!r.ok) throw new Error(`push-subscribe failed: ${r.status}`);
}

export async function sendTestPush(memberId: string) {
  const r = await fetch('/api/push-send', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      member_ids: [memberId],
      title: '🧖 Saunafreunde — Test',
      body: 'Push-Benachrichtigungen funktionieren! 🎉',
      url: '/planner',
    }),
  });
  if (!r.ok) throw new Error(`push-send failed: ${r.status}`);
}

export async function sendBroadcastPush(payload: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
}) {
  const r = await fetch('/api/push-send', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`push-send failed: ${r.status}`);
}

export function useAttendanceStreak(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['streak', memberId ?? 'none'],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need().rpc('get_attendance_streak_weeks', { p_member_id: memberId! });
      if (error) throw error;
      return (data ?? 0) as number;
    },
  });
}

export function useCurrentMember() {
  return useQuery({
    queryKey: ['current-member'],
    queryFn: async () => {
      const { data, error } = await need().rpc('current_member');
      if (error) throw error;
      // current_member returns a row of public.members
      const m = Array.isArray(data) ? data[0] : data;
      return (m ?? null) as Member | null;
    },
  });
}

// Mitglieder-Verzeichnis für die Galerie-Seite (RPC umgeht RLS, gibt nur sichere Felder)
// Staff wird serverseitig in list_members_directory bereits ausgeblendet.
export type MemberDirectoryEntry = {
  id: string;
  name: string;
  sauna_name: string | null;
  member_number: number | null;
  role: MemberRole;
  is_aufgieser: boolean;
  is_present: boolean;
  birthday: string | null;
  motto: string | null;
  avatar_path: string | null;
  home_group: string | null;
  created_at: string;
};

export function useMembersDirectory() {
  return useQuery({
    queryKey: ['members-directory'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_members_directory');
      if (error) throw error;
      return (data ?? []) as MemberDirectoryEntry[];
    },
  });
}

// Public directory of staff names for the TV/guest UI (callable as anon).
export type MeisterDirectoryEntry = { id: string; name: string; role: MemberRole; home_group: string | null };
export function useMeisterDirectory() {
  return useQuery({
    queryKey: ['meister-directory'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_meister_names');
      if (error) throw error;
      return (data ?? []) as MeisterDirectoryEntry[];
    },
  });
}

export function useAllMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const { data, error } = await need().from('members').select('*').order('name');
      if (error) throw error;
      return data as Member[];
    },
  });
}

export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Pick<Member, 'name' | 'email' | 'role'>) => {
      const { error } = await need().from('members').insert(m);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  });
}

export function usePendingMembers() {
  return useQuery({
    queryKey: ['members', 'pending'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_pending_members');
      if (error) throw error;
      return (data ?? []) as { id: string; email: string | null; name: string; created_at: string }[];
    },
  });
}

export function useApproveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; role?: MemberRole; is_aufgieser?: boolean }) => {
      const { error } = await need().rpc('approve_member', {
        p_member_id: p.id,
        p_role: p.role ?? 'member',
        p_is_aufgieser: p.is_aufgieser ?? false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: ['current-member'] });
    },
  });
}

// ─── Invitations (Migration 0035) ────────────────────────────────────────
export function useInvitations() {
  return useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_invitations');
      if (error) throw error;
      return (data ?? []) as Invitation[];
    },
  });
}

export function useCreateInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      target_role: MemberRole;
      target_is_aufgieser?: boolean;
      note?: string | null;
      expires_at?: string | null;
    }) => {
      const { data, error } = await need().rpc('create_invitation', {
        p_target_role: p.target_role,
        p_target_is_aufgieser: p.target_is_aufgieser ?? false,
        p_note: p.note ?? null,
        p_expires_at: p.expires_at ?? null,
      });
      if (error) throw error;
      return data as Invitation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations'] }),
  });
}

export function useRevokeInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().rpc('revoke_invitation', { p_id: id });
      if (error) {
        if ((error as { message?: string }).message?.includes('not_revocable')) {
          throw new Error('Diese Einladung kann nicht mehr widerrufen werden (bereits eingelöst).');
        }
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations'] }),
  });
}

// ─── Email-Versand (Stufe 1) ─────────────────────────────────────────────
export function useSendInviteEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { invitation_id: string; recipient_email: string; recipient_name?: string | null }) => {
      const r = await fetch('/api/email?action=send-invite', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(p),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'send failed');
      return data as { ok: true; sent_via: 'admin_account' | 'system_fallback'; sender_email: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations'] }),
  });
}

export function useSendHandbookEmail() {
  return useMutation({
    mutationFn: async (p: { recipients?: string[]; audience?: 'all' | 'aufgieser' | 'admins' }) => {
      const r = await fetch('/api/email?action=send-handbook', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(p),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'send failed');
      return data as { ok: true; sent: number; failed: number; recipient_count: number };
    },
  });
}

export function useBroadcastHandbookTelegram() {
  return useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/telegram-webhook?action=broadcast_handbook', {
        method: 'POST',
        headers: await authHeaders(),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'broadcast failed');
      return data as { ok: true; sent: number; failed?: number; note?: string };
    },
  });
}

export function useSendWelcomeEmail() {
  return useMutation({
    mutationFn: async (p: { member_id: string; role_label: string }) => {
      const r = await fetch('/api/email?action=send-welcome', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(p),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'send failed');
      return data;
    },
  });
}

// ─── Email-Konten (Stufe 2) ──────────────────────────────────────────────
export type EmailAccount = {
  id: string;
  member_id: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  display_name: string | null;
  active: boolean;
  granted_by: string | null;
  granted_at: string;
  last_sync_at: string | null;
  unread_count: number;
  created_at: string;
};

export function useMyEmailAccount() {
  return useQuery({
    queryKey: ['my-email-account'],
    queryFn: async () => {
      const { data, error } = await need().rpc('my_email_account');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as EmailAccount | null;
    },
  });
}

export function useAdminEmailAccounts() {
  return useQuery({
    queryKey: ['admin-email-accounts'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_email_accounts_admin');
      if (error) throw error;
      return (data ?? []) as EmailAccount[];
    },
  });
}

export function useGrantEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      member_id: string;
      email: string;
      password: string;
      imap_host?: string;
      imap_port?: number;
      smtp_host?: string;
      smtp_port?: number;
      display_name?: string | null;
    }) => {
      const { data, error } = await need().rpc('grant_email_account', {
        p_member_id: p.member_id,
        p_email: p.email,
        p_password: p.password,
        p_imap_host: p.imap_host ?? 'w01b00df.kasserver.com',
        p_imap_port: p.imap_port ?? 993,
        p_smtp_host: p.smtp_host ?? 'w01b00df.kasserver.com',
        p_smtp_port: p.smtp_port ?? 465,
        p_display_name: p.display_name ?? null,
      });
      if (error) {
        const msg = (error as { message?: string }).message ?? '';
        if (msg.includes('not_admin')) throw new Error('Nur Admins können Postfächer vergeben.');
        if (msg.includes('invalid_email')) throw new Error('Ungültige E-Mail-Adresse.');
        if (msg.includes('password_required')) throw new Error('Passwort fehlt.');
        throw error;
      }
      return data as EmailAccount;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-email-accounts'] });
      qc.invalidateQueries({ queryKey: ['my-email-account'] });
    },
  });
}

export function useRevokeEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().rpc('revoke_email_account', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-email-accounts'] });
      qc.invalidateQueries({ queryKey: ['my-email-account'] });
    },
  });
}

export function useTestEmailConnection() {
  return useMutation({
    mutationFn: async (member_id: string) => {
      const r = await fetch('/api/email?action=test-connection', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ member_id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'test failed');
      return data as {
        ok: boolean;
        imap: { ok: boolean; error?: string };
        smtp: { ok: boolean; error?: string };
        email: string;
      };
    },
  });
}

export function useSetHomeGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (group: string | null) => {
      const { error } = await need().rpc('set_my_home_group', { p_group: group ?? '' });
      if (error) {
        if ((error as { message?: string }).message?.includes('home_group_too_long')) {
          throw new Error('Landesgruppe darf max. 80 Zeichen lang sein.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-member'] });
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: ['members-directory'] });
    },
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<Member> & { id: string }) => {
      const { id, ...rest } = m;
      const { error } = await need().from('members').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: ['present'] });
    },
  });
}

export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await need().rpc('delete_member', { p_member_id: memberId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: ['present'] });
      qc.invalidateQueries({ queryKey: ['pending'] });
      qc.invalidateQueries({ queryKey: ['members-directory'] });
    },
  });
}

export function usePresentMembers() {
  return useQuery({
    queryKey: ['present'],
    queryFn: async () => {
      const { data, error } = await need()
        .from('members')
        .select('id,name,last_scan_at,is_aufgieser,avatar_path')
        .eq('is_present', true)
        .is('revoked_at', null)
        .order('name');
      if (error) throw error;
      return data as { id: string; name: string; last_scan_at: string | null; is_aufgieser: boolean; avatar_path: string | null }[];
    },
  });
}

// ─── Self-Presence (Migration 0050) ──────────────────────────────────────

export function useToggleMyPresence() {
  const qc = useQueryClient();
  return useMutation<boolean, Error, void>({
    mutationFn: async () => {
      const { data, error } = await need().rpc('toggle_my_presence');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row?.is_present as boolean;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-member'] });
      qc.invalidateQueries({ queryKey: ['present'] });
    },
  });
}

// ─── Scanner RPCs ─────────────────────────────────────────────────────────
export async function togglePresenceByCode(code: string) {
  const { data, error } = await need().rpc('toggle_presence', { p_member_code: code });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { member_id: string; name: string; is_present: boolean };
}

export async function togglePresenceByEntryCode(code: string) {
  const { data, error } = await need().rpc('toggle_presence_by_entry_code', { p_code: code });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { member_id: string; name: string; is_present: boolean };
}

// Pre-Check ob ein Einlass-Code frei ist (Migration 0025).
// true = frei (oder gehört mir bereits selbst — beim Re-Edit kein Konflikt).
export async function checkEntryCodeAvailable(code: string): Promise<boolean> {
  const trimmed = code.trim();
  if (!trimmed) return true;
  const { data, error } = await need().rpc('entry_code_available', { p_code: trimmed });
  if (error) throw error;
  return data === true;
}

export function useUpdateEntryCode() {
  const qc = useQueryClient();
  return useMutation({
    // Nutzt set_my_entry_code RPC (Migration 0026) — der direkte UPDATE auf
    // members hat wegen members_write_admin-RLS für Nicht-Admins silent
    // versagt. Die RPC läuft mit SECURITY DEFINER und findet den Member
    // über auth_user_id = auth.uid(). Das id-Argument wird ignoriert.
    mutationFn: async ({ entry_code }: { id?: string; entry_code: string | null }) => {
      const { error } = await need().rpc('set_my_entry_code', { p_code: entry_code });
      if (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new Error('Dieser PIN ist schon vergeben — bitte einen anderen wählen.');
        }
        if ((error as { message?: string }).message?.includes('invalid_code_length')) {
          throw new Error('Code muss 4–8 Zeichen lang sein.');
        }
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['current-member'] }),
  });
}

// ─── Team-Aufgüsse (Co-Aufgieser) ────────────────────────────────────────
export type CoAufgieserEntry = {
  id: string;
  infusion_id: string;
  member_id: string;
  joined_at: string;
  member_name?: string;
};

export function useCoAufgieser(infusionIds: string[]) {
  return useQuery({
    queryKey: ['co-aufgieser', ...infusionIds.sort()],
    enabled: infusionIds.length > 0,
    queryFn: async () => {
      if (!infusionIds.length) return [] as CoAufgieserEntry[];
      const { data, error } = await need()
        .from('infusion_co_aufgieser')
        .select('*, members(name)')
        .in('infusion_id', infusionIds);
      if (error) throw error;
      type RawRow = { id: string; infusion_id: string; member_id: string; joined_at: string; members: { name: string } | null };
      return (data as RawRow[] ?? []).map((row) => ({
        id: row.id,
        infusion_id: row.infusion_id,
        member_id: row.member_id,
        joined_at: row.joined_at,
        member_name: row.members?.name,
      })) as CoAufgieserEntry[];
    },
  });
}

export function useJoinTeamInfusion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ infusion_id, member_id }: { infusion_id: string; member_id: string }) => {
      const { error } = await need().from('infusion_co_aufgieser').insert({ infusion_id, member_id });
      if (error) {
        // Trigger aus Migration 0024 → max 2 Co-Aufgießer pro Team-Aufguss
        if (error.message?.includes('team_aufguss_voll')) {
          throw new Error('Team-Aufguss ist voll — beide Slots sind bereits vergeben.');
        }
        // Unique-Constraint: schon dabei
        if (error.code === '23505') {
          throw new Error('Du bist bereits in diesem Team-Aufguss eingebucht.');
        }
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['co-aufgieser'] }),
  });
}

export function useLeaveTeamInfusion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ infusion_id, member_id }: { infusion_id: string; member_id: string }) => {
      const { error } = await need()
        .from('infusion_co_aufgieser')
        .delete()
        .eq('infusion_id', infusion_id)
        .eq('member_id', member_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['co-aufgieser'] }),
  });
}

// ─── Evacuation ───────────────────────────────────────────────────────────
export type EvacuationEvent = {
  id: string;
  triggered_by: string | null;
  triggered_at: string;
  ended_at: string | null;
  present_count: number;
  present_names: string[];
  telegram_status: string | null;
};

export function useActiveEvacuation() {
  return useQuery({
    queryKey: ['evacuation', 'active'],
    queryFn: async () => {
      const { data, error } = await need()
        .from('evacuation_events')
        .select('*')
        .is('ended_at', null)
        .order('triggered_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as EvacuationEvent | null;
    },
  });
}

export function useTriggerEvacuation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { triggered_by: string; present_names: string[]; telegram_status?: string }) => {
      const { data, error } = await need()
        .from('evacuation_events')
        .insert({
          triggered_by: p.triggered_by,
          present_names: p.present_names,
          present_count: p.present_names.length,
          telegram_status: p.telegram_status ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as EvacuationEvent;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evacuation'] }),
  });
}

export function useEndEvacuation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need()
        .from('evacuation_events')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evacuation'] }),
  });
}

// ─── Stats ────────────────────────────────────────────────────────────────
export function useStatsByMeister(from: Date, to: Date) {
  return useQuery({
    queryKey: ['stats', 'by-meister', from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const { data, error } = await need().rpc('stats_infusions_by_meister', {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      });
      if (error) throw error;
      return (data ?? []) as { member_id: string; name: string; count: number }[];
    },
  });
}

export function useStatsByMonth(year: number) {
  return useQuery({
    queryKey: ['stats', 'by-month', year],
    queryFn: async () => {
      const { data, error } = await need().rpc('stats_infusions_by_month', { p_year: year });
      if (error) throw error;
      return (data ?? []) as { month: number; count: number }[];
    },
  });
}

export function useStatsPresenceByDay(from: Date, to: Date) {
  return useQuery({
    queryKey: ['stats', 'presence', from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const { data, error } = await need().rpc('stats_presence_by_day', {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      });
      if (error) throw error;
      return (data ?? []) as { day: string; count: number }[];
    },
  });
}

// ─── system_config (TV settings) ──────────────────────────────────────────
export type TvSettings = {
  ads: { image_path: string; href?: string | null }[];
  background_path?: string | null;       // legacy / dashboard
  logo_path: string | null;
  backgrounds?: {
    dashboard?: string | null;
    guest?: string | null;
    planner?: string | null;
    wm?: string | null;
  };
  badge?: {
    front_bg?: string | null;
    back_bg?: string | null;
  };
  tile_bgs?: {
    [saunaId: string]: (string | null)[];
  };
};

// ─── brand_settings (zentrale Vereins-Identität, Migration 0039) ────────
export function useBrandSettings() {
  return useQuery({
    queryKey: ['brand-settings'],
    queryFn: async () => {
      const { data, error } = await need()
        .from('system_config')
        .select('value')
        .eq('key', 'brand_settings')
        .maybeSingle();
      if (error) throw error;
      return mergeBrandDefaults(data?.value as Partial<BrandSettings> | undefined);
    },
  });
}

export function useUpdateBrandSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (next: BrandSettings) => {
      const { error } = await need()
        .from('system_config')
        .upsert({ key: 'brand_settings', value: next });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-settings'] });
      qc.invalidateQueries({ queryKey: ['tv-settings'] });
    },
  });
}

/** Shortcut: Brand-Settings synchronisiert ohne Loading-State — Defaults wenn noch nicht geladen. */
export function useBrandSync(): BrandSettings {
  const q = useBrandSettings();
  return q.data ?? defaultBrandSettings();
}

export const brandAssetUrl = publicAssetUrl; // Alias für klarere Semantik

export function useTvSettings() {
  return useQuery({
    queryKey: ['tv-settings'],
    queryFn: async () => {
      const { data, error } = await need()
        .from('system_config')
        .select('value')
        .eq('key', 'tv_settings')
        .maybeSingle();
      if (error) throw error;
      return (data?.value ?? { ads: [], background_path: null, logo_path: null, tile_bgs: {} }) as TvSettings;
    },
  });
}

export function useUpdateTvSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (next: TvSettings) => {
      const { error } = await need()
        .from('system_config')
        .upsert({ key: 'tv_settings', value: next });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tv-settings'] }),
  });
}

// ─── Polls ────────────────────────────────────────────────────────────────
export type PollAnswerType = 'text' | 'yesno' | 'choice' | 'number';

export type Poll = {
  id: string;
  title: string;
  description: string | null;
  answer_type: PollAnswerType;
  choices: string[] | null;
  deadline: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
};

export type MyPoll = Poll & { my_answer: string | null };

export type PollResult = {
  member_name: string;
  member_number: number | null;
  answer: string;
  answered_at: string;
};

export function useMyPolls() {
  return useQuery({
    queryKey: ['my-polls'],
    queryFn: async () => {
      const { data, error } = await need().rpc('my_open_polls');
      if (error) throw error;
      return (data ?? []) as MyPoll[];
    },
  });
}

export function useAllPolls() {
  return useQuery({
    queryKey: ['polls'],
    queryFn: async () => {
      const { data, error } = await need().from('polls').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Poll[];
    },
  });
}

export function useCreatePoll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Omit<Poll, 'id' | 'created_at' | 'active' | 'created_by'> & { created_by: string }) => {
      const { error } = await need().from('polls').insert({ ...p, active: true });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['polls'] }),
  });
}

export function useTogglePoll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await need().from('polls').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['polls'] }),
  });
}

export function useSubmitPollResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pollId, memberId, answer }: { pollId: string; memberId: string; answer: string }) => {
      const { error } = await need()
        .from('poll_responses')
        .upsert({ poll_id: pollId, member_id: memberId, answer }, { onConflict: 'poll_id,member_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-polls'] }),
  });
}

export async function fetchPollResults(pollId: string): Promise<PollResult[]> {
  const { data, error } = await need().rpc('poll_results', { p_poll_id: pollId });
  if (error) throw error;
  return (data ?? []) as PollResult[];
}

// ─── Sauna-Name ───────────────────────────────────────────────────────────────
export function useSetSaunaName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p_name: string) => {
      const { error } = await need().rpc('set_sauna_name', { p_name });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-member'] });
      qc.invalidateQueries({ queryKey: ['meister-directory'] });
    },
  });
}

// ─── Custom Attribute Buttons ─────────────────────────────────────────────────
export { type MemberCustomAttr };

export function useMyCustomAttrs(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['custom-attrs', memberId ?? 'none'],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need()
        .from('member_custom_attrs')
        .select('*')
        .eq('member_id', memberId!)
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      return data as MemberCustomAttr[];
    },
  });
}

export function useCreateCustomAttr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attr: Pick<MemberCustomAttr, 'member_id' | 'emoji' | 'color' | 'label'>) => {
      const { error } = await need().from('member_custom_attrs').insert(attr);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['custom-attrs', vars.member_id] }),
  });
}

export function useAdminDeleteCustomAttr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, member_id }: { id: string; member_id: string }) => {
      const { error } = await need().from('member_custom_attrs').delete().eq('id', id);
      if (error) throw error;
      return member_id;
    },
    onSuccess: (member_id) => qc.invalidateQueries({ queryKey: ['custom-attrs', member_id] }),
  });
}

export function useToggleCustomAttrsEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await need().from('members').update({ custom_attrs_enabled: enabled }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  });
}

// ─── Achievements & Stats ────────────────────────────────────────────────────

export type MemberStats = {
  total_infusions: number;
  team_infusions: number;
  monthly_infusions: number;
  saunas_used: number;
  total_saunas: number;
  max_per_day: number;
  has_early_bird: boolean;
  has_night_owl: boolean;
};

export type MemberAchievement = {
  id: string;
  member_id: string;
  badge_id: string;
  earned_at: string;
  metadata: Record<string, unknown>;
};

export type LeaderboardEntry = {
  member_id: string;
  name: string;
  sauna_name: string | null;
  count: number;
};

export function useMemberStats(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['member-stats', memberId ?? 'none'],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need().rpc('get_member_stats', { p_member_id: memberId! });
      if (error) throw error;
      return data as MemberStats;
    },
  });
}

export function useMyBadges(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['achievements', memberId ?? 'none'],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need()
        .from('member_achievements')
        .select('*')
        .eq('member_id', memberId!)
        .order('earned_at');
      if (error) throw error;
      return data as MemberAchievement[];
    },
  });
}

export function useAllMembersBadges() {
  return useQuery({
    queryKey: ['achievements', 'all'],
    queryFn: async () => {
      const { data, error } = await need()
        .from('member_achievements')
        .select('*');
      if (error) throw error;
      return data as MemberAchievement[];
    },
  });
}

export function useMonthlyLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard', 'monthly'],
    queryFn: async () => {
      const { data, error } = await need().rpc('get_monthly_leaderboard');
      if (error) throw error;
      return (data ?? []) as LeaderboardEntry[];
    },
  });
}

export function useAwardBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, badgeId, metadata = {} }: { memberId: string; badgeId: string; metadata?: Record<string, unknown> }) => {
      const { data, error } = await need().rpc('award_badge', {
        p_member_id: memberId,
        p_badge_id: badgeId,
        p_metadata: metadata,
      });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['achievements', vars.memberId] });
      qc.invalidateQueries({ queryKey: ['achievements', 'all'] });
    },
  });
}

// ─── Ratings ─────────────────────────────────────────────────────────────────

export type InfusionRating = {
  id: string;
  infusion_id: string;
  member_id: string;
  chemie: number | null;
  luftbewegung: number | null;
  wedeltechnik: number | null;
  hitzeniveau: number | null;
  musik: number | null;
  duftentwicklung: number | null;
  comment: string | null;
  created_at: string;
};

export type RatingAvg = {
  chemie: number | null;
  luftbewegung: number | null;
  wedeltechnik: number | null;
  hitzeniveau: number | null;
  musik: number | null;
  duftentwicklung: number | null;
  total_ratings: number;
};

export type RatableInfusion = {
  id: string;
  title: string;
  sauna_id: string;
  saunameister_id: string;
  start_time: string;
  end_time: string;
  already_rated: boolean;
};

export type SubmitRatingResult =
  | 'ok'
  | 'self_rating_not_allowed'
  | 'infusion_not_finished'
  | 'rating_window_expired'
  | 'not_present';

export function useRatableInfusions(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['ratable-infusions', memberId ?? 'none'],
    enabled: !!memberId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await need().rpc('get_ratable_infusions', { p_member_id: memberId! });
      if (error) throw error;
      return (data ?? []) as RatableInfusion[];
    },
  });
}

export function useInfusionRatings(infusionId: string | null | undefined) {
  return useQuery({
    queryKey: ['ratings', infusionId ?? 'none'],
    enabled: !!infusionId,
    queryFn: async () => {
      const { data, error } = await need()
        .from('infusion_ratings')
        .select('*')
        .eq('infusion_id', infusionId!);
      if (error) throw error;
      return data as InfusionRating[];
    },
  });
}

export function useMyRatingForInfusion(infusionId: string | null | undefined, memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['my-rating', infusionId ?? 'none', memberId ?? 'none'],
    enabled: !!infusionId && !!memberId,
    queryFn: async () => {
      const { data, error } = await need()
        .from('infusion_ratings')
        .select('*')
        .eq('infusion_id', infusionId!)
        .eq('member_id', memberId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as InfusionRating | null;
    },
  });
}

export function useMeisterRatingAvg(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['rating-avg', memberId ?? 'none'],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need().rpc('get_meister_rating_avg', { p_member_id: memberId! });
      if (error) throw error;
      return (data ?? null) as RatingAvg | null;
    },
  });
}

export function useSubmitRating() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      infusion_id: string;
      member_id: string;
      chemie: number;
      luftbewegung: number;
      wedeltechnik: number;
      hitzeniveau: number;
      musik: number;
      duftentwicklung: number;
      comment?: string | null;
    }): Promise<SubmitRatingResult> => {
      const { data, error } = await need().rpc('submit_rating', {
        p_infusion_id: p.infusion_id,
        p_member_id: p.member_id,
        p_chemie: p.chemie,
        p_luftbewegung: p.luftbewegung,
        p_wedeltechnik: p.wedeltechnik,
        p_hitzeniveau: p.hitzeniveau,
        p_musik: p.musik,
        p_duftentwicklung: p.duftentwicklung,
        p_comment: p.comment ?? null,
      });
      if (error) throw error;
      return (data as SubmitRatingResult) ?? 'ok';
    },
    onSuccess: (_result, vars) => {
      qc.invalidateQueries({ queryKey: ['ratable-infusions'] });
      qc.invalidateQueries({ queryKey: ['ratings', vars.infusion_id] });
      qc.invalidateQueries({ queryKey: ['my-rating', vars.infusion_id] });
      qc.invalidateQueries({ queryKey: ['rating-avg', vars.member_id] });
    },
  });
}

export function useCountMemberRatings(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['rating-count', memberId ?? 'none'],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need().rpc('count_member_ratings', { p_member_id: memberId! });
      if (error) throw error;
      return (data ?? 0) as number;
    },
  });
}

// ─── WM-Tipspiel ────────────────────────────────────────────────────────────

export type WmPhase = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final';

export type WmTeam = {
  id: string;
  code: string;
  name: string;
  flag: string;
  group_label: string | null;
};

export type WmMatch = {
  id: string;
  match_no: number;
  phase: WmPhase;
  group_label: string | null;
  kickoff: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_label: string | null;
  away_label: string | null;
  score_home: number | null;
  score_away: number | null;
  locked: boolean;
};

export type WmTip = {
  id: string;
  member_id: string;
  match_id: string;
  tip_outcome: 'home' | 'draw' | 'away';
  score_home_guess: number | null;
  score_away_guess: number | null;
  joker: boolean;
  points_earned: number;
  created_at: string;
  updated_at: string;
};

export type WmMetaTip = {
  member_id: string;
  champion_team_id: string | null;
  group_advance_picks: Record<string, string[]>;
  champion_bonus_earned: number;
  group_bonus_earned: number;
};

export type WmLeaderboardEntry = {
  member_id: string;
  name: string;
  sauna_name: string | null;
  total_points: number;
  match_points: number;
  champion_bonus: number;
  group_bonus: number;
  streak_bonus: number;
  tips_total: number;
  tips_correct: number;
};

export type WmGroupRow = {
  team_id: string;
  team_name: string;
  flag: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
};

export function useWmTeams() {
  return useQuery({
    queryKey: ['wm-teams'],
    queryFn: async () => {
      const { data, error } = await need().from('wm_teams').select('*').order('group_label').order('name');
      if (error) throw error;
      return data as WmTeam[];
    },
  });
}

export function useWmMatches() {
  return useQuery({
    queryKey: ['wm-matches'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await need().from('wm_matches').select('*').order('match_no');
      if (error) throw error;
      return data as WmMatch[];
    },
  });
}

export function useMyWmTips(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['wm-tips', 'mine', memberId ?? 'none'],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need().from('wm_tips').select('*').eq('member_id', memberId!);
      if (error) throw error;
      return data as WmTip[];
    },
  });
}

export function useAllWmTips() {
  return useQuery({
    queryKey: ['wm-tips', 'all'],
    queryFn: async () => {
      const { data, error } = await need().from('wm_tips').select('*');
      if (error) throw error;
      return data as WmTip[];
    },
  });
}

export function useMyWmMetaTip(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['wm-meta', memberId ?? 'none'],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need().from('wm_meta_tips').select('*').eq('member_id', memberId!).maybeSingle();
      if (error) throw error;
      return (data ?? null) as WmMetaTip | null;
    },
  });
}

export function useWmLeaderboard() {
  return useQuery({
    queryKey: ['wm-leaderboard'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await need().rpc('get_wm_leaderboard');
      if (error) throw error;
      return (data ?? []) as WmLeaderboardEntry[];
    },
  });
}

export function useWmGroupStandings(groupLabel: string | null) {
  return useQuery({
    queryKey: ['wm-standings', groupLabel ?? 'none'],
    enabled: !!groupLabel,
    queryFn: async () => {
      const { data, error } = await need().rpc('wm_group_standings', { p_group: groupLabel });
      if (error) throw error;
      return (data ?? []) as WmGroupRow[];
    },
  });
}

export function useWmSettings() {
  return useQuery({
    queryKey: ['wm-settings'],
    queryFn: async () => {
      const { data, error } = await need().from('wm_settings').select('*');
      if (error) throw error;
      const map: Record<string, unknown> = {};
      for (const row of (data ?? []) as { key: string; value: unknown }[]) {
        map[row.key] = row.value;
      }
      return map;
    },
  });
}

export type SubmitWmTipResult = 'ok' | 'tipping_closed' | 'joker_already_used_in_phase' | 'not_authorized' | 'match_not_found';

export function useSubmitWmTip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      match_id: string;
      outcome: 'home' | 'draw' | 'away';
      score_home?: number | null;
      score_away?: number | null;
      joker?: boolean;
    }): Promise<SubmitWmTipResult> => {
      const { data, error } = await need().rpc('submit_wm_tip', {
        p_match_id: p.match_id,
        p_outcome: p.outcome,
        p_score_home: p.score_home ?? null,
        p_score_away: p.score_away ?? null,
        p_joker: p.joker ?? false,
      });
      if (error) throw error;
      return (data as SubmitWmTipResult) ?? 'ok';
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wm-tips'] });
      qc.invalidateQueries({ queryKey: ['wm-leaderboard'] });
    },
  });
}

export function useSubmitWmMetaTip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { champion_id: string | null; picks: Record<string, string[]> }) => {
      const { data, error } = await need().rpc('submit_wm_meta_tip', {
        p_champion_id: p.champion_id,
        p_picks: p.picks,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wm-meta'] });
      qc.invalidateQueries({ queryKey: ['wm-leaderboard'] });
    },
  });
}

export function useRecordWmResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { match_id: string; score_home: number; score_away: number }) => {
      const { error } = await need().rpc('record_wm_result', {
        p_match_id: p.match_id,
        p_score_home: p.score_home,
        p_score_away: p.score_away,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wm-matches'] });
      qc.invalidateQueries({ queryKey: ['wm-tips'] });
      qc.invalidateQueries({ queryKey: ['wm-leaderboard'] });
      qc.invalidateQueries({ queryKey: ['wm-standings'] });
    },
  });
}

export function useUpsertWmMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      match_no: number;
      phase: WmPhase;
      group_label: string | null;
      kickoff: string;
      home_team: string | null;
      away_team: string | null;
      home_label?: string | null;
      away_label?: string | null;
    }) => {
      const { error } = await need().rpc('upsert_wm_match', {
        p_match_no: p.match_no,
        p_phase: p.phase,
        p_group_label: p.group_label,
        p_kickoff: p.kickoff,
        p_home_team: p.home_team,
        p_away_team: p.away_team,
        p_home_label: p.home_label ?? null,
        p_away_label: p.away_label ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wm-matches'] }),
  });
}

export function useSetWmMatchTeams() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { match_id: string; home_team: string | null; away_team: string | null; home_label?: string | null; away_label?: string | null }) => {
      const { error } = await need().rpc('set_wm_match_teams', {
        p_match_id: p.match_id,
        p_home_team: p.home_team,
        p_away_team: p.away_team,
        p_home_label: p.home_label ?? null,
        p_away_label: p.away_label ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wm-matches'] }),
  });
}

export function useAwardWmChampions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await need().rpc('award_wm_champions');
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['achievements'] });
    },
  });
}

export function useWmPendingTippers(matchId: string | null) {
  return useQuery({
    queryKey: ['wm-pending', matchId ?? 'none'],
    enabled: !!matchId,
    queryFn: async () => {
      const { data, error } = await need().rpc('wm_pending_tippers', { p_match_id: matchId });
      if (error) throw error;
      return (data ?? []) as { member_id: string; name: string }[];
    },
  });
}

// ─── Storage helpers ──────────────────────────────────────────────────────
export function publicAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const c = supabase;
  if (!c) return null;
  const { data } = c.storage.from('assets').getPublicUrl(path);
  return data.publicUrl;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

// Skip recompression for vector/animated formats
const SKIP_COMPRESS = new Set(['image/svg+xml', 'image/gif']);

async function compressImage(
  file: File,
  opts: { maxEdge?: number; quality?: number; maxBytes?: number } = {},
): Promise<File> {
  const { maxEdge = 1920, quality = 0.82, maxBytes = 500_000 } = opts;
  if (SKIP_COMPRESS.has(file.type)) return file;
  // Already small enough → don't re-encode
  if (file.size <= maxBytes) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const ratio = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) { bitmap.close?.(); return file; }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  // PNG with transparency → keep PNG; otherwise JPEG (much smaller for photos)
  const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob: Blob | null = await new Promise(res => canvas.toBlob(res, outType, quality));
  if (!blob || blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, '');
  const newExt = outType === 'image/png' ? 'png' : 'jpg';
  return new File([blob], `${baseName}.${newExt}`, { type: outType });
}

export async function uploadAsset(file: File, folder = 'ads'): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`Ungültiger Dateityp: ${file.type}. Erlaubt: JPEG, PNG, WebP, GIF, SVG.`);
  }
  const compressed = await compressImage(file);
  const ext = compressed.name.split('.').pop() ?? 'bin';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await need().storage.from('assets').upload(path, compressed, {
    cacheControl: '3600',
    upsert: false,
    contentType: compressed.type,
  });
  if (error) throw error;
  return path;
}

export async function deleteAsset(path: string): Promise<void> {
  await need().storage.from('assets').remove([path]);
}

// ─── Calendar-Feed (iCal) + Telegram-Linking (Migration 0038) ───────────
export function useMyCalendarToken() {
  return useQuery({
    queryKey: ['my-calendar-token'],
    queryFn: async () => {
      const { data, error } = await need().rpc('my_calendar_token');
      if (error) throw error;
      return (data ?? null) as string | null;
    },
  });
}

export function useRotateCalendarToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await need().rpc('rotate_my_calendar_token');
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-calendar-token'] }),
  });
}

export function calendarFeedUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://saunascaner.vercel.app';
  return `${origin}/api/email?action=calendar&token=${token}`;
}

export function useGenerateTelegramLinkToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await need().rpc('generate_my_telegram_link_token');
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['current-member'] }),
  });
}

export function useUnlinkTelegram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await need().rpc('unlink_my_telegram');
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['current-member'] }),
  });
}

export function telegramStartUrl(token: string): string {
  const bot = (typeof window !== 'undefined' && window.localStorage)
    ? (window.localStorage.getItem('TELEGRAM_BOT_USERNAME') ?? 'saunafreunde_bot')
    : 'saunafreunde_bot';
  return `https://t.me/${bot}?start=${token}`;
}

// ─── Stamm-Aufgießer-Slots (Migration 0027/0032) ─────────────────────────
export function useRecurringSlots() {
  return useQuery({
    queryKey: ['recurring-slots'],
    queryFn: async () => {
      const { data, error } = await need().from('recurring_slots').select('*').order('weekday').order('slot_hour');
      if (error) throw error;
      return (data ?? []) as RecurringSlot[];
    },
  });
}

export function useMyRecurringSlots(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['recurring-slots', 'mine', memberId ?? 'none'],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need().from('recurring_slots').select('*').eq('member_id', memberId!).order('weekday').order('slot_hour');
      if (error) throw error;
      return (data ?? []) as RecurringSlot[];
    },
  });
}

export function useApplyRecurringSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { weekday: number; hour: number; sauna_id: string; note?: string | null; template_id?: string | null }) => {
      const { data, error } = await need().rpc('apply_recurring_slot', {
        p_weekday: p.weekday,
        p_hour: p.hour,
        p_sauna_id: p.sauna_id,
        p_note: p.note ?? null,
        p_template_id: p.template_id ?? null,
      });
      if (error) {
        const msg = (error as { message?: string }).message ?? '';
        if (msg.includes('duplicate_request')) throw new Error('Du hast für diesen Slot schon einen offenen oder aktiven Antrag.');
        if (msg.includes('not_aufgieser')) throw new Error('Nur Aufgießer können Stamm-Slots beantragen.');
        if (msg.includes('invalid_weekday_mo')) throw new Error('Montag ist Ruhetag — kein Stamm-Slot möglich.');
        if (msg.includes('invalid_hour')) throw new Error('Ungültige Stunde — nur 11:00 bis 20:00.');
        if (msg.includes('invalid_sauna')) throw new Error('Die gewählte Sauna ist nicht aktiv.');
        if (msg.includes('invalid_template')) throw new Error('Die gewählte Vorlage existiert nicht oder gehört einem anderen Aufgießer.');
        throw error;
      }
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-slots'] }),
  });
}

// ─── Personal-Fallback übernehmen (Migration 0034) ───────────────────────
export function useTakeoverPersonalFallback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      infusion_id: string;
      title: string;
      description?: string | null;
      attributes?: string[];
      oils?: (string | null)[] | null;
      team_infusion?: boolean;
    }) => {
      const { error } = await need().rpc('takeover_personal_fallback', {
        p_infusion_id: p.infusion_id,
        p_title: p.title,
        p_description: p.description ?? null,
        p_attributes: p.attributes ?? [],
        p_oils: p.oils ?? null,
        p_team_infusion: p.team_infusion ?? false,
      });
      if (error) {
        const msg = (error as { message?: string }).message ?? '';
        if (msg.includes('not_aufgieser')) throw new Error('Nur Aufgießer können Personal-Aufgüsse übernehmen.');
        if (msg.includes('not_a_fallback')) throw new Error('Dieser Aufguss ist kein Personal-Aufguss.');
        if (msg.includes('slot_in_past')) throw new Error('Slot liegt in der Vergangenheit.');
        if (msg.includes('title_required')) throw new Error('Titel fehlt.');
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infusions'] }),
  });
}

export function useApproveRecurringSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().rpc('approve_recurring_slot', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-slots'] });
      qc.invalidateQueries({ queryKey: ['infusions'] });
    },
  });
}

export function useRejectRecurringSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().rpc('reject_recurring_slot', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-slots'] }),
  });
}

export function useRevokeMyRecurringSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().rpc('revoke_my_recurring_slot', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-slots'] });
      qc.invalidateQueries({ queryKey: ['infusions'] });
    },
  });
}

// ─── Abwesenheit / Urlaub (Migration 0028) ───────────────────────────────
export function useAbsences(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['absences', memberId ?? 'all'],
    queryFn: async () => {
      let q = need().from('aufgieser_absences').select('*').order('start_date', { ascending: false });
      if (memberId) q = q.eq('member_id', memberId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AufgieserAbsence[];
    },
  });
}

export type FreedSlot = {
  infusion_id: string;
  start_time: string;
  sauna_id: string;
  sauna_name: string;
};

export function useAddAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { start: string; end: string; note?: string | null }) => {
      const { data, error } = await need().rpc('add_absence', {
        p_start: p.start,
        p_end: p.end,
        p_note: p.note ?? null,
      });
      if (error) {
        const msg = (error as { message?: string }).message ?? '';
        if (msg.includes('not_aufgieser')) throw new Error('Nur Aufgießer können Urlaub eintragen.');
        if (msg.includes('invalid_range')) throw new Error('End-Datum muss nach Start-Datum liegen.');
        throw error;
      }
      const result = data as { absence_id: string; freed_slots: FreedSlot[] };
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['absences'] });
      qc.invalidateQueries({ queryKey: ['infusions'] });
    },
  });
}

export function useDeleteAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().rpc('delete_absence', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['absences'] }),
  });
}

// ─── Sperr-Check Sauna-2 (Migration 0033) ────────────────────────────────
export function useCanPlanSecondary(dayIsoDate: string | null) {
  return useQuery({
    queryKey: ['can-plan-secondary', dayIsoDate ?? 'none'],
    enabled: !!dayIsoDate,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await need().rpc('can_plan_secondary', { p_day: dayIsoDate });
      if (error) throw error;
      return data === true;
    },
  });
}

export function useMaterializeHorizon() {
  const qc = useQueryClient();
  return useMutation<number, Error, number>({
    mutationFn: async (weeks: number) => {
      const { data, error } = await need().rpc('materialize_infusion_horizon', { p_weeks: weeks });
      if (error) throw error;
      return (data ?? 0) as number;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infusions'] }),
  });
}

// ─── Social-Layer: Aufgießer-Stars + Following (Migrationen 0040–0042) ───

import type { StarStats, AufgieserStar, FollowEntry, TopFan } from '@/types/database';

export const STAR_SPECIALTIES = [
  'salz', 'honig', 'birke', 'eis', 'musik', 'licht', 'kraeuter', 'show',
] as const;
export type StarSpecialty = typeof STAR_SPECIALTIES[number];

export const SPECIALTY_LABELS: Record<StarSpecialty, { emoji: string; label: string }> = {
  salz:     { emoji: '🧂', label: 'Salz' },
  honig:    { emoji: '🍯', label: 'Honig' },
  birke:    { emoji: '🌿', label: 'Birke' },
  eis:      { emoji: '🧊', label: 'Eis' },
  musik:    { emoji: '🎵', label: 'Musik' },
  licht:    { emoji: '✨', label: 'Licht' },
  kraeuter: { emoji: '🌱', label: 'Kräuter' },
  show:     { emoji: '🎭', label: 'Show' },
};

export function useAufgieserStars() {
  return useQuery({
    queryKey: ['aufgieser-stars'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_aufgieser_stars');
      if (error) throw error;
      return (data ?? []) as AufgieserStar[];
    },
    staleTime: 30_000,
  });
}

export function useStarStats(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['star-stats', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need().rpc('get_star_stats', { p_member_id: memberId });
      if (error) throw error;
      return data as StarStats;
    },
    staleTime: 20_000,
  });
}

export type StarProfilePatch = {
  bio?: string | null;
  story?: string | null;
  signature?: string | null;
  specialties?: string[] | null;
  quote?: string | null;
  visible?: boolean | null;
  accent?: string | null;
};

export function useUpdateMyStarProfile() {
  const qc = useQueryClient();
  return useMutation<void, Error, StarProfilePatch>({
    mutationFn: async (patch) => {
      const { error } = await need().rpc('update_my_star_profile', {
        p_bio: patch.bio ?? null,
        p_story: patch.story ?? null,
        p_signature: patch.signature ?? null,
        p_specialties: patch.specialties ?? null,
        p_quote: patch.quote ?? null,
        p_visible: patch.visible ?? null,
        p_accent: patch.accent ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-member'] });
      qc.invalidateQueries({ queryKey: ['aufgieser-stars'] });
    },
  });
}

export function useFollowMember() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (followeeId) => {
      const { error } = await need().rpc('follow_member', { p_followee: followeeId });
      if (error) throw error;
    },
    onSuccess: (_, followeeId) => {
      qc.invalidateQueries({ queryKey: ['my-following'] });
      qc.invalidateQueries({ queryKey: ['am-i-following', followeeId] });
      qc.invalidateQueries({ queryKey: ['star-stats', followeeId] });
      qc.invalidateQueries({ queryKey: ['aufgieser-stars'] });
    },
  });
}

export function useUnfollowMember() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (followeeId) => {
      const { error } = await need().rpc('unfollow_member', { p_followee: followeeId });
      if (error) throw error;
    },
    onSuccess: (_, followeeId) => {
      qc.invalidateQueries({ queryKey: ['my-following'] });
      qc.invalidateQueries({ queryKey: ['am-i-following', followeeId] });
      qc.invalidateQueries({ queryKey: ['star-stats', followeeId] });
      qc.invalidateQueries({ queryKey: ['aufgieser-stars'] });
    },
  });
}

export function useMyFollowing() {
  return useQuery({
    queryKey: ['my-following'],
    queryFn: async () => {
      const { data, error } = await need().rpc('get_my_following');
      if (error) throw error;
      return (data ?? []) as FollowEntry[];
    },
    staleTime: 60_000,
  });
}

export function useAmIFollowing(followeeId: string | null | undefined) {
  return useQuery({
    queryKey: ['am-i-following', followeeId],
    enabled: !!followeeId,
    queryFn: async () => {
      const { data, error } = await need().rpc('am_i_following', { p_followee: followeeId });
      if (error) throw error;
      return !!data;
    },
    staleTime: 60_000,
  });
}

export function useTopFans(memberId: string | null | undefined, limit = 20) {
  return useQuery({
    queryKey: ['top-fans', memberId, limit],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need().rpc('get_top_fans', { p_member_id: memberId, p_limit: limit });
      if (error) throw error;
      return (data ?? []) as TopFan[];
    },
    staleTime: 30_000,
  });
}

// ─── Checkin-PIN (Migration 0048) ───────────────────────────────────────

export function useMyCheckinPin() {
  return useQuery({
    queryKey: ['my-checkin-pin'],
    queryFn: async () => {
      const { data, error } = await need().rpc('get_my_checkin_pin');
      if (error) throw error;
      return (data ?? null) as string | null;
    },
    staleTime: 60_000,
  });
}

// ─── Unterstützer-Aufgaben (Migration 0049) ─────────────────────────────

export type SupportTaskCategory = 'event' | 'care' | 'material' | 'social' | 'other';
export type SupportTaskVisibility = 'all' | 'member_only' | 'staff_only' | 'aufgieser';

export const SUPPORT_CATEGORY_META: Record<SupportTaskCategory, { emoji: string; label: string }> = {
  event:    { emoji: '🎪', label: 'Event' },
  care:     { emoji: '🌱', label: 'Pflege' },
  material: { emoji: '📦', label: 'Material' },
  social:   { emoji: '☕', label: 'Sozial' },
  other:    { emoji: '🤝', label: 'Sonstiges' },
};

export type SupportTask = {
  id: string;
  title: string;
  description: string | null;
  category: SupportTaskCategory;
  visibility: SupportTaskVisibility;
  start_time: string | null;
  end_time: string | null;
  max_helpers: number | null;
  location: string | null;
  created_at: string;
  requires_approval: boolean;
  helper_count: number;
  pending_count: number;
  is_helping_me: boolean;
  my_status: 'pending' | 'approved' | 'rejected' | null;
  is_full: boolean;
};

export type MySupportTaskEntry = {
  task_id: string;
  title: string;
  description: string | null;
  category: SupportTaskCategory;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  joined_at: string;
  note: string | null;
  left_at: string | null;
  fulfilled_at: string | null;
  archived_at: string | null;
  archived_reason: string | null;
};

export type SupportTaskHelperRow = {
  member_id: string;
  name: string;
  avatar_path: string | null;
  is_aufgieser: boolean;
  joined_at: string;
  note: string | null;
  left_at: string | null;
  fulfilled_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
};

export function useOpenSupportTasks() {
  return useQuery({
    queryKey: ['support-tasks', 'open'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_open_support_tasks');
      if (error) throw error;
      return (data ?? []) as SupportTask[];
    },
    staleTime: 30_000,
  });
}

export function useMySupportTasks(includeArchived = true) {
  return useQuery({
    queryKey: ['support-tasks', 'mine', includeArchived],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_my_support_tasks', { p_include_archived: includeArchived });
      if (error) throw error;
      return (data ?? []) as MySupportTaskEntry[];
    },
    staleTime: 60_000,
  });
}

export function useTaskHelpers(taskId: string | null | undefined) {
  return useQuery({
    queryKey: ['support-task-helpers', taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await need().rpc('list_task_helpers', { p_task_id: taskId });
      if (error) throw error;
      return (data ?? []) as SupportTaskHelperRow[];
    },
    staleTime: 20_000,
  });
}

export function useJoinSupportTask() {
  const qc = useQueryClient();
  return useMutation<void, Error, { taskId: string; note?: string }>({
    mutationFn: async ({ taskId, note }) => {
      const { error } = await need().rpc('join_support_task', { p_task_id: taskId, p_note: note ?? null });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['support-tasks'] });
      qc.invalidateQueries({ queryKey: ['support-task-helpers', vars.taskId] });
    },
  });
}

export function useLeaveSupportTask() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (taskId) => {
      const { error } = await need().rpc('leave_support_task', { p_task_id: taskId });
      if (error) throw error;
    },
    onSuccess: (_, taskId) => {
      qc.invalidateQueries({ queryKey: ['support-tasks'] });
      qc.invalidateQueries({ queryKey: ['support-task-helpers', taskId] });
    },
  });
}

export type CreateSupportTaskInput = {
  title: string;
  description?: string | null;
  category?: SupportTaskCategory;
  visibility?: SupportTaskVisibility;
  start_time?: string | null;
  end_time?: string | null;
  max_helpers?: number | null;
  location?: string | null;
  requires_approval?: boolean;
};

export function useCreateSupportTask() {
  const qc = useQueryClient();
  return useMutation<string, Error, CreateSupportTaskInput>({
    mutationFn: async (input) => {
      const { data, error } = await need().rpc('create_support_task', {
        p_title: input.title,
        p_description: input.description ?? null,
        p_category: input.category ?? 'other',
        p_visibility: input.visibility ?? 'all',
        p_start_time: input.start_time ?? null,
        p_end_time: input.end_time ?? null,
        p_max_helpers: input.max_helpers ?? null,
        p_location: input.location ?? null,
        p_requires_approval: input.requires_approval ?? false,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-tasks'] }),
  });
}

export function useApproveHelper() {
  const qc = useQueryClient();
  return useMutation<void, Error, { taskId: string; memberId: string }>({
    mutationFn: async ({ taskId, memberId }) => {
      const { error } = await need().rpc('approve_helper', { p_task_id: taskId, p_member_id: memberId });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['support-tasks'] });
      qc.invalidateQueries({ queryKey: ['support-task-helpers', vars.taskId] });
    },
  });
}

export function useRejectHelper() {
  const qc = useQueryClient();
  return useMutation<void, Error, { taskId: string; memberId: string }>({
    mutationFn: async ({ taskId, memberId }) => {
      const { error } = await need().rpc('reject_helper', { p_task_id: taskId, p_member_id: memberId });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['support-tasks'] });
      qc.invalidateQueries({ queryKey: ['support-task-helpers', vars.taskId] });
    },
  });
}

export function useArchiveSupportTask() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; reason?: string }>({
    mutationFn: async ({ id, reason }) => {
      const { error } = await need().rpc('archive_support_task', { p_id: id, p_reason: reason ?? 'erledigt' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-tasks'] }),
  });
}

export function useUnarchiveSupportTask() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await need().rpc('unarchive_support_task', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-tasks'] }),
  });
}

export function useMarkHelperFulfilled() {
  const qc = useQueryClient();
  return useMutation<void, Error, { taskId: string; memberId: string; fulfilled: boolean }>({
    mutationFn: async ({ taskId, memberId, fulfilled }) => {
      const { error } = await need().rpc('mark_helper_fulfilled', {
        p_task_id: taskId, p_member_id: memberId, p_fulfilled: fulfilled,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['support-task-helpers', vars.taskId] });
    },
  });
}

export function useRotateMyCheckinPin() {
  const qc = useQueryClient();
  return useMutation<string, Error, void>({
    mutationFn: async () => {
      const { data, error } = await need().rpc('rotate_my_checkin_pin');
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-checkin-pin'] });
    },
  });
}

// ─── Voller Stats-Block für Dashboard (Migration 0045) ──────────────────

export type MemberStatsFull = {
  sauna_days: number;
  streak_weeks: number;
  ratings_given: number;
  avg_rating_given: number | null;
  aufgusse_attended: number;
  unique_aufgieser: number;
  follows_count: number;
  member_since: string;
  favorite_aufgieser: string | null;
  favorite_sauna: string | null;
  attendance_by_month: { month: string; count: number }[];
};

export function useMemberStatsFull(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['member-stats-full', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need().rpc('get_member_stats_full', { p_member_id: memberId });
      if (error) throw error;
      return data as MemberStatsFull;
    },
    staleTime: 30_000,
  });
}

// useMyBadges(memberId) gibt's bereits oben — verwenden wir wieder für Stats-Layer

// ─── Aufgießer-Profil-Social (Migration 0046) ───────────────────────────

export type AufgieserPhoto = {
  id: string;
  member_id: string;
  photo_path: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
};

export type AufgieserComment = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  author_role: MemberRole;
  author_is_aufgieser: boolean;
  content: string;
  parent_id: string | null;
  created_at: string;
  edited_at: string | null;
  like_count: number;
  liked_by_me: boolean;
  can_delete: boolean;
};

export type AufgieserRatingComment = {
  rating_id: string;
  infusion_id: string;
  infusion_title: string;
  rated_at: string;
  author_name: string;
  author_avatar: string | null;
  comment: string;
  avg_score: number;
};

export type RatingRadar = {
  chemie: number;
  luftbewegung: number;
  wedeltechnik: number;
  hitzeniveau: number;
  musik: number;
  duftentwicklung: number;
  sample_size: number;
};

// Foto-Galerie
export function useAufgieserPhotos(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['aufgieser-photos', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need()
        .from('aufgieser_photos')
        .select('*')
        .eq('member_id', memberId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AufgieserPhoto[];
    },
    staleTime: 60_000,
  });
}

export function useAddAufgieserPhoto() {
  const qc = useQueryClient();
  return useMutation<void, Error, { memberId: string; file: File; caption?: string }>({
    mutationFn: async ({ memberId, file, caption }) => {
      const path = await uploadAsset(file, 'aufgieser-photos');
      const sortRes = await need()
        .from('aufgieser_photos')
        .select('sort_order')
        .eq('member_id', memberId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextSort = (sortRes.data?.sort_order ?? -1) + 1;
      const { error } = await need().from('aufgieser_photos').insert({
        member_id: memberId,
        photo_path: path,
        caption: caption?.trim() || null,
        sort_order: nextSort,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['aufgieser-photos', vars.memberId] });
    },
  });
}

export function useDeleteAufgieserPhoto() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; memberId: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await need().from('aufgieser_photos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['aufgieser-photos', vars.memberId] });
    },
  });
}

// Lieblings-Öle
export function useSetMyFavoriteOils() {
  const qc = useQueryClient();
  return useMutation<void, Error, string[]>({
    mutationFn: async (oils) => {
      const { error } = await need().rpc('set_my_favorite_oils', { p_oils: oils });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-member'] });
      qc.invalidateQueries({ queryKey: ['aufgieser-stars'] });
    },
  });
}

// Gästebuch
export function useAufgieserComments(aufgieserId: string | null | undefined, limit = 50) {
  return useQuery({
    queryKey: ['aufgieser-comments', aufgieserId, limit],
    enabled: !!aufgieserId,
    queryFn: async () => {
      const { data, error } = await need().rpc('list_aufgieser_comments', {
        p_aufgieser_id: aufgieserId,
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as AufgieserComment[];
    },
    staleTime: 20_000,
  });
}

export function usePostAufgieserComment() {
  const qc = useQueryClient();
  return useMutation<void, Error, { aufgieserId: string; content: string; parentId?: string | null }>({
    mutationFn: async ({ aufgieserId, content, parentId }) => {
      const meRes = await need().from('members').select('id').eq('auth_user_id', (await need().auth.getUser()).data.user?.id ?? '').maybeSingle();
      if (!meRes.data?.id) throw new Error('not_logged_in');
      const { error } = await need().from('aufgieser_comments').insert({
        aufgieser_id: aufgieserId,
        author_id: meRes.data.id,
        content: content.trim(),
        parent_id: parentId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['aufgieser-comments', vars.aufgieserId] });
    },
  });
}

export function useDeleteAufgieserComment() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; aufgieserId: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await need().from('aufgieser_comments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['aufgieser-comments', vars.aufgieserId] });
    },
  });
}

export function useToggleCommentLike() {
  const qc = useQueryClient();
  return useMutation<void, Error, { commentId: string; aufgieserId: string; currentlyLiked: boolean }>({
    mutationFn: async ({ commentId, currentlyLiked }) => {
      const meRes = await need().from('members').select('id').eq('auth_user_id', (await need().auth.getUser()).data.user?.id ?? '').maybeSingle();
      if (!meRes.data?.id) throw new Error('not_logged_in');
      if (currentlyLiked) {
        const { error } = await need()
          .from('aufgieser_comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('member_id', meRes.data.id);
        if (error) throw error;
      } else {
        const { error } = await need()
          .from('aufgieser_comment_likes')
          .insert({ comment_id: commentId, member_id: meRes.data.id });
        if (error && !String(error.message).includes('duplicate')) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['aufgieser-comments', vars.aufgieserId] });
    },
  });
}

// Rating-Kommentare
export function useAufgieserRatingComments(aufgieserId: string | null | undefined, limit = 10) {
  return useQuery({
    queryKey: ['aufgieser-rating-comments', aufgieserId, limit],
    enabled: !!aufgieserId,
    queryFn: async () => {
      const { data, error } = await need().rpc('list_aufgieser_rating_comments', {
        p_aufgieser_id: aufgieserId,
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as AufgieserRatingComment[];
    },
    staleTime: 60_000,
  });
}

// Rating-Radar
export function useAufgieserRatingRadar(aufgieserId: string | null | undefined) {
  return useQuery({
    queryKey: ['aufgieser-rating-radar', aufgieserId],
    enabled: !!aufgieserId,
    queryFn: async () => {
      const { data, error } = await need().rpc('get_aufgieser_rating_radar', { p_aufgieser_id: aufgieserId });
      if (error) throw error;
      return data as RatingRadar;
    },
    staleTime: 60_000,
  });
}

// ─── Aufguss-Interaktionen (Migration 0047) ─────────────────────────────

export type ReactionKind = 'fire' | 'heart' | 'sparkle' | 'wind' | 'sauna';

export const REACTION_EMOJI: Record<ReactionKind, { emoji: string; label: string }> = {
  fire:    { emoji: '🔥', label: 'Hot' },
  heart:   { emoji: '❤️', label: 'Liebe' },
  sparkle: { emoji: '✨', label: 'Magisch' },
  wind:    { emoji: '💨', label: 'Atmo' },
  sauna:   { emoji: '🧖', label: 'Sauna-Power' },
};

export const REACTION_KINDS: ReactionKind[] = ['fire', 'heart', 'sparkle', 'wind', 'sauna'];

export type InfusionReactions = {
  counts: Partial<Record<ReactionKind, number>>;
  my_reaction: ReactionKind | null;
  total: number;
};

export function useInfusionReactions(infusionId: string | null | undefined) {
  return useQuery({
    queryKey: ['infusion-reactions', infusionId],
    enabled: !!infusionId,
    queryFn: async () => {
      const { data, error } = await need().rpc('get_infusion_reactions', { p_infusion: infusionId });
      if (error) throw error;
      return data as InfusionReactions;
    },
    staleTime: 15_000,
  });
}

export function useReactToInfusion() {
  const qc = useQueryClient();
  return useMutation<void, Error, { infusionId: string; reaction: ReactionKind }>({
    mutationFn: async ({ infusionId, reaction }) => {
      const { error } = await need().rpc('react_to_infusion', { p_infusion: infusionId, p_reaction: reaction });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['infusion-reactions', vars.infusionId] });
    },
  });
}

export function useUnreactToInfusion() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (infusionId) => {
      const { error } = await need().rpc('unreact_to_infusion', { p_infusion: infusionId });
      if (error) throw error;
    },
    onSuccess: (_, infusionId) => {
      qc.invalidateQueries({ queryKey: ['infusion-reactions', infusionId] });
    },
  });
}

// "Ich komme heute"
export type InfusionAnnouncement = {
  member_id: string;
  name: string;
  avatar_path: string | null;
  is_aufgieser: boolean;
  announced_at: string;
  message: string | null;
  is_me: boolean;
};

export function useInfusionAnnouncements(infusionId: string | null | undefined) {
  return useQuery({
    queryKey: ['infusion-announcements', infusionId],
    enabled: !!infusionId,
    queryFn: async () => {
      const { data, error } = await need().rpc('list_infusion_announcements', { p_infusion: infusionId });
      if (error) throw error;
      return (data ?? []) as InfusionAnnouncement[];
    },
    staleTime: 15_000,
  });
}

export function useAnnounceAttendance() {
  const qc = useQueryClient();
  return useMutation<void, Error, { infusionId: string; message?: string }>({
    mutationFn: async ({ infusionId, message }) => {
      const { error } = await need().rpc('announce_attendance', { p_infusion: infusionId, p_message: message ?? null });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['infusion-announcements', vars.infusionId] });
    },
  });
}

export function useUnannounceAttendance() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (infusionId) => {
      const { error } = await need().rpc('unannounce_attendance', { p_infusion: infusionId });
      if (error) throw error;
    },
    onSuccess: (_, infusionId) => {
      qc.invalidateQueries({ queryKey: ['infusion-announcements', infusionId] });
    },
  });
}

// Aufguss-Wünsche
export type AufgussWish = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  wish_text: string;
  wish_specialty: string | null;
  created_at: string;
  fulfilled_at: string | null;
  like_count: number;
  liked_by_me: boolean;
  is_my_wish: boolean;
};

export function useAufgussWishes(aufgieserId: string | null | undefined) {
  return useQuery({
    queryKey: ['aufguss-wishes', aufgieserId],
    enabled: !!aufgieserId,
    queryFn: async () => {
      const { data, error } = await need().rpc('list_aufguss_wishes', { p_aufgieser_id: aufgieserId, p_limit: 50 });
      if (error) throw error;
      return (data ?? []) as AufgussWish[];
    },
    staleTime: 30_000,
  });
}

export function useCreateWish() {
  const qc = useQueryClient();
  return useMutation<void, Error, { aufgieserId: string; wishText: string; specialty?: string | null }>({
    mutationFn: async ({ aufgieserId, wishText, specialty }) => {
      const meRes = await need().from('members').select('id').eq('auth_user_id', (await need().auth.getUser()).data.user?.id ?? '').maybeSingle();
      if (!meRes.data?.id) throw new Error('not_logged_in');
      const { error } = await need().from('aufguss_wishes').insert({
        aufgieser_id: aufgieserId,
        author_id: meRes.data.id,
        wish_text: wishText.trim(),
        wish_specialty: specialty ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['aufguss-wishes', vars.aufgieserId] });
    },
  });
}

export function useDeleteWish() {
  const qc = useQueryClient();
  return useMutation<void, Error, { wishId: string; aufgieserId: string }>({
    mutationFn: async ({ wishId }) => {
      const { error } = await need().from('aufguss_wishes').delete().eq('id', wishId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['aufguss-wishes', vars.aufgieserId] });
    },
  });
}

export function useToggleWishLike() {
  const qc = useQueryClient();
  return useMutation<void, Error, { wishId: string; aufgieserId: string; currentlyLiked: boolean }>({
    mutationFn: async ({ wishId, currentlyLiked }) => {
      const meRes = await need().from('members').select('id').eq('auth_user_id', (await need().auth.getUser()).data.user?.id ?? '').maybeSingle();
      if (!meRes.data?.id) throw new Error('not_logged_in');
      if (currentlyLiked) {
        const { error } = await need()
          .from('aufguss_wish_likes')
          .delete()
          .eq('wish_id', wishId)
          .eq('member_id', meRes.data.id);
        if (error) throw error;
      } else {
        const { error } = await need()
          .from('aufguss_wish_likes')
          .insert({ wish_id: wishId, member_id: meRes.data.id });
        if (error && !String(error.message).includes('duplicate')) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['aufguss-wishes', vars.aufgieserId] });
    },
  });
}

export function useMarkWishFulfilled() {
  const qc = useQueryClient();
  return useMutation<void, Error, { wishId: string; aufgieserId: string; fulfilled: boolean }>({
    mutationFn: async ({ wishId, fulfilled }) => {
      const { error } = await need().rpc('mark_wish_fulfilled', { p_wish_id: wishId, p_fulfilled: fulfilled });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['aufguss-wishes', vars.aufgieserId] });
    },
  });
}

// ─── Mini-Insta-Feed (Migration 0052) ─────────────────────────────────────
export type FeedReactionType = 'fire' | 'water' | 'leaf' | 'crown' | 'theater';

export type FeedPost = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  author_role: string;
  image_path: string;
  caption: string | null;
  infusion_id: string | null;
  infusion_title: string | null;
  infusion_aufgieser_name: string | null;
  infusion_start_time: string | null;
  oils: string[];
  created_at: string;
  reaction_counts: Partial<Record<FeedReactionType, number>>;
  my_reactions: FeedReactionType[];
};

export type FeedFilter = { oil?: string | null; infusion?: string | null };

const FEED_PAGE_SIZE = 20;

export function useFeed(filter: FeedFilter = {}) {
  return useInfiniteQuery<FeedPost[]>({
    queryKey: ['feed', filter.oil ?? null, filter.infusion ?? null],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await need().rpc('list_feed', {
        p_limit: FEED_PAGE_SIZE,
        p_before: pageParam,
        p_filter_oil: filter.oil ?? null,
        p_filter_infusion: filter.infusion ?? null,
      });
      if (error) throw error;
      return (data ?? []) as FeedPost[];
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < FEED_PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1].created_at;
    },
  });
}

export type MemberFeedPost = {
  id: string;
  image_path: string;
  caption: string | null;
  infusion_id: string | null;
  infusion_title: string | null;
  oils: string[];
  created_at: string;
  reaction_total: number;
};

export function useMemberFeedPosts(memberId: string | null | undefined, limit = 12) {
  return useQuery({
    queryKey: ['feed-by-member', memberId, limit],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need().rpc('list_member_feed_posts', {
        p_member_id: memberId,
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as MemberFeedPost[];
    },
  });
}

export type InfusionFeedPost = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  image_path: string;
  caption: string | null;
  oils: string[];
  created_at: string;
  reaction_total: number;
};

export function useInfusionFeedPosts(infusionId: string | null | undefined) {
  return useQuery({
    queryKey: ['feed-by-infusion', infusionId],
    enabled: !!infusionId,
    queryFn: async () => {
      const { data, error } = await need().rpc('list_infusion_feed_posts', { p_infusion_id: infusionId });
      if (error) throw error;
      return (data ?? []) as InfusionFeedPost[];
    },
  });
}

export function useCreateFeedPost() {
  const qc = useQueryClient();
  return useMutation<
    FeedPost,
    Error,
    { imagePath: string; caption: string | null; infusionId: string | null; oils: string[] }
  >({
    mutationFn: async ({ imagePath, caption, infusionId, oils }) => {
      const { data, error } = await need().rpc('create_feed_post', {
        p_image_path: imagePath,
        p_caption: caption,
        p_infusion_id: infusionId,
        p_oils: oils,
      });
      if (error) throw error;
      return data as FeedPost;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useDeleteMyFeedPost() {
  const qc = useQueryClient();
  return useMutation<void, Error, { postId: string }>({
    mutationFn: async ({ postId }) => {
      const { error } = await need().rpc('delete_my_feed_post', { p_post_id: postId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['feed-by-member'] });
      qc.invalidateQueries({ queryKey: ['feed-by-infusion'] });
    },
  });
}

export function useAdminDeleteFeedPost() {
  const qc = useQueryClient();
  return useMutation<void, Error, { postId: string }>({
    mutationFn: async ({ postId }) => {
      const { error } = await need().rpc('admin_delete_feed_post', { p_post_id: postId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['admin-feed'] });
    },
  });
}

export function useReactToFeedPost() {
  const qc = useQueryClient();
  return useMutation<void, Error, { postId: string; reaction: FeedReactionType }>({
    mutationFn: async ({ postId, reaction }) => {
      const { error } = await need().rpc('react_to_feed_post', {
        p_post_id: postId,
        p_reaction: reaction,
      });
      if (error) throw error;
    },
    // Optimistic update auf alle 'feed'-Queries (alle Filter)
    onMutate: async ({ postId, reaction }) => {
      await qc.cancelQueries({ queryKey: ['feed'] });
      const snapshots: [readonly unknown[], unknown][] = [];
      const allFeedQueries = qc.getQueriesData<{ pages: FeedPost[][]; pageParams: unknown[] }>({ queryKey: ['feed'] });
      for (const [key, data] of allFeedQueries) {
        snapshots.push([key, data]);
        if (!data?.pages) continue;
        const next = {
          ...data,
          pages: data.pages.map((page) =>
            page.map((p) => {
              if (p.id !== postId) return p;
              const has = p.my_reactions.includes(reaction);
              const newCount = (p.reaction_counts[reaction] ?? 0) + (has ? -1 : 1);
              return {
                ...p,
                my_reactions: has ? p.my_reactions.filter((r) => r !== reaction) : [...p.my_reactions, reaction],
                reaction_counts: { ...p.reaction_counts, [reaction]: Math.max(0, newCount) },
              };
            })
          ),
        };
        qc.setQueryData(key, next);
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      const snapshots = (ctx as { snapshots: [readonly unknown[], unknown][] } | undefined)?.snapshots ?? [];
      for (const [key, data] of snapshots) qc.setQueryData(key, data);
    },
  });
}

export function useDismissFeedEcho() {
  return useMutation<void, Error, { infusionId: string }>({
    mutationFn: async ({ infusionId }) => {
      const { error } = await need().rpc('dismiss_feed_echo', { p_infusion_id: infusionId });
      if (error) throw error;
    },
  });
}

export function useFeedEchoShouldShow(infusionId: string | null | undefined) {
  return useQuery({
    queryKey: ['feed-echo-state', infusionId],
    enabled: !!infusionId,
    queryFn: async () => {
      const { data, error } = await need().rpc('get_feed_echo_state', { p_infusion_id: infusionId });
      if (error) throw error;
      return data === true;
    },
  });
}

export type AdminFeedPost = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  image_path: string;
  caption: string | null;
  infusion_id: string | null;
  oils: string[];
  created_at: string;
  deleted_at: string | null;
  reaction_total: number;
};

export function useAdminFeed(showDeleted = false) {
  return useQuery({
    queryKey: ['admin-feed', showDeleted],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_admin_feed', {
        p_show_deleted: showDeleted,
        p_limit: 200,
      });
      if (error) throw error;
      return (data ?? []) as AdminFeedPost[];
    },
  });
}
