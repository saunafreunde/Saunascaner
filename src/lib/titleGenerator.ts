// Regelbasierter Titel-Generator für Aufgüsse.
// Nimmt die ausgewählten Eigenschaften + Öle entgegen und baut einen
// hübschen, deutschsprachigen Titel daraus. Mehrfach-Aufruf mit
// unterschiedlichem `seed` liefert Varianten (für Re-Roll-Button).
//
// Bewusst KEIN AI/LLM-Call — instant, deterministisch, kostenlos,
// funktioniert offline. Reicht für Sauna-Aufguss-Titel allemal.

import { ATTR_BY_ID, type InfusionAttribute } from './attributes';
import { OIL_BY_ID, type OilCategory } from './oils';

// Adjektive pro Attribut. Der Generator pickt eines per Seed.
const ATTR_ADJECTIVE: Record<InfusionAttribute, string[]> = {
  flame:        ['Heißer', 'Glühender', 'Vulkanischer'],
  sud:          ['Intensiver', 'Konzentrierter', 'Kräftiger'],
  nature:       ['Wilder', 'Grüner', 'Natürlicher'],
  music:        ['Klingender', 'Melodischer', 'Rhythmischer'],
  loud_music:   ['Tobender', 'Wummernder', 'Lauter'],
  no_music:     ['Stiller', 'Meditativer', 'Ruhiger'],
  menthol:      ['Eiskalter', 'Frischer', 'Kühler'],
  raeuchern:    ['Geräucherter', 'Mystischer', 'Rauchiger'],
  kaffee:       ['Wacher', 'Aromatischer', 'Espresso-'],
  kirschwasser: ['Kirschiger', 'Festlicher', 'Süßer'],
  haferpflaume: ['Fruchtiger', 'Dunkler', 'Pflaumiger'],
  banja:        ['Russischer', 'Wilder', 'Banja-'],
  wenik:        ['Birken-', 'Wedel-', 'Klassischer'],
  vulkan:       ['Eruptiver', 'Vulkanischer', 'Glut-'],
};

// Stimmungs-Namen für 3-Öl-Mischungen (Kategorie-basiert).
const CATEGORY_VIBE: Record<OilCategory, { emoji: string; names: string[] }> = {
  zitrus:    { emoji: '🍋', names: ['Zitrus-Frische', 'Sommer-Sonne', 'Sonnen-Boost'] },
  holz:      { emoji: '🌲', names: ['Wald-Bad', 'Schwarzwald-Atem', 'Tannen-Tiefe'] },
  gewuerz:   { emoji: '🌶️', names: ['Würzige Wärme', 'Glut-Würze', 'Orient-Feuer'] },
  kraut:     { emoji: '🌿', names: ['Kräuter-Garten', 'Wiesen-Frische', 'Bauern-Kraut'] },
  minze:     { emoji: '❄️', names: ['Minz-Kühle', 'Eis-Atem', 'Frische-Kick'] },
  sonstige:  { emoji: '🌸', names: ['Blüten-Bouquet', 'Garten-Mix', 'Harmonie'] },
};

// Schablonen wenn NUR Attribute (keine Öle) gewählt sind.
const ATTR_ONLY_TEMPLATE: Record<InfusionAttribute, string[]> = {
  flame:        ['🔥 Feuer-Aufguss', '🔥 Hitze-Welle', '🔥 Glut-Bad'],
  sud:          ['💧 Sud-Klassiker', '💧 Klassischer Aufguss'],
  nature:       ['🌿 Natur-Aufguss', '🌿 Grüne Stunde'],
  music:        ['🎵 Musik-Session', '🎵 Beat-Aufguss'],
  loud_music:   ['🔊 Bass-Bad', '🔊 Party-Aufguss'],
  no_music:     ['🔇 Stille Andacht', '🔇 Meditation'],
  menthol:      ['❄️ Menthol-Eis', '❄️ Frost-Schock'],
  raeuchern:    ['💨 Räucher-Ritual', '💨 Rauch-Zeremonie'],
  kaffee:       ['☕ Kaffee-Aufguss', '☕ Espresso-Wakeup'],
  kirschwasser: ['🍒 Kirsch-Aufguss', '🍒 Kirschwasser-Klassik'],
  haferpflaume: ['🟣 Pflaume-Hafer'],
  banja:        ['🇷🇺 Banja-Klassiker'],
  wenik:        ['🍃 Wenik-Bad', '🍃 Birken-Wedel'],
  vulkan:       ['🌋 Vulkan-Eruption', '🌋 Lava-Aufguss'],
};

function pickRandom<T>(arr: T[], seed: number): T {
  if (arr.length === 0) throw new Error('pickRandom: empty array');
  return arr[Math.abs(seed) % arr.length];
}

/**
 * Generiert einen Titel-Vorschlag aus den ausgewählten Eigenschaften + Ölen.
 *
 * @param attributes  Aktive Attribut-IDs (z.B. ['flame', 'menthol'])
 * @param oils        Aktive Öl-IDs in Reihenfolge (z.B. ['zitrone', 'eukalyptus'])
 * @param seed        Optional. Bei gleichem Seed identischer Output (für Re-Roll Date.now() nutzen).
 */
export function generateInfusionTitle(
  attributes: string[],
  oils: string[],
  seed: number = Date.now(),
): string {
  const validOils = oils.filter((o) => OIL_BY_ID[o]);
  const validAttrs = attributes.filter((a) => (ATTR_BY_ID as Record<string, unknown>)[a]) as InfusionAttribute[];
  const firstAttr = validAttrs[0];

  // Fall 1: nichts gewählt → generisch
  if (validOils.length === 0 && validAttrs.length === 0) {
    return 'Klassischer Aufguss';
  }

  // Fall 2: nur Attribute, keine Öle
  if (validOils.length === 0) {
    const tpl = ATTR_ONLY_TEMPLATE[firstAttr];
    if (tpl && tpl.length > 0) return pickRandom(tpl, seed);
    const meta = ATTR_BY_ID[firstAttr];
    return `${meta.emoji} ${meta.label}-Aufguss`;
  }

  // Fall 3: 1 Öl
  if (validOils.length === 1) {
    const o = OIL_BY_ID[validOils[0]];
    if (firstAttr) {
      const adj = pickRandom(ATTR_ADJECTIVE[firstAttr], seed);
      return `${ATTR_BY_ID[firstAttr].emoji} ${adj} ${o.name}`;
    }
    return `${o.emoji} ${o.name}-Aufguss`;
  }

  // Fall 4: 2 Öle
  if (validOils.length === 2) {
    const o1 = OIL_BY_ID[validOils[0]];
    const o2 = OIL_BY_ID[validOils[1]];
    if (firstAttr) {
      const adj = pickRandom(ATTR_ADJECTIVE[firstAttr], seed);
      return `${ATTR_BY_ID[firstAttr].emoji} ${adj} ${o1.name}-${o2.name}-Mix`;
    }
    return `${o1.emoji}${o2.emoji} ${o1.name} & ${o2.name}`;
  }

  // Fall 5: 3 Öle — Kategorie-basierter Stimmungs-Name
  const cats = validOils.map((o) => OIL_BY_ID[o].category);
  // Wähle dominanteste Kategorie (häufigste; bei Gleichstand: erste)
  const counts = new Map<OilCategory, number>();
  cats.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));
  const dominantCat = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const vibe = CATEGORY_VIBE[dominantCat];
  const vibeName = pickRandom(vibe.names, seed);
  if (firstAttr) {
    const adj = pickRandom(ATTR_ADJECTIVE[firstAttr], seed);
    return `${ATTR_BY_ID[firstAttr].emoji}${vibe.emoji} ${adj} ${vibeName}`;
  }
  return `${vibe.emoji} ${vibeName}`;
}
