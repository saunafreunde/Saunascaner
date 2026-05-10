import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { isSameDay, addDays } from 'date-fns';

export const TZ = 'Europe/Berlin';

export const fmtClock = (d: Date | string) => formatInTimeZone(d, TZ, 'HH:mm');
export const fmtDate  = (d: Date | string) => formatInTimeZone(d, TZ, 'dd.MM.yyyy');

export function dayLabel(d: Date | string, now: Date = new Date()): 'heute' | 'morgen' | string {
  const local = toZonedTime(d, TZ);
  const today = toZonedTime(now, TZ);
  if (isSameDay(local, today)) return 'heute';
  if (isSameDay(local, addDays(today, 1))) return 'morgen';
  return formatInTimeZone(d, TZ, 'EEEE');
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
