// Sauna-Kart: der Renderer (Grand-Prix-Fassung, 25.09.2026).
//
// Mode-7 im Stil der 16-Bit-Ära: der Boden ist eine perspektivisch gekippte
// Textur, pro Bildzeile einmal abgetastet. Darüber EIN tiefensortierter
// Durchlauf aller Billboards (Deko, Kisten, Tropfen, Items, Stämme, Fahrer).
//
// Regeln aus dem Game-Feel-Kanon (Memory feedback_spielgefuehl_kanon):
//   * Billboards skalieren ungedeckelt mit 1/Tiefe (Deckel erst weit über
//     Bildschirmhöhe) — sonst „frieren" Bäume beim Heranfahren ein.
//   * Die Kamera hinkt der Nase weich hinterher; die Physik bleibt exakt.
//   * Alles hier ist Optik: Zufall (Partikel) darf frei laufen, die Physik
//     sieht davon nichts.

import { SKINS, type DekoName, type KartAssets, type SchlittenPosen } from './assets';
import { TEX_SIZE, hashText, mulberry32, wrapIdx, type StreckenGeometrie } from './strecken';
import { INTRO_MS, wrapWinkel, type Ereignis, type Fahrer, type GeistDaten } from './engine/typen';
import type { Rennen } from './engine/rennen';

const BASIS_B = 360;
const FLUG_HOEHE = 46;

interface Deko { x: number; y: number; name: DekoName; wh: number; phase: number; }

interface Partikel {
  x: number; y: number; vx: number; vy: number;
  leben: number; max: number; groesse: number;
  farbe: string; leuchtet: boolean;
}

const STUFEN_FARBE = ['#dfe7ee', '#4fb3ff', '#ffa53a', '#c77dff'];

const THEMA = {
  wald: { umland: [16, 34, 20], nebel: '120,150,170', himmel: ['#0e1a2b', '#27425f', '#4e6a83'] },
  dorf: { umland: [18, 36, 24], nebel: '140,150,160', himmel: ['#1a2238', '#3b4d6e', '#8a8fa0'] },
  winter: { umland: [206, 221, 230], nebel: '225,236,245', himmel: ['#6d8fb0', '#a8c4dc', '#e3eef6'] },
  glut: { umland: [26, 20, 18], nebel: '120,50,30', himmel: ['#1a0a08', '#5a1c10', '#c2521c'] },
} as const;

export class KartRenderer {
  W = 360;
  H = 560;
  private horizont = 224;
  private fokal = 220;
  private skala = 1;
  private ctx: CanvasRenderingContext2D;
  private bild!: ImageData;
  private bildDaten!: Uint32Array;
  private texDaten: Uint32Array;
  private umland: number;
  private panorama: HTMLCanvasElement;
  private deko: Deko[] = [];
  private partikel: Partikel[] = [];
  private kam = { x: 0, y: 0, richtung: 0, hoehe: 90, abstand: 160, bereit: false };
  private schuettel = 0;
  private blitz = 0;
  private blitzFarbe = '255,255,255';
  private aufgussWelle = 0;
  private konfetti = 0;
  private boostFarbe = '#bff5d0';
  private uhr = 0;
  private minikarte: HTMLCanvasElement;
  private mmRahmen = { x0: 0, y0: 0, s: 1 };
  /** Kamera-Grundwerte je Seitenverhältnis (groesse()). */
  private kamAbstand = 38;
  private kamHoehe = 48;
  /** Vorab verkleinerte Fassungen großer Sprites — drawImage von 512 px auf
   *  20 px in jedem Bild kostet auf dem Handy mehr als der ganze Boden. */
  private mips = new WeakMap<object, HTMLCanvasElement[]>();

  constructor(
    private canvas: HTMLCanvasElement,
    private geo: StreckenGeometrie,
    textur: HTMLCanvasElement,
    private assets: KartAssets,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    const tctx = textur.getContext('2d')!;
    this.texDaten = new Uint32Array(tctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE).data.buffer);
    const t = THEMA[geo.strecke.thema];
    this.umland = packFarbe(t.umland[0], t.umland[1], t.umland[2]);
    this.panorama = this.bauPanorama();
    this.deko = bauDeko(geo);
    this.minikarte = this.bauMinikarte(96);
    this.groesse(canvas.width, canvas.height);
  }

  /** Interne Auflösung an das Seitenverhältnis des Bildschirms anpassen. */
  groesse(W: number, H: number) {
    this.W = Math.round(W);
    this.H = Math.round(H);
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    const hoch = this.H >= this.W;
    this.horizont = Math.floor(this.H * (hoch ? 0.36 : 0.4));
    // Gleiches Blickfeld in jeder Breite; Sprites wachsen mit.
    this.fokal = this.W * (220 / BASIS_B) * (hoch ? 1 : 0.8);
    this.skala = this.fokal / 220;
    // Kamera so wählen, dass das eigene Kart bei ~80 % der Höhe steht — und
    // zwar genau dort, wo sein Bodenpunkt projiziert wird. Dann stehen
    // Gegner neben dir auch wirklich neben dir.
    this.kamAbstand = hoch ? 38 : 44;
    const ziel = this.H * (hoch ? 0.8 : 0.84) - this.horizont;
    this.kamHoehe = Math.max(24, Math.min(72, (ziel * this.kamAbstand) / this.fokal));
    this.bild = this.ctx.createImageData(this.W, this.H - this.horizont);
    this.bildDaten = new Uint32Array(this.bild.data.buffer);
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Ereignisse der Engine in Optik übersetzen (Wackeln, Blitz, Partikel). */
  ereignisse(ev: Ereignis[], r: Rennen) {
    const s = r.spieler.nr;
    for (const e of ev) {
      if (e.fahrer === s) {
        switch (e.art) {
          case 'treffer': case 'stamm': this.schuettel = 6; this.blitz = 0.18; this.blitzFarbe = '255,60,60'; break;
          case 'landung': this.schuettel = Math.max(this.schuettel, 2.5); this.spray('staub', 10); break;
          case 'bande': if (e.wert === 1) this.schuettel = Math.max(this.schuettel, 3); this.spray('funke', 5); break;
          case 'rempler': this.schuettel = Math.max(this.schuettel, 1.8); break;
          case 'miniturbo': this.blitz = 0.1; this.blitzFarbe = '255,255,255'; this.boostFarbe = STUFEN_FARBE[e.wert ?? 1]; break;
          case 'minze': case 'startBoost': this.blitz = 0.1; this.blitzFarbe = '220,255,230'; this.boostFarbe = '#9ff0b8'; break;
          case 'turbo': this.blitz = 0.08; this.blitzFarbe = '200,245,255'; this.boostFarbe = '#8fe6ff'; break;
          case 'ziel': if (r.spieler.platz <= 3 || r.setup.modus === 'zeitfahren') this.konfetti = 3.5; break;
        }
      }
      if (e.art === 'aufguss' && e.fahrer !== s) this.aufgussWelle = 1.4;
    }
  }

  zeichne(r: Rennen, dtReal: number) {
    const { ctx, W, H } = this;
    this.uhr += dtReal;
    const s = r.spieler;
    this.kameraNachfuehren(r, dtReal);
    const kam = this.kam;
    const rh = kam.richtung;
    const fx = Math.cos(rh), fy = Math.sin(rh);
    const rx = -fy, ry = fx;
    const kx = kam.x, ky = kam.y;
    const zeit = r.phase === 'intro' || r.phase === 'countdown' ? 0 : r.zeitMs;

    this.schuettel = Math.max(0, this.schuettel - dtReal * 9);
    this.blitz = Math.max(0, this.blitz - dtReal);
    this.aufgussWelle = Math.max(0, this.aufgussWelle - dtReal);
    this.konfetti = Math.max(0, this.konfetti - dtReal);
    const tempo = s.v / r.vMax;
    if (tempo > 0.9 && this.schuettel < 0.8 && r.phase === 'rennen') this.schuettel = 0.8;
    const shX = Math.round(Math.sin(this.uhr * 54) * this.schuettel);
    const shY = Math.round(Math.cos(this.uhr * 78) * this.schuettel * 0.7);

    if (this.schuettel > 0.2) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    ctx.save();
    ctx.translate(shX, shY);
    this.zeichneHimmel(rh);
    ctx.restore();

    // ── Boden ────────────────────────────────────────────────────────────
    const tex = this.texDaten, bd = this.bildDaten, umland = this.umland, fokal = this.fokal;
    let z = 0;
    const zeilen = H - this.horizont;
    for (let sy = 0; sy < zeilen; sy++) {
      const dist = (kam.hoehe * fokal) / (sy + 1);
      const cxw = kx + fx * dist, cyw = ky + fy * dist;
      const quer = dist / fokal;
      let wx = cxw - rx * (W / 2) * quer;
      let wy = cyw - ry * (W / 2) * quer;
      const sxq = rx * quer, syq = ry * quer;
      for (let sx = 0; sx < W; sx++) {
        const tx = wx | 0, ty = wy | 0;
        bd[z++] = (tx >= 0 && ty >= 0 && tx < TEX_SIZE && ty < TEX_SIZE) ? tex[ty * TEX_SIZE + tx] : umland;
        wx += sxq; wy += syq;
      }
    }
    ctx.putImageData(this.bild, shX, this.horizont + shY);
    ctx.save();
    ctx.translate(shX, shY);

    // Horizont-Dunst: Tiefe ohne Kosten pro Pixel.
    const nebel = THEMA[this.geo.strecke.thema].nebel;
    const dunst = ctx.createLinearGradient(0, this.horizont, 0, this.horizont + H * 0.14);
    dunst.addColorStop(0, `rgba(${nebel},0.65)`);
    dunst.addColorStop(1, `rgba(${nebel},0)`);
    ctx.fillStyle = dunst;
    ctx.fillRect(0, this.horizont, W, H * 0.14);

    // ── Billboards ───────────────────────────────────────────────────────
    const bb: { tiefe: number; mal: () => void }[] = [];
    const proj = (wx: number, wy: number) => {
      const dxw = wx - kx, dyw = wy - ky;
      const tiefe = dxw * fx + dyw * fy;
      if (tiefe < 6 || tiefe > 700) return null;
      const q = dxw * rx + dyw * ry;
      return {
        tiefe,
        alpha: tiefe > 600 ? (700 - tiefe) / 100 : 1,
        sx: W / 2 + (q * fokal) / tiefe,
        sy: this.horizont + (kam.hoehe * fokal) / tiefe,
      };
    };

    for (const d of this.deko) {
      const sprite = this.assets.deko[d.name] ?? null;
      if (!sprite) continue;
      const p = proj(d.x, d.y);
      if (!p) continue;
      const natB = (sprite as HTMLCanvasElement).width, natH = (sprite as HTMLCanvasElement).height;
      const hPx = Math.min(H * 3, (d.wh * fokal) / p.tiefe);
      const bPx = hPx * (natB / Math.max(1, natH));
      if (p.sx + bPx / 2 < -30 || p.sx - bPx / 2 > W + 30) continue;
      // Ganz nah an der Kamera (wer durchs Gras schrammt) würde ein Baum das
      // halbe Bild als Pixelblock zudecken — dort blendet er weich aus.
      if (p.tiefe < 34 && d.name !== 'torbogen') p.alpha *= Math.max(0.12, (p.tiefe - 8) / 26);
      bb.push({ tiefe: p.tiefe, mal: () => this.malDeko(d, sprite, p, bPx, hPx) });
    }

    const kisteSp = this.assets.sprites.kiste;
    for (const k of r.kisten) {
      if (k.weg > 0.35) continue;
      const p = proj(k.x, k.y);
      if (!p) continue;
      const wachsen = k.weg > 0 ? 1 - k.weg / 0.35 : 1;
      const hPx = (16 * fokal / p.tiefe) * wachsen;
      const dreh = Math.abs(Math.cos(this.uhr * 2.2 + k.phase)) * 0.7 + 0.3;
      const hub = Math.sin(this.uhr * 3 + k.phase) * hPx * 0.12;
      bb.push({ tiefe: p.tiefe, mal: () => {
        ctx.globalAlpha = p.alpha;
        // Regenbogen-Schein hinter der Kiste
        ctx.fillStyle = `hsla(${(this.uhr * 120 + k.phase * 50) % 360},90%,65%,0.35)`;
        ctx.beginPath(); ctx.arc(p.sx, p.sy - hPx * 0.7 - hub, hPx * 0.75, 0, Math.PI * 2); ctx.fill();
        ctx.drawImage(kisteSp, p.sx - (hPx * dreh) / 2, p.sy - hPx * 1.25 - hub, hPx * dreh, hPx);
        ctx.globalAlpha = 1;
      } });
    }

    const tropfenSp = this.assets.sprites.tropfen;
    for (const t of r.tropfen) {
      if (t.weg > 0) continue;
      const p = proj(t.x, t.y);
      if (!p) continue;
      const hPx = 10 * fokal / p.tiefe;
      const dreh = Math.abs(Math.cos(this.uhr * 3 + t.phase)) * 0.6 + 0.4;
      const hub = Math.sin(this.uhr * 4 + t.phase) * hPx * 0.15;
      bb.push({ tiefe: p.tiefe, mal: () => {
        ctx.globalAlpha = p.alpha;
        ctx.drawImage(tropfenSp, p.sx - (hPx * 0.8 * dreh) / 2, p.sy - hPx * 1.3 - hub, hPx * 0.8 * dreh, hPx);
        ctx.globalAlpha = 1;
      } });
    }

    for (const f of r.fallen) {
      const p = proj(f.x, f.y);
      if (!p) continue;
      const hPx = 8 * fokal / p.tiefe;
      const sp = this.assets.sprites.seife;
      bb.push({ tiefe: p.tiefe, mal: () => { ctx.drawImage(sp, p.sx - hPx * 0.67, p.sy - hPx, hPx * 1.33, hPx); } });
    }

    for (const g of r.geschosse) {
      const p = proj(g.x, g.y);
      if (!p) continue;
      const hPx = 10 * fokal / p.tiefe;
      const sp = g.art === 'filzhut' ? this.assets.sprites.filzhut : this.assets.sprites.eiskugel;
      bb.push({ tiefe: p.tiefe, mal: () => {
        if (g.art === 'eiskugel') {
          ctx.fillStyle = 'rgba(150,220,255,0.35)';
          ctx.beginPath(); ctx.arc(p.sx, p.sy - hPx * 0.6, hPx * 0.9, 0, Math.PI * 2); ctx.fill();
        }
        ctx.save();
        ctx.translate(p.sx, p.sy - hPx * 0.6);
        if (g.art === 'filzhut') ctx.scale(Math.abs(Math.cos(this.uhr * 14)) * 0.5 + 0.5, 1);
        ctx.drawImage(sp, -hPx / 2, -hPx / 2, hPx, hPx);
        ctx.restore();
      } });
    }

    if (r.phase !== 'intro') {
      for (let si = 0; si < r.setup.strecke.staemme.length; si++) {
        const st = r.stammPosition(si, zeit);
        const p = proj(st.x, st.y);
        if (!p) continue;
        const sk = (26 * fokal) / p.tiefe / 56;
        bb.push({ tiefe: p.tiefe, mal: () => zeichneStamm(ctx, this.assets.stamm ? this.passend(this.assets.stamm, 64 * sk) : null, p.sx, p.sy, sk, st.quer / 9) });
      }
    }

    for (const f of r.fahrer) {
      if (f === s) continue;
      const p = proj(f.x, f.y);
      if (!p) continue;
      const sk = Math.min(9, (20 * fokal) / p.tiefe / 76);
      bb.push({ tiefe: p.tiefe, mal: () => {
        ctx.globalAlpha = p.alpha;
        this.malFahrer(f, p.sx, p.sy, sk, wrapWinkel(f.richtung - rh), false);
        ctx.globalAlpha = 1;
        if (p.tiefe < 170 && r.fahrer.length > 1) {
          ctx.font = `bold ${Math.round(Math.max(8, Math.min(13, 9 * sk + 4)))}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillText(f.name, p.sx + 1, p.sy - 60 * sk + 1);
          ctx.fillStyle = SKINS[f.skin % SKINS.length].farbe;
          ctx.fillText(f.name, p.sx, p.sy - 60 * sk);
        }
      } });
    }

    for (const g of r.setup.geister ?? []) {
      const gp = geistPosition(g, zeit);
      if (!gp) continue;
      const p = proj(gp.x, gp.y);
      if (!p) continue;
      const sk = Math.min(9, (20 * fokal) / p.tiefe / 76);
      bb.push({ tiefe: p.tiefe, mal: () => {
        ctx.globalAlpha = 0.45 * p.alpha;
        const posen = this.assets.schlitten[g.skin % this.assets.schlitten.length] ?? null;
        this.pose(posen, p.sx, p.sy, sk, gp.lenk + wrapWinkel(gp.richtung - rh) * 1.5, g.skin);
        ctx.globalAlpha = 1;
        if (p.tiefe < 220) {
          ctx.font = `bold ${Math.round(Math.max(8, Math.min(13, 9 * sk + 4)))}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fillText(`👻 ${g.name}`, p.sx, p.sy - 60 * sk);
        }
      } });
    }

    bb.sort((a, b) => b.tiefe - a.tiefe);
    for (const b of bb) b.mal();

    // ── Spieler-Kart ─────────────────────────────────────────────────────
    this.zeichneSpieler(r, dtReal);

    // Tempo-Linien im Schub
    if (s.boostRest > 0 || s.sternRest > 0) {
      ctx.strokeStyle = s.sternRest > 0 ? `hsla(${(this.uhr * 400) % 360},90%,70%,0.35)` : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2 * this.skala;
      for (let k = 0; k < 8; k++) {
        const y0 = this.horizont + ((this.uhr * 900 * (0.9 + k * 0.13) + k * 97) % (H - this.horizont));
        const seite = k % 2 === 0 ? 0 : W;
        const richt = k % 2 === 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(seite, y0);
        ctx.lineTo(seite + richt * (30 + (k * 11) % 22) * this.skala, y0 + 12 * this.skala);
        ctx.stroke();
      }
    }
    ctx.restore();

    // ── Bildschirm-Effekte (ohne Wackeln) ────────────────────────────────
    if (s.nebelRest > 0 || this.aufgussWelle > 0) this.zeichneDampf(Math.max(Math.min(1, s.nebelRest / 0.8), this.aufgussWelle / 1.4 * 0.7));
    if (this.blitz > 0) {
      ctx.fillStyle = `rgba(${this.blitzFarbe},${Math.min(0.45, this.blitz * 3).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.konfetti > 0) this.zeichneKonfetti();
  }

  // ─── Kamera ────────────────────────────────────────────────────────────

  private kameraNachfuehren(r: Rennen, dt: number) {
    const s = r.spieler;
    const kam = this.kam;
    let hoehe = this.kamHoehe, abstand = this.kamAbstand, versatz = 0;
    if (r.phase === 'intro') {
      // Einflug: von hoch oben und seitlich hinter das Kart.
      const t = Math.min(1, r.phaseMs / INTRO_MS);
      const e = 1 - Math.pow(1 - t, 3);
      hoehe = this.kamHoehe + 60 * (1 - e);
      abstand = this.kamAbstand + 120 * (1 - e);
      versatz = (1 - e) * 1.3;
    } else if (s.boostRest > 0 || s.sternRest > 0) {
      hoehe = this.kamHoehe * 0.86;
    }
    const ziel = wrapWinkel(s.richtung * 0.55 + (s.richtung + wrapWinkel(s.fahrWinkel - s.richtung)) * 0.45) + versatz;
    if (!kam.bereit) {
      kam.richtung = ziel; kam.hoehe = hoehe; kam.abstand = abstand; kam.bereit = true;
    }
    const k = r.phase === 'intro' ? 1 : Math.min(1, 7 * dt);
    kam.richtung = wrapWinkel(kam.richtung + wrapWinkel(ziel - kam.richtung) * k);
    kam.hoehe += (hoehe - kam.hoehe) * (r.phase === 'intro' ? 1 : Math.min(1, 5 * dt));
    kam.abstand += (abstand - kam.abstand) * (r.phase === 'intro' ? 1 : Math.min(1, 5 * dt));
    kam.x = s.x - Math.cos(kam.richtung) * kam.abstand;
    kam.y = s.y - Math.sin(kam.richtung) * kam.abstand;
  }

  // ─── Himmel ────────────────────────────────────────────────────────────

  private bauPanorama(): HTMLCanvasElement {
    const thema = this.geo.strecke.thema;
    const hz = 200; // Referenzhöhe; wird beim Zeichnen skaliert
    const img = this.assets.panorama as HTMLImageElement | null;
    const c = document.createElement('canvas');
    const g = c.getContext('2d')!;
    if (img) {
      const b = Math.max(400, Math.round(img.width * (hz / img.height)));
      c.width = b * 2; c.height = hz;
      g.drawImage(img, 0, 0, b, hz);
      g.save(); g.translate(b * 2, 0); g.scale(-1, 1); g.drawImage(img, 0, 0, b, hz); g.restore();
    } else {
      c.width = 720; c.height = hz;
      const verlauf = g.createLinearGradient(0, 0, 0, hz);
      const hm = THEMA[thema].himmel;
      verlauf.addColorStop(0, hm[0]); verlauf.addColorStop(0.7, hm[1]); verlauf.addColorStop(1, hm[2]);
      g.fillStyle = verlauf; g.fillRect(0, 0, c.width, hz);
      g.fillStyle = thema === 'winter' ? '#50707a' : '#16241d';
      let x = 0, i = 0;
      while (x < c.width) {
        const h = 22 + ((i * 37) % 23), b = 16 + ((i * 53) % 14);
        g.beginPath(); g.moveTo(x, hz); g.lineTo(x + b / 2, hz - h); g.lineTo(x + b, hz); g.closePath(); g.fill();
        x += b * 0.62; i++;
      }
    }
    // Themen-Tönung über dem Bild
    if (thema === 'winter') {
      g.globalCompositeOperation = 'color';
      g.fillStyle = 'rgba(160,190,220,0.75)';
      g.fillRect(0, 0, c.width, hz);
      g.globalCompositeOperation = 'screen';
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.fillRect(0, 0, c.width, hz);
      // Schneefall-Tupfer
      g.globalCompositeOperation = 'source-over';
      const rnd = mulberry32(7);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let k = 0; k < 220; k++) g.fillRect(rnd() * c.width, rnd() * hz * 0.85, 1.5, 1.5);
    } else if (thema === 'glut') {
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = 'rgba(255,110,50,0.85)';
      g.fillRect(0, 0, c.width, hz);
      g.globalCompositeOperation = 'source-over';
      const glut = g.createLinearGradient(0, hz * 0.6, 0, hz);
      glut.addColorStop(0, 'rgba(255,120,40,0)');
      glut.addColorStop(1, 'rgba(255,120,40,0.45)');
      g.fillStyle = glut; g.fillRect(0, 0, c.width, hz);
    } else if (thema === 'dorf') {
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = 'rgba(255,215,190,0.9)';
      g.fillRect(0, 0, c.width, hz);
    }
    g.globalCompositeOperation = 'source-over';
    return c;
  }

  private zeichneHimmel(rh: number) {
    const { ctx, W } = this;
    const pano = this.panorama;
    const hz = this.horizont;
    // Das Panorama auf Horizont-Höhe skalieren; volle Drehung = volle Breite.
    const skala = hz / pano.height;
    const breite = pano.width * skala;
    const off = ((((rh / (Math.PI * 2)) % 1) + 1) % 1) * breite + this.uhr * 2;
    let x = -(off % breite);
    while (x < W) {
      ctx.drawImage(pano, 0, 0, pano.width, pano.height, x, 0, breite + 1, hz + 1);
      x += breite;
    }
  }

  // ─── Deko ──────────────────────────────────────────────────────────────

  private malDeko(d: Deko, voll: CanvasImageSource, p: { sx: number; sy: number; alpha: number }, bPx: number, hPx: number) {
    const ctx = this.ctx;
    const sprite = this.passend(voll, hPx);
    ctx.globalAlpha = p.alpha;
    if (d.name.startsWith('tanne')) {
      ctx.save();
      ctx.translate(p.sx, p.sy);
      ctx.rotate(Math.sin(this.uhr * 0.9 + d.phase) * 0.016);
      ctx.drawImage(sprite, -bPx / 2, -hPx, bPx, hPx);
      ctx.restore();
    } else if (d.name.startsWith('gast')) {
      const hop = Math.abs(Math.sin(this.uhr * 5 + d.phase)) * hPx * 0.06;
      ctx.drawImage(sprite, p.sx - bPx / 2, p.sy - hPx - hop, bPx, hPx);
    } else if (d.name === 'laterne' || d.name === 'glutsteine') {
      const glut = 0.22 + 0.1 * Math.sin(this.uhr * 20 + d.phase) + 0.05 * Math.sin(this.uhr * 47 + d.phase * 2);
      const gy = p.sy - hPx * (d.name === 'laterne' ? 0.72 : 0.35);
      const gr = hPx * (d.name === 'laterne' ? 0.5 : 0.7);
      const grad = ctx.createRadialGradient(p.sx, gy, 0, p.sx, gy, gr);
      grad.addColorStop(0, `rgba(255,${d.name === 'laterne' ? 190 : 130},90,${Math.max(0, glut).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(255,160,80,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(p.sx - gr, gy - gr, gr * 2, gr * 2);
      ctx.drawImage(sprite, p.sx - bPx / 2, p.sy - hPx, bPx, hPx);
    } else if (d.name === 'blockhaus' || d.name === 'saunafass') {
      ctx.drawImage(sprite, p.sx - bPx / 2, p.sy - hPx, bPx, hPx);
      const schX = p.sx + (d.name === 'blockhaus' ? -bPx * 0.18 : bPx * 0.22);
      for (let rk = 0; rk < 3; rk++) {
        const rt = ((this.uhr * 0.35 + d.phase / 6 + rk / 3) % 1);
        ctx.fillStyle = `rgba(226,222,214,${(0.3 * (1 - rt)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(schX + Math.sin(rt * 5 + d.phase) * hPx * 0.05, p.sy - hPx * 0.98 - rt * hPx * 0.5, hPx * (0.035 + rt * 0.075), 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.drawImage(sprite, p.sx - bPx / 2, p.sy - hPx, bPx, hPx);
    }
    ctx.globalAlpha = 1;
  }

  // ─── Fahrer ────────────────────────────────────────────────────────────

  /** Ein Fahrer als Billboard (Computer) — mit Stern, Dreher, Funken, Schub. */
  private malFahrer(f: Fahrer, x: number, y: number, sk: number, relWinkel: number, istSpieler: boolean) {
    const ctx = this.ctx;
    let hoehe = 0;
    if (f.flugRest > 0) {
      const a = f.flugRest / f.flugDauer;
      hoehe = FLUG_HOEHE * 4 * a * (1 - a) * sk;
    } else if (f.hopRest > 0) {
      hoehe = Math.sin((0.16 - f.hopRest) / 0.16 * Math.PI) * 7 * sk;
    }
    const klein = f.langsamRest > 0 && f.langsamFaktor <= 0.6 ? 0.72 : 1;
    const drift = wrapWinkel(f.richtung - f.fahrWinkel);
    const lean = f.lenkGlatt + drift * 1.4 + relWinkel * (istSpieler ? 0 : 1.6);

    if (hoehe > 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.ellipse(x, y + 10 * sk, 24 * sk * klein, 6 * sk, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Glutstern: Regenbogen-Aura
    if (f.sternRest > 0) {
      const g = ctx.createRadialGradient(x, y - 28 * sk, 4 * sk, x, y - 28 * sk, 52 * sk);
      g.addColorStop(0, `hsla(${(this.uhr * 500) % 360},100%,70%,0.55)`);
      g.addColorStop(1, `hsla(${(this.uhr * 500 + 120) % 360},100%,60%,0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - 55 * sk, y - 85 * sk, 110 * sk, 110 * sk);
    }
    // Schub: Dampf-Flammen hinter den Kufen
    if (f.boostRest > 0 && f.flugRest <= 0) {
      const farbe = istSpieler ? this.boostFarbe : '#bdf3ff';
      for (const seite of [-1, 1]) {
        const fl = (0.8 + Math.sin(this.uhr * 40 + seite) * 0.2) * sk;
        ctx.fillStyle = farbe;
        ctx.globalAlpha *= 0.85;
        ctx.beginPath();
        ctx.ellipse(x + seite * 16 * sk, y + 12 * sk - hoehe, 5 * fl, 11 * fl, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha /= 0.85;
      }
    }
    // Drift-Funken an beiden Kufen
    if (f.driftAktiv) {
      const farbe = STUFEN_FARBE[f.driftStufe];
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const seite of [-1, 1]) {
        for (let k = 0; k < (f.driftStufe > 0 ? 4 : 2); k++) {
          const w = this.uhr * 60 + k * 1.7 + seite;
          const px = x + seite * 18 * sk + Math.sin(w) * 5 * sk;
          const py = y + 10 * sk - hoehe + Math.cos(w * 1.3) * 3 * sk;
          ctx.fillStyle = farbe;
          ctx.fillRect(px - 1.5 * sk, py - 1.5 * sk, 3 * sk, 3 * sk);
        }
      }
      ctx.restore();
    }

    const posen = this.assets.schlitten[f.skin % this.assets.schlitten.length] ?? null;
    ctx.save();
    ctx.translate(x, y - hoehe);
    if (f.taumelRest > 0) ctx.rotate(f.taumelDreh);
    ctx.scale(klein, klein);
    this.pose(posen, 0, 0, sk, lean, f.skin);
    if (f.sternRest > 0 || f.schonfrist > 0 && Math.floor(this.uhr * 16) % 2 === 0) {
      // Aufhellen: Stern flackert bunt, Schonfrist blinkt
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = f.sternRest > 0 ? 0.45 : 0.3;
      this.pose(posen, 0, 0, sk, lean, f.skin);
    }
    ctx.restore();
  }

  private pose(posen: SchlittenPosen | null, x: number, y: number, sk: number, lean: number, skin: number) {
    zeichnePose(this.ctx, posen, x, y, sk, lean, skin, (sp, h) => this.passend(sp, h));
  }

  private zeichneSpieler(r: Rennen, dt: number) {
    const { W, H } = this;
    const s = r.spieler;
    const kam = this.kam;
    // Genau der projizierte Bodenpunkt des Karts — gleiche Formel wie für
    // die Gegner, nur ein Hauch größer, damit das eigene Kart präsent ist.
    const sk = ((20 * this.fokal) / kam.abstand / 76) * 1.08;
    const drift = wrapWinkel(s.richtung - s.fahrWinkel);
    const ax = W / 2 + s.lenkGlatt * 10 * this.skala - drift * 18 * this.skala;
    const ay = Math.min(H - 12 * this.skala, this.horizont + (kam.hoehe * this.fokal) / kam.abstand);

    // Partikel aus dem Zustand erzeugen (reine Optik)
    const fliegt = s.flugRest > 0;
    if (r.phase === 'rennen' || r.phase === 'auslauf') {
      const wert = this.maskeUnter(s);
      if (!fliegt) {
        if (s.driftAktiv && s.driftStufe > 0) this.spray('funke', 2, STUFEN_FARBE[s.driftStufe]);
        else if (Math.abs(drift) > 0.12 && s.v > 0.5 * r.vMax) this.spray('staub', 1);
        if (wert === 6 && s.v > 20) this.spray('gras', 2);
        if (wert === 7 && s.v > 40) this.spray('schnee', 2);
        if (s.glutRest > 0) this.spray('glut', 2);
        if (s.boostRest > 0) this.spray('dampf', 1);
      }
    }
    this.partikelZeichnen(ax, ay, dt);
    this.malFahrer(s, ax, ay, sk, 0, true);
  }

  private maskeUnter(f: Fahrer): number {
    const x = Math.max(0, Math.min(TEX_SIZE - 1, Math.round(f.x)));
    const y = Math.max(0, Math.min(TEX_SIZE - 1, Math.round(f.y)));
    return this.geo.maske[y * TEX_SIZE + x];
  }

  private spray(art: 'staub' | 'gras' | 'dampf' | 'funke' | 'schnee' | 'glut', anzahl: number, farbe?: string) {
    const sk = this.skala;
    for (let k = 0; k < anzahl && this.partikel.length < 140; k++) {
      const seite = Math.random() < 0.5 ? -1 : 1;
      const f = farbe ?? ({
        staub: 'rgba(196,176,148,0.45)', gras: 'rgba(96,138,84,0.6)', dampf: 'rgba(240,248,250,0.4)',
        funke: '#ffb347', schnee: 'rgba(255,255,255,0.85)', glut: '#ff8a3c',
      } as const)[art];
      this.partikel.push({
        x: seite * (14 + Math.random() * 8) * sk,
        y: (8 + Math.random() * 6) * sk,
        vx: seite * (10 + Math.random() * 40) * sk,
        vy: (art === 'glut' ? -30 : 50 + Math.random() * 50) * sk,
        leben: 0,
        max: art === 'funke' ? 0.28 : art === 'glut' ? 0.5 : 0.55,
        groesse: (art === 'funke' ? 1.4 : art === 'dampf' ? 3.2 : 2) * sk,
        farbe: f,
        leuchtet: art === 'funke' || art === 'glut',
      });
    }
  }

  private partikelZeichnen(ax: number, ay: number, dt: number) {
    const ctx = this.ctx;
    for (let i = this.partikel.length - 1; i >= 0; i--) {
      const p = this.partikel[i];
      p.leben += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.leben >= p.max) { this.partikel.splice(i, 1); continue; }
      const rest = 1 - p.leben / p.max;
      ctx.globalAlpha = rest;
      if (p.leuchtet) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.farbe;
      const g = p.groesse * (p.leuchtet ? 1 : 1 + (1 - rest) * 1.5);
      ctx.beginPath(); ctx.arc(ax + p.x, ay + p.y, g, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  /** Kleinste vorab verkleinerte Fassung, die noch mindestens `zielH` hoch ist. */
  private passend(sprite: CanvasImageSource, zielH: number): CanvasImageSource {
    const h0 = (sprite as HTMLCanvasElement).height || 1;
    if (zielH >= h0 * 0.7) return sprite;
    let stufen = this.mips.get(sprite as object);
    if (!stufen) {
      stufen = [];
      let quelle: CanvasImageSource = sprite;
      let w = (sprite as HTMLCanvasElement).width, h = h0;
      while (h > 24) {
        w = Math.max(1, Math.round(w / 2));
        h = Math.max(1, Math.round(h / 2));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d')!;
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(quelle, 0, 0, w, h);
        stufen.push(c);
        quelle = c;
      }
      this.mips.set(sprite as object, stufen);
    }
    let beste: CanvasImageSource = sprite;
    for (const c of stufen) {
      if (c.height >= zielH) beste = c;
      else break;
    }
    return beste;
  }

  private zeichneDampf(staerke: number) {
    const { ctx, W, H } = this;
    for (let k = 0; k < 7; k++) {
      const x = (W * (0.1 + (k * 0.37) % 1)) + Math.sin(this.uhr * 0.7 + k) * W * 0.08;
      const y = H * (0.25 + ((k * 0.53) % 0.7)) + Math.cos(this.uhr * 0.5 + k * 2) * H * 0.05;
      const r = W * (0.35 + (k % 3) * 0.1);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(245,248,250,${(0.8 * staerke).toFixed(3)})`);
      g.addColorStop(1, 'rgba(245,248,250,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  private zeichneKonfetti() {
    const { ctx, W, H } = this;
    const t = 3.5 - this.konfetti;
    for (let k = 0; k < 70; k++) {
      const x = ((k * 97.3) % W) + Math.sin(t * 3 + k) * 12;
      const y = ((k * 53.1) % H) * 0.4 + t * (90 + (k % 7) * 20) - 40;
      if (y > H) continue;
      ctx.fillStyle = `hsl(${(k * 47) % 360},85%,62%)`;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 5 + k);
      ctx.fillRect(-3, -1.5, 6, 3);
      ctx.restore();
    }
  }

  // ─── Minikarte ─────────────────────────────────────────────────────────

  private bauMinikarte(groesse: number): HTMLCanvasElement {
    const { linie, strecke } = this.geo;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of linie) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const rand = 8;
    const s = (groesse - rand * 2) / Math.max(x1 - x0, y1 - y0);
    this.mmRahmen = { x0: x0 - rand / s, y0: y0 - rand / s, s };
    const c = document.createElement('canvas');
    c.width = groesse; c.height = groesse;
    const g = c.getContext('2d')!;
    const pfad = () => {
      g.beginPath();
      linie.forEach((p, i) => {
        const x = (p.x - this.mmRahmen.x0) * s, y = (p.y - this.mmRahmen.y0) * s;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      });
      g.closePath();
    };
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 9; pfad(); g.stroke();
    g.strokeStyle = strecke.thema === 'winter' ? '#dff1ff' : strecke.thema === 'glut' ? '#ffb070' : '#f1e3c6';
    g.lineWidth = 5; pfad(); g.stroke();
    const z = linie[0];
    g.fillStyle = '#111';
    g.fillRect((z.x - this.mmRahmen.x0) * s - 3, (z.y - this.mmRahmen.y0) * s - 3, 6, 6);
    g.fillStyle = '#fff';
    g.fillRect((z.x - this.mmRahmen.x0) * s - 3, (z.y - this.mmRahmen.y0) * s - 3, 3, 3);
    g.fillRect((z.x - this.mmRahmen.x0) * s, (z.y - this.mmRahmen.y0) * s, 3, 3);
    return c;
  }

  /** Minikarte in eine eigene, kleine Leinwand zeichnen (HUD oben rechts). */
  zeichneMinikarte(ziel: HTMLCanvasElement, r: Rennen) {
    const g = ziel.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, ziel.width, ziel.height);
    g.drawImage(this.minikarte, 0, 0, ziel.width, ziel.height);
    const f = ziel.width / this.minikarte.width;
    const { x0, y0, s } = this.mmRahmen;
    const punkt = (x: number, y: number, rad: number, farbe: string, rand?: string) => {
      g.beginPath();
      g.arc((x - x0) * s * f, (y - y0) * s * f, rad, 0, Math.PI * 2);
      g.fillStyle = farbe; g.fill();
      if (rand) { g.lineWidth = 1.5; g.strokeStyle = rand; g.stroke(); }
    };
    for (const k of r.geschosse) punkt(k.x, k.y, 2, k.art === 'eiskugel' ? '#8fe0ff' : '#b3a795');
    for (const geist of r.setup.geister ?? []) {
      const gp = geistPosition(geist, r.zeitMs);
      if (gp) punkt(gp.x, gp.y, 3, 'rgba(255,255,255,0.55)');
    }
    for (const fa of r.fahrer) {
      if (fa === r.spieler) continue;
      punkt(fa.x, fa.y, 3.2, SKINS[fa.skin % SKINS.length].farbe, 'rgba(0,0,0,0.6)');
    }
    const sp = r.spieler;
    punkt(sp.x, sp.y, 4.6, SKINS[sp.skin % SKINS.length].farbe, '#fff');
  }
}

// ─── Hilfen ──────────────────────────────────────────────────────────────────

/** Pose wählen und zeichnen: Bild, wenn geladen; sonst gezeichneter Schlitten. */
function zeichnePose(
  ctx: CanvasRenderingContext2D, posen: SchlittenPosen | null,
  x: number, y: number, sk: number, lean: number, skin: number,
  passend: (sprite: CanvasImageSource, zielH: number) => CanvasImageSource,
) {
  const sprite = !posen ? null
    : lean < -0.3 && posen.links ? posen.links
      : lean > 0.3 && posen.rechts ? posen.rechts
        : posen.gerade;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sk, sk);
  const hatPose = !!posen && ((lean < -0.3 && sprite === posen.links) || (lean > 0.3 && sprite === posen.rechts));
  ctx.rotate(Math.max(-0.5, Math.min(0.5, lean)) * (hatPose ? 0.08 : 0.16));
  if (sprite) {
    ctx.drawImage(passend(sprite, 76 * sk), -38, -62, 76, 76);
  } else {
    zeichneSchlittenPfad(ctx, SKINS[skin % SKINS.length].farbe);
  }
  ctx.restore();
}

function zeichneSchlittenPfad(ctx: CanvasRenderingContext2D, farbe: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 12, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = farbe;
  ctx.beginPath(); ctx.roundRect?.(-26, -2, 52, 14, 6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(-26, 3, 52, 3);
  ctx.fillStyle = '#d9a06b';
  ctx.beginPath(); ctx.roundRect?.(-12, -26, 24, 26, 9); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -32, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b3a795';
  ctx.beginPath(); ctx.ellipse(0, -38, 11, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -41, 6, Math.PI, 0); ctx.fill();
}

function zeichneStamm(ctx: CanvasRenderingContext2D, sprite: CanvasImageSource | null, x: number, y: number, skala: number, rollwinkel: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(skala, skala);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 8, 24, 6, 0, 0, Math.PI * 2); ctx.fill();
  if (sprite) {
    ctx.rotate(Math.sin(rollwinkel) * 0.07);
    ctx.drawImage(sprite, -32, -32, 64, 64);
  } else {
    ctx.rotate(rollwinkel);
    ctx.fillStyle = '#6b4a2e';
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a6540';
    ctx.lineWidth = 3;
    for (const r of [6, 12, 17]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
  }
  ctx.restore();
}

/** Geister-Position zur Rennzeit (lineare Interpolation). */
export function geistPosition(g: GeistDaten, zeitMs: number): { x: number; y: number; richtung: number; lenk: number } | null {
  const idx = zeitMs / g.dt;
  const i0 = Math.floor(idx);
  if (i0 < 0) return { x: g.pts[0][0] / 10, y: g.pts[0][1] / 10, richtung: g.pts[0][2] / 100, lenk: 0 };
  if (i0 >= g.pts.length - 1) return null;
  const f = idx - i0;
  const a = g.pts[i0], b = g.pts[i0 + 1];
  let dh = (b[2] - a[2]) / 100;
  if (dh > Math.PI) dh -= Math.PI * 2;
  if (dh < -Math.PI) dh += Math.PI * 2;
  return {
    x: (a[0] + (b[0] - a[0]) * f) / 10,
    y: (a[1] + (b[1] - a[1]) * f) / 10,
    richtung: a[2] / 100 + dh * f,
    lenk: Math.max(-1, Math.min(1, dh / (g.dt / 1000) / 2.5)),
  };
}

function packFarbe(r: number, g: number, b: number): number {
  return (255 << 24) | (b << 16) | (g << 8) | r;
}

// ─── Streckenrand-Ausstattung ────────────────────────────────────────────────
// Rezept der Klassiker: ein dominanter Füller in Größenvarianten, Cluster mit
// Atem-Lücken, Laternen-Paare als Kurven-Telegraph, ein Anker je Viertel,
// Zuschauer nur an Start/Ziel, das Tor als größter Sprite. Deterministisch.

function bauDeko(geo: StreckenGeometrie): Deko[] {
  const { linie, strecke } = geo;
  const n = linie.length;
  const rnd = mulberry32(hashText(strecke.id) ^ 0x5eed1);
  const deko: Deko[] = [];
  const gesperrt = new Set<number>();
  for (const ab of strecke.abkuerzungen) {
    for (let o = -14; o <= 14; o++) { gesperrt.add(wrapIdx(ab.von + o, n)); gesperrt.add(wrapIdx(ab.bis + o, n)); }
  }
  const leg = (idx: number, seite: number, abstand: number, name: DekoName, wh: number) => {
    const p = linie[wrapIdx(idx, n)];
    const x = p.x - Math.sin(p.winkel) * seite * abstand;
    const y = p.y + Math.cos(p.winkel) * seite * abstand;
    // Nie auf eine andere Bahnpassage stellen (Achter, enge Kehren).
    for (let k = 0; k < n; k += 3) {
      const q = linie[k];
      if ((q.x - x) ** 2 + (q.y - y) ** 2 < (strecke.breite + 22) ** 2) return;
    }
    deko.push({ x, y, name, wh, phase: ((x * 13 + y * 7) % 97) / 97 * Math.PI * 2 });
  };
  const thema = strecke.thema;
  const TANNEN: [DekoName, number][] = [['tanne-2', 145], ['tanne-3', 118], ['tanne-4', 78], ['tanne-5', 160]];
  const fueller: [DekoName, number][] = thema === 'glut'
    ? [['glutsteine', 34], ['glutsteine', 46], ['holzstapel', 50]]
    : TANNEN;
  const takt = thema === 'winter' ? 8 : thema === 'glut' ? 9 : 5;

  for (const seite of [1, -1]) {
    let i = Math.floor(rnd() * 6);
    while (i < n) {
      if (!gesperrt.has(i)) {
        const dickicht = (i % 110) < 12;
        const anzahl = dickicht ? 3 : 1;
        for (let k = 0; k < anzahl; k++) {
          const [name, wh] = fueller[Math.floor(rnd() * fueller.length)];
          const band = k === 0 && rnd() < 0.55
            ? strecke.breite + 40 + rnd() * 26
            : strecke.breite + 85 + rnd() * 45;
          leg(i + k * 3, seite, band, name, wh);
        }
        if (dickicht) { i += 16 + Math.floor(rnd() * 4); continue; }
      }
      i += takt + Math.floor(rnd() * 3);
    }
  }
  if (thema === 'winter') {
    for (let i = 20; i < n; i += 47) if (!gesperrt.has(i)) leg(i, rnd() < 0.5 ? 1 : -1, strecke.breite + 44 + rnd() * 14, 'schneemann', 30);
    for (let i = 5; i < n; i += 31) if (!gesperrt.has(i)) leg(i, rnd() < 0.5 ? 1 : -1, strecke.breite + 36 + rnd() * 30, 'eisblock', 22);
  }

  // Kurven-Telegraph: Laternen-Paare 25 Indizes vor starken Kurven.
  for (let i = 0; i < n; i += 5) {
    let drehung = 0;
    for (let k = 0; k < 15; k++) {
      let d = linie[(i + k + 1) % n].winkel - linie[(i + k) % n].winkel;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      drehung += Math.abs(d);
    }
    if (drehung > 0.55) {
      const ort = wrapIdx(i - 25, n);
      if (!gesperrt.has(ort)) {
        leg(ort, 1, strecke.breite + 34, 'laterne', 46);
        leg(ort, -1, strecke.breite + 34, 'laterne', 46);
      }
    }
  }
  if (thema !== 'glut') {
    for (let i = 33; i < n; i += 57) if (!gesperrt.has(i)) leg(i, rnd() < 0.5 ? 1 : -1, strecke.breite + 46 + rnd() * 20, 'fels', 34);
  }
  leg(150, 1, strecke.breite + 38, 'wegweiser', 52);
  leg(430, -1, strecke.breite + 38, 'kuebel', 26);
  leg(90, -1, strecke.breite + 95, 'blockhaus', 130);
  leg(270, 1, strecke.breite + 70, 'holzstapel', 55);
  leg(thema === 'dorf' ? 450 : 520, thema === 'dorf' ? -1 : 1, strecke.breite + 78, 'saunafass', 60);
  if (thema === 'dorf') leg(600, 1, strecke.breite + 95, 'blockhaus', 130);
  const GAESTE: DekoName[] = ['gast-1', 'gast-2', 'gast-3', 'gast-4'];
  for (const seite of [1, -1]) {
    for (let k = 0; k < 3; k++) leg(n - 14 + k * 5, seite, strecke.breite + 36 + k * 6, GAESTE[Math.floor(rnd() * GAESTE.length)], 38);
  }
  // Das Ziel-Tor über der Bahn — ohne Abstandsprüfung, es gehört genau dorthin.
  const t = linie[4];
  deko.push({ x: t.x, y: t.y, name: 'torbogen', wh: 125, phase: 0 });
  return deko;
}
