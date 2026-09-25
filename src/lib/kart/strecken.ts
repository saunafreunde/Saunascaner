// Sauna-Kart: die Strecken (Grand-Prix-Fassung, 25.09.2026).
//
// Eine Strecke ist eine geschlossene Catmull-Rom-Kurve aus Kontrollpunkten in
// Welt-Koordinaten (0…1024, dieselbe Skala wie die Bodentextur). Aus ihr
// entstehen beim Laden:
//   1. die GEOMETRIE (pure, ohne DOM — die Engine und die Tests brauchen nur
//      sie): dichte Mittellinie + Oberflächen-Maske (1 Byte pro Texel),
//   2. die Bodentextur (Canvas, nur im Browser) — gemalt aus GENAU derselben
//      Geometrie, nie umgekehrt.
//
// Alle Positionsangaben (Felder, Stämme, Item-Kisten, Tropfen) sind Indizes
// auf der 720er-Mittellinie. Damit bleibt die Dramaturgie einer Runde lesbar:
// „Turbo bei 90, Rampe bei 296, Pfütze dahinter".

/** Werte der Oberflächen-Maske — die Physik liest daraus, WAS unter den Kufen liegt. */
export const M_WAND = 0;      // jenseits der Schulter: Bande, hier fährt niemand
export const M_BAHN = 1;
export const M_TURBO = 2;
export const M_BREMS = 3;     // dampfende Aufguss-Pfütze
export const M_RAMPE = 4;
export const M_PFAD = 5;      // geheime Abkürzung: fahrbar, schmal
export const M_SCHULTER = 6;  // zäher Streifen vor der Bande: fahrbar, langsam
export const M_EIS = 7;       // Eisplatte: volles Tempo, aber kaum Grip
export const M_GLUT = 8;      // glühende Saunasteine: bremst und zischt

export const TEX_SIZE = 1024;
export const LINIEN_PUNKTE = 720;

export type FeldTyp = 'turbo' | 'brems' | 'rampe' | 'eis' | 'glut';

/** Ein Bodenfeld: beginnt bei Mittellinien-Index `idx`, läuft `laenge`
 *  Indizes weit. `quer` verschiebt es seitlich (−1…1 der halben Breite),
 *  `anteil` ist seine halbe Breite relativ zur Bahn (Standard 0,85). */
export interface StreckenFeld { typ: FeldTyp; idx: number; laenge: number; quer?: number; anteil?: number; }

/** Rollender Baumstamm: pendelt quer über die Bahn bei `idx`. Position ist
 *  eine PURE Funktion der Rennzeit — Geister hatten dieselben Stämme. */
export interface StammPlan { idx: number; periodeMs: number; phase: number; }

/** Geheime Abkürzung: Sehne von Index `von` nach `bis` über eine konvexe Kurve. */
export interface Abkuerzung { von: number; bis: number; }

/** Reihe Aufguss-Kisten quer über die Bahn (vier Stück). */
export interface KistenReihe { idx: number; }

/** Duft-Tropfen (die Münzen des Spiels): `anzahl` Stück ab `idx` im Abstand
 *  von 5 Indizes, seitlich bei `quer` (−1…1). */
export interface TropfenReihe { idx: number; quer: number; anzahl: number; }

export type ThemaId = 'wald' | 'dorf' | 'winter' | 'glut';

export interface KartStrecke {
  id: string;
  name: string;
  /** Ein Satz fürs Menü: was diese Strecke ausmacht. */
  kurz: string;
  punkte: [number, number][];
  /** Halbe Fahrbahnbreite in Welteinheiten. */
  breite: number;
  runden: number;
  thema: ThemaId;
  wiese: string;
  bahn: string;
  bande: string;
  bandeAkzent: string;
  /** Schlüssel der fal.ai-Bodentextur (assets.ts) oder null = gemalt. */
  boden: 'holzsteg' | 'waldweg' | null;
  felder: StreckenFeld[];
  staemme: StammPlan[];
  abkuerzungen: Abkuerzung[];
  kisten: KistenReihe[];
  tropfen: TropfenReihe[];
}

export const STRECKEN: KartStrecke[] = [
  {
    id: 'kelo',
    name: 'Kelo-Kurve',
    kurz: 'Weiter Rundkurs über den Holzsteg — gutmütig, mit Sprung über die Pfütze.',
    punkte: [
      [512, 140], [760, 180], [880, 360], [860, 560],
      [700, 700], [740, 860], [560, 900], [360, 840],
      [200, 700], [150, 500], [220, 300], [360, 180],
    ],
    breite: 48,
    runden: 3,
    thema: 'wald',
    wiese: '#2f4a2c',
    bahn: '#8a6b4d',
    bande: '#e8dcc4',
    bandeAkzent: '#c23b34',
    boden: 'holzsteg',
    felder: [
      { typ: 'turbo', idx: 90, laenge: 14 },
      // Rampe auf der Geraden hinter der Kehre — im Bogen würde der Sprung
      // geradeaus ins Aus tragen (Simulation 25.09.: 139 Bandenkontakte dort).
      { typ: 'rampe', idx: 336, laenge: 8 },
      { typ: 'brems', idx: 353, laenge: 14 },
      { typ: 'turbo', idx: 560, laenge: 14 },
    ],
    staemme: [
      { idx: 210, periodeMs: 5200, phase: 0.15 },
      { idx: 470, periodeMs: 6400, phase: 0.6 },
    ],
    abkuerzungen: [{ von: 386, bis: 470 }],
    kisten: [{ idx: 150 }, { idx: 360 }, { idx: 620 }],
    tropfen: [
      { idx: 40, quer: -0.45, anzahl: 5 },
      { idx: 240, quer: 0.4, anzahl: 5 },
      { idx: 520, quer: -0.35, anzahl: 5 },
      { idx: 670, quer: 0.3, anzahl: 4 },
    ],
  },
  {
    id: 'blockhaus',
    name: 'Blockhaus-Passage',
    kurz: 'Enge Passage zwischen den Hütten — zwei Richtungswechsel und drei Stämme.',
    punkte: [
      [512, 120], [740, 170], [850, 330], [780, 480],
      [600, 520], [500, 640], [560, 790], [430, 890],
      [260, 830], [180, 660], [260, 520], [420, 470],
      [480, 350], [370, 240],
    ],
    breite: 40,
    runden: 3,
    thema: 'dorf',
    wiese: '#2c4433',
    bahn: '#7d6247',
    bande: '#dfd5bd',
    bandeAkzent: '#c23b34',
    boden: 'waldweg',
    felder: [
      { typ: 'turbo', idx: 150, laenge: 14 },
      { typ: 'rampe', idx: 424, laenge: 8 },
      { typ: 'brems', idx: 444, laenge: 14 },
      { typ: 'turbo', idx: 620, laenge: 14 },
    ],
    staemme: [
      { idx: 250, periodeMs: 4800, phase: 0.0 },
      { idx: 530, periodeMs: 5800, phase: 0.45 },
      { idx: 680, periodeMs: 7000, phase: 0.8 },
    ],
    abkuerzungen: [{ von: 62, bis: 140 }],
    kisten: [{ idx: 200 }, { idx: 380 }, { idx: 580 }],
    tropfen: [
      { idx: 30, quer: 0.4, anzahl: 5 },
      { idx: 300, quer: -0.4, anzahl: 5 },
      { idx: 480, quer: 0.35, anzahl: 5 },
      { idx: 650, quer: -0.3, anzahl: 4 },
    ],
  },
  {
    id: 'eisbach',
    name: 'Eisbach-Kanal',
    kurz: 'Vom Tauchbecken in den Schnee — Eisplatten ohne Grip, Drift ist Pflicht.',
    punkte: [
      [512, 110], [790, 140], [910, 290], [850, 450],
      [670, 470], [590, 570], [690, 690], [880, 720],
      [880, 880], [640, 930], [380, 890], [180, 780],
      [120, 560], [230, 390], [170, 240], [320, 120],
    ],
    breite: 46,
    runden: 3,
    thema: 'winter',
    wiese: '#dfe9ef',
    bahn: '#a9c3d2',
    bande: '#f4fbff',
    bandeAkzent: '#3b7fc2',
    boden: null,
    felder: [
      { typ: 'eis', idx: 150, laenge: 40, anteil: 0.95 },
      { typ: 'eis', idx: 330, laenge: 30, quer: 0.35, anteil: 0.6 },
      { typ: 'turbo', idx: 385, laenge: 14 },
      { typ: 'rampe', idx: 425, laenge: 8 },
      { typ: 'brems', idx: 443, laenge: 12 },
      { typ: 'turbo', idx: 505, laenge: 14 },
      { typ: 'eis', idx: 600, laenge: 36, quer: -0.3, anteil: 0.65 },
    ],
    staemme: [
      { idx: 540, periodeMs: 5600, phase: 0.3 },
    ],
    abkuerzungen: [],
    kisten: [{ idx: 90 }, { idx: 280 }, { idx: 470 }, { idx: 660 }],
    tropfen: [
      { idx: 60, quer: 0.45, anzahl: 5 },
      { idx: 230, quer: -0.4, anzahl: 5 },
      { idx: 490, quer: 0.4, anzahl: 5 },
      { idx: 690, quer: 0.3, anzahl: 4 },
    ],
  },
  {
    id: 'glutofen',
    name: 'Glut-Ofen',
    kurz: 'Durch den Saunaofen — glühende Steine, zwei Sprünge, enge Kehren.',
    punkte: [
      [512, 120], [770, 120], [910, 240], [890, 420],
      [730, 480], [610, 410], [470, 470], [490, 630],
      [690, 650], [870, 760], [810, 920], [560, 930],
      [380, 850], [300, 700], [150, 630], [130, 420],
      [250, 300], [330, 170],
    ],
    breite: 42,
    runden: 3,
    thema: 'glut',
    wiese: '#231b19',
    bahn: '#5d4c43',
    bande: '#2b2320',
    bandeAkzent: '#f08020',
    boden: null,
    felder: [
      { typ: 'turbo', idx: 20, laenge: 14 },
      { typ: 'glut', idx: 180, laenge: 18, quer: 0.45, anteil: 0.5 },
      { typ: 'rampe', idx: 305, laenge: 8 },
      { typ: 'glut', idx: 323, laenge: 14 },
      { typ: 'rampe', idx: 425, laenge: 8 },
      { typ: 'glut', idx: 443, laenge: 16 },
      { typ: 'turbo', idx: 462, laenge: 14 },
      { typ: 'glut', idx: 540, laenge: 18, quer: -0.45, anteil: 0.5 },
    ],
    staemme: [
      { idx: 205, periodeMs: 5000, phase: 0.1 },
      { idx: 600, periodeMs: 6200, phase: 0.55 },
    ],
    abkuerzungen: [],
    kisten: [{ idx: 90 }, { idx: 360 }, { idx: 620 }],
    tropfen: [
      { idx: 150, quer: -0.4, anzahl: 5 },
      { idx: 400, quer: 0.4, anzahl: 5 },
      { idx: 560, quer: 0.35, anzahl: 4 },
      { idx: 680, quer: -0.35, anzahl: 4 },
    ],
  },
];

export const STRECKE_BY_ID: Record<string, KartStrecke> =
  Object.fromEntries(STRECKEN.map((s) => [s.id, s]));

// ─── Catmull-Rom-Abtastung ───────────────────────────────────────────────────

export interface LinienPunkt { x: number; y: number; winkel: number; }

/** Geschlossene Catmull-Rom-Kurve, `n` im Parameter-Raum gleich verteilte
 *  Punkte samt Tangenten-Winkel. */
export function abtasten(punkte: [number, number][], n: number): LinienPunkt[] {
  const P = punkte;
  const k = P.length;
  const aus: LinienPunkt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * k;
    const seg = Math.floor(t);
    const u = t - seg;
    const p0 = P[(seg - 1 + k) % k], p1 = P[seg % k], p2 = P[(seg + 1) % k], p3 = P[(seg + 2) % k];
    const x = catmull(p0[0], p1[0], p2[0], p3[0], u);
    const y = catmull(p0[1], p1[1], p2[1], p3[1], u);
    const dx = catmullAbl(p0[0], p1[0], p2[0], p3[0], u);
    const dy = catmullAbl(p0[1], p1[1], p2[1], p3[1], u);
    aus.push({ x, y, winkel: Math.atan2(dy, dx) });
  }
  return aus;
}

function catmull(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
}

function catmullAbl(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t;
  return 0.5 * ((c - a) + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (3 * b - a - 3 * c + d) * t2);
}

/** Punkt quer zur Mittellinie: `quer` in Welteinheiten, + = rechts in Fahrtrichtung. */
export function querPunkt(linie: LinienPunkt[], idx: number, quer: number): { x: number; y: number; winkel: number } {
  const n = linie.length;
  const p = linie[((Math.round(idx) % n) + n) % n];
  return { x: p.x - Math.sin(p.winkel) * quer, y: p.y + Math.cos(p.winkel) * quer, winkel: p.winkel };
}

export function wrapIdx(i: number, n: number): number {
  return ((i % n) + n) % n;
}

// ─── Geometrie: Mittellinie + Maske (pure, ohne DOM) ─────────────────────────

export interface StreckenGeometrie {
  strecke: KartStrecke;
  linie: LinienPunkt[];
  /** Oberflächen-Maske, Index = y * TEX_SIZE + x. */
  maske: Uint8Array;
  /** Länge einer Runde in Welteinheiten. */
  laenge: number;
}

const geoCache = new Map<string, StreckenGeometrie>();

export function bauGeometrie(strecke: KartStrecke): StreckenGeometrie {
  const hit = geoCache.get(strecke.id);
  if (hit) return hit;
  const linie = abtasten(strecke.punkte, LINIEN_PUNKTE);
  const n = linie.length;
  let laenge = 0;
  for (let i = 0; i < n; i++) {
    const a = linie[i], b = linie[(i + 1) % n];
    laenge += Math.hypot(b.x - a.x, b.y - a.y);
  }

  // Maske aus der GEOMETRIE (Abstand zur Mittellinie), nicht aus Pixeln —
  // die Physik hängt nicht an Anti-Aliasing-Zufällen. Raster mit Punktlisten.
  const maske = new Uint8Array(TEX_SIZE * TEX_SIZE);
  const zellen = 32;
  const raster: number[][] = Array.from({ length: zellen * zellen }, () => []);
  linie.forEach((p, i) => {
    const gx = Math.min(zellen - 1, Math.max(0, Math.floor((p.x / TEX_SIZE) * zellen)));
    const gy = Math.min(zellen - 1, Math.max(0, Math.floor((p.y / TEX_SIZE) * zellen)));
    raster[gy * zellen + gx].push(i);
  });
  const reichweite = strecke.breite + 8;
  const r2 = reichweite * reichweite;
  for (let y = 0; y < TEX_SIZE; y += 2) {
    for (let x = 0; x < TEX_SIZE; x += 2) {
      const gx = Math.floor((x / TEX_SIZE) * zellen);
      const gy = Math.floor((y / TEX_SIZE) * zellen);
      let drin = 0;
      aussen:
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const cx = gx + ox, cy = gy + oy;
          if (cx < 0 || cy < 0 || cx >= zellen || cy >= zellen) continue;
          for (const idx of raster[cy * zellen + cx]) {
            const p = linie[idx];
            const dx = p.x - x, dy = p.y - y;
            if (dx * dx + dy * dy <= r2) { drin = 1; break aussen; }
          }
        }
      }
      const i0 = y * TEX_SIZE + x;
      maske[i0] = drin; maske[i0 + 1] = drin;
      maske[i0 + TEX_SIZE] = drin; maske[i0 + TEX_SIZE + 1] = drin;
    }
  }

  const stempel = (cx: number, cy: number, r: number, wert: number, nurBahn: boolean) => {
    const r2s = r * r;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(TEX_SIZE - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(TEX_SIZE - 1, Math.ceil(cy + r));
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - cx, dy = yy - cy;
        if (dx * dx + dy * dy > r2s) continue;
        const i = yy * TEX_SIZE + xx;
        if (!nurBahn || maske[i] === M_BAHN) maske[i] = wert;
      }
    }
  };

  // Bodenfelder — dieselbe Geometrie, mit der textur.ts sie malt.
  for (const feld of strecke.felder) {
    const wert = feldMaskenWert(feld.typ);
    const anteil = feld.anteil ?? 0.85;
    for (let k = 0; k <= feld.laenge; k++) {
      const p = querPunkt(linie, feld.idx + k, (feld.quer ?? 0) * strecke.breite);
      stempel(p.x, p.y, strecke.breite * anteil, wert, true);
    }
  }

  for (const ab of strecke.abkuerzungen) {
    const a = linie[ab.von], b = linie[ab.bis];
    const schritte = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6);
    for (let k = 0; k <= schritte; k++) {
      const t = k / schritte;
      stempel(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 17, M_PFAD, false);
    }
  }

  // Schulter: zäher Streifen ZWISCHEN Bande und Wand — ein Fahrfehler kostet
  // Tempo, aber erst dahinter steht die Wand.
  const schulter = (cx: number, cy: number, r: number) => {
    const r2s = r * r;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(TEX_SIZE - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(TEX_SIZE - 1, Math.ceil(cy + r));
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - cx, dy = yy - cy;
        if (dx * dx + dy * dy > r2s) continue;
        const i = yy * TEX_SIZE + xx;
        if (maske[i] === M_WAND) maske[i] = M_SCHULTER;
      }
    }
  };
  for (const p of linie) schulter(p.x, p.y, strecke.breite + 30);
  for (const ab of strecke.abkuerzungen) {
    const a = linie[ab.von], b = linie[ab.bis];
    const schritte = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6);
    for (let k = 0; k <= schritte; k++) {
      const t = k / schritte;
      schulter(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 34);
    }
  }

  const geo = { strecke, linie, maske, laenge };
  geoCache.set(strecke.id, geo);
  return geo;
}

export function feldMaskenWert(typ: FeldTyp): number {
  switch (typ) {
    case 'turbo': return M_TURBO;
    case 'brems': return M_BREMS;
    case 'rampe': return M_RAMPE;
    case 'eis': return M_EIS;
    case 'glut': return M_GLUT;
  }
}

export function maskeBei(maske: Uint8Array, x: number, y: number): number {
  const mx = x < 0 ? 0 : x > TEX_SIZE - 1 ? TEX_SIZE - 1 : Math.round(x);
  const my = y < 0 ? 0 : y > TEX_SIZE - 1 ? TEX_SIZE - 1 : Math.round(y);
  return maske[my * TEX_SIZE + mx];
}

/** Deterministischer Zufall — dieselbe Strecke sieht auf jedem Gerät gleich aus. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stabiler Hash einer Zeichenkette (Saat für Deko und Zufall je Strecke). */
export function hashText(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
