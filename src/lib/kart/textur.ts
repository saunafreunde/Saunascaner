// Sauna-Kart: die Bodentextur einer Strecke (Canvas, nur im Browser).
//
// Gemalt aus GENAU der Geometrie, aus der die Physik ihre Maske hat
// (strecken.ts) — was man sieht, ist das, worauf man fährt. Vier Themen:
// Wald (Holzsteg), Dorf (Waldweg), Winter (Schnee und Eis), Glut (Basalt und
// glühende Steine).

import {
  TEX_SIZE, mulberry32, hashText, querPunkt,
  type LinienPunkt, type StreckenGeometrie,
} from './strecken';

export function bauTextur(geo: StreckenGeometrie, bodenTextur?: CanvasImageSource | null): HTMLCanvasElement {
  const { strecke, linie } = geo;
  const textur = document.createElement('canvas');
  textur.width = TEX_SIZE;
  textur.height = TEX_SIZE;
  const ctx = textur.getContext('2d')!;
  const rnd = mulberry32(hashText(strecke.id) ^ 0xa5f3);
  const thema = strecke.thema;

  // ── Umland ─────────────────────────────────────────────────────────────
  ctx.fillStyle = strecke.wiese;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  // Rauschen: eine flache Farbe flimmert im Mode-7-Boden, Muster gibt Halt.
  const hell = thema === 'winter' ? 'rgba(255,255,255,0.35)' : thema === 'glut' ? 'rgba(255,120,40,0.08)' : 'rgba(255,255,255,0.05)';
  const dunkel = thema === 'winter' ? 'rgba(90,130,160,0.10)' : 'rgba(0,0,0,0.12)';
  ctx.fillStyle = hell;
  for (let i = 0; i < 2600; i++) ctx.fillRect(Math.floor(rnd() * TEX_SIZE), Math.floor(rnd() * TEX_SIZE), 2, 2);
  ctx.fillStyle = dunkel;
  for (let i = 0; i < 2600; i++) ctx.fillRect(Math.floor(rnd() * TEX_SIZE), Math.floor(rnd() * TEX_SIZE), 3, 2);
  if (thema === 'glut') {
    // Glutnester im Basalt
    for (let i = 0; i < 160; i++) {
      const x = rnd() * TEX_SIZE, y = rnd() * TEX_SIZE, r = 3 + rnd() * 6;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,150,60,0.55)');
      g.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  } else {
    ctx.fillStyle = thema === 'winter' ? 'rgba(40,80,60,0.35)' : 'rgba(10,40,16,0.5)';
    for (let i = 0; i < 90; i++) {
      ctx.beginPath(); ctx.arc(rnd() * TEX_SIZE, rnd() * TEX_SIZE, 5 + rnd() * 7, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── Bande (Curbs) + Fahrbahn ───────────────────────────────────────────
  zeichneBahn(ctx, linie, strecke.breite + 9, strecke.bande);
  ctx.save();
  ctx.setLineDash([16, 16]);
  zeichneBahn(ctx, linie, strecke.breite + 9, strecke.bandeAkzent);
  ctx.restore();
  let mitTextur = false;
  if (bodenTextur) {
    const muster = ctx.createPattern(bodenTextur, 'repeat');
    if (muster) {
      if ('setTransform' in muster) muster.setTransform(new DOMMatrix().scale(0.25));
      zeichneBahn(ctx, linie, strecke.breite, muster);
      mitTextur = true;
    }
  }
  if (!mitTextur) zeichneBahn(ctx, linie, strecke.breite, strecke.bahn);

  // Querfugen/Maserung: geben im Mode-7-Blick das Tempo-Gefühl.
  if (!mitTextur) {
    if (thema === 'winter') {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < linie.length; i += 3) {
        const q = (rnd() * 2 - 1) * strecke.breite * 0.8;
        const a = querPunkt(linie, i, q), b = querPunkt(linie, i + 2, q + (rnd() - 0.5) * 6);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    } else if (thema === 'glut') {
      // Pflaster aus Saunasteinen
      for (let i = 0; i < linie.length; i += 2) {
        for (let k = 0; k < 3; k++) {
          const q = (rnd() * 2 - 1) * strecke.breite * 0.9;
          const p = querPunkt(linie, i, q);
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(30,22,20,0.35)' : 'rgba(140,110,95,0.25)';
          ctx.beginPath(); ctx.ellipse(p.x, p.y, 4 + rnd() * 4, 3 + rnd() * 3, rnd() * 3, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.strokeStyle = thema === 'winter' ? 'rgba(80,120,150,0.25)' : 'rgba(40,28,20,0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i < linie.length; i += 8) {
      const a = querPunkt(linie, i, -strecke.breite), b = querPunkt(linie, i, strecke.breite);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }

  // ── Geheime Abkürzungen: unauffälliger Trampelpfad ─────────────────────
  for (const ab of strecke.abkuerzungen) {
    const a = linie[ab.von], b = linie[ab.bis];
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(58,72,48,0.9)';
    ctx.lineWidth = 34;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(96,84,58,0.55)';
    ctx.lineWidth = 22;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  // ── Bodenfelder ────────────────────────────────────────────────────────
  const n = linie.length;
  for (const feld of strecke.felder) {
    const quer = (feld.quer ?? 0) * strecke.breite;
    const halb = strecke.breite * (feld.anteil ?? 0.85);
    if (feld.typ === 'turbo') {
      ctx.strokeStyle = thema === 'glut' ? '#ffb347' : '#6fd8e8';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const p = querPunkt(linie, feld.idx + 2 + k * 5, quer);
        const fx = Math.cos(p.winkel), fy = Math.sin(p.winkel);
        const qx = -fy, qy = fx;
        ctx.beginPath();
        ctx.moveTo(p.x - qx * 16 - fx * 10, p.y - qy * 16 - fy * 10);
        ctx.lineTo(p.x + fx * 10, p.y + fy * 10);
        ctx.lineTo(p.x + qx * 16 - fx * 10, p.y + qy * 16 - fy * 10);
        ctx.stroke();
      }
    } else if (feld.typ === 'brems') {
      const p = querPunkt(linie, feld.idx + Math.floor(feld.laenge / 2), quer);
      ctx.fillStyle = 'rgba(92,140,168,0.8)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, halb, halb * 0.72, p.winkel, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(210,228,238,0.5)';
      for (let k = 0; k < 4; k++) {
        const q = linie[(feld.idx + 2 + k * 3) % n];
        ctx.beginPath(); ctx.arc(q.x + (k % 2 ? 8 : -8), q.y + (k % 2 ? -6 : 6), 4, 0, Math.PI * 2); ctx.fill();
      }
    } else if (feld.typ === 'rampe') {
      for (let k = 0; k <= feld.laenge; k += 2) {
        const a = querPunkt(linie, feld.idx + k, quer - halb * 0.95), b = querPunkt(linie, feld.idx + k, quer + halb * 0.95);
        ctx.strokeStyle = k >= feld.laenge - 1 ? '#3a2c1c' : '#d8b06a';
        ctx.lineWidth = k >= feld.laenge - 1 ? 5 : 7;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    } else if (feld.typ === 'eis') {
      for (let k = 0; k <= feld.laenge; k++) {
        const p = querPunkt(linie, feld.idx + k, quer);
        ctx.fillStyle = 'rgba(228,246,255,0.9)';
        ctx.beginPath(); ctx.arc(p.x, p.y, halb, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 2;
      for (let k = 0; k < feld.laenge; k += 3) {
        const a = querPunkt(linie, feld.idx + k, quer + (rnd() - 0.5) * halb);
        const b = querPunkt(linie, feld.idx + k + 2, quer + (rnd() - 0.5) * halb);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(120,180,215,0.6)';
      for (let k = 0; k < feld.laenge; k += 4) {
        const a = querPunkt(linie, feld.idx + k, quer + (rnd() - 0.5) * halb * 1.4);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + (rnd() - 0.5) * 18, a.y + (rnd() - 0.5) * 18); ctx.stroke();
      }
    } else if (feld.typ === 'glut') {
      for (let k = 0; k <= feld.laenge; k++) {
        const p = querPunkt(linie, feld.idx + k, quer);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, halb);
        g.addColorStop(0, 'rgba(255,170,60,0.55)');
        g.addColorStop(0.7, 'rgba(230,80,25,0.35)');
        g.addColorStop(1, 'rgba(120,30,10,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, halb, 0, Math.PI * 2); ctx.fill();
      }
      for (let k = 0; k < feld.laenge * 3; k++) {
        const p = querPunkt(linie, feld.idx + rnd() * feld.laenge, quer + (rnd() - 0.5) * halb * 1.6);
        ctx.fillStyle = rnd() < 0.5 ? '#2a201c' : '#3d302a';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 4 + rnd() * 3, 3 + rnd() * 2, rnd() * 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffb04a';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(p.x - 3, p.y); ctx.lineTo(p.x + 2, p.y - 1); ctx.stroke();
      }
    }
  }

  // ── Ziellinie: Schachbrett quer über die Bahn ──────────────────────────
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
  // Startaufstellung: kurze weiße Striche für acht Plätze
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const reihe = Math.floor(i / 2), spalte = i % 2;
    const idx = -(10 + reihe * 11 + spalte * 5) + 3;
    const q = (spalte === 0 ? -0.42 : 0.42) * strecke.breite;
    const a = querPunkt(linie, idx, q - 9), b = querPunkt(linie, idx, q + 9);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  return textur;
}

function zeichneBahn(
  ctx: CanvasRenderingContext2D,
  linie: LinienPunkt[],
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
