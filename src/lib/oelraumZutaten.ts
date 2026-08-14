// Was muss für einen Aufguss aus dem Regal geholt werden?
//
// Der Öl-Raum stellt eine andere Frage als die TV-Tafel. Die Tafel zeigt einem
// Gast, WAS ihn erwartet — dort dürfen Musikwunsch und Ritual gleichberechtigt
// neben dem Öl stehen. Im Öl-Raum steht jemand vor dem Regal und will wissen,
// welche Flasche er in die Hand nehmen muss. Deshalb löst diese Datei nur die
// GREIFBAREN Zutaten auf und sortiert sie so, dass man das Regal einmal
// abläuft statt dreimal.
//
// Importfrei ausser den Katalog-Dateien (oils · schnaps · sud · attributes) —
// die Nachschlagewerke aus der Datenbank kommen als Parameter herein, damit
// diese Datei nichts von api.ts, React oder Query weiss.

import { OIL_BY_ID, parseCustomOilId } from './oils';
import { SCHNAPS_BY_ID, parseSchnapsAttr } from './schnaps';
import { parseSudAttr, parseSudMixAttr, type SudKraut, type SudMix } from './sud';
import { ATTR_BY_ID, type InfusionAttribute } from './attributes';

/** Woher die Zutat kommt. Bestimmt Farbe, Gruppe und Reihenfolge im Regal. */
export type RegalArt = 'oel' | 'eigenes_oel' | 'sud' | 'raeucher' | 'schnaps';

export interface RegalEintrag {
  /** Stabile Identität: dieselbe Zutat aus zwei Aufgüssen hat denselben Key.
   *  Grundlage der Sammelliste. */
  key: string;
  art: RegalArt;
  /** Die Regalnummer. Nur die Standard-Öle haben eine — alles andere steht
   *  woanders und bekommt bewusst keine erfundene Nummer. */
  nummer: number | null;
  emoji: string;
  name: string;
  farbe: string;
}

/** Die Nachschlagewerke aus der Datenbank. Werden einmal gebaut und
 *  weitergereicht, damit die Auflösung ohne Netz und ohne Hooks auskommt. */
export interface RegalKatalog {
  eigeneOele: ReadonlyMap<string, { name: string; emoji: string; color: string }>;
  kraeuter: ReadonlyMap<string, SudKraut>;
  mixe: ReadonlyMap<string, SudMix>;
  eigeneAttrs: ReadonlyMap<string, { label: string; emoji: string; color: string }>;
}

export const LEERER_KATALOG: RegalKatalog = {
  eigeneOele: new Map(),
  kraeuter: new Map(),
  mixe: new Map(),
  eigeneAttrs: new Map(),
};

// Reihenfolge der Gruppen = Laufweg durch den Raum: erst die nummerierten
// Flaschen im Regal, dann die eigenen, dann das Kräuterregal, zuletzt die
// Flasche aus dem Schrank.
const GRUPPEN_RANG: Record<RegalArt, number> = {
  oel: 0, eigenes_oel: 1, sud: 2, raeucher: 3, schnaps: 4,
};

const FARBE_OEL = '#d9a441';
const FARBE_SCHNAPS = '#b45309';

/** Alle greifbaren Zutaten EINES Aufgusses, in Regal-Reihenfolge.
 *
 *  Bewusst ohne den „sein Stil"-Fallback der InfusionCard: der füllt leere
 *  Aufgüsse mit den Lieblingszutaten des Aufgießers auf. Auf der Tafel ist das
 *  ein Gewinn, hier wäre es fatal — es würde genau den Fall unsichtbar machen,
 *  den das Tablet anmahnen soll. */
export function zutatenFuer(
  inf: { attributes?: readonly string[] | null; oils?: readonly (string | null)[] | null },
  katalog: RegalKatalog = LEERER_KATALOG,
): RegalEintrag[] {
  const aus: RegalEintrag[] = [];

  for (const roh of inf.oils ?? []) {
    if (!roh) continue;
    const eigeneId = parseCustomOilId(roh);
    if (eigeneId) {
      const e = katalog.eigeneOele.get(eigeneId);
      // Unbekannte UUID = das eigene Öl wurde gelöscht. Wir zeigen den Platz
      // trotzdem an, sonst verschwindet eine geplante Zutat lautlos.
      aus.push({
        key: `oel:${roh}`, art: 'eigenes_oel', nummer: null,
        emoji: e?.emoji ?? '🌿', name: e?.name ?? 'Eigenes Öl (gelöscht)',
        farbe: e?.color ?? FARBE_OEL,
      });
      continue;
    }
    const o = OIL_BY_ID[roh];
    if (o) {
      aus.push({
        key: `oel:${o.id}`, art: 'oel', nummer: o.number,
        emoji: o.emoji, name: o.name, farbe: FARBE_OEL,
      });
    }
  }

  for (const attr of inf.attributes ?? []) {
    const krautId = parseSudAttr(attr);
    if (krautId) {
      const k = katalog.kraeuter.get(krautId);
      if (k) {
        aus.push({
          key: `sud:${krautId}`, art: k.art === 'raeucher' ? 'raeucher' : 'sud',
          nummer: null, emoji: k.emoji, name: k.name, farbe: k.color,
        });
      }
      continue;
    }
    const mixId = parseSudMixAttr(attr);
    if (mixId) {
      const m = katalog.mixe.get(mixId);
      if (m) {
        aus.push({
          key: `sudmix:${mixId}`, art: 'sud', nummer: null,
          emoji: m.emoji, name: m.name, farbe: m.color,
        });
      }
      continue;
    }
    const slug = parseSchnapsAttr(attr);
    if (slug && SCHNAPS_BY_ID[slug]) {
      const s = SCHNAPS_BY_ID[slug];
      aus.push({
        key: `schnaps:${slug}`, art: 'schnaps', nummer: null,
        emoji: s.emoji, name: s.name, farbe: s.color ?? FARBE_SCHNAPS,
      });
    }
  }

  return sortiere(aus);
}

/** Die Besonderheiten eines Aufgusses als beschriftete Pillen — Musik, Ritual,
 *  eigene Buttons. Nicht greifbar, aber der Aufgießer will sie im Öl-Raum
 *  trotzdem sehen (Menthol-Kristalle stehen nun mal auch dort). */
export function besonderheitenFuer(
  inf: { attributes?: readonly string[] | null },
  katalog: RegalKatalog = LEERER_KATALOG,
): { key: string; emoji: string; label: string; farbe: string | null }[] {
  const aus: { key: string; emoji: string; label: string; farbe: string | null }[] = [];
  for (const attr of inf.attributes ?? []) {
    if (parseSudAttr(attr) || parseSudMixAttr(attr) || parseSchnapsAttr(attr)) continue;
    const std = ATTR_BY_ID[attr as InfusionAttribute];
    if (std) {
      aus.push({ key: attr, emoji: std.emoji, label: std.label, farbe: null });
      continue;
    }
    const eigen = katalog.eigeneAttrs.get(attr);
    if (eigen) {
      aus.push({ key: attr, emoji: eigen.emoji, label: eigen.label, farbe: eigen.color });
    }
    // Alles andere (Alt-Daten, unbekannte Slugs) fällt weg statt als nackte
    // UUID auf einem Bildschirm zu landen, den Gäste sehen können.
  }
  return aus;
}

function sortiere(liste: RegalEintrag[]): RegalEintrag[] {
  return [...liste].sort((a, b) => {
    const g = GRUPPEN_RANG[a.art] - GRUPPEN_RANG[b.art];
    if (g !== 0) return g;
    if (a.nummer !== null && b.nummer !== null) return a.nummer - b.nummer;
    if (a.nummer !== null) return -1;
    if (b.nummer !== null) return 1;
    return a.name.localeCompare(b.name, 'de');
  });
}

export interface SammelEintrag extends RegalEintrag {
  /** Für welche der übergebenen Aufgüsse gebraucht (Index in der Eingabe).
   *  Zwei gleichzeitige Saunen, die dasselbe Öl brauchen, ergeben EINEN
   *  Eintrag mit zwei Einträgen hier — man holt die Flasche ja nur einmal. */
  fuer: number[];
}

/** Die Griffliste: alles, was für die übergebenen Aufgüsse zusammen aus dem
 *  Regal muss — jede Zutat genau einmal, in Laufreihenfolge.
 *
 *  Das ist der eigentliche Zweck des Tablets. Bei zwei oder drei gleichzeitig
 *  aufgießenden Saunen läuft sonst jeder einzeln zum Regal und keiner weiß,
 *  ob die Flasche schon jemand in der Hand hat. */
export function sammelListe(zutatenProAufguss: readonly (readonly RegalEintrag[])[]): SammelEintrag[] {
  const nach = new Map<string, SammelEintrag>();
  zutatenProAufguss.forEach((zutaten, i) => {
    for (const z of zutaten) {
      const da = nach.get(z.key);
      if (da) { if (!da.fuer.includes(i)) da.fuer.push(i); }
      else nach.set(z.key, { ...z, fuer: [i] });
    }
  });
  return sortiere([...nach.values()]) as SammelEintrag[];
}
