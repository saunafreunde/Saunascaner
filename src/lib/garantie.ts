// Mirror der SQL-Funktionen garantie_sauna_for / garantie_temperature_for
// (Migration 0030, erweitert in 0083 um monday_open). SQL bleibt Single
// Source of Truth — diese Datei wird nur zur UI-Anzeige genutzt.
//
// Wochentag-Konvention: Postgres extract(dow) = JS Date.getDay():
//   0=So, 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa
//
// In Berlin: Slots werden im lokalen Time zu Stunden 11-20 ausgegeben.
// Wir nutzen hier die Browser-Lokale Date.getDay()/getHours() — geht davon
// aus dass der User in Europe/Berlin sitzt (TV/Vereinsbetrieb).

export type GarantieOpts = {
  /** Wenn true: Montag wird wie Sa/So behandelt (11-20, alternierend startend mit 80°C).
   *  Default: false (Mo ist Ruhetag). Settings via useScheduleSettings(). */
  mondayOpen?: boolean;
};

export function garantieTemperatureFor(date: Date, opts: GarantieOpts = {}): 80 | 100 | null {
  const dow = date.getDay();
  const hour = date.getHours();
  const mondayOpen = opts.mondayOpen ?? false;

  if (dow === 1) {
    if (!mondayOpen) return null;
    // Mo offen → wie Sa/So
    if (hour < 11 || hour > 20) return null;
    return ((hour - 11) % 2 === 0) ? 80 : 100;
  }

  if (dow === 5) {
    if (hour >= 11 && hour <= 13) return 80;
    if (hour < 14 || hour > 20) return null;
    return ((hour - 14) % 2 === 0) ? 100 : 80;
  }

  const startHour = (dow >= 2 && dow <= 4) ? 14 : 11;
  if (hour < startHour || hour > 20) return null;
  return ((hour - startHour) % 2 === 0) ? 80 : 100;
}

export function isGarantieSlot(date: Date, opts: GarantieOpts = {}): boolean {
  return garantieTemperatureFor(date, opts) !== null;
}

// Hilfsfunktion: alle Slot-Stunden eines Wochentags (für UI-Default + Sperr-Check).
// Bei Mo + mondayOpen=true → wie Sa/So (11-20).
export function slotHoursForWeekday(weekday: number, opts: GarantieOpts = {}): number[] {
  const mondayOpen = opts.mondayOpen ?? false;
  if (weekday === 1) {
    return mondayOpen ? [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] : [];
  }
  if (weekday >= 2 && weekday <= 4) {
    return [14, 15, 16, 17, 18, 19, 20];
  }
  return [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
}

export const WEEKDAY_LABEL_DE: Record<number, string> = {
  0: 'Sonntag',
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
};

export const WEEKDAY_LABEL_DE_SHORT: Record<number, string> = {
  0: 'So', 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa',
};
