/** Welcher Teil eines Bildes in der Kachel zu sehen ist.
 *
 *  Steht in einer EIGENEN Datei und nicht in branding.ts, obwohl es dort
 *  gebraucht wird: infokarten.ts braucht denselben Typ, und branding.ts
 *  wiederum die Info-Karten. Als beides in branding.ts lag, entstand daraus
 *  ein Import-Zyklus (branding → infokarten → branding), den der Bundler in
 *  ein `Cannot access 'le' before initialization` übersetzt hat — die ganze
 *  App blieb weiß. Diese Datei importiert nichts und beendet den Kreis.
 *
 *  Eine Tafel-Kachel ist je nach Aufteilung 2:1 bis 4:1 breit (gemessen auf
 *  1080p: 2 Saunen × 3 Aufgüsse = 920×301, 2×4 = 920×224, 3×3 = 603×301,
 *  3×4 = 603×224). Ein Foto im üblichen 3:2 oder 4:3 wird davon immer
 *  beschnitten — die Frage ist nur, WO. Genau das legen diese drei Zahlen
 *  fest, statt für jede Aufteilung ein eigenes Bild zu verlangen.
 *
 *  x/y sind Prozentwerte (0–100) und bezeichnen den Punkt des Bildes, der in
 *  der Kachel sichtbar bleiben MUSS — 50/50 ist die Bildmitte, also das
 *  bisherige Verhalten. zoom vergrößert darüber hinaus (1 = formatfüllend).
 *  Verlustfrei: skaliert wird bei der Anzeige, die Datei bleibt unangetastet.
 */
export type Ausschnitt = {
  x: number;
  y: number;
  zoom: number;
};

export const AUSSCHNITT_DEFAULT: Ausschnitt = { x: 50, y: 50, zoom: 1 };

/** Prüft einen Ausschnitt aus der Datenbank. Alles Unplausible fällt auf die
 *  Bildmitte zurück — ein kaputter Wert darf die Tafel nicht entstellen. */
export function ausschnittAus(v: unknown): Ausschnitt {
  const o = (v ?? {}) as Partial<Ausschnitt>;
  const zahl = (n: unknown, min: number, max: number, fallback: number) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  return {
    x: zahl(o.x, 0, 100, AUSSCHNITT_DEFAULT.x),
    y: zahl(o.y, 0, 100, AUSSCHNITT_DEFAULT.y),
    zoom: zahl(o.zoom, 1, 3, AUSSCHNITT_DEFAULT.zoom),
  };
}
