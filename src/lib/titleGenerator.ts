// Regelbasierter Titel-Generator für Aufgüsse.
// Nimmt die ausgewählten Eigenschaften + Öle entgegen und baut einen
// hübschen, deutschsprachigen Titel daraus. Mehrfach-Aufruf mit
// unterschiedlichem `seed` liefert Varianten (für Re-Roll-Button).
//
// Bewusst KEIN AI/LLM-Call — instant, deterministisch, kostenlos,
// funktioniert offline. Reicht für Sauna-Aufguss-Titel allemal.

import { ATTRIBUTES, ATTR_BY_ID, type InfusionAttribute } from './attributes';
import { OIL_BY_ID, type OilCategory } from './oils';
import type { TitelZutaten } from './titelZutaten';
import {
  kompositum, kompositumFrei, charakterAusName, tageszeit, EMOJI,
  type Charakter,
} from './titelBausteine';

// Adjektive pro Attribut. Der Generator pickt eines per Seed.
// Partial: nicht jedes Attribut MUSS ein eigenes Mapping haben — neue
// Besonderheiten bekommen automatisch FALLBACK_ADJECTIVE bis ein Mapping
// gepflegt wird.
const ATTR_ADJECTIVE: Partial<Record<InfusionAttribute, string[]>> = {
  flame:          ['Heißer', 'Glühender', 'Vulkanischer'],
  sud:            ['Intensiver', 'Konzentrierter', 'Kräftiger'],
  nature:         ['Wilder', 'Grüner', 'Natürlicher'],
  music:          ['Klingender', 'Melodischer', 'Rhythmischer'],
  loud_music:     ['Tobender', 'Wummernder', 'Lauter'],
  no_music:       ['Stiller', 'Meditativer', 'Ruhiger'],
  menthol:        ['Eiskalter', 'Frischer', 'Kühler'],
  raeuchern:      ['Geräucherter', 'Mystischer', 'Rauchiger'],
  kaffee:         ['Wacher', 'Aromatischer', 'Espresso-'],
  kirschwasser:   ['Kirschiger', 'Festlicher', 'Süßer'],
  haferpflaume:   ['Fruchtiger', 'Dunkler', 'Pflaumiger'],
  banja:          ['Traditionelles', 'Wildes', 'Dampf-'],
  wenik:          ['Birken-', 'Wedel-', 'Klassischer'],
  vulkan:         ['Eruptiver', 'Vulkanischer', 'Glut-'],
  // Sud-Zutaten
  kraeuter_sud:   ['Kräuteriger', 'Apothekers', 'Wiesen-'],
  stein_klee:     ['Stein-Klee-', 'Bäuerlicher', 'Erdiger'],
  honig_klee:     ['Honiger', 'Süßer', 'Wiesen-'],
  berg_minze:     ['Alpiner', 'Bergiger', 'Frisch-Minziger'],
  thymian:        ['Würziger', 'Mediterraner', 'Sonniger'],
  salzpeeling:    ['Salziger', 'Peelender', 'Reinigender'],
  // Musik-Ambiente
  rock:           ['Rockiger', 'Harter', 'Stadion-'],
  deutsch_rock:   ['Deutsch-Rockiger', 'Indie-', 'Heimat-'],
  boese_onkels:   ['Onkelz-', 'Frankfurter', 'Schwarzer'],
  party_schlager: ['Schlageriger', 'Tanzbarer', 'Festlicher'],
  malle_schlager: ['Malle-', 'Sonniger', 'Strand-'],
  klassik_musik:  ['Klassischer', 'Konzertanter', 'Edler'],
  kontrovers:     ['Wilder', 'Kontroverser', 'Pikanter'],
  // Nachgetragen 09.08.2026: diese zehn hatten kein Mapping und bekamen
  // stumpf „Besonderer". Betraf ausgerechnet alle zuletzt ergaenzten.
  acoustic:       ['Handgemachter', 'Leiser', 'Unplugged-'],
  oldies:         ['Nostalgischer', 'Goldener', 'Vinyl-'],
  country:        ['Staubiger', 'Weiter', 'Prärie-'],
  acdc:           ['Elektrischer', 'Donnernder', 'Hochspannungs-'],
  tote_hosen:     ['Rotziger', 'Ehrlicher', 'Düsseldorfer'],
  entspannt:      ['Entspannter', 'Gelassener', 'Weicher'],
  versucherle:    ['Verkosteter', 'Neugieriger', 'Probier-'],
  silent_strict:  ['Andächtiger', 'Schweigender', 'Stiller'],
  three_x_three:  ['Dreifacher', 'Gestaffelter', 'Drei-Runden-'],
  nachguss:       ['Nachgelegter', 'Zweiter', 'Zugaben-'],
};

// Default-Adjektive wenn ein Attribut noch kein eigenes Mapping hat.
const FALLBACK_ADJECTIVE = ['Besonderer', 'Spezieller', 'Klassischer'];

function adjectivesFor(attr: InfusionAttribute): string[] {
  return ATTR_ADJECTIVE[attr] ?? FALLBACK_ADJECTIVE;
}

// Stimmungs-Namen für 3-Öl-Mischungen (Kategorie-basiert).
const CATEGORY_VIBE: Record<OilCategory, { emoji: string; names: string[] }> = {
  zitrus:    { emoji: '🍋', names: ['Zitrus-Frische', 'Sommer-Sonne', 'Sonnen-Boost'] },
  holz:      { emoji: '🌲', names: ['Wald-Bad', 'Schwarzwald-Atem', 'Tannen-Tiefe'] },
  gewuerz:   { emoji: '🌶️', names: ['Würzige Wärme', 'Glut-Würze', 'Orient-Feuer'] },
  kraut:     { emoji: '🌿', names: ['Kräuter-Garten', 'Wiesen-Frische', 'Bauern-Kraut'] },
  minze:     { emoji: '❄️', names: ['Minz-Kühle', 'Eis-Atem', 'Frische-Kick'] },
  sonstige:  { emoji: '🌸', names: ['Blüten-Bouquet', 'Garten-Mix', 'Harmonie'] },
  saison:    { emoji: '🎄', names: ['Winter-Zauber', 'Weihnachts-Stube', 'Advents-Wärme'] },
};

// Schablonen wenn NUR Attribute (keine Öle) gewählt sind.
// Partial: nicht jedes Attribut MUSS Schablonen haben — sonst fällt der
// Generator auf "<emoji> <label>-Aufguss" zurück (siehe Fall 2 unten).
const ATTR_ONLY_TEMPLATE: Partial<Record<InfusionAttribute, string[]>> = {
  flame:          ['🔥 Feuer-Aufguss', '🔥 Hitze-Welle', '🔥 Glut-Bad'],
  sud:            ['💧 Sud-Klassiker', '💧 Klassischer Aufguss'],
  nature:         ['🌿 Natur-Aufguss', '🌿 Grüne Stunde'],
  music:          ['🎵 Musik-Session', '🎵 Beat-Aufguss'],
  loud_music:     ['🔊 Bass-Bad', '🔊 Party-Aufguss'],
  no_music:       ['🔇 Stille Andacht', '🔇 Meditation'],
  menthol:        ['❄️ Menthol-Eis', '❄️ Frost-Schock'],
  raeuchern:      ['💨 Räucher-Ritual', '💨 Rauch-Zeremonie'],
  kaffee:         ['☕ Kaffee-Aufguss', '☕ Espresso-Wakeup'],
  kirschwasser:   ['🍒 Kirsch-Aufguss', '🍒 Kirschwasser-Klassik'],
  haferpflaume:   ['🟣 Pflaume-Hafer'],
  banja:          ['♨️ Banja-Klassiker'],
  wenik:          ['🍃 Wenik-Bad', '🍃 Birken-Wedel'],
  vulkan:         ['🌋 Vulkan-Eruption', '🌋 Lava-Aufguss'],
  // Sud-Zutaten
  kraeuter_sud:   ['🧪 Kräuter-Sud', '🧪 Apotheker-Aufguss'],
  stein_klee:     ['🪨 Stein-Klee-Aufguss', '🪨 Erdiger Wiesen-Sud'],
  honig_klee:     ['🍯 Honig-Klee-Aufguss', '🍯 Goldener Wiesen-Aufguss'],
  berg_minze:     ['⛰️ Bergminz-Bad', '⛰️ Alpenfrische'],
  thymian:        ['🌱 Thymian-Aufguss', '🌱 Mediterraner Garten'],
  salzpeeling:    ['🧂 Salz-Peeling', '🧂 Meeresfrische', '🧂 Haut-Streichler'],
  // Musik-Ambiente
  rock:           ['🎸 Rock-Session', '🎸 Rock-Aufguss'],
  deutsch_rock:   ['🤘 Deutsch-Rock-Aufguss', '🤘 Heimat-Rock'],
  boese_onkels:   ['🖤 Onkelz-Session', '🖤 Schwarze Stunde'],
  party_schlager: ['🎉 Party-Schlager-Aufguss', '🎉 Tanz-Session'],
  malle_schlager: ['🏖️ Malle-Bad', '🏖️ Strand-Schlager'],
  klassik_musik:  ['🎻 Klassik-Stunde', '🎻 Konzertanter Aufguss'],
  kontrovers:     ['⚠️ Kontroverser Aufguss', '⚠️ Wilde Stunde'],
  acoustic:       ['🪕 Unplugged-Session', '🪕 Handgemacht & heiß'],
  oldies:         ['📻 Oldie-Stunde', '📻 Goldene Ära'],
  country:        ['🤠 Prärie-Aufguss', '🤠 Whiskey & Dampf'],
  acdc:           ['⚡ Highway to Sweat', '⚡ Hochspannung'],
  tote_hosen:     ['🎤 Hosen-Session', '🎤 Rotzig & heiß'],
  entspannt:      ['😌 Ruhepol', '😌 Entspannte Runde'],
  versucherle:    ['🥃 Versucherle-Runde', '🥃 Zum Probieren'],
  silent_strict:  ['🤫 Andacht', '🤫 Stille Stunde'],
  three_x_three:  ['3️⃣ Drei mal drei', '3️⃣ Dreifach-Runde'],
  nachguss:       ['🔁 Der Nachguss', '🔁 Zugabe'],
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
      const adj = pickRandom(adjectivesFor(firstAttr), seed);
      return `${ATTR_BY_ID[firstAttr].emoji} ${adj} ${o.name}`;
    }
    return `${o.emoji} ${o.name}-Aufguss`;
  }

  // Fall 4: 2 Öle
  if (validOils.length === 2) {
    const o1 = OIL_BY_ID[validOils[0]];
    const o2 = OIL_BY_ID[validOils[1]];
    if (firstAttr) {
      const adj = pickRandom(adjectivesFor(firstAttr), seed);
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
    const adj = pickRandom(adjectivesFor(firstAttr), seed);
    return `${ATTR_BY_ID[firstAttr].emoji}${vibe.emoji} ${adj} ${vibeName}`;
  }
  return `${vibe.emoji} ${vibeName}`;
}

// ═══════════════════════════════════════════════════════════════════════
// 5-Stile-Generator (Picker-Modus, kein AI nötig)
//
// User-Wunsch 30.05.2026: statt 1 AI-Titel (Anthropic-API) → 5 Vorschläge
// in 5 sehr unterschiedlichen Stilen, alles regelbasiert. Spart API-Kosten
// + funktioniert offline + sofort.
// ═══════════════════════════════════════════════════════════════════════

/** Streut denselben Seed pro Stil und pro Wortwahl auseinander — ohne das
 *  liefern alle fuenf Vorschlaege dieselben Indizes. */
function shift(seed: number, salt: number): number {
  return Math.imul(seed ^ salt, 2654435761) | 0;
}

export type TitleStyleId = 'kompositum' | 'kurz' | 'stimmung' | 'bild' | 'frech';
export type StyledTitle = { style: TitleStyleId; title: string };

// ══════════════════════════════════════════════════════════════════════
// Die fünf Typen sind KEINE erfundenen Stile mehr, sondern die Muster, die
// im Bestand tatsächlich vorkommen (593 handgeschriebene Titel, ausgewertet
// am 09.08.2026):
//
//   kompositum  „Duftreise" (49×), „Zitrusfrische", „Räuchermagie"
//               — mit Abstand am häufigsten
//   kurz        „Citrus", „Valhalla", „Klassisch" — ein Wort, fertig
//   stimmung    „Guten Morgen", „Abend-Ruhe 🌕", „Schönes Wochenende"
//   bild        „Waldspaziergang", „Feuerteufel", „Blumenwiese"
//   frech       „Hardrock Halleluja", „Ami im Wunderland"
//
// Leitplanken aus derselben Auswertung: 2,6 Wörter im Schnitt, 18 Zeichen,
// 58 % höchstens zweiwortig, nur 24 % mit Emoji — und wenn, dann meist
// HINTEN. Der alte Generator lieferte dagegen „🌹 Atemberaubende Erfüllung
// in Flammen": fünf Wörter, Emoji vorn. Grammatisch korrekt, aber niemand
// im Verein schreibt so.
// ══════════════════════════════════════════════════════════════════════

const STIMMUNG_VORLAGEN = [
  (t: string) => `Guten ${t}`,
  (t: string) => `${t}ruhe`,
  (t: string) => `${t}zauber`,
  (t: string) => `Schöner ${t}`,
  (t: string) => `${t}stunde`,
];

const FRECH_KURZ = [
  'Augen zu und durch', 'Volle Kanne', 'Ofen an', 'Schwitzkasten',
  'Hitzefrei', 'Kein Entkommen', 'Bis zur Kante', 'Alles oder nichts',
  'Feuer frei', 'Jetzt wird geschwitzt', 'Ohne Reue', 'Wer zuletzt lacht',
];

type GenContext = {
  /** Der Kopf des Aufgusses: Schnaps schlägt Mischung schlägt Öl. */
  held: string | null;
  zweiter: string | null;
  attrLabel: string | null;
  attrAdjektive: string[];
  charakter: Charakter;
  jahreszeit: string | null;
  stunde: number | null;
};

function buildContext(z: TitelZutaten): GenContext {
  const held = z.schnaps ?? z.sud[0] ?? z.oele[0] ?? z.raeucherwerk[0] ?? null;
  const alle = [...(z.schnaps ? [z.schnaps] : []), ...z.oele, ...z.sud, ...z.raeucherwerk];
  const label = z.besonderheiten[0];
  const treffer = label ? ATTRIBUTES.find((a) => a.label === label) : undefined;
  return {
    held,
    zweiter: alle.find((x) => x !== held) ?? null,
    attrLabel: label ?? null,
    attrAdjektive: treffer ? (ATTR_ADJECTIVE[treffer.id] ?? []) : [],
    // Der Charakter entscheidet über das Wortfeld. Kommt er vom Aufrufer
    // (aus der Öl-Kategorie), ist er genauer als jede Namensheuristik.
    charakter: z.charakter ?? (held ? charakterAusName(held)
      : z.raeucherwerk.length > 0 ? 'rauch' : 'neutral'),
    jahreszeit: z.jahreszeit ?? null,
    stunde: z.uhrzeit ? Number(z.uhrzeit.slice(0, 2)) : null,
  };
}

/** Emoji anhängen — sparsam, wie im echten Bestand: nur bei etwa jedem
 *  dritten Titel, und dann hinten. */
function mitEmoji(titel: string, ch: Charakter, seed: number): string {
  // Etwa jeder dritte Aufruf — bei vier von fuenf Typen ergibt das die
  // Quote des echten Bestands (24 %).
  if (Math.abs(shift(seed, 21)) % 3 !== 0) return titel;
  const liste = EMOJI[ch];
  return `${titel} ${liste[Math.abs(shift(seed, 22)) % liste.length]}`;
}

function buildKompositum(ctx: GenContext, seed: number): string {
  const wort = ctx.held
    ? kompositum(ctx.held, ctx.charakter, seed)
    : kompositumFrei(ctx.charakter, seed);
  return mitEmoji(wort, ctx.charakter, seed);
}

function buildKurz(ctx: GenContext, seed: number): string {
  // Ein Wort. Entweder die Zutat pur, das Attribut, oder ein freies
  // Kompositum — wie „Citrus", „Klassisch", „Waldluft".
  const form = Math.abs(shift(seed, 6)) % 3;
  if (form === 0 && ctx.held) return ctx.held;
  if (form === 1 && ctx.attrLabel) return ctx.attrLabel;
  return mitEmoji(kompositumFrei(ctx.charakter, shift(seed, 7)), ctx.charakter, shift(seed, 9));
}

function buildStimmung(ctx: GenContext, seed: number): string {
  const t = ctx.stunde !== null ? tageszeit(ctx.stunde) : null;
  const basis = t ?? ctx.jahreszeit ?? 'Abend';
  const vorlage = STIMMUNG_VORLAGEN[Math.abs(shift(seed, 8)) % STIMMUNG_VORLAGEN.length];
  return mitEmoji(vorlage(basis), ctx.charakter, seed);
}

/** Substantive, deren Geschlecht ICH kenne — alle maskulin, damit das
 *  Adjektiv immer auf -er endet. Das umgeht das eigentliche Problem: das
 *  Geschlecht der ZUTATEN ist unbekannt. „Eiskalter Zitrone" war falsch (die
 *  Zitrone), „Heißer Kirschwasser" auch (das Kirschwasser) — und eine
 *  Genus-Tabelle für 64 Öle plus alle selbst angelegten wäre nie vollständig,
 *  weil morgen jemand ein neues anlegt. */
const BILD_TRAEGER = [
  'Moment', 'Gruß', 'Zauber', 'Atem', 'Aufguss', 'Abend', 'Gang', 'Rausch',
];

function buildBild(ctx: GenContext, seed: number): string {
  const adj = ctx.attrAdjektive.length > 0
    ? ctx.attrAdjektive[Math.abs(shift(seed, 11)) % ctx.attrAdjektive.length]
    : null;

  // Adjektive mit Bindestrich kleben direkt an die Zutat — dort spielt das
  // Geschlecht keine Rolle: „Hochspannungs-Rosmarin".
  if (adj && adj.endsWith('-') && ctx.held) return `${adj}${ctx.held}`;

  // Sonst bekommt das Adjektiv einen Träger, dessen Geschlecht feststeht.
  if (adj) {
    const traeger = BILD_TRAEGER[Math.abs(shift(seed, 14)) % BILD_TRAEGER.length];
    return `${adj} ${traeger}`;
  }

  if (ctx.held && ctx.zweiter && Math.abs(shift(seed, 15)) % 3 === 0) {
    return `${ctx.held} & ${ctx.zweiter}`;
  }
  if (ctx.held) return kompositum(ctx.held, ctx.charakter, shift(seed, 12));
  return kompositumFrei(ctx.charakter, shift(seed, 13));
}

function buildFrech(ctx: GenContext, seed: number): string {
  const form = Math.abs(shift(seed, 1)) % 3;
  if (form === 0 && ctx.held) return `${ctx.held} bis zum Anschlag`;
  if (form === 1 && ctx.attrLabel) return `${ctx.attrLabel}, volle Kanne`;
  return FRECH_KURZ[Math.abs(shift(seed, 2)) % FRECH_KURZ.length];
}

const STYLE_ORDER: TitleStyleId[] = ['kompositum', 'kurz', 'stimmung', 'bild', 'frech'];

/** Fünf Titel-Vorschläge, gebaut nach den Mustern echter Vereinstitel.
 *
 *  Dient als Fallback hinter dem KI-Vorschlag (api/ai.ts) — und trägt allein,
 *  solange kein API-Schlüssel hinterlegt ist. Bei gleichem seed identisch.
 */
export function generateInfusionTitles(
  zutaten: TitelZutaten,
  seed: number = Date.now(),
  /** Titel, die es im Verein schon gibt. Werden gemieden, solange sich eine
   *  Alternative finden lässt — „Duftreise" steht 49-mal im Bestand, als
   *  Vorschlag wäre das korrekt, aber langweilig. Das ist etwas, das ein
   *  Regelsystem kann und ein Sprachmodell ohne diese Liste nicht. */
  vermeiden: readonly string[] = [],
): StyledTitle[] {
  const ctx = buildContext(zutaten);
  const belegt = new Set(vermeiden.map((t) => t.trim().toLowerCase()));

  const baue = (style: TitleStyleId, sub: number): string => {
    switch (style) {
      case 'kompositum': return buildKompositum(ctx, sub);
      case 'kurz':       return buildKurz(ctx, sub);
      case 'stimmung':   return buildStimmung(ctx, sub);
      case 'bild':       return mitEmoji(buildBild(ctx, sub), ctx.charakter, shift(sub, 31));
      case 'frech':      return buildFrech(ctx, sub);
    }
  };

  // Was in DIESEM Durchgang schon vergeben ist, zählt auch als belegt —
  // sonst stünden zwei gleiche Vorschläge untereinander.
  const dieseRunde = new Set<string>();

  return STYLE_ORDER.map((style, i): StyledTitle => {
    let title = '';
    // Bis zu acht Anläufe mit verschobenem Seed. Danach wird genommen, was
    // da ist: lieber ein vorhandener Titel als gar keiner.
    for (let versuch = 0; versuch < 8; versuch++) {
      title = baue(style, shift(seed, i * 7919 + versuch * 104729));
      const k = title.trim().toLowerCase();
      if (!belegt.has(k) && !dieseRunde.has(k)) break;
    }
    dieseRunde.add(title.trim().toLowerCase());
    return { style, title };
  });
}
