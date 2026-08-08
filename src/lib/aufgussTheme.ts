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
import { hasSud } from './sud';

export interface AufgussTheme {
  id: string;
  name: string;    // "Kirschwasser", "Räucheraufguss"
  emoji: string;
  color: string;   // Akzent für Badge + Karten-Tönung
  image: string;   // Karten-Hintergrund, liegt in public/
  badge: string;   // fertige Beschriftung für die Karte
  /** Die ART, groß über der Sorte. Ohne die stand auf der Karte nur
   *  „🥃 Kirschwasser" — ein Gast, der die Sorte nicht kennt, hat daran nicht
   *  erkannt, dass hier überhaupt mit Schnaps gearbeitet wird. */
  kategorie: string;
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
  kategorie: 'Räucheraufguss',
};

/** Sudaufguss — Kräuter im Aufgusswasser. Dritter Look neben Schnaps und
 *  Räuchern. Steht in der Rangfolge HINTER beiden: wer Schnaps oder Räuchern
 *  angehakt hat, hat die auffälligere Ansage gemacht; der Sud erscheint dann
 *  weiter unten als Pille, die Information geht nicht verloren. */
export const SUD_THEME: AufgussTheme = {
  id: 'sud-aufguss',
  name: 'Sudaufguss',
  emoji: '🧪',
  // Kräutergrün, klar unterscheidbar vom Rauch-Schiefer und den Fruchtfarben.
  color: '#4d7c2f',
  image: '/sud/sudaufguss.webp',
  badge: '🧪 Sud',
  kategorie: 'Sudaufguss',
};

/** Banja — das lange Dampfritual. Eigener Look, weil es über zwei
 *  Aufgussstunden läuft und auf der Tafel entsprechend groß erscheint. */
export const BANJA_ATTR = 'banja';

export const BANJA_THEME: AufgussTheme = {
  id: BANJA_ATTR,
  name: 'Banja',
  emoji: '♨️',
  color: '#7a5c3e',
  image: '/banja/banja.webp',
  badge: '♨️ Banja',
  kategorie: 'Banja-Ritual',
};

function schnapsTheme(s: Schnaps): AufgussTheme {
  return {
    id: s.id,
    name: s.name,
    emoji: s.emoji,
    color: s.color,
    image: s.image,
    // Das Sorten-Emoji statt eines generischen Glases — die Frucht trägt die
    // Sorte, „Schnaps-Aufguss" steht groß darüber in `kategorie`.
    badge: `${s.emoji} ${s.name}`,
    kategorie: 'Schnaps-Aufguss',
  };
}

/** Welchen Look hat dieser Aufguss?
 *
 *  Rangfolge, von spezifisch nach allgemein:
 *    1. Banja    — das lange Ritual prägt den ganzen Abend, es gewinnt immer
 *    2. Schnaps  — eine benannte Sorte ist die konkreteste Ansage
 *    3. Räuchern
 *    4. Sud
 *  Was nicht gewinnt, verschwindet nicht: es erscheint weiter unten als Pille
 *  (siehe stripThemeAttrs — entfernt wird nur die gewinnende Art). */
export function themeFromAttributes(attrs: readonly string[] | null | undefined): AufgussTheme | null {
  if (attrs?.includes(BANJA_ATTR)) return BANJA_THEME;
  const s = schnapsFromAttributes(attrs);
  if (s) return schnapsTheme(s);
  if (attrs?.includes(RAEUCHER_ATTR)) return RAEUCHER_THEME;
  if (hasSud(attrs)) return SUD_THEME;
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
  // Banja behält seine Pille bewusst NICHT doppelt: das Badge steht schon oben.
  if (won.id === BANJA_ATTR) return attrs.filter((a) => a !== BANJA_ATTR);
  if (won.id === RAEUCHER_ATTR) return attrs.filter((a) => a !== RAEUCHER_ATTR);
  // Der Sud gewinnt nur, wenn sonst nichts da ist — seine Kräuter bleiben als
  // Pillen stehen, sie sind der eigentliche Inhalt und nicht bloß ein Etikett.
  if (won.id === SUD_THEME.id) return [...attrs];
  return stripSchnapsAttrs(attrs);
}
