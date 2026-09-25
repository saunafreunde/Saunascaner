// Sauna-Kart-Engine: die Computerfahrer.
//
// Jeder Computerfahrer fährt auf einer eigenen „Spur" quer zur Bahn, nimmt in
// Kurven die Innenseite, weicht Fahrern und Seife aus, driftet je nach Klasse
// und setzt seine Items mit einfacher, aber lesbarer Absicht ein: Minze auf
// der Geraden, Seife wenn jemand dicht folgt, Filzhut wenn jemand vorn im
// Visier ist. Kleine Patzer (Schlenker) machen das Feld lebendig.

import { maskeBei, querPunkt, wrapIdx, M_SCHULTER, M_WAND } from '../strecken';
import { KLASSEN, begrenze, wrapWinkel, type Eingabe, type Fahrer, type KiZustand, type RennKern } from './typen';

export function neueKi(r: RennKern, persoenlichkeit: number, skill?: number): KiZustand {
  const [lo, hi] = KLASSEN[r.setup.klasse].kiSkill;
  return {
    skill: skill ?? lo + (hi - lo) * persoenlichkeit,
    spur: 0,
    spurZiel: (r.rnd() * 2 - 1) * 0.4,
    spurWechselIn: 1 + r.rnd() * 2,
    driftHalten: false,
    itemTimer: 0,
    fehlerRest: 0,
    fehlerRichtung: 1,
    persoenlichkeit,
  };
}

/** Summe der Richtungsänderung der Bahn zwischen zwei Abständen voraus (rad, + = rechts). */
export function kurveVoraus(r: RennKern, idx: number, von: number, bis: number): number {
  const { linie } = r.geo;
  const n = linie.length;
  let summe = 0;
  for (let k = von; k < bis; k++) {
    summe += wrapWinkel(linie[wrapIdx(idx + k + 1, n)].winkel - linie[wrapIdx(idx + k, n)].winkel);
  }
  return summe;
}

/** Lage eines Punkts im Blickfeld eines Fahrers: vor (+) / quer (+ = rechts). */
function relativ(f: Fahrer, x: number, y: number): { vor: number; quer: number } {
  const dx = x - f.x, dy = y - f.y;
  const c = Math.cos(f.richtung), s = Math.sin(f.richtung);
  return { vor: dx * c + dy * s, quer: -dx * s + dy * c };
}

export function kiEingabe(r: RennKern, f: Fahrer, dt: number): Eingabe {
  const ki = f.ki!;
  const breite = r.setup.strecke.breite;
  const tempo = f.v / r.vMax;
  const kNah = kurveVoraus(r, f.letzterIdx, 4, 26);
  const kFern = kurveVoraus(r, f.letzterIdx, 14, 50);

  // ── Spurwahl ─────────────────────────────────────────────────────────
  ki.spurWechselIn -= dt;
  if (ki.spurWechselIn <= 0) {
    ki.spurWechselIn = 1.5 + r.rnd() * 3;
    ki.spurZiel = (r.rnd() * 2 - 1) * 0.5;
  }
  let spurZiel = ki.spurZiel;
  // Ideallinie: in Kurven innen (+ = rechts, Kurve nach rechts = positiv)
  if (Math.abs(kFern) > 0.45) spurZiel = Math.sign(kFern) * (0.3 + 0.25 * ki.persoenlichkeit);

  // Ausweichen: langsamere Fahrer und Seife voraus
  for (const g of r.fahrer) {
    if (g === f || g.fertig) continue;
    const { vor, quer } = relativ(f, g.x, g.y);
    if (vor > 0 && vor < 48 && Math.abs(quer) < 17 && g.v < f.v + 8) {
      spurZiel += (quer >= 0 ? -1 : 1) * 0.55;
    }
    // Mit Glutstern: auf Rammkurs gehen
    if (f.sternRest > 0 && vor > 0 && vor < 90 && Math.abs(quer) < 40) {
      spurZiel = begrenze(ki.spur + quer / (breite * 0.7), -0.75, 0.75);
    }
  }
  for (const s of r.fallen) {
    const { vor, quer } = relativ(f, s.x, s.y);
    if (vor > 8 && vor < 95 && Math.abs(quer) < 19) spurZiel += (quer >= 0 ? -1 : 1) * 0.75;
  }
  spurZiel = begrenze(spurZiel, -0.75, 0.75);
  ki.spur += (spurZiel - ki.spur) * Math.min(1, 2.2 * dt);

  // ── Lenken auf einen Punkt voraus ────────────────────────────────────
  // Sichtlinie: liegt zwischen Kart und Zielpunkt Schulter oder Wand (die
  // Innenseite einer Kehre), rückt der Zielpunkt näher — sonst schneidet der
  // Computer jede Haarnadel quer übers Gras.
  let voraus = Math.round(8 + f.v * 0.12);
  let z = querPunkt(r.geo.linie, f.letzterIdx + voraus, ki.spur * breite * 0.7);
  while (voraus > 6 && !freieSicht(r, f.x, f.y, z.x, z.y)) {
    voraus -= 4;
    z = querPunkt(r.geo.linie, f.letzterIdx + voraus, ki.spur * breite * 0.7);
  }
  const soll = Math.atan2(z.y - f.y, z.x - f.x);
  let lenk = begrenze(wrapWinkel(soll - f.richtung) * 2.6);

  // Patzer: kurzer Schlenker — häufiger bei vorsichtigen Fahrern in kleinen Klassen
  if (ki.fehlerRest > 0) {
    ki.fehlerRest -= dt;
    lenk = begrenze(lenk + ki.fehlerRichtung * 0.7);
  } else if (r.rnd() < dt * 0.25 * (1.02 - ki.skill)) {
    ki.fehlerRest = 0.25 + r.rnd() * 0.35;
    ki.fehlerRichtung = r.rnd() < 0.5 ? -1 : 1;
  }
  if (f.langsamRest > 0) lenk = begrenze(lenk + Math.sin(r.zeitMs * 0.012 + f.nr) * 0.3);

  // ── Drift ────────────────────────────────────────────────────────────
  const klasse = KLASSEN[r.setup.klasse];
  if (!ki.driftHalten) {
    if (Math.abs(kNah) > 0.75 && tempo > 0.6 && f.flugRest <= 0 && f.taumelRest <= 0
        && Math.sign(lenk) === Math.sign(kNah) && r.rnd() < klasse.kiDrift * dt * 8) {
      ki.driftHalten = true;
    }
  } else if (Math.abs(kNah) < 0.3 || f.taumelRest > 0
      || (f.driftAktiv && lenk * f.driftSeite < -0.35)
      || (!f.driftAktiv && f.hopRest <= 0 && !f.driftBereit && f.driftKnopf)) {
    // Kurve vorbei, der Computer will schon gegenlenken (sonst trägt ihn der
    // Drift in die Außenbande) — oder der Hüpfer hat keinen Drift ergeben.
    ki.driftHalten = false;
  }

  // ── Items ────────────────────────────────────────────────────────────
  let item = false;
  if (f.item && f.taumelRest <= 0) {
    ki.itemTimer -= dt;
    if (ki.itemTimer <= 0) item = willItem(r, f, kNah);
  }

  // ── Gas: vor engen Kurven lupfen, wer nicht driftet ──────────────────
  // Wie stark, hängt an der Kurve UND am eigenen Tempo: wer mit Boost in eine
  // Kehre schießt, geht mehr vom Gas als wer ohnehin langsam ist.
  let gas = 1;
  const scharf = Math.max(Math.abs(kNah), Math.abs(kurveVoraus(r, f.letzterIdx, 10, 34)) * 0.9);
  if (!f.driftAktiv && scharf > 0.8) gas = Math.max(0.62, 1 - (scharf - 0.8) * 0.45 * Math.min(1.4, tempo));
  else if (f.driftAktiv && scharf > 1.3) gas = 0.9;

  return { lenk, digital: false, drift: ki.driftHalten, item, gas };
}

function freieSicht(r: RennKern, x0: number, y0: number, x1: number, y1: number): boolean {
  for (const t of [0.35, 0.65, 0.9]) {
    const w = maskeBei(r.geo.maske, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    if (w === M_SCHULTER || w === M_WAND) return false;
  }
  return true;
}

function willItem(r: RennKern, f: Fahrer, kNah: number): boolean {
  const ki = f.ki!;
  switch (f.item) {
    case 'minze':
    case 'minze3':
      return Math.abs(kNah) < 0.35 && f.taumelRest <= 0;
    case 'glutstern':
    case 'aufguss':
      return true;
    case 'dampf':
      return f.platz > 1;
    case 'seife': {
      const hinten = r.fahrer.some((g) => g !== f && !g.fertig && f.fortschritt - g.fortschritt > 3 && f.fortschritt - g.fortschritt < 24);
      return hinten || ki.itemTimer < -7;
    }
    case 'filzhut': {
      const imVisier = r.fahrer.some((g) => {
        if (g === f || g.fertig) return false;
        const { vor, quer } = relativ(f, g.x, g.y);
        return vor > 20 && vor < 170 && Math.abs(quer) < 14;
      });
      return imVisier || ki.itemTimer < -9;
    }
    case 'eiskugel':
      return f.platz > 1;
    default:
      return false;
  }
}
