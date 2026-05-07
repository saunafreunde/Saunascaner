import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Sauna, Infusion } from '@/types/database';
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
  start_time: string;
  duration_minutes: number;
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
  role: 'saunameister' | 'manager' | 'super_admin' | 'guest_staff';
  approved: boolean;
  is_present: boolean;
  last_scan_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

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
    mutationFn: async (p: { id: string; role?: Member['role'] }) => {
      const { error } = await need().rpc('approve_member', { p_member_id: p.id, p_role: p.role ?? null });
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
        .select('id,name,last_scan_at')
        .eq('is_present', true)
        .is('revoked_at', null)
        .order('name');
      if (error) throw error;
      return data as { id: string; name: string; last_scan_at: string | null }[];
    },
  });
}

// ─── Scanner RPC ──────────────────────────────────────────────────────────
export async function togglePresenceByCode(code: string) {
  const { data, error } = await need().rpc('toggle_presence', { p_member_code: code });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { member_id: string; name: string; is_present: boolean };
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

// ─── Storage helpers ──────────────────────────────────────────────────────
export function publicAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const c = supabase;
  if (!c) return null;
  const { data } = c.storage.from('assets').getPublicUrl(path);
  return data.publicUrl;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

export async function uploadAsset(file: File, folder = 'ads'): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`Ungültiger Dateityp: ${file.type}. Erlaubt: JPEG, PNG, WebP, GIF, SVG.`);
  }
  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await need().storage.from('assets').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

export async function deleteAsset(path: string): Promise<void> {
  await need().storage.from('assets').remove([path]);
}
