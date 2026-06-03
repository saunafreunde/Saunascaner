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
  /** Wenn true: Tag wird wie Sa/So behandelt — erster Aufguss ab 11:00 statt
   *  erst 14:00 (auch wenn der Tag ein Di/Mi/Do/Mo wäre). Caller liefert das
   *  pro Datum via useHolidays()-Lookup. Migration 0113, 30.05.2026. */
  isHoliday?: boolean;
};

// Normale Vereins-Aufgusszeiten:
//   • Di/Mi/Do: 14–20 Uhr (7 Slots)
//   • Fr/Sa/So: 11–20 Uhr (10 Slots)
//   • Mo: geschlossen (außer mondayOpen=true → wie Sa/So 11–20)
//   • Fr-Spezial: 11/12/13 immer 80°C
//   • Feiertag: wie Sa/So (11–20), unabhängig vom Wochentag — überschreibt
//     mondayOpen + Di/Mi/Do-Spätstart. Fr-Spezial bleibt erhalten wenn der
//     Feiertag zufällig auf einen Fr fällt.
const LAST_SLOT_HOUR = 20;
const DITHU_START_HOUR = 14;

export function garantieTemperatureFor(date: Date, opts: GarantieOpts = {}): 80 | 100 | null {
  const dow = date.getDay();
  const hour = date.getHours();
  const mondayOpen = opts.mondayOpen ?? false;
  const isHoliday = opts.isHoliday ?? false;

  // Feiertag (Vorrang): wie Sa/So ab 11:00. Fr-Spezial-Logik (siehe unten)
  // greift weiterhin wenn der Feiertag auf einen Fr fällt.
  if (isHoliday && dow !== 5) {
    if (hour < 11 || hour > LAST_SLOT_HOUR) return null;
    return ((hour - 11) % 2 === 0) ? 80 : 100;
  }

  if (dow === 1) {
    if (!mondayOpen) return null;
    // Mo offen → wie Sa/So
    if (hour < 11 || hour > LAST_SLOT_HOUR) return null;
    return ((hour - 11) % 2 === 0) ? 80 : 100;
  }

  if (dow === 5) {
    if (hour >= 11 && hour <= 13) return 80;
    if (hour < 14 || hour > LAST_SLOT_HOUR) return null;
    return ((hour - 14) % 2 === 0) ? 100 : 80;
  }

  const startHour = (dow >= 2 && dow <= 4) ? DITHU_START_HOUR : 11;
  if (hour < startHour || hour > LAST_SLOT_HOUR) return null;
  return ((hour - startHour) % 2 === 0) ? 80 : 100;
}

export function isGarantieSlot(date: Date, opts: GarantieOpts = {}): boolean {
  return garantieTemperatureFor(date, opts) !== null;
}

// Hilfsfunktion: alle Slot-Stunden eines Wochentags (für UI-Default + Sperr-Check).
// Bei Mo + mondayOpen=true → wie Sa/So. Bei isHoliday=true → 11-20 (überschreibt alles).
export function slotHoursForWeekday(weekday: number, opts: GarantieOpts = {}): number[] {
  const mondayOpen = opts.mondayOpen ?? false;
  const isHoliday = opts.isHoliday ?? false;
  // 11..20 = [11, 12, ..., 20] = 10 Slots (Fr/Sa/So + Mo wenn offen + jeder Feiertag)
  const elevenToTwenty = Array.from({ length: LAST_SLOT_HOUR - 11 + 1 }, (_, i) => 11 + i);
  // 14..20 = [14, 15, ..., 20] = 7 Slots (Di/Mi/Do)
  const dithuHours = Array.from({ length: LAST_SLOT_HOUR - DITHU_START_HOUR + 1 }, (_, i) => DITHU_START_HOUR + i);

  // Feiertag überschreibt: 11-20 (auch wenn Mo/Di/Mi/Do)
  if (isHoliday) return elevenToTwenty;

  if (weekday === 1) {
    return mondayOpen ? elevenToTwenty : [];
  }
  if (weekday >= 2 && weekday <= 4) {
    return dithuHours;
  }
  return elevenToTwenty;
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
