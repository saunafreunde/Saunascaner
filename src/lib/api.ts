import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Sauna, Infusion, MemberCustomAttr, RecurringSlot, AufgieserAbsence, MemberRole, Invitation } from '@/types/database';
import type { InfusionAttribute } from './attributes';
import { type BrandSettings, mergeBrandDefaults, defaultBrandSettings } from '@/types/branding';
import type { TvStageState } from './season';

function need() {
  if (!supabase) throw new Error('Supabase nicht konfiguriert');
  return supabase;
}

// ─── TV-Bühne (Migration 0071) ────────────────────────────────────────────

export function useTvStageState() {
  return useQuery({
    queryKey: ['tv-stage-state'],
    queryFn: async () => {
      const { data, error } = await need()
        .from('tv_stage_state')
        .select('manual_scenes, suppress_auto_season, last_effect')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? { manual_scenes: [], suppress_auto_season: false, last_effect: null }) as TvStageState;
    },
    // Realtime-Invalidation ist der primäre Update-Pfad; refetchInterval als
    // Fallback falls die Subscription hängt (Supabase parkt inaktive Tenants
    // alle paar Minuten — Reconnect dauert ein paar Sekunden, in denen
    // Events verloren gehen können). 3s Polling fängt das ab.
    // refetchIntervalInBackground: true — kritisch, weil die TV-Tafel im
    // Browser-Tab im Hintergrund läuft (Admin klickt parallel im Vordergrund).
    // Sonst pausiert React Query das Polling und Effects sind beim Tab-Switch
    // schon stale (>60s).
    staleTime: 0,
    refetchInterval: 3_000,
    refetchIntervalInBackground: true,
  });
}

export function useSetStageManualScenes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { scenes: string[]; suppress_auto: boolean }) => {
      const { error } = await need().rpc('set_stage_manual_scenes', {
        p_scenes: p.scenes,
        p_suppress_auto: p.suppress_auto,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tv-stage-state'] }),
  });
}

export function useToggleStageScene() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { sceneId: string; active: boolean }) => {
      const { error } = await need().rpc('set_stage_scene_toggle', {
        p_scene_id: p.sceneId,
        p_active: p.active,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tv-stage-state'] }),
  });
}

export function useTriggerStageEffect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (kind: string) => {
      const { error } = await need().rpc('trigger_stage_effect', { p_kind: kind });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tv-stage-state'] }),
  });
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
    // 5s-Polling als Realtime-Fallback — TV-Tafel zeigt neue Aufgüsse
    // garantiert binnen 5s an, auch wenn Supabase-Realtime parkiert.
    // Memory: feedback_saunascaner_tv_buehne (Supabase-Tenant-Parking-Issue).
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });
}

// Aufgüsse eines beliebigen Zeitraums (für Wochen-/Monats-Übersichten).
// infusions_read_public erlaubt SELECT auf alle (auch vergangene) Aufgüsse.
export function useInfusionsRange(from: Date, to: Date, enabled = true) {
  return useQuery({
    queryKey: ['infusions-range', from.toISOString(), to.toISOString()],
    enabled,
    queryFn: async () => {
      const { data, error } = await need()
        .from('infusions')
        .select('*')
        .gte('start_time', from.toISOString())
        .lt('start_time', to.toISOString())
        .order('start_time');
      if (error) throw error;
      return data as Infusion[];
    },
    staleTime: 60_000,
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
      // Nutzt SECURITY-DEFINER-RPC statt direktem INSERT — klare deutsche Fehler
      // bei Permission-Problemen statt generischem RLS-Error. (Migration 0069)
      const { data, error } = await need().rpc('create_infusion', {
        p_sauna_id: i.sauna_id,
        p_start_time: i.start_time,
        p_duration_minutes: i.duration_minutes,
        p_title: i.title,
        p_description: i.description,
        p_attributes: i.attributes,
        p_oils: i.oils ?? null,
        p_saunameister_id: i.saunameister_id,
        p_template_id: i.template_id,
        p_team_infusion: i.team_infusion ?? false,
        p_is_personal_fallback: false,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infusions'] }),
  });
}

// Aufguss absagen: HART gesperrt ab 60 Min vor Start für Aufgießer (Migration 0066).
// Admin darf jederzeit. RPC liefert deutsche Fehlermeldung bei Sperre.
export const INFUSION_CANCEL_LOCK_MINUTES = 60;

export function isInfusionCancelLocked(startTime: string | Date, nowMs: number = Date.now()): boolean {
  const startMs = typeof startTime === 'string' ? new Date(startTime).getTime() : startTime.getTime();
  return startMs - nowMs < INFUSION_CANCEL_LOCK_MINUTES * 60 * 1000;
}

export function useDeleteInfusion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().rpc('cancel_my_infusion', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infusions'] }),
  });
}

// ─── Update + Transfer (Migration 0088) ───────────────────────────────────

export type UpdateInfusionInput = {
  id: string;
  title?: string;
  description?: string | null;
  attributes?: string[];
  oils?: (string | null)[];
  team_infusion?: boolean;
  duration_minutes?: number;
  /** Admin-only: Saunameister wechseln. Wenn null/undef bleibt der bestehende. */
  saunameister_id?: string | null;
};

const UPDATE_INFUSION_ERROR_LABELS: Record<string, string> = {
  not_authenticated: 'Nicht eingeloggt.',
  infusion_not_found: 'Aufguss nicht gefunden.',
  not_owner: 'Du bist nicht der Aufgießer.',
  lock_window_active: 'Bearbeiten gesperrt — weniger als 60 Min bis Start (Admin kontaktieren).',
  not_admin_for_meister_change: 'Nur Admins dürfen den Saunameister wechseln.',
  target_not_aufgieser: 'Der gewählte User ist kein Aufgießer.',
};

export function useUpdateInfusion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateInfusionInput) => {
      const payload = {
        p_id: input.id,
        p_title: input.title ?? null,
        p_description: input.description ?? null,
        p_attributes: input.attributes ?? null,
        p_oils: input.oils ?? null,
        p_team_infusion: input.team_infusion ?? null,
        p_duration_minutes: input.duration_minutes ?? null,
        p_saunameister_id: input.saunameister_id ?? null,
      };
      // Console-Log für Debug (DevTools sichtbar)
      // eslint-disable-next-line no-console
      console.log('[update_infusion] payload', payload);
      const { data, error } = await need().rpc('update_infusion', payload);
      // eslint-disable-next-line no-console
      console.log('[update_infusion] response', { data, error });
      if (error) throw error;
      const result = data as string;
      if (result !== 'ok') {
        throw new Error(UPDATE_INFUSION_ERROR_LABELS[result] ?? result);
      }
    },
    // Force refetch statt nur invalidate — damit die UI garantiert die
    // neuen Daten zeigt, bevor das Modal sich schließt.
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['infusions'] });
      await qc.refetchQueries({ queryKey: ['infusions'] });
    },
  });
}

// ─── admin_set_co_aufgieser (Migration 0096) ─────────────────────────────
// Admin überschreibt komplett die Co-Aufgießer-Liste (max 2).
const ADMIN_SET_CO_ERROR_LABELS: Record<string, string> = {
  forbidden: 'Nur Admins dürfen Co-Aufgießer zuweisen.',
  infusion_not_found: 'Aufguss nicht gefunden.',
  too_many_co_aufgieser: 'Maximal 2 Co-Aufgießer pro Team-Aufguss.',
  target_not_aufgieser: 'Mindestens ein gewählter User ist kein Aufgießer.',
};

export function useAdminSetCoAufgieser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { infusion_id: string; member_ids: string[] }) => {
      const { data, error } = await need().rpc('admin_set_co_aufgieser', {
        p_infusion_id: input.infusion_id,
        p_member_ids: input.member_ids,
      });
      if (error) throw error;
      const result = data as string;
      if (result !== 'ok') {
        throw new Error(ADMIN_SET_CO_ERROR_LABELS[result] ?? result);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['co-aufgieser'] }),
  });
}

const TRANSFER_INFUSION_ERROR_LABELS: Record<string, string> = {
  not_authenticated: 'Nicht eingeloggt.',
  infusion_not_found: 'Aufguss nicht gefunden.',
  not_owner: 'Du bist nicht der Aufgießer.',
  lock_window_active: 'Übergeben gesperrt — weniger als 60 Min bis Start (Admin kontaktieren).',
  target_not_aufgieser: 'Empfänger ist kein Aufgießer.',
  already_owner: 'Der Aufguss gehört dem Empfänger bereits.',
};

export function useTransferInfusion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; toMemberId: string }) => {
      const { data, error } = await need().rpc('transfer_infusion', {
        p_id: input.id,
        p_to_member_id: input.toMemberId,
      });
      if (error) throw error;
      const result = data as string;
      if (result !== 'ok') {
        throw new Error(TRANSFER_INFUSION_ERROR_LABELS[result] ?? result);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infusions'] }),
  });
}

// ─── Color-Overrides (Migration 0088) ─────────────────────────────────────
// system_config('attribute_colors') + ('oil_colors') jeweils jsonb { id: hex }

export function useAttributeColors() {
  return useQuery<Record<string, string>>({
    queryKey: ['attribute-colors'],
    queryFn: async () => {
      const { data, error } = await need().rpc('get_attribute_colors');
      if (error) throw error;
      return (data ?? {}) as Record<string, string>;
    },
    staleTime: 60_000,
  });
}

// ─── App-Force-Reload-Signal (Migration 0099) ────────────────────────────
// Admin kann via trigger_app_reload-RPC einen Timestamp in system_config
// schreiben. Alle Clients pollen alle 30s + reagieren auf Änderung mit
// Hard-Reload + Cache-Clear (siehe AppReloadWatcher in App.tsx).
export function useAppReloadSignal() {
  return useQuery<number>({
    queryKey: ['app-reload-signal'],
    queryFn: async () => {
      const { data, error } = await need().rpc('get_app_reload_signal');
      if (error) throw error;
      return Number(data) || 0;
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    staleTime: 15_000,
  });
}

export function useTriggerAppReload() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await need().rpc('trigger_app_reload');
      if (error) throw error;
      return Number(data) || 0;
    },
  });
}

export function useOilColors() {
  return useQuery<Record<string, string>>({
    queryKey: ['oil-colors'],
    queryFn: async () => {
      const { data, error } = await need().rpc('get_oil_colors');
      if (error) throw error;
      return (data ?? {}) as Record<string, string>;
    },
    staleTime: 60_000,
  });
}

export function useSetAttributeColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { attr: string; color: string | null }) => {
      const { error } = await need().rpc('set_attribute_color', {
        p_attr: input.attr,
        p_color: input.color ?? '',
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attribute-colors'] }),
  });
}

export function useSetOilColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { oil: string; color: string | null }) => {
      const { error } = await need().rpc('set_oil_color', {
        p_oil: input.oil,
        p_color: input.color ?? '',
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['oil-colors'] }),
  });
}

// ─── Öl-Deaktivierung (Admin) ───────────────────────────────────────────
// system_config('disabled_oils') als jsonb { "zitrone": true, ... }.
// Migration 0093 — wird im OilPicker gefiltert; alte Aufgüsse zeigen
// das Öl weiter (Historie bleibt sichtbar).

export function useDisabledOils() {
  return useQuery<Record<string, boolean>>({
    queryKey: ['disabled-oils'],
    queryFn: async () => {
      const { data, error } = await need().rpc('get_disabled_oils');
      if (error) throw error;
      return (data ?? {}) as Record<string, boolean>;
    },
    staleTime: 60_000,
  });
}

export function useSetOilDisabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { oil: string; disabled: boolean }) => {
      const { error } = await need().rpc('set_oil_disabled', {
        p_oil: input.oil,
        p_disabled: input.disabled,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['disabled-oils'] }),
  });
}

// ─── Öl-Wiegungen / Verbrauch (Admin) ───────────────────────────────────
// Tabelle oil_weighings (Migration 0114) — append-only Log des aktuellen
// Flaschengewichts. Verbrauch = Differenz aufeinanderfolgender Wiegungen
// pro Öl (wird im OilWeighingTab berechnet). Alle RPCs is_admin()-gated.

export interface OilWeighing {
  id: string;
  oil_id: string;
  weight_g: number;
  note: string | null;
  weighed_by: string | null;
  weighed_by_name: string | null;
  created_at: string;
}

export function useOilWeighings() {
  return useQuery<OilWeighing[]>({
    queryKey: ['oil-weighings'],
    queryFn: async () => {
      const { data, error } = await need().rpc('get_oil_weighings', { p_limit: 2000 });
      if (error) throw error;
      // numeric kommt je nach PostgREST-Version als string — sicher zu number casten.
      return ((data ?? []) as OilWeighing[]).map((r) => ({ ...r, weight_g: Number(r.weight_g) }));
    },
    staleTime: 30_000,
  });
}

export function useRecordOilWeighing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { oil: string; weightG: number; note?: string | null }) => {
      const { error } = await need().rpc('record_oil_weighing', {
        p_oil: input.oil,
        p_weight_g: input.weightG,
        p_note: input.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['oil-weighings'] }),
  });
}

export function useDeleteOilWeighing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().rpc('delete_oil_weighing', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['oil-weighings'] }),
  });
}

// ─── AI-Titel-Vorschlag (Claude Haiku) ──────────────────────────────────
// Ruft den Anthropic-Endpoint /api/ai?action=suggest-title auf und gibt
// 5 sehr unterschiedliche Titel-Vorschläge zurück. Bei Fehler (Netzwerk,
// fehlender API-Key, Rate-Limit) wirft der Hook — der Caller kann dann
// auf den regelbasierten generateInfusionTitle() zurückfallen.
//
// 29.05.2026: Returnt jetzt string[] statt string. Backend liefert beide
// (titles + title für Backward-Compat). Hook ist nicht-rückwärtskompatibel,
// alle Caller müssen migriert werden.

export function useSuggestInfusionTitle() {
  return useMutation({
    mutationFn: async (input: { attributes: string[]; oils: string[] }) => {
      const r = await fetch('/api/ai?action=suggest-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      // FIX 30.05.2026: vorher warf if(!r.ok) sofort und las den Body nicht —
      // Frontend sah nur "AI-Fehler 500" statt der echten Anthropic-Message.
      // Jetzt: Body IMMER parsen, falls error-Feld da → echten Text werfen.
      let json: { titles?: string[]; title?: string; error?: string } | null = null;
      try { json = await r.json(); } catch { /* leere/kaputte Response */ }
      if (!r.ok) {
        const msg = json?.error ?? `AI-Fehler ${r.status}`;
        throw new Error(msg);
      }
      if (json?.error) throw new Error(json.error);
      if (Array.isArray(json?.titles) && json.titles.length > 0) {
        return json.titles.map((t) => t.trim()).filter(Boolean);
      }
      if (json?.title) return [json.title.trim()];
      return [];
    },
  });
}

// ─── Kiosk-Varianten (Öl-Raum-Tablet, ohne Auth) ──────────────────────────
// Identifiziert den Aufgießer per p_saunameister_id (vom Frontend übergeben)
// statt per auth.uid(). Backend prüft is_present + is_aufgieser. (Migration 0070)

export function useAddInfusionKiosk(saunameisterId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: NewInfusion) => {
      if (!saunameisterId) throw new Error('Kein Aufgießer ausgewählt.');
      const { data, error } = await need().rpc('create_infusion_kiosk', {
        p_saunameister_id: saunameisterId,
        p_sauna_id: i.sauna_id,
        p_start_time: i.start_time,
        p_duration_minutes: i.duration_minutes,
        p_title: i.title,
        p_description: i.description,
        p_attributes: i.attributes,
        p_oils: i.oils ?? null,
        p_template_id: i.template_id,
        p_team_infusion: i.team_infusion ?? false,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infusions'] }),
  });
}

export function useDeleteInfusionKiosk(saunameisterId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!saunameisterId) throw new Error('Kein Aufgießer ausgewählt.');
      const { error } = await need().rpc('cancel_infusion_kiosk', {
        p_id: id,
        p_saunameister_id: saunameisterId,
      });
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
  is_personal_planer: boolean;
  hourly_rate_eur: number;
  monthly_hour_limit_eur: number;
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
  // Game-Hub Opt-in (Migration 0075): PvP-Sieg im Feed teilen
  feed_share_game_wins: boolean;
  // Mitarbeiter + Familien-Mitgliedschaft (Migration 0076)
  is_cp_employee: boolean;
  family_has_partner: boolean;
  family_children_count: number;
  present_with_partner: boolean;
  present_children_count: number;
  // Avatar-Lock (Migration 0111): nur Admin kann avatar_path ändern wenn true
  avatar_locked: boolean;
  // Gast-Felder (Migration 0040)
  gast_referral_source: string | null;
  gast_consent_at: string | null;
  gast_signup_origin: string | null;
  // Fan-Felder (Migration 0061 — Fördernde Mitgliedschaft)
  paid_until: string | null;             // ISO-date oder null
  fan_since: string | null;              // ISO-timestamptz oder null
  fan_address: {
    street?: string;
    zip?: string;
    city?: string;
    country?: string;
  } | null;
  // Default-Mood / Standard-Stil (Migration 0100) — Fallback-Pills auf
  // der Tafel wenn ein Aufguss keine eigenen attrs/oils hat.
  default_mood_attributes: string[];
  default_mood_oils: string[];
  // Auto-Check-in via WLAN (Migration 0108+0109) — opt-in pro Mitglied
  auto_checkin_enabled: boolean;
  created_at: string;
};

// ─── Auto-Check-in (Migration 0108+0109) ──────────────────────────────────
export function useSetMyAutoCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data, error } = await need().rpc('set_my_auto_checkin', { p_enabled: enabled });
      if (error) throw error;
      return Boolean(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-member'] });
    },
  });
}

// ─── Feiertage (Migration 0113) ──────────────────────────────────────────
// Admin pflegt eine Liste von Feiertagen. An diesen Tagen wird die Sauna
// wie an Sa/So behandelt (Aufguss ab 11:00 statt erst 14:00).

export type Holiday = { date: string; label: string; created_at: string };

export function useHolidays() {
  return useQuery({
    queryKey: ['holidays'],
    queryFn: async () => {
      const { data, error } = await need()
        .from('holidays')
        .select('*')
        .order('date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Holiday[];
    },
    staleTime: 10 * 60_000, // Feiertage ändern sich selten
  });
}

/** Liefert eine Set<YYYY-MM-DD>-Lookup-Map für schnelles isHoliday(date). */
export function useHolidaySet(): Set<string> {
  const q = useHolidays();
  // useMemo wäre besser, aber Set ist billig — bei jeder Render-Run erstellen ist ok
  const s = new Set<string>();
  (q.data ?? []).forEach((h) => s.add(h.date));
  return s;
}

/** Helper: prüft ob ein Date in der Holiday-Set ist (lokales Berlin-Datum). */
export function isHolidayDate(date: Date, holidaySet: Set<string>): boolean {
  // Lokales Datum als YYYY-MM-DD (kein toISOString — der ist UTC).
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return holidaySet.has(`${y}-${m}-${d}`);
}

export function useAdminAddHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { date: string; label: string }) => {
      const { error } = await need().rpc('admin_add_holiday', {
        p_date: p.date,
        p_label: p.label,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  });
}

export function useAdminDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (date: string) => {
      const { error } = await need().rpc('admin_delete_holiday', { p_date: date });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  });
}

// ─── Anwesenheits-Panel (Migration 0110) ──────────────────────────────────
// PW-geschützter Desktop-Hub um Mitglieder ohne Handy ein-/auszuchecken.
// PW wird per Argument an die RPCs gegeben (anon-Pattern, analog Kiosk).

export type PanelMember = {
  id: string;
  name: string;
  member_number: number | null;
  role: string;
  is_aufgieser: boolean;
  is_cp_employee: boolean;
  is_present: boolean;
  last_scan_at: string | null;
  avatar_path: string | null;
  sauna_name: string | null;
};

export function useVerifyPanelPassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { data, error } = await need().rpc('verify_panel_password', { p_panel_password: password });
      if (error) throw error;
      return Boolean(data);
    },
  });
}

export function usePanelMembers(password: string | null) {
  return useQuery({
    queryKey: ['panel-members', password ?? 'none'],
    enabled: !!password,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      if (!password) return [] as PanelMember[];
      const { data, error } = await need().rpc('list_panel_members', { p_panel_password: password });
      if (error) throw error;
      return (data ?? []) as PanelMember[];
    },
  });
}

export function usePanelSetPresence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { memberId: string; present: boolean; password: string }) => {
      const { data, error } = await need().rpc('panel_set_presence', {
        p_member_id: p.memberId,
        p_present: p.present,
        p_panel_password: p.password,
      });
      if (error) throw error;
      return data as { ok: boolean; member_id: string; is_present: boolean; needs_family_modal: boolean };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['panel-members'] });
      qc.invalidateQueries({ queryKey: ['present'] });
      qc.invalidateQueries({ queryKey: ['members'] });
    },
  });
}

// ─── WLAN-Subnets (Admin-Pflege, Migration 0109) ──────────────────────────
export type WifiSubnet = {
  id: string;
  cidr: string;
  label: string;
  enabled: boolean;
  created_at: string;
};

export function useWifiSubnets() {
  return useQuery({
    queryKey: ['wifi-subnets'],
    queryFn: async () => {
      const { data, error } = await need()
        .from('org_wifi_subnets')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as WifiSubnet[];
    },
  });
}

export function useAdminAddWifiSubnet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { cidr: string; label: string }) => {
      const { data, error } = await need().rpc('admin_add_wifi_subnet', { p_cidr: p.cidr, p_label: p.label });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wifi-subnets'] }),
  });
}

export function useAdminToggleWifiSubnet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; enabled: boolean }) => {
      const { error } = await need().rpc('admin_toggle_wifi_subnet', { p_id: p.id, p_enabled: p.enabled });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wifi-subnets'] }),
  });
}

export function useAdminDeleteWifiSubnet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().rpc('admin_delete_wifi_subnet', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wifi-subnets'] }),
  });
}

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

// ─── Direct Messages (Migration 0079) ───────────────────────────────────

export type DmConversation = {
  conversation_id: string;
  other_id: string;
  other_name: string;
  other_avatar: string | null;
  last_message_at: string | null;
  unread_count: number;
  last_body: string | null;
};

export type DmMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  is_mine: boolean;
};

export function useMyConversations() {
  return useQuery({
    queryKey: ['dm-conversations'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_my_conversations');
      if (error) throw error;
      return (data ?? []) as DmConversation[];
    },
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });
}

export function useConversationMessages(convId: string | null | undefined) {
  return useQuery({
    queryKey: ['dm-messages', convId],
    enabled: !!convId,
    queryFn: async () => {
      const { data, error } = await need().rpc('list_conversation_messages', { p_conv_id: convId });
      if (error) throw error;
      return (data ?? []) as DmMessage[];
    },
    staleTime: 0,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });
}

export function useUnreadDmsCount() {
  return useQuery({
    queryKey: ['dm-unread'],
    queryFn: async () => {
      const { data, error } = await need().rpc('count_unread_dms');
      if (error) throw error;
      return (data ?? 0) as number;
    },
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });
}

export function useGetOrCreateConversation() {
  return useMutation({
    mutationFn: async (otherId: string) => {
      const { data, error } = await need().rpc('dm_get_or_create_conversation', { p_other_id: otherId });
      if (error) throw error;
      return data as string;
    },
  });
}

export function useSendDmMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { convId: string; body: string }) => {
      const { data, error } = await need().rpc('dm_send_message', {
        p_conv_id: p.convId,
        p_body: p.body,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['dm-messages', vars.convId] });
      qc.invalidateQueries({ queryKey: ['dm-conversations'] });
    },
  });
}

export function useMarkDmRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (convId: string) => {
      const { error } = await need().rpc('dm_mark_read', { p_conv_id: convId });
      if (error) throw error;
    },
    onSuccess: (_d, convId) => {
      qc.invalidateQueries({ queryKey: ['dm-messages', convId] });
      qc.invalidateQueries({ queryKey: ['dm-conversations'] });
      qc.invalidateQueries({ queryKey: ['dm-unread'] });
    },
  });
}

// ─── Feed-Kommentare (Migration 0078) ───────────────────────────────────

export type FeedComment = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  body: string;
  created_at: string;
  is_mine: boolean;
};

export function useFeedComments(postId: string | null | undefined) {
  return useQuery({
    queryKey: ['feed-comments', postId],
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await need().rpc('list_post_comments', { p_post_id: postId });
      if (error) throw error;
      return (data ?? []) as FeedComment[];
    },
    staleTime: 10_000,
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { postId: string; body: string }) => {
      const { data, error } = await need().rpc('create_post_comment', {
        p_post_id: p.postId,
        p_body: p.body,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['feed-comments', vars.postId] });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { commentId: string; postId: string }) => {
      const { error } = await need().rpc('delete_my_comment', { p_id: p.commentId });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['feed-comments', vars.postId] });
    },
  });
}

// ─── Notification-Inbox (Migration 0077) ────────────────────────────────

export type InboxNotification = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
};

export function useMyNotifications(limit = 30) {
  return useQuery({
    queryKey: ['my-notifications', limit],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_my_notifications', { p_limit: limit });
      if (error) throw error;
      return (data ?? []) as InboxNotification[];
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });
}

export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: ['my-notifications-unread'],
    queryFn: async () => {
      const { data, error } = await need().rpc('count_unread_notifications');
      if (error) throw error;
      return (data ?? 0) as number;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().rpc('mark_notification_read', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-notifications'] });
      qc.invalidateQueries({ queryKey: ['my-notifications-unread'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await need().rpc('mark_all_notifications_read');
      if (error) throw error;
      return (data ?? 0) as number;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-notifications'] });
      qc.invalidateQueries({ queryKey: ['my-notifications-unread'] });
    },
  });
}

// ─── Familien-Mitgliedschaft: aktuelle Anwesenheits-Auswahl (Migration 0076) ─
export function useSetMyPresentFamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { with_partner: boolean; children_count: number }) => {
      const { error } = await need().rpc('set_my_present_family', {
        p_with_partner: p.with_partner,
        p_children_count: p.children_count,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-member'] });
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: ['present'] });
      qc.invalidateQueries({ queryKey: ['present-full'] });
    },
  });
}

// Vollständige Anwesenheits-Liste für Evak-Overlay (Migration 0076)
export type PresentFullEntry = {
  id: string;
  name: string;
  avatar_path: string | null;
  role: string;
  is_aufgieser: boolean;
  is_personal_planer: boolean;
  is_cp_employee: boolean;
  present_with_partner: boolean;
  present_children_count: number;
  is_worker: boolean;
};

export function usePresentFull() {
  return useQuery({
    queryKey: ['present-full'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_present_full');
      if (error) throw error;
      return (data ?? []) as PresentFullEntry[];
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  });
}

// ─── Feed-Share: PvP-Sieg im Feed teilen (opt-in) ──────────────────────
export function useSetFeedShareGameWins() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (share: boolean) => {
      const { error } = await need().rpc('set_my_feed_share_game_wins', { p_share: share });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-member'] });
      qc.invalidateQueries({ queryKey: ['member'] });
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
      if (data === 'avatar_locked') throw new Error('Dein Profilbild wurde vom Admin gesperrt — nur der Admin kann es ändern.');
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

// Admin: Avatar für beliebigen Member setzen (bypasses Lock). Migration 0111.
export function useAdminSetMemberAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { memberId: string; avatarPath: string | null }) => {
      const { error } = await need().rpc('admin_set_member_avatar', {
        p_member_id: p.memberId,
        p_path: p.avatarPath ?? '',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-members'] });
      qc.invalidateQueries({ queryKey: ['current-member'] });
      qc.invalidateQueries({ queryKey: ['member'] });
      qc.invalidateQueries({ queryKey: ['members-directory'] });
    },
  });
}

// Admin: Avatar-Lock toggeln. Migration 0111.
export function useAdminSetAvatarLock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { memberId: string; locked: boolean }) => {
      const { data, error } = await need().rpc('admin_set_avatar_lock', {
        p_member_id: p.memberId,
        p_locked: p.locked,
      });
      if (error) throw error;
      return Boolean(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-members'] });
      qc.invalidateQueries({ queryKey: ['current-member'] });
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
  // Migration 0076: Mitarbeiter-Flag + Familien-Mitgliedschaft
  is_cp_employee: boolean;
  family_has_partner: boolean;
  family_children_count: number;
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
// default_mood_attributes/oils ergänzt durch Migration 0100 — werden auf
// der Tafel als Fallback-Pills gezeigt, wenn ein Aufguss leere attrs/oils
// hat (siehe InfusionCard PillsBlock).
// motto + star_accent_color ergänzt durch Migration 0102 — Plakat-Header
// auf der Tafel zeigt Motto als Sub-Header + Aufgießer-Brand-Farbe als
// Glow-Ring um den Avatar.
export type MeisterDirectoryEntry = {
  id: string;
  name: string;
  role: MemberRole;
  home_group: string | null;
  avatar_path: string | null;
  sauna_name: string | null;
  default_mood_attributes: string[];
  default_mood_oils: string[];
  motto: string;
  star_accent_color: string | null;
};
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

// ─── set_my_default_mood (Migration 0100) ────────────────────────────────
// Aufgießer hinterlegt seinen "Standard-Stil" (max 5 Attrs + 3 Öle).
// Frontend nutzt das in InfusionCard als Fallback wenn ein Aufguss
// keine eigenen attrs/oils hat — "🪶 Sein Stil"-Pills.
const SET_DEFAULT_MOOD_ERROR_LABELS: Record<string, string> = {
  not_authenticated: 'Nicht eingeloggt.',
  too_many_attributes: 'Maximal 5 Standard-Eigenschaften.',
  too_many_oils: 'Maximal 3 Standard-Öle.',
};
export function useSetMyDefaultMood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { attributes: string[]; oils: string[] }) => {
      const { error } = await need().rpc('set_my_default_mood', {
        p_attributes: input.attributes,
        p_oils: input.oils,
      });
      if (error) {
        const code = (error.message ?? '').toLowerCase();
        const matched = Object.keys(SET_DEFAULT_MOOD_ERROR_LABELS).find((k) => code.includes(k));
        throw new Error(matched ? SET_DEFAULT_MOOD_ERROR_LABELS[matched] : error.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-member'] });
      qc.invalidateQueries({ queryKey: ['meister-directory'] });
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
    mutationFn: async (p: { id: string; role?: MemberRole; is_aufgieser?: boolean; is_personal_planer?: boolean }) => {
      const { error } = await need().rpc('approve_member', {
        p_member_id: p.id,
        p_role: p.role ?? 'member',
        p_is_aufgieser: p.is_aufgieser ?? false,
        p_is_personal_planer: p.is_personal_planer ?? false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: ['current-member'] });
    },
  });
}

export function useSetPersonalPlaner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; value: boolean }) => {
      const { error } = await need().rpc('set_is_personal_planer', {
        p_member_id: p.id,
        p_value: p.value,
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
      target_is_personal_planer?: boolean;
      note?: string | null;
      expires_at?: string | null;
    }) => {
      const { data, error } = await need().rpc('create_invitation', {
        p_target_role: p.target_role,
        p_target_is_aufgieser: p.target_is_aufgieser ?? false,
        p_target_is_personal_planer: p.target_is_personal_planer ?? false,
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

// ─── CP-Verantwortlicher: Staff-Liste (Migration 0056) ───────────────────
export type StaffMemberEntry = {
  id: string;
  name: string;
  email: string | null;
  is_personal_planer: boolean;
  is_present: boolean;
  avatar_path: string | null;
};

export function useStaffMembers() {
  return useQuery({
    queryKey: ['staff-members'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_staff_members');
      if (error) throw error;
      return (data ?? []) as StaffMemberEntry[];
    },
  });
}

// ─── CP-Verantwortlicher: Personal-Schichten (Migration 0056) ────────────
export type PersonalShift = {
  id: string;
  staff_member_id: string;
  staff_name: string;
  shift_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string;
  notes: string | null;
};

export function useListPersonalShifts(from: string, to: string) {
  return useQuery({
    queryKey: ['personal-shifts', from, to],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_personal_shifts', { p_from: from, p_to: to });
      if (error) throw error;
      return (data ?? []) as PersonalShift[];
    },
  });
}

export function useCreatePersonalShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { staff_member_id: string; shift_date: string; start_time: string; end_time: string; notes?: string | null }) => {
      const { error } = await need().rpc('create_personal_shift', {
        p_staff_member_id: p.staff_member_id,
        p_shift_date: p.shift_date,
        p_start_time: p.start_time,
        p_end_time: p.end_time,
        p_notes: p.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-shifts'] }),
  });
}

export function useDeletePersonalShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().rpc('delete_personal_shift', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-shifts'] }),
  });
}

// ─── CP-Verantwortlicher: Anonymisierte Bewertungs-Übersicht (Mig. 0056) ──
export type RatingsAnonymousRow = {
  sauna_id: string;
  sauna_name: string;
  weekday: number;       // 0=Sonntag ... 6=Samstag
  hour_of_day: number;   // 0..23
  rating_count: number;
  avg_chemie: number | null;
  avg_luftbewegung: number | null;
  avg_wedeltechnik: number | null;
  avg_hitzeniveau: number | null;
  avg_musik: number | null;
  avg_duftentwicklung: number | null;
  avg_overall: number | null;
};

export function useRatingsAnonymous(from: string, to: string) {
  return useQuery({
    queryKey: ['ratings-anonymous', from, to],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_ratings_anonymous', { p_from: from, p_to: to });
      if (error) throw error;
      return (data ?? []) as RatingsAnonymousRow[];
    },
  });
}

// ─── CP-Verantwortlicher: Anwesenheits-Export (Mig. 0056) ────────────────
// Liefert pro Mitarbeiter & Tag einen Eintrag (attendance_events ist
// tagesbasiert, keine Check-In/Out-Pärchen).
export type StaffAttendanceRow = {
  member_id: string;
  name: string;
  role: string;
  attendance_date: string;  // YYYY-MM-DD
  recorded_at: string;      // timestamptz
};

export function useStaffAttendance(from: string, to: string, enabled = false) {
  return useQuery({
    queryKey: ['staff-attendance', from, to],
    queryFn: async () => {
      const { data, error } = await need().rpc('export_staff_attendance', { p_from: from, p_to: to });
      if (error) throw error;
      return (data ?? []) as StaffAttendanceRow[];
    },
    enabled,
  });
}

// ─── Staff: Verfügbarkeit (Migration 0059) ───────────────────────────────
export type AvailabilityEntry = {
  id: string;
  date: string;        // YYYY-MM-DD
  start_time: string;  // HH:MM:SS
  end_time: string;
  note: string | null;
  hours: number[];     // Start-Stunden (Migration 0117), z.B. [13,14,15] = 13–16 Uhr
};

export function useMyAvailability(from: string, to: string) {
  return useQuery({
    queryKey: ['my-availability', from, to],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_my_availability', { p_from: from, p_to: to });
      if (error) throw error;
      return ((data ?? []) as AvailabilityEntry[]).map((r) => ({ ...r, hours: r.hours ?? [] }));
    },
  });
}

export function useSetMyAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { date: string; start_time: string; end_time: string; note?: string | null }) => {
      const { error } = await need().rpc('set_my_availability', {
        p_date: p.date,
        p_start_time: p.start_time,
        p_end_time: p.end_time,
        p_note: p.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-availability'] }),
  });
}

export function useDeleteMyAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (date: string) => {
      const { error } = await need().rpc('delete_my_availability', { p_date: date });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-availability'] }),
  });
}

// Verfügbarkeit als Stundenslots setzen (Migration 0117). Leeres Array löscht den Tag.
export function useSetMyAvailabilityHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { date: string; hours: number[] }) => {
      const { error } = await need().rpc('set_my_availability_hours', {
        p_date: p.date,
        p_hours: p.hours,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-availability'] }),
  });
}

// ─── CP: alle Mitarbeiter-Verfügbarkeiten lesen ───────────────────────────
export type StaffAvailabilityEntry = AvailabilityEntry & {
  member_id: string;
  member_name: string;
};

export function useStaffAvailability(from: string, to: string) {
  return useQuery({
    queryKey: ['staff-availability', from, to],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_staff_availability', { p_from: from, p_to: to });
      if (error) throw error;
      return ((data ?? []) as StaffAvailabilityEntry[]).map((r) => ({ ...r, hours: r.hours ?? [] }));
    },
  });
}

// CP/Admin bestätigt Verfügbarkeit eines Mitarbeiters für einen Tag (grün→blau).
// Erzeugt personal_shifts aus zusammenhängenden Stunden-Läufen. Leeres Array = zurücknehmen.
export function useConfirmStaffAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { member_id: string; date: string; hours: number[] }) => {
      const { error } = await need().rpc('confirm_staff_availability', {
        p_member_id: p.member_id,
        p_date: p.date,
        p_hours: p.hours,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-shifts'] });
      qc.invalidateQueries({ queryKey: ['staff-monthly-stats'] });
    },
  });
}

// ─── CP: Monats-Stunden + Euro-Verteilung (Migration 0059) ────────────────
export type MonthlyStatsRow = {
  member_id: string;
  name: string;
  shift_count: number;
  total_hours: number;
  hourly_rate_eur: number;
  total_earned_eur: number;
  monthly_limit_eur: number;
  limit_remaining_eur: number;
  limit_usage_pct: number;
};

export function useStaffMonthlyStats(year: number, month: number) {
  return useQuery({
    queryKey: ['staff-monthly-stats', year, month],
    queryFn: async () => {
      const { data, error } = await need().rpc('staff_monthly_stats', { p_year: year, p_month: month });
      if (error) throw error;
      return (data ?? []) as MonthlyStatsRow[];
    },
  });
}

export function useSetMemberPayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { member_id: string; hourly_rate_eur: number; monthly_hour_limit_eur: number }) => {
      const { error } = await need().rpc('set_member_payroll', {
        p_member_id: p.member_id,
        p_hourly_rate_eur: p.hourly_rate_eur,
        p_monthly_hour_limit_eur: p.monthly_hour_limit_eur,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-monthly-stats'] });
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: ['staff-members'] });
    },
  });
}

// ─── Schicht-Absage + Übernahme (Migration 0060) ─────────────────────────
export function useCancelMyShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { shift_id: string; reason?: string | null }) => {
      const { error } = await need().rpc('cancel_my_shift', {
        p_shift_id: p.shift_id,
        p_reason: p.reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-shifts'] });
      qc.invalidateQueries({ queryKey: ['open-cancellations'] });
    },
  });
}

export function useTakeOpenShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shift_id: string) => {
      const { error } = await need().rpc('take_open_shift', { p_shift_id: shift_id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-shifts'] });
      qc.invalidateQueries({ queryKey: ['open-cancellations'] });
    },
  });
}

export type OpenCancellation = {
  shift_id: string;
  original_member_id: string;
  original_member_name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  cancelled_at: string;
  cancellation_reason: string | null;
};

export function useOpenCancellations() {
  return useQuery({
    queryKey: ['open-cancellations'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_open_cancellations');
      if (error) throw error;
      return (data ?? []) as OpenCancellation[];
    },
  });
}

// ─── Schicht-Tausch (Migration 0060) ─────────────────────────────────────
export function useRequestShiftSwap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { shift_id: string; to_member_id: string; offered_shift_id?: string | null; message?: string | null }) => {
      const { error } = await need().rpc('request_shift_swap', {
        p_shift_id: p.shift_id,
        p_to_member_id: p.to_member_id,
        p_offered_shift_id: p.offered_shift_id ?? null,
        p_message: p.message ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['swap-requests'] }),
  });
}

export function useAcceptShiftSwap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (swap_id: string) => {
      const { error } = await need().rpc('accept_shift_swap', { p_swap_id: swap_id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['swap-requests'] });
      qc.invalidateQueries({ queryKey: ['personal-shifts'] });
    },
  });
}

export function useRejectShiftSwap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (swap_id: string) => {
      const { error } = await need().rpc('reject_shift_swap', { p_swap_id: swap_id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['swap-requests'] }),
  });
}

export type SwapRequest = {
  id: string;
  direction: 'incoming' | 'outgoing';
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  shift_id: string;
  shift_date: string;
  shift_start: string;
  shift_end: string;
  offered_shift_id: string | null;
  offered_date: string | null;
  offered_start: string | null;
  offered_end: string | null;
  other_member_id: string;
  other_member_name: string;
  message: string | null;
  created_at: string;
};

export function useMySwapRequests() {
  return useQuery({
    queryKey: ['swap-requests'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_my_swap_requests');
      if (error) throw error;
      return (data ?? []) as SwapRequest[];
    },
  });
}

// ─── App-Inbox: pending Notifications (Migration 0060) ───────────────────
export type AppNotification = {
  id: string;
  kind: string;
  payload: {
    title?: string;
    body?: string;
    [key: string]: unknown;
  };
  created_at: string;
};

export function useMyPendingNotifications() {
  return useQuery({
    queryKey: ['my-notifications'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_my_pending_notifications');
      if (error) throw error;
      return (data ?? []) as AppNotification[];
    },
    refetchInterval: 30_000, // Alle 30s polling für „live" Inbox
  });
}

export function useMarkNotificationSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().rpc('mark_notification_seen', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-notifications'] }),
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
  // Migration 0080: geteiltes Postfach (mehrere Admins teilen sich den Zugriff)
  is_shared: boolean;
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

// ─── Shared-Inbox-Ticket-System (Migration 0080) ─────────────────────────

export type SharedAccount = {
  account_id: string;
  email_address: string;
  display_name: string | null;
  unread_count: number;
  open_ticket_count: number;
};

export type EmailTicketStatus = 'open' | 'in_progress' | 'answered' | 'closed';

export type EmailTicket = {
  id: string;
  thread_key: string;
  subject: string | null;
  from_address: string | null;
  status: EmailTicketStatus;
  locked_by: string | null;
  locked_by_name: string | null;
  locked_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  message_count: number;
  last_imap_uid: number | null;
};

export type SharedAdmin = {
  member_id: string;
  name: string;
  avatar_path: string | null;
  granted_at: string;
};

export function useMySharedAccounts() {
  return useQuery({
    queryKey: ['my-shared-accounts'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_my_shared_accounts');
      if (error) throw error;
      return (data ?? []) as SharedAccount[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
}

export function useAccountTickets(
  accountId: string | null | undefined,
  status: EmailTicketStatus | null = null,
) {
  return useQuery({
    queryKey: ['account-tickets', accountId, status],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await need().rpc('list_account_tickets', {
        p_account_id: accountId,
        p_status: status,
        p_limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as EmailTicket[];
    },
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });
}

export function useSharedAccountAdmins(accountId: string | null | undefined) {
  return useQuery({
    queryKey: ['shared-account-admins', accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await need().rpc('list_shared_account_admins', { p_account_id: accountId });
      if (error) throw error;
      return (data ?? []) as SharedAdmin[];
    },
  });
}

export function useLockEmailTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { ticketId: string; force?: boolean }) => {
      const { error } = await need().rpc('email_ticket_lock', {
        p_ticket_id: p.ticketId,
        p_force: p.force ?? false,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-tickets'] }),
  });
}

export function useUnlockEmailTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await need().rpc('email_ticket_unlock', { p_ticket_id: ticketId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-tickets'] }),
  });
}

export function useSetEmailTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { ticketId: string; status: EmailTicketStatus }) => {
      const { error } = await need().rpc('email_ticket_set_status', {
        p_ticket_id: p.ticketId,
        p_status: p.status,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account-tickets'] }),
  });
}

export function useGrantSharedEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      email: string;
      password: string;
      imap_host?: string;
      imap_port?: number;
      smtp_host?: string;
      smtp_port?: number;
      display_name?: string | null;
    }) => {
      const { data, error } = await need().rpc('grant_shared_email_account', {
        p_email: p.email,
        p_password: p.password,
        p_imap_host: p.imap_host ?? 'w01b00df.kasserver.com',
        p_imap_port: p.imap_port ?? 993,
        p_smtp_host: p.smtp_host ?? 'w01b00df.kasserver.com',
        p_smtp_port: p.smtp_port ?? 465,
        p_display_name: p.display_name ?? null,
      });
      if (error) throw error;
      return data as EmailAccount;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-email-accounts'] });
      qc.invalidateQueries({ queryKey: ['my-shared-accounts'] });
    },
  });
}

export function useGrantSharedEmailAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { accountId: string; memberId: string }) => {
      const { error } = await need().rpc('grant_shared_email_admin', {
        p_account_id: p.accountId,
        p_member_id: p.memberId,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['shared-account-admins', vars.accountId] });
      qc.invalidateQueries({ queryKey: ['my-shared-accounts'] });
    },
  });
}

export function useRevokeSharedEmailAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { accountId: string; memberId: string }) => {
      const { error } = await need().rpc('revoke_shared_email_admin', {
        p_account_id: p.accountId,
        p_member_id: p.memberId,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['shared-account-admins', vars.accountId] });
      qc.invalidateQueries({ queryKey: ['my-shared-accounts'] });
    },
  });
}

export function useMarkAccountShared() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { accountId: string; shared: boolean }) => {
      const { error } = await need().rpc('mark_account_shared', {
        p_account_id: p.accountId,
        p_shared: p.shared,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-email-accounts'] });
      qc.invalidateQueries({ queryKey: ['my-shared-accounts'] });
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
    // Background-Polling als Fallback, falls Realtime-Sub am Tablet nicht ankommt
    // (Background-Tab, Wifi-Wechsel, anonymous-User-Subscription-Issue):
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

// Anwesende Aufgießer ohne Login-Requirement (für Öl-Raum-Tablet).
// Nutzt RPC list_present_aufgieser (Migration 0068, SECURITY DEFINER) die auch
// für anonyme Clients erreichbar ist — die normale .from('members')-Query
// scheitert dort an der members_read_self-Policy (only authenticated).
export function usePresentAufgieserPublic() {
  return useQuery({
    queryKey: ['present-aufgieser-public'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_present_aufgieser');
      if (error) throw error;
      return (data ?? []) as { member_id: string; name: string; last_scan_at: string | null }[];
    },
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
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

// Eingangs-Scanner: Anmelde-PIN ist der einheitliche 4-stellige checkin_pin
// aus dem PIN-Pool (Migration 0051) — JEDES Mitglied hat einen, anders als
// beim alten entry_code (selbst-gewählt, kaum genutzt).
// Migration 0076 erweitert um needs_family_modal (true wenn beim Einchecken
// die Familien-Auswahl gezeigt werden soll).
export async function togglePresenceByCheckinPin(pin: string) {
  const { data, error } = await need().rpc('toggle_presence_by_checkin_pin', { p_pin: pin });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { member_id: string; name: string; is_present: boolean; needs_family_modal: boolean };
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
    // KRITISCH: Notfall-Alarm darf NICHT hängen bleiben wenn er auf einem anderen
    // Gerät beendet wird. Realtime-Sub auf evacuation_events ist primär — aber
    // 5s-Polling als Fallback garantiert dass spätestens nach 5s der Overlay
    // verschwindet (Background-Tab, Wifi-Wechsel, Realtime-Reconnect-Probleme).
    refetchInterval: 5_000,
    // FIX 0107 (Audit Phase 9.A): refetchIntervalInBackground:true damit Tafel
    // im Standby-Tab den Evac-Alarm trotzdem in 5s sieht (vorher pausierte das
    // Polling bei Tab-Blur, Alarm wurde erst beim wieder-fokussieren sichtbar).
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
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

// ─── Schedule-Settings (Migration 0083) ───────────────────────────────────
// Admin-konfigurierbare Wochenplan- + Tafel-Settings:
//   - monday_open: ob Montag als Aufguss-Tag offen ist
//   - tiles_per_column: 3 oder 4 Aufgüsse pro Sauna-Spalte auf /dashboard
export type ScheduleSettings = {
  monday_open: boolean;
  tiles_per_column: 3 | 4;
};

const SCHEDULE_DEFAULTS: ScheduleSettings = { monday_open: false, tiles_per_column: 3 };

export function useScheduleSettings() {
  return useQuery<ScheduleSettings>({
    queryKey: ['schedule-settings'],
    queryFn: async () => {
      const { data, error } = await need().rpc('get_schedule_settings');
      if (error) throw error;
      // RPC liefert jsonb mit den beiden Keys
      const obj = (data ?? {}) as Partial<ScheduleSettings>;
      return {
        monday_open: !!obj.monday_open,
        tiles_per_column: (obj.tiles_per_column === 4 ? 4 : 3) as 3 | 4,
      };
    },
    staleTime: 60_000,
  });
}

export function useSetScheduleSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduleSettings) => {
      const { error } = await need().rpc('set_schedule_settings', {
        p_monday_open: input.monday_open,
        p_tiles_per_column: input.tiles_per_column,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule-settings'] }),
  });
}

/** Synchrone Default-Settings — für Pure-Function-Aufrufer ohne React-Context. */
export const SCHEDULE_DEFAULT_SETTINGS: ScheduleSettings = SCHEDULE_DEFAULTS;

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

/** ALLE Custom-Attrs aller Aufgießer — für Tafel-Lookup (wenn in
 *  infusion.attributes als UUID enthalten). Analog useAllCustomOils.
 *  Wichtig damit das Dashboard die selbst erstellten Besonderheits-
 *  Buttons anzeigen kann (User-Bug: Custom-Attrs wurden ausgewählt
 *  aber auf der Tafel nicht gerendert weil ATTR_BY_ID nur Standard-
 *  Slugs kennt). */
export function useAllCustomAttrs() {
  return useQuery({
    queryKey: ['all-custom-attrs'],
    queryFn: async () => {
      const { data, error } = await need()
        .from('member_custom_attrs')
        .select('*');
      if (error) throw error;
      return data as MemberCustomAttr[];
    },
    staleTime: 60_000,
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

// ─── Custom Öle (Migration 0098) ────────────────────────────────────────
// Aufgießer kann eigene Öle/Räucherwerk anlegen — nur in der eigenen
// Auswahl sichtbar, aber sobald in einem Aufguss verwendet auf der
// Tafel für alle sichtbar.
//
// ID-Schema in infusions.oils: 'custom:<uuid>' damit Frontend leicht
// zwischen Standard- und Custom-Ölen unterscheiden kann.

export type CustomOil = {
  id: string;
  member_id: string;
  name: string;
  emoji: string;
  /** Hex-Farbcode (Migration 0101) — Default '#22c55e' für Alt-Daten. */
  color: string;
  created_at: string;
};

/** ID-Format für Custom-Öle in infusions.oils. */
export const CUSTOM_OIL_PREFIX = 'custom:';
export const customOilId = (uuid: string) => `${CUSTOM_OIL_PREFIX}${uuid}`;
export const parseCustomOilId = (id: string): string | null =>
  id.startsWith(CUSTOM_OIL_PREFIX) ? id.slice(CUSTOM_OIL_PREFIX.length) : null;

/** Eigene Öle des aktuellen/angegebenen Aufgießers (für Picker + Verwaltung). */
export function useMyCustomOils(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['my-custom-oils', memberId ?? 'none'],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need()
        .from('member_custom_oils')
        .select('*')
        .eq('member_id', memberId!)
        .order('name');
      if (error) throw error;
      return data as CustomOil[];
    },
  });
}

/** ALLE Custom-Öle aller Aufgießer — für Tafel-Lookup (wenn in Aufguss verwendet). */
export function useAllCustomOils() {
  return useQuery({
    queryKey: ['all-custom-oils'],
    queryFn: async () => {
      const { data, error } = await need()
        .from('member_custom_oils')
        .select('*');
      if (error) throw error;
      return data as CustomOil[];
    },
    staleTime: 60_000,
  });
}

export function useAddCustomOil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { member_id: string; name: string; emoji: string; color?: string }) => {
      const { error } = await need().from('member_custom_oils').insert({
        member_id: input.member_id,
        name: input.name.trim(),
        emoji: input.emoji || '🌿',
        color: input.color || '#22c55e',
      });
      if (error) {
        if (error.message?.includes('max_custom_oils')) {
          throw new Error('Maximal 15 eigene Öle pro Aufgießer.');
        }
        if (error.code === '23505') {
          throw new Error('Du hast bereits ein Öl mit diesem Namen.');
        }
        throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['my-custom-oils', vars.member_id] });
      qc.invalidateQueries({ queryKey: ['all-custom-oils'] });
    },
  });
}

export function useDeleteCustomOil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; member_id: string }) => {
      const { error } = await need().from('member_custom_oils').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['my-custom-oils', vars.member_id] });
      qc.invalidateQueries({ queryKey: ['all-custom-oils'] });
    },
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

// ─── Banja-Ritual buchen (Migration 0105) ─────────────────────────────────
// Atomare Buchung: Löscht bestehende Personal-Fallbacks für 19+20:00 in der
// 80°C-Sauna und legt 90-Min-Banja an. Behandelt damit den Bug, dass ein
// Personal-Fallback auf 19/20:00 die Banja-Buchung sonst blockiert hätte.
export function useBookBanjaRitual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      sauna_id: string;
      date: Date;          // wird zu YYYY-MM-DD (lokal) konvertiert
      title: string;
      attributes?: string[];
      oils?: (string | null)[] | null;
      team_infusion?: boolean;
      saunameister_id?: string | null;  // Admin-Override
    }) => {
      // Date als YYYY-MM-DD STRENG in Europe/Berlin (nicht Browser-Lokal!) —
      // die RPC interpretiert den String als Berlin-TZ und baut daraus 19:00.
      // Vorher (Browser-Lokal): User reist nach NY (UTC-5), 22:00 lokal = 04:00
      // nächster Tag Berlin → Banja würde am falschen Tag gebucht.
      // `en-CA` Locale liefert ISO-Format YYYY-MM-DD (auch wenn Locale nicht
      // ZH/EN ist, dieses Format ist hart definiert).
      const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Berlin',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(p.date);
      const { data, error } = await need().rpc('book_banja_ritual', {
        p_sauna_id: p.sauna_id,
        p_date: dateStr,
        p_title: p.title,
        p_attributes: p.attributes ?? ['banja', 'wenik'],
        p_oils: p.oils ?? null,
        p_team_infusion: p.team_infusion ?? false,
        p_saunameister_id: p.saunameister_id ?? null,
      });
      if (error) throw error;
      return data as string;  // neue infusion_id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infusions'] }),
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

export type FeedPostKind = 'photo' | 'game_achievement' | 'game_win' | 'vereins_highscore';

export type FeedPost = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  author_role: string;
  image_path: string | null;
  caption: string | null;
  infusion_id: string | null;
  infusion_title: string | null;
  infusion_aufgieser_name: string | null;
  infusion_start_time: string | null;
  oils: string[];
  created_at: string;
  reaction_counts: Partial<Record<FeedReactionType, number>>;
  my_reactions: FeedReactionType[];
  post_kind: FeedPostKind;
  meta: Record<string, unknown>;
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

// ─── Stats-RPCs (Migration 0055) ──────────────────────────────────────────
function simpleStat<T>(key: string, fn: string, args: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ['stats', key, args],
    queryFn: async () => {
      const { data, error } = await need().rpc(fn, args);
      if (error) throw error;
      return (data ?? []) as T;
    },
    staleTime: 60_000,
  });
}

export type AufgieserLeader = { member_id: string; name: string; avatar_path: string | null; infusion_count: number; avg_rating: number; rating_count: number };
export const useStatsAufgieserLeaderboard = () => simpleStat<AufgieserLeader[]>('aufgieser-leaderboard', 'stats_aufgieser_leaderboard');

export type VereinRatingAvg = { chemie: number; luftbewegung: number; wedeltechnik: number; hitzeniveau: number; musik: number; duftentwicklung: number };
export const useStatsVereinRatingAvg = () => simpleStat<VereinRatingAvg[]>('verein-rating-avg', 'stats_verein_rating_avg');

export type AufgieserConsistency = {
  member_id: string; name: string; rating_count: number;
  chemie_avg: number; chemie_sd: number; luft_avg: number; luft_sd: number;
  wedel_avg: number; wedel_sd: number; hitze_avg: number; hitze_sd: number;
  musik_avg: number; musik_sd: number; duft_avg: number; duft_sd: number;
};
export const useStatsAufgieserConsistency = () => simpleStat<AufgieserConsistency[]>('aufgieser-consistency', 'stats_aufgieser_consistency');

export type AromaSignature = { oil_slug: string; usage_count: number };
export const useStatsAufgieserAromaSignature = (memberId: string | null | undefined, limit = 12) =>
  useQuery({
    queryKey: ['stats', 'aroma-signature', memberId, limit],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need().rpc('stats_aufgieser_aroma_signature', { p_member_id: memberId, p_limit: limit });
      if (error) throw error;
      return (data ?? []) as AromaSignature[];
    },
  });

export type VolumeByMonth = { month: string; eigen: number; fallback: number; team: number };
export const useStatsVolumeByMonth = (months = 12) => simpleStat<VolumeByMonth[]>('volume-by-month', 'stats_volume_by_month', { p_months: months });

export type WeekdayHourCell = { weekday: number; hour: number; count: number };
export const useStatsWeekdayHourHeatmap = (months = 12) => simpleStat<WeekdayHourCell[]>('weekday-hour-heatmap', 'stats_weekday_hour_heatmap', { p_months: months });

export type FallbackRateRow = { month: string; total: number; fallbacks: number; fallback_pct: number };
export const useStatsFallbackRateByMonth = (months = 12) => simpleStat<FallbackRateRow[]>('fallback-rate-by-month', 'stats_fallback_rate_by_month', { p_months: months });

export type TeamAufgussRow = { total: number; team_count: number; team_pct: number; top_member_id: string | null; top_name: string | null; top_count: number };
export const useStatsTeamAufgussSummary = () => simpleStat<TeamAufgussRow[]>('team-aufguss-summary', 'stats_team_aufguss_summary');

export type TopOil = { oil_slug: string; usage_count: number };
export const useStatsTopOils = (limit = 20) => simpleStat<TopOil[]>('top-oils', 'stats_top_oils', { p_limit: limit });

export type OilRatingCorr = { oil_slug: string; usage_count: number; avg_rating: number; rating_count: number };
export const useStatsOilRatingCorrelation = (minUsage = 2) => simpleStat<OilRatingCorr[]>('oil-rating-corr', 'stats_oil_rating_correlation', { p_min_usage: minUsage });

export type OilSeasonRow = { oil_slug: string; month: number; usage_count: number };
export const useStatsOilSeasonality = () => simpleStat<OilSeasonRow[]>('oil-seasonality', 'stats_oil_seasonality');

export type StreakRow = { member_id: string; name: string; longest_streak: number; current_streak: number; total_visits: number };
export const useStatsStreakLeaderboard = (limit = 15) => simpleStat<StreakRow[]>('streak-leaderboard', 'stats_attendance_streak_leaderboard', { p_limit: limit });

export type ActivityScoreRow = { member_id: string; name: string; role: string; infusions_done: number; attendances: number; ratings_given: number; posts: number; reactions_made: number; total_score: number };
export const useStatsActivityScore = (limit = 20) => simpleStat<ActivityScoreRow[]>('activity-score', 'stats_activity_score', { p_limit: limit });

export type MemberGrowthRow = { month: string; role: string; joined: number };
export const useStatsMemberGrowth = (months = 12) => simpleStat<MemberGrowthRow[]>('member-growth', 'stats_member_growth_by_month', { p_months: months });

export type RetentionRow = { bucket: string; member_count: number };
export const useStatsGuestRetentionFunnel = () => simpleStat<RetentionRow[]>('guest-retention', 'stats_guest_retention_funnel');

export type RatingCoverageRow = { month: string; total: number; rated: number; coverage_pct: number };
export const useStatsRatingCoverage = (months = 12) => simpleStat<RatingCoverageRow[]>('rating-coverage', 'stats_rating_coverage_by_month', { p_months: months });

export type RatingDistRow = { stars: number; count: number };
export const useStatsRatingDistribution = () => simpleStat<RatingDistRow[]>('rating-distribution', 'stats_rating_distribution');

export type FeedActivityRow = { day: string; posts: number; reactions: number };
export const useStatsFeedActivity = (days = 30) => simpleStat<FeedActivityRow[]>('feed-activity', 'stats_feed_activity_by_day', { p_days: days });

export type FeedReactionDistRow = { reaction: string; count: number };
export const useStatsFeedReactionDistribution = () => simpleStat<FeedReactionDistRow[]>('feed-reaction-dist', 'stats_feed_reaction_distribution');

export type FollowNetworkRow = { kind: 'star' | 'fan'; member_id: string; name: string; avatar_path: string | null; role: string; n: number };
export const useStatsFollowerNetwork = (limit = 8) => simpleStat<FollowNetworkRow[]>('follower-network', 'stats_follower_network', { p_limit: limit });

// ─────────────────────────────────────────────────────────────────────────────
// FAN-UPGRADE (Migration 0061) — Förderndes Mitglied
// Conversion-Pfad: Gast → Fan via Self-Antrag + Admin-Approve.
// ─────────────────────────────────────────────────────────────────────────────

export type FanAddress = {
  street?: string;
  zip?: string;
  city?: string;
  country?: string;
};

export type PendingFanUpgrade = {
  request_id: string;
  member_id: string;
  member_name: string;
  member_email: string | null;
  member_role: MemberRole;
  address: FanAddress;
  iban: string | null;
  requested_at: string;
  member_signup_at: string;
  member_rating_count: number;
};

export type MyFanUpgradeStatus = {
  request_id: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  decided_at: string | null;
  rejection_reason: string | null;
};

export function useRequestFanUpgrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { address: FanAddress; iban?: string | null }) => {
      const { data, error } = await need().rpc('request_fan_upgrade', {
        p_address: p.address,
        p_iban: p.iban ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fan-upgrade-status'] });
      qc.invalidateQueries({ queryKey: ['fan-upgrades-pending'] });
    },
  });
}

export function useMyFanUpgradeStatus() {
  return useQuery({
    queryKey: ['fan-upgrade-status'],
    queryFn: async () => {
      const { data, error } = await need().rpc('my_fan_upgrade_status');
      if (error) throw error;
      const rows = (data ?? []) as MyFanUpgradeStatus[];
      return rows[0] ?? null;
    },
    staleTime: 30_000,
  });
}

export function usePendingFanUpgrades() {
  return useQuery({
    queryKey: ['fan-upgrades-pending'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_pending_fan_upgrades');
      if (error) throw error;
      return (data ?? []) as PendingFanUpgrade[];
    },
    staleTime: 30_000,
  });
}

export function useApproveFan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { request_id: string; paid_until: string }) => {
      const { error } = await need().rpc('approve_fan', {
        p_request_id: p.request_id,
        p_paid_until: p.paid_until,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fan-upgrades-pending'] });
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: ['member'] });
    },
  });
}

export function useRejectFan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { request_id: string; reason?: string }) => {
      const { error } = await need().rpc('reject_fan', {
        p_request_id: p.request_id,
        p_reason: p.reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fan-upgrades-pending'] });
    },
  });
}

export function useSetMemberPaidUntil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { member_id: string; paid_until: string | null }) => {
      const { error } = await need().rpc('set_member_paid_until', {
        p_member_id: p.member_id,
        p_paid_until: p.paid_until,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ORG-NEWS (Migration 0062) — Vereins-Ankündigungen mit rollen-basierter Sichtbarkeit
// ─────────────────────────────────────────────────────────────────────────────

export type OrgNews = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  published_at: string;
  expires_at: string | null;
  cover_image_url: string | null;
  target_min_role: 'gast' | 'fan' | 'member';
  created_by_name: string | null;
};

export function useOrgNews() {
  return useQuery({
    queryKey: ['org-news'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_active_news');
      if (error) throw error;
      return (data ?? []) as OrgNews[];
    },
    staleTime: 60_000,
  });
}

export function useCreateOrgNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Pick<OrgNews, 'title' | 'body' | 'target_min_role'> & {
      pinned?: boolean;
      expires_at?: string | null;
      cover_image_url?: string | null;
    }) => {
      const { error } = await need().from('org_news').insert({
        title: p.title,
        body: p.body,
        pinned: p.pinned ?? false,
        expires_at: p.expires_at ?? null,
        cover_image_url: p.cover_image_url ?? null,
        target_min_role: p.target_min_role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-news'] });
    },
  });
}

export function useDeleteOrgNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().from('org_news').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-news'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AROMA-REZEPTE (Migration 0062) — exklusiver Premium-Content für Fans+
// ─────────────────────────────────────────────────────────────────────────────

export type AromaRecipeIngredient = { name: string; drops?: number };

export type AromaRecipe = {
  id: string;
  title: string;
  description: string | null;
  ingredients: AromaRecipeIngredient[];
  sauna_type: 'finnisch' | 'bio' | 'kelo' | 'aufguss' | 'event' | null;
  temperature_c: number | null;
  created_by_name: string | null;
  created_at: string;
};

export function useApprovedAromaRecipes() {
  return useQuery({
    queryKey: ['aroma-recipes-approved'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_approved_aroma_recipes');
      if (error) throw error;
      return (data ?? []) as AromaRecipe[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateAromaRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      title: string;
      description?: string | null;
      ingredients: AromaRecipeIngredient[];
      sauna_type?: AromaRecipe['sauna_type'];
      temperature_c?: number | null;
      created_by: string;
    }) => {
      const { error } = await need().from('aroma_recipes').insert({
        title: p.title,
        description: p.description ?? null,
        ingredients: p.ingredients,
        sauna_type: p.sauna_type ?? null,
        temperature_c: p.temperature_c ?? null,
        created_by: p.created_by,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aroma-recipes-approved'] });
      qc.invalidateQueries({ queryKey: ['aroma-recipes-pending'] });
    },
  });
}

export function useApproveAromaRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Über RPC (statt direktem UPDATE) damit approved_by auf den aktuellen
      // Admin gesetzt wird — Audit-Trail. Admin-Check passiert serverseitig.
      const { error } = await need().rpc('approve_aroma_recipe', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aroma-recipes-approved'] });
      qc.invalidateQueries({ queryKey: ['aroma-recipes-pending'] });
    },
  });
}

export function useDeleteAromaRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().from('aroma_recipes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aroma-recipes-approved'] });
      qc.invalidateQueries({ queryKey: ['aroma-recipes-pending'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY-LOG (Migration 0065) — Audit-Trail aller wichtigen Vereins-Aktionen
// Admin-only via RLS. Filter nach Zeit-Range + Aktor + Aktions-Prefix.
// ─────────────────────────────────────────────────────────────────────────────

export type ActivityLogRow = {
  id: string;
  occurred_at: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  details: Record<string, unknown> | null;
};

export type ActivityLogFilter = {
  from?: string | null;            // ISO-timestamptz
  until?: string | null;           // ISO-timestamptz
  actor_id?: string | null;
  action_prefix?: string | null;   // z.B. 'member.' für alle Mitglieder-Aktionen
  limit?: number;
  offset?: number;
};

export function useActivityLog(filter: ActivityLogFilter = {}) {
  return useQuery({
    queryKey: ['activity-log', filter],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_activity_log', {
        p_from: filter.from ?? null,
        p_until: filter.until ?? null,
        p_actor_id: filter.actor_id ?? null,
        p_action_prefix: filter.action_prefix ?? null,
        p_limit: filter.limit ?? 200,
        p_offset: filter.offset ?? 0,
      });
      if (error) throw error;
      return (data ?? []) as ActivityLogRow[];
    },
    staleTime: 30_000,
  });
}

export function useActivityLogCount(filter: Omit<ActivityLogFilter, 'limit' | 'offset'> = {}) {
  return useQuery({
    queryKey: ['activity-log-count', filter],
    queryFn: async () => {
      const { data, error } = await need().rpc('count_activity_log', {
        p_from: filter.from ?? null,
        p_until: filter.until ?? null,
        p_actor_id: filter.actor_id ?? null,
        p_action_prefix: filter.action_prefix ?? null,
      });
      if (error) throw error;
      return (data ?? 0) as number;
    },
    staleTime: 30_000,
  });
}

export function usePendingAromaRecipes() {
  return useQuery({
    queryKey: ['aroma-recipes-pending'],
    queryFn: async () => {
      const { data, error } = await need()
        .from('aroma_recipes')
        .select('*, members:created_by(name)')
        .eq('approved', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<AromaRecipe & { approved: boolean; members: { name: string } | null }>;
    },
    staleTime: 60_000,
  });
}

// GDPR-Self-Delete: nur für 'gast' und 'fan' erlaubt (Migration 0063).
// Aktiv-Mitglieder müssen über Admin gelöscht werden.
export function useDeleteMyAccount() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await need().rpc('delete_my_account');
      if (error) throw error;
    },
  });
}

// Eigene Rezepte (pending + approved) für Saunameister-Submit-UI
export function useMyAromaRecipes(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['aroma-recipes-mine', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need()
        .from('aroma_recipes')
        .select('*')
        .eq('created_by', memberId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<AromaRecipe & { approved: boolean; approved_at: string | null }>;
    },
    staleTime: 60_000,
  });
}
