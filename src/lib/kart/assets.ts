// Sauna-Kart: die fal.ai-Grafiken (16.08.2026) — mit eingebautem Rückfall.
//
// Jedes Bild ist OPTIONAL: lädt es nicht (Offline-PWA, kaputte Datei,
// Adblocker), fällt das Spiel auf seine programmatische Zeichnung zurück.
// Deshalb liefert der Lader nie einen Fehler, sondern höchstens `null` —
// und das Rennen startet trotzdem.
//
// Die Schlitten-Sprites kommen im Idealfall freigestellt (rembg). Falls der
// Freisteller beim Generieren versagt hat, liegt das Rohbild auf grünem
// Grund im Repo — `entgruenen` keyt den Hintergrund zur Laufzeit heraus.
// Der Check ist billig (einmal pro Laden) und bei bereits transparenten
// Bildern ein No-op.

export interface KartAssets {
  /** Drei Skins [creme, rost, blau] — Zuordnung per Member-Hash, damit
   *  Geister verschiedener Mitglieder verschieden aussehen. */
  schlitten: (CanvasImageSource | null)[];
  /** Bahn-Textur je Strecke (kelo → Holzsteg, blockhaus → Waldweg). */
  boden: Record<string, CanvasImageSource | null>;
  panorama: CanvasImageSource | null;
}

const SCHLITTEN_PFADE = ['/kart/schlitten-creme.png', '/kart/schlitten-rost.png', '/kart/schlitten-blau.png'];
const BODEN_PFADE: Record<string, string> = {
  kelo_kurve: '/kart/boden-holzsteg.jpg',
  blockhaus_passage: '/kart/boden-waldweg.jpg',
};

let cache: Promise<KartAssets> | null = null;

export function ladeKartAssets(): Promise<KartAssets> {
  cache ??= (async () => {
    const [creme, rost, blau, holz, wald, pano] = await Promise.all([
      ...SCHLITTEN_PFADE.map((p) => ladeBild(p)),
      ladeBild(BODEN_PFADE.kelo_kurve),
      ladeBild(BODEN_PFADE.blockhaus_passage),
      ladeBild('/kart/panorama.jpg'),
    ]);
    return {
      schlitten: [creme, rost, blau].map((b) => (b ? entgruenen(b) : null)),
      boden: { kelo_kurve: holz, blockhaus_passage: wald },
      panorama: pano,
    };
  })();
  return cache;
}

/** Bild laden — `null` statt Fehler, mit hartem Timeout: ein hängendes Bild
 *  darf den Rennstart nicht blockieren. */
function ladeBild(pfad: string, timeoutMs = 6000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const t = setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); resolve(null); };
    img.src = pfad;
  });
}

/** Grünen Generier-Hintergrund entfernen, falls vorhanden.
 *
 *  Erkennung über die vier Ecken: sind sie kräftig grün, wird gekeyt —
 *  sonst ist das Bild schon transparent und geht unverändert zurück.
 *  Die Kante wird über einen weichen Schwellwert entschärft; beim
 *  Pixel-Look des Spiels (Sprites werden klein gezeichnet) reicht das. */
function entgruenen(img: HTMLImageElement): CanvasImageSource {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  let daten: ImageData;
  try {
    daten = ctx.getImageData(0, 0, c.width, c.height);
  } catch {
    return img; // sollte bei Same-Origin nie passieren — dann eben ungekeyt
  }
  const d = daten.data;

  const istGruen = (i: number) => d[i + 1] > 110 && d[i + 1] > d[i] * 1.35 && d[i + 1] > d[i + 2] * 1.35;
  const ecken = [0, (c.width - 1) * 4, (c.height - 1) * c.width * 4, ((c.height * c.width) - 1) * 4];
  const gruene = ecken.filter((i) => d[i + 3] > 0 && istGruen(i)).length;
  if (gruene < 3) return img; // kein Green-Screen — vermutlich schon freigestellt

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (g > 90 && g > r * 1.25 && g > b * 1.25) {
      d[i + 3] = 0;
    } else if (g > 80 && g > r * 1.1 && g > b * 1.1) {
      // Saum: halbtransparent + Grünstich rausziehen, sonst leuchtet die Kante.
      d[i + 3] = Math.min(d[i + 3], 140);
      d[i + 1] = Math.round((r + b) / 2);
    }
  }
  ctx.putImageData(daten, 0, 0);
  return c;
}

/** Stabiler Skin-Index (0…n-1) aus einer Member-UUID — derselbe Fahrer hat
 *  auf jedem Gerät dieselbe Handtuch-Farbe. */
export function skinFuer(memberId: string | null | undefined, anzahl: number): number {
  if (!memberId) return 0;
  let h = 0;
  for (let i = 0; i < memberId.length; i++) h = ((h << 5) - h + memberId.charCodeAt(i)) | 0;
  return Math.abs(h) % anzahl;
}
