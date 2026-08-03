// Namensschilder für den Aufgießer-Block auf der TV-Tafel.
//
// Name und Motto standen bisher ohne eigenen Untergrund direkt auf dem
// Karten-Foto. Ein heller Textschatten hat die Lesbarkeit verbessert, gereicht
// hat er nicht — auf einem Holz- oder Frucht-Motiv verschwindet feine Schrift
// trotzdem. Deshalb bekommt der Block jetzt ein echtes Schild, das der
// Aufgießer sich selbst aussucht (members.nameplate, Migration 0121).
//
// Jeder Stil bringt genau die drei Dinge mit, die der User genannt hat:
// FARBE, TRANSPARENZ (steckt in der rgba-Alpha) und FORM (radius).
// Bewusst KEINE Animation und kein backdrop-filter: die Tafel läuft 24/7,
// und `backdrop-filter` bricht ausserdem position:fixed in Kind-Elementen
// (siehe feedback_saunascaner_react_portal).

export type Nameplate = {
  id: string;
  label: string;
  emoji: string;
  gruppe: 'schlicht' | 'witzig' | 'saison';
  /** Untergrund inkl. Transparenz. */
  bg: string;
  /** Schriftfarbe für den Namen. */
  text: string;
  /** Schriftfarbe für das Motto (etwas zurückgenommen). */
  textMotto: string;
  /** Rahmen als inset-Schatten — kostet keine Layout-Breite. */
  ring: string;
  /** Form: von 999px (Pille) bis 4px (Schild). */
  radius: string;
};

export const NAMEPLATES: Nameplate[] = [
  // ── schlicht ───────────────────────────────────────────────────────────
  {
    id: 'klar',
    label: 'Klarglas',
    emoji: '🫧',
    gruppe: 'schlicht',
    bg: 'rgba(255,255,255,0.62)',
    text: '#0f172a',
    textMotto: '#475569',
    ring: 'inset 0 0 0 1px rgba(255,255,255,0.75)',
    radius: '999px',
  },
  {
    id: 'schiefer',
    label: 'Schiefertafel',
    emoji: '🪨',
    gruppe: 'schlicht',
    bg: 'rgba(30,41,59,0.62)',
    text: '#f8fafc',
    textMotto: '#cbd5e1',
    ring: 'inset 0 0 0 1px rgba(255,255,255,0.28)',
    radius: '10px',
  },

  // ── witzig ─────────────────────────────────────────────────────────────
  {
    id: 'schwitzkasten',
    label: 'Schwitzkasten',
    emoji: '🥵',
    gruppe: 'witzig',
    bg: 'rgba(220,38,38,0.72)',
    text: '#fff7ed',
    textMotto: '#fed7aa',
    ring: 'inset 0 0 0 1px rgba(255,237,213,0.55)',
    radius: '999px',
  },
  {
    id: 'handtuchheld',
    label: 'Handtuch-Held',
    emoji: '🦸',
    gruppe: 'witzig',
    bg: 'rgba(255,255,255,0.82)',
    text: '#1e3a8a',
    textMotto: '#3b82f6',
    ring: 'inset 0 0 0 2px rgba(59,130,246,0.5)',
    radius: '18px',
  },
  {
    id: 'dampfwalze',
    label: 'Dampfwalze',
    emoji: '🚂',
    gruppe: 'witzig',
    bg: 'rgba(71,85,105,0.7)',
    text: '#f1f5f9',
    textMotto: '#cbd5e1',
    ring: 'inset 0 0 0 2px rgba(148,163,184,0.6)',
    radius: '4px',
  },

  // ── Jahreszeit ─────────────────────────────────────────────────────────
  {
    id: 'fruehling',
    label: 'Frühlingswiese',
    emoji: '🌱',
    gruppe: 'saison',
    bg: 'rgba(134,239,172,0.68)',
    text: '#14532d',
    textMotto: '#166534',
    ring: 'inset 0 0 0 1px rgba(22,101,52,0.3)',
    radius: '999px',
  },
  {
    id: 'sommer',
    label: 'Hochsommer',
    emoji: '☀️',
    gruppe: 'saison',
    bg: 'rgba(253,224,71,0.7)',
    text: '#713f12',
    textMotto: '#854d0e',
    ring: 'inset 0 0 0 1px rgba(113,63,18,0.28)',
    radius: '999px',
  },
  {
    id: 'herbst',
    label: 'Herbstlaub',
    emoji: '🍂',
    gruppe: 'saison',
    bg: 'rgba(234,88,12,0.68)',
    text: '#fff7ed',
    textMotto: '#fed7aa',
    ring: 'inset 0 0 0 1px rgba(255,237,213,0.45)',
    radius: '14px',
  },
  {
    id: 'winter',
    label: 'Eiszapfen',
    emoji: '❄️',
    gruppe: 'saison',
    bg: 'rgba(186,230,253,0.72)',
    text: '#0c4a6e',
    textMotto: '#0369a1',
    ring: 'inset 0 0 0 1px rgba(255,255,255,0.85)',
    radius: '14px',
  },
  {
    id: 'advent',
    label: 'Adventsstube',
    emoji: '🕯️',
    gruppe: 'saison',
    bg: 'rgba(20,83,45,0.74)',
    text: '#fef9c3',
    textMotto: '#fde68a',
    ring: 'inset 0 0 0 2px rgba(234,179,8,0.6)',
    radius: '12px',
  },
];

/** Fällt bewusst auf „Klarglas" zurück: unbekannte oder leere Werte (Alt-Daten,
 *  später entfernte Stile) dürfen die Tafel nicht ohne Schild lassen. */
export const NAMEPLATE_DEFAULT = NAMEPLATES[0];

export const NAMEPLATE_BY_ID: Record<string, Nameplate> =
  Object.fromEntries(NAMEPLATES.map((n) => [n.id, n]));

export function nameplateFor(id: string | null | undefined): Nameplate {
  return (id && NAMEPLATE_BY_ID[id]) || NAMEPLATE_DEFAULT;
}

export const NAMEPLATE_GRUPPEN: { id: Nameplate['gruppe']; label: string }[] = [
  { id: 'schlicht', label: 'Schlicht' },
  { id: 'witzig', label: 'Mit Augenzwinkern' },
  { id: 'saison', label: 'Zur Jahreszeit' },
];
