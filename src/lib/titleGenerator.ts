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

// ── Ziel-Länge: VIER bis SECHS Wörter (User-Vorgabe 09.08.2026) ──
// Das liegt bewusst über dem Bestand (2,6 Wörter im Schnitt): gewünscht sind
// ausdrucksstärkere Titel als die bisher geschriebenen. Jede Vorlage unten
// ist so gebaut, dass sie mit eingesetzter Zutat in diesem Fenster landet;
// generateInfusionTitles prüft danach nach und würfelt neu, wenn nicht.
const MIN_WOERTER = 4;
const MAX_WOERTER = 6;

function woerter(t: string): number {
  // Emojis zählen nicht als Wort — sie stehen für sich.
  return t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .trim().split(/\s+/).filter(Boolean).length;
}

/** Zeit- und Ortsangaben, die einen Titel natürlich verlängern. */
const RAHMEN = [
  'am späten Abend', 'zur blauen Stunde', 'im warmen Dämmerlicht',
  'wenn der Ofen glüht', 'kurz vor Sonnenuntergang', 'mitten in der Glut',
  'auf heißen Steinen', 'im Dampf der Kabine', 'bei voller Hitze',
];

const STIMMUNG_VORLAGEN: ((t: string, k: string) => string)[] = [
  (t, k) => `Ein guter ${t} mit ${k}`,
  (t, k) => `${k} für einen langen ${t}`,
  (t, k) => `${t}stunde mit ${k} und Dampf`,
  (t, k) => `${t} ganz im Zeichen von ${k}`,
  (t, k) => `${k} macht diesen ${t} aus`,
];

const FRECH_VORLAGEN: ((z: string) => string)[] = [
  () => `Heute wird es richtig heiß, Freunde`,
  (z) => `${z} bis zum letzten Tropfen`,
  () => `Augen zu und einfach durch damit`,
  (z) => `Wer jetzt geht, verpasst ${z}`,
  (z) => `${z} und kein Zurück mehr`,
  (z) => `Ofen an, Verstand aus, ${z}`,
];

// TRAEGER sind alle maskulin — dort ist die Adjektiv-Endung -er immer
// richtig. Die Zutat steht davon getrennt hinter „mit"/„aus" oder als
// Subjekt am Satzanfang.
const BILD_VORLAGEN: ((a: string, k: string) => string)[] = [
  (a, k) => `${a} Gruß mit ${k}`,
  (_a, k) => `Wenn ${k} die Steine trifft`,
  (a, _k) => `${a} Moment im Dampf der Kabine`,
  (a, k) => `Ein ${a.toLowerCase()} Aufguss mit ${k}`,
  (_a, k) => `${k} entfaltet die volle Kraft`,
];

type GenContext = {
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
    charakter: z.charakter ?? (held ? charakterAusName(held)
      : z.raeucherwerk.length > 0 ? 'rauch' : 'neutral'),
    jahreszeit: z.jahreszeit ?? null,
    stunde: z.uhrzeit ? Number(z.uhrzeit.slice(0, 2)) : null,
  };
}

/** Emoji sparsam und hinten — wie im echten Bestand (24 %). */
function mitEmoji(titel: string, ch: Charakter, seed: number): string {
  if (Math.abs(shift(seed, 21)) % 4 !== 0) return titel;
  const liste = EMOJI[ch];
  return `${titel} ${liste[Math.abs(shift(seed, 22)) % liste.length]}`;
}

/** Der Kern des Aufgusses als EIN Wort — Kompositum aus der Zutat oder frei. */
function kernwort(ctx: GenContext, seed: number): string {
  return ctx.held
    ? kompositum(ctx.held, ctx.charakter, seed)
    : kompositumFrei(ctx.charakter, seed);
}

function buildKompositum(ctx: GenContext, seed: number): string {
  // Das Kompositum bleibt der Kern, bekommt aber einen Rahmen — allein waere
  // es ein Wort und damit weit unter der Vorgabe.
  const kern = kernwort(ctx, seed);
  const rahmen = RAHMEN[Math.abs(shift(seed, 5)) % RAHMEN.length];
  return mitEmoji(`${kern} ${rahmen}`, ctx.charakter, seed);
}

function buildKurz(ctx: GenContext, seed: number): string {
  // „Knapp" heisst jetzt: die Zutaten nebeneinander, ohne Schmuck.
  if (ctx.held && ctx.zweiter) return `${ctx.held} trifft ${ctx.zweiter}`;
  if (ctx.held && ctx.attrLabel) return `${ctx.held} und ${ctx.attrLabel} vereint`;
  // „in seiner reinsten Form" waere bei „Blaue Kamille" falsch (ihrer).
  if (ctx.held) return `${ctx.held} pur auf heißen Steinen`;
  return `${kompositumFrei(ctx.charakter, shift(seed, 7))} für alle Sinne`;
}

function buildStimmung(ctx: GenContext, seed: number): string {
  const t = ctx.stunde !== null ? (tageszeit(ctx.stunde) ?? 'Abend') : (ctx.jahreszeit ?? 'Abend');
  const kern = ctx.held ?? kernwort(ctx, shift(seed, 3));
  const vorlage = STIMMUNG_VORLAGEN[Math.abs(shift(seed, 8)) % STIMMUNG_VORLAGEN.length];
  return mitEmoji(vorlage(t, kern), ctx.charakter, seed);
}

function buildBild(ctx: GenContext, seed: number): string {
  // Adjektive mit Bindestrich („Hochspannungs-") passen nicht in einen Satz —
  // dort wird der Bindestrich zum Bruch. Dann lieber ein neutrales.
  const roh = ctx.attrAdjektive.length > 0
    ? ctx.attrAdjektive[Math.abs(shift(seed, 11)) % ctx.attrAdjektive.length]
    : null;
  const adj = roh && !roh.endsWith('-') ? roh : 'Stiller';
  const kern = ctx.held ?? kernwort(ctx, shift(seed, 12));
  const vorlage = BILD_VORLAGEN[Math.abs(shift(seed, 13)) % BILD_VORLAGEN.length];
  return mitEmoji(vorlage(adj, kern), ctx.charakter, seed);
}

function buildFrech(ctx: GenContext, seed: number): string {
  const kern = ctx.held ?? ctx.attrLabel ?? 'die Hitze';
  const vorlage = FRECH_VORLAGEN[Math.abs(shift(seed, 2)) % FRECH_VORLAGEN.length];
  return vorlage(kern);
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
      const w = woerter(title);
      // Neben Dubletten wird die LAENGE geprueft: vier bis sechs Woerter.
      // Trifft es nach acht Anlaeufen nicht, gilt der letzte — ein Titel ist
      // besser als eine leere Zeile.
      if (!belegt.has(k) && !dieseRunde.has(k) && w >= MIN_WOERTER && w <= MAX_WOERTER) break;
    }
    dieseRunde.add(title.trim().toLowerCase());
    return { style, title };
  });
}
