// Sauna-Kart-Engine: ein Rennen von der Startaufstellung bis zur Zielflagge.
//
// Ablauf: intro (Kamera fährt heran) → countdown (3-2-1, Raketenstart) →
// rennen → auslauf (Spieler im Ziel, der Rest fährt zu Ende, der Spieler
// rollt auf Autopilot mit) → fertig.
//
// Die Physik läuft mit festem Takt (PHYSIK_DT) — auf 60- und 120-Hz-Handys
// fährt sich das Kart dadurch exakt gleich.

import { hashText, mulberry32, querPunkt, wrapIdx } from '../strecken';
import { fahrerSchritt } from './physik';
import { kiEingabe, neueKi } from './ki';
import { aufsammeln, geschosseSchritt, itemBenutzen, rouletteSchritt, treffen } from './items';
import {
  AUSLAUF_MS, COUNTDOWN_MS, GEIST_DT_MS, INTRO_MS, KLASSEN, LEERE_EINGABE,
  type Eingabe, type Ereignis, type EreignisArt, type Fahrer, type Falle, type Geschoss,
  type Kiste, type RennErgebnis, type RennKern, type RennPhase, type RennSetup, type Tropfen,
} from './typen';

const STAMM_RADIUS = 15;
const KART_RADIUS = 10;

export class Rennen implements RennKern {
  readonly setup: RennSetup;
  readonly geo: RennSetup['geo'];
  readonly vMax: number;
  readonly fahrer: Fahrer[];
  readonly spieler: Fahrer;
  kisten: Kiste[] = [];
  tropfen: Tropfen[] = [];
  geschosse: Geschoss[] = [];
  fallen: Falle[] = [];
  rnd: () => number;
  phase: RennPhase = 'intro';
  /** Rennzeit ab „LOS!" in ms. */
  zeitMs = 0;
  /** Zeit in der aktuellen Phase (intro/countdown) in ms. */
  phaseMs = 0;
  countdownMs = COUNTDOWN_MS;
  rundenZeiten: number[] = [];
  private rundeStartMs = 0;
  private ereignisse: Ereignis[] = [];
  private eingaben: Eingabe[] = [];
  private geistPts: [number, number, number][] = [];
  private naechsteProbe = 0;
  private auslaufBisMs = 0;
  private reihenfolge: number[] = [];

  constructor(setup: RennSetup) {
    this.setup = setup;
    this.geo = setup.geo;
    this.vMax = KLASSEN[setup.klasse].vMax;
    this.rnd = mulberry32(setup.saat ^ hashText(setup.strecke.id));
    const { linie } = this.geo;
    const n = linie.length;
    const breite = setup.strecke.breite;
    const allein = setup.fahrer.length === 1;

    this.fahrer = setup.fahrer.map((fs, i) => {
      const reihe = Math.floor(i / 2), spalte = i % 2;
      const idx = allein ? -10 : -(10 + reihe * 11 + spalte * 5);
      const quer = allein ? 0 : (spalte === 0 ? -0.42 : 0.42) * breite;
      const p = querPunkt(linie, idx, quer);
      const f: Fahrer = {
        nr: i, name: fs.name, skin: fs.skin, istSpieler: fs.istSpieler,
        x: p.x, y: p.y, richtung: p.winkel, fahrWinkel: p.winkel, v: 0,
        lenkPhys: 0, lenkGlatt: 0,
        driftKnopf: false, hopRest: 0, driftBereit: false, driftAktiv: false, driftSeite: 1,
        driftLadung: 0, driftStufe: 0,
        boostRest: 0, boostStaerke: 1, sternRest: 0, taumelRest: 0, taumelDreh: 0, schonfrist: 0,
        flugRest: 0, flugDauer: 0.6, trickMoeglich: false, trick: false,
        langsamRest: 0, langsamFaktor: 1, nebelRest: 0, glutRest: 0,
        muenzen: 0, item: null, itemAnzahl: 0, roulette: 0,
        fortschritt: idx, letzterIdx: wrapIdx(idx, n), runde: 1, fertig: false, zielZeitMs: null,
        platz: i + 1, wandKontakt: false, letzterMaskenWert: 1,
        startKnopfAb: null, fehlstart: 0, ki: null, rempelSperre: 0,
      };
      return f;
    });
    for (const f of this.fahrer) {
      if (!f.istSpieler) f.ki = neueKi(this, setup.fahrer[f.nr].persoenlichkeit ?? this.rnd());
    }
    this.spieler = this.fahrer.find((f) => f.istSpieler) ?? this.fahrer[0];
    this.eingaben = this.fahrer.map(() => LEERE_EINGABE);

    if (setup.modus === 'gp') {
      for (const reihe of setup.strecke.kisten) {
        for (const q of [-0.6, -0.2, 0.2, 0.6]) {
          const p = querPunkt(linie, reihe.idx, q * breite);
          this.kisten.push({ x: p.x, y: p.y, weg: 0, phase: (reihe.idx * 7 + q * 10) % 6.28 });
        }
      }
    } else {
      // Zeitfahren wie beim Vorbild: drei Minz-Schübe von Anfang an.
      this.spieler.item = 'minze3';
      this.spieler.itemAnzahl = 3;
    }
    for (const reihe of setup.strecke.tropfen) {
      for (let k = 0; k < reihe.anzahl; k++) {
        const p = querPunkt(linie, reihe.idx + k * 5, reihe.quer * breite);
        this.tropfen.push({ x: p.x, y: p.y, weg: 0, phase: k * 0.9 });
      }
    }
    this.reihenfolge = this.fahrer.map((f) => f.nr);
  }

  melde(art: EreignisArt, fahrer: number, wert?: number) {
    this.ereignisse.push({ art, fahrer, wert });
  }

  /** Ereignisse seit dem letzten Abholen (Ton, Haptik, Anzeige). */
  holeEreignisse(): Ereignis[] {
    const e = this.ereignisse;
    this.ereignisse = [];
    return e;
  }

  /** Ein fester Physik-Schritt. */
  schritt(dt: number, eingabe: Eingabe) {
    if (this.phase === 'intro') {
      this.phaseMs += dt * 1000;
      if (this.phaseMs >= INTRO_MS) {
        this.phase = 'countdown';
        this.phaseMs = 0;
        this.countdownMs = COUNTDOWN_MS;
        this.melde('countdown', -1, 3);
      }
      return;
    }
    if (this.phase === 'countdown') {
      this.countdownSchritt(dt, eingabe);
      return;
    }
    if (this.phase === 'fertig') return;
    this.simuliere(dt, eingabe);
  }

  private countdownSchritt(dt: number, eingabe: Eingabe) {
    const vorher = Math.ceil(this.countdownMs / 1000);
    this.countdownMs -= dt * 1000;
    const jetzt = Math.ceil(Math.max(0, this.countdownMs) / 1000);
    if (jetzt !== vorher && jetzt > 0) this.melde('countdown', -1, jetzt);

    // Raketenstart: Drift-Knopf nach der „2" drücken und halten.
    const s = this.spieler;
    if (eingabe.drift) { if (s.startKnopfAb === null) s.startKnopfAb = this.countdownMs; }
    else s.startKnopfAb = null;

    if (this.countdownMs <= 0) {
      this.phase = 'rennen';
      this.zeitMs = 0;
      this.rundeStartMs = 0;
      this.melde('start', -1);
      for (const f of this.fahrer) {
        if (f.istSpieler) {
          const ab = f.startKnopfAb;
          if (ab !== null && ab > 2300) {
            f.fehlstart = 0.9;
            f.taumelRest = 0.9;
            this.melde('fehlstart', f.nr);
          } else if (ab !== null && ab <= 2000 && ab >= 600) {
            f.boostRest = 1.2; f.boostStaerke = 1.45;
            f.v = this.vMax * 0.9;
            this.melde('startBoost', f.nr);
          }
          f.driftKnopf = eingabe.drift; // kein Hüpfer aus dem gehaltenen Startknopf
        } else if (f.ki && this.rnd() < f.ki.skill - 0.55) {
          f.boostRest = 1.0; f.boostStaerke = 1.4;
          f.v = this.vMax * 0.8;
        }
      }
    }
  }

  private simuliere(dt: number, eingabe: Eingabe) {
    this.zeitMs += dt * 1000;
    const n = this.geo.linie.length;
    const runden = this.setup.strecke.runden;

    for (const f of this.fahrer) {
      const e = f.ki ? kiEingabe(this, f, dt) : eingabe;
      this.eingaben[f.nr] = e;
      fahrerSchritt(this, f, e, dt, f.istSpieler && !f.ki
        ? { lenkhilfe: this.setup.lenkhilfe, autoDrift: this.setup.autoDrift }
        : { lenkhilfe: false, autoDrift: false });
    }

    this.kollisionen();
    this.staemme();
    geschosseSchritt(this, dt);
    for (const f of this.fahrer) {
      aufsammeln(this, f);
      rouletteSchritt(this, f, dt);
      if (this.eingaben[f.nr].item && !f.fertig) itemBenutzen(this, f);
    }

    // Runden und Ziel
    for (const f of this.fahrer) {
      if (f.fertig) continue;
      const runde = Math.max(1, Math.floor(f.fortschritt / n) + 1);
      if (runde > f.runde) {
        f.runde = runde;
        if (f.istSpieler) {
          this.rundenZeiten.push(Math.round(this.zeitMs - this.rundeStartMs));
          this.rundeStartMs = this.zeitMs;
          if (runde <= runden) this.melde(runde === runden ? 'letzteRunde' : 'runde', f.nr, runde);
        }
      }
      if (f.fortschritt >= n * runden) {
        f.fertig = true;
        f.zielZeitMs = Math.round(this.zeitMs);
        this.melde('ziel', f.nr);
        if (f.istSpieler) {
          // Spieler im Ziel: Autopilot übernimmt, der Rest fährt zu Ende.
          f.ki = neueKi(this, 0.8, 0.9);
          f.item = null; f.itemAnzahl = 0; f.roulette = 0;
          this.phase = 'auslauf';
          this.auslaufBisMs = this.zeitMs + (this.setup.modus === 'gp' ? AUSLAUF_MS : 2500);
        }
      }
    }

    this.platzieren();

    // Geist aufzeichnen (Zeitfahren) — 10 Hz Spielzeit, bis zur Ziellinie.
    if (this.setup.modus === 'zeitfahren' && !this.spieler.fertig) {
      while (this.zeitMs >= this.naechsteProbe && this.geistPts.length < 4800) {
        this.naechsteProbe += GEIST_DT_MS;
        const s = this.spieler;
        this.geistPts.push([Math.round(s.x * 10), Math.round(s.y * 10), Math.round(s.richtung * 100)]);
      }
    }

    if (this.phase === 'auslauf') {
      const alle = this.fahrer.every((f) => f.fertig);
      if (alle || this.zeitMs >= this.auslaufBisMs) {
        this.phase = 'fertig';
        this.melde('rennEnde', -1);
      }
    }
  }

  /** Kart gegen Kart: auseinanderschieben, Tempo kosten, Glutstern räumt ab. */
  private kollisionen() {
    const fs = this.fahrer;
    const min = KART_RADIUS * 2;
    for (let i = 0; i < fs.length; i++) {
      const a = fs[i];
      for (let j = i + 1; j < fs.length; j++) {
        const b = fs[j];
        if ((a.flugRest > 0) !== (b.flugRest > 0)) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 < 0.0001) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        const ueber = (min - d) / 2;
        a.x -= nx * ueber; a.y -= ny * ueber;
        b.x += nx * ueber; b.y += ny * ueber;
        if (a.sternRest > 0 && b.sternRest <= 0) { treffen(this, b); continue; }
        if (b.sternRest > 0 && a.sternRest <= 0) { treffen(this, a); continue; }
        // Wer von hinten auffährt, verliert mehr.
        const aVorne = (Math.cos(a.fahrWinkel) * nx + Math.sin(a.fahrWinkel) * ny) > 0;
        a.v *= aVorne ? 0.93 : 0.98;
        b.v *= aVorne ? 0.98 : 0.93;
        // seitlicher Schubs in die Fahrtrichtung des anderen
        a.fahrWinkel -= 0.04 * Math.sign(Math.sin(b.fahrWinkel - a.fahrWinkel) || 1);
        if ((a.istSpieler || b.istSpieler) && a.rempelSperre <= 0 && b.rempelSperre <= 0) {
          a.rempelSperre = 0.35; b.rempelSperre = 0.35;
          this.melde('rempler', a.istSpieler ? a.nr : b.nr);
        }
      }
    }
  }

  /** Position eines rollenden Stamms zur Rennzeit — Dreieckswelle quer zur Bahn. */
  stammPosition(planIdx: number, zeitMs: number): { x: number; y: number; quer: number } {
    const plan = this.setup.strecke.staemme[planIdx];
    const p = this.geo.linie[plan.idx];
    const u = ((zeitMs / plan.periodeMs + plan.phase) % 1 + 1) % 1;
    const dreieck = 4 * Math.abs(u - 0.5) - 1;
    const quer = dreieck * (this.setup.strecke.breite + 26);
    return { x: p.x - Math.sin(p.winkel) * quer, y: p.y + Math.cos(p.winkel) * quer, quer };
  }

  private staemme() {
    for (let si = 0; si < this.setup.strecke.staemme.length; si++) {
      const s = this.stammPosition(si, this.zeitMs);
      for (const f of this.fahrer) {
        if (f.flugRest > 0 || f.schonfrist > 0 || f.sternRest > 0) continue;
        const dx = s.x - f.x, dy = s.y - f.y;
        if (dx * dx + dy * dy < STAMM_RADIUS * STAMM_RADIUS) treffen(this, f, 'stamm');
      }
    }
  }

  private platzieren() {
    const sortiert = [...this.fahrer].sort((a, b) => {
      if (a.fertig && b.fertig) return (a.zielZeitMs ?? 0) - (b.zielZeitMs ?? 0);
      if (a.fertig) return -1;
      if (b.fertig) return 1;
      return b.fortschritt - a.fortschritt;
    });
    const s = this.spieler;
    const vorher = s.platz;
    sortiert.forEach((f, i) => { f.platz = i + 1; });
    this.reihenfolge = sortiert.map((f) => f.nr);
    if (this.phase === 'rennen' && this.fahrer.length > 1) {
      if (s.platz < vorher) this.melde('ueberholt', s.nr, s.platz);
      else if (s.platz > vorher) this.melde('zurueckgefallen', s.nr, s.platz);
    }
  }

  /** Endstand. Wer beim Rennende noch fährt, bekommt eine geschätzte Zeit
   *  aus seinem Tempo — die Reihenfolge bleibt die der Strecke. */
  ergebnis(): RennErgebnis {
    const n = this.geo.linie.length;
    const ziel = n * this.setup.strecke.runden;
    const zeiten = this.fahrer.map((f) => {
      if (f.zielZeitMs !== null) return f.zielZeitMs;
      if (this.zeitMs <= 0) return null;
      const idxProMs = Math.max(0.01, f.fortschritt / this.zeitMs);
      return Math.round(this.zeitMs + Math.max(0, ziel - f.fortschritt) / idxProMs);
    });
    const reihenfolge = [...this.fahrer]
      .sort((a, b) => {
        const za = zeiten[a.nr], zb = zeiten[b.nr];
        if (a.fertig !== b.fertig) return a.fertig ? -1 : 1;
        if (a.fertig && b.fertig) return (za ?? 0) - (zb ?? 0);
        return b.fortschritt - a.fortschritt;
      })
      .map((f) => f.nr);
    const s = this.spieler;
    return {
      reihenfolge,
      zeiten,
      spielerPlatz: reihenfolge.indexOf(s.nr) + 1,
      spielerZeitMs: s.zielZeitMs,
      rundenZeiten: [...this.rundenZeiten],
      geist: this.setup.modus === 'zeitfahren' ? { dt: GEIST_DT_MS, pts: this.geistPts } : undefined,
    };
  }

  /** Reihenfolge nach aktuellem Stand (für Anzeige). */
  get stand(): number[] { return this.reihenfolge; }

  /** Ist der Spieler gerade in der Luft, im Drift …? — für die Anzeige. */
  get eingabeSpieler(): Eingabe { return this.eingaben[this.spieler.nr] ?? LEERE_EINGABE; }
}
