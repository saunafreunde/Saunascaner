// Die Saunafeste der Saison 2026/27 — jeweils am zweiten Samstag im Monat.
//
// Eine Liste statt sechs verstreuter Stellen: dieselben Termine stehen im
// Tafel-Video (public/tafel/saunafeste.mp4, dort eingebrannt) und im
// Tagesabschluss-Screen. Ändert sich ein Termin, ist das hier die eine Stelle
// für alles, was die App selbst rendert — das Video muss dann neu gerendert
// werden (Anleitung in _ablage/saunascaner/saunafest-video/README.md).
//
// Diese Liste ist die ANZEIGE-Fassung (Tafel-Video, Tagesabschluss). Seit
// Migration 0150 gibt es dieselben Termine auch in der Tabelle
// `saunafest_tage` — die ist die Quelle für alles, was plant und sperrt
// (Planer-Matrix mit dritter Sauna, Garantie-Slots erst ab 14 Uhr,
// useSaunafestTage() in lib/api.ts). Beide müssen übereinstimmen; wer hier
// einen Termin ändert, ändert ihn auch dort.

export type Saunafest = {
  /** ISO-Datum (Europe/Berlin), immer ein Samstag. */
  datum: string;
  /** Kurzes Motto, passend zur Jahreszeit. */
  motto: string;
};

export const SAUNAFESTE: Saunafest[] = [
  { datum: '2026-10-10', motto: 'Laubfeuer' },
  { datum: '2026-11-14', motto: 'Nebelabend' },
  { datum: '2026-12-12', motto: 'Kerzenlicht' },
  { datum: '2027-01-09', motto: 'Raureif' },
  { datum: '2027-02-13', motto: 'Zu zweit' },
  { datum: '2027-03-13', motto: 'Letzter Schnee' },
];

/** So läuft jedes Fest ab — steht wortgleich auch im Tafel-Video. */
export const FEST_ABLAUF = {
  ganztags: 'Wir heizen den ganzen Tag',
  ab14: 'ab 14 Uhr Aufgüsse in 2 Saunen',
  ab17: 'ab 17 Uhr in 3 Saunen',
} as const;

/** Das nächste Fest ab `jetzt` — der laufende Tag zählt noch mit, damit die
 *  Ankündigung am Festtag selbst nicht schon auf den Folgemonat springt.
 *  `null`, wenn die Saison vorbei ist: dann zeigt der Aufrufer nichts an,
 *  statt einen vergangenen Termin zu bewerben. */
export function naechstesFest(jetzt: Date): Saunafest | null {
  const heute = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-${String(jetzt.getDate()).padStart(2, '0')}`;
  return SAUNAFESTE.find((f) => f.datum >= heute) ?? null;
}

/** „Samstag, 10. Oktober" — Jahr nur, wenn es ein anderes als das laufende ist. */
export function festLabel(fest: Saunafest, jetzt: Date): string {
  const d = new Date(`${fest.datum}T12:00:00`);
  const monate = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const jahr = d.getFullYear() === jetzt.getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `Samstag, ${d.getDate()}. ${monate[d.getMonth()]}${jahr}`;
}

/** Tage bis zum Fest, 0 = heute. */
export function tageBis(fest: Saunafest, jetzt: Date): number {
  const ziel = new Date(`${fest.datum}T00:00:00`);
  const heute = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
  return Math.round((ziel.getTime() - heute.getTime()) / 86_400_000);
}
