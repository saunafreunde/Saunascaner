// Sauna-Kart: Grafiken — fal.ai-Bilder mit eingebautem Rückfall plus
// programmatisch gezeichnete Sprites (Grand-Prix-Fassung, 25.09.2026).
//
// Jedes Bild ist OPTIONAL: lädt es nicht (Offline-PWA, kaputte Datei), fällt
// das Spiel auf eine gezeichnete Fassung zurück. Der Lader liefert nie einen
// Fehler, höchstens `null` — das Rennen startet trotzdem.
//
// Acht Fahrer brauchen acht Handtuchfarben: creme, rost und blau gibt es als
// Bild; die übrigen fünf entstehen beim Laden aus dem blauen Schlitten, indem
// NUR die blauen Pixel (das Handtuch) im Farbton gedreht werden — Haut,
// Filzhut und Schneestaub bleiben, wie sie sind.

export interface SchlittenPosen {
  gerade: CanvasImageSource | null;
  links: CanvasImageSource | null;
  rechts: CanvasImageSource | null;
}

export const DEKO_NAMEN = [
  'tanne-2', 'tanne-3', 'tanne-4', 'tanne-5',
  'wegweiser', 'kuebel', 'laterne', 'fels',
  'gast-1', 'gast-2', 'gast-3', 'gast-4',
  'torbogen', 'blockhaus', 'holzstapel', 'saunafass',
] as const;
export type DekoName = typeof DEKO_NAMEN[number] | 'schneemann' | 'glutsteine' | 'eisblock';

/** Die acht Handtuchfarben: Name, Leitfarbe (Minikarte, Namensschild). */
export const SKINS: { name: string; farbe: string }[] = [
  { name: 'Creme', farbe: '#e8ddc8' },
  { name: 'Rost', farbe: '#c0573f' },
  { name: 'Blau', farbe: '#3f7fd0' },
  { name: 'Tanne', farbe: '#3fae5a' },
  { name: 'Lavendel', farbe: '#9a5ad6' },
  { name: 'Honig', farbe: '#e0b83a' },
  { name: 'Himbeere', farbe: '#e05aa0' },
  { name: 'Eisbach', farbe: '#36c2c2' },
];
/** Ziel-Farbton (Grad) der abgeleiteten Skins. Das blaue Original-Handtuch
 *  ist ein gedecktes Schieferblau (Farbton ~190°, Sättigung nur 0,2–0,3) —
 *  deshalb wird eingefärbt UND gesättigt, eine reine Drehung sähe man nicht. */
const SKIN_FARBTON: Record<number, number> = { 3: 128, 4: 272, 5: 44, 6: 332, 7: 172 };

export interface KartAssets {
  schlitten: SchlittenPosen[];                       // Index = Skin (0…7)
  boden: Record<'holzsteg' | 'waldweg', CanvasImageSource | null>;
  panorama: CanvasImageSource | null;
  stamm: CanvasImageSource | null;
  deko: Partial<Record<DekoName, CanvasImageSource | null>>;
  sprites: {
    kiste: HTMLCanvasElement;
    tropfen: HTMLCanvasElement;
    seife: HTMLCanvasElement;
    filzhut: HTMLCanvasElement;
    eiskugel: HTMLCanvasElement;
  };
}

let cache: Promise<KartAssets> | null = null;

export function ladeKartAssets(): Promise<KartAssets> {
  cache ??= (async () => {
    const basis = await Promise.all(['creme', 'rost', 'blau'].map(async (skin) => {
      const [gerade, links, rechts] = await Promise.all([
        ladeBild(`/kart/schlitten-${skin}.png`),
        ladeBild(`/kart/schlitten-${skin}-links.png`),
        ladeBild(`/kart/schlitten-${skin}-rechts.png`),
      ]);
      return {
        gerade: gerade ? entgruenen(gerade) : null,
        links: links ? entgruenen(links) : null,
        rechts: rechts ? entgruenen(rechts) : null,
      } as SchlittenPosen;
    }));
    const schlitten: SchlittenPosen[] = [...basis];
    for (let s = 3; s < SKINS.length; s++) {
      const blau = basis[2];
      const ton = SKIN_FARBTON[s];
      schlitten.push({
        gerade: blau.gerade ? einfaerben(blau.gerade, ton) : null,
        links: blau.links ? einfaerben(blau.links, ton) : null,
        rechts: blau.rechts ? einfaerben(blau.rechts, ton) : null,
      });
    }
    const [holz, wald, pano, stamm] = await Promise.all([
      ladeBild('/kart/boden-holzsteg.jpg'),
      ladeBild('/kart/boden-waldweg.jpg'),
      ladeBild('/kart/panorama.jpg'),
      ladeBild('/kart/stamm.png'),
    ]);
    const dekoBilder = await Promise.all(DEKO_NAMEN.map((n) => ladeBild(`/kart/deko/${n}.png`)));
    const deko: KartAssets['deko'] = {};
    DEKO_NAMEN.forEach((n, i) => { deko[n] = dekoBilder[i] ? entgruenen(dekoBilder[i]!) : null; });
    deko.schneemann = zeichneSchneemann();
    deko.glutsteine = zeichneGlutsteine();
    deko.eisblock = zeichneEisblock();
    return {
      schlitten,
      boden: { holzsteg: holz, waldweg: wald },
      panorama: pano,
      stamm: stamm ? entgruenen(stamm) : null,
      deko,
      sprites: {
        kiste: zeichneKiste(),
        tropfen: zeichneTropfen(),
        seife: zeichneSeife(),
        filzhut: zeichneFilzhut(),
        eiskugel: zeichneEiskugel(),
      },
    };
  })();
  return cache;
}

function ladeBild(pfad: string, timeoutMs = 6000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const t = setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); resolve(null); };
    img.src = pfad;
  });
}

function leinwand(b: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = b; c.height = h;
  return [c, c.getContext('2d')!];
}

/** Grünen Generier-Hintergrund entfernen, falls vorhanden (Ecken-Test). */
function entgruenen(img: HTMLImageElement): CanvasImageSource {
  const [c, ctx] = leinwand(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, 0, 0);
  let daten: ImageData;
  try { daten = ctx.getImageData(0, 0, c.width, c.height); } catch { return img; }
  const d = daten.data;
  const istGruen = (i: number) => d[i + 1] > 110 && d[i + 1] > d[i] * 1.35 && d[i + 1] > d[i + 2] * 1.35;
  const ecken = [0, (c.width - 1) * 4, (c.height - 1) * c.width * 4, ((c.height * c.width) - 1) * 4];
  if (ecken.filter((i) => d[i + 3] > 0 && istGruen(i)).length < 3) return c;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (g > 90 && g > r * 1.25 && g > b * 1.25) d[i + 3] = 0;
    else if (g > 80 && g > r * 1.1 && g > b * 1.1) { d[i + 3] = Math.min(d[i + 3], 140); d[i + 1] = Math.round((r + b) / 2); }
  }
  ctx.putImageData(daten, 0, 0);
  return c;
}

/** Nur die bläulichen Pixel (das Handtuch) auf einen neuen Farbton setzen und
 *  sättigen. Haut (warm), Filzhut (grau) und Schneestaub (sehr hell) bleiben. */
function einfaerben(quelle: CanvasImageSource, ziel: number): HTMLCanvasElement {
  const b = (quelle as HTMLCanvasElement).width, h = (quelle as HTMLCanvasElement).height;
  const [c, ctx] = leinwand(b, h);
  ctx.drawImage(quelle, 0, 0);
  let daten: ImageData;
  try { daten = ctx.getImageData(0, 0, b, h); } catch { return c; }
  const d = daten.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 10) continue;
    const [hue, sat, lum] = rgbZuHsl(d[i], d[i + 1], d[i + 2]);
    if (hue < 160 || hue > 265 || sat < 0.12 || lum < 0.1 || lum > 0.82) continue;
    const neuTon = (ziel + (hue - 200) * 0.3 + 360) % 360;
    const neuSat = Math.min(0.85, sat * 2.4 + 0.15);
    const [r, g, bl] = hslZuRgb(neuTon, neuSat, lum);
    d[i] = r; d[i + 1] = g; d[i + 2] = bl;
  }
  ctx.putImageData(daten, 0, 0);
  return c;
}

function rgbZuHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslZuRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Stabiler Skin-Index aus einer Member-UUID. */
export function skinFuer(memberId: string | null | undefined, anzahl: number): number {
  if (!memberId) return 0;
  let h = 0;
  for (let i = 0; i < memberId.length; i++) h = ((h << 5) - h + memberId.charCodeAt(i)) | 0;
  return Math.abs(h) % anzahl;
}

// ─── Gezeichnete Sprites ─────────────────────────────────────────────────────

/** Aufguss-Kiste: Holzkiste mit leuchtendem „?" — die Wundertüte des Rennens. */
function zeichneKiste(): HTMLCanvasElement {
  const [c, g] = leinwand(40, 40);
  const verlauf = g.createLinearGradient(0, 0, 40, 40);
  verlauf.addColorStop(0, '#ffd76a');
  verlauf.addColorStop(0.5, '#ff8a3d');
  verlauf.addColorStop(1, '#c2410c');
  g.fillStyle = verlauf;
  rundeEcke(g, 2, 2, 36, 36, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.28)';
  rundeEcke(g, 5, 5, 30, 12, 5); g.fill();
  g.strokeStyle = 'rgba(80,30,5,0.55)';
  g.lineWidth = 2;
  rundeEcke(g, 2, 2, 36, 36, 7); g.stroke();
  g.fillStyle = '#fff8e6';
  g.font = 'bold 26px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('?', 20, 22);
  return c;
}

/** Duft-Tropfen: goldener Tropfen mit Glanzpunkt. */
function zeichneTropfen(): HTMLCanvasElement {
  const [c, g] = leinwand(24, 30);
  const verlauf = g.createRadialGradient(9, 15, 2, 12, 18, 14);
  verlauf.addColorStop(0, '#fff3b0');
  verlauf.addColorStop(0.45, '#f5c542');
  verlauf.addColorStop(1, '#b7791f');
  g.fillStyle = verlauf;
  g.beginPath();
  g.moveTo(12, 1);
  g.bezierCurveTo(16, 10, 22, 14, 22, 20);
  g.arc(12, 20, 10, 0, Math.PI);
  g.bezierCurveTo(2, 14, 8, 10, 12, 1);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.beginPath(); g.ellipse(8.5, 17, 2.2, 3.4, -0.4, 0, Math.PI * 2); g.fill();
  return c;
}

function zeichneSeife(): HTMLCanvasElement {
  const [c, g] = leinwand(40, 30);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath(); g.ellipse(20, 26, 16, 3.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f4a6c8';
  rundeEcke(g, 6, 10, 28, 14, 6); g.fill();
  g.fillStyle = '#fbd3e4';
  rundeEcke(g, 8, 11, 24, 6, 3); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [x, y, r] of [[10, 7, 4], [18, 4, 3], [27, 6, 5], [33, 9, 2.5]] as const) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return c;
}

function zeichneFilzhut(): HTMLCanvasElement {
  const [c, g] = leinwand(40, 36);
  g.fillStyle = '#9a8f80';
  g.beginPath(); g.ellipse(20, 28, 18, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#b3a795';
  g.beginPath();
  g.moveTo(6, 28);
  g.bezierCurveTo(6, 6, 34, 6, 34, 28);
  g.fill();
  g.fillStyle = '#7d7366';
  g.beginPath(); g.arc(20, 7, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.beginPath(); g.ellipse(14, 17, 4, 8, -0.3, 0, Math.PI * 2); g.fill();
  return c;
}

function zeichneEiskugel(): HTMLCanvasElement {
  const [c, g] = leinwand(36, 36);
  const verlauf = g.createRadialGradient(13, 12, 2, 18, 18, 17);
  verlauf.addColorStop(0, '#ffffff');
  verlauf.addColorStop(0.35, '#c9f0ff');
  verlauf.addColorStop(1, '#3b9fd6');
  g.fillStyle = verlauf;
  g.beginPath(); g.arc(18, 18, 16, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(9, 22); g.lineTo(16, 16); g.lineTo(14, 9); g.stroke();
  g.beginPath(); g.moveTo(16, 16); g.lineTo(26, 20); g.stroke();
  return c;
}

function zeichneSchneemann(): HTMLCanvasElement {
  const [c, g] = leinwand(48, 72);
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.beginPath(); g.ellipse(24, 68, 16, 4, 0, 0, Math.PI * 2); g.fill();
  const kugel = (y: number, r: number) => {
    const v = g.createRadialGradient(20, y - r / 3, 2, 24, y, r);
    v.addColorStop(0, '#ffffff'); v.addColorStop(1, '#c8d8e4');
    g.fillStyle = v;
    g.beginPath(); g.arc(24, y, r, 0, Math.PI * 2); g.fill();
  };
  kugel(54, 15); kugel(33, 11); kugel(16, 8);
  g.fillStyle = '#b3a795';                  // Filzhut statt Zylinder
  g.beginPath(); g.moveTo(15, 11); g.bezierCurveTo(15, -2, 33, -2, 33, 11); g.fill();
  g.fillStyle = '#e8772e';
  g.beginPath(); g.moveTo(24, 16); g.lineTo(32, 18); g.lineTo(24, 19); g.fill();
  g.fillStyle = '#222';
  for (const [x, y] of [[21, 14], [27, 14], [24, 29], [24, 35]] as const) { g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#c23b34';                  // Handtuch-Schal
  g.fillRect(14, 22, 20, 4);
  return c;
}

function zeichneGlutsteine(): HTMLCanvasElement {
  const [c, g] = leinwand(64, 44);
  const glut = g.createRadialGradient(32, 30, 4, 32, 30, 30);
  glut.addColorStop(0, 'rgba(255,140,40,0.55)');
  glut.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = glut;
  g.fillRect(0, 0, 64, 44);
  const stein = (x: number, y: number, r: number) => {
    g.fillStyle = '#3a302c';
    g.beginPath(); g.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ff9a3c';
    g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(x - r * 0.5, y); g.lineTo(x, y - r * 0.3); g.lineTo(x + r * 0.4, y + r * 0.1); g.stroke();
  };
  stein(20, 34, 11); stein(42, 35, 12); stein(31, 24, 10); stein(52, 26, 7);
  return c;
}

function zeichneEisblock(): HTMLCanvasElement {
  const [c, g] = leinwand(44, 40);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath(); g.ellipse(22, 37, 18, 3, 0, 0, Math.PI * 2); g.fill();
  const v = g.createLinearGradient(0, 0, 44, 40);
  v.addColorStop(0, '#e8f8ff'); v.addColorStop(1, '#7cc2e4');
  g.fillStyle = v;
  rundeEcke(g, 5, 6, 34, 30, 4); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(10, 12); g.lineTo(20, 12); g.moveTo(12, 18); g.lineTo(30, 26); g.stroke();
  return c;
}

function rundeEcke(g: CanvasRenderingContext2D, x: number, y: number, b: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + b, y, x + b, y + h, r);
  g.arcTo(x + b, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + b, y, r);
  g.closePath();
}
