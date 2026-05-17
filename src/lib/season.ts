// Datum → Saison → Scene-Mapping für die TV-Tafel-Bühne (Migration 0071).
//
// Auto-Aktivierung: Dashboard ruft seasonsForDate(now) → SEASON_SCENES auf
// und kombiniert die Liste mit den vom Admin manuell zugefügten Scenes
// (additiv). Wenn der Admin `suppress_auto_season=true` setzt, gilt nur
// die manuelle Liste.
//
// Variable Daten (Ostern, Fasching, Muttertag, Vatertag) sind pro Jahr
// hartcodiert. Jährliches Update als Wartungs-Task → KALENDER_JAHRE-Tabelle
// am Ende der Datei erweitern.

export type SeasonName =
  | 'winter'
  | 'xmas'
  | 'silvester'
  | 'fasching'
  | 'oster'
  | 'fruehling'
  | 'sommer'
  | 'herbst'
  | 'halloween';

// Variable Feiertage pro Jahr (Sonntag-Datum für Ostern; Faschings-Dienstag).
// Vorausberechnete Werte für 2026, 2027, 2028 — danach erweitern.
type YearMap = { ostersonntag: string; faschingsdienstag: string };
const KALENDER_JAHRE: Record<number, YearMap> = {
  2026: { ostersonntag: '2026-04-05', faschingsdienstag: '2026-02-17' },
  2027: { ostersonntag: '2027-03-28', faschingsdienstag: '2027-02-09' },
  2028: { ostersonntag: '2028-04-16', faschingsdienstag: '2028-02-29' },
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Gibt alle aktuell aktiven Saisonen für ein Datum zurück.
 * Mehrere gleichzeitig möglich (z.B. 15.12. → ['winter','xmas']).
 */
export function seasonsForDate(d: Date): SeasonName[] {
  const m = d.getMonth() + 1; // 1-12
  const day = d.getDate();
  const year = d.getFullYear();
  const result: SeasonName[] = [];

  // ─── Jahreszeiten ───────────────────────────────────────────────────────
  // Astronomisch grobe Mappings, an Mitteleuropa orientiert.
  if (m === 12 || m === 1 || m === 2) result.push('winter');
  if (m === 3 || m === 4 || m === 5) result.push('fruehling');
  if (m === 6 || m === 7 || m === 8) result.push('sommer');
  if (m === 9 || m === 10 || m === 11) result.push('herbst');

  // ─── Halloween ──────────────────────────────────────────────────────────
  // Letzte Oktober-Woche bis 1.11.
  if ((m === 10 && day >= 24) || (m === 11 && day === 1)) result.push('halloween');

  // ─── Weihnachten ────────────────────────────────────────────────────────
  // 1.-26.12.
  if (m === 12 && day >= 1 && day <= 26) result.push('xmas');

  // ─── Silvester / Neujahr ────────────────────────────────────────────────
  // 27.12. - 6.1.
  if ((m === 12 && day >= 27) || (m === 1 && day <= 6)) result.push('silvester');

  // ─── Ostern (variabel) ──────────────────────────────────────────────────
  // 7 Tage vor Ostersonntag bis Ostermontag.
  const cal = KALENDER_JAHRE[year];
  if (cal) {
    const oster = new Date(cal.ostersonntag);
    const heute = new Date(ymd(d));
    const diffOster = daysBetween(heute, oster);
    if (diffOster >= -1 && diffOster <= 7) result.push('oster');

    // ─── Fasching ─────────────────────────────────────────────────────────
    // 4 Tage vor Faschingsdienstag bis Faschingsdienstag.
    const fasching = new Date(cal.faschingsdienstag);
    const diffFasching = daysBetween(heute, fasching);
    if (diffFasching >= 0 && diffFasching <= 4) result.push('fasching');
  }

  return result;
}

// Mapping Saison → Scene-IDs.
// Halten wir bewusst sparsam — Memory „Tiefe statt Dichte".
export const SEASON_SCENES: Record<SeasonName, string[]> = {
  winter: ['snow'],
  xmas: ['snow', 'xmas-lights', 'xmas-gifts', 'xmas-tree'],
  silvester: ['snow', 'sparkles'],
  fasching: ['sparkles'],
  oster: ['easter-eggs', 'easter-bunny'],
  fruehling: ['blossoms', 'butterflies'],
  sommer: ['parasols', 'dragonflies'],
  herbst: ['autumn-leaves'],
  halloween: ['pumpkins', 'ghosts', 'bats', 'spiders'],
};

// One-Click-Theme-Presets für den Admin-Button-Block.
// Setzen manual_scenes komplett + suppress_auto_season=true.
export const THEME_PRESETS: { id: string; label: string; emoji: string; scenes: string[] }[] = [
  { id: 'standard',      label: 'Standard (leer)',  emoji: '🪵',  scenes: [] },
  { id: 'winter',        label: 'Winter',           emoji: '❄️',  scenes: ['snow'] },
  { id: 'xmas',          label: 'Weihnachten',      emoji: '🎄',  scenes: ['snow', 'xmas-lights', 'xmas-gifts', 'xmas-tree'] },
  { id: 'silvester',     label: 'Silvester',        emoji: '✨',  scenes: ['snow', 'sparkles', 'night'] },
  { id: 'fasching',      label: 'Fasching',         emoji: '🎭',  scenes: ['sparkles'] },
  { id: 'oster',         label: 'Ostern',           emoji: '🐰',  scenes: ['easter-eggs', 'easter-bunny', 'blossoms'] },
  { id: 'fruehling',     label: 'Frühling',         emoji: '🌸',  scenes: ['blossoms', 'butterflies'] },
  { id: 'sommer',        label: 'Sommer-Fest',      emoji: '☀️',  scenes: ['parasols', 'dragonflies', 'butterflies'] },
  { id: 'herbst',        label: 'Herbst',           emoji: '🍂',  scenes: ['autumn-leaves'] },
  { id: 'halloween',     label: 'Halloween',        emoji: '🎃',  scenes: ['pumpkins', 'ghosts', 'bats', 'spiders', 'night'] },
  { id: 'nacht',         label: 'Nacht-Modus',      emoji: '🌙',  scenes: ['night'] },
  { id: 'wald-live',     label: 'Wald lebt',        emoji: '🌲',  scenes: ['holzfaeller', 'reh', 'playground'] },
];

// State-Form (aus DB, gespiegelt vom api.ts-Hook).
export type TvStageState = {
  manual_scenes: string[];
  suppress_auto_season: boolean;
  last_effect: { kind: string; triggered_at: string; nonce: string } | null;
};

/**
 * Liefert die aktuell aktiven Scene-IDs basierend auf Datum + DB-State.
 * - suppress_auto_season=true → nur manual_scenes
 * - sonst Union aus Auto-Saison + manual_scenes (deduped)
 */
export function activeScenesForState(d: Date, state: TvStageState | null | undefined): string[] {
  if (!state) return [];
  if (state.suppress_auto_season) return state.manual_scenes;

  const auto = new Set<string>();
  for (const season of seasonsForDate(d)) {
    for (const scene of SEASON_SCENES[season]) auto.add(scene);
  }
  for (const scene of state.manual_scenes) auto.add(scene);
  return Array.from(auto);
}

/**
 * Lesbarer String der aktuellen Auto-Saisonen, für den Admin-Header.
 * z.B. "🎄 Weihnachten + ❄️ Winter".
 */
const SEASON_DISPLAY: Record<SeasonName, { label: string; emoji: string }> = {
  winter:    { label: 'Winter',      emoji: '❄️' },
  xmas:      { label: 'Weihnachten', emoji: '🎄' },
  silvester: { label: 'Silvester',   emoji: '✨' },
  fasching:  { label: 'Fasching',    emoji: '🎭' },
  oster:     { label: 'Ostern',      emoji: '🐰' },
  fruehling: { label: 'Frühling',    emoji: '🌸' },
  sommer:    { label: 'Sommer',      emoji: '☀️' },
  herbst:    { label: 'Herbst',      emoji: '🍂' },
  halloween: { label: 'Halloween',   emoji: '🎃' },
};

export function currentSeasonLabel(d: Date): string {
  const seasons = seasonsForDate(d);
  if (seasons.length === 0) return 'Keine Saison';
  return seasons.map((s) => `${SEASON_DISPLAY[s].emoji} ${SEASON_DISPLAY[s].label}`).join(' + ');
}
