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
  banja:          ['Russischer', 'Wilder', 'Banja-'],
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
  banja:          ['🇷🇺 Banja-Klassiker'],
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

export type TitleStyleId = 'poetisch' | 'kurz' | 'mystisch' | 'sinnlich' | 'frech';
export type StyledTitle = { style: TitleStyleId; title: string };

// Wortbänke pro Stil — bei jedem Aufruf wird zufällig kombiniert.
// Erweitert 30.05.2026: jede Bank ungefähr verdoppelt für mehr Variation
// beim "🎲 Neu würfeln". Stil-Charakter bleibt klar erhalten.
const POETISCH = {
  prefix: ['🌿', '🍃', '✨', '🌙', '☀️', '🌅', '🌳', '🌾', '💫', '🪶', '🦋', '🌸'],
  adjektiv: [
    'flüsternder', 'goldener', 'tanzender', 'duftender', 'leiser', 'dampfender',
    'sanfter', 'kühler', 'warmer', 'wilder', 'zitternder', 'frischer',
    'glühender', 'ruhiger', 'weicher', 'samtener', 'milder', 'glänzender',
    'leuchtender', 'träumender', 'schimmernder', 'atmender', 'sonniger', 'silberner',
  ],
  substantiv: [
    'Hauch', 'Tanz', 'Atem', 'Schimmer', 'Klang', 'Schleier',
    'Flügel', 'Wiege', 'Gruß', 'Bogen', 'Kuss', 'Strom',
    'Welle', 'Reigen', 'Funke', 'Lied', 'Märchen', 'Spiegel',
    'Glanz', 'Mantel', 'Wirbel', 'Hauch',
  ],
  von_im: ['des', 'der', 'aus dem', 'im', 'vom', 'auf dem', 'am', 'beim', 'aus'],
  ort: [
    'Waldes', 'Schwarzwalds', 'Morgens', 'Abends', 'Sommers', 'Himmels',
    'Birkenhains', 'Sonnentals', 'Nordwinds', 'Kräutergartens',
    'Bachs', 'Frühlings', 'Mondes', 'Sterns', 'Tannenwalds',
    'Bergstroms', 'Lichts', 'Aufgangs', 'Lagerfeuers', 'Quellbachs',
    'Bergsees', 'Heidekrauts', 'Nebels', 'Tals',
  ],
};

const KURZ = {
  basis: [
    'Glut', 'Atem', 'Hauch', 'Welle', 'Funke', 'Klang',
    'Blitz', 'Sprung', 'Tanz', 'Wirbel', 'Sturm', 'Brise',
    'Lava', 'Eis', 'Fels', 'Wald', 'Dunst', 'Feuer',
    'Glanz', 'Strudel', 'Wind', 'Quelle', 'Boom', 'Frost',
    'Flamme', 'Hitze', 'Donner', 'Echo',
  ],
  suffix: [
    'stoß', '-Bad', '-Kuss', '-Kick', 'feuer', '-Wave',
    '-Zauber', '-Welt', '-Reise', '-Zone', '-Schock', '-Hauch',
    '-Spritzer', '-Symphonie', '-Orgie', '-Magic', '-Rausch', '-Boost',
  ],
};

const MYSTISCH = {
  prefix: ['🔮', '🐉', '🌋', '⚡', '🔱', '🗝️', '🌌', '🦅', '🗡️', '🏔️', '🌠', '🪬'],
  wesen: [
    'Phönix', 'Drache', 'Schamane', 'Druide', 'Götter', 'Walküren',
    'Schmied', 'Nymphe', 'Sturmgeist', 'Salamander',
    'Hexe', 'Sphinx', 'Zentaur', 'Faun', 'Kobold',
    'Erdenmagier', 'Feuergeist', 'Schicksal', 'Orakel', 'Titan',
    'Drudin', 'Walkürengruß', 'Nordlicht', 'Runenmeister',
  ],
  verb: [
    'weckt', 'beschwört', 'tanzt mit', 'erweckt', 'küsst', 'lockt',
    'zähmt', 'entfesselt', 'ruft', 'beschwingt', 'formt', 'schmiedet',
    'flüstert mit', 'umarmt', 'fängt ein',
  ],
  ergaenzung: [
    'die Glut', 'das Feuer', 'den Sturm', 'die Tiefe', 'das Echo',
    'die Asche', 'das Licht', 'die Schatten', 'den Atem', 'das Funkeln',
    'die Tiefen', 'das Brausen', 'den Glanz', 'das Eis', 'das Rauschen',
  ],
};

const SINNLICH = {
  prefix: ['🌹', '💋', '🔥', '💕', '🌸', '✨', '🍷', '🕯️', '🌿', '💫'],
  adjektiv: [
    'Heiße', 'Sanfte', 'Verlockende', 'Verführerische', 'Zarte',
    'Glühende', 'Wilde', 'Atemberaubende',
    'Pulsierende', 'Brennende', 'Süße', 'Honig-warme', 'Cremige',
    'Knisternde', 'Sinnliche', 'Lockende', 'Berauschende', 'Schmelzende',
  ],
  substantiv: [
    'Berührung', 'Verführung', 'Umarmung', 'Liebkosung', 'Versuchung',
    'Hingabe', 'Sehnsucht', 'Welle',
    'Reise', 'Begegnung', 'Erfüllung', 'Zärtlichkeit', 'Magie',
    'Wärme', 'Lust', 'Glut', 'Hingabe', 'Verzauberung',
  ],
  modifier: [
    'der Sinne', 'der Glut', 'der Wärme', 'des Augenblicks',
    'für die Haut', 'in Hitze', 'des Moments',
    'auf nackter Haut', 'im Glühen', 'der Verheißung', 'des Vergessens',
    'der Lust', 'in Flammen', 'unter der Haut', 'der Stille',
  ],
};

const FRECH = {
  prefix: ['😉', '🤪', '🥵', '🤘', '🎬', '🤙', '🍻', '🙈', '💨', '🚀', '🔥', '🎉'],
  intro: [
    'Operation', 'Mission', 'Tatort', 'Achtung', 'Vorsicht', 'Hallo',
    'Alarm', 'Voilà', 'Tadaa', 'Yo', 'Hochkonjunktur', 'Notruf',
    'Showtime', 'Bühne frei für',
  ],
  thema: [
    'Schwitzwurst', 'Hitze-Hammer', 'Glut-Knaller', 'Volldampf',
    'Heiße Sache', 'Ofen aus', 'Augen zu', 'Schwitzkasten',
    'Heiße Hütte', 'Schweißbruder', 'Schwitzparade', 'Saunaschock',
    'Ofengeflüster', 'Glühwein-Style', 'Hot-Hot-Hot', 'Brennzauber',
    'Verdampf-Spezial', 'Schwitzfest', 'Heißduscher',
  ],
  zusatz: [
    '!', ' deluxe', ' XXL', ' & durch', ' Spezial', ' — jetzt!',
    ' Premium', ' ohne Pardon', ' mit Bums', ' ohne Reue', ' on Fire',
    ' mit Wumms', ' à la Carte', ' — Vorhang auf', ' für Mutige',
  ],
};

// ──────────────────────────────────────────────────────────────────────
// Seed-basierte Picker — deterministisch innerhalb eines Aufrufs, aber
// abwechslungsreich beim "🎲 Neu würfeln" durch Date.now()-Seed-Bump.

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

// Hash für stabile Differenzierung pro Stil (sonst alle 5 mit gleichem seed)
function shift(seed: number, salt: number): number {
  return Math.imul(seed ^ salt, 2654435761) | 0;
}

// ──────────────────────────────────────────────────────────────────────
// Helfer: zieht passendes Öl/Attribut als "Hauptbestandteil" für die Titel.
type GenContext = {
  oils: { id: string; name: string; emoji: string; category: OilCategory }[];
  attrs: InfusionAttribute[];
  /** Erstes Öl (für Stile die ein Öl nennen). */
  oilName: string | null;
  /** Erstes Attribut-Label (für Stile die eine Eigenschaft nennen). */
  attrLabel: string | null;
};

function buildContext(attributes: string[], oils: string[]): GenContext {
  const validOils = oils
    .filter((o) => OIL_BY_ID[o])
    .map((o) => ({ id: o, name: OIL_BY_ID[o].name, emoji: OIL_BY_ID[o].emoji, category: OIL_BY_ID[o].category }));
  const validAttrs = attributes.filter((a) => (ATTR_BY_ID as Record<string, unknown>)[a]) as InfusionAttribute[];
  return {
    oils: validOils,
    attrs: validAttrs,
    oilName: validOils[0]?.name ?? null,
    attrLabel: validAttrs[0] ? ATTR_BY_ID[validAttrs[0]].label : null,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Stil-Builder — jeder returnt EINEN Titel passend zum Stil

function buildPoetisch(ctx: GenContext, seed: number): string {
  const prefix = pick(POETISCH.prefix, seed);
  const adj = pick(POETISCH.adjektiv, shift(seed, 1));
  const sub = pick(POETISCH.substantiv, shift(seed, 2));
  if (ctx.oilName) {
    const part = pick(['des ' + ctx.oilName + 's', 'aus ' + ctx.oilName, 'vom ' + ctx.oilName], shift(seed, 3));
    return `${prefix} ${capitalize(adj)} ${sub} ${part}`;
  }
  const von = pick(POETISCH.von_im, shift(seed, 3));
  const ort = pick(POETISCH.ort, shift(seed, 4));
  return `${prefix} ${capitalize(adj)} ${sub} ${von} ${ort}`;
}

function buildKurz(ctx: GenContext, seed: number): string {
  // 1-2 Wörter, prägnant
  if (ctx.oilName) {
    // Variante A: Öl + suffix
    const suf = pick(KURZ.suffix, seed);
    return `${ctx.oilName}${suf}`;
  }
  if (ctx.attrLabel) {
    const suf = pick(KURZ.suffix, seed);
    return `${ctx.attrLabel}${suf}`;
  }
  const a = pick(KURZ.basis, seed);
  const b = pick(KURZ.suffix, shift(seed, 1));
  return `${a}${b}`;
}

function buildMystisch(ctx: GenContext, seed: number): string {
  const prefix = pick(MYSTISCH.prefix, seed);
  const wesen = pick(MYSTISCH.wesen, shift(seed, 1));
  const verb = pick(MYSTISCH.verb, shift(seed, 2));
  if (ctx.oilName) {
    return `${prefix} ${wesen} ${verb} ${ctx.oilName}`;
  }
  const erg = pick(MYSTISCH.ergaenzung, shift(seed, 3));
  return `${prefix} ${wesen} ${verb} ${erg}`;
}

function buildSinnlich(ctx: GenContext, seed: number): string {
  const prefix = pick(SINNLICH.prefix, seed);
  const adj = pick(SINNLICH.adjektiv, shift(seed, 1));
  const sub = pick(SINNLICH.substantiv, shift(seed, 2));
  if (ctx.oilName) {
    return `${prefix} ${adj} ${sub} mit ${ctx.oilName}`;
  }
  const mod = pick(SINNLICH.modifier, shift(seed, 3));
  return `${prefix} ${adj} ${sub} ${mod}`;
}

function buildFrech(ctx: GenContext, seed: number): string {
  const prefix = pick(FRECH.prefix, seed);
  const variant = Math.abs(shift(seed, 1)) % 3;
  if (variant === 0) {
    // "Operation Schwitzwurst!"
    const intro = pick(FRECH.intro, shift(seed, 2));
    const thema = pick(FRECH.thema, shift(seed, 3));
    const zus = pick(FRECH.zusatz, shift(seed, 4));
    return `${prefix} ${intro} ${thema}${zus}`;
  }
  if (variant === 1 && ctx.oilName) {
    return `${prefix} ${ctx.oilName} knockt dich um`;
  }
  if (variant === 2 && ctx.attrLabel) {
    const adj = pick(['extra', 'ultra', 'mega', 'voll', 'richtig'], shift(seed, 5));
    return `${prefix} ${capitalize(adj)} ${ctx.attrLabel}!`;
  }
  // Fallback
  const intro = pick(FRECH.intro, shift(seed, 2));
  const thema = pick(FRECH.thema, shift(seed, 3));
  return `${prefix} ${intro} ${thema}`;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

const STYLE_ORDER: TitleStyleId[] = ['poetisch', 'kurz', 'mystisch', 'sinnlich', 'frech'];

/**
 * Generiert genau 5 Titel-Vorschläge in 5 unterschiedlichen Stilen.
 *
 * Reine Funktion — keine Network-Calls, keine API-Keys, instant.
 * Bei gleichem seed identischer Output (für Determinismus in Tests).
 * "🎲 Neu würfeln" im UI: einfach mit neuem Date.now()-Seed aufrufen.
 *
 * @returns Array von 5 StyledTitle in fester Reihenfolge:
 *   [poetisch, kurz, mystisch, sinnlich, frech]
 */
export function generateInfusionTitles(
  attributes: string[],
  oils: string[],
  seed: number = Date.now(),
): StyledTitle[] {
  const ctx = buildContext(attributes, oils);
  return STYLE_ORDER.map((style, i): StyledTitle => {
    const subSeed = shift(seed, i * 7919); // jeder Stil eigener Seed-Salt
    let title: string;
    switch (style) {
      case 'poetisch': title = buildPoetisch(ctx, subSeed); break;
      case 'kurz':     title = buildKurz(ctx, subSeed); break;
      case 'mystisch': title = buildMystisch(ctx, subSeed); break;
      case 'sinnlich': title = buildSinnlich(ctx, subSeed); break;
      case 'frech':    title = buildFrech(ctx, subSeed); break;
    }
    return { style, title };
  });
}
