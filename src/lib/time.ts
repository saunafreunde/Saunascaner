import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { formatInTimeZone } from 'date-fns-tz';
import { isSameDay, addDays } from 'date-fns';
import { de } from 'date-fns/locale';

export const TZ = 'Europe/Berlin';

export const fmtClock = (d: Date | string) => formatInTimeZone(d, TZ, 'HH:mm');
export const fmtDate  = (d: Date | string) => formatInTimeZone(d, TZ, 'dd.MM.yyyy');

// date-fns-tz v3.x reicht die `locale`-Option in formatInTimeZone NICHT zuverlässig
// durch — englische Wochentage erscheinen. Stattdessen: erst in Berliner Zeit
// konvertieren, dann mit format + locale aus date-fns korrekt formatieren.
function fmtZonedDe(d: Date | string, pattern: string): string {
  return format(toZonedTime(d, TZ), pattern, { locale: de });
}

// Lang-Datum auf Deutsch: „Montag 18. Mai 2026"
export const fmtDateLongDe = (d: Date | string) => fmtZonedDe(d, "EEEE d. MMMM yyyy");

export function dayLabel(d: Date | string, now: Date = new Date()): 'heute' | 'morgen' | string {
  const local = toZonedTime(d, TZ);
  const today = toZonedTime(now, TZ);
  if (isSameDay(local, today)) return 'heute';
  if (isSameDay(local, addDays(today, 1))) return 'morgen';
  return fmtZonedDe(d, 'EEEE');
}

// Letzter HH:05-Zeitpunkt <= now (Tafel-Rotationsgrenze).
// now=14:30 -> 14:05; now=15:04 -> 14:05; now=15:05 -> 15:05.
export function getHourlyRotationBoundary(now: Date): Date {
  const b = new Date(now);
  b.setSeconds(0, 0);
  if (b.getMinutes() >= 5) {
    b.setMinutes(5);
  } else {
    b.setHours(b.getHours() - 1);
    b.setMinutes(5);
  }
  return b;
}
