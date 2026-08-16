// Sauna-Kart: die Strecken.
//
// Eine Strecke ist eine geschlossene Catmull-Rom-Kurve aus Kontrollpunkten in
// Welt-Koordinaten (0…1024, dieselbe Skala wie die Bodentextur). Aus ihr
// entstehen beim Laden DREI Dinge:
//   1. die Bodentextur (programmatisch gezeichnet — Wiese, Holzsteg, Ränder,
//      Ziellinie; keine externen Assets, das Bundle bleibt leicht),
//   2. die Oberflächen-Maske (1 Byte pro Texel: fahrbar oder Wiese) für die
//      Physik — abgeleitet aus GENAU derselben Geometrie, nie aus Pixeln,
//   3. die Fortschritts-Punkte fürs Runden-Zählen (Checkpoint-Viertel).
//
// Importfrei bis auf nichts — dieselbe Regel wie bei den Katalog-Dateien:
// Engine und Renderer dürfen hierauf bauen, ohne api.ts oder React zu sehen.

export interface KartStrecke {
  id: string;
  name: string;
  /** Kontrollpunkte der Mittellinie (geschlossen). */
  punkte: [number, number][];
  /** Halbe Fahrbahnbreite in Welteinheiten. */
  breite: number;
  /** Startposition = erster Mittellinien-Punkt, Blickrichtung folgt der Kurve. */
  runden: number;
  /** Grundfarbe des Umlands und der Bahn — kleine Abweichungen je Strecke,
   *  damit man sie am Standbild auseinanderhält. */
  wiese: string;
  bahn: string;
  bande: string;
}

export const STRECKEN: KartStrecke[] = [
  {
    id: 'kelo_kurve',
    name: 'Kelo-Kurve',
    // Weiter Rundkurs mit einer engen Kehre unten rechts — als erste Strecke
    // bewusst gutmütig: breite Bahn, keine Doppel-Schikane.
    punkte: [
      [512, 140], [760, 180], [880, 360], [860, 560],
      [700, 700], [740, 860], [560, 900], [360, 840],
      [200, 700], [150, 500], [220, 300], [360, 180],
    ],
    breite: 46,
    runden: 2,
    wiese: '#2f4a2c',
    bahn: '#8a6b4d',
    bande: '#d8cdb8',
  },
  {
    id: 'blockhaus_passage',
    name: 'Blockhaus-Passage',
    // Achter-artige Passage mit zwei Richtungswechseln — schmaler, für die
    // zweite Woche, wenn die Kelo-Kurve auswendig gefahren ist.
    punkte: [
      [512, 120], [740, 170], [850, 330], [780, 480],
      [600, 520], [500, 640], [560, 790], [430, 890],
      [260, 830], [180, 660], [260, 520], [420, 470],
      [480, 350], [370, 240],
    ],
    breite: 38,
    runden: 2,
    wiese: '#2c4433',
    bahn: '#7d6247',
    bande: '#cfc5ae',
  },
];

export const STRECKE_BY_ID: Record<string, KartStrecke> =
  Object.fromEntries(STRECKEN.map((s) => [s.id, s]));

export const TEX_SIZE = 1024;

// ─── Catmull-Rom-Abtastung ───────────────────────────────────────────────────

/** Geschlossene Catmull-Rom-Kurve, `n` gleichmäßig (in Parameter-Raum)
 *  verteilte Punkte samt Tangenten-Winkel. */
export function abtasten(strecke: KartStrecke, n: number): { x: number; y: number; winkel: number }[] {
  const P = strecke.punkte;
  const k = P.length;
  const aus: { x: number; y: number; winkel: number }[] = [];
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

// ─── Textur + Maske bauen ────────────────────────────────────────────────────

export interface StreckenWelt {
  strecke: KartStrecke;
  textur: HTMLCanvasElement;
  /** 1 = fahrbar, 0 = Wiese. Index = y * TEX_SIZE + x. */
  maske: Uint8Array;
  /** Dichte Mittellinien-Punkte für Fortschritt/Start. */
  linie: { x: number; y: number; winkel: number }[];
}

export function bauStreckenWelt(
  strecke: KartStrecke,
  /** Optionale Bahn-Textur (fal.ai, 16.08.2026). Fehlt sie, wird die Bahn
   *  wie zuvor programmatisch gezeichnet — das Spiel hängt an keinem Asset. */
  bodenTextur?: CanvasImageSource | null,
): StreckenWelt {
  const linie = abtasten(strecke, 720);

  const textur = document.createElement('canvas');
  textur.width = TEX_SIZE;
  textur.height = TEX_SIZE;
  const ctx = textur.getContext('2d')!;

  // Wiese mit leichtem Rauschen — eine völlig flache Farbe flimmert im
  // Mode-7-Boden unangenehm, ein Muster gibt dem Auge Bewegungsanker.
  ctx.fillStyle = strecke.wiese;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  const rnd = mulberry32(0xa5f3);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 2600; i++) {
    ctx.fillRect(Math.floor(rnd() * TEX_SIZE), Math.floor(rnd() * TEX_SIZE), 2, 2);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  for (let i = 0; i < 2600; i++) {
    ctx.fillRect(Math.floor(rnd() * TEX_SIZE), Math.floor(rnd() * TEX_SIZE), 3, 2);
  }
  // Vereinzelte Tannen-Tupfer abseits der Bahn (reine Deko in der Textur).
  ctx.fillStyle = 'rgba(10,40,16,0.5)';
  for (let i = 0; i < 90; i++) {
    const x = rnd() * TEX_SIZE, y = rnd() * TEX_SIZE;
    ctx.beginPath(); ctx.arc(x, y, 5 + rnd() * 7, 0, Math.PI * 2); ctx.fill();
  }

  // Bahn: erst die helle Bande (breiter Strich), dann die Fahrbahn darüber —
  // übrig bleibt ein Saum auf beiden Seiten. Liegt eine Textur vor, wird die
  // Fahrbahn mit ihr als Muster gestrichen (0,25-fach skaliert → ~256px-
  // Kachelung, fein genug für den Mode-7-Blick).
  zeichneBahn(ctx, linie, strecke.breite + 8, strecke.bande);
  let mitTextur = false;
  if (bodenTextur) {
    const muster = ctx.createPattern(bodenTextur, 'repeat');
    if (muster) {
      if ('setTransform' in muster) {
        muster.setTransform(new DOMMatrix().scale(0.25));
      }
      zeichneBahn(ctx, linie, strecke.breite, muster);
      mitTextur = true;
    }
  }
  if (!mitTextur) {
    zeichneBahn(ctx, linie, strecke.breite, strecke.bahn);
  }

  // Steg-Fugen: Querstriche in Fahrtrichtung — geben im Mode-7-Blick das
  // Geschwindigkeitsgefühl, das eine glatte Fläche nicht erzeugt. Mit echter
  // Textur übernimmt deren Maserung diese Aufgabe.
  if (!mitTextur) {
    ctx.strokeStyle = 'rgba(60,40,25,0.4)';
    ctx.lineWidth = 3;
    for (let i = 0; i < linie.length; i += 8) {
      const p = linie[i];
      const qx = Math.cos(p.winkel + Math.PI / 2), qy = Math.sin(p.winkel + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(p.x - qx * strecke.breite, p.y - qy * strecke.breite);
      ctx.lineTo(p.x + qx * strecke.breite, p.y + qy * strecke.breite);
      ctx.stroke();
    }
  }

  // Ziellinie am Startpunkt: Schachbrett quer über die Bahn.
  const s0 = linie[0];
  const qx = Math.cos(s0.winkel + Math.PI / 2), qy = Math.sin(s0.winkel + Math.PI / 2);
  for (let seite = -1; seite <= 1; seite += 1) {
    for (let f = 0; f < 8; f++) {
      const a = -strecke.breite + (2 * strecke.breite * f) / 8;
      ctx.fillStyle = (f + (seite + 1)) % 2 === 0 ? '#f4efe4' : '#22201c';
      const cx = s0.x + qx * (a + strecke.breite / 8) + Math.cos(s0.winkel) * seite * 5;
      const cy = s0.y + qy * (a + strecke.breite / 8) + Math.sin(s0.winkel) * seite * 5;
      ctx.fillRect(cx - 5, cy - 5, 10, 10);
    }
  }

  // Maske aus der GEOMETRIE (Abstand zur Mittellinie), nicht aus Pixeln —
  // damit hängt die Physik nicht an Anti-Aliasing-Zufällen. Grobes Gitter
  // reicht: wir prüfen jeden Texel gegen die dichte Linie über ein
  // Nachbarschafts-Raster.
  const maske = new Uint8Array(TEX_SIZE * TEX_SIZE);
  const zellen = 32; // 32×32-Raster mit Punktlisten
  const raster: number[][] = Array.from({ length: zellen * zellen }, () => []);
  linie.forEach((p, i) => {
    const gx = Math.min(zellen - 1, Math.floor((p.x / TEX_SIZE) * zellen));
    const gy = Math.min(zellen - 1, Math.floor((p.y / TEX_SIZE) * zellen));
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
      // 2×2-Block füllen (wir tasten nur jeden zweiten Texel ab — die Maske
      // muss nicht pixelgenau sein, die Bande verzeiht ±2 Einheiten).
      const i0 = y * TEX_SIZE + x;
      maske[i0] = drin; maske[i0 + 1] = drin;
      maske[i0 + TEX_SIZE] = drin; maske[i0 + TEX_SIZE + 1] = drin;
    }
  }

  return { strecke, textur, maske, linie };
}

function zeichneBahn(
  ctx: CanvasRenderingContext2D,
  linie: { x: number; y: number }[],
  halbbreite: number,
  farbe: string | CanvasPattern,
) {
  ctx.strokeStyle = farbe;
  ctx.lineWidth = halbbreite * 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(linie[0].x, linie[0].y);
  for (let i = 1; i < linie.length; i++) ctx.lineTo(linie[i].x, linie[i].y);
  ctx.closePath();
  ctx.stroke();
}

/** Deterministischer Zufall für die Textur — dieselbe Strecke sieht auf jedem
 *  Gerät gleich aus (Geister fahren über denselben Boden). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
