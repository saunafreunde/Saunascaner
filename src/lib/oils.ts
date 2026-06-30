// Ätherische Öle aus dem Saunafreunde-Öl-Regal (PDF "Öl-Regal-Liste Final").
// Reihenfolge & Nummerierung folgen exakt dem PDF-Regal — so finden Aufgieser
// das Öl im Regal über die gleiche Nr. wie in der App.
//
// Kategorien (analog zu Farb-Sektionen im PDF):
//   gelb         → zitrus   (1–13)
//   braun        → holz     (14–25)
//   dunkelrot    → gewuerz  (26–35)
//   gruen        → kraut    (36–42)
//   gruen        → minze    (43–48)
//   lila/violett → sonstige (49–59)
//   rot/gold     → saison   (60–64)   Weihnachts-/Winter-Blends (Mischungen)
//
// WICHTIG: Die `id` (Slug) ist die in der DB gespeicherte Identität
// (infusions.oils text[]). Nummern dürfen sich beim Umsortieren ändern,
// Slugs NICHT — sonst verlieren bestehende Aufgüsse ihre Öl-Referenz.

export type OilCategory = 'zitrus' | 'holz' | 'gewuerz' | 'kraut' | 'minze' | 'sonstige' | 'saison';
export type OilNote = 'Kopf' | 'Herz' | 'Basis';

export interface Oil {
  id: string;        // Slug, wird in DB gespeichert (z.B. "zitrone")
  number: number;    // 1–64 (PDF-Regal-Nr.)
  name: string;
  emoji: string;
  category: OilCategory;
  note?: OilNote;
}

export const OILS: Oil[] = [
  // ── Zitrus (gelb) ───────────────────────────────────────────────────────
  { id: 'blutorange',         number: 1,  name: 'Blutorange',          emoji: '🍊', category: 'zitrus', note: 'Kopf' },
  { id: 'citronella-java',    number: 2,  name: 'Citronella Java',     emoji: '🍋', category: 'zitrus', note: 'Kopf' },
  { id: 'pink-grapefruit',    number: 3,  name: 'Pink Grapefruit',     emoji: '🍊', category: 'zitrus', note: 'Kopf' },
  { id: 'lemongras',          number: 4,  name: 'Lemongras',           emoji: '🌾', category: 'zitrus', note: 'Kopf' },
  { id: 'limette',            number: 5,  name: 'Limette',             emoji: '🟢', category: 'zitrus', note: 'Kopf' },
  { id: 'litsea-cubeba',      number: 6,  name: 'Litsea Cubeba',       emoji: '🌿', category: 'zitrus', note: 'Kopf' },
  { id: 'gruene-mandarine',   number: 7,  name: 'grüne Mandarine',     emoji: '🍊', category: 'zitrus', note: 'Herz' },
  { id: 'rote-mandarine',     number: 8,  name: 'rote Mandarine',      emoji: '🍊', category: 'zitrus', note: 'Herz' },
  { id: 'orange-bitter',      number: 9,  name: 'Orange bitter',       emoji: '🍊', category: 'zitrus', note: 'Kopf' },
  { id: 'orange-suess',       number: 10, name: 'Orange süss',         emoji: '🍊', category: 'zitrus', note: 'Kopf' },
  { id: 'petitgrain',         number: 11, name: 'Petitgrain',          emoji: '🍃', category: 'zitrus', note: 'Herz' },
  { id: 'tangerine',          number: 12, name: 'Tangerine',           emoji: '🍊', category: 'zitrus', note: 'Herz' },
  { id: 'zitrone',            number: 13, name: 'Zitrone',             emoji: '🍋', category: 'zitrus', note: 'Kopf' },

  // ── Hölzer (braun) ──────────────────────────────────────────────────────
  { id: 'amyris-sandelholz',  number: 14, name: 'Amyris Sandelholz',   emoji: '🪵', category: 'holz',   note: 'Basis' },
  { id: 'cedernholz',         number: 15, name: 'Cedernholz',          emoji: '🪵', category: 'holz',   note: 'Basis' },
  { id: 'cypresse',           number: 16, name: 'Zypresse',            emoji: '🌲', category: 'holz',   note: 'Herz' },
  { id: 'elemi',              number: 17, name: 'Elemi',               emoji: '🌳', category: 'holz',   note: 'Herz' },
  { id: 'fichtennadel',       number: 18, name: 'Fichtennadel',        emoji: '🌲', category: 'holz',   note: 'Kopf' },
  { id: 'hobaum',             number: 19, name: 'Hobaum',              emoji: '🌳', category: 'holz',   note: 'Herz' },
  { id: 'kiefernadel',        number: 20, name: 'Kiefernadel',         emoji: '🌲', category: 'holz',   note: 'Kopf' },
  { id: 'latschenkiefer',     number: 21, name: 'Latschenkiefer',      emoji: '🌲', category: 'holz',   note: 'Kopf' },
  { id: 'thuja',              number: 22, name: 'Thuja',               emoji: '🌲', category: 'holz',   note: 'Kopf' },
  { id: 'wacholderholz',      number: 23, name: 'Wacholderholz',       emoji: '🌿', category: 'holz',   note: 'Herz' },
  { id: 'weisstanne',         number: 24, name: 'Weisstanne',          emoji: '🌲', category: 'holz',   note: 'Kopf' },
  { id: 'zirbelkiefer',       number: 25, name: 'Zirbelkiefer',        emoji: '🌲', category: 'holz',   note: 'Herz' },

  // ── Gewürze / Wärmend (dunkelrot) ───────────────────────────────────────
  { id: 'cassia',             number: 26, name: 'Cassia',              emoji: '🍂', category: 'gewuerz', note: 'Herz' },
  { id: 'fenchel-bitter',     number: 27, name: 'Fenchel bitter',      emoji: '🌱', category: 'gewuerz', note: 'Herz' },
  { id: 'fenchel-suess',      number: 28, name: 'Fenchel süss',        emoji: '🌱', category: 'gewuerz', note: 'Herz' },
  { id: 'ingwer',             number: 29, name: 'Ingwer',              emoji: '🫚', category: 'gewuerz', note: 'Herz' },
  { id: 'kurkuma',            number: 30, name: 'Kurkuma',             emoji: '🟡', category: 'gewuerz', note: 'Herz' },
  { id: 'kuemmel',            number: 31, name: 'Kümmel',              emoji: '🌾', category: 'gewuerz', note: 'Herz' },
  { id: 'nelke',              number: 32, name: 'Nelke',               emoji: '🌸', category: 'gewuerz', note: 'Herz' },
  { id: 'pfeffer-schwarz',    number: 33, name: 'Pfeffer schwarz',     emoji: '⚫', category: 'gewuerz', note: 'Basis' },
  { id: 'sternanis',          number: 34, name: 'Sternanis',           emoji: '⭐', category: 'gewuerz', note: 'Herz' },
  { id: 'zimtblaetter',       number: 35, name: 'Zimtblätter',         emoji: '🍂', category: 'gewuerz', note: 'Herz' },

  // ── Kräuter (grün) ──────────────────────────────────────────────────────
  { id: 'basilikum',          number: 36, name: 'Basilikum',           emoji: '🌿', category: 'kraut',   note: 'Kopf' },
  { id: 'dillkraut',          number: 37, name: 'Dillkraut',           emoji: '🌿', category: 'kraut',   note: 'Kopf' },
  { id: 'oregano',            number: 38, name: 'Oregano',             emoji: '🌿', category: 'kraut',   note: 'Herz' },
  { id: 'rosmarin',           number: 39, name: 'Rosmarin',            emoji: '🌿', category: 'kraut',   note: 'Herz' },
  { id: 'salbei',             number: 40, name: 'Salbei',              emoji: '🌿', category: 'kraut',   note: 'Herz' },
  { id: 'thymian',            number: 41, name: 'Thymian',             emoji: '🌿', category: 'kraut',   note: 'Herz' },
  { id: 'wintergruen',        number: 42, name: 'Wintergrün',          emoji: '🍃', category: 'kraut',   note: 'Herz' },

  // ── Minzen / Eukalyptus (grün) ──────────────────────────────────────────
  { id: 'bergamotteminze',    number: 43, name: 'Bergamotteminze',     emoji: '🍃', category: 'minze',   note: 'Kopf' },
  { id: 'krauseminze',        number: 44, name: 'Krauseminze',         emoji: '🌿', category: 'minze',   note: 'Kopf' },
  { id: 'minze-indisch',      number: 45, name: 'Minze indisch',       emoji: '🍃', category: 'minze',   note: 'Kopf' },
  { id: 'pfefferminze',       number: 46, name: 'Pfefferminze',        emoji: '🌿', category: 'minze',   note: 'Kopf' },
  { id: 'eukalyptus',         number: 47, name: 'Eukalyptus',          emoji: '🌿', category: 'minze',   note: 'Kopf' },
  { id: 'eukalyptus-citriadora', number: 48, name: 'Eukalyptus citriadora', emoji: '🌿', category: 'minze', note: 'Kopf' },

  // ── Sonstige / Blüten / Harze (lila) ────────────────────────────────────
  { id: 'kampfer',            number: 49, name: 'Kampfer',             emoji: '💨', category: 'sonstige', note: 'Kopf' },
  { id: 'melisse',            number: 50, name: 'Melisse',             emoji: '🍃', category: 'sonstige', note: 'Herz' },
  { id: 'teebaum',            number: 51, name: 'Teebaum',             emoji: '🌳', category: 'sonstige', note: 'Kopf' },
  { id: 'zitronen-teebaum',   number: 52, name: 'Zitronen-Teebaum',    emoji: '🍋', category: 'sonstige', note: 'Kopf' },
  { id: 'gardenia-mix',       number: 53, name: 'Gardenia Mix',        emoji: '🌺', category: 'sonstige', note: 'Herz' },
  { id: 'geranium',           number: 54, name: 'Geranium',            emoji: '🌸', category: 'sonstige', note: 'Herz' },
  { id: 'heublume',           number: 55, name: 'Heublume',            emoji: '🌾', category: 'sonstige', note: 'Herz' },
  { id: 'lavendel',           number: 56, name: 'Lavendel',            emoji: '💜', category: 'sonstige', note: 'Herz' },
  { id: 'palmarosa',          number: 57, name: 'Palmarosa',           emoji: '🌿', category: 'sonstige', note: 'Herz' },
  { id: 'patchouli',          number: 58, name: 'Patchouli',           emoji: '🍂', category: 'sonstige', note: 'Basis' },
  { id: 'ringelblume',        number: 59, name: 'Ringelblume',         emoji: '🌼', category: 'sonstige', note: 'Herz' },

  // ── Saison / Weihnachten (rot/gold) — Duft-Mischungen, keine Einzelnote ──
  { id: 'advent',             number: 60, name: 'Advent',              emoji: '🕯️', category: 'saison' },
  { id: 'spekulatius',        number: 61, name: 'Spekulatius',         emoji: '🍪', category: 'saison' },
  { id: 'weihnachtstraum',    number: 62, name: 'Weihnachtstraum',     emoji: '🎄', category: 'saison' },
  { id: 'winterabend',        number: 63, name: 'Winterabend',         emoji: '🌙', category: 'saison' },
  { id: 'wintermaerchen',     number: 64, name: 'Wintermärchen',       emoji: '❄️', category: 'saison' },
];

export const OIL_BY_ID: Record<string, Oil> = Object.fromEntries(OILS.map((o) => [o.id, o]));
export const OIL_BY_NUMBER: Record<number, Oil> = Object.fromEntries(OILS.map((o) => [o.number, o]));

export const CATEGORY_LABELS: Record<OilCategory, string> = {
  zitrus: 'Zitrus',
  holz: 'Hölzer & Nadeln',
  gewuerz: 'Gewürze & Wärmend',
  kraut: 'Kräuter',
  minze: 'Minzen & Eukalyptus',
  sonstige: 'Blüten & Sonstige',
  saison: 'Saison & Weihnachten',
};

export const CATEGORY_ORDER: OilCategory[] = ['zitrus', 'holz', 'gewuerz', 'kraut', 'minze', 'sonstige', 'saison'];

export const OILS_BY_CATEGORY: Record<OilCategory, Oil[]> = CATEGORY_ORDER.reduce(
  (acc, cat) => {
    acc[cat] = OILS.filter((o) => o.category === cat);
    return acc;
  },
  {} as Record<OilCategory, Oil[]>,
);

/** Maximal mögliche Öl-Slots pro Aufguss. Zurück auf 3 gesetzt, weil 6 Slots
 *  Datenbank-Probleme verursacht haben (bestehende RPCs/Validierungen sind auf
 *  3-Tupel ausgelegt). */
export const MAX_OIL_SLOTS = 3;

/** Erzeugt aus einem (string | null)[] mit beliebiger Länge ein MAX_OIL_SLOTS-Tupel. */
export function normalizeOilSlots(input: readonly (string | null | undefined)[] | null | undefined): (string | null)[] {
  const arr = (input ?? []).slice(0, MAX_OIL_SLOTS);
  while (arr.length < MAX_OIL_SLOTS) arr.push(null);
  return arr.map((v) => (v ? String(v) : null));
}
