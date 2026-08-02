// Aufguss-Arten mit eigenem Karten-Look auf der TV-Tafel.
//
// Zwei Arten teilen sich denselben Auftritt (Bild-Hintergrund + farbige
// Auszeichnung auf der Karte), speichern aber unterschiedlich:
//
//   Schnaps    'schnaps:<slug>' in infusions.attributes[]  → siehe lib/schnaps.ts
//   Räuchern   das seit jeher vorhandene Attribut 'raeuchern'
//
// Für Räuchern wird bewusst KEIN neues Speicherformat eingeführt: das Attribut
// gibt es schon, es steckt in Alt-Aufgüssen und in den Vorlagen. Es wandert nur
// aus der Eigenschaften-Chipliste in den eigenen Reiter (analog Kirschwasser/
// Haferpflaume) und bekommt Bild + Badge.
//
// Diese Datei ist die EINE Stelle, an der die Karte fragt: „welchen Look hat
// dieser Aufguss?" — damit InfusionCard nicht zwei parallele Pfade braucht.

import { schnapsFromAttributes, stripSchnapsAttrs, type Schnaps } from './schnaps';

export interface AufgussTheme {
  id: string;
  name: string;    // "Kirschwasser", "Räucheraufguss"
  emoji: string;
  color: string;   // Akzent für Badge + Karten-Tönung
  image: string;   // Karten-Hintergrund, liegt in public/
  badge: string;   // fertige Beschriftung für die Karte
}

/** Das Attribut, das einen Räucheraufguss markiert — seit 0001 im Bestand. */
export const RAEUCHER_ATTR = 'raeuchern';

export const RAEUCHER_THEME: AufgussTheme = {
  id: RAEUCHER_ATTR,
  name: 'Räucheraufguss',
  emoji: '💨',
  // Rauch-Schiefer: bewusst kühl, damit sich Räuchern von den sechs
  // Frucht-Farben der Schnäpse auf den ersten Blick unterscheidet.
  color: '#5f6b78',
  image: '/raeuchern/raeucheraufguss.webp',
  // Kurz halten: das Badge sitzt in der Kopfzeile neben dem Titel und nimmt
  // ihm Breite weg. Das Motiv im Hintergrund sagt ohnehin schon "Aufguss".
  badge: '💨 Räuchern',
};

function schnapsTheme(s: Schnaps): AufgussTheme {
  return {
    id: s.id,
    name: s.name,
    emoji: s.emoji,
    color: s.color,
    image: s.image,
    badge: `🥃 ${s.name}`,
  };
}

/** Welchen Look hat dieser Aufguss? Schnaps schlägt Räuchern — wer beides
 *  ankreuzt, bekommt die Sorte gezeigt, weil die spezifischer ist. */
export function themeFromAttributes(attrs: readonly string[] | null | undefined): AufgussTheme | null {
  const s = schnapsFromAttributes(attrs);
  if (s) return schnapsTheme(s);
  if (attrs?.includes(RAEUCHER_ATTR)) return RAEUCHER_THEME;
  return null;
}

/** Ist ein Räucheraufguss angehakt? (unabhängig davon ob ein Schnaps gewinnt) */
export function hasRaeuchern(attrs: readonly string[] | null | undefined): boolean {
  return !!attrs?.includes(RAEUCHER_ATTR);
}

/** Entfernt, was schon als Badge auf der Karte steht — sonst erscheint dieselbe
 *  Information doppelt (einmal oben als Badge, einmal unten als Pille).
 *
 *  Entfernt wird nur die GEWINNENDE Art: wer Kirschwasser UND Räuchern
 *  angehakt hat, sieht oben das Kirschwasser-Badge und behält Räuchern unten
 *  als normale Besonderheiten-Pille — die Information geht nicht verloren. */
export function stripThemeAttrs(attrs: readonly string[]): string[] {
  const won = themeFromAttributes(attrs);
  if (!won) return [...attrs];
  if (won.id === RAEUCHER_ATTR) return attrs.filter((a) => a !== RAEUCHER_ATTR);
  return stripSchnapsAttrs(attrs);
}
