import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Sauna, Infusion, MemberCustomAttr } from '@/types/database';
import type { InfusionAttribute } from './attributes';

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
  role: 'member' | 'admin';
  is_aufgieser: boolean;
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
export type MemberDirectoryEntry = {
  id: string;
  name: string;
  sauna_name: string | null;
  member_number: number | null;
  role: 'member' | 'admin';
  is_aufgieser: boolean;
  is_present: boolean;
  birthday: string | null;
  motto: string | null;
  avatar_path: string | null;
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
export function useMeisterDirectory() {
  return useQuery({
    queryKey: ['meister-directory'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_meister_names');
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
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
    mutationFn: async (p: { id: string; role?: Member['role']; is_aufgieser?: boolean }) => {
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

export function useUpdateEntryCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, entry_code }: { id: string; entry_code: string | null }) => {
      const { error } = await need().from('members').update({ entry_code }).eq('id', id);
      if (error) throw error;
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
      if (error) throw error;
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
  };
  badge?: {
    front_bg?: string | null;
    back_bg?: string | null;
  };
};

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
      return (data?.value ?? { ads: [], background_path: null, logo_path: null }) as TvSettings;
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
