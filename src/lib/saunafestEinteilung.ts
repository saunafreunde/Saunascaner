// Einteilungs-Vorschlag fürs Saunafest (Admin-Reiter „Saunafest", Migration 0163).
//
// Eingaben: das Festraster (Uhrzeit × Sauna), die Zeiträume der Eingetragenen
// und was schon eingeteilt ist. Ausgabe: je noch freier Kachel ein Vorschlag —
// der Admin übernimmt einzeln oder alle auf einmal; eingeteilt wird erst dann.
//
// Regeln (hart):
//   - nur wer um diese Uhrzeit Zeit hat (von ≤ zeit ≤ bis)
//   - niemand in zwei Saunen zur selben Uhrzeit
//   - nie mehr Aufgüsse als die eigene Höchstzahl (null = keine Grenze)
// Vorlieben (weich, als Punkte):
//   - Lieblingssauna +3, „egal" +1
//   - wer schon Aufgüsse hat, kommt später dran (−2 je Aufguss) — gerecht verteilt
//   - direkt davor oder danach schon eingeteilt −3 (Pause zwischen zwei Aufgüssen)
// Reihenfolge: zuerst die Kachel mit den WENIGSTEN Kandidaten (am schwersten zu
// besetzen), damit knappe Uhrzeiten nicht leer bleiben, weil ihre einzigen
// Leute schon anderswo verplant sind. Gleichstand → frühere Uhrzeit, dann
// Saunen-Reihenfolge des Plans; Personen-Gleichstand → member_id (stabil).

import type { FestSlot } from '@/lib/saunafestPlan';

export type Zeitfenster = {
  member_id: string;
  von: string;                       // 'HH:MM' oder 'HH:MM:SS'
  bis: string;
  lieblings_sauna_id: string | null;
  max_aufguesse: number | null;
};

export type Einteilung = { zeit: string; sauna_id: string; member_id: string };

function minuten(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Hat diese Person um `zeit` Zeit? */
export function hatZeit(f: Pick<Zeitfenster, 'von' | 'bis'>, zeit: string): boolean {
  const z = minuten(zeit);
  return minuten(f.von) <= z && z <= minuten(f.bis);
}

type Stand = {
  proZeit: Map<number, Set<string>>;    // Minute → member_ids, die dann schon aufgießen
  anzahl: Map<string, number>;          // member_id → Aufgüsse gesamt
};

function standAus(bestehend: Einteilung[]): Stand {
  const proZeit = new Map<number, Set<string>>();
  const anzahl = new Map<string, number>();
  for (const e of bestehend) {
    const z = minuten(e.zeit);
    if (!proZeit.has(z)) proZeit.set(z, new Set());
    proZeit.get(z)!.add(e.member_id);
    anzahl.set(e.member_id, (anzahl.get(e.member_id) ?? 0) + 1);
  }
  return { proZeit, anzahl };
}

function punkte(f: Zeitfenster, saunaId: string, zeit: string, stand: Stand): number {
  const z = minuten(zeit);
  let p = 0;
  if (f.lieblings_sauna_id === saunaId) p += 3;
  else if (f.lieblings_sauna_id === null) p += 1;
  p -= 2 * (stand.anzahl.get(f.member_id) ?? 0);
  if (stand.proZeit.get(z - 60)?.has(f.member_id) || stand.proZeit.get(z + 60)?.has(f.member_id)) p -= 3;
  return p;
}

/** Wer käme für diese Kachel in Frage? Beste zuerst. */
export function kandidaten(
  zeit: string, saunaId: string, fenster: Zeitfenster[], bestehend: Einteilung[],
): Zeitfenster[] {
  return kandidatenMitStand(zeit, saunaId, fenster, standAus(bestehend));
}

function kandidatenMitStand(zeit: string, saunaId: string, fenster: Zeitfenster[], stand: Stand): Zeitfenster[] {
  const z = minuten(zeit);
  const belegt = stand.proZeit.get(z);
  return fenster
    .filter((f) => hatZeit(f, zeit))
    .filter((f) => !belegt?.has(f.member_id))
    .filter((f) => f.max_aufguesse == null || (stand.anzahl.get(f.member_id) ?? 0) < f.max_aufguesse)
    .map((f) => ({ f, p: punkte(f, saunaId, zeit, stand) }))
    .sort((a, b) => b.p - a.p || (a.f.member_id < b.f.member_id ? -1 : a.f.member_id > b.f.member_id ? 1 : 0))
    .map((x) => x.f);
}

/**
 * Vorschlag für alle noch freien Kacheln. `bestehend` = schon eingeteilte
 * Aufgüsse (mit Person); `belegt` = Kacheln, die schon einen Aufguss haben
 * (auch ohne bekannte Person) und darum nicht vorgeschlagen werden.
 */
export function einteilungsVorschlag(
  plan: FestSlot[],
  fenster: Zeitfenster[],
  bestehend: Einteilung[],
  belegt: { zeit: string; sauna_id: string }[] = bestehend,
): Einteilung[] {
  const stand = standAus(bestehend);
  const zu = new Set(belegt.map((b) => `${minuten(b.zeit)}|${b.sauna_id}`));
  const offen: { zeit: string; sauna_id: string; rang: number }[] = [];
  let rang = 0;
  for (const s of plan) {
    for (const id of s.saunaIds) {
      if (!zu.has(`${minuten(s.zeit)}|${id}`)) offen.push({ zeit: s.zeit, sauna_id: id, rang: rang++ });
    }
  }

  const vorschlag: Einteilung[] = [];
  while (offen.length > 0) {
    let besteI = -1;
    let besteK: Zeitfenster[] = [];
    let bestePunkte = -Infinity;
    for (let i = 0; i < offen.length; i++) {
      const k = kandidatenMitStand(offen[i].zeit, offen[i].sauna_id, fenster, stand);
      if (k.length === 0) continue;
      // Bei gleich knappen Kacheln gewinnt die, deren bester Kandidat am besten
      // passt — sonst landet die Lieblingssauna-Person in der erstbesten Sauna
      // derselben Uhrzeit (Test: Carla bekam die Kelo statt der Finnischen).
      const p = punkte(k[0], offen[i].sauna_id, offen[i].zeit, stand);
      if (besteI === -1 || k.length < besteK.length
          || (k.length === besteK.length && (p > bestePunkte
              || (p === bestePunkte && offen[i].rang < offen[besteI].rang)))) {
        besteI = i;
        besteK = k;
        bestePunkte = p;
      }
    }
    if (besteI === -1) break;               // keine Kachel mehr besetzbar
    const kachel = offen[besteI];
    const wer = besteK[0];
    const e = { zeit: kachel.zeit, sauna_id: kachel.sauna_id, member_id: wer.member_id };
    vorschlag.push(e);
    const z = minuten(e.zeit);
    if (!stand.proZeit.has(z)) stand.proZeit.set(z, new Set());
    stand.proZeit.get(z)!.add(e.member_id);
    stand.anzahl.set(e.member_id, (stand.anzahl.get(e.member_id) ?? 0) + 1);
    offen.splice(besteI, 1);
  }
  return vorschlag.sort((a, b) => minuten(a.zeit) - minuten(b.zeit));
}
