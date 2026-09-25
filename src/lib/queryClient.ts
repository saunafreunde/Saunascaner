import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ─── Fehler einordnen ───────────────────────────────────────────────────
// PostgREST-Fehler (postgrest-js) sind nackte Objekte { code, details, hint,
// message } — OHNE HTTP-Status. Bis 25.09.2026 prüfte `retry` nur `status`:
// jeder Supabase-Fehler lief dreimal nach (4 Anfragen je Abruf), auch
// „keine Rechte" (42501) oder eine ungültige ID (22P02), und nur vier Codes
// galten als dauerhaft (Audit-Runde 2). Jetzt entscheidet der Code.
// Einen `status` hängen nur eigene Würfe an (z. B. WeatherWidget).

function fehlerCode(err: unknown): string {
  const c = (err as { code?: unknown } | null)?.code;
  return typeof c === 'string' ? c : '';
}

/** Schema-Lücken: Funktion/Spalte/Tabelle fehlt (noch). Heilen von selbst,
 *  sobald die Migration eingespielt bzw. der Schema-Cache neu geladen ist. */
const SCHEMA_LUECKE = /^(PGRST2\d\d|42703|42883|42P01)$/;

/**
 * Deterministisch: dieselbe Anfrage scheitert eine Sekunde später genauso —
 * sofortige Wiederholungen sind sinnlos.
 * - 22xxx Datenfehler (22P02 ungültige UUID, 22007/22008 Datum, 22023 …)
 * - 23xxx Integrität, 42xxx Rechte/unbekanntes Objekt (42501, 42883 …)
 * - P0xxx plpgsql-RAISE (P0001 bewusst abgelehnt, P0002 …)
 * - PGRST1xx Anfragefehler (PGRST116 …), PGRST2xx Schema-Cache (PGRST202 …)
 * - PGRST301/302 ungültiges bzw. fehlendes Token
 * - eigene Würfe mit HTTP-4xx außer Timeout (408) und Drosselung (429)
 * Wiederholbar bleiben: Netzfehler (kein Code), PGRST000–003 (keine
 * DB-Verbindung), PGRST303 (Token abgelaufen — der Auto-Refresh heilt das),
 * 08xxx, 40001/40P01, 53xxx, 57014 usw.
 */
function keinSofortRetry(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429) return true;
  const c = fehlerCode(err);
  return /^(22|23|42|P0)/.test(c) || /^PGRST[12]\d\d$/.test(c) || c === 'PGRST301' || c === 'PGRST302';
}

/**
 * Dauerhaft: auch der 30-s-Takt im Fehlerzustand bleibt aus. Ausnahme sind
 * Schema-Lücken — kommt ein Frontend vor seiner Migration an, soll gerade die
 * 24/7-Tafel danach von selbst weiterlaufen (ein Abruf je 30 s, kein Nachhaken).
 */
export function istDauerFehler(err: unknown): boolean {
  return keinSofortRetry(err) && !SCHEMA_LUECKE.test(fehlerCode(err));
}

/** Fehlende Rechte bzw. Token-Probleme — können nach einer (Neu-)Anmeldung verschwinden. */
function istRechteFehler(err: unknown): boolean {
  const c = fehlerCode(err);
  return c === '42501' || c === 'PGRST301' || c === 'PGRST302' || c === 'PGRST303';
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      // Selbstheilung nach Netz-/Supabase-Ausfall (Audit 25.09.2026): Eine
      // Abfrage ohne eigenen Takt wurde nach einem Fehler nie wieder versucht —
      // fiel beim (Neu-)Laden der 24/7-Tafel kurz das Internet aus, stand dort
      // stundenlang „Heute keine Saunen aktiv.". Jetzt: im Fehlerzustand alle
      // 30 s neu versuchen, bis es klappt (nur im sichtbaren Tab). Abfragen mit
      // eigenem refetchInterval ersetzen diese Regel.
      refetchInterval: (query) =>
        query.state.status === 'error' && !istDauerFehler(query.state.error) ? 30_000 : false,
      retry: (failureCount, err: unknown) => !keinSofortRetry(err) && failureCount < 3,
    },
  },
});

// Kurz nach dem Start oder während eines Token-Wechsels kann eine Sitzung ein
// paar Sekunden als anon laufen — Abfragen scheitern dann mit 42501 und werden
// (siehe oben) nicht wiederholt. Nach der (Neu-)Anmeldung deshalb genau diese
// Abfragen einmal neu laden; alle übrigen Caches bleiben unberührt.
// setTimeout 0: innerhalb des Auth-Callbacks keine Supabase-Aufrufe starten
// (supabase-js hält dort seine Sperre — Hinweis aus der supabase-js-Doku).
supabase?.auth.onAuthStateChange((evt) => {
  if (evt !== 'SIGNED_IN' && evt !== 'TOKEN_REFRESHED') return;
  setTimeout(() => {
    void queryClient.refetchQueries({
      type: 'active',
      predicate: (q) => q.state.status === 'error' && istRechteFehler(q.state.error),
    });
  }, 0);
});
