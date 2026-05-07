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
