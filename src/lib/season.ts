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

// Ostersonntag algorithmisch (Gauß / Meeus-Jones-Butcher, gregorianisch) — damit
// die Oster- und Faschings-Saison ohne jährliche Wartung DAUERHAFT funktioniert.
// Vorher: KALENDER_JAHRE hartcodiert bis 2028 → ab 2029 lautlos keine Auto-Saison.
// Faschingsdienstag = Ostersonntag − 47 Tage.
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const mm = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * mm + 114) / 31); // 3 = März, 4 = April
  const day = ((h + l - 7 * mm + 114) % 31) + 1;
  return new Date(year, month - 1, day); // lokale Mitternacht
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

  // ─── Ostern (variabel, berechnet) ────────────────────────────────────────
  // 7 Tage vor Ostersonntag bis Ostermontag.
  const heute = new Date(d.getFullYear(), d.getMonth(), d.getDate()); // lokale Mitternacht
  const oster = easterSunday(year);
  const diffOster = daysBetween(heute, oster);
  if (diffOster >= -1 && diffOster <= 7) result.push('oster');

  // ─── Fasching ─────────────────────────────────────────────────────────
  // 4 Tage vor Faschingsdienstag (= Ostern − 47) bis Faschingsdienstag.
  const fasching = new Date(oster);
  fasching.setDate(fasching.getDate() - 47);
  const diffFasching = daysBetween(heute, fasching);
  if (diffFasching >= 0 && diffFasching <= 4) result.push('fasching');

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
  { id: 'wald-live',     label: 'Wald lebt',        emoji: '🌲',  scenes: ['schwarzwald-heim', 'holzfaeller', 'reh', 'playground'] },
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
