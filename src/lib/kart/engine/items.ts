// Sauna-Kart-Engine: Aufguss-Kisten, Duft-Tropfen und die acht Items.
//
// Die Verteilung hängt am Platz (wie beim Vorbild): vorne gibt es eher
// Verteidigung (Seife, Filzhut), hinten die starken Aufholer (Glutstern,
// 3× Minze, Aufguss). Genau das hält ein Rennen bis zur letzten Kurve offen.

import { maskeBei, M_WAND, querPunkt, wrapIdx } from '../strecken';
import { schub, type Fahrer, type ItemTyp, type RennKern } from './typen';

const KISTEN_RADIUS = 14;
const TROPFEN_RADIUS = 12;
const TREFFER_RADIUS = 13;
const SEIFEN_RADIUS = 12;
export const MAX_TROPFEN = 10;

/** Gewichte je Platzgruppe. */
const TABELLE: { bis: number; gewichte: Partial<Record<ItemTyp, number>> }[] = [
  { bis: 1, gewichte: { seife: 45, filzhut: 35, minze: 20 } },
  { bis: 3, gewichte: { seife: 25, filzhut: 30, eiskugel: 20, minze: 20, dampf: 5 } },
  { bis: 5, gewichte: { filzhut: 20, eiskugel: 30, minze: 25, minze3: 10, dampf: 10, seife: 5 } },
  { bis: 7, gewichte: { eiskugel: 30, minze3: 25, glutstern: 15, dampf: 15, minze: 15 } },
  { bis: 99, gewichte: { glutstern: 30, minze3: 30, eiskugel: 20, aufguss: 12, dampf: 8 } },
];

export function zieheItem(r: RennKern, platz: number): ItemTyp {
  // Mit weniger Fahrern im Feld rutscht die Tabelle mit: ein 4er-Feld nutzt
  // für den Letzten die Tabelle des Letzten, nicht die für Platz 4.
  const anteil = r.fahrer.length > 1 ? (platz - 1) / (r.fahrer.length - 1) : 0;
  const virtuell = 1 + Math.round(anteil * 7);
  const zeile = TABELLE.find((z) => virtuell <= z.bis) ?? TABELLE[TABELLE.length - 1];
  const eintraege = Object.entries(zeile.gewichte) as [ItemTyp, number][];
  const summe = eintraege.reduce((s, [, g]) => s + g, 0);
  let x = r.rnd() * summe;
  for (const [typ, g] of eintraege) {
    x -= g;
    if (x <= 0) return typ;
  }
  return eintraege[0][0];
}

/** Kisten, Tropfen und Seife unter einem Fahrer prüfen. */
export function aufsammeln(r: RennKern, f: Fahrer) {
  if (f.flugRest > 0) return;
  for (const k of r.kisten) {
    if (k.weg > 0) continue;
    const dx = k.x - f.x, dy = k.y - f.y;
    if (dx * dx + dy * dy < KISTEN_RADIUS * KISTEN_RADIUS) {
      k.weg = 2.5;
      if (!f.item && f.roulette <= 0) {
        f.roulette = 1.1;
        r.melde('kiste', f.nr);
      }
    }
  }
  for (const t of r.tropfen) {
    if (t.weg > 0) continue;
    const dx = t.x - f.x, dy = t.y - f.y;
    if (dx * dx + dy * dy < TROPFEN_RADIUS * TROPFEN_RADIUS) {
      t.weg = 12;
      if (f.muenzen < MAX_TROPFEN) f.muenzen += 1;
      r.melde('tropfen', f.nr, f.muenzen);
    }
  }
  for (let i = r.fallen.length - 1; i >= 0; i--) {
    const s = r.fallen[i];
    if (s.von === f.nr && s.schutz > 0) continue;
    const dx = s.x - f.x, dy = s.y - f.y;
    if (dx * dx + dy * dy < SEIFEN_RADIUS * SEIFEN_RADIUS) {
      r.fallen.splice(i, 1);
      treffen(r, f);
    }
  }
}

/** Ein Fahrer wird getroffen: Dreher, Tempo weg, zwei Tropfen verloren. */
export function treffen(r: RennKern, f: Fahrer, art: 'treffer' | 'stamm' = 'treffer') {
  // Wer schon im Ziel ist, fährt nur noch aus — der wird nicht mehr abgeschossen.
  if (f.sternRest > 0 || f.schonfrist > 0 || f.fertig) return;
  f.taumelRest = art === 'stamm' ? 0.8 : 1.1;
  f.taumelDreh = 0;
  f.v *= art === 'stamm' ? 0.35 : 0.3;
  f.driftAktiv = false;
  f.driftLadung = 0;
  f.driftStufe = 0;
  f.boostRest = 0;
  f.muenzen = Math.max(0, f.muenzen - 2);
  f.schonfrist = 1.6;
  r.melde(art, f.nr);
}

export function rouletteSchritt(r: RennKern, f: Fahrer, dt: number) {
  if (f.roulette <= 0) return;
  f.roulette -= dt;
  if (f.roulette <= 0) {
    f.roulette = 0;
    f.item = zieheItem(r, f.platz);
    f.itemAnzahl = f.item === 'minze3' ? 3 : 1;
    if (f.ki) f.ki.itemTimer = 0.6 + r.rnd() * 2.5;
    r.melde('item', f.nr);
  }
}

/** Das gehaltene Item einsetzen. */
export function itemBenutzen(r: RennKern, f: Fahrer) {
  const item = f.item;
  if (!item || f.taumelRest > 0) return;
  const verbrauchen = () => {
    f.itemAnzahl -= 1;
    if (f.itemAnzahl <= 0) { f.item = null; f.itemAnzahl = 0; }
  };
  switch (item) {
    case 'minze':
    case 'minze3': {
      schub(f, 1.2, 1.45);
      f.v = Math.max(f.v, r.vMax * 1.05);
      r.melde('minze', f.nr);
      verbrauchen();
      return;
    }
    case 'seife': {
      const hinten = querPunkt(r.geo.linie, f.letzterIdx - 5, 0);
      const x = f.x - Math.cos(f.richtung) * 16, y = f.y - Math.sin(f.richtung) * 16;
      // Nie in die Wand legen — dann eben auf die Mittellinie dahinter.
      const frei = maskeBei(r.geo.maske, x, y) !== M_WAND;
      r.fallen.push({ art: 'seife', x: frei ? x : hinten.x, y: frei ? y : hinten.y, lebt: 45, von: f.nr, schutz: 0.8 });
      r.melde('seifeAb', f.nr);
      verbrauchen();
      return;
    }
    case 'filzhut': {
      const tempo = f.v + 190;
      r.geschosse.push({
        art: 'filzhut',
        x: f.x + Math.cos(f.richtung) * 14, y: f.y + Math.sin(f.richtung) * 14,
        vx: Math.cos(f.richtung) * tempo, vy: Math.sin(f.richtung) * tempo,
        lebt: 5, von: f.nr, ziel: -1, idx: f.letzterIdx, schutz: 0.35, abpraller: 0,
      });
      r.melde('wurf', f.nr);
      verbrauchen();
      return;
    }
    case 'eiskugel': {
      const vorne = r.fahrer.find((g) => g.platz === f.platz - 1 && !g.fertig);
      const tempo = Math.max(f.v + 120, 240);
      r.geschosse.push({
        art: 'eiskugel',
        x: f.x + Math.cos(f.richtung) * 14, y: f.y + Math.sin(f.richtung) * 14,
        vx: Math.cos(f.richtung) * tempo, vy: Math.sin(f.richtung) * tempo,
        lebt: 9, von: f.nr, ziel: vorne ? vorne.nr : -1, idx: f.letzterIdx, schutz: 0.35, abpraller: 0,
      });
      r.melde('wurf', f.nr);
      verbrauchen();
      return;
    }
    case 'glutstern': {
      f.sternRest = 7;
      f.taumelRest = 0;
      r.melde('stern', f.nr);
      verbrauchen();
      return;
    }
    case 'dampf': {
      for (const g of r.fahrer) {
        if (g.nr === f.nr || g.platz >= f.platz || g.fertig || g.sternRest > 0) continue;
        if (g.istSpieler && !g.ki) g.nebelRest = 3.4;
        g.langsamRest = Math.max(g.langsamRest, 2.4);
        g.langsamFaktor = Math.min(g.langsamFaktor, 0.86);
        if (g.ki) { g.ki.fehlerRest = 0.8; g.ki.fehlerRichtung = r.rnd() < 0.5 ? -1 : 1; }
      }
      r.melde('dampf', f.nr);
      verbrauchen();
      return;
    }
    case 'aufguss': {
      for (const g of r.fahrer) {
        if (g.nr === f.nr || g.fertig || g.sternRest > 0) continue;
        g.langsamRest = 2.6;
        g.langsamFaktor = 0.6;
        g.driftAktiv = false;
        g.driftStufe = 0;
        g.driftLadung = 0;
        if (g.item || g.roulette > 0) { g.item = null; g.itemAnzahl = 0; g.roulette = 0; r.melde('itemWeg', g.nr); }
      }
      r.melde('aufguss', f.nr);
      verbrauchen();
      return;
    }
  }
}

/** Geschosse bewegen, abprallen lassen, treffen. */
export function geschosseSchritt(r: RennKern, dt: number) {
  const { linie, maske } = r.geo;
  const n = linie.length;
  for (let i = r.geschosse.length - 1; i >= 0; i--) {
    const g = r.geschosse[i];
    g.lebt -= dt;
    g.schutz -= dt;
    if (g.lebt <= 0) { r.geschosse.splice(i, 1); continue; }

    if (g.art === 'eiskugel') {
      // Folgt der Bahn (Mittellinien-Index wandert mit), bis das Ziel nah ist —
      // dann direkt drauf. Ohne Ziel fliegt sie wie ein Filzhut.
      const tempo = Math.hypot(g.vx, g.vy);
      const ziel = g.ziel >= 0 ? r.fahrer[g.ziel] : null;
      let tx: number, ty: number;
      if (ziel && !ziel.fertig && Math.hypot(ziel.x - g.x, ziel.y - g.y) < 90) {
        tx = ziel.x; ty = ziel.y;
      } else if (ziel) {
        // nächsten Mittellinienpunkt ein Stück voraus suchen
        let bester = g.idx, bestD = Infinity;
        for (let o = -6; o <= 20; o++) {
          const p = linie[wrapIdx(g.idx + o, n)];
          const d = (p.x - g.x) ** 2 + (p.y - g.y) ** 2;
          if (d < bestD) { bestD = d; bester = g.idx + o; }
        }
        g.idx = wrapIdx(bester, n);
        const p = linie[wrapIdx(g.idx + 12, n)];
        tx = p.x; ty = p.y;
      } else {
        tx = g.x + g.vx; ty = g.y + g.vy;
      }
      const soll = Math.atan2(ty - g.y, tx - g.x);
      const ist = Math.atan2(g.vy, g.vx);
      let d = soll - ist;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const neu = ist + Math.max(-7 * dt, Math.min(7 * dt, d));
      const v2 = Math.min(360, tempo + 40 * dt);
      g.vx = Math.cos(neu) * v2;
      g.vy = Math.sin(neu) * v2;
    }

    // Bewegung mit Abprallen an der Wand (achsgetrennt).
    const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
    if (maskeBei(maske, nx, ny) !== M_WAND) {
      g.x = nx; g.y = ny;
    } else {
      let geprallt = false;
      if (maskeBei(maske, nx, g.y) === M_WAND) { g.vx = -g.vx; geprallt = true; }
      if (maskeBei(maske, g.x, ny) === M_WAND) { g.vy = -g.vy; geprallt = true; }
      if (!geprallt) { g.vx = -g.vx; g.vy = -g.vy; }
      g.abpraller += 1;
      if (g.art === 'eiskugel' || g.abpraller > 6) { r.geschosse.splice(i, 1); continue; }
    }

    // Treffer auf Fahrer
    let weg = false;
    for (const f of r.fahrer) {
      if (f.flugRest > 0) continue;
      if (f.nr === g.von && g.schutz > 0) continue;
      const dx = f.x - g.x, dy = f.y - g.y;
      if (dx * dx + dy * dy < TREFFER_RADIUS * TREFFER_RADIUS) {
        treffen(r, f);
        weg = true;
        break;
      }
    }
    // Geschoss gegen Seife: beide weg
    if (!weg) {
      for (let k = r.fallen.length - 1; k >= 0; k--) {
        const s = r.fallen[k];
        const dx = s.x - g.x, dy = s.y - g.y;
        if (dx * dx + dy * dy < 14 * 14) { r.fallen.splice(k, 1); weg = true; break; }
      }
    }
    if (weg) r.geschosse.splice(i, 1);
  }

  for (let i = r.fallen.length - 1; i >= 0; i--) {
    const s = r.fallen[i];
    s.lebt -= dt;
    s.schutz -= dt;
    if (s.lebt <= 0) r.fallen.splice(i, 1);
  }
  for (const k of r.kisten) if (k.weg > 0) k.weg = Math.max(0, k.weg - dt);
  for (const t of r.tropfen) if (t.weg > 0) t.weg = Math.max(0, t.weg - dt);
}
