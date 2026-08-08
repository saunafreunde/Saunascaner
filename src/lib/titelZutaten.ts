import { ATTR_BY_ID } from '@/lib/attributes';
import { OIL_BY_ID } from '@/lib/oils';
import { SCHNAPS_BY_ID, parseSchnapsAttr } from '@/lib/schnaps';
import { parseSudAttr, parseSudMixAttr, type SudKraut, type SudMix } from '@/lib/sud';
import { RAEUCHER_ATTR } from '@/lib/aufgussTheme';

/** Alles, woraus sich ein Aufguss-Titel speisen kann — in KLARTEXT.
 *
 *  Der Titel-Generator bekam bisher nur zwei Rohlisten: `attributes` und
 *  `oils`, beide als IDs. Was dabei unter den Tisch fiel:
 *    • eigene Buttons und eigene Öle (UUIDs, in keiner Tabelle nachschlagbar)
 *    • die Schnaps-Sorte
 *    • Sud-Kräuter und Mischungen
 *    • Räucherwerk
 *    • Sauna, Uhrzeit, Jahreszeit
 *  Ein Kirschwasser-Aufguss mit Rosmarin-Sud erzeugte deshalb denselben Titel
 *  wie ein leerer.
 *
 *  Hier stehen NAMEN, keine IDs: „Extra heiß" statt 'flame', „Blaue Kamille"
 *  statt 'custom:9f3e…'. Für die KI ist das der Unterschied zwischen einem
 *  brauchbaren Prompt und Buchstabensalat — und der Regel-Fallback kann die
 *  Namen direkt in den Titel setzen.
 */
export type TitelZutaten = {
  besonderheiten: string[];
  oele: string[];
  schnaps: string | null;
  sud: string[];
  raeucherwerk: string[];
  sauna?: string;
  temperatur?: string;
  uhrzeit?: string;
  jahreszeit?: string;
};

export const LEERE_ZUTATEN: TitelZutaten = {
  besonderheiten: [], oele: [], schnaps: null, sud: [], raeucherwerk: [],
};

/** Grobe Jahreszeit aus dem Datum — reicht für „Advent" vs. „Hochsommer".
 *  Bewusst nicht kalendarisch exakt: für einen Aufguss-Titel zählt, wie sich
 *  der Monat anfühlt, nicht wann die Sonnenwende ist. */
export function jahreszeitFuer(d: Date): string {
  const m = d.getMonth() + 1;
  const tag = d.getDate();
  if (m === 12 && tag <= 24) return 'Advent';
  if (m === 12 || m <= 2) return 'Winter';
  if (m <= 5) return 'Frühling';
  if (m <= 8) return 'Sommer';
  return 'Herbst';
}

/** Baut die Zutatenliste aus dem, was im Formular steht.
 *
 *  Nimmt die Roh-IDs entgegen und löst sie auf — inklusive der UUID-Formen
 *  ('custom:…', 'sud:…', 'sudmix:…', 'schnaps:…'). Was sich nicht auflösen
 *  lässt, fällt still weg: ein Titel mit einer UUID darin wäre schlimmer als
 *  einer ohne.
 */
export function zutatenAus(input: {
  /** Standard-Besonderheiten (Slugs) */
  attrs: string[];
  /** Eigene Buttons (UUIDs) */
  customAttrIds?: string[];
  /** Öl-Slots, auch 'custom:<uuid>' */
  oils: (string | null)[];
  /** Schnaps-Slug (nicht der Attribut-Eintrag) */
  schnaps?: string | null;
  /** Sud-Einträge als fertige Attribut-IDs ('sud:…' / 'sudmix:…') */
  sudAuswahl?: string[];
  /** Nachschlagewerke */
  customAttrs?: { id: string; label: string }[];
  customOils?: { id: string; name: string }[];
  sudKraeuter?: SudKraut[];
  sudMixe?: SudMix[];
  /** Kontext */
  sauna?: { name: string; temperature_label?: string | null } | null;
  zeitpunkt?: Date | null;
}): TitelZutaten {
  const {
    attrs, customAttrIds = [], oils, schnaps = null, sudAuswahl = [],
    customAttrs = [], customOils = [], sudKraeuter = [], sudMixe = [],
    sauna, zeitpunkt,
  } = input;

  // Besonderheiten: Standard über die Tabelle, eigene über ihre Liste.
  // Räuchern fliegt raus — es steht unten schon als eigene Kategorie.
  const besonderheiten = [
    ...attrs
      .filter((a) => a !== RAEUCHER_ATTR)
      .map((a) => (ATTR_BY_ID as Record<string, { label: string } | undefined>)[a]?.label)
      .filter((x): x is string => !!x),
    ...customAttrIds
      .map((id) => customAttrs.find((c) => c.id === id)?.label)
      .filter((x): x is string => !!x),
  ];

  const oele = oils
    .filter((o): o is string => !!o)
    .map((o) => {
      const std = OIL_BY_ID[o];
      if (std) return std.name;
      const uuid = o.startsWith('custom:') ? o.slice('custom:'.length) : null;
      return uuid ? customOils.find((c) => c.id === uuid)?.name : undefined;
    })
    .filter((x): x is string => !!x);

  // Sud: Mischungen zuerst, sie sind die groessere Aussage. Räucherwerk liegt
  // in derselben Tabelle und wird über `art` getrennt.
  const sud: string[] = [];
  const raeucherwerk: string[] = [];
  for (const eintrag of sudAuswahl) {
    const mixId = parseSudMixAttr(eintrag);
    if (mixId) {
      const m = sudMixe.find((x) => x.id === mixId);
      if (m) sud.push(m.name);
      continue;
    }
    const krautId = parseSudAttr(eintrag);
    if (!krautId) continue;
    const k = sudKraeuter.find((x) => x.id === krautId);
    if (!k) continue;
    (k.art === 'raeucher' ? raeucherwerk : sud).push(k.name);
  }

  // Der Schnaps kann als Slug oder als fertiger Attribut-Eintrag kommen.
  const schnapsSlug = schnaps ? (parseSchnapsAttr(schnaps) ?? schnaps) : null;
  const schnapsName = schnapsSlug ? (SCHNAPS_BY_ID[schnapsSlug]?.name ?? null) : null;

  return {
    besonderheiten,
    oele,
    schnaps: schnapsName,
    sud,
    raeucherwerk,
    ...(sauna ? { sauna: sauna.name, temperatur: sauna.temperature_label ?? undefined } : {}),
    ...(zeitpunkt
      ? {
          uhrzeit: `${String(zeitpunkt.getHours()).padStart(2, '0')}:00`,
          jahreszeit: jahreszeitFuer(zeitpunkt),
        }
      : {}),
  };
}

/** Ist überhaupt etwas ausgewählt? */
export function zutatenLeer(z: TitelZutaten): boolean {
  return z.besonderheiten.length === 0 && z.oele.length === 0
    && !z.schnaps && z.sud.length === 0 && z.raeucherwerk.length === 0;
}
