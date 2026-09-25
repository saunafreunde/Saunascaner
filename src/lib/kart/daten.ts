// Sauna-Kart: Datenzugriff (Geister fürs Zeitfahren, Pokale im Grand Prix).
// Bewusst hier und nicht in api.ts — das Spiel bleibt ein eigener Chunk.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type GeistSamples = { v: 1; dt: number; pts: [number, number, number][] };

export type TopGeist = {
  member_id: string;
  name: string;
  zeit_ms: number;
  created_at: string;
  samples: GeistSamples | null;
};

export type PokalZeile = { klasse: number; gold: number; silber: number; bronze: number; beste_punkte: number | null; cups: number };
export type BestenZeile = { member_id: string; name: string; gold: number; silber: number; bronze: number; beste_punkte: number | null; cups: number };

function sb() {
  if (!supabase) throw new Error('Supabase nicht konfiguriert');
  return supabase;
}

export function useTopGeister(streckeId: string | null, mitSamples = true) {
  return useQuery({
    queryKey: ['kart-geister', streckeId, mitSamples],
    enabled: !!streckeId,
    queryFn: async () => {
      const { data, error } = await sb().rpc('kart_top_ghosts', { p_strecke: streckeId, p_limit: 8, p_mit_samples: mitSamples });
      if (error) throw error;
      return (data ?? []) as TopGeist[];
    },
    staleTime: 30_000,
  });
}

export function useGeistSpeichern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: { strecke: string; zeit_ms: number; samples: GeistSamples }) => {
      const { data, error } = await sb().rpc('kart_submit_ghost', { p_strecke: i.strecke, p_zeit_ms: i.zeit_ms, p_samples: i.samples });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: (_d, i) => { void qc.invalidateQueries({ queryKey: ['kart-geister', i.strecke] }); },
  });
}

export function useMeinePokale() {
  return useQuery({
    queryKey: ['kart-pokale'],
    queryFn: async () => {
      const { data, error } = await sb().rpc('kart_meine_pokale');
      if (error) throw error;
      return (data ?? []) as PokalZeile[];
    },
    staleTime: 60_000,
  });
}

export function useGpBestenliste(klasse: number) {
  return useQuery({
    queryKey: ['kart-gp-bestenliste', klasse],
    queryFn: async () => {
      const { data, error } = await sb().rpc('kart_gp_bestenliste', { p_klasse: klasse });
      if (error) throw error;
      return (data ?? []) as BestenZeile[];
    },
    staleTime: 30_000,
  });
}

export function useGpMelden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: { klasse: number; platz: number; punkte: number }) => {
      const { data, error } = await sb().rpc('kart_gp_melden', { p_klasse: i.klasse, p_platz: i.platz, p_punkte: i.punkte });
      if (error) throw error;
      return data as { ok: boolean; erster_gold: boolean };
    },
    onSuccess: (_d, i) => {
      void qc.invalidateQueries({ queryKey: ['kart-pokale'] });
      void qc.invalidateQueries({ queryKey: ['kart-gp-bestenliste', i.klasse] });
    },
  });
}

// ─── Einstellungen (nur dieses Gerät) ────────────────────────────────────────

export interface KartEinstellungen {
  lenkArt: 'wischen' | 'neigen' | 'tippen';
  lenkhilfe: boolean;
  autoDrift: boolean;
  ton: boolean;
  musik: boolean;
  skin: number;
  anleitungGesehen: boolean;
}

const SCHLUESSEL = 'sauna-kart-einstellungen-v1';
export const STANDARD_EINSTELLUNGEN: KartEinstellungen = {
  lenkArt: 'wischen', lenkhilfe: true, autoDrift: false, ton: true, musik: true, skin: 2, anleitungGesehen: false,
};

export function ladeEinstellungen(): KartEinstellungen {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    if (!roh) return { ...STANDARD_EINSTELLUNGEN };
    return { ...STANDARD_EINSTELLUNGEN, ...(JSON.parse(roh) as Partial<KartEinstellungen>) };
  } catch {
    return { ...STANDARD_EINSTELLUNGEN };
  }
}

export function speichereEinstellungen(e: KartEinstellungen) {
  try { localStorage.setItem(SCHLUESSEL, JSON.stringify(e)); } catch { /* privater Modus: egal */ }
}
