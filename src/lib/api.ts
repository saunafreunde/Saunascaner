import { useMutation, useQuery, useQueryClient, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Sauna, Infusion, MemberCustomAttr, RecurringSlot, AufgieserAbsence, MemberRole, Invitation } from '@/types/database';
import type { SudKraut, SudMix } from '@/lib/sud';
import type { InfusionAttribute } from './attributes';
import { type BrandSettings, mergeBrandDefaults, defaultBrandSettings } from '@/types/branding';
import type { TvStageState } from './season';
import {
  kioskGeraetHeader, kioskGeraetToken, kioskGeraetTokenBestaetigt, kopplungsTokenOffen, kopplungKannEintreffen,
  kopplungAbschliessen,
} from './kioskGeraet';
import { pollTakt } from './realtimeStatus';
import { istDauerFehler } from './queryClient';

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
    // Realtime-Invalidation ist der primäre Update-Pfad (Kanal „tafel" in
    // hooks/useRealtime.ts). Der Poll ist nur das Netz darunter: 3 s, solange
    // der Kanal nicht bestätigt ist (Verbindungsabbruch, Ablehnung), sonst
    // 30 s als Sicherheitsnetz (Audit 25.09.2026 — vorher lief der 3-s-Poll
    // rund um die Uhr, weil der Kanal unbemerkt tot war).
    // refetchIntervalInBackground: true — kritisch, weil die TV-Tafel im
    // Browser-Tab im Hintergrund läuft (Admin klickt parallel im Vordergrund).
    // Sonst pausiert React Query das Polling und Effects sind beim Tab-Switch
    // schon stale (>60s).
    staleTime: 0,
    refetchInterval: pollTakt(3_000, 30_000),
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
    // Sauna an/aus kommt per Realtime (Kanal „tafel"). Ohne bestätigten Kanal
    // jede Minute nachsehen — sonst zeigte die 24/7-Tafel eine abgeschaltete
    // Sauna bis zum nächsten Neuladen (Audit 25.09.2026).
    refetchInterval: pollTakt(60_000, 10 * 60_000),
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

/** Orientierungs-Felder für die TV-Tafel (Migration 0120): Standort-Hinweis
 *  und Header-Bild. Direkter UPDATE wie useToggleSauna — die Policy
 *  saunas_write_admin (is_admin()) deckt das ab. */
export function useUpdateSauna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; location_hint?: string | null; header_image?: string | null }) => {
      const { error } = await need().from('saunas').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saunas'] }),
  });
}

// ─── Infusions ────────────────────────────────────────────────────────────

/** Personal-Fallbacks, die die TV-Tafel braucht: nextSlotStarts
 *  (SaunaTileColumn) springt ab 21:15 höchstens bis dayOffset 7 → Beginn vor
 *  heute 0 Uhr + 8 Tage; 9 = Puffer. Ändert sich maxDayOffset dort, hier mitziehen. */
export const TAFEL_FALLBACK_TAGE = 9;
/** Öl-Raum-Tablet: maxTageVoraus (OelraumEingabe) ist höchstens 28 → Beginn vor
 *  heute 0 Uhr + 29 Tage. Ändert sich maxTageVoraus dort, hier mitziehen. */
export const OELRAUM_FALLBACK_TAGE = 29;

/** Alle Aufgüsse ab heute 0 Uhr.
 *
 *  `fallbackTage` (nur für die Displays): echte Aufgüsse weiterhin ALLE, von den
 *  Personal-Fallbacks aber nur die ersten N Tage. Der nächtliche Materialisierer
 *  legt Fallbacks ~8 Wochen voraus an (~380 von ~390 Zeilen, ~220 KB je Abruf);
 *  die Tafel braucht davon 8 Tage, der Öl-Raum 28 (Audit 25.09.2026: −80 % bzw.
 *  −46 % Daten je Abruf). Alle Aufrufer EINES Geräts müssen denselben Wert
 *  nehmen, sonst laufen zwei Polls nebeneinander. Der Key beginnt mit
 *  ['infusions'] — Realtime und alle Mutationen invalidieren die Variante mit. */
export function useInfusions(opts?: { fallbackTage?: number }) {
  const fallbackTage = opts?.fallbackTage;
  return useQuery({
    queryKey: fallbackTage == null ? ['infusions'] : ['infusions', 'fallback-bis', fallbackTage],
    queryFn: async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      let q = need()
        .from('infusions')
        .select('*')
        .gte('end_time', since.toISOString());
      if (fallbackTage != null) {
        const bis = new Date(since);
        bis.setDate(bis.getDate() + fallbackTage); // lokal gerechnet → sommerzeitfest
        // Anführungszeichen: der Zeitstempel enthält '.' und ':' (PostgREST-Syntax).
        q = q.or(`is_personal_fallback.eq.false,start_time.lt."${bis.toISOString()}"`);
      }
      const { data, error } = await q.order('start_time');
      if (error) throw error;
      return data as Infusion[];
    },
    // Neue/geänderte Aufgüsse kommen per Realtime (Kanal „tafel"). Der Poll ist
    // das Netz darunter: 5 s, solange der Kanal nicht bestätigt ist, sonst 30 s.
    // Vorher lief der 5-s-Poll rund um die Uhr auf jedem Gerät — der Kanal war
    // seit Mai unbemerkt tot, nicht „geparkt" (Audit 25.09.2026).
    refetchInterval: pollTakt(5_000, 30_000),
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
  // 0183: Ein Personal-Aufguss wird übernommen, nicht zugewiesen.
  personal_fallback: 'Personal-Aufgüsse lassen sich nicht zuweisen – bitte im Planer übernehmen.',
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
  // 0183
  personal_fallback: 'Personal-Aufgüsse lassen sich nicht übergeben – bitte im Planer übernehmen.',
  target_not_banja: 'Ein Banja-Ritual geht nur an Aufgießer mit Banja-Freigabe.',
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

// KI-Titel-Vorschläge: der Aufruf von /api/ai?action=suggest-title lebt in
// components/TitleSuggestionPicker.tsx (mit Anmeldung bzw. Öl-Raum-Gerät).
// Der frühere Hook useSuggestInfusionTitle hatte keinen Aufrufer mehr und
// schickte keine Anmeldung mit — entfernt am 25.09.2026.

// ─── Kiosk-Varianten (Öl-Raum-Tablet, ohne Auth) ──────────────────────────
// Identifiziert den Aufgießer per p_saunameister_id (vom Frontend übergeben)
// statt per auth.uid(). Backend prüft is_present + is_aufgieser. (Migration 0070)
// Seit 0177 (25.09.2026) nur noch von einem GEKOPPELTEN Öl-Raum-Gerät:
// p_geraet = Token aus lib/kioskGeraet. Vorher konnte jeder im Internet mit
// einer Mitglieds-UUID Aufgüsse anlegen, ändern und löschen.

/** Übersetzt die Kopplungs-Ablehnung der Kiosk-RPCs in einen verständlichen Text. */
function kioskFehler(error: { message?: string; code?: string }): Error {
  if (error.message?.includes('geraet_nicht_gekoppelt')) {
    // code mitgeben: queryClient erkennt Dauerfehler am Code (42501) und fragt
    // dann nicht sinnlos nach (Audit-Runde 2, 25.09.2026).
    return Object.assign(
      new Error('Dieses Tablet ist nicht gekoppelt. Ein Admin koppelt es unter Admin → Displays → Kiosk-Geräte.'),
      { code: error.code },
    );
  }
  return error as Error;
}

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
        p_geraet: kioskGeraetToken(),
      });
      if (error) throw kioskFehler(error);
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['infusions'] });
      // Seit Migration 0130 checkt das Eintragen den Aufgießer automatisch ein.
      // Ohne diese Invalidierung stünde am Tablet bis zu 10 s lang noch „nicht
      // eingecheckt" neben dem eigenen Namen.
      qc.invalidateQueries({ queryKey: ['present-aufgieser-public'] });
    },
  });
}

/** Zutaten eines BESTEHENDEN Aufgusses am Tablet nachtragen (Migration 0130).
 *
 *  Der Grund für diese RPC ist die Forderungs-Anzeige: sie mahnt fehlende
 *  Zutaten an, und eine Forderung, die man an Ort und Stelle nicht erfüllen
 *  kann, ist nur ein Vorwurf. Anlegen hilft dort nicht — der Aufguss existiert
 *  ja bereits und der Slot ist belegt.
 *
 *  Bewusst eng: Titel, Besonderheiten und Öle. Zeit, Sauna und Dauer bleiben
 *  unangetastet, die gehören in den Planer. */
export function useUpdateInfusionKiosk(saunameisterId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: {
      id: string;
      title: string;
      attributes: InfusionAttribute[];
      oils: (string | null)[] | null;
    }) => {
      if (!saunameisterId) throw new Error('Kein Aufgießer ausgewählt.');
      const { error } = await need().rpc('update_infusion_kiosk', {
        p_id: i.id,
        p_saunameister_id: saunameisterId,
        p_title: i.title,
        p_attributes: i.attributes,
        p_oils: i.oils ?? null,
        p_geraet: kioskGeraetToken(),
      });
      if (error) throw kioskFehler(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['infusions'] });
      qc.invalidateQueries({ queryKey: ['present-aufgieser-public'] });
    },
  });
}

/** Personal-Fallback am Tablet übernehmen (Migration 0131).
 *
 *  Ohne diesen Pfad kann das Tablet an einem frisch materialisierten Tag
 *  GAR NICHTS anlegen: jede Stunde trägt einen Personal-Platzhalter in der
 *  Garantie-Sauna (dort meldet der Overlap-Trigger „belegt"), und die jeweils
 *  andere Sauna blockt die Zweit-Sauna-Regel. Der vorgesehene Ausweg ist die
 *  Übernahme — takeover_personal_fallback aus dem Planer hängt aber an
 *  auth.uid(), das Tablet läuft anonym. */
export function useTakeoverFallbackKiosk(saunameisterId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: {
      infusion_id: string;
      title: string;
      attributes: InfusionAttribute[];
      oils: (string | null)[] | null;
      /** Seit Migration 0158 — vorher setzte die Übernahme am Tablet fest „kein Team". */
      team_infusion?: boolean;
      /** Seit Migration 0184 — vorher blieb jede Übernahme bei den 15 Minuten
       *  des Personal-Platzhalters, egal was am Tablet gewählt war. */
      duration_minutes?: number;
    }) => {
      if (!saunameisterId) throw new Error('Kein Aufgießer ausgewählt.');
      // Eigener Wrapper mit Dauer (0184); der alte takeover_personal_fallback_kiosk
      // bleibt für ältere, noch zwischengespeicherte Tablet-Stände bestehen.
      const { error } = await need().rpc('takeover_personal_fallback_kiosk_mit_dauer', {
        p_infusion_id: i.infusion_id,
        p_saunameister_id: saunameisterId,
        p_title: i.title,
        p_duration_minutes: i.duration_minutes ?? null,
        p_attributes: i.attributes,
        p_oils: i.oils ?? null,
        p_team_infusion: i.team_infusion ?? false,
        p_geraet: kioskGeraetToken(),
      });
      if (error) throw kioskFehler(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['infusions'] });
      qc.invalidateQueries({ queryKey: ['present-aufgieser-public'] });
    },
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
        p_geraet: kioskGeraetToken(),
      });
      if (error) throw kioskFehler(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infusions'] }),
  });
}

// ─── Kiosk-Geräte koppeln (Migration 0177) ───────────────────────────────
export type KioskGeraetStatus =
  | { status: 'fehlt' }
  | { status: 'ungueltig' }
  | { status: 'ok'; art: import('./kioskGeraet').KioskGeraetArt; name: string };

const stundenTakt = pollTakt(60 * 60_000, 60 * 60_000);

/** Ist dieses Gerät gekoppelt? Fragt den Server einmal je Seitenstart (plus stündlich).
 *  Scheitert die Prüfung (Netz/Server weg), wird alle 30 s neu gefragt statt erst
 *  nach einer Stunde — der Fehlerzustand heißt „Prüfe Gerät …", NICHT „nicht
 *  gekoppelt" (Audit-Runde 2, 25.09.2026). Deshalb: `data` fehlt + `isError`
 *  bedeutet „unbekannt", nur `data.status !== 'ok'` bedeutet „nicht gekoppelt". */
export function useKioskGeraetStatus() {
  const token = kioskGeraetToken();
  return useQuery<KioskGeraetStatus>({
    queryKey: ['kiosk-geraet', token ? token.slice(0, 8) : 'keins'],
    queryFn: async () => {
      // Erst das bestätigte Token, dann das einer laufenden QR-Kopplung (0198):
      // Kennt der Server das wartende Token schon (Freigabe kam, nachdem das
      // Gerät den QR-Dialog verlassen hat), wird es hier fest übernommen.
      const offen = kopplungsTokenOffen();
      const kandidaten = [kioskGeraetTokenBestaetigt(), offen].filter(
        (t, i, alle): t is string => !!t && alle.indexOf(t) === i,
      );
      if (kandidaten.length === 0) return { status: 'fehlt' };
      for (const t of kandidaten) {
        const { data, error } = await need().rpc('kiosk_geraet_pruefen', { p_token: t });
        if (error) throw error;
        const d = (data ?? {}) as { ok?: boolean; art?: string; name?: string };
        if (d.ok) {
          if (t === offen) kopplungAbschliessen(t);
          return { status: 'ok', art: d.art as import('./kioskGeraet').KioskGeraetArt, name: d.name ?? '' };
        }
      }
      return { status: 'ungueltig' };
    },
    staleTime: 60 * 60_000,
    // Gleicher Takt mit und ohne Realtime; im Fehlerzustand höchstens 30 s.
    // Solange eine QR-Freigabe eintreffen kann: alle 20 s nachsehen.
    refetchInterval: (q) => (kopplungKannEintreffen() ? 20_000 : stundenTakt(q)),
    retry: 2,
  });
}

/** Darf ein UNGEKOPPELTES Gerät gerade noch Alarm auslösen? (0191: nur bis zur
 *  ersten Öl-Raum-Kopplung, längstens bis 08.10.2026.) Nur für den Hinweis am
 *  Öl-Raum-Tablet — entscheiden tut der Server. */
export function useEvakuierungUebergang(enabled: boolean) {
  return useQuery({
    queryKey: ['evakuierung-uebergang'],
    enabled,
    queryFn: async () => {
      const { data, error } = await need().rpc('evakuierung_uebergang_offen');
      if (error) throw error;
      return data === true;
    },
    staleTime: 10 * 60_000,
    refetchInterval: pollTakt(30 * 60_000, 30 * 60_000),
  });
}

export type KioskGeraetZeile = {
  id: string; name: string; art: string; erstellt_at: string;
  zuletzt_gesehen_at: string | null; widerrufen_at: string | null;
  /** Seit 0191: Einmal-Kopplungscode. Fehlt bei einem älteren Server → wie 'gekoppelt'. */
  eingeloest_at?: string | null;
  kopplung_bis?: string | null;
  status?: 'gekoppelt' | 'ausstehend' | 'abgelaufen' | 'widerrufen';
};

export function useAdminKioskGeraete() {
  return useQuery({
    queryKey: ['admin-kiosk-geraete'],
    queryFn: async () => {
      const { data, error } = await need().rpc('admin_kiosk_geraete');
      if (error) throw error;
      return (data ?? []) as KioskGeraetZeile[];
    },
  });
}

/** Legt ein Gerät an und liefert den EINMAL-Kopplungscode (für den Kopplungs-Link,
 *  24 h gültig, 0191). /koppeln tauscht ihn gegen das eigentliche Geräte-Token. */
export function useAdminKioskGeraetKoppeln() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { name: string; art: string }) => {
      const { data, error } = await need().rpc('admin_kiosk_geraet_koppeln', { p_name: p.name, p_art: p.art });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-kiosk-geraete'] }),
  });
}

/** Kopplung per QR-Code (0197): Anfrage eines Geräts ansehen (Admin). */
export type KioskKopplungAnfrage = {
  ok: boolean; grund?: string; code?: string; art_wunsch?: string | null; geraet_info?: string | null;
  erstellt_at?: string; gueltig_bis?: string; entscheidung?: 'freigegeben' | 'abgelehnt' | null; abgelaufen?: boolean;
  /** Seit 0198: bisherige Kopplung dieses Browsers — endet mit der Freigabe. */
  ersetzt?: { name: string; art: string } | null;
};

export function useAdminKioskKopplung(code: string | null) {
  return useQuery({
    queryKey: ['admin-kiosk-kopplung', code],
    enabled: !!code,
    queryFn: async () => {
      const { data, error } = await need().rpc('admin_kiosk_kopplung_anzeigen', { p_code: code });
      if (error) throw error;
      return (data ?? { ok: false }) as KioskKopplungAnfrage;
    },
    staleTime: 0,
  });
}

/** Anfrage freigeben (legt das Gerät an) oder ablehnen. */
export function useAdminKioskKopplungEntscheiden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { code: string; freigeben: boolean; art?: string; name?: string }) => {
      const { data, error } = await need().rpc('admin_kiosk_kopplung_entscheiden', {
        p_code: p.code, p_freigeben: p.freigeben, p_art: p.art ?? null, p_name: p.name ?? null,
      });
      if (error) throw error;
      return (data ?? { ok: false }) as { ok: boolean; grund?: string; entscheidung?: string; art?: string; name?: string };
    },
    onSuccess: (_d, p) => {
      void qc.invalidateQueries({ queryKey: ['admin-kiosk-geraete'] });
      void qc.invalidateQueries({ queryKey: ['admin-kiosk-kopplung', p.code] });
    },
  });
}

export function useAdminKioskGeraetWiderrufen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().rpc('admin_kiosk_geraet_widerrufen', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-kiosk-geraete'] }),
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

/** Vorlagen des am Öl-Raum-Tablet gewählten Aufgießers (Migration 0158).
 *
 *  Das Tablet ist anonym; per RLS sähe es nur die öffentlichen Vorlagen. Die
 *  Funktion prüft wie die übrigen Kiosk-RPCs, dass die ID zu einem
 *  freigeschalteten Aufgießer gehört, und liefert dessen Vorlagen + die
 *  öffentlichen. Geschrieben wird darüber nichts. */
export function useTemplatesKiosk(memberId: string | null) {
  return useQuery({
    queryKey: ['templates-kiosk', memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await need().rpc('templates_kiosk', { p_member_id: memberId, p_geraet: kioskGeraetToken() });
      if (error) throw kioskFehler(error);
      return (data ?? []) as Template[];
    },
    staleTime: 60_000,
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
// Geheime Spalten (Migration 0172): checkin_pin, member_code, entry_code,
// calendar_feed_token und telegram_link_token darf die Rolle authenticated/anon
// NICHT mehr aus members lesen. Sie stehen nur noch in der eigenen Zeile aus
// current_member() (SECURITY DEFINER); die Mitgliederliste (useAllMembers)
// liefert sie nicht. Darum sind sie hier optional.
export type Member = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  name: string;
  /** Login-Code (QR /m/<code> → Magic-Link). Nur eigene Zeile; Admin: rpc admin_member_code. */
  member_code?: string;
  member_number: number | null;
  role: MemberRole;
  is_aufgieser: boolean;
  is_personal_planer: boolean;
  hourly_rate_eur: number;
  monthly_hour_limit_eur: number;
  entry_code?: string | null;
  sauna_name: string | null;
  sauna_name_changed_at: string | null;
  custom_attrs_enabled: boolean;
  approved: boolean;
  is_present: boolean;
  last_scan_at: string | null;
  revoked_at: string | null;
  birthday: string | null;
  motto: string | null;
  /** Schild-Konfiguration auf der TV-Tafel (Migration 0122). */
  nameplate_config: unknown;
  avatar_path: string | null;
  home_group: string | null;
  calendar_feed_token?: string | null;
  telegram_user_id: number | null;
  telegram_link_token?: string | null;
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
  // Banja-Freigabe (Migration 0148): darf das Ritual anbieten und als
  // einziger das Wort „Banja" im Aufguss-Titel führen. Gesetzt nur vom Admin;
  // durchgesetzt wird es im DB-Trigger, nicht hier.
  darf_banja: boolean;
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
  // Darf mir ein Gast schreiben? (Migration 0133) — Voreinstellung true.
  dm_von_gaesten: boolean;
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

// ─── Saunafeste (Migration 0150/0152) ────────────────────────────────────
// An diesen Samstagen läuft ein Raster zur halben Stunde (erster_slot …
// letzter_slot): vor ab_beide je Stunde eine Sauna im Wechsel 80/100, ab
// ab_beide beide, ab ab_alle zusätzlich `dritte_sauna_id` (Finnische Sauna,
// sonst inaktiv). Den Plan rechnet lib/saunafestPlan.ts (Spiegel von
// saunafest_slots()). Anzeige-Spiegel (Video, Tagesabschluss): lib/saunafeste.ts.

export type SaunafestTag = {
  datum: string;               // YYYY-MM-DD (Europe/Berlin)
  motto: string;
  erster_slot: string;         // Postgres time, 'HH:MM:SS'
  letzter_slot: string;
  ab_beide: string;
  ab_alle: string;
  dritte_sauna_id: string | null;
  /** Migration 0163: gesetzt, sobald der Admin den Plan bestätigt hat — vorher ist alles Entwurf. */
  plan_bestaetigt_at: string | null;
  plan_bestaetigt_von: string | null;
  /** Migration 0167: bis dahin dürfen Mitglieder ihren Zeitraum eintragen/ändern (Standard: Do vorher, 18:00). */
  meldeschluss: string | null;
};

/** Admin: Meldeschluss eines Fests verschieben (0167). */
export function useSaunafestMeldeschlussAendern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { datum: string; meldeschluss: string }) => {
      const { error } = await need().rpc('saunafest_meldeschluss_aendern', { p_datum: p.datum, p_meldeschluss: p.meldeschluss });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saunafest-tage'] }),
  });
}

export function useSaunafestTage() {
  return useQuery({
    queryKey: ['saunafest-tage'],
    queryFn: async () => {
      const { data, error } = await need()
        .from('saunafest_tage')
        .select('*')
        .order('datum', { ascending: true });
      if (error) throw error;
      return (data ?? []) as SaunafestTag[];
    },
    staleTime: 10 * 60_000, // sechs Termine pro Saison
    // Änderungen kommen per Realtime (Kanal „kalender", Migration 0182). Die
    // stündliche Abfrage ist nur das Netz darunter — die 24/7-Tafel sah einen
    // neu angelegten Festtag sonst erst nach dem nächsten Neuladen. Nach einem
    // Ladefehler höchstens 30 s bis zum nächsten Versuch, nicht eine Stunde.
    refetchInterval: pollTakt(60 * 60_000, 60 * 60_000),
  });
}

/** Das Fest an diesem Tag (lokales Berlin-Datum), sonst null. */
export function saunafestAm(date: Date, tage: SaunafestTag[] | undefined): SaunafestTag | null {
  if (!tage?.length) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const key = `${y}-${m}-${d}`;
  return tage.find((t) => t.datum === key) ?? null;
}

// ─── Saunafest-Bewerbungen (Migration 0151) ──────────────────────────────
// Am Fest wird nicht gebucht, sondern beworben: beliebig viele Slots, mehrere
// je Slot. Der Admin teilt zu (saunafest_zuteilen) — daraus entsteht der
// Aufguss des Bewerbers.

export type SaunafestBewerbung = {
  id: string;
  fest_datum: string;
  sauna_id: string;
  slot_zeit: string;           // Postgres time, 'HH:MM:SS' — vergleichen über hhmm()
  member_id: string;
  status: 'offen' | 'zugeteilt' | 'abgelehnt';
  infusion_id: string | null;
  created_at: string;
  entschieden_at: string | null;
};

/** Alle Bewerbungen der kommenden Feste (Planer: Zähler + eigene; Admin: Zuteilung). */
export function useSaunafestBewerbungen() {
  return useQuery({
    queryKey: ['saunafest-bewerbungen'],
    queryFn: async () => {
      const heute = new Date();
      const key = `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-${String(heute.getDate()).padStart(2, '0')}`;
      const { data, error } = await need()
        .from('saunafest_bewerbungen')
        .select('*')
        .gte('fest_datum', key)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as SaunafestBewerbung[];
    },
  });
}

export function useSaunafestBewerben() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { fest_datum: string; sauna_id: string; slot_zeit: string; member_id: string }) => {
      const { error } = await need().from('saunafest_bewerbungen').insert(p);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['saunafest-bewerbungen'] }); },
  });
}

export function useSaunafestBewerbungZurueck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().from('saunafest_bewerbungen').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['saunafest-bewerbungen'] }); },
  });
}

// ─── Saunafest: Zeitraum statt Einzel-Slots (Migration 0163) ─────────────
// Vorgabe Christoph 23./24.09.2026: jeder (außer Gästen) wählt je Fest nur
// einen Zeitraum (erster/letzter Aufguss, den er übernehmen könnte), seine
// Lieblingssauna, optional eine Höchstzahl und einen Hinweis/Wunsch (≤ 300
// Zeichen). Danach sieht er die Tagesübersicht: Zahlen je Uhrzeitblock, keine
// Namen. Der Admin teilt ein (Entwurf, niemand wird angepingt) und bestätigt
// dann den Plan — erst dann bekommt jeder Eingetragene Bescheid.

export type SaunafestZeitraum = {
  id: string;
  fest_datum: string;              // YYYY-MM-DD
  member_id: string;
  von: string;                     // Postgres time 'HH:MM:SS' — vergleichen über hhmm()
  bis: string;
  lieblings_sauna_id: string | null;   // null = egal
  max_aufguesse: number | null;        // null = egal
  notiz: string | null;
  created_at: string;
  updated_at: string;
};

/** Ein Uhrzeitblock der Tagesübersicht (saunafest_uebersicht). */
export type SaunafestBlock = {
  zeit: string;                    // 'HH:MM:SS'
  saunen: string[];                // Saunen, die um diese Zeit dran sind
  bedarf: number;                  // = saunen.length
  verfuegbar: number;              // Personen, deren Zeitraum diese Zeit umfasst
  eingeteilt: number;              // echte Aufgüsse um diese Zeit
  lieblinge: Record<string, number>;   // sauna_id | 'egal' → Anzahl Verfügbarer
};

/** Höchstlänge des Hinweis-/Wunschtextes (DB-CHECK in 0163). */
export const SAUNAFEST_NOTIZ_MAX = 300;

/** Zeiträume kommender Feste: Mitglieder bekommen per RLS nur den eigenen, der Admin alle. */
export function useSaunafestZeitraeume(enabled = true) {
  return useQuery({
    queryKey: ['saunafest-zeitraeume'],
    enabled,
    queryFn: async () => {
      const heute = new Date();
      const key = `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-${String(heute.getDate()).padStart(2, '0')}`;
      const { data, error } = await need()
        .from('saunafest_verfuegbarkeit')
        .select('*')
        .gte('fest_datum', key)
        .order('von', { ascending: true });
      if (error) throw error;
      return (data ?? []) as SaunafestZeitraum[];
    },
  });
}

/** Tagesübersicht eines Festes — nur Zahlen je Uhrzeitblock. */
export function useSaunafestUebersicht(datum: string | null) {
  return useQuery({
    queryKey: ['saunafest-uebersicht', datum],
    enabled: !!datum,
    queryFn: async () => {
      const { data, error } = await need().rpc('saunafest_uebersicht', { p_datum: datum });
      if (error) throw error;
      return (data ?? []) as SaunafestBlock[];
    },
    // Andere Mitglieder sieht Realtime per RLS nicht — darum zusätzlich nachladen.
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
}

function saunafestNeuLaden(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['saunafest-zeitraeume'] });
  qc.invalidateQueries({ queryKey: ['saunafest-uebersicht'] });
  qc.invalidateQueries({ queryKey: ['saunafest-tage'] });
  qc.invalidateQueries({ queryKey: ['infusions'] });
}

export function useSaunafestZeitraumSetzen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      datum: string; von: string; bis: string;
      lieblingsSaunaId: string | null; maxAufguesse: number | null; notiz: string | null;
    }) => {
      const { data, error } = await need().rpc('saunafest_zeitraum_setzen', {
        p_datum: p.datum, p_von: p.von, p_bis: p.bis,
        p_lieblings_sauna: p.lieblingsSaunaId, p_max: p.maxAufguesse, p_notiz: p.notiz,
      });
      if (error) throw error;
      return data as SaunafestZeitraum;
    },
    onSuccess: () => saunafestNeuLaden(qc),
  });
}

export function useSaunafestZeitraumLoeschen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (datum: string) => {
      const { error } = await need().rpc('saunafest_zeitraum_loeschen', { p_datum: datum });
      if (error) throw error;
    },
    onSuccess: () => saunafestNeuLaden(qc),
  });
}

/** Admin: Person in Uhrzeit × Sauna einteilen → legt den Aufguss an (id zurück). */
export function useSaunafestEinteilen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { datum: string; zeit: string; saunaId: string; memberId: string }) => {
      const { data, error } = await need().rpc('saunafest_einteilen', {
        p_datum: p.datum, p_zeit: p.zeit, p_sauna: p.saunaId, p_member: p.memberId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => saunafestNeuLaden(qc),
  });
}

/** Admin: Einteilung zurücknehmen — löscht den Fest-Aufguss. */
export function useSaunafestAusteilen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (infusionId: string) => {
      const { error } = await need().rpc('saunafest_austeilen', { p_infusion: infusionId });
      if (error) throw error;
    },
    onSuccess: () => saunafestNeuLaden(qc),
  });
}

/** Admin: Aufgießer ohne Eintrag erinnern (höchstens einmal je Tag) — Anzahl zurück. */
export function useSaunafestErinnern() {
  return useMutation({
    mutationFn: async (datum: string) => {
      const { data, error } = await need().rpc('saunafest_erinnern', { p_datum: datum });
      if (error) throw error;
      return Number(data) || 0;
    },
  });
}

/** Admin: Plan bestätigen — alle Eingetragenen/Eingeteilten bekommen Bescheid. Anzahl Nachrichten zurück. */
export function useSaunafestPlanBestaetigen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (datum: string) => {
      const { data, error } = await need().rpc('saunafest_plan_bestaetigen', { p_datum: datum });
      if (error) throw error;
      return Number(data) || 0;
    },
    onSuccess: () => saunafestNeuLaden(qc),
  });
}

/** Admin: Bestätigung zurücknehmen (zurück in den Entwurf, ohne Nachrichten). */
export function useSaunafestPlanZuruecknehmen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (datum: string) => {
      const { error } = await need().rpc('saunafest_plan_zuruecknehmen', { p_datum: datum });
      if (error) throw error;
    },
    onSuccess: () => saunafestNeuLaden(qc),
  });
}

// ─── Saunafest: Angaben je Fest-Aufguss + KI-Video (Migrationen 0164/0165) ─
// Nach der Planbestätigung trägt der eingeteilte Aufgießer ein, was sein
// Aufguss wird — keine Pflichtfelder. Titel/Beschreibung/die ersten drei Öle
// landen in infusions (Tafel, Öl-Raum, Bewertung lesen sie wie immer), alles
// andere in saunafest_aufguss_info. Daraus baut api/saunafest-video.ts per
// fal.ai ein Standbild und einen 5-s-Loop, der am Festtag als Hintergrund der
// Aufguss-Karte auf der Tafel läuft.

export type SaunafestAufgussInfo = {
  infusion_id: string;
  thema: string | null;
  bildidee: string | null;
  musik: string | null;
  requisiten: string | null;
  oele: string[];                  // Regal-Slugs oder 'custom:<uuid>', beliebig viele (≤ 40)
  updated_at: string;
  updated_by: string | null;
};

/** Höchstlängen der Freitextfelder (DB-CHECKs in 0164). */
export const SAUNAFEST_INFO_MAX = { titel: 80, beschreibung: 500, thema: 500, bildidee: 500, musik: 200, requisiten: 300, oele: 40 } as const;

export type SaunafestVideoStatus = 'bild' | 'video' | 'fertig' | 'fehler';

export type SaunafestVideo = {
  infusion_id: string;
  status: SaunafestVideoStatus;
  poster_pfad: string | null;      // Pfad im Bucket „assets" → publicAssetUrl()
  video_pfad: string | null;
  fehler: string | null;
  versuche: number;
  eingaben_hash: string | null;
  erzeugt_at: string | null;
  updated_at: string;
};

/** Anonym lesbare Kartendaten eines Festtags (TV-Tafel, Öl-Raum). */
export type SaunafestKarte = {
  infusion_id: string;
  oele: string[];
  poster_pfad: string | null;
  video_pfad: string | null;
  video_status: SaunafestVideoStatus | null;
};

function sortierteIds(ids: string[]): string[] {
  return [...new Set(ids)].sort();
}

/** Angaben zu diesen Fest-Aufgüssen (Angemeldete; leer, wenn noch nichts eingetragen). */
export function useSaunafestAufgussInfos(infusionIds: string[]) {
  const ids = sortierteIds(infusionIds);
  return useQuery({
    queryKey: ['saunafest-info', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await need().from('saunafest_aufguss_info').select('*').in('infusion_id', ids);
      if (error) throw error;
      return (data ?? []) as SaunafestAufgussInfo[];
    },
  });
}

export function useSaunafestAufgussInfoSpeichern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      infusionId: string; titel: string; beschreibung: string; oele: string[];
      thema: string; bildidee: string; musik: string; requisiten: string;
    }) => {
      const { error } = await need().rpc('saunafest_aufguss_info_speichern', {
        p_infusion: p.infusionId, p_titel: p.titel, p_beschreibung: p.beschreibung, p_oele: p.oele,
        p_thema: p.thema, p_bildidee: p.bildidee, p_musik: p.musik, p_requisiten: p.requisiten,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saunafest-info'] });
      qc.invalidateQueries({ queryKey: ['saunafest-karten'] });
      qc.invalidateQueries({ queryKey: ['infusions'] });
    },
  });
}

/** Video-Stand dieser Fest-Aufgüsse; fragt alle 10 s nach, solange eines in Arbeit ist.
 *  `behalten`: beim Wechsel der ids die alten Daten stehen lassen, bis die neuen
 *  da sind (Sammel-Abfrage im Admin-Reiter — sonst flackern alle Kacheln). */
export function useSaunafestVideos(infusionIds: string[], opts?: { behalten?: boolean }) {
  const ids = sortierteIds(infusionIds);
  return useQuery({
    queryKey: ['saunafest-videos', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await need().from('saunafest_video').select('*').in('infusion_id', ids);
      if (error) throw error;
      return (data ?? []) as SaunafestVideo[];
    },
    ...(opts?.behalten ? { placeholderData: keepPreviousData } : {}),
    refetchInterval: (q) => ((q.state.data as SaunafestVideo[] | undefined)?.some((v) => v.status === 'bild' || v.status === 'video') ? 10_000 : false),
  });
}

export type VideoStartAntwort = {
  status: 'gestartet' | 'unveraendert' | 'laeuft' | 'gesperrt' | 'fehler';
  meldung: string;
  /** Nur bei 'laeuft': true = das laufende Video entsteht aus älteren Angaben
   *  als den gerade gespeicherten; false = gleiche Angaben; fehlt = unbekannt. */
  veraltet?: boolean;
};

/** Video (neu) erzeugen lassen. Der Server entscheidet über Kosten-Deckel und
 *  ob sich die Angaben seit dem letzten Video überhaupt geändert haben. */
export async function saunafestVideoStarten(infusionId: string, erzwingen = false): Promise<VideoStartAntwort> {
  const r = await fetch('/api/saunafest-video?action=start', {
    method: 'POST',
    // authHeaders() setzt content-type schon — ein zweiter 'Content-Type' würde
    // zu „application/json, application/json" zusammengeführt, und @vercel/node
    // wirft dann beim Lesen von req.body (→ jeder Start endete mit 500).
    headers: await authHeaders(),
    body: JSON.stringify({ infusion_id: infusionId, erzwingen }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return { status: 'fehler', meldung: (data as { error?: string }).error ?? `Fehler ${r.status}` };
  return data as VideoStartAntwort;
}

/** Kartendaten eines Festtags — anonym (Tafel, Öl-Raum). Nur an Festtagen aktiv. */
export function useSaunafestKarten(datum: string | null) {
  return useQuery({
    queryKey: ['saunafest-karten', datum],
    enabled: !!datum,
    queryFn: async () => {
      const { data, error } = await need().rpc('saunafest_karten', { p_datum: datum });
      if (error) throw error;
      return (data ?? []) as SaunafestKarte[];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export type SaunafestVideoEinstellungen = { tafel_aktiv: boolean; max_versuche: number };

/** Schalter „Videos auf der Tafel" (anonym lesbar, 0165). */
export function useSaunafestVideoEinstellungen() {
  return useQuery({
    queryKey: ['saunafest-video-einstellungen'],
    queryFn: async () => {
      const { data, error } = await need().rpc('saunafest_video_einstellungen');
      if (error) throw error;
      return { tafel_aktiv: true, max_versuche: 3, ...((data ?? {}) as Partial<SaunafestVideoEinstellungen>) };
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useSaunafestVideoTafelSetzen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (aktiv: boolean) => {
      const { error } = await need().rpc('saunafest_video_tafel_setzen', { p_aktiv: aktiv });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saunafest-video-einstellungen'] }),
  });
}

export function useSaunafestZuteilen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await need().rpc('saunafest_zuteilen', { p_id: id });
      if (error) throw error;
      return data as string;   // id des angelegten Aufgusses
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saunafest-bewerbungen'] });
      qc.invalidateQueries({ queryKey: ['infusions'] });
    },
  });
}

export function useSaunafestZuteilungAufheben() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().rpc('saunafest_zuteilung_aufheben', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saunafest-bewerbungen'] });
      qc.invalidateQueries({ queryKey: ['infusions'] });
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
    // Realtime (Kanal „kalender", Migration 0182) + stündliches Netz, damit die
    // 24/7-Tafel einen neuen Feiertag (11-Uhr-Slots) ohne Neuladen kennt.
    // Nach einem Ladefehler höchstens 30 s bis zum nächsten Versuch.
    refetchInterval: pollTakt(60 * 60_000, 60 * 60_000),
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
    // Widerrufenes Gerät (P0001 invalid_password): nicht weiter alle 10 s
    // anklopfen — ein neues Koppeln bringt ein neues Passwort, also eine neue
    // Abfrage. Netzfehler bleiben im 10-s-Takt (Audit-Runde 2, 25.09.2026).
    refetchInterval: (q) => (q.state.status === 'error' && istDauerFehler(q.state.error) ? false : 10_000),
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

// ─── Namensschild (Migration 0121) ──────────────────────────────────────
// Aufgiesser waehlt Farbe/Transparenz/Form seines Namensschilds auf der
// TV-Tafel. Nur die ID wandert in die DB, das Aussehen liegt im Frontend
// (src/lib/nameplates.ts) — so laesst sich ein Stil ohne Migration aendern.
export function useSetMyNameplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: unknown) => {
      const { data, error } = await need().rpc('set_my_nameplate_config', { p_config: config });
      if (error) throw error;
      if (data === 'invalid' || data === 'too_long') throw new Error('Ungueltige Schild-Einstellung.');
      if (data === 'not_authorized') throw new Error('Nicht berechtigt.');
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-member'] });
      qc.invalidateQueries({ queryKey: ['member'] });
      qc.invalidateQueries({ queryKey: ['meister-directory'] });
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

// enabled=false für Aufrufer, die ohne Mitglied gemountet sind (Bottom-Nav):
// sonst pollte auch anon alle 15 s (Audit 25.09.2026).
export function useUnreadDmsCount(enabled = true) {
  return useQuery({
    queryKey: ['dm-unread'],
    enabled,
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
    // Die Admin-Liste hängt an ['members'] (useAllMembers) — ['all-members']
    // gab es nie (Audit 25.09.2026). Promise zurückgeben: die Mutation bleibt
    // „pending", bis die Zeile neu geladen ist.
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['members'] }),
      qc.invalidateQueries({ queryKey: ['current-member'] }),
      qc.invalidateQueries({ queryKey: ['member'] }),
      qc.invalidateQueries({ queryKey: ['members-directory'] }),
    ]),
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
    // Wie oben: ['members'] ist der Schlüssel der Admin-Liste. Bis die Zeile
    // neu geladen ist, bleibt das Schloss gesperrt (isPending) — sonst schickte
    // ein zweiter Klick wieder den alten Zielwert.
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['members'] }),
      qc.invalidateQueries({ queryKey: ['current-member'] }),
    ]),
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
      // Nur Dateien aus dem Galerie-Ordner löschen: Ältere Zeilen konnten auf
      // fremde Dateien zeigen (Profilbild, Logo …) — ein Admin hätte die sonst
      // mit seinen Rechten gleich mit entfernt. Seit 0192 prüft die DB den Pfad.
      if (photo.photo_path.startsWith('member-photos/')) {
        try { await deleteAsset(photo.photo_path); } catch { /* ignore */ }
      }
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
    refetchInterval: pollTakt(60 * 60_000, 60 * 60_000), // 1h, nach Fehler ≤ 30 s
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

/** Content-Type + Bearer-JWT der aktuellen Sitzung (für api/*-Aufrufe). */
export async function authHeaders(): Promise<Record<string, string>> {
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

/** Push an bestimmte Mitglieder — nur Admins dürfen fremde Empfänger ansprechen (api/push-send). */
export async function sendPushTo(memberIds: string[], payload: { title: string; body: string; url?: string; tag?: string }) {
  if (memberIds.length === 0) return;
  const r = await fetch('/api/push-send', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ member_ids: memberIds, ...payload }),
  });
  if (!r.ok) throw new Error(`push-send failed: ${r.status}`);
}

/** Freier Rundruf an alle Push-Abos — seit 25.09.2026 nur für Admins (z. B. Evakuierung). */
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

/**
 * Rundruf aus dem Planer über eine Server-Vorlage (api/push-send, 0187): der
 * Server baut Text, Empfänger und Ziel aus der Datenbank und schickt jede
 * Vorlage je Bezug nur einmal. So dürfen auch Aufgießer ohne Admin-Rechte
 * benachrichtigen, ohne freien Text an alle schicken zu können.
 *   team_aufguss     → alle anderen Aufgießer (Co-Aufgießer gesucht)
 *   stammslot_antrag → die Admins
 *   urlaubsslots     → alle anderen Aufgießer
 */
export async function sendVorlagePush(p:
  | { vorlage: 'team_aufguss'; sauna_id: string; start_time: string }
  | { vorlage: 'stammslot_antrag'; slot_id: string }
  | { vorlage: 'urlaubsslots'; absence_id: string }) {
  const r = await fetch('/api/push-send', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(p),
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
      const sb = need();
      // Ohne Anmeldung gar nicht erst fragen (Audit 25.09.2026): current_member()
      // ist „RETURNS members" und liefert für anon eine Zeile voller NULLs. Das
      // war im Frontend ein „Mitglied" ohne id und ohne Freigabe — nach jedem
      // Login blitzte „Konto wartet auf Freigabe" auf, und Tafel/Kiosk fragten
      // bei jedem Laden Mitglieder-Daten ab. Jetzt gilt: kein Mitglied = null.
      const { data: sitzung, error: sitzungsFehler } = await sb.auth.getSession();
      // Sitzung vorhanden, aber gerade nicht auffrischbar (offline, schwaches
      // WLAN, Auth-Server weg): auth-js liefert dann session=null MIT Fehler
      // und behält die Sitzung. Das ist KEIN „nicht angemeldet" — sonst zeigte
      // die App „Konto wartet auf Freigabe" und der letzte Stand ginge verloren.
      // Als Fehler bleibt er im Cache, und es wird alle 30 s erneut versucht.
      if (sitzungsFehler) throw sitzungsFehler;
      if (!sitzung.session) return null;
      const { data, error } = await sb.rpc('current_member');
      if (error) throw error;
      // current_member returns a row of public.members
      const m = (Array.isArray(data) ? data[0] : data) as Member | null | undefined;
      return m?.id ? m : null;
    },
    // Anwesenheit, Rolle, Freigabe ändern sich auch außerhalb der App (Tablet,
    // Admin). Beim Zurückkehren in die App frisch holen — ein günstiger Aufruf.
    refetchOnWindowFocus: true,
  });
}

/** Wartet die App noch auf die Mitgliederzeile? Direkt nach der Anmeldung
 *  steht im Cache noch „kein Mitglied" (null) aus der Zeit davor, während der
 *  Neuabruf läuft — das darf weder „Konto wartet auf Freigabe" noch die
 *  Ersteinrichtung auslösen. Nach einem Fehler (offline) wird NICHT gewartet:
 *  die Wiederholung alle 30 s soll die Seite nicht jedes Mal ausblenden. */
export function wartetAufMitglied(q: {
  isLoading: boolean; isFetching: boolean; isError: boolean; data: Member | null | undefined;
}): boolean {
  return q.isLoading || (q.isFetching && !q.data && !q.isError);
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
  // Seit 0179 nur Tag + Monat (Jahr immer 2000) — nie als Alter verwenden.
  birthday: string | null;
  motto: string | null;
  avatar_path: string | null;
  home_group: string | null;
  // Migration 0076: Mitarbeiter-Flag + Familien-Mitgliedschaft.
  // Seit 0179: family_has_partner = „hat Familie" (Gäste sehen immer false),
  // family_children_count immer 0 — genaue Werte nur admin_list_members().
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
  /** Schild-Konfiguration (Migration 0122). Null = noch nie eingestellt →
   *  Frontend faellt auf die Vorgabe zurueck (nameplateAus). */
  nameplate_config: unknown;
};
/** `poll`: für Dauer-Anzeigen (Tafel, Öl-Raum), die wochenlang gemountet
 *  bleiben — members steht nicht in der Realtime-Publication, neue
 *  Aufgießer, Avatare und Mottos kämen sonst erst mit dem Neuladen an. */
export function useMeisterDirectory(opts?: { poll?: boolean }) {
  return useQuery({
    queryKey: ['meister-directory'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_meister_names');
      if (error) throw error;
      return (data ?? []) as MeisterDirectoryEntry[];
    },
    // Nach einem Ladefehler höchstens 30 s bis zum nächsten Versuch.
    ...(opts?.poll ? { refetchInterval: pollTakt(10 * 60_000, 10 * 60_000), refetchIntervalInBackground: true } : {}),
  });
}

// ─── set_my_default_mood (Migration 0100) ────────────────────────────────
// Aufgießer hinterlegt seinen "Standard-Stil" (max 5 Attrs + 3 Öle).
// Frontend nutzt das in InfusionCard als Fallback wenn ein Aufguss
// keine eigenen attrs/oils hat — "🪶 Sein Stil"-Pills.
const SET_DEFAULT_MOOD_ERROR_LABELS: Record<string, string> = {
  not_authenticated: 'Nicht eingeloggt.',
  too_many_attributes: 'Maximal 5 Standard-Besonderheiten.',
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

/** Admin-Mitgliederliste (nur Admin-Bereich). Seit 0175/0176 über die
 *  DEFINER-RPC admin_list_members(): anon/authenticated dürfen persönliche
 *  Spalten (E-Mail, Geburtstag, Anschrift, Lohn, Familie …) und die Geheimnisse
 *  (PIN, Login-Code, Tokens) nicht mehr direkt aus members lesen. Die RPC liefert
 *  alle Spalten außer den Geheimnissen, nur an freigegebene, nicht gesperrte Admins.
 *  NIE select('*') auf members — es gibt nur noch Spaltenrechte (42501). */
export function useAllMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const { data, error } = await need().rpc('admin_list_members');
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as Member[];
    },
  });
}

/** Login-Code eines Mitglieds für das Ausweis-PDF (nur Admin, SECURITY DEFINER, Migration 0171). */
export async function adminMemberCode(memberId: string): Promise<string> {
  const { data, error } = await need().rpc('admin_member_code', { p_member_id: memberId });
  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('Kein Mitgliedscode gefunden.');
  return data;
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

// „✓ gelesen" im CP-Posteingang. Seit 0188 setzt der Server read_at (wie die
// Glocke) statt processed_at (Versand-Flag des Push-Dispatchers), und die Liste
// zeigt nur Ungelesenes. Der Eintrag verschwindet sofort (optimistisch) und
// kommt bei einem Fehler zurück.
export function useMarkNotificationSeen() {
  const qc = useQueryClient();
  return useMutation<void, Error, string, { vorher?: AppNotification[] }>({
    mutationFn: async (id: string) => {
      const { error } = await need().rpc('mark_notification_seen', { p_id: id });
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['my-notifications'], exact: true });
      const vorher = qc.getQueryData<AppNotification[]>(['my-notifications']);
      qc.setQueryData<AppNotification[]>(['my-notifications'], (alt) => (alt ?? []).filter((n) => n.id !== id));
      return { vorher };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.vorher) qc.setQueryData(['my-notifications'], ctx.vorher);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['my-notifications'] });
      qc.invalidateQueries({ queryKey: ['my-notifications-unread'] });
    },
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

export function useSendSetPasswordEmail() {
  return useMutation({
    mutationFn: async (p: { recipients?: string[]; audience?: 'all' | 'aufgieser' | 'admins' }) => {
      const r = await fetch('/api/email?action=send-set-password', {
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

// ─── Telegram-Verteiler: Freigabe neuer Chats (Migration 0187) ───────────
// /start beim Bot trägt einen Chat nicht mehr sofort ein, sondern als Anfrage.
// Admins geben frei oder lehnen ab (Admin → Handbuch → Telegram).
export type TelegramChatEintrag = {
  chat_id: number;
  status: 'aktiv' | 'wartet' | 'abgelehnt';
  vorname: string | null;
  benutzername: string | null;
  chat_typ: string | null;
  angefragt_at: string | null;
  mitglied_name: string | null;
  mitglied_gesperrt: boolean | null;
};

export function useTelegramChatsAdmin(enabled = true) {
  return useQuery({
    queryKey: ['telegram-chats-admin'],
    enabled,
    queryFn: async () => {
      const { data, error } = await need().rpc('telegram_chats_admin_liste');
      if (error) throw error;
      return (data ?? []) as TelegramChatEintrag[];
    },
  });
}

export function useTelegramChatEntscheiden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { chat_id: number; aktion: 'freigeben' | 'ablehnen' }) => {
      const { error } = await need().rpc('telegram_chat_entscheiden', { p_chat_id: p.chat_id, p_aktion: p.aktion });
      if (error) {
        const msg = (error as { message?: string }).message ?? '';
        if (msg.includes('anfrage_nicht_gefunden')) throw new Error('Diese Anfrage gibt es nicht mehr — bitte neu laden.');
        if (msg.includes('not_admin')) throw new Error('Nur Admins dürfen Telegram-Chats freigeben.');
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['telegram-chats-admin'] });
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

export function useMyEmailAccount(enabled = true) {
  return useQuery({
    queryKey: ['my-email-account'],
    enabled,
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
      // Seit 0186 liefert delete_member die Dateien des Kontos (Profilbild,
      // Fotos) als Löschliste — SQL darf den Speicher nicht selbst leeren.
      const { error } = await need().rpc('delete_member', { p_member_id: memberId });
      if (error) throw error;
      // Das Konto ist gelöscht; bleiben Dateien liegen, arbeitet der Reiter
      // „Gäste" sie später ab. Deshalb hier kein Fehler nach außen.
      try {
        await speicherLoeschlisteAbarbeiten();
      } catch (e) {
        console.warn('[datenschutz] Dateien des gelöschten Kontos noch nicht entfernt', e);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: ['present'] });
      qc.invalidateQueries({ queryKey: ['pending'] });
      qc.invalidateQueries({ queryKey: ['members-directory'] });
      qc.invalidateQueries({ queryKey: ['storage-loeschliste'] });
    },
  });
}

// ─── Löschliste für Dateien (Migration 0186) ─────────────────────────────
// SQL darf storage.objects nicht löschen (storage.protect_delete). Die
// Datenbank merkt sich deshalb Dateien gelöschter Konten und verwaiste
// persönliche Dateien (ersetzte Profilbilder …) in storage_loeschliste; ein
// Admin entfernt sie über die Storage-API. storage_loeschliste_offen() trägt
// vorher aus, was schon weg ist oder wieder verwendet wird.

async function dateienEntfernen(pfade: string[]): Promise<void> {
  for (let i = 0; i < pfade.length; i += 100) {
    const { error } = await need().storage.from('assets').remove(pfade.slice(i, i + 100));
    if (error) throw error;
  }
}

/** Nur für Admins: offene Einträge der Löschliste entfernen. Gibt zurück,
 *  wie viele danach noch offen sind (0 = alles erledigt). */
async function speicherLoeschlisteAbarbeiten(): Promise<number> {
  const { data, error } = await need().rpc('storage_loeschliste_offen');
  if (error) throw error;
  const offen = (data ?? []) as string[];
  if (offen.length === 0) return 0;
  await dateienEntfernen(offen);
  const { data: rest, error: restErr } = await need().rpc('storage_loeschliste_offen');
  if (restErr) throw restErr;
  return ((rest ?? []) as string[]).length;
}

/** Admin: wie viele Dateien warten auf Entfernung? */
export function useStorageLoeschliste(enabled = true) {
  return useQuery({
    queryKey: ['storage-loeschliste'],
    enabled,
    queryFn: async () => {
      const { data, error } = await need().rpc('storage_loeschliste_offen');
      if (error) throw error;
      return ((data ?? []) as string[]).length;
    },
    staleTime: 5 * 60_000,
  });
}

export function useStorageLoeschlisteAbarbeiten() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: speicherLoeschlisteAbarbeiten,
    onSettled: () => qc.invalidateQueries({ queryKey: ['storage-loeschliste'] }),
  });
}

export function usePresentMembers() {
  return useQuery({
    queryKey: ['present'],
    queryFn: async () => {
      // Seit 0192 über die RPC: members.is_present/last_scan_at sind für
      // Clients nicht mehr direkt lesbar. Die RPC liefert nur Vereinsmitgliedern
      // (admin/staff/member/guest_aufgieser) etwas — Gäste und der Scanner ohne
      // Anmeldung bekommen wie bisher eine leere Liste.
      const { data, error } = await need().rpc('list_present_members');
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; last_scan_at: string | null; is_aufgieser: boolean; avatar_path: string | null }[];
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
    // Muss im Hintergrund weiterlaufen: der Kiosk-Browser meldet den Tab als
    // hidden, obwohl der Bildschirm im Öl-Raum an ist und die Anwesenheits-
    // Häkchen dort dauerhaft sichtbar sind. Ohne das friert die Anzeige beim
    // ersten Standby ein und behauptet stundenlang eine falsche Anwesenheit.
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

// ─── Self-Presence (Migration 0050, Zielzustand seit 0188) ───────────────
// Die App schickt den GEWÜNSCHTEN Zustand („Ich bin da" = true, „Ich gehe
// jetzt" = false), nicht „umschalten". Zeigt die App einen veralteten Stand
// (am Tablet schon eingecheckt), bleibt man trotzdem eingecheckt, statt
// versehentlich ausgecheckt zu werden. toggle_my_presence gibt es nicht mehr.
export async function setMyPresence(present: boolean): Promise<boolean> {
  const { data, error } = await need().rpc('set_my_presence', { p_present: present });
  if (error) throw error;
  return Boolean(data);
}

export function useSetMyPresence() {
  const qc = useQueryClient();
  return useMutation<boolean, Error, boolean>({
    mutationFn: setMyPresence,
    // Auch nach einem Fehler neu laden — dann stimmt wenigstens die Anzeige.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['current-member'] });
      qc.invalidateQueries({ queryKey: ['present'] });
      qc.invalidateQueries({ queryKey: ['present-full'] });
    },
  });
}

// ─── Technische Fehler aus dem Frontend (Migration 0188, nur Admin) ──────
// Geschrieben von src/lib/fehlerbericht.ts (Tafel, Kiosk, App).
export type ClientFehler = {
  id: number;
  erstmals_am: string;
  zuletzt_am: string;
  anzahl: number;
  quelle: string;
  route: string;
  meldung: string;
  stack: string | null;
  geraet: string | null;
  angemeldet: boolean;
};

export function useClientFehler(tage = 7, enabled = true) {
  return useQuery({
    queryKey: ['client-fehler', tage],
    enabled,
    queryFn: async () => {
      const { data, error } = await need().rpc('client_fehler_liste', { p_tage: tage });
      if (error) throw error;
      return (data ?? []) as ClientFehler[];
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
// Seit 25.09.2026 über den Server (api/qr-signin.ts?action=pin-toggle): dort
// werden Fehlversuche je IP gebremst. Der direkte RPC-Weg ist gesperrt (0174),
// er ließ sich mit dem öffentlichen Schlüssel ohne Bremse durchprobieren.
// Fehlertexte bleiben die alten Kennungen, damit Scanner.tsx sie erkennt.
// Gekoppelter Scanner schickt sein Geräte-Token mit (0177): dann greift der
// gemeinsame Topf für ungekoppelte Fehlversuche nicht (api/qr-signin.ts).
export async function togglePresenceByCheckinPin(pin: string) {
  const r = await fetch('/api/qr-signin?action=pin-toggle', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...kioskGeraetHeader() },
    body: JSON.stringify({ pin }),
  });
  const data = (await r.json().catch(() => ({}))) as {
    error?: string; member_id?: string; name?: string; is_present?: boolean; needs_family_modal?: boolean;
  };
  if (!r.ok) {
    if (r.status === 404) throw new Error('unknown_or_revoked');
    if (r.status === 429) throw new Error('zu_viele_fehlversuche');
    throw new Error(data.error ?? `Check-in fehlgeschlagen (${r.status})`);
  }
  return data as { member_id: string; name: string; is_present: boolean; needs_family_modal: boolean };
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
    // Kopie sortieren — sort() allein veränderte das Array des Aufrufers.
    queryKey: ['co-aufgieser', ...[...infusionIds].sort()],
    enabled: infusionIds.length > 0,
    // Beitritte kommen per Realtime (Kanal „tafel"): der Key hängt nur an den
    // Aufguss-IDs, ein Beitritt am Aufgusstag änderte ihn nie — die Tafel zeigte
    // den Team-Partner praktisch nie (Audit 25.09.2026). Netz darunter: 1 min
    // ohne bestätigten Kanal, sonst 10 min.
    refetchInterval: pollTakt(60_000, 10 * 60_000),
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
        // RLS (Migration 0179): nur kommende Team-Aufgüsse anderer Aufgießer
        if (error.code === '42501') {
          throw new Error('Beitritt nicht möglich — der Aufguss ist vorbei oder kein Team-Aufguss.');
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
  /** 0191: mitglied | geraet | uebergang (ältere Alarme: null). */
  quelle?: string | null;
  foto_status?: string | null;
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
    // Seit 0177 (25.09.2026) über evakuierung_ausloesen(): die Anwesenheitsliste
    // setzt der Server, und nur eingeloggte Mitglieder (nicht Gast/Fan) oder ein
    // gekoppeltes Kiosk-Gerät dürfen auslösen. Vorher durfte jeder anonym in
    // evacuation_events schreiben — eingeloggte Aufgießer ohne Admin-Rolle aber
    // NICHT. Läuft schon ein Alarm, kommt dieser zurück (schon_aktiv).
    // present_names wird aus Kompatibilität noch angenommen, aber ignoriert.
    mutationFn: async (p: { triggered_by?: string | null; present_names?: string[] }) => {
      const { data, error } = await need().rpc('evakuierung_ausloesen', {
        p_geraet: kioskGeraetToken(),
        p_von: p.triggered_by ?? null,
      });
      if (error) {
        if (error.message?.includes('nicht_berechtigt')) {
          throw new Error('Dieses Gerät darf keinen Alarm auslösen (nicht gekoppelt bzw. nicht angemeldet).');
        }
        if (error.message?.includes('evakuierung_gebremst')) {
          // 0191: Bremse NUR für ungekoppelte Geräte im Übergang (2 je 30 min).
          throw new Error('Von ungekoppelten Geräten wurden gerade schon 2 Alarme ausgelöst — weitere nur angemeldet am Handy oder an einem gekoppelten Tablet.');
        }
        throw error;
      }
      // Im Übergang (ungekoppelt) liefert der Server keine Namensliste mit.
      return data as EvacuationEvent & { schon_aktiv?: boolean };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evacuation'] }),
  });
}

export function useEndEvacuation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().rpc('evakuierung_beenden', { p_id: id, p_geraet: kioskGeraetToken() });
      if (error) {
        if (error.message?.includes('nicht_berechtigt')) {
          throw new Error('Beenden ist nur für angemeldete Mitglieder oder gekoppelte Geräte möglich.');
        }
        throw error;
      }
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
/** `poll`: für Dauer-Anzeigen (Öl-Raum-Tablet, TV-Tafel), die wochenlang
 *  gemountet bleiben. Ohne Takt sähen sie eine im Admin geänderte Einstellung
 *  erst beim nächsten Neuladen — so geschehen am 03.09.2026 mit dem
 *  Tageszeit-Hintergrund. Änderungen kommen per Realtime (system_config im
 *  Kanal „tafel"); der Takt ist das Netz darunter: 1 min ohne bestätigten
 *  Kanal, sonst 10 min. Normale Seiten laden beim Mount, das reicht. */
export function useBrandSettings(opts?: { poll?: boolean }) {
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
    ...(opts?.poll ? { refetchInterval: pollTakt(60_000, 10 * 60_000), refetchIntervalInBackground: true } : {}),
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
export function useBrandSync(opts?: { poll?: boolean }): BrandSettings {
  const q = useBrandSettings(opts);
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

/** `poll`: für Dauer-Anzeigen (Tafel, Öl-Raum). schedule_settings ist für anon
 *  per RLS nicht lesbar, Realtime erreicht die Displays hier also nicht — ohne
 *  Takt rasterte der TV nach „4 Kacheln" oder „Montag offen" bis zum Neuladen falsch. */
export function useScheduleSettings(opts?: { poll?: boolean }) {
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
    // Nach einem Ladefehler höchstens 30 s bis zum nächsten Versuch.
    ...(opts?.poll ? { refetchInterval: pollTakt(5 * 60_000, 5 * 60_000), refetchIntervalInBackground: true } : {}),
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

// ─── Displays: Joker-Bildschirmschoner-Sperre (Migrationen 0153–0155) ─────
// Ist die Sauna zu, zeigen ALLE Displays (TV-Tafel, Eingangs-Tablet, Öl-Raum,
// Scanner) den Joker. „Offen" rechnet der Server aus dem Aufguss-Raster:
// 60 min vor dem ersten planbaren Slot (die Sauna öffnet eine Stunde vor dem
// ersten Aufguss, Migration 0156) bis 30 min nach Ende des letzten Slots (plus
// echte Sondertermine, Saunafest bis nach Mitternacht) — die Displays fragen
// nur ab. Freigeben / von Hand sperren / ausschalten darf allein der Admin.
export type KioskDisplay = 'eingang' | 'tafel' | 'oelraum' | 'scanner';
export type KioskSperreStatus = {
  aktiv: boolean;
  gesperrt: boolean;
  /** 'manuell' = vom Admin von Hand gesperrt (Migration 0154), gilt bis gesperrt_bis. */
  grund: 'aus' | 'freigegeben' | 'manuell' | 'offen' | 'geschlossen';
  oeffnet_um: string | null;
  /** Heutiges Öffnungsfenster als HH:MM (Berlin); null = ganztägig zu (Ruhetag). */
  heute_von: string | null;
  heute_bis: string | null;
  puffer_vor_min: number;
  puffer_nach_min: number;
  freigegeben_bis: string | null;
  gesperrt_bis: string | null;
  letzte_beruehrung_at: string | null;
  letztes_display: string | null;
  beruehrungen: number;
  /** Serverzeit der Antwort (Epoche in ms, Migration 0161) — gemeinsamer Takt für den Kübel-Gag. */
  jetzt_ms?: number;
};

async function kioskSperreStatusLaden(): Promise<KioskSperreStatus> {
  const { data, error } = await need().rpc('kiosk_sperre_status');
  if (error) throw error;
  return data as KioskSperreStatus;
}

export function useKioskSperreStatus(opts?: { enabled?: boolean; intervalMs?: number }) {
  return useQuery<KioskSperreStatus>({
    queryKey: ['kiosk-sperre'],
    enabled: opts?.enabled ?? true,
    queryFn: kioskSperreStatusLaden,
    // Kein Realtime-Kanal für das anonyme Tablet: Polling ist hier der
    // Update-Pfad (Freigabe vom Handy wirkt nach spätestens einem Intervall).
    refetchInterval: opts?.intervalMs ?? 10_000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: false,
  });
}

/** Liegt gerade der Joker über dem Display? Liest nur mit, was der
 *  KioskSperreRunner (App.tsx) ohnehin abfragt — kein eigener Abruf, kein
 *  zweiter Takt (ein zweites useKioskSperreStatus pollte doppelt). Ohne Daten
 *  (Laden, Fehler, kein Display-Pfad): false. */
export function useKioskGesperrtMitlesen(): boolean {
  const q = useQuery<KioskSperreStatus>({
    queryKey: ['kiosk-sperre'],
    queryFn: kioskSperreStatusLaden,
    enabled: false,
    staleTime: 0,
    retry: false,
  });
  return q.data?.gesperrt === true;
}

/** Display wurde im gesperrten Zustand angetippt — der Server meldet es (gedrosselt) allen Admins. */
export async function kioskSperreBeruehrt(display: KioskDisplay): Promise<{ gesperrt: boolean; gemeldet: boolean; heute?: number }> {
  const { data, error } = await need().rpc('kiosk_sperre_beruehrt', { p_display: display });
  if (error) throw error;
  // `heute` = so viele haben heute schon am gesperrten Display getippt (Migration 0160).
  return data as { gesperrt: boolean; gemeldet: boolean; heute?: number };
}

export function useKioskSperreFreigeben() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (minuten: number) => {
      const { data, error } = await need().rpc('kiosk_sperre_freigeben', { p_minuten: minuten });
      if (error) throw error;
      return data as KioskSperreStatus;
    },
    onSuccess: (d) => qc.setQueryData(['kiosk-sperre'], d),
  });
}

export function useKioskSperreSperren() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await need().rpc('kiosk_sperre_sperren');
      if (error) throw error;
      return data as KioskSperreStatus;
    },
    onSuccess: (d) => qc.setQueryData(['kiosk-sperre'], d),
  });
}

/** Sofort sperren — unabhängig von den Öffnungszeiten, bis zum nächsten Morgen 05:00 Uhr. */
export function useKioskSperreJetztSperren() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await need().rpc('kiosk_sperre_jetzt_sperren');
      if (error) throw error;
      return data as KioskSperreStatus;
    },
    onSuccess: (d) => qc.setQueryData(['kiosk-sperre'], d),
  });
}

/** Hand-Sperre zurücknehmen — danach gelten wieder die Öffnungszeiten. */
export function useKioskSperreAufheben() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await need().rpc('kiosk_sperre_aufheben');
      if (error) throw error;
      return data as KioskSperreStatus;
    },
    onSuccess: (d) => qc.setQueryData(['kiosk-sperre'], d),
  });
}

/** Hauptschalter: Joker-Sperre für alle Displays ein/aus. */
export function useKioskSperreAktivSetzen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (aktiv: boolean) => {
      const { data, error } = await need().rpc('kiosk_sperre_aktiv_setzen', { p_aktiv: aktiv });
      if (error) throw error;
      return data as KioskSperreStatus;
    },
    onSuccess: (d) => qc.setQueryData(['kiosk-sperre'], d),
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

// ─── Sudaufguss: Kräuter-Pool + Mischungen (Migration 0124) ──────────────
// Gemeinsam für den ganzen Verein, nicht pro Aufgießer. Beide Tabellen sind
// anon lesbar, weil die TV-Tafel ohne Login läuft und 'sud:<uuid>' in Namen
// auflösen muss.

export function useSudKraeuter() {
  return useQuery({
    queryKey: ['sud-kraeuter'],
    queryFn: async () => {
      const { data, error } = await need()
        .from('sud_kraeuter')
        .select('id,name,emoji,color,art,created_by')
        .order('name');
      if (error) throw error;
      return data as SudKraut[];
    },
    staleTime: 60_000,
  });
}

export function useSudMixe() {
  return useQuery({
    queryKey: ['sud-mixe'],
    queryFn: async () => {
      const { data, error } = await need()
        .from('sud_mixe')
        .select('id,name,emoji,color,kraeuter,created_by')
        .order('name');
      if (error) throw error;
      return data as SudMix[];
    },
    staleTime: 60_000,
  });
}

export function useAddSudKraut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (k: { name: string; emoji: string; color: string; art: 'kraut' | 'raeucher'; created_by: string }) => {
      const { error } = await need().from('sud_kraeuter').insert(k);
      // Der unique-Index auf lower(btrim(name)) verhindert Dubletten. Die
      // Rohmeldung ist für den Aufgießer unbrauchbar, deshalb übersetzt.
      if (error) {
        throw new Error(error.code === '23505'
          ? `„${k.name}" gibt es schon im Regal.`
          : error.message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sud-kraeuter'] }),
  });
}

export function useAddSudMix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: { name: string; emoji: string; color: string; kraeuter: string[]; created_by: string }) => {
      const { error } = await need().from('sud_mixe').insert(m);
      if (error) {
        throw new Error(error.code === '23505'
          ? `Eine Mischung „${m.name}" gibt es schon.`
          : error.message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sud-mixe'] }),
  });
}

export function useDeleteSudEintrag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, art }: { id: string; art: 'kraut' | 'mix' }) => {
      const { error } = await need()
        .from(art === 'kraut' ? 'sud_kraeuter' : 'sud_mixe')
        .delete().eq('id', id);
      if (error) throw error;
      return art;
    },
    onSuccess: (art) => qc.invalidateQueries({
      queryKey: [art === 'kraut' ? 'sud-kraeuter' : 'sud-mixe'],
    }),
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
  /** Motiv fuer die Tafel. Beginnt mit '/' -> Datei im Repo, sonst
   *  Storage-Pfad. NULL = kein Bild (Migration 0128). */
  image_path: string | null;
};

/** ID-Format für Custom-Öle in infusions.oils. */
// Liegt seit 14.08.2026 in lib/oils.ts (dort, wo die Öl-IDs herkommen) — hier
// nur noch re-exportiert, damit die bestehenden Importe aus api.ts weiterlaufen.
export { CUSTOM_OIL_PREFIX, customOilId, parseCustomOilId } from './oils';

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

// Abzeichen vergibt der Client nur noch über award_my_badge (src/lib/checkBadges.ts,
// Migration 0181): award_badge ist seitdem rein intern — der Server prüft, ob das
// Abzeichen dem eigenen Mitglied wirklich zusteht.

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

// Rückgabewerte von submit_rating (Migration 0179). Direktes Schreiben in
// infusion_ratings ist seit 0179 gesperrt — Bewertungen nur über diese RPC.
export type SubmitRatingResult =
  | 'ok'
  | 'not_logged_in'
  | 'rating_only_for_self'
  | 'infusion_not_found'
  | 'self_rating_not_allowed'
  | 'infusion_not_finished'
  | 'not_attended_that_day'
  | 'rating_window_expired'
  | 'rating_window_expired_aufgieser'
  | 'stunde_schon_bewertet'
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
  // Mitgelieferte Dateien (public/…) stehen als absoluter Pfad in den Settings
  // und brauchen keinen Umweg über den Storage-Bucket: die Öl-Raum-Vorlagen in
  // src/lib/oelraumVorlagen.ts und das Saunafest-Video unter /tafel/.
  // Storage-Pfade sehen dagegen immer aus wie „info-karten/xyz.mp4" — ohne
  // führenden Slash, deshalb kollidiert das nicht.
  // „//host/…" ist dagegen eine protokoll-relative FREMDE Adresse (Tracking-
  // Pixel über einen frei gesetzten Pfad) — die wird nie ausgeliefert.
  if (path.startsWith('//')) return null;
  if (path.startsWith('/')) return path;
  const c = supabase;
  if (!c) return null;
  const { data } = c.storage.from('assets').getPublicUrl(path);
  return data.publicUrl;
}

// Muss zu allowed_mime_types des Buckets „assets" passen (Migration 0180).
// Kein SVG: Eine SVG-Datei kann Skript enthalten, und der Typfilter des
// Buckets gilt für alle Ordner — auch für die, in die jeder Gast hochlädt.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Animierte GIFs nicht neu kodieren (der Canvas behielte nur das erste Bild)
const SKIP_COMPRESS = new Set(['image/gif']);

/** Obergrenze je Datei — wie file_size_limit des Buckets (Migration 0180). */
const ASSET_MAX_BYTES = 25 * 1024 * 1024;

/** Storage meldet Grenzen und fehlende Rechte auf Englisch („The object
 *  exceeded the maximum allowed size", „new row violates row-level security
 *  policy"). Hier wird daraus ein Satz, mit dem Vereinsmitglieder etwas
 *  anfangen können. Unbekannte Fehler gehen unverändert durch. */
function uploadFehler(error: Error): Error {
  const m = (error.message ?? '').toLowerCase();
  if (m.includes('maximum allowed size') || m.includes('too large')) {
    return new Error('Die Datei ist zu groß — erlaubt sind höchstens 25 MB.');
  }
  if (m.includes('mime type') || m.includes('not supported')) {
    return new Error('Dieses Dateiformat wird nicht angenommen. Erlaubt sind Bilder (JPEG, PNG, WebP, GIF) und Videos (MP4, WebM).');
  }
  if (m.includes('row-level security') || m.includes('unauthorized')) {
    return new Error('Hochladen nicht erlaubt — dein Konto darf hier keine Dateien ablegen.');
  }
  return error;
}

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

/** Bilder, die auf der TV-Tafel landen, werden schonender behandelt.
 *
 *  Standard sind 1920 px lange Kante bei JPEG-Qualität 0,82 — für ein Logo
 *  oder einen Seitenhintergrund reichlich. Kachel- und Galeriebilder lassen
 *  sich aber im Ausschnitt-Wähler bis 300 % vergrößern, und ein 85-Zoll-Schirm
 *  zeigt jedes Kompressionsartefakt. Deshalb hier mehr Reserve statt
 *  nachträglichem Ärger: die Datei bleibt trotzdem im vertretbaren Rahmen.
 */
const FEINE_ORDNER = ['tile-bgs', 'slot-gallery', 'oelraum'];

export async function uploadAsset(file: File, folder = 'ads'): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`Ungültiger Dateityp: ${file.type || 'unbekannt'}. Erlaubt: JPEG, PNG, WebP, GIF.`);
  }
  const fein = FEINE_ORDNER.some((f) => folder === f || folder.startsWith(f + '/'));
  const compressed = await compressImage(
    file,
    fein ? { maxEdge: 2560, quality: 0.92, maxBytes: 1_500_000 } : {},
  );
  if (compressed.size > ASSET_MAX_BYTES) {
    throw new Error(
      `Bild ist ${(compressed.size / 1024 / 1024).toFixed(1)} MB groß — erlaubt sind 25 MB.`,
    );
  }
  const ext = compressed.name.split('.').pop() ?? 'bin';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await need().storage.from('assets').upload(path, compressed, {
    cacheControl: '3600',
    upsert: false,
    contentType: compressed.type,
  });
  if (error) throw uploadFehler(error);
  return path;
}

/** Video für eine Info-Karte. Bewusst getrennt von uploadAsset:
 *
 *  Videos dürfen NICHT durch compressImage laufen (das würde einen Canvas auf
 *  eine Videodatei loslassen), und sie brauchen ein hartes Größenlimit. Die
 *  Tafel läuft 24/7 auf einem TV-Stick — ein großes Video in Dauerschleife ist
 *  das Teuerste, was dort laufen kann. 20 MB reichen für die paar Sekunden,
 *  um die es hier geht, und halten den Speicher im Rahmen.
 */
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
const VIDEO_MAX_BYTES = 20 * 1024 * 1024;

export async function uploadVideo(file: File, folder = 'info-karten'): Promise<string> {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    throw new Error(`Ungültiges Videoformat: ${file.type || 'unbekannt'}. Erlaubt: MP4 und WebM.`);
  }
  if (file.size > VIDEO_MAX_BYTES) {
    throw new Error(
      `Video ist ${(file.size / 1024 / 1024).toFixed(1)} MB groß — erlaubt sind 20 MB. `
      + 'Kürze es oder exportiere es kleiner.',
    );
  }
  const ext = file.type === 'video/webm' ? 'webm' : 'mp4';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await need().storage.from('assets').upload(path, file, {
    cacheControl: '86400',
    upsert: false,
    contentType: file.type,
  });
  if (error) throw uploadFehler(error);
  return path;
}

export async function deleteAsset(path: string): Promise<void> {
  // Mitgelieferte Bilder (absoluter Pfad, siehe publicAssetUrl) liegen nicht
  // im Bucket — da gibt es nichts zu löschen, und ein Fehler wäre irreführend.
  if (path.startsWith('/')) return;
  // Storage meldet Fehler im Response-Objekt, nicht per throw. Ohne diese
  // Prüfung scheiterte ein Löschen lautlos und die Datei blieb als Karteileiche
  // im Bucket — sichtbar wurde davon nie etwas.
  const { error } = await need().storage.from('assets').remove([path]);
  if (error) throw error;
}

/** Hat der Server eine Anfrage sicher abgelehnt, also nichts gespeichert?
 *  Bei jedem echten Fehler antwortet die Datenbank mit einem Code („P0001",
 *  „42501", „PGRST…") und hat vorher alles zurückgerollt. Ohne Code war es ein
 *  Netzfehler: Die Anfrage kann trotzdem angekommen und gespeichert sein.
 *  Nur im ersten Fall darf eine eben hochgeladene Datei wieder gelöscht werden,
 *  sonst zeigt ein doch angelegter Beitrag ein fehlendes Bild. Liegen
 *  gebliebene Dateien setzt der Datenschutz-Job (0186) später auf die
 *  Löschliste. */
export function serverHatAbgelehnt(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code.length > 0;
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

/** Fehlercodes der Stamm-Slot- und Urlaubs-RPCs (Migration 0184) in
 *  verständliche Meldungen übersetzen. Unbekanntes geht unverändert durch. */
function stammFehler(error: { message?: string }): Error {
  const msg = error.message ?? '';
  if (msg.includes('wrong_sauna_for_slot')) return new Error('Zu dieser Uhrzeit läuft der Garantie-Aufguss in der anderen Sauna — Stamm-Aufgüsse werden nur dort eingetragen.');
  if (msg.includes('no_garantie_slot')) return new Error('Zu dieser Uhrzeit gibt es keinen Garantie-Aufguss — hier ist kein Stamm-Slot möglich.');
  if (msg.includes('slot_taken')) return new Error('Diesen Stamm-Slot hat schon ein anderer Aufgießer.');
  if (msg.includes('not_pending_or_unknown')) return new Error('Der Antrag ist nicht mehr offen — bitte Seite neu laden.');
  if (msg.includes('not_authenticated') || msg.includes('member_not_found')) return new Error('Nicht angemeldet — bitte neu anmelden.');
  if (msg.includes('not_authorized')) return new Error('Das darfst nur du selbst oder ein Admin.');
  if (msg.includes('not_admin')) return new Error('Nur für Admins.');
  if (msg.includes('slot_not_found')) return new Error('Stamm-Slot nicht gefunden — bitte Seite neu laden.');
  if (msg.includes('absence_not_found')) return new Error('Urlaubseintrag nicht gefunden — bitte Seite neu laden.');
  return error as Error;
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
        throw stammFehler(error);
      }
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-slots'] }),
  });
}

// ─── Banja-Ritual buchen (Migration 0105) ─────────────────────────────────
// Atomare Buchung: Löscht Personal-Fallbacks im Ritual und in der Ruhestunde
// danach und legt das Banja an (90 Min um 19 Uhr, sonst 120; Ende spätestens
// 20:30, außer am Saunafest — Regeln in lib/banja.ts, Migration 0183).
export function useBookBanjaRitual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      sauna_id: string;
      date: Date;          // wird zu YYYY-MM-DD (lokal) konvertiert
      /** Startstunde. Seit 08.08.2026 frei — vorher fest 19. Die Dauer
       *  ergibt sich daraus: 90 Minuten um 19 Uhr, sonst 120. */
      start_hour: number;
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
        p_start_hour: p.start_hour,
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
      /** Gewählte Dauer (Migration 0184) — vorher blieb es bei den 15 Minuten
       *  des Personal-Platzhalters. */
      duration_minutes?: number;
      /** Nur Admin: Aufguss gleich einem anderen Aufgießer zuweisen (0184). */
      saunameister_id?: string | null;
    }) => {
      const { error } = await need().rpc('takeover_personal_fallback', {
        p_infusion_id: p.infusion_id,
        p_title: p.title,
        p_description: p.description ?? null,
        p_attributes: p.attributes ?? [],
        p_oils: p.oils ?? null,
        p_team_infusion: p.team_infusion ?? false,
        p_duration_minutes: p.duration_minutes ?? null,
        p_saunameister_id: p.saunameister_id ?? null,
      });
      if (error) {
        const msg = (error as { message?: string }).message ?? '';
        // Zuerst die Admin-Zuweisung: „target_not_aufgieser" enthält auch „not_aufgieser".
        if (msg.includes('target_not_aufgieser')) throw new Error('Das gewählte Mitglied ist kein aktiver Aufgießer.');
        if (msg.includes('not_admin_for_meister_change')) throw new Error('Nur Admins können den Aufguss einem anderen Aufgießer zuweisen.');
        if (msg.includes('not_aufgieser') || msg.includes('not_authorized')) throw new Error('Nur Aufgießer können Personal-Aufgüsse übernehmen.');
        if (msg.includes('member_not_found')) throw new Error('Nicht angemeldet — bitte neu anmelden.');
        if (msg.includes('not_a_fallback')) throw new Error('Dieser Aufguss ist kein Personal-Aufguss mehr — bitte Anzeige aktualisieren.');
        if (msg.includes('slot_in_past')) throw new Error('Slot liegt in der Vergangenheit.');
        if (msg.includes('title_required')) throw new Error('Titel fehlt.');
        if (msg.includes('invalid_duration')) throw new Error('Ungültige Dauer.');
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
      if (error) throw stammFehler(error);
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
      if (error) throw stammFehler(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-slots'] }),
  });
}

export function useRevokeMyRecurringSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await need().rpc('revoke_my_recurring_slot', { p_id: id });
      if (error) throw stammFehler(error);
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
        throw stammFehler(error);
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
      if (error) throw stammFehler(error);
    },
    // Seit 0184 gibt das Löschen die Stamm-Aufgüsse im Zeitraum zurück —
    // deshalb auch den Plan neu laden.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['absences'] });
      qc.invalidateQueries({ queryKey: ['infusions'] });
    },
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
      // Seit 0184 nur für Admins, p_weeks wird serverseitig auf 1–12 gedeckelt.
      const { data, error } = await need().rpc('materialize_infusion_horizon', { p_weeks: weeks });
      if (error) throw stammFehler(error);
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
  /** Nur tagesgenau (0186). */
  rated_at: string;
  /** Seit 0186 immer null — Bewertungskommentare sind anonym. */
  author_name: string | null;
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
      if (error) {
        // Eintrag abgelehnt → hochgeladenes Bild nicht als Karteileiche liegen
        // lassen (eigene Dateien darf man seit Migration 0180 selbst löschen).
        // Bei einem Netzfehler bleibt es, der Eintrag kann ja angekommen sein.
        if (serverHatAbgelehnt(error)) {
          try { await deleteAsset(path); } catch { /* ignore */ }
        }
        if (error.message?.includes('photo_limit_reached')) {
          throw new Error('Die Galerie ist voll — höchstens 8 Fotos. Lösche erst ein altes Foto.');
        }
        throw error;
      }
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

export type FeedPostKind =
  | 'photo'
  | 'game_achievement'
  | 'game_win'
  | 'vereins_highscore'
  | 'wochenrueckblick';

// Inhalt von feed_posts.meta bei post_kind = 'wochenrueckblick' (Migr. 0140).
// Öle und Besonderheiten stehen als IDs drin — die Namen kommen aus
// OIL_BY_ID / ATTR_BY_ID, damit es dafür nur eine Wahrheit gibt.
export type WochenrueckblickMeta = {
  von: string;   // YYYY-MM-DD, Montag
  bis: string;   // YYYY-MM-DD, Sonntag
  aufguesse: number;
  team: number;
  saunen: number;
  aufgiesser: { name: string; anzahl: number }[];
  oele: { id: string; anzahl: number }[];
  attribute: { id: string; anzahl: number }[];
  /** Wochenbeste je Spiel (Migration 0144) — die Wochen-Krönung. Ältere
   *  Rückblicke haben das Feld nicht, die Karte lässt die Sektion dann weg. */
  spiele?: { kind: string; label: string; emoji: string; name: string; score: number }[];
};

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
// Der Fan-Upgrade-Zweig (Migration 0061) ist mit 0132 entfallen: die Rolle
// 'fan' wird nicht mehr vergeben, es gab in Produktion nie einen einzigen
// Antrag und nie einen Fan. Die DB-Funktionen bleiben vorerst bestehen,
// haben aber keinen Aufrufer mehr.
// ─────────────────────────────────────────────────────────────────────────────

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
  target_min_role: 'gast' | 'member';
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
      const { data, error } = await need().rpc('delete_my_account');
      if (error) throw error;
      // Eigene Dateien (Profilbild, Fotos) gleich mit entfernen — das Token
      // gilt noch bis zu seinem Ablauf. Was nicht klappt (z. B. ein vom
      // Vorstand hochgeladenes Profilbild), bleibt auf der Löschliste und
      // wird vom Vorstand entfernt (Migration 0186).
      const pfade = Array.isArray(data) ? (data as string[]) : [];
      if (pfade.length > 0) {
        try {
          await dateienEntfernen(pfade);
        } catch (e) {
          console.warn('[datenschutz] Dateien bleiben auf der Löschliste', e);
        }
      }
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

// ─────────────────────────────────────────────────────────────────────────────
// DUFT-WÜNSCHE + NACHRICHTEN-OPT-OUT (Migration 0133)
// Der Wunsch hängt an einem konkreten kommenden Aufguss, nicht an einer Person
// — dadurch landet er dort, wo er brauchbar ist: im Öl-Raum.
// ─────────────────────────────────────────────────────────────────────────────

export type AufgussWunsch = {
  id: string;
  infusion_id: string;
  oil_key: string;
  notiz: string | null;
  status: 'offen' | 'erfuellt' | 'abgelehnt';
  created_at: string;
  infusion_start: string;
  infusion_title: string | null;
  sauna_name: string | null;
};

export type MeinWunsch = AufgussWunsch & { aufgieser_name: string | null };
export type WunschAnMich = AufgussWunsch & { gast_id: string; gast_name: string };
export type OelraumWunsch = { infusion_id: string; oil_key: string; notiz: string | null };

/** Nachrichten von Gästen an/aus — Self-Write nur über SECDEF-RPC. */
export function useSetMyDmVonGaesten() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (wert: boolean) => {
      const { error } = await need().rpc('set_my_dm_von_gaesten', { p_wert: wert });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member'] });
      qc.invalidateQueries({ queryKey: ['members'] });
    },
  });
}

export function useCreateWunsch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { infusionId: string; oilKey: string; notiz?: string }) => {
      const { data, error } = await need().rpc('create_wunsch', {
        p_infusion_id: p.infusionId,
        p_oil_key: p.oilKey,
        p_notiz: p.notiz ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meine-wuensche'] });
      qc.invalidateQueries({ queryKey: ['oelraum-wuensche'] });
    },
  });
}

export function useResolveWunsch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { wunschId: string; status: 'erfuellt' | 'abgelehnt' }) => {
      const { error } = await need().rpc('resolve_wunsch', {
        p_wunsch_id: p.wunschId,
        p_status: p.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wuensche-an-mich'] });
      qc.invalidateQueries({ queryKey: ['meine-wuensche'] });
      qc.invalidateQueries({ queryKey: ['oelraum-wuensche'] });
    },
  });
}

export function useMyWuensche() {
  return useQuery({
    queryKey: ['meine-wuensche'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_my_wuensche');
      if (error) throw error;
      return (data ?? []) as MeinWunsch[];
    },
    staleTime: 30_000,
  });
}

export function useWuenscheAnMich(enabled = true) {
  return useQuery({
    queryKey: ['wuensche-an-mich'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_wuensche_fuer_meine_aufguesse');
      if (error) throw error;
      return (data ?? []) as WunschAnMich[];
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** Öl-Raum-Tablet: anonym abrufbar, bewusst OHNE Namen. */
export function useOelraumWuensche(stunden = 6) {
  return useQuery({
    queryKey: ['oelraum-wuensche', stunden],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_oelraum_wuensche', { p_stunden: stunden });
      if (error) throw error;
      return (data ?? []) as OelraumWunsch[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
}
// ─── Admin: Gäste-Übersicht (0147) ──────────────────────────────────────────

/** Eine Zeile der Gäste-Beobachtungsliste. `status` wird in SQL vergeben,
 *  damit die Einstufung überall dieselbe ist — Schwellwerte stehen im
 *  COMMENT der Funktion. */
export type GastRow = {
  id: string;
  name: string;
  sauna_name: string | null;
  member_number: number | null;
  email: string | null;
  gast_seit: string;
  herkunft: string;
  besuchstage: number;
  letzter_besuch: string | null;
  bewertungen: number;
  app_geoeffnet: boolean;
  zuletzt_gesehen: string | null;
  hat_pin: boolean;
  revoked_at: string | null;
  status: 'neu' | 'stammgast' | 'beobachten' | 'nie_da' | 'karteileiche' | 'mitglied_geworden';
};

/** Zwei Details, die nicht zufällig sind:
 *
 *  - Der Query-Key beginnt mit 'members', damit die bestehenden Mutationen
 *    (Rolle ändern, löschen, PIN neu) den Reiter per Prefix-Match mit
 *    auffrischen. So muss kein einziger vorhandener Hook angefasst werden.
 *  - refetchInterval, weil der neue Gast an einem ANDEREN Gerät steht: er
 *    meldet sich am Eingangs-Tablet an, während der Admin auf diese Liste
 *    schaut. Ohne Polling erschiene er erst nach einem Reload. */
export function useGaesteUebersicht() {
  return useQuery({
    queryKey: ['members', 'gaeste-uebersicht'],
    queryFn: async () => {
      const { data, error } = await need().rpc('list_gaeste_uebersicht');
      if (error) throw error;
      return (data ?? []) as GastRow[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ─── Admin: Zugangsdaten erneut schicken / PIN neu vergeben (0133 / 0135) ───

export function useResendGastAccess() {
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { data: sess } = await need().auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('nicht angemeldet');
      const r = await fetch('/api/qr-signin?action=resend-access', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ member_id: memberId }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? 'Versand fehlgeschlagen');
      return body as { ok: true; email: string };
    },
  });
}

/** Neuer System-PIN. Es gibt bewusst KEINEN frei waehlbaren PIN. */
export function useAdminRotateCheckinPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { data, error } = await need().rpc('admin_rotate_checkin_pin', { p_member_id: memberId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: ['member'] });
    },
  });
}
// ─── Banja-Umgehungsversuch melden (0149) ────────────────────────────────
/** Protokolliert einen von der Datenbank abgewiesenen Banja-Versuch.
 *
 *  Bewusst „fire and forget": der Nutzer sieht bereits das rote Fenster, und
 *  ein Fehler beim Protokollieren darf daran nichts ändern. Der Aufruf muss
 *  NACH dem gescheiterten Speichern kommen — der Trigger rollt die
 *  Transaktion zurück, ein Eintrag aus ihm heraus wäre nie zu sehen. */
export function meldeBanjaVersuch(grund: string, titel?: string | null): void {
  const c = supabase;
  if (!c) return;
  void c.rpc('melde_banja_versuch', { p_grund: grund, p_titel: titel ?? null })
    .then(() => undefined, () => undefined);
}
