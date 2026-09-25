// Sauna-Kart-Engine: das Fahrmodell eines einzelnen Fahrers.
//
// Kern (Game-Feel-Kanon, 16.08.2026): Blickrichtung und Bewegungsrichtung
// sind getrennt, die Fahrt folgt der Nase mit Grip-Verzögerung. Neu in der
// Grand-Prix-Fassung (25.09.2026):
//   * Drift auf Knopfdruck wie beim Vorbild: Hüpfer, dann festes Einlenken in
//     die Kurve; der Lenkeinschlag macht den Bogen enger oder weiter. Die
//     Ladung zeigt sich als Funken (blau → orange → lila) und wird beim
//     Loslassen zum Mini-Turbo.
//   * Trick im Sprung (Drift-Knopf in der Luft) = Schub bei der Landung.
//   * Lenkhilfe für Einsteiger: zieht sanft zurück, bevor es in die Schulter geht.
//   * Glut, Eis, Pfütze, Turbo, Rampe als Oberflächen aus der Maske.

import {
  maskeBei, querPunkt, wrapIdx,
  M_BREMS, M_EIS, M_GLUT, M_RAMPE, M_SCHULTER, M_TURBO, M_WAND,
} from '../strecken';
import { KLASSEN, begrenze, schub, wrapWinkel, type Eingabe, type Fahrer, type RennKern } from './typen';

const LENKRATE = 2.55;         // rad/s bei voller Fahrt
const DRIFT_LENKRATE = 2.95;
const GRIP_BAHN = 7.5;         // wie schnell die Fahrt der Nase folgt (1/s)
const GRIP_SCHULTER = 3.2;
const GRIP_EIS = 1.3;
const GRIP_DRIFT = 3.0;
const GRIP_LUFT = 0.5;
const BESCHL = 1.55;
const DRIFT_STUFEN = [0.55, 1.25, 2.1];     // Sekunden bis blau / orange / lila
const MINITURBO_S = [0, 0.5, 0.9, 1.4];
const WAND_SCHLIFF = 0.965;    // je 1/60 s beim Entlangschrammen
const WAND_FRONTAL = 0.55;     // einmalig beim frontalen Einschlag

export interface FahrOptionen { lenkhilfe: boolean; autoDrift: boolean; }

/** Gummiband: Computerfahrer weit vorn werden etwas langsamer, weit hinten
 *  etwas schneller — das Feld bleibt beisammen, jedes Rennen bleibt offen. */
export function gummiFaktor(r: RennKern, f: Fahrer): number {
  if (r.setup.modus !== 'gp') return 1;
  const spieler = r.fahrer.find((g) => g.istSpieler);
  if (!spieler) return 1;
  const n = r.geo.linie.length;
  const d = (f.fortschritt - spieler.fortschritt) / n; // in Runden
  const g = KLASSEN[r.setup.klasse].gummi;
  if (d > 0) return 1 - Math.min(g, d * g * 3);
  return 1 + Math.min(g * 0.8, -d * g * 3);
}

/** Lenkhilfe: liegt 0,3 s voraus Schulter oder Wand, sanft Richtung Bahn ziehen. */
function lenkhilfe(r: RennKern, f: Fahrer, ziel: number): number {
  const px = f.x + Math.cos(f.fahrWinkel) * f.v * 0.3;
  const py = f.y + Math.sin(f.fahrWinkel) * f.v * 0.3;
  const w = maskeBei(r.geo.maske, px, py);
  if (w !== M_SCHULTER && w !== M_WAND) return ziel;
  const p = querPunkt(r.geo.linie, f.letzterIdx + 12, 0);
  const soll = Math.atan2(p.y - f.y, p.x - f.x);
  const korr = begrenze(wrapWinkel(soll - f.richtung) * 2.5);
  return begrenze(ziel * 0.4 + korr * 0.6);
}

export function fahrerSchritt(r: RennKern, f: Fahrer, e: Eingabe, dt: number, opts: FahrOptionen) {
  const { maske, linie } = r.geo;

  // ── Zeitgeber ─────────────────────────────────────────────────────────
  const sternVorher = f.sternRest > 0;
  const flogVorher = f.flugRest > 0;
  f.boostRest = Math.max(0, f.boostRest - dt);
  f.sternRest = Math.max(0, f.sternRest - dt);
  f.taumelRest = Math.max(0, f.taumelRest - dt);
  f.schonfrist = Math.max(0, f.schonfrist - dt);
  f.langsamRest = Math.max(0, f.langsamRest - dt);
  f.nebelRest = Math.max(0, f.nebelRest - dt);
  f.glutRest = Math.max(0, f.glutRest - dt);
  f.rempelSperre = Math.max(0, f.rempelSperre - dt);
  f.hopRest = Math.max(0, f.hopRest - dt);
  f.flugRest = Math.max(0, f.flugRest - dt);
  if (sternVorher && f.sternRest <= 0) r.melde('sternEnde', f.nr);
  if (f.langsamRest <= 0) f.langsamFaktor = 1;
  if (f.taumelRest > 0) f.taumelDreh += dt * 15;
  const fliegt = f.flugRest > 0;
  if (flogVorher && !fliegt) {
    r.melde('landung', f.nr);
    if (f.trick) {
      schub(f, 0.75, 1.35);
      f.v = Math.max(f.v, r.vMax);
      r.melde('turbo', f.nr);
    }
    f.trick = false;
    f.trickMoeglich = false;
  }

  const wert = maskeBei(maske, f.x, f.y);
  const tempoAnteil = f.v / r.vMax;

  // ── Höchsttempo aus Oberfläche und Zustand ───────────────────────────
  let vmax = r.vMax * (1 + 0.008 * f.muenzen);
  if (f.ki) vmax *= f.ki.skill * gummiFaktor(r, f);
  const boostet = f.boostRest > 0 || f.sternRest > 0;
  if (!fliegt) {
    if ((wert === M_SCHULTER || wert === M_WAND) && !boostet) vmax *= 0.45;
    if (wert === M_BREMS && f.sternRest <= 0) vmax *= 0.5;
    if (wert === M_GLUT && f.sternRest <= 0) {
      vmax *= 0.55;
      if (f.glutRest <= 0) r.melde('glut', f.nr);
      f.glutRest = 0.25;
    }
    if (wert === M_TURBO) {
      if (f.boostRest < 0.3) r.melde('turbo', f.nr);
      schub(f, 1.5, 1.5);
      f.v = Math.max(f.v, r.vMax * 1.05);
    }
    if (wert === M_RAMPE && f.letzterMaskenWert !== M_RAMPE && f.v > 0.5 * r.vMax) {
      f.flugDauer = 0.55 + 0.15 * Math.min(1, tempoAnteil);
      f.flugRest = f.flugDauer;
      f.trickMoeglich = true;
      f.trick = false;
      f.driftAktiv = false;
      f.driftStufe = 0;
      f.driftLadung = 0;
      r.melde('sprung', f.nr);
    }
    f.letzterMaskenWert = wert;
  }
  if (f.langsamRest > 0) vmax *= f.langsamFaktor;
  if (f.sternRest > 0) vmax *= 1.22;
  else if (f.boostRest > 0) vmax *= f.boostStaerke;
  if (f.taumelRest > 0) vmax *= 0.15;
  if (f.fehlstart > 0) { f.fehlstart = Math.max(0, f.fehlstart - dt); vmax = 0; }
  if (e.gas !== undefined) vmax *= e.gas;

  if (f.v < vmax) f.v += (vmax - f.v) * Math.min(1, BESCHL * dt) + Math.min(vmax - f.v, 12 * dt);
  else f.v += (vmax - f.v) * Math.min(1, (f.taumelRest > 0 ? 4 : 1.8) * dt);

  // ── Lenk-Eingabe formen ──────────────────────────────────────────────
  let ziel = begrenze(e.lenk);
  if (opts.lenkhilfe && !fliegt && f.taumelRest <= 0) ziel = lenkhilfe(r, f, ziel);
  if (f.taumelRest > 0) ziel = 0;
  if (fliegt) ziel *= 0.35;
  const rate = e.digital ? (Math.abs(ziel) > Math.abs(f.lenkPhys) ? 6 : 10) : 16;
  f.lenkPhys += (ziel - f.lenkPhys) * Math.min(1, rate * dt);
  f.lenkGlatt += (f.lenkPhys - f.lenkGlatt) * Math.min(1, 9 * dt);

  // ── Drift: Hüpfer, Einlenken, Funken, Mini-Turbo ─────────────────────
  let knopf = e.drift;
  if (opts.autoDrift) {
    knopf = f.driftAktiv ? Math.abs(e.lenk) > 0.25 : Math.abs(e.lenk) > 0.8 && f.v > 0.6 * r.vMax;
  }
  const flanke = knopf && !f.driftKnopf;
  f.driftKnopf = knopf;
  if (flanke) {
    if (fliegt && f.trickMoeglich && !f.trick) {
      f.trick = true;
      r.melde('trick', f.nr);
    } else if (!fliegt && f.taumelRest <= 0 && f.hopRest <= 0 && !f.driftAktiv && f.v > 0.35 * r.vMax) {
      f.hopRest = 0.16;
      f.driftBereit = true;
      r.melde('hop', f.nr);
    }
  }
  if (f.driftBereit && f.hopRest <= 0) {
    f.driftBereit = false;
    const l = Math.abs(e.lenk) > Math.abs(f.lenkPhys) ? e.lenk : f.lenkPhys;
    if (knopf && Math.abs(l) > 0.2 && !fliegt) {
      f.driftAktiv = true;
      f.driftSeite = l > 0 ? 1 : -1;
      f.driftLadung = 0;
      f.driftStufe = 0;
      r.melde('driftStart', f.nr);
    }
  }
  if (f.driftAktiv) {
    const abbruch = f.v < 0.3 * r.vMax || f.taumelRest > 0 || fliegt;
    if (!knopf || abbruch) {
      if (!abbruch && f.driftStufe > 0) {
        schub(f, MINITURBO_S[f.driftStufe], f.driftStufe === 3 ? 1.38 : 1.32);
        f.v = Math.max(f.v, r.vMax);
        r.melde('miniturbo', f.nr, f.driftStufe);
      }
      f.driftAktiv = false;
      f.driftLadung = 0;
      f.driftStufe = 0;
    } else {
      const mit = begrenze(f.lenkPhys * f.driftSeite);
      f.driftLadung += dt * (0.75 + 0.55 * Math.max(0, mit));
      const stufe = f.driftLadung >= DRIFT_STUFEN[2] ? 3 : f.driftLadung >= DRIFT_STUFEN[1] ? 2 : f.driftLadung >= DRIFT_STUFEN[0] ? 1 : 0;
      if (stufe !== f.driftStufe) {
        f.driftStufe = stufe;
        r.melde('driftStufe', f.nr, stufe);
      }
    }
  }

  // ── Drehen ───────────────────────────────────────────────────────────
  let dreh: number;
  if (f.driftAktiv) {
    const mit = begrenze(f.lenkPhys * f.driftSeite);
    const kurve = 0.45 + 0.275 * (mit + 1); // gegenlenken 0,45 · neutral 0,725 · einlenken 1,0
    dreh = f.driftSeite * DRIFT_LENKRATE * kurve * (0.55 + 0.45 * Math.min(1, tempoAnteil));
  } else {
    let kraft = LENKRATE * (0.35 + 0.65 * Math.min(1, tempoAnteil * 1.3));
    // Oberhalb von 85 % lässt die Lenkung leicht nach: bei Topspeed will die
    // Kurve gedriftet werden, nicht gelenkt.
    if (tempoAnteil > 0.85) kraft *= 1 - 0.22 * Math.min(1, (tempoAnteil - 0.85) / 0.3);
    dreh = f.lenkPhys * kraft;
  }
  if (f.taumelRest <= 0) f.richtung = wrapWinkel(f.richtung + dreh * dt);

  // ── Grip: die Fahrt folgt der Nase ───────────────────────────────────
  let grip = GRIP_BAHN;
  if (fliegt) grip = GRIP_LUFT;
  else if (wert === M_EIS) grip = GRIP_EIS;
  else if (wert === M_SCHULTER || wert === M_WAND) grip = GRIP_SCHULTER;
  if (f.driftAktiv) grip = Math.min(grip, GRIP_DRIFT);
  if (grip === GRIP_BAHN) grip *= 1 - 0.3 * Math.min(1, tempoAnteil);
  if (f.taumelRest > 0) grip = 2;
  f.fahrWinkel = wrapWinkel(f.fahrWinkel + wrapWinkel(f.richtung - f.fahrWinkel) * Math.min(1, grip * dt));

  // ── Bewegung mit Bande ───────────────────────────────────────────────
  const nx = f.x + Math.cos(f.fahrWinkel) * f.v * dt;
  const ny = f.y + Math.sin(f.fahrWinkel) * f.v * dt;
  const hierWand = maskeBei(maske, f.x, f.y) === M_WAND;
  let beruehrt = false, frontal = false;
  if (fliegt || hierWand || maskeBei(maske, nx, ny) !== M_WAND) {
    f.x = nx; f.y = ny;
  } else if (maskeBei(maske, nx, f.y) !== M_WAND) {
    f.x = nx; beruehrt = true;
  } else if (maskeBei(maske, f.x, ny) !== M_WAND) {
    f.y = ny; beruehrt = true;
  } else {
    beruehrt = true; frontal = true;
  }
  if (beruehrt) {
    if (frontal && !f.wandKontakt) {
      f.v *= WAND_FRONTAL;
      // Abprall wie beim Vorbild: die Nase dreht halb zur Bahn zurück, die
      // Fahrt zeigt zur Mitte — sonst klebt man frontal an der Bande.
      const p = linie[f.letzterIdx];
      const zurMitte = Math.atan2(p.y - f.y, p.x - f.x);
      f.fahrWinkel = zurMitte;
      f.richtung = wrapWinkel(f.richtung + wrapWinkel(p.winkel - f.richtung) * 0.5);
      f.driftAktiv = false;
      f.driftStufe = 0;
      f.driftLadung = 0;
    } else {
      f.v *= Math.pow(WAND_SCHLIFF, dt * 60);
    }
    if (!f.wandKontakt) r.melde('bande', f.nr, frontal ? 1 : 0);
  }
  f.wandKontakt = beruehrt;
  f.x = begrenze(f.x, 8, 1016);
  f.y = begrenze(f.y, 8, 1016);

  // ── Fortschritt entlang der Mittellinie (Fenster-Suche) ──────────────
  const n = linie.length;
  let besterIdx = f.letzterIdx, bester = Infinity;
  for (let o = -30; o <= 60; o++) {
    const i = wrapIdx(f.letzterIdx + o, n);
    const p = linie[i];
    const d = (p.x - f.x) * (p.x - f.x) + (p.y - f.y) * (p.y - f.y);
    if (d < bester) { bester = d; besterIdx = i; }
  }
  let delta = besterIdx - f.letzterIdx;
  if (delta > n / 2) delta -= n;
  if (delta < -n / 2) delta += n;
  f.fortschritt += delta;
  f.letzterIdx = besterIdx;
}
