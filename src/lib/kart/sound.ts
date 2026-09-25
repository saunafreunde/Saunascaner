// Sauna-Kart: Klang aus dem Nichts — komplett über Web Audio synthetisiert,
// kein Sample, kein Download (Grand-Prix-Fassung, 25.09.2026).
//
// Regeln: der AudioContext entsteht erst nach einer Geste (iOS-Pflicht).
// Alles läuft über zwei Busse — Effekte und Musik — mit eigenem Regler.
// Die Musik ist eine kleine Schwarzwald-Polka (Bass im Humpa-Takt, Melodie
// wie eine Quetschkommode, Schlagwerk), die in der letzten Runde anzieht.

type Note = number | null;

// Melodie in Achteln (MIDI-Nummern), 8 Takte à 8 Achtel.
const MELODIE: Note[] = [
  72, null, 76, 79, 76, 79, 84, null,       // C
  77, null, 81, 84, 81, 77, 81, 84,         // F
  79, null, 74, 79, 83, 81, 79, 77,         // G
  76, null, 72, null, 67, null, 72, null,   // C
  81, null, 76, 72, 76, 81, 84, null,       // Am
  77, 81, 84, 81, 89, 88, 86, 84,           // F
  83, null, 79, null, 86, null, 83, 79,     // G
  84, null, 79, 76, 72, null, null, null,   // C
];
const BASS: [number, number][] = [ // Grundton + Quinte je Takt
  [48, 55], [53, 60], [55, 62], [48, 55], [57, 64], [53, 60], [55, 62], [48, 55],
];

function hz(midi: number): number { return 440 * Math.pow(2, (midi - 69) / 12); }

export class KartSound {
  private ctx: AudioContext | null = null;
  private fxBus: GainNode | null = null;
  private musikBus: GainNode | null = null;
  private motorA: OscillatorNode | null = null;
  private motorB: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private zischen: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private rauschPuffer: AudioBuffer | null = null;
  private musikTimer: ReturnType<typeof setInterval> | null = null;
  private naechsteNote = 0;
  private schritt = 0;
  private tempo = 1;
  private sternBis = 0;
  tonAn = true;
  musikAn = true;

  /** Nach der ersten Geste aufrufen — idempotent. */
  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    try {
      const A = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!A) return;
      const ctx = new A();
      const master = ctx.createDynamicsCompressor();
      master.connect(ctx.destination);
      const fx = ctx.createGain(); fx.gain.value = this.tonAn ? 0.55 : 0; fx.connect(master);
      const mu = ctx.createGain(); mu.gain.value = this.musikAn ? 0.16 : 0; mu.connect(master);

      const motorGain = ctx.createGain(); motorGain.gain.value = 0;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 320;
      const a = ctx.createOscillator(); a.type = 'sawtooth'; a.frequency.value = 62;
      const b = ctx.createOscillator(); b.type = 'sawtooth'; b.frequency.value = 63.7;
      a.connect(filter); b.connect(filter); filter.connect(motorGain); motorGain.connect(fx);
      a.start(); b.start();

      // Rauschen einmal erzeugen, für Drift-Zischen und Knalle wiederverwenden.
      const n = ctx.sampleRate;
      const puf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = puf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

      const zSrc = ctx.createBufferSource(); zSrc.buffer = puf; zSrc.loop = true;
      const zF = ctx.createBiquadFilter(); zF.type = 'bandpass'; zF.frequency.value = 3000; zF.Q.value = 1.4;
      const zG = ctx.createGain(); zG.gain.value = 0;
      zSrc.connect(zF); zF.connect(zG); zG.connect(fx); zSrc.start();

      this.ctx = ctx; this.fxBus = fx; this.musikBus = mu;
      this.motorA = a; this.motorB = b; this.motorGain = motorGain; this.filter = filter;
      this.rauschPuffer = puf;
      this.zischen = { src: zSrc, gain: zG, filter: zF };
    } catch { /* Ton ist Kür, nie Pflicht */ }
  }

  get bereit(): boolean { return !!this.ctx; }

  /** Tempo-Anteil 0…1 steuert Tonhöhe und Lautstärke — mit drei Gängen. */
  motor(anteil: number, turbo: boolean) {
    if (!this.ctx || !this.motorA || !this.motorB || !this.motorGain || !this.filter) return;
    const gang = Math.min(2, Math.floor(anteil * 3));
    const imGang = Math.min(1, anteil * 3 - gang);
    const f = 56 + gang * 16 + imGang * 74 + (turbo ? 34 : 0);
    const t = this.ctx.currentTime;
    this.motorA.frequency.setTargetAtTime(f, t, 0.07);
    this.motorB.frequency.setTargetAtTime(f * 1.013, t, 0.07);
    this.filter.frequency.setTargetAtTime(240 + anteil * 560 + (turbo ? 180 : 0), t, 0.1);
    this.motorGain.gain.setTargetAtTime(0.05 + anteil * 0.06, t, 0.1);
  }

  motorAus() {
    if (this.ctx && this.motorGain) this.motorGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
  }

  /** Drift-Zischen: lauter und heller je Funkenstufe (0 = aus). */
  drift(aktiv: boolean, stufe: number) {
    if (!this.ctx || !this.zischen) return;
    const t = this.ctx.currentTime;
    this.zischen.gain.gain.setTargetAtTime(aktiv ? 0.05 + stufe * 0.035 : 0, t, 0.05);
    this.zischen.filter.frequency.setTargetAtTime(2200 + stufe * 1400, t, 0.05);
  }

  private ton(freq: number, dauer: number, laut = 0.25, typ: OscillatorType = 'square', bus: 'fx' | 'musik' = 'fx', wann?: number, gleiten?: number) {
    const ctx = this.ctx;
    const ziel = bus === 'fx' ? this.fxBus : this.musikBus;
    if (!ctx || !ziel) return;
    const t = wann ?? ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = typ;
    o.frequency.setValueAtTime(freq, t);
    if (gleiten) o.frequency.exponentialRampToValueAtTime(gleiten, t + dauer);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(laut, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    o.connect(g); g.connect(ziel);
    o.start(t); o.stop(t + dauer + 0.02);
  }

  private knall(dauer: number, filterFreq: number, laut = 0.4, bus: 'fx' | 'musik' = 'fx', wann?: number, typ: BiquadFilterType = 'lowpass') {
    const ctx = this.ctx;
    const ziel = bus === 'fx' ? this.fxBus : this.musikBus;
    if (!ctx || !ziel || !this.rauschPuffer) return;
    const t = wann ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.rauschPuffer;
    const f = ctx.createBiquadFilter(); f.type = typ; f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(laut, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    src.connect(f); f.connect(g); g.connect(ziel);
    src.start(t, Math.random() * 0.5); src.stop(t + dauer + 0.02);
  }

  // ── Effekte ────────────────────────────────────────────────────────────
  countdown(n: number) { this.ton(n === 0 ? 1568 : 784, n === 0 ? 0.55 : 0.16, 0.22); }
  turbo() { this.ton(220, 0.35, 0.18, 'sawtooth', 'fx', undefined, 660); this.knall(0.3, 1800, 0.12, 'fx', undefined, 'highpass'); }
  miniturbo(stufe: number) { this.ton(300 + stufe * 120, 0.28, 0.16, 'sawtooth', 'fx', undefined, 900 + stufe * 200); }
  minze() { this.ton(392, 0.12, 0.16, 'square'); this.ton(784, 0.3, 0.14, 'triangle', 'fx', (this.ctx?.currentTime ?? 0) + 0.06, 1200); }
  treffer() { this.knall(0.25, 380, 0.5); this.ton(520, 0.6, 0.14, 'triangle', 'fx', undefined, 140); }
  stamm() { this.knall(0.2, 260, 0.55); this.ton(70, 0.25, 0.3, 'triangle'); }
  bande() { this.knall(0.1, 600, 0.22); }
  rempler() { this.knall(0.08, 900, 0.2); this.ton(160, 0.08, 0.12, 'square'); }
  hop() { this.ton(330, 0.08, 0.1, 'triangle', 'fx', undefined, 520); }
  sprung() { this.ton(392, 0.2, 0.15, 'triangle', 'fx', undefined, 700); }
  trick() { const t = this.ctx?.currentTime ?? 0; [659, 880, 1175].forEach((f, i) => this.ton(f, 0.12, 0.13, 'square', 'fx', t + i * 0.05)); }
  landung() { this.knall(0.12, 340, 0.3); }
  tropfen(anzahl: number) { const t = this.ctx?.currentTime ?? 0; this.ton(1318 + anzahl * 20, 0.08, 0.12, 'square', 'fx', t); this.ton(1760 + anzahl * 20, 0.14, 0.1, 'square', 'fx', t + 0.05); }
  kiste() { this.knall(0.08, 2500, 0.15, 'fx', undefined, 'highpass'); this.ton(880, 0.1, 0.1, 'triangle'); }
  roulette() { this.ton(1200 + Math.random() * 400, 0.03, 0.06, 'square'); }
  itemDa() { const t = this.ctx?.currentTime ?? 0; this.ton(988, 0.1, 0.14, 'square', 'fx', t); this.ton(1319, 0.18, 0.14, 'square', 'fx', t + 0.08); }
  wurf() { this.ton(600, 0.18, 0.12, 'triangle', 'fx', undefined, 250); this.knall(0.12, 1500, 0.1, 'fx', undefined, 'highpass'); }
  seife() { this.ton(700, 0.2, 0.1, 'sine', 'fx', undefined, 300); }
  dampf() { this.knall(1.1, 900, 0.3, 'fx', undefined, 'bandpass'); }
  aufguss() { this.knall(1.6, 700, 0.45, 'fx', undefined, 'bandpass'); this.ton(196, 0.9, 0.15, 'sawtooth', 'fx', undefined, 98); }
  glut() { this.knall(0.18, 4000, 0.12, 'fx', undefined, 'highpass'); }
  ueberholt() { this.ton(660, 0.07, 0.07, 'triangle'); }
  fehlstart() { this.knall(0.5, 300, 0.4); this.ton(110, 0.5, 0.2, 'sawtooth', 'fx', undefined, 55); }
  stern(an: boolean) { this.sternBis = an ? (this.ctx?.currentTime ?? 0) + 7 : 0; }
  letzteRunde() {
    const t = this.ctx?.currentTime ?? 0;
    [784, 988, 1175, 1568].forEach((f, i) => this.ton(f, 0.16, 0.16, 'square', 'fx', t + i * 0.11));
    this.tempo = 1.14;
  }
  ziel(platz: number) {
    const t = this.ctx?.currentTime ?? 0;
    const folge = platz <= 3 ? [523, 659, 784, 1047, 784, 1047] : [523, 494, 440, 392];
    folge.forEach((f, i) => this.ton(f, 0.24, 0.18, 'square', 'fx', t + i * 0.14));
  }

  // ── Musik: Schritt-Sequenzer mit Vorausplanung ─────────────────────────
  musikStart() {
    if (!this.ctx || this.musikTimer) return;
    this.naechsteNote = this.ctx.currentTime + 0.1;
    this.schritt = 0;
    this.tempo = 1;
    this.musikTimer = setInterval(() => this.planen(), 40);
  }

  musikStopp() {
    if (this.musikTimer) clearInterval(this.musikTimer);
    this.musikTimer = null;
  }

  private planen() {
    const ctx = this.ctx;
    if (!ctx) return;
    const achtel = 60 / (142 * this.tempo) / 2;
    while (this.naechsteNote < ctx.currentTime + 0.15) {
      const t = this.naechsteNote;
      const i = this.schritt % MELODIE.length;
      const takt = Math.floor(i / 8);
      const imTakt = i % 8;
      const stern = t < this.sternBis;
      // Bass: Humpa — Grundton auf 1 und 3, Quinte auf 2 und 4
      if (imTakt % 2 === 0) {
        const [grund, quinte] = BASS[takt];
        this.ton(hz(imTakt % 4 === 0 ? grund - 12 : quinte - 12), achtel * 0.9, 0.5, 'triangle', 'musik', t);
      } else {
        // Nachschlag: kurzer Akkord (Quetschkommode)
        const [grund] = BASS[takt];
        for (const iv of [0, 4, 7]) this.ton(hz(grund + 12 + iv + (takt === 4 ? -1 + (iv === 4 ? 0 : 1) : 0)), achtel * 0.5, 0.07, 'square', 'musik', t);
      }
      const note = MELODIE[i];
      if (note !== null) this.ton(hz(note + (stern ? 12 : 0)), achtel * 0.95, stern ? 0.2 : 0.16, stern ? 'square' : 'sawtooth', 'musik', t);
      if (stern && imTakt % 2 === 1) this.ton(hz((note ?? 72) + 19), achtel * 0.5, 0.1, 'square', 'musik', t);
      // Schlagwerk
      if (imTakt % 4 === 0) this.ton(120, 0.12, 0.5, 'sine', 'musik', t, 45);
      if (imTakt % 2 === 1) this.knall(0.04, 7000, 0.18, 'musik', t, 'highpass');
      this.naechsteNote += achtel;
      this.schritt += 1;
    }
  }

  setzeTon(an: boolean) {
    this.tonAn = an;
    if (this.ctx && this.fxBus) this.fxBus.gain.setTargetAtTime(an ? 0.55 : 0, this.ctx.currentTime, 0.05);
  }

  setzeMusik(an: boolean) {
    this.musikAn = an;
    if (this.ctx && this.musikBus) this.musikBus.gain.setTargetAtTime(an ? 0.16 : 0, this.ctx.currentTime, 0.05);
  }

  pause(an: boolean) {
    if (!this.ctx) return;
    if (an) { this.musikStopp(); this.motorAus(); this.drift(false, 0); void this.ctx.suspend(); }
    else { void this.ctx.resume(); }
  }

  stop() {
    this.musikStopp();
    try {
      this.motorA?.stop(); this.motorB?.stop(); this.zischen?.src.stop();
      void this.ctx?.close();
    } catch { /* egal */ }
    this.ctx = null;
  }
}
