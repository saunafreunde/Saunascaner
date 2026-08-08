import { AUSSCHNITT_DEFAULT, ausschnittAus, type Ausschnitt } from '@/types/branding';

/** Frei gestaltete Info-Karten für die TV-Tafel.
 *
 *  Zweck: kurzfristige Ansagen ohne Deploy — „Sommerfest Samstag", „Sauna 2
 *  heute außer Betrieb", ein Countdown auf den nächsten Aufguss-Marathon.
 *  Vereins-News (org_news) gibt es zwar, die erscheinen aber nur im
 *  Mitgliederbereich und nie auf dem Fernseher.
 *
 *  ── Warum Prozent statt Pixel ──
 *  Dieselbe Karte erscheint an zwei Orten in sehr verschiedener Größe: als
 *  Kachel im Karussell (auf 1080p 920×301) und als große Einblendung über die
 *  ganze Tafel. Alle Maße sind deshalb Prozent der LEINWAND, und die Leinwand
 *  hat ein festes Seitenverhältnis. Damit ist die Komposition an beiden Orten
 *  identisch — sie wird nur skaliert. Schriftgrößen zählen in Prozent der
 *  Leinwandhöhe, umgesetzt über `cqh`, wie der Rest der Tafel auch.
 *
 *  Gespeichert in brand_settings (jsonb in system_config): der Blob ist über
 *  die Policy config_read_public bereits anon lesbar, die Tafel läuft ohne
 *  Login. Ein eigener system_config-Key wäre NICHT lesbar — die Policy zählt
 *  die erlaubten Keys einzeln auf. Deshalb hier und ohne Migration.
 */

export type ElementTyp = 'text' | 'bild' | 'video' | 'countdown';

type Basis = {
  id: string;
  /** Linke obere Ecke in Prozent der Leinwand. */
  x: number;
  y: number;
  /** Breite in Prozent der Leinwandbreite. */
  breite: number;
  deckkraft: number;
};

export type TextElement = Basis & {
  typ: 'text';
  text: string;
  /** Schriftgröße in Prozent der LeinwandHÖHE — skaliert mit der Karte. */
  groesse: number;
  farbe: string;
  fett: boolean;
  kursiv: boolean;
  ausrichtung: 'left' | 'center' | 'right';
  /** Schlagschatten — auf unruhigen Fotos der Unterschied zwischen lesbar
   *  und nicht lesbar. */
  schatten: boolean;
};

export type BildElement = Basis & {
  typ: 'bild';
  path: string;
  /** Höhe in Prozent der Leinwandhöhe. */
  hoehe: number;
  radius: number;
  ausschnitt: Ausschnitt;
};

export type VideoElement = Basis & {
  typ: 'video';
  path: string;
  hoehe: number;
  radius: number;
};

export type CountdownElement = Basis & {
  typ: 'countdown';
  /** Zielzeitpunkt als ISO-String. */
  ziel: string;
  /** Steht klein über der Zahl, z. B. „Noch bis zum Sommerfest". */
  label: string;
  groesse: number;
  farbe: string;
  /** Was nach Ablauf dasteht — sonst zählt die Karte ins Negative. */
  fertigText: string;
  schatten: boolean;
};

export type KartenElement = TextElement | BildElement | VideoElement | CountdownElement;

export type KartenHintergrund = {
  typ: 'farbe' | 'verlauf' | 'bild' | 'video';
  farbe: string;
  farbe2: string;
  path: string | null;
  ausschnitt: Ausschnitt;
  /** Dunkler Schleier über Bild/Video, damit Text darauf lesbar bleibt. */
  schleier: number;
};

export type InfoKarte = {
  id: string;
  /** Interner Name für die Liste im Admin — steht nicht auf der Karte. */
  titel: string;
  aktiv: boolean;
  /** true = wird zusätzlich groß über die ganze Tafel eingeblendet. Ohne das
   *  erscheint die Karte nur in leeren Kacheln — und an vollen Tagen gibt es
   *  keine, ausgerechnet dann, wenn die meisten Gäste da sind. */
  wichtig: boolean;
  /** Gültigkeitsfenster als ISO-Datum (YYYY-MM-DD), beide Grenzen optional
   *  und einschließlich. Ohne das hängt die Sommerfest-Karte im Oktober noch. */
  von: string | null;
  bis: string | null;
  hintergrund: KartenHintergrund;
  elemente: KartenElement[];
};

/** Seitenverhältnis der Leinwand: 3:1, das Format einer Tafel-Kachel bei zwei
 *  Saunen und drei Aufgüssen (gemessen 920×301). Wer 4 Aufgüsse zeigt, bekommt
 *  4,11:1 — die Karte wird dann oben und unten leicht beschnitten, deshalb
 *  gehört Wichtiges in die Mitte. Der Editor zeigt diese Zone an. */
export const LEINWAND_V = 3;

export const HINTERGRUND_DEFAULT: KartenHintergrund = {
  typ: 'verlauf', farbe: '#0f3d2e', farbe2: '#1c1917',
  path: null, ausschnitt: { ...AUSSCHNITT_DEFAULT }, schleier: 0.35,
};

export function neueKarte(id: string): InfoKarte {
  return {
    id, titel: 'Neue Info', aktiv: false, wichtig: false, von: null, bis: null,
    hintergrund: { ...HINTERGRUND_DEFAULT, ausschnitt: { ...AUSSCHNITT_DEFAULT } },
    elemente: [
      {
        id: id + '-t1', typ: 'text', text: 'Überschrift',
        x: 6, y: 18, breite: 88, groesse: 26, deckkraft: 1,
        farbe: '#ffffff', fett: true, kursiv: false, ausrichtung: 'center', schatten: true,
      },
      {
        id: id + '-t2', typ: 'text', text: 'Der Text dazu',
        x: 6, y: 52, breite: 88, groesse: 13, deckkraft: 1,
        farbe: '#fde68a', fett: false, kursiv: false, ausrichtung: 'center', schatten: true,
      },
    ],
  };
}

// ─── Validierung ─────────────────────────────────────────────────────────
// Die Karten kommen aus einem jsonb-Blob, den auch ein älterer Client
// geschrieben haben kann. Alles, was hier durchrutscht, landet ungeprüft auf
// einem Fernseher, der vor Gästen hängt — deshalb wird jedes Feld geprüft und
// Unplausibles auf einen brauchbaren Wert gezogen statt die Karte zu verwerfen.

const zahl = (v: unknown, min: number, max: number, fb: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fb;
const text = (v: unknown, fb = '') => (typeof v === 'string' ? v : fb);
const farbe = (v: unknown, fb: string) =>
  typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : fb;
const janein = (v: unknown, fb = false) => (typeof v === 'boolean' ? v : fb);
const datum = (v: unknown) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

function elementAus(roh: unknown, i: number): KartenElement | null {
  const o = (roh ?? {}) as Record<string, unknown>;
  const basis = {
    id: text(o.id, `e${i}`),
    x: zahl(o.x, -20, 120, 5),
    y: zahl(o.y, -20, 120, 5),
    breite: zahl(o.breite, 2, 120, 40),
    deckkraft: zahl(o.deckkraft, 0, 1, 1),
  };
  switch (o.typ) {
    case 'text':
      return {
        ...basis, typ: 'text',
        text: text(o.text, ''),
        groesse: zahl(o.groesse, 2, 80, 14),
        farbe: farbe(o.farbe, '#ffffff'),
        fett: janein(o.fett, true), kursiv: janein(o.kursiv),
        ausrichtung: o.ausrichtung === 'left' || o.ausrichtung === 'right' ? o.ausrichtung : 'center',
        schatten: janein(o.schatten, true),
      };
    case 'bild':
    case 'video': {
      const p = text(o.path);
      if (!p) return null;
      const gemeinsam = {
        ...basis, path: p,
        hoehe: zahl(o.hoehe, 2, 120, 40),
        radius: zahl(o.radius, 0, 50, 8),
      };
      return o.typ === 'bild'
        ? { ...gemeinsam, typ: 'bild', ausschnitt: ausschnittAus(o.ausschnitt) }
        : { ...gemeinsam, typ: 'video' };
    }
    case 'countdown':
      return {
        ...basis, typ: 'countdown',
        ziel: text(o.ziel, new Date().toISOString()),
        label: text(o.label, ''),
        groesse: zahl(o.groesse, 2, 80, 20),
        farbe: farbe(o.farbe, '#ffffff'),
        fertigText: text(o.fertigText, 'Es ist so weit!'),
        schatten: janein(o.schatten, true),
      };
    default:
      return null;
  }
}

export function karteAus(roh: unknown): InfoKarte | null {
  const o = (roh ?? {}) as Record<string, unknown>;
  const id = text(o.id);
  if (!id) return null;
  const h = (o.hintergrund ?? {}) as Record<string, unknown>;
  const htyp = h.typ === 'farbe' || h.typ === 'bild' || h.typ === 'video' ? h.typ : 'verlauf';
  return {
    id,
    titel: text(o.titel, 'Info'),
    aktiv: janein(o.aktiv),
    wichtig: janein(o.wichtig),
    von: datum(o.von),
    bis: datum(o.bis),
    hintergrund: {
      typ: htyp,
      farbe: farbe(h.farbe, HINTERGRUND_DEFAULT.farbe),
      farbe2: farbe(h.farbe2, HINTERGRUND_DEFAULT.farbe2),
      path: text(h.path) || null,
      ausschnitt: ausschnittAus(h.ausschnitt),
      schleier: zahl(h.schleier, 0, 1, HINTERGRUND_DEFAULT.schleier),
    },
    elemente: Array.isArray(o.elemente)
      ? o.elemente.map(elementAus).filter((e): e is KartenElement => e !== null)
      : [],
  };
}

export function infoKartenAus(roh: unknown): InfoKarte[] {
  return Array.isArray(roh)
    ? roh.map(karteAus).filter((k): k is InfoKarte => k !== null)
    : [];
}

/** Läuft diese Karte heute? Prüft Schalter und Gültigkeitsfenster.
 *  Der Vergleich läuft über YYYY-MM-DD in Ortszeit — ein UTC-Vergleich würde
 *  die Karte je nach Sommerzeit einen Tag zu früh oder zu spät zeigen. */
export function karteLaeuft(k: InfoKarte, jetzt: Date): boolean {
  if (!k.aktiv) return false;
  const heute = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-${String(jetzt.getDate()).padStart(2, '0')}`;
  if (k.von && heute < k.von) return false;
  if (k.bis && heute > k.bis) return false;
  return true;
}
