import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { TZ } from './time';

// Rolen-spezifischer Bewertungs-Deadline — Single Source of Truth für UI,
// synchron mit submit_rating() / get_ratable_infusions() (Migration 0082):
//   • Aufgießer: end_time + 3h
//   • Andere (Gast/Fan/Helfer/Staff/CP/Admin): Folgetag 12:00 Uhr in Berlin-Zeit
export function computeRatingWindowClose(startTimeIso: string, endTimeIso: string, isAufg: boolean): Date {
  if (isAufg) return new Date(new Date(endTimeIso).getTime() + 3 * 60 * 60 * 1000);
  const startBerlin = toZonedTime(startTimeIso, TZ);
  const dayPlus1NoonWall = new Date(
    startBerlin.getFullYear(),
    startBerlin.getMonth(),
    startBerlin.getDate() + 1,
    12, 0, 0, 0,
  );
  return fromZonedTime(dayPlus1NoonWall, TZ);
}
