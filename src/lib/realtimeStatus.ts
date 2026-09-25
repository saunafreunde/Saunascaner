// Zustand des Realtime-Kernkanals (src/hooks/useRealtime.ts, Kanal „tafel")
// für die Poll-Takte der Abfragen.
//
// Hintergrund (Audit 25.09.2026): Die 3-/5-s-Polls der Tafel waren als
// Rückfall für „hängendes" Realtime gedacht — tatsächlich war der Kanal seit
// Mai tot, und die Tafel hat rund um die Uhr alles per Poll geholt. Jetzt gilt:
// Solange der Server das Abo NACHWEISLICH bestätigt hat („Subscribed to
// PostgreSQL"), reicht ein ruhiger Sicherheits-Poll; fällt der Kanal aus oder
// lehnt der Server ab, wird wieder im kurzen Takt gepollt.
//
// Bewusst ein einfacher Modul-Wert statt React-State: React Query wertet eine
// refetchInterval-Funktion nach jedem Abruf der Abfrage neu aus. Ein Wechsel
// des Zustands greift also mit dem nächsten Abruf — fällt der Kanal aus, läuft
// der alte ruhige Takt höchstens noch einmal ab (≤ 30 s). Kommt der Kanal
// wieder, lädt useRealtime seine Daten sofort nach (neuer Takt ab da).

/** Im Fehlerzustand spätestens so oft neu versuchen — auch wenn der normale
 *  Takt länger ist. Sonst hinge z. B. die Saunaliste der Tafel nach einem
 *  kurzen Ausfall der Datenbank-Schnittstelle bei laufendem Realtime-Kanal bis
 *  zu 10 min auf „Heute keine Saunen aktiv." (queryClient.ts hat dieselbe
 *  30-s-Regel, eigene Takte wie dieser ersetzen sie aber). */
const FEHLER_TAKT_MS = 30_000;

let kernAktiv = false;

export function setRealtimeKernAktiv(aktiv: boolean): void {
  kernAktiv = aktiv;
}

export function realtimeKernAktiv(): boolean {
  return kernAktiv;
}

/** refetchInterval-Funktion: `ohneRealtimeMs`, solange der Kernkanal nicht
 *  bestätigt ist, sonst `mitRealtimeMs` (Sicherheitsnetz). Schlug der letzte
 *  Abruf fehl: höchstens 30 s. */
export function pollTakt(
  ohneRealtimeMs: number,
  mitRealtimeMs: number,
): (query?: { state: { status: string } }) => number {
  return (query) => {
    const takt = kernAktiv ? mitRealtimeMs : ohneRealtimeMs;
    return query?.state.status === 'error' ? Math.min(takt, FEHLER_TAKT_MS) : takt;
  };
}
