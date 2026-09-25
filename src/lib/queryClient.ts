import { QueryClient } from '@tanstack/react-query';

/** Fehler, die ein erneuter Versuch nicht behebt: fehlende Rechte (42501),
 *  bewusst vom Server abgelehnt (P0001), ungültiges Token (PGRST301/302),
 *  sonstige 4xx außer Timeout/Drosselung. */
function istDauerFehler(err: unknown): boolean {
  const e = err as { status?: number; code?: string } | null;
  if (e?.status && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) return true;
  return e?.code === '42501' || e?.code === 'P0001' || e?.code === 'PGRST301' || e?.code === 'PGRST302';
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
      retry: (failureCount, err: unknown) => {
        const status = (err as { status?: number })?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 3;
      },
    },
  },
});
