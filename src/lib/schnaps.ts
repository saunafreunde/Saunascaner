// Schnaps-Aufgüsse — Obstbrände die beim Aufguss auf die Steine kommen.
//
// SPEICHERUNG: Der Schnaps wird NICHT in einer eigenen Spalte abgelegt,
// sondern als `schnaps:<slug>` innerhalb von `infusions.attributes[]` —
// analog zur bereits bestehenden `custom:<uuid>`-Konvention bei den Ölen
// (customOilId()/parseCustomOilId() in lib/api.ts).
//
// Grund: der Schreibpfad läuft über fünf SECURITY-DEFINER-RPCs
// (create_infusion, create_infusion_kiosk, update_infusion,
// book_banja_ritual, takeover_personal_fallback). Ein zusätzlicher
// Parameter würde bei CREATE OR REPLACE eine ZWEITE Überladung anlegen
// statt die alte zu ersetzen → PostgREST antwortet dann mit
// "Could not choose the best candidate function". Über attributes[]
// funktionieren Kiosk, Banja, Personal-Übernahme und Vorlagen ohne SQL.
//
// WICHTIG: Die `id` (Slug) ist die in der DB gespeicherte Identität.
// Labels und Farben dürfen sich ändern, Slugs NICHT — sonst verlieren
// bestehende Aufgüsse ihre Schnaps-Referenz.

export interface Schnaps {
  id: string;      // Slug, landet als `schnaps:<id>` in der DB
  name: string;
  emoji: string;
  color: string;   // Akzentfarbe für Pille + Karten-Schleier auf der Tafel
  image: string;   // Karten-Hintergrund, liegt in public/ (siehe Desktop\sauna_gen.py)
}

export const SCHNAPS: Schnaps[] = [
  { id: 'kirschwasser', name: 'Kirschwasser', emoji: '🍒',  color: '#b32d2e', image: '/schnaps/kirschwasser.webp' },
  { id: 'haferpflaume', name: 'Haferpflaume', emoji: '🫐',  color: '#6c3483', image: '/schnaps/haferpflaume.webp' },
  { id: 'marille',      name: 'Marille',      emoji: '🍑',  color: '#e07b26', image: '/schnaps/marille.webp' },
  { id: 'slibowitz',    name: 'Slibowitz',    emoji: '🥃',  color: '#4e2a84', image: '/schnaps/slibowitz.webp' },
  { id: 'zwetschke',    name: 'Zwetschke',    emoji: '🟣',  color: '#5b2c6f', image: '/schnaps/zwetschke.webp' },
  { id: 'schoko_chili', name: 'Schoko-Chili', emoji: '🌶️', color: '#7b241c', image: '/schnaps/schoko-chili.webp' },
  // Ergaenzt am 08.08.2026. Beide standen als selbstgebaute Buttons in der
  // Datenbank („Mirabelle" am 01.08., „Sud mit Willi" am 08.08.) — als Custom-
  // Attribut bekamen sie aber weder Bild noch Badge auf der Tafel.
  { id: 'williamsbirne', name: 'Williamsbirne', emoji: '🍐', color: '#8c9a3f', image: '/schnaps/williamsbirne.webp' },
  { id: 'mirabelle',     name: 'Mirabelle',     emoji: '🟡', color: '#d4a017', image: '/schnaps/mirabelle.webp' },
];

export const SCHNAPS_BY_ID: Record<string, Schnaps> =
  Object.fromEntries(SCHNAPS.map((s) => [s.id, s]));

export const SCHNAPS_PREFIX = 'schnaps:';

/** Slug → Attribut-Eintrag wie er in der DB landet. */
export function schnapsAttrId(id: string): string {
  return `${SCHNAPS_PREFIX}${id}`;
}

/** Attribut-Eintrag → Slug, oder null wenn es kein Schnaps-Eintrag ist. */
export function parseSchnapsAttr(attr: string): string | null {
  return attr.startsWith(SCHNAPS_PREFIX) ? attr.slice(SCHNAPS_PREFIX.length) : null;
}

// Alt-Daten: bevor es diese Datei gab, gab es Kirschwasser und Haferpflaume
// nur als normale Eigenschafts-Chips. Bestehende Aufgüsse werden darüber
// weiter erkannt und bekommen Bild + Pille ohne Datenmigration.
const LEGACY_ATTR_TO_SCHNAPS: Record<string, string> = {
  kirschwasser: 'kirschwasser',
  haferpflaume: 'haferpflaume',
};

/** Findet den Schnaps eines Aufgusses — inkl. Alt-Daten-Erkennung.
 *  Pro Aufguss ist genau eine Sorte vorgesehen; bei mehreren gewinnt die erste. */
export function schnapsFromAttributes(attrs: readonly string[] | null | undefined): Schnaps | null {
  if (!attrs?.length) return null;
  for (const a of attrs) {
    const slug = parseSchnapsAttr(a);
    if (slug && SCHNAPS_BY_ID[slug]) return SCHNAPS_BY_ID[slug];
  }
  for (const a of attrs) {
    const legacy = LEGACY_ATTR_TO_SCHNAPS[a];
    if (legacy && SCHNAPS_BY_ID[legacy]) return SCHNAPS_BY_ID[legacy];
  }
  return null;
}

/** Entfernt alles was als Schnaps gilt — die `schnaps:*`-Einträge UND die
 *  alten Chips (blankes 'kirschwasser'/'haferpflaume'). Wird immer paarweise
 *  mit schnapsFromAttributes() benutzt: was in den Schnaps-Reiter gehoben
 *  wurde, verlässt die Eigenschaften-Liste. Beim Speichern kommt genau ein
 *  kanonisches `schnaps:<slug>` zurück — so entstehen nie Doppel-Pillen, und
 *  Alt-Aufgüsse ziehen beim ersten Bearbeiten still auf das neue Format um. */
export function stripSchnapsAttrs(attrs: readonly string[]): string[] {
  return attrs.filter((a) => !a.startsWith(SCHNAPS_PREFIX) && !(a in LEGACY_ATTR_TO_SCHNAPS));
}
