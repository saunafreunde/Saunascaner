// Regeln des Banja-Rituals — Spiegel der Datenbank (Trigger
// validate_infusion_banja_and_overlap + RPC book_banja_ritual, Stand 0183).
// Die Datenbank bleibt maßgeblich; diese Datei sorgt nur dafür, dass der
// Planer dieselbe Regel kennt und nicht erst beim Speichern scheitert.
// Eigene Datei statt in routes/Planner, damit Komponenten sie importieren
// können, ohne einen Import-Zyklus über den Planer zu bauen.
//
// Seit 08.08.2026 frei planbar — jede Sauna, jede Uhrzeit. Fest ist nur die
// Dauer, und die hängt an der Startstunde: zwei Stunden, außer um 19:00 Uhr,
// wo 90 Minuten reichen. Um 20:30 Uhr ist an normalen Tagen Schluss — das
// Ritual muss bis dahin enden (praktisch: Beginn spätestens 19:00 Uhr). Am
// Saunafest gilt die Grenze nicht. Danach bleibt die Sauna eine Stunde zu
// (Ruhestunde: reinigen und lüften).
//
// Die Stunden sind Berliner Ortszeit — wie im Trigger. Der Planer rechnet mit
// der Uhr des Geräts, das im Verein ohnehin in Berlin steht (lib/garantie.ts).

export const BANJA_DAUER_LANG = 120;
export const BANJA_DAUER_KURZ = 90;
export const BANJA_KURZ_STUNDE = 19;
/** Ruhestunde(n) nach dem Ritual. */
export const BANJA_RUHE_STUNDEN = 1;
/** Betriebsschluss an normalen Tagen, in Minuten nach Mitternacht (20:30 Uhr). */
export const BANJA_SPAETESTES_ENDE_MIN = 20 * 60 + 30;
export const BANJA_SCHLUSS_HINWEIS = '🌙 Das Banja-Ritual muss bis 20:30 Uhr enden – bitte spätestens um 19:00 Uhr beginnen.';

/** Wie lange dauert ein Banja, das zu dieser Stunde (Berliner Zeit) beginnt? */
export function banjaDauerFuer(stunde: number): number {
  return stunde === BANJA_KURZ_STUNDE ? BANJA_DAUER_KURZ : BANJA_DAUER_LANG;
}

/** Endet ein Banja mit dieser Startstunde an einem normalen Tag bis 20:30 Uhr? */
export function banjaEndetRechtzeitig(stunde: number): boolean {
  return stunde * 60 + banjaDauerFuer(stunde) <= BANJA_SPAETESTES_ENDE_MIN;
}
