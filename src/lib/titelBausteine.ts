/** Bausteine für Aufguss-Titel, die klingen wie die echten.
 *
 *  ── Woher die Regeln kommen ──
 *  Am 09.08.2026 habe ich die 593 von Hand geschriebenen Titel im Bestand
 *  ausgewertet (389 verschiedene). Das Ergebnis widerspricht dem, was der
 *  Generator vorher gebaut hat:
 *
 *    Länge          18 Zeichen, 2,6 Wörter im Schnitt
 *    58 %           höchstens ZWEI Wörter
 *    nur 24 %       beginnen mit einem Emoji
 *    häufigster Typ ein zusammengesetztes Wort:
 *                   „Duftreise" (49×), „Zitrusfrische", „Waldspaziergang",
 *                   „Räuchermagie", „Waldluft", „Feuerteufel", „Blumenwiese"
 *
 *  Der Generator lieferte dagegen Fünfwortgebilde wie „🌹 Atemberaubende
 *  Erfüllung in Flammen" — grammatisch inzwischen korrekt, aber erkennbar
 *  maschinell. Kein Mensch im Verein schreibt so.
 *
 *  Diese Datei liefert deshalb das, was fehlte: eine saubere Kompositum-
 *  Bildung und Wortfelder, die zum CHARAKTER der Zutat passen statt zu ihrem
 *  Namen.
 */

/** Grobe Sinneswelt einer Zutat. Bestimmt, aus welchem Wortfeld der zweite
 *  Teil des Kompositums kommt: zu „Zitrone" passt „-frische", zu „Zirbe"
 *  „-tiefe", und beides wäre andersherum falsch. */
export type Charakter = 'frisch' | 'warm' | 'wald' | 'kraut' | 'bluete' | 'rauch' | 'neutral';

/** Zweitglieder je Charakter. Alle so gewählt, dass sie sich als Kompositum
 *  anfügen lassen und für sich schon nach Sauna klingen. */
const ZWEITGLIED: Record<Charakter, string[]> = {
  frisch: ['frische', 'kick', 'welle', 'brise', 'reise', 'dusche', 'kur', 'wind', 'klarheit'],
  warm:   ['glut', 'wärme', 'feuer', 'zauber', 'traum', 'rausch', 'stunde', 'nacht', 'seele'],
  wald:   ['luft', 'tiefe', 'spaziergang', 'ruhe', 'atem', 'pfad', 'stille', 'harz', 'lichtung'],
  kraut:  ['sud', 'garten', 'wiese', 'kur', 'magie', 'apotheke', 'ernte', 'bündel'],
  bluete: ['duft', 'traum', 'wiese', 'zauber', 'reise', 'wolke', 'seide', 'blüte'],
  rauch:  ['magie', 'ritual', 'nebel', 'schleier', 'zauber', 'stunde', 'geist'],
  neutral:['reise', 'zauber', 'stunde', 'moment', 'bad', 'gruß', 'runde'],
};

/** Erstglieder ohne Zutat — für Titel, die keine Zutat nennen sollen.
 *  Alle aus dem echten Bestand abgeleitet (Wald…, Feuer…, Duft…, Sommer…). */
const ERSTGLIED_FREI: Record<Charakter, string[]> = {
  frisch: ['Zitrus', 'Frische', 'Eis', 'Morgen', 'Quell'],
  warm:   ['Feuer', 'Glut', 'Ofen', 'Abend', 'Sonnen'],
  wald:   ['Wald', 'Tannen', 'Schwarzwald', 'Forst', 'Moos'],
  kraut:  ['Kräuter', 'Wiesen', 'Garten', 'Heu'],
  bluete: ['Blüten', 'Blumen', 'Sommer', 'Garten'],
  rauch:  ['Räucher', 'Rauch', 'Harz', 'Nebel'],
  neutral:['Sauna', 'Dampf', 'Aufguss', 'Schwitz'],
};

/** Charakter aus einer Öl-Kategorie (lib/oils.ts kennt sieben). */
export function charakterAusKategorie(kat: string): Charakter {
  switch (kat) {
    case 'zitrus': case 'minze': return 'frisch';
    case 'holz':                 return 'wald';
    case 'gewuerz': case 'saison': return 'warm';
    case 'kraut':                return 'kraut';
    case 'sonstige':             return 'bluete';
    default:                     return 'neutral';
  }
}

/** Charakter aus dem NAMEN raten — für eigene Öle und Kräuter, die keine
 *  Kategorie tragen. Bewusst schlicht: trifft es nicht, kommt 'neutral'
 *  heraus, und das passt immer noch. */
export function charakterAusName(name: string): Charakter {
  const n = name.toLowerCase();
  if (/zitr|lemon|limet|orange|grapefruit|yuzu|minz|menthol|eukalyptus|frisch|ice|kamp/.test(n)) return 'frisch';
  if (/tanne|fichte|kiefer|zirbe|zirbel|zeder|holz|wald|latsche|thuja|wacholder|harz|birke/.test(n)) return 'wald';
  if (/zimt|nelke|pfeffer|ingwer|anis|kardamom|cardamom|vanille|kakao|tonka|muskat|gewürz|honig/.test(n)) return 'warm';
  if (/rosmarin|thymian|salbei|beifuß|melisse|lorbeer|heu|klee|kraut|basilikum|oregano|ysop|koriander/.test(n)) return 'kraut';
  if (/rose|jasmin|lavendel|blüte|blume|lotus|kamille|osmanthus|ylang|neroli|gardenia|frangi|magnolie/.test(n)) return 'bluete';
  if (/weihrauch|myrrhe|palo|santo|kopal|räucher|rauch/.test(n)) return 'rauch';
  return 'neutral';
}

/** Fugenform für den ersten Teil eines Kompositums.
 *
 *  Deutsche Fugen sind unregelmäßig, aber drei Regeln decken fast alles ab,
 *  was hier vorkommt:
 *    „Zitrone"    endet auf -e   → Zitronen-   (Fugen-n)
 *    „Lavendel"   endet auf -el/-er/-en → unverändert
 *    „Rosmarin"   Konsonant      → unverändert
 *  Mehrteilige Namen („Blaue Kamille", „Weisstanne aus Südtirol") werden auf
 *  ihr Kernwort gekürzt — sonst entstünde „Blaue Kamillenduft".
 */
export function fugenform(name: string): string {
  // Kernwort: das letzte Wort vor einem „aus/von/mit"-Zusatz, sonst das letzte.
  const ohneZusatz = name.split(/\s+(?:aus|von|vom|mit)\s+/i)[0].trim();
  const teile = ohneZusatz.split(/[\s/-]+/).filter(Boolean);
  let kern = teile[teile.length - 1] ?? ohneZusatz;
  // Ein vorangestelltes Adjektiv („Blaue Kamille") fällt damit weg. Bei
  // „Tonka Bohne" bliebe „Bohne" — deshalb: ist der erste Teil länger als
  // der letzte, gewinnt er.
  if (teile.length > 1 && teile[0].length > kern.length) kern = teile[0];

  const k = kern.charAt(0).toUpperCase() + kern.slice(1);
  if (/(el|er|en|chen|lein)$/i.test(k)) return k;
  if (/e$/i.test(k)) return k + 'n';
  if (/(is|us|os)$/i.test(k)) return k;
  return k;
}

/** Baut ein Kompositum: „Zitrone" + frisch → „Zitronenfrische". */
export function kompositum(zutat: string, ch: Charakter, wahl: number): string {
  const liste = ZWEITGLIED[ch];
  const zweit = liste[Math.abs(wahl) % liste.length];
  return fugenform(zutat) + zweit;
}

/** Kompositum ohne Zutat: „Waldstille", „Feuerzauber". */
export function kompositumFrei(ch: Charakter, wahl: number): string {
  const erst = ERSTGLIED_FREI[ch];
  const zweit = ZWEITGLIED[ch];
  return erst[Math.abs(wahl) % erst.length]
    + zweit[Math.abs(wahl >> 3) % zweit.length];
}

/** Tageszeit-Wort aus der Stunde — die echten Titel nutzen das oft
 *  („Guten Morgen", „Abend-Ruhe", „Slowl Morning"). */
export function tageszeit(stunde: number): string | null {
  if (stunde <= 12) return 'Morgen';
  if (stunde <= 15) return 'Mittag';
  if (stunde <= 18) return 'Nachmittag';
  return 'Abend';
}

/** Emojis, sparsam und passend. Im echten Bestand steht das Emoji meist
 *  HINTEN („Summersplash 🌊", „Abend-Ruhe 🌕🪻") oder gar nicht — nur 24 %
 *  der Titel beginnen mit einem. */
export const EMOJI: Record<Charakter, string[]> = {
  frisch: ['🍋', '❄️', '💧', '🌊'],
  warm:   ['🔥', '🌶️', '🕯️', '☕'],
  wald:   ['🌲', '🌿', '🪵', '🍃'],
  kraut:  ['🌿', '🌾', '🧪', '🍀'],
  bluete: ['🌸', '🌺', '🪻', '🌼'],
  rauch:  ['💨', '🕯️', '🌫️'],
  neutral:['♨️', '💦', '✨'],
};
