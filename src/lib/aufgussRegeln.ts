// Die Regeln, nach denen ein Aufguss zusammengestellt wird — an EINER Stelle.
//
// Vorher standen sie als lokale Konstanten mitten in Planner.tsx. Damit konnten
// weder der Öl-Raum-Kiosk noch das Bearbeiten-Fenster sie erben: ein Import von
// Route zu Route hätte den kompletten Planner-Baum ins Tablet-Bundle gezogen
// UND eine Zyklus-Kante geschaffen — bei der bleibt `tsc` grün und die App wird
// weiß (siehe scripts/check-cycles.mjs und lib/import-zyklen im Handbuch).
//
// Deshalb importiert diese Datei ausschließlich aus den zyklusfreien
// Katalog-Dateien (oils · schnaps · sud · attributes · aufgussTheme) und NIE
// aus api.ts, einer Route oder einer Komponente. Wer hier etwas ergänzt, prüft
// das bitte nach.

import { MAX_OIL_SLOTS } from './oils';
import { schnapsAttrId, schnapsFromAttributes, stripSchnapsAttrs } from './schnaps';
import { sudAttrId, sudMixAttrId, sudFromAttributes, stripSudAttrs } from './sud';
import { ATTRIBUTES, type InfusionAttribute } from './attributes';
import { RAEUCHER_ATTR, BANJA_ATTR } from './aufgussTheme';

// ─── Das Kontingent ───────────────────────────────────────────────────────────

/** Mindestens so viele Dinge pro Aufguss — Öle, Besonderheiten und Sud
 *  zusammen. Ausgenommen ist nur das Banja (s. `pruefeAuswahl`). */
export const MIN_AUSWAHL = 3;

/** Höchstens so viele. 6 → 8 am 03.08.2026 auf Wunsch: zwei Details mehr pro
 *  Aufguss. Die Öle bleiben bei MAX_OIL_SLOTS (3), die zusätzlichen Plätze
 *  gehen also an Besonderheiten — 3 Öle + 5 Besonderheiten sind das Maximum. */
export const MAX_AUSWAHL = 8;

export const VOLL_HINWEIS = `Hoechstens ${MAX_AUSWAHL} Dinge - erst etwas abwaehlen.`;

/** Alles, was ein Aufguss an Zutaten mitbringen kann, in Formular-Form.
 *  `schnaps` ist der Slug (nicht der fertige Attribut-Eintrag), `sudAuswahl`
 *  enthält dagegen bereits fertige Einträge (`sud:<uuid>` / `sudmix:<uuid>`) —
 *  so wie SudPicker sie liefert. */
export interface ZutatenAuswahl {
  attrs: readonly InfusionAttribute[];
  customAttrIds: readonly string[];
  oils: readonly (string | null)[];
  sudAuswahl: readonly string[];
  schnaps: string | null;
}

/** Wie viele Plätze des Kontingents belegt sind.
 *
 *  Die Schnaps-Sorte zählt bewusst NICHT mit: sie beschreibt die ART des
 *  Aufgusses (eigener Reiter, eigener Karten-Look), sie ist keine Zutat aus dem
 *  Kontingent. Räuchern zählt dagegen mit — es ist und bleibt ein normales
 *  Attribut. Eine Sud-Mischung ist EIN Platz, egal aus wie vielen Kräutern sie
 *  besteht, sonst wäre ein guter Sud allein schon am Limit. */
export function auswahlAnzahl(a: ZutatenAuswahl): number {
  return (
    a.attrs.length +
    a.customAttrIds.length +
    a.oils.filter(Boolean).length +
    a.sudAuswahl.length
  );
}

export function auswahlVoll(a: ZutatenAuswahl): boolean {
  return auswahlAnzahl(a) >= MAX_AUSWAHL;
}

/** Freie Öl-Plätze — für Picker, die nicht überbuchen dürfen. */
export function freieOelPlaetze(a: ZutatenAuswahl): number {
  const belegt = a.oils.filter(Boolean).length;
  return Math.max(0, Math.min(MAX_OIL_SLOTS - belegt, MAX_AUSWAHL - auswahlAnzahl(a)));
}

// ─── Speichern ────────────────────────────────────────────────────────────────

/** Alles, was in EINEM `text[]` in die DB wandert.
 *
 *  Standard-Attribute, die UUIDs eigener Buttons, die Sud-Einträge und ggf. die
 *  Schnaps-Sorte reisen zusammen in `infusions.attributes[]` — siehe
 *  lib/schnaps.ts, warum es keine eigenen RPC-Parameter dafür gibt. */
export function attrsPayload(a: ZutatenAuswahl): string[] {
  return [
    ...a.attrs,
    ...a.customAttrIds,
    ...a.sudAuswahl,
    ...(a.schnaps ? [schnapsAttrId(a.schnaps)] : []),
  ];
}

/** Umkehrung von `attrsPayload` — zerlegt ein gespeichertes `attributes[]`
 *  wieder in die vier Reiter.
 *
 *  `bekannteEigeneIds` sind die UUIDs der eigenen Buttons, die es NOCH gibt:
 *  gelöschte werden verworfen, sonst hängt eine nicht abwählbare Auswahl im
 *  Kontingent. Alles, was in keine Schublade passt (Alt-Daten, Attribute aus
 *  einer neueren Version), fällt bewusst weg statt unsichtbar mitzuzählen. */
export function zerlegeAttributes(
  attributes: readonly string[] | null | undefined,
  bekannteEigeneIds: readonly string[] = [],
): Omit<ZutatenAuswahl, 'oils'> {
  const roh = attributes ?? [];
  const schnaps = schnapsFromAttributes(roh);
  const sud = sudFromAttributes(roh);
  const rest = stripSudAttrs(stripSchnapsAttrs(roh));

  const bekannteAttrs = new Set<string>(ATTRIBUTES.map((x) => x.id));
  const eigene = new Set<string>(bekannteEigeneIds);

  return {
    attrs: rest.filter((x) => bekannteAttrs.has(x)) as InfusionAttribute[],
    customAttrIds: rest.filter((x) => eigene.has(x)),
    sudAuswahl: [...sud.kraeuter.map(sudAttrId), ...sud.mixe.map(sudMixAttrId)],
    schnaps: schnaps?.id ?? null,
  };
}

/** Prüft das Kontingent. Rückgabe: Fehlermeldung oder `null` wenn alles passt.
 *
 *  Das Banja-Ritual ist vom MINIMUM ausgenommen: sein Schnellbuchungs-Knopf
 *  setzt genau zwei Eigenschaften (banja + wenik), und das Ritual hat einen
 *  festen Charakter, dem man nicht künstlich eine dritte Zutat anhängen sollte.
 *  Die Obergrenze gilt auch fürs Banja. */
export function pruefeAuswahl(a: ZutatenAuswahl): string | null {
  const n = auswahlAnzahl(a);
  const istBanja = (a.attrs as readonly string[]).includes(BANJA_ATTR);
  if (n < MIN_AUSWAHL && !istBanja) {
    return `Bitte mindestens ${MIN_AUSWAHL} Dinge waehlen - Oele und Besonderheiten zusammen (aktuell ${n}).`;
  }
  if (n > MAX_AUSWAHL) {
    return `Hoechstens ${MAX_AUSWAHL} Dinge - Oele und Besonderheiten zusammen (aktuell ${n}).`;
  }
  return null;
}

// ─── Anzeigen ─────────────────────────────────────────────────────────────────

/** Die Besonderheiten-Chips, die ein Formular MIT Reitern anbietet: ohne die
 *  ausgemusterten und ohne die, für die es einen eigenen Reiter gibt
 *  (Kirschwasser/Haferpflaume → Schnaps, Räuchern → eigener Reiter).
 *
 *  Wer die Reiter nicht hat, nimmt weiter ATTRIBUTES_WAEHLBAR — sonst
 *  verschwinden diese Aufgussarten dort ersatzlos. */
export const ATTRIBUTE_CHIPS = ATTRIBUTES.filter((a) => !a.retired && !a.hidden);

/**
 * Fehlen diesem Aufguss die Zutaten — muss das Tablet mahnen?
 *
 * Am Tablet nachtragbar sind Öle, Sud, Räucherwerk und Schnaps (Vorgabe
 * Christoph, 14.08.2026). Ein Aufguss, der irgendetwas davon trägt, gilt als
 * versorgt. Das Banja zählt ebenfalls als versorgt, obwohl man es nicht
 * nachtragen kann — es ist keine Zutat, sondern eine Buchung (2 Kacheln,
 * Ruhephase, eigene Dauer) mit festem Charakter; ihm fehlt nichts.
 *
 *   'leer'               gar nichts eingetragen → deutliche Forderung
 *   'nur_besonderheiten' Besonderheiten ja, Zutaten nein → Forderung mit Hinweis
 *   'vollstaendig'       mindestens eine Zutat ODER Banja
 *
 * Bewusst auf den ROHEN Feldern gerechnet. Die InfusionCard füllt leere
 * Aufgüsse auf der Tafel mit den Lieblingszutaten des Aufgießers auf
 * („sein Stil") — wer diesen Fallback hier mitbenutzt, macht die Forderung
 * systematisch blind für genau den Fall, den sie anmahnen soll.
 */
export type ZutatenStatus = 'leer' | 'nur_besonderheiten' | 'vollstaendig';

export function zutatenStatus(
  attributes: readonly string[] | null | undefined,
  oils: readonly (string | null)[] | null | undefined,
): ZutatenStatus {
  const attrs = attributes ?? [];
  const hatOel = (oils ?? []).some(Boolean);
  const sud = sudFromAttributes(attrs);
  const hatSud = sud.kraeuter.length > 0 || sud.mixe.length > 0;
  const hatSchnaps = !!schnapsFromAttributes(attrs);
  const hatRaeuchern = attrs.includes(RAEUCHER_ATTR);
  const hatBanja = attrs.includes(BANJA_ATTR);

  if (hatOel || hatSud || hatSchnaps || hatRaeuchern || hatBanja) return 'vollstaendig';
  return attrs.length > 0 ? 'nur_besonderheiten' : 'leer';
}
