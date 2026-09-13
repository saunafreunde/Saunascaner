// Spiegel von saunafest_slots() (Migration 0152). SQL bleibt Single Source
// of Truth — diese Datei dient nur der Anzeige im Planer und im Admin-Reiter.
//
// Am Fest läuft ein Raster zur halben Stunde, ein Aufguss je Sauna und
// Stunde: erster_slot … letzter_slot (10:30 … 23:30). Vor ab_beide ist je
// Stunde nur EINE Sauna dran, im Wechsel 80 °C / 100 °C beginnend mit 80 °C;
// ab ab_beide beide; ab ab_alle zusätzlich die dritte (90 °C).

import type { Sauna } from '@/types/database';
import type { SaunafestTag } from '@/lib/api';

export type FestSlot = { zeit: string; saunaIds: string[] };

/** Postgres `time` ('10:30:00') → 'HH:MM', wie die Slot-Strings im Planer. */
export function hhmm(t: string): string {
  return t.slice(0, 5);
}

function minuten(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function festSlots(fest: SaunafestTag, saunas: Sauna[]): FestSlot[] {
  const s80 = saunas.find((s) => s.temperature_label === '80°C' && s.is_active)?.id ?? null;
  const s100 = saunas.find((s) => s.temperature_label === '100°C' && s.is_active)?.id ?? null;
  const dritte = fest.dritte_sauna_id;
  const ende = minuten(fest.letzter_slot);
  const beide = minuten(fest.ab_beide);
  const alle = minuten(fest.ab_alle);
  const out: FestSlot[] = [];
  let t = minuten(fest.erster_slot);
  for (let i = 0; t <= ende && i < 48; i++, t += 60) {
    const zeit = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    const ids: string[] = [];
    if (t < beide) {
      const id = i % 2 === 0 ? s80 : s100;
      if (id) ids.push(id);
    } else {
      if (s80) ids.push(s80);
      if (s100) ids.push(s100);
      if (t >= alle && dritte) ids.push(dritte);
    }
    if (ids.length) out.push({ zeit, saunaIds: ids });
  }
  return out;
}

/** Alle Uhrzeiten des Plans, je einmal — die Zeilen der Matrix. */
export function festZeiten(plan: FestSlot[]): string[] {
  return plan.map((s) => s.zeit);
}

export function festSlotOffen(plan: FestSlot[], zeit: string, saunaId: string): boolean {
  return plan.some((s) => s.zeit === zeit && s.saunaIds.includes(saunaId));
}

/** Welche Saunen zu dieser Uhrzeit dran sind (für den Hinweis an geschlossenen Kacheln). */
export function festSaunenUm(plan: FestSlot[], zeit: string): string[] {
  return plan.find((s) => s.zeit === zeit)?.saunaIds ?? [];
}

/** „10:30–23:30 Uhr · bis 13:30 eine Sauna im Wechsel · ab 14:30 zwei · ab 17:30 alle drei" */
export function festAblaufText(fest: SaunafestTag): string {
  return `${hhmm(fest.erster_slot)}–${hhmm(fest.letzter_slot)} Uhr · bis ${hhmm(fest.ab_beide)} eine Sauna im Wechsel · ab ${hhmm(fest.ab_beide)} zwei · ab ${hhmm(fest.ab_alle)} alle drei`;
}
