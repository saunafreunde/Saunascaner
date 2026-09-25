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

// ─── Fehler beim Eintragen (Geist, Pokal) ────────────────────────────────────
// Ein einziger Netzfehler am Ende eines Cups oder einer Zeitfahrt ließ das
// Ergebnis verloren gehen (Audit-Runde 2): kein Wiederholversuch, kein Knopf.
// Jetzt: vorübergehende Fehler automatisch bis zu dreimal nachholen (1 s,
// 2 s, 4 s), danach „Erneut senden". Beide RPCs vertragen Wiederholungen
// (0196: kart_gp_melden über die Cup-ID, kart_submit_ghost erkennt dieselbe Fahrt).

/** Fehler mit Postgres-Code und HTTP-Status (postgrest-js liefert den Status
 *  nur im Ergebnis, nicht im Fehlerobjekt). */
export class KartFehler extends Error {
  code: string;
  status: number;
  constructor(e: { message?: string; code?: string | null }, status: number) {
    super(e.message || 'Unbekannter Fehler');
    this.name = 'KartFehler';
    this.code = typeof e.code === 'string' ? e.code : '';
    this.status = status;
  }
}

/** Kann ein neuer Versuch klappen? Netz weg (Status 0), Gateway/Server (5xx),
 *  Drosselung (429), Timeout (408), abgelaufenes Token, DB kurz nicht da.
 *  NICHT: bewusste Ablehnungen des Servers (P0001: zu_schnell, invalid_…,
 *  samples_too_large) und sonstige Anfragefehler. */
export function istVoruebergehend(err: unknown): boolean {
  const e = err as { code?: unknown; status?: unknown } | null;
  const code = typeof e?.code === 'string' ? e.code : '';
  const status = typeof e?.status === 'number' ? e.status : 0;
  if (code) return /^(PGRST00\d|PGRST303|08|40001|40P01|53|57014|57P0)/.test(code);
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/** Konto gesperrt oder noch nicht freigegeben (0206: _games_schreiber_id wirft
 *  'konto_gesperrt: …' mit 42501). Endgültig — Wiederholen ist sinnlos.
 *  Bewusst NUR mit diesem Präfix (Audit-Runde 4, 25.09.2026): ein nacktes
 *  42501 („permission denied for function …", etwa kurz ohne Anmeldung beim
 *  Tokenwechsel) bleibt über „Erneut senden" wiederholbar. */
export function istGesperrt(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null;
  return e?.code === '42501' && typeof e.message === 'string' && e.message.startsWith('konto_gesperrt');
}

/** Bewusste Ablehnung durch den Server (RAISE in der RPC, gesperrtes Konto) —
 *  Wiederholen ist sinnlos. */
export function istAbgelehnt(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === 'P0001' || istGesperrt(err);
}

/** Gesperrt, während die Kart-Seite offen war: Mitgliederzeile neu laden, damit
 *  der App-Wächter sofort „Konto gesperrt" bzw. „wartet auf Freigabe" zeigt —
 *  sonst erst beim nächsten Fokuswechsel oder Neuladen. */
function beiSperreMitgliedNeuLaden(qc: ReturnType<typeof useQueryClient>, err: unknown) {
  if (istGesperrt(err)) void qc.invalidateQueries({ queryKey: ['current-member'] });
}

const WIEDERHOLUNG = {
  retry: (n: number, err: unknown) => n < 3 && istVoruebergehend(err),
  retryDelay: (n: number) => Math.min(1000 * 2 ** n, 8000),
};

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
      const { data, error, status } = await sb().rpc('kart_submit_ghost', { p_strecke: i.strecke, p_zeit_ms: i.zeit_ms, p_samples: i.samples });
      if (error) throw new KartFehler(error, status);
      return data as boolean;
    },
    ...WIEDERHOLUNG,
    onSuccess: (_d, i) => { void qc.invalidateQueries({ queryKey: ['kart-geister', i.strecke] }); },
    onError: (err) => beiSperreMitgliedNeuLaden(qc, err),
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
    /** cupId: je Cup einmal erzeugt — eine Wiederholung derselben Meldung
     *  trägt nicht doppelt ein und scheitert nicht an der 3-Minuten-Sperre. */
    mutationFn: async (i: { klasse: number; platz: number; punkte: number; cupId: string }) => {
      const { data, error, status } = await sb().rpc('kart_gp_melden', {
        p_klasse: i.klasse, p_platz: i.platz, p_punkte: i.punkte, p_cup_id: i.cupId,
      });
      if (error) throw new KartFehler(error, status);
      return data as { ok: boolean; erster_gold: boolean; wiederholt?: boolean };
    },
    ...WIEDERHOLUNG,
    onSuccess: (_d, i) => {
      void qc.invalidateQueries({ queryKey: ['kart-pokale'] });
      void qc.invalidateQueries({ queryKey: ['kart-gp-bestenliste', i.klasse] });
    },
    onError: (err) => beiSperreMitgliedNeuLaden(qc, err),
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
