// Mirror der SQL-Funktionen garantie_sauna_for / garantie_temperature_for
// (Migration 0030) für Client-Side-Anzeige. SQL bleibt Single Source of Truth
// für tatsächliche Datenintegrität — diese Datei wird nur zur UI-Anzeige
// genutzt (z.B. "11:00 · 80°C garantiert").

// Wochentag-Konvention: Postgres extract(dow) = JS Date.getDay():
//   0=So, 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa

// In Berlin: Slots werden im lokalen Time zu Stunden 11-20 ausgegeben.
// Wir nutzen hier die Browser-Lokale Date.getDay()/getHours() — geht davon
// aus dass der User in Europe/Berlin sitzt (TV/Vereinsbetrieb).

export function garantieTemperatureFor(date: Date): 80 | 100 | null {
  const dow = date.getDay();
  const hour = date.getHours();

  if (dow === 1) return null;

  if (dow === 5) {
    if (hour >= 11 && hour <= 13) return 80;
    if (hour < 14 || hour > 20) return null;
    return ((hour - 14) % 2 === 0) ? 100 : 80;
  }

  const startHour = (dow >= 2 && dow <= 4) ? 14 : 11;
  if (hour < startHour || hour > 20) return null;
  return ((hour - startHour) % 2 === 0) ? 80 : 100;
}

export function isGarantieSlot(date: Date): boolean {
  return garantieTemperatureFor(date) !== null;
}

// Hilfsfunktion: alle Slot-Stunden eines Wochentags (für UI-Default + Sperr-Check)
export function slotHoursForWeekday(weekday: number): number[] {
  if (weekday === 1) return [];
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
