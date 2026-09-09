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

/** So viele Öle muss ein Aufguss tragen — alle drei Plätze belegt.
 *
 *  Ab 09.09.2026 (Vorgabe Christoph): vorher reichten 3 Dinge insgesamt, Öle
 *  und Besonderheiten beliebig gemischt. Damit konnte ein Aufguss mit drei
 *  Besonderheiten und null Ölen durchgehen — für den Ölraum und die Statistik
 *  war er wertlos. */
export const PFLICHT_OELE = MAX_OIL_SLOTS;

/** Und so viele Besonderheiten dazu. Räuchern zählt als eine davon mit, weil
 *  es ein ganz normales Attribut ist. */
export const PFLICHT_BESONDERHEITEN = 2;

/** Für Übergänge/Anzeigen: so viele Dinge hat ein vollständiger Aufguss
 *  mindestens (3 Öle + 2 Besonderheiten). */
export const MIN_AUSWAHL = PFLICHT_OELE + PFLICHT_BESONDERHEITEN;

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
/** Trägt der Aufguss etwas, das die Öle ersetzt?
 *
 *  Räuchern, Sud und Schnaps sind eigene Aufgussarten — dort ist der Duft
 *  nicht das Öl, sondern das Räucherwerk, der Sud oder der Schnaps. Wer eine
 *  davon wählt, muss keine drei Öle mehr dazulegen; er DARF aber (Vorgabe
 *  Christoph 09.09.2026). Das Banja ist ganz ausgenommen: es ist eine Buchung
 *  mit fester Form, keine Zusammenstellung. */
export function ersetztOele(a: ZutatenAuswahl): boolean {
  return (a.attrs as readonly string[]).includes(RAEUCHER_ATTR)
    || a.sudAuswahl.length > 0
    || !!a.schnaps;
}

/** Was diesem Aufguss noch zur Vollständigkeit fehlt — für Live-Anzeigen im
 *  Formular. Beide Zahlen sind >= 0; {oele: 0, besonderheiten: 0} heißt fertig. */
export function fehltNoch(a: ZutatenAuswahl): { oele: number; besonderheiten: number } {
  if ((a.attrs as readonly string[]).includes(BANJA_ATTR)) {
    return { oele: 0, besonderheiten: 0 };
  }
  const oele = a.oils.filter(Boolean).length;
  const besonderheiten = a.attrs.length + a.customAttrIds.length;
  return {
    oele: ersetztOele(a) ? 0 : Math.max(0, PFLICHT_OELE - oele),
    besonderheiten: Math.max(0, PFLICHT_BESONDERHEITEN - besonderheiten),
  };
}

/** Dasselbe wie `fehltNoch`, aber auf den ROHEN Datenbankfeldern.
 *
 *  Für bestehende Aufgüsse, die nur als `oils[]` + `attributes[]` vorliegen.
 *  Bewusst NICHT über `zerlegeAttributes`: das braucht die Liste der eigenen
 *  Buttons des Aufgießers, um UUIDs zuzuordnen — die hat der Aufrufer hier
 *  nicht, und ohne sie fielen eigene Besonderheiten stillschweigend unter den
 *  Tisch. Hier zählt schlicht alles als Besonderheit, was übrig bleibt,
 *  nachdem Sud und Schnaps herausgerechnet sind. */
export function fehltNochRoh(
  oils: readonly (string | null)[] | null | undefined,
  attributes: readonly string[] | null | undefined,
): { oele: number; besonderheiten: number } {
  const roh = attributes ?? [];
  if (roh.includes(BANJA_ATTR)) return { oele: 0, besonderheiten: 0 };

  const schnaps = schnapsFromAttributes(roh);
  const sud = sudFromAttributes(roh);
  const rest = stripSudAttrs(stripSchnapsAttrs(roh));
  const hatSud = sud.kraeuter.length + sud.mixe.length > 0;
  const ersetzt = rest.includes(RAEUCHER_ATTR) || hatSud || !!schnaps;

  return {
    oele: ersetzt ? 0 : Math.max(0, PFLICHT_OELE - (oils ?? []).filter(Boolean).length),
    besonderheiten: Math.max(0, PFLICHT_BESONDERHEITEN - rest.length),
  };
}

/** Kurz und menschlich: „3 Öle und 2 Besonderheiten" — oder `null`, wenn nichts fehlt. */
export function fehltText(fehlt: { oele: number; besonderheiten: number }): string | null {
  const teile: string[] = [];
  if (fehlt.oele > 0) teile.push(`${fehlt.oele} ${fehlt.oele === 1 ? 'Öl' : 'Öle'}`);
  if (fehlt.besonderheiten > 0) {
    teile.push(`${fehlt.besonderheiten} ${fehlt.besonderheiten === 1 ? 'Besonderheit' : 'Besonderheiten'}`);
  }
  return teile.length ? teile.join(' und ') : null;
}

export function pruefeAuswahl(a: ZutatenAuswahl): string | null {
  if ((a.attrs as readonly string[]).includes(BANJA_ATTR)) return null;

  const fehlt = fehltNoch(a);
  if (fehlt.oele > 0 || fehlt.besonderheiten > 0) {
    const teile: string[] = [];
    if (fehlt.oele > 0) teile.push(`${fehlt.oele} ${fehlt.oele === 1 ? 'Oel' : 'Oele'}`);
    if (fehlt.besonderheiten > 0) {
      teile.push(`${fehlt.besonderheiten} ${fehlt.besonderheiten === 1 ? 'Besonderheit' : 'Besonderheiten'}`);
    }
    return `Es fehlen noch ${teile.join(' und ')}. Pflicht sind ${PFLICHT_OELE} Oele und `
      + `${PFLICHT_BESONDERHEITEN} Besonderheiten - bei Raeuchern, Sud und Schnaps entfaellt die Oel-Pflicht.`;
  }
  const n = auswahlAnzahl(a);
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
