// Namensschild des Aufgießers auf der TV-Tafel (Migration 0122).
//
// Der Aufgießer stellt sich sein Schild selbst zusammen: Rahmenform,
// Hintergrundfarbe, Transparenz, Rahmenfarbe, Schriftfarbe für Name und
// Spruch, dazu optional eine animierte Jahreszeiten-Grafik.
//
// In der DB liegt NUR diese Konfiguration (members.nameplate_config, jsonb).
// Formen- und Deko-Katalog stehen hier im Frontend — so lässt sich beides
// erweitern oder überarbeiten, ohne die DB anzufassen.
//
// ── Die Rahmen-Falle ────────────────────────────────────────────────────
// Bei `clip-path` wird ein `box-shadow` MITGESCHNITTEN und ist unsichtbar.
// Der farbige Rand kann für geclippte Formen deshalb nicht als Ring gesetzt
// werden. Zwei Ebenen (Randplatte unter Kernplatte) scheiden hier ebenfalls
// aus: sobald der Nutzer Transparenz wählt, schimmert die Randplatte durch
// die Füllung — und Transparenz ist genau der Punkt, um den es geht.
// Deshalb: ein statischer Vier-Richtungs-`drop-shadow` am ELTERN-Wrapper.
// Der Filter sieht die bereits geclippte Silhouette und umfährt sie sauber.
// Er ist statisch, rastert also einmal — und die animierte Deko liegt
// bewusst AUSSERHALB dieses Wrappers, sonst würde sie jeden Frame neu
// durch den Filter gejagt.

import type { DekoId } from '@/components/NameplateDeko';

export type NameplateForm = {
  id: string;
  label: string;
  beschreibung: string;
  /** Leer = die Form kommt allein mit border-radius aus. */
  clipPath: string;
  borderRadius: string;
  padding: string;
};

export const FORMEN: NameplateForm[] = [
  {
    id: "pille",
    label: "Pille",
    beschreibung: "Schlichte, voll gerundete Kapsel — Name und Spruch sitzen in einer ruhigen Tablette, deren Halbkreis-Enden bei jeder Zeilenhoehe automatisch stimmen.",
    clipPath: "",
    borderRadius: "999em",
    padding: "0.5em 1.15em",
  },
  {
    id: "wappen",
    label: "Wappen",
    beschreibung: "Klassisches Schild mit geraden Schultern, die sich ueber zwei Knickpunkte zur Spitze verjuengen — wirkt wie ein Vereinsabzeichen.",
    clipPath: "polygon(0% 0%, 100% 0%, 100% 58%, 82% 84%, 50% 100%, 18% 84%, 0% 58%)",
    borderRadius: "0.35em 0.35em 0 0",
    padding: "0.7em 1.25em 1.7em",
  },
  {
    id: "wolke",
    label: "Wolke",
    beschreibung: "Weiche Dampfwolke: eine Blase mit ungleichen Elliptik-Radien, der zwei runde Ausbuchtungen oben links und oben rechts hinterlegt sind.",
    clipPath: "",
    borderRadius: "54% 46% 50% 50% / 60% 64% 36% 40%",
    padding: "1.05em 1.6em 0.95em",
  },
  {
    id: "banner-schwalbenschwanz",
    label: "Banner mit Schwalbenschwanz",
    beschreibung: "Querband, dessen beide Enden mit einem V nach innen eingekerbt sind — ein Wimpel, wie er ueber einer Saunatuer haengt.",
    clipPath: "polygon(0% 0%, 100% 0%, 93% 50%, 100% 100%, 0% 100%, 7% 50%)",
    borderRadius: "0.2em",
    padding: "0.6em 2.1em",
  },
  {
    id: "sechseck",
    label: "Sechseck",
    beschreibung: "Liegendes Hexagon mit flacher Ober- und Unterkante und zwei Spitzen an den Seiten — technisch-nuechtern, wie ein Werkzeugstempel.",
    clipPath: "polygon(7% 0%, 93% 0%, 100% 50%, 93% 100%, 7% 100%, 0% 50%)",
    borderRadius: "0.2em",
    padding: "0.6em 1.9em",
  },
  {
    id: "sprechblase",
    label: "Sprechblase",
    beschreibung: "Kantige Comic-Blase mit einem schmalen Zipfel, der links unten aus der Unterkante nach unten zeigt — der Spruch wirkt gesprochen.",
    clipPath: "polygon(0% 0%, 100% 0%, 100% 78%, 34% 78%, 24% 100%, 20% 78%, 0% 78%)",
    borderRadius: "0.45em",
    padding: "0.7em 1.2em 1.5em",
  },
  {
    id: "ticket-kerbe",
    label: "Ticket mit Kerben",
    beschreibung: "Eintrittskarte: rechteckig, aber links und rechts auf halber Hoehe je eine dreieckige Kerbe nach innen, wie von einer Lochzange.",
    clipPath: "polygon(0% 0%, 100% 0%, 100% 36%, 95% 50%, 100% 64%, 100% 100%, 0% 100%, 0% 64%, 5% 50%, 0% 36%)",
    borderRadius: "0.25em",
    padding: "0.6em 1.7em",
  },
  {
    id: "holzschild",
    label: "Holzschild",
    beschreibung: "Gefaste Bohle mit leicht abgeschraegten Ecken oben und unten, dazu zwei kleine Nagelkoepfe links und rechts — ein Schild, wie es in der Saunakabine haengt.",
    clipPath: "polygon(3% 0%, 97% 0%, 100% 18%, 100% 82%, 97% 100%, 3% 100%, 0% 82%, 0% 18%)",
    borderRadius: "0.3em",
    padding: "0.8em 1.5em",
  },
];

export const DEKOS: { id: DekoId; label: string; beschreibung: string }[] = [
  { id: "weihnachten", label: "Weihnachtsmann", beschreibung: "Ein kleiner Weihnachtsmann sitzt auf der oberen Schildkante, baumelt mit den Beinen und lässt links und rechts am Rand bunte Geschenkpäckchen über das Schild nach unten regnen." },
  { id: "winter-schnee", label: "Winter — Schneefall", beschreibung: "Auf der Oberkante des Schildes liegt eine feine, leicht ueberhaengende Schneekante mit ein paar Tropfnasen und zwei ganz langsam aufblitzenden Eisfunkeln, waehrend fuenf einzelne Flocken — drei zarte Kristalle, zwei winzige Punkte — links und rechts am Rand ruhig nach unten segeln und die Textmitte voellig frei lassen." },
  { id: "herbst-blaetter", label: "Herbstlaub", beschreibung: "Vier kleine Ahorn- und Eichenblaetter in warmen Rost- und Bernsteintoenen trudeln links und rechts am Schild vorbei nach unten, waehrend zwei Blaetter an den Ecken sanft wippen und ein unbewegter warmer Schimmer die Raender faerbt." },
  { id: "fruehling-blueten-zweig", label: "Frühling – Blütenblätter & Knospenzweig", beschreibung: "Ein zarter Knospenzweig legt sich von der oberen linken Ecke über die Schildkante und wiegt sich kaum merklich, während an den Rändern vier helle Blütenblätter langsam herabsegeln — die Mitte mit Name und Spruch bleibt völlig frei." },
  { id: "sommer-sonnenrad", label: "Sommer — Sonnenrad", beschreibung: "Eine kleine warme Sonne sitzt auf der oberen rechten Ecke des Schildes, dreht ihre Strahlen sehr langsam und atmet leicht; darunter steigen am rechten Rand drei zarte Wärmeflimmer-Fäden nach oben." },
];

export const FORM_BY_ID: Record<string, NameplateForm> =
  Object.fromEntries(FORMEN.map((f) => [f.id, f]));

// ── Konfiguration ────────────────────────────────────────────────────────
export type NameplateConfig = {
  form: string;
  /** Hintergrundfarbe als #rrggbb. */
  bg: string;
  /** Transparenz des Hintergrunds, 0 = ganz durchsichtig, 1 = deckend. */
  bgAlpha: number;
  rahmen: string;
  textName: string;
  textSlogan: string;
  deko: DekoId | null;
};

/** Vorgabe für alle, die nie etwas eingestellt haben. Bewusst das ruhige
 *  Klarglas: es funktioniert auf jedem Karten-Motiv. */
export const NAMEPLATE_VORGABE: NameplateConfig = {
  form: 'pille',
  bg: '#ffffff',
  bgAlpha: 0.62,
  rahmen: '#ffffff',
  textName: '#0f172a',
  textSlogan: '#475569',
  deko: null,
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Liest eine Konfiguration aus der DB und füllt alles Fehlende auf.
 *  Jeder einzelne Wert wird geprüft — Alt-Daten, halb gespeicherte Objekte
 *  und später entfernte Formen dürfen die Tafel nicht kippen. */
export function nameplateAus(raw: unknown): NameplateConfig {
  const v = NAMEPLATE_VORGABE;
  if (!raw || typeof raw !== 'object') return v;
  const o = raw as Record<string, unknown>;
  const hex = (x: unknown, fb: string) => (typeof x === 'string' && HEX.test(x) ? x : fb);
  const alpha = typeof o.bgAlpha === 'number' && o.bgAlpha >= 0 && o.bgAlpha <= 1
    ? o.bgAlpha : v.bgAlpha;
  const form = typeof o.form === 'string' && FORM_BY_ID[o.form] ? o.form : v.form;
  const deko = typeof o.deko === 'string' && DEKOS.some((d) => d.id === o.deko)
    ? (o.deko as DekoId) : null;
  return {
    form,
    bg: hex(o.bg, v.bg),
    bgAlpha: alpha,
    rahmen: hex(o.rahmen, v.rahmen),
    textName: hex(o.textName, v.textName),
    textSlogan: hex(o.textSlogan, v.textSlogan),
    deko,
  };
}

/** #rrggbb + Alpha → rgba(). */
export function rgba(hex: string, alpha: number): string {
  const h = HEX.test(hex) ? hex : '#ffffff';
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── Lesbarkeit ───────────────────────────────────────────────────────────
// Der User darf die Schriftfarben frei wählen — „ausser sie wären nicht
// lesbar". Genau das prüft das hier, nach dem WCAG-Kontrastverhältnis.
//
// Die Krux: das Schild ist halbtransparent und liegt auf einem BELIEBIGEN
// Karten-Foto. Was am Ende hinter der Schrift steht, ist also nicht
// vorhersagbar. Deshalb wird gegen den ungünstigsten Fall gerechnet: der
// Hintergrund wird einmal über Weiss und einmal über Schwarz gemischt, und
// es zählt der SCHLECHTERE der beiden Kontraste. Eine Farbe gilt nur dann
// als lesbar, wenn sie auf hellen UND auf dunklen Motiven trägt.

function kanal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function leuchtdichte(r: number, g: number, b: number): number {
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}
function zerlege(hex: string): [number, number, number] {
  const h = HEX.test(hex) ? hex : '#000000';
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function mische(vorn: string, alpha: number, hinten: number): [number, number, number] {
  const [r, g, b] = zerlege(vorn);
  return [
    r * alpha + hinten * (1 - alpha),
    g * alpha + hinten * (1 - alpha),
    b * alpha + hinten * (1 - alpha),
  ];
}
function verhaeltnis(a: [number, number, number], b: [number, number, number]): number {
  const la = leuchtdichte(a[0], a[1], a[2]);
  const lb = leuchtdichte(b[0], b[1], b[2]);
  const [hell, dunkel] = la > lb ? [la, lb] : [lb, la];
  return (hell + 0.05) / (dunkel + 0.05);
}

/** Schlechtester Kontrast der Schriftfarbe gegen das Schild — einmal über
 *  weissem, einmal über schwarzem Untergrund gerechnet. */
export function kontrastWert(text: string, bg: string, bgAlpha: number): number {
  const t = zerlege(text) as [number, number, number];
  const ueberWeiss = mische(bg, bgAlpha, 255);
  const ueberSchwarz = mische(bg, bgAlpha, 0);
  return Math.min(verhaeltnis(t, ueberWeiss), verhaeltnis(t, ueberSchwarz));
}

/** 4.5:1 ist die WCAG-Schwelle für normalen Text. Auf einem Fernseher, den
 *  man aus mehreren Metern liest, ist das eher die Untergrenze als ein Ziel. */
export const KONTRAST_SCHWELLE = 4.5;

export function istLesbar(text: string, bg: string, bgAlpha: number): boolean {
  return kontrastWert(text, bg, bgAlpha) >= KONTRAST_SCHWELLE;
}

/** Farbvorschläge für die Auswahl — bewusst eine überschaubare Palette
 *  statt eines freien Farbrads: auf einer Tafel, die 24/7 vor Gästen hängt,
 *  sind zehn abgestimmte Töne mehr wert als 16 Millionen. */
export const FARBEN: { hex: string; label: string }[] = [
  { hex: '#ffffff', label: 'Weiss' },
  { hex: '#0f172a', label: 'Nachtblau' },
  { hex: '#475569', label: 'Schiefer' },
  { hex: '#b91c1c', label: 'Glutrot' },
  { hex: '#ea580c', label: 'Bernstein' },
  { hex: '#ca8a04', label: 'Gold' },
  { hex: '#15803d', label: 'Tannengruen' },
  { hex: '#0e7490', label: 'Petrol' },
  { hex: '#1e3a8a', label: 'Tiefblau' },
  { hex: '#7e22ce', label: 'Beere' },
];
