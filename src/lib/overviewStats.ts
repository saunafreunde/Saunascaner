import type { Infusion } from '@/types/database';
import type { MeisterDirectoryEntry } from '@/lib/api';
import { OIL_BY_ID } from '@/lib/oils';
import { ATTR_BY_ID, type InfusionAttribute } from '@/lib/attributes';
import type { EndOfDayPdfData } from '@/lib/endOfDayPdf';

// Aggregiert Aufgüsse eines Zeitraums zu den „Feierabend"-PDF-Daten.
// Exakt dieselbe Logik wie im Tagesabschluss (EndOfDayScreen) — nur ohne
// Tages-Filter, damit sie für Tag/Woche/Monat wiederverwendbar ist.
//
// Seit 16.08.2026 zählt bei einem Team-Aufguss jeder Beteiligte einzeln:
// drei Wedelnde ergeben drei Einträge in der Aufgießer-Liste, aber weiterhin
// nur einen Aufguss in `totalAufguesse`. Die Datenbank rechnet in der View
// `aufguss_beteiligung` genauso (Migr. 0141).

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
  coEintraege: { infusion_id: string; member_id: string }[] = [],
): OverviewAggregate {
  // Der interne Export zählt ALLE Aufgüsse — auch die ohne zuordenbare
  // Person (Vorgabe 16.08.2026). Vorher fielen die Personal-Aufgüsse hier
  // heraus und die Gesamtzahl war stillschweigend zu niedrig.
  //
  // Nicht zuordenbare Aufgüsse landen in zwei Sammelposten am Ende der
  // Aufgießer-Liste, getrennt gehalten, weil sie Verschiedenes bedeuten:
  //   • „Nicht zugeordnet"   — vom Personal gehalten, normaler Betrieb
  //   • „Übertragungsfehler" — Person fehlt, obwohl sie da sein müsste
  //     (z. B. weil ein Mitglied gelöscht wurde); ein Datenproblem, das
  //     sichtbar bleiben soll, statt in einer Sammelzahl zu verschwinden.
  //
  // Feed und TV-Tafel bleiben davon unberührt: dort zählt weiterhin nur,
  // was einer Person gehört.
  //
  // ⚠️ Nur was schon stattgefunden hat. Der Planer legt acht Wochen im
  // Voraus Platzhalter an, die noch keinem Aufgießer gehören und als
  // Personal-Aufguss geführt werden — im August waren das 96 von 98. Ohne
  // diesen Filter meldet der Export für den laufenden Monat lauter Aufgüsse,
  // die erst noch kommen. (Der Fehler steckte vorher schon drin, betraf aber
  // nur die wenigen künftigen Aufgüsse mit Aufgießer und fiel deshalb nicht
  // auf.)
  const jetzt = Date.now();
  const infs = infusions.filter((i) => new Date(i.start_time).getTime() < jetzt);
  const personalAufguesse = infs.filter((i) => i.is_personal_fallback).length;
  const ohneZuordnung = infs.filter(
    (i) => !i.is_personal_fallback && !i.saunameister_id,
  ).length;

  // Mitwedler je Aufguss, damit die Zählung unten nicht für jeden Aufguss
  // die ganze Liste durchsuchen muss.
  const coJeAufguss = new Map<string, string[]>();
  for (const c of coEintraege) {
    const bisher = coJeAufguss.get(c.infusion_id);
    if (bisher) bisher.push(c.member_id);
    else coJeAufguss.set(c.infusion_id, [c.member_id]);
  }

  // ── Aufgießer (Anzahl pro Person, Mitwedler eingeschlossen) ──
  const mMap = new Map<string, { count: number; entry: MeisterDirectoryEntry }>();
  for (const i of infs) {
    // Set, damit jemand, der zugleich Verantwortlicher und Co-Eintrag ist,
    // für denselben Aufguss nur einmal zählt.
    const beteiligte = new Set<string>();
    if (i.saunameister_id) beteiligte.add(i.saunameister_id);
    for (const id of coJeAufguss.get(i.id) ?? []) beteiligte.add(id);

    for (const memberId of beteiligte) {
      const entry = meisterDir.find((m) => m.id === memberId);
      if (!entry) continue;
      const cur = mMap.get(entry.id) ?? { count: 0, entry };
      cur.count += 1;
      mMap.set(entry.id, cur);
    }
  }
  const meisters: OverviewAggregate['meisters'] = [...mMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_MEISTERS)
    .map(({ entry, count }) => ({ name: entry.name, saunaName: entry.sauna_name, count }));

  // Sammelposten ans Ende, nicht in die Sortierung: „Nicht zugeordnet" hat
  // oft mehr Aufgüsse als jede einzelne Person und würde die Bestenliste
  // sonst anführen.
  if (personalAufguesse > 0) {
    meisters.push({
      name: 'Nicht zugeordnet', saunaName: null, count: personalAufguesse, sammelposten: true,
    });
  }
  if (ohneZuordnung > 0) {
    meisters.push({
      name: 'Übertragungsfehler', saunaName: null, count: ohneZuordnung, sammelposten: true,
    });
  }

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
