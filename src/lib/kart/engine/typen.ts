// Sauna-Kart-Engine: gemeinsame Typen und Konstanten (Grand-Prix-Fassung, 25.09.2026).
//
// Die Engine ist reines TypeScript ohne DOM und ohne React: Physik, KI und
// Items laufen auch im Test unter Node. Der Renderer (render.ts) und die
// Oberfläche (KartRennen.tsx) lesen den Zustand nur.

import type { KartStrecke, StreckenGeometrie } from '../strecken';

export type Klasse = 60 | 80 | 100;
export type Modus = 'gp' | 'zeitfahren';

/** Die drei Klassen heißen wie Saunatemperaturen. */
export const KLASSEN: Record<Klasse, {
  name: string; kurz: string; vMax: number;
  /** Tempo-Anteil der Computerfahrer (von … bis, je nach Persönlichkeit). */
  kiSkill: [number, number];
  /** Wie oft Computerfahrer in Kurven driften (0…1). */
  kiDrift: number;
  /** Wie stark das Feld zusammengehalten wird (Gummiband). */
  gummi: number;
}> = {
  60: { name: '60° · Aufwärmen', kurz: '60°', vMax: 112, kiSkill: [0.84, 0.92], kiDrift: 0.25, gummi: 0.10 },
  80: { name: '80° · Klassisch', kurz: '80°', vMax: 132, kiSkill: [0.9, 0.97], kiDrift: 0.6, gummi: 0.08 },
  100: { name: '100° · Finnisch', kurz: '100°', vMax: 150, kiSkill: [0.95, 1.0], kiDrift: 0.9, gummi: 0.06 },
};

export type ItemTyp = 'minze' | 'minze3' | 'seife' | 'filzhut' | 'eiskugel' | 'glutstern' | 'dampf' | 'aufguss';

export const ITEM_INFO: Record<ItemTyp, { name: string; icon: string; hilfe: string }> = {
  minze: { name: 'Minz-Schub', icon: '🌿', hilfe: 'Kurzer Turbo — auch quer durchs Gras.' },
  minze3: { name: '3× Minze', icon: '🌿', hilfe: 'Drei Turbos nacheinander.' },
  seife: { name: 'Schmierseife', icon: '🧼', hilfe: 'Fällt hinter dir auf die Bahn. Wer drüberfährt, dreht sich.' },
  filzhut: { name: 'Filzhut', icon: '🎩', hilfe: 'Fliegt geradeaus und prallt von der Bande ab.' },
  eiskugel: { name: 'Eiskugel', icon: '🧊', hilfe: 'Sucht sich den Fahrer direkt vor dir.' },
  glutstern: { name: 'Glutstern', icon: '🌟', hilfe: 'Unverwundbar und schneller — rempel alle weg.' },
  dampf: { name: 'Dampfwolke', icon: '💨', hilfe: 'Nebelt alle ein, die vor dir fahren.' },
  aufguss: { name: 'Aufguss!', icon: '🧖', hilfe: 'Ein Aufguss für alle anderen: sie werden langsam.' },
};

/** Eingabe eines Fahrers für einen Physik-Schritt. `lenk` ist analog
 *  (−1…1); `digital` sagt, ob sie von Tasten/Tipp-Hälften kommt (dann formt
 *  die Physik sie mit Anlauf und Auslauf). `item` ist eine Flanke. */
export interface Eingabe {
  lenk: number; digital: boolean; drift: boolean; item: boolean;
  /** Gas 0…1 — nur die Computerfahrer nehmen vor engen Kurven Gas weg;
   *  der Spieler fährt mit Vollgas (Automatik wie beim Handy-Vorbild). */
  gas?: number;
}

export const LEERE_EINGABE: Eingabe = { lenk: 0, digital: false, drift: false, item: false };

export interface KiZustand {
  skill: number;
  spur: number;          // seitliche Lage auf der Bahn (−1…1 der halben Breite)
  spurZiel: number;
  spurWechselIn: number; // Sekunden bis zur nächsten freien Spurwahl
  driftHalten: boolean;
  itemTimer: number;
  fehlerRest: number;    // kurzer Patzer (Schlenker) — gibt dem Feld Leben
  fehlerRichtung: number;
  persoenlichkeit: number; // 0…1: 0 = vorsichtig, 1 = draufgängerisch
}

export interface Fahrer {
  nr: number;            // Index im Feld (fest für das ganze Rennen)
  name: string;
  skin: number;          // Handtuch-Farbe (assets.ts)
  istSpieler: boolean;
  x: number; y: number;
  richtung: number;      // Blickrichtung (Nase)
  fahrWinkel: number;    // Bewegungsrichtung — hinkt der Nase nach (Drift)
  v: number;
  lenkPhys: number;      // geformte Lenk-Eingabe
  lenkGlatt: number;     // geglättet für Pose und Kamera
  driftKnopf: boolean;   // Zustand im letzten Schritt (Flanken)
  hopRest: number;
  driftBereit: boolean;
  driftAktiv: boolean;
  driftSeite: number;    // −1 / 1
  driftLadung: number;   // Sekunden
  driftStufe: number;    // 0…3 (blau, orange, lila)
  boostRest: number;
  boostStaerke: number;
  sternRest: number;
  taumelRest: number;    // Dreher nach Treffer
  taumelDreh: number;    // rein optisch
  schonfrist: number;
  flugRest: number;
  flugDauer: number;
  trickMoeglich: boolean;
  trick: boolean;
  langsamRest: number;
  langsamFaktor: number;
  nebelRest: number;     // nur Spieler: Dampf vor der Linse
  glutRest: number;      // zischt gerade auf Glut (Optik/Ton)
  muenzen: number;
  item: ItemTyp | null;
  itemAnzahl: number;
  roulette: number;      // Sekunden, solange die Kiste „würfelt"
  fortschritt: number;   // in Linien-Indizes, monoton, startet negativ (Startaufstellung)
  letzterIdx: number;
  runde: number;
  fertig: boolean;
  zielZeitMs: number | null;
  platz: number;         // 1…n, jeden Schritt neu
  wandKontakt: boolean;
  letzterMaskenWert: number;
  startKnopfAb: number | null; // Countdown-Stand beim Drücken (Raketenstart)
  fehlstart: number;
  ki: KiZustand | null;
  rempelSperre: number;
}

export interface Kiste { x: number; y: number; weg: number; phase: number; }
export interface Tropfen { x: number; y: number; weg: number; phase: number; }

export interface Geschoss {
  art: 'filzhut' | 'eiskugel';
  x: number; y: number; vx: number; vy: number;
  lebt: number;          // Sekunden Restlebensdauer
  von: number;           // Werfer (Fahrer-Nr.)
  ziel: number;          // Fahrer-Nr. oder −1
  idx: number;           // Streckenindex (Eiskugel folgt der Bahn)
  schutz: number;        // Sekunden, in denen der Werfer nicht getroffen wird
  abpraller: number;
}

export interface Falle { art: 'seife'; x: number; y: number; lebt: number; von: number; schutz: number; }

export type EreignisArt =
  | 'countdown' | 'start' | 'startBoost' | 'fehlstart'
  | 'kiste' | 'item' | 'itemWeg' | 'minze' | 'turbo' | 'miniturbo' | 'driftStart' | 'driftStufe'
  | 'hop' | 'sprung' | 'landung' | 'trick' | 'bande' | 'rempler' | 'treffer' | 'stamm'
  | 'tropfen' | 'wurf' | 'seifeAb' | 'stern' | 'sternEnde' | 'dampf' | 'aufguss' | 'glut'
  | 'runde' | 'letzteRunde' | 'ziel' | 'ueberholt' | 'zurueckgefallen' | 'rennEnde';

export interface Ereignis { art: EreignisArt; fahrer: number; wert?: number; }

export interface GeistDaten {
  name: string;
  zeitMs: number;
  skin: number;
  /** Aufzeichnung: [x*10, y*10, richtung*100] im Takt dt (ms). */
  dt: number;
  pts: [number, number, number][];
}

export interface FahrerSetup { name: string; skin: number; istSpieler: boolean; persoenlichkeit?: number; }

export interface RennSetup {
  strecke: KartStrecke;
  geo: StreckenGeometrie;
  modus: Modus;
  klasse: Klasse;
  /** Startaufstellung: Index 0 = Pole-Position. */
  fahrer: FahrerSetup[];
  saat: number;
  lenkhilfe: boolean;
  autoDrift: boolean;
  geister?: GeistDaten[];
}

export type RennPhase = 'intro' | 'countdown' | 'rennen' | 'auslauf' | 'fertig';

export interface RennErgebnis {
  /** Fahrer-Nr. in Zielreihenfolge. */
  reihenfolge: number[];
  zeiten: (number | null)[]; // je Fahrer-Nr.
  spielerPlatz: number;
  spielerZeitMs: number | null;
  rundenZeiten: number[];    // Spieler
  geist?: { dt: number; pts: [number, number, number][] };
}

/** Was Physik, KI und Items vom Rennen sehen (die Klasse Rennen erfüllt es). */
export interface RennKern {
  setup: RennSetup;
  geo: StreckenGeometrie;
  vMax: number;
  fahrer: Fahrer[];
  kisten: Kiste[];
  tropfen: Tropfen[];
  geschosse: Geschoss[];
  fallen: Falle[];
  zeitMs: number;
  rnd: () => number;
  melde(art: EreignisArt, fahrer: number, wert?: number): void;
}

/** Schub geben, ohne einen stärkeren laufenden Schub abzuschwächen. */
export function schub(f: Fahrer, dauer: number, staerke: number) {
  f.boostStaerke = f.boostRest > 0 ? Math.max(f.boostStaerke, staerke) : staerke;
  f.boostRest = Math.max(f.boostRest, dauer);
}

export function wrapWinkel(w: number): number {
  while (w > Math.PI) w -= Math.PI * 2;
  while (w < -Math.PI) w += Math.PI * 2;
  return w;
}

export function begrenze(x: number, min = -1, max = 1): number {
  return x < min ? min : x > max ? max : x;
}

/** Punkte je Platz im Grand Prix (wie beim Vorbild). */
export const GP_PUNKTE = [15, 12, 10, 8, 6, 4, 2, 1];

export const INTRO_MS = 1600;
export const COUNTDOWN_MS = 3000;
export const AUSLAUF_MS = 8000;
export const PHYSIK_DT = 1 / 120;
export const GEIST_DT_MS = 100;
