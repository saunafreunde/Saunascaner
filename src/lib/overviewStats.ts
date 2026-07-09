import type { Infusion } from '@/types/database';
import type { MeisterDirectoryEntry } from '@/lib/api';
import { OIL_BY_ID } from '@/lib/oils';
import { ATTR_BY_ID, type InfusionAttribute } from '@/lib/attributes';
import type { EndOfDayPdfData } from '@/lib/endOfDayPdf';

// Aggregiert Aufgüsse eines Zeitraums zu den „Feierabend"-PDF-Daten.
// Exakt dieselbe Logik wie im Tagesabschluss (EndOfDayScreen) — nur ohne
// Tages-Filter, damit sie für Tag/Woche/Monat wiederverwendbar ist.

const MAX_MEISTERS = 12;
const MAX_OILS = 12;
const MAX_ATTRS = 12;

export type OverviewAggregate = Pick<
  EndOfDayPdfData,
  'totalAufguesse' | 'teamCount' | 'meisters' | 'topOils' | 'topAttrs'
>;

export function aggregateOverview(
  infusions: Infusion[],
  meisterDir: MeisterDirectoryEntry[],
): OverviewAggregate {
  // Personal-Fallback-Aufgüsse zählen nicht als echte Aufgießer-Leistung.
  const infs = infusions.filter((i) => !i.is_personal_fallback);

  // ── Aufgießer (Anzahl pro Person) ──
  const mMap = new Map<string, { count: number; entry: MeisterDirectoryEntry }>();
  for (const i of infs) {
    if (!i.saunameister_id) continue;
    const entry = meisterDir.find((m) => m.id === i.saunameister_id);
    if (!entry) continue;
    const cur = mMap.get(entry.id) ?? { count: 0, entry };
    cur.count += 1;
    mMap.set(entry.id, cur);
  }
  const meisters = [...mMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_MEISTERS)
    .map(({ entry, count }) => ({ name: entry.name, saunaName: entry.sauna_name, count }));

  // ── Öle ──
  const oMap = new Map<string, number>();
  for (const i of infs) {
    for (const o of i.oils ?? []) {
      if (o) oMap.set(o, (oMap.get(o) ?? 0) + 1);
    }
  }
  const topOils = [...oMap.entries()]
    .map(([id, count]) => ({ count, meta: OIL_BY_ID[id] }))
    .filter((x) => !!x.meta)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_OILS)
    .map((o) => ({ name: o.meta!.name, emoji: o.meta!.emoji, number: o.meta!.number, count: o.count }));

  // ── Besonderheiten ──
  const aMap = new Map<string, number>();
  for (const i of infs) {
    for (const a of i.attributes ?? []) {
      aMap.set(a, (aMap.get(a) ?? 0) + 1);
    }
  }
  const topAttrs = [...aMap.entries()]
    .map(([id, count]) => ({ count, meta: ATTR_BY_ID[id as InfusionAttribute] }))
    .filter((x) => !!x.meta)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_ATTRS)
    .map((a) => ({ label: a.meta!.label, emoji: a.meta!.emoji, count: a.count }));

  return {
    totalAufguesse: infs.length,
    teamCount: infs.filter((i) => i.team_infusion).length,
    meisters,
    topOils,
    topAttrs,
  };
}
