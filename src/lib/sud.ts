// Sudaufguss — Kräuter und fertige Mischungen, die im Sud auf die Steine kommen.
//
// SPEICHERUNG wie bei Schnaps und eigenen Ölen: NICHT in einer eigenen Spalte,
// sondern als `sud:<uuid>` bzw. `sudmix:<uuid>` innerhalb von
// `infusions.attributes[]`.
//
// Grund (siehe lib/schnaps.ts ausführlich): der Schreibpfad läuft über fünf
// SECURITY-DEFINER-RPCs. Ein zusätzlicher Parameter würde bei CREATE OR
// REPLACE eine ZWEITE Überladung anlegen statt die alte zu ersetzen —
// PostgREST antwortet dann mit "Could not choose the best candidate function".
// Über attributes[] funktionieren Kiosk, Banja, Personal-Übernahme und
// Vorlagen ohne eine Zeile SQL.
//
// Die Kräuter selbst liegen in den Tabellen sud_kraeuter / sud_mixe
// (Migration 0124) — gemeinsam für den ganzen Verein, nicht pro Aufgießer:
// ein Kräutervorrat steht im Regal und gehört nicht einer Person.

/** Eine Zutat aus dem gemeinsamen Regal.
 *
 *  `art` unterscheidet, WO sie landet: 'kraut' im Aufgusswasser,
 *  'raeucher' auf den Steinen. Beide liegen in derselben Tabelle und werden
 *  im Aufguss gleich referenziert ('sud:<uuid>') — ein zweites Praefix haette
 *  nichts hinzugefuegt, aber jeden Parser verdoppelt. */
export type ZutatArt = 'kraut' | 'raeucher';

export interface SudKraut {
  id: string;
  name: string;
  emoji: string;
  color: string;
  art: ZutatArt;
  created_by: string | null;
}

export interface SudMix {
  id: string;
  name: string;
  emoji: string;
  color: string;
  /** IDs aus sud_kraeuter, in Rezeptur-Reihenfolge. */
  kraeuter: string[];
  created_by: string | null;
}

export const SUD_PREFIX = 'sud:';
export const SUDMIX_PREFIX = 'sudmix:';

export function sudAttrId(id: string): string { return SUD_PREFIX + id; }
export function sudMixAttrId(id: string): string { return SUDMIX_PREFIX + id; }

export function parseSudAttr(attr: string): string | null {
  // Reihenfolge beachten: 'sudmix:' beginnt NICHT mit 'sud:' (kein Doppelpunkt
  // an Position 3), deshalb ist die Prüfung eindeutig — trotzdem zuerst den
  // längeren Präfix testen, damit eine spätere Umbenennung nicht stillschweigend
  // die falsche Zuordnung liefert.
  if (attr.startsWith(SUDMIX_PREFIX)) return null;
  return attr.startsWith(SUD_PREFIX) ? attr.slice(SUD_PREFIX.length) : null;
}

export function parseSudMixAttr(attr: string): string | null {
  return attr.startsWith(SUDMIX_PREFIX) ? attr.slice(SUDMIX_PREFIX.length) : null;
}

/** Alle Sud-Einträge eines Aufgusses — Einzelkräuter und Mischungen getrennt. */
export function sudFromAttributes(attrs: readonly string[] | null | undefined): {
  kraeuter: string[];
  mixe: string[];
} {
  const kraeuter: string[] = [];
  const mixe: string[] = [];
  for (const a of attrs ?? []) {
    const k = parseSudAttr(a);
    if (k) { kraeuter.push(k); continue; }
    const m = parseSudMixAttr(a);
    if (m) mixe.push(m);
  }
  return { kraeuter, mixe };
}

/** Hat dieser Aufguss überhaupt einen Sud? */
export function hasSud(attrs: readonly string[] | null | undefined): boolean {
  return (attrs ?? []).some((a) => a.startsWith(SUD_PREFIX) || a.startsWith(SUDMIX_PREFIX));
}

/** Entfernt alle Sud-Einträge — Gegenstück zu sudFromAttributes, damit die
 *  Einträge nicht zusätzlich als unbekannte Besonderheiten-Pille erscheinen. */
export function stripSudAttrs(attrs: readonly string[]): string[] {
  return attrs.filter((a) => !a.startsWith(SUD_PREFIX) && !a.startsWith(SUDMIX_PREFIX));
}

/** Wie viele Auswahl-Plätze belegt der Sud? Zählt wie ein Öl in die 3–8-Regel
 *  (User-Entscheidung 08.08.2026): eine Mischung ist EIN Platz, egal aus wie
 *  vielen Kräutern sie besteht — sonst wäre ein guter Sud allein am Limit. */
export function sudAnzahl(attrs: readonly string[] | null | undefined): number {
  const { kraeuter, mixe } = sudFromAttributes(attrs);
  return kraeuter.length + mixe.length;
}
