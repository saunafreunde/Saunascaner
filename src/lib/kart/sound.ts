// Sauna-Kart: Klang aus dem Nichts (Banden-Runde 16.08.2026).
//
// Komplett synthetisiert über Web Audio — kein Sample, kein Download. Ein
// stummes Rennspiel fühlt sich tot an; schon ein simpler Motorbrumm, dessen
// Tonhöhe am Tempo hängt, verdrahtet Auge und Ohr und macht Tempo FÜHLBAR.
//
// Regeln: der AudioContext entsteht erst nach einer User-Geste (iOS-Pflicht,
// und der erste Daumen liegt beim Rennen ohnehin sofort auf dem Bildschirm).
// Alles läuft über einen Master-Gain — der Mute-Knopf zieht ihn auf 0, die
// Oszillatoren laufen weiter (Start/Stop-Klicks vermeiden).

export class KartSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private motorA: OscillatorNode | null = null;
  private motorB: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  an = true;

  /** Nach der ersten Geste aufrufen — idempotent. */
  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    try {
      const A = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!A) return;
      const ctx = new A();
      const master = ctx.createGain();
      master.gain.value = this.an ? 0.5 : 0;
      master.connect(ctx.destination);

      // Motor: zwei leicht verstimmte Sägezähne durch einen Tiefpass — brummt
      // wie ein gutmütiger Ofen, nicht wie eine Kettensäge.
      const motorGain = ctx.createGain();
      motorGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      const a = ctx.createOscillator();
      a.type = 'sawtooth'; a.frequency.value = 62;
      const b = ctx.createOscillator();
      b.type = 'sawtooth'; b.frequency.value = 63.7;
      a.connect(filter); b.connect(filter);
      filter.connect(motorGain); motorGain.connect(master);
      a.start(); b.start();

      this.ctx = ctx; this.master = master;
      this.motorA = a; this.motorB = b; this.motorGain = motorGain; this.filter = filter;
    } catch { /* Audio ist Kür, nie Pflicht */ }
  }

  /** Jeden Frame: Tempo-Anteil 0…1 steuert Tonhöhe + Lautstärke.
   *
   *  Mit GANGSCHALTUNG (Dynamik-Runde): drei virtuelle Gänge — die Tonhöhe
   *  steigt innerhalb eines Gangs steil an und fällt beim Hochschalten kurz
   *  ab. Ein linear steigender Dauerton klingt nach Staubsauger; das
   *  Auf-und-Ab ist der Klang von „es geht vorwärts". */
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

  private blip(freq: number, dauer: number, lautstaerke = 0.25, typ: OscillatorType = 'square') {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = typ; o.frequency.value = freq;
    g.gain.setValueAtTime(lautstaerke, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dauer);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dauer);
  }

  private rauschen(dauer: number, filterFreq: number, lautstaerke = 0.4) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dauer);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = lautstaerke;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  countdown(n: number) { this.blip(n === 0 ? 1568 : 784, n === 0 ? 0.5 : 0.15, 0.22); }
  turbo() { this.blip(220, 0.35, 0.2, 'sawtooth'); this.blip(440, 0.35, 0.12, 'sawtooth'); }
  treffer() { this.rauschen(0.22, 260, 0.5); this.blip(70, 0.25, 0.3, 'triangle'); }
  bande() { this.rauschen(0.1, 500, 0.28); }
  sprung() { this.blip(392, 0.18, 0.16, 'triangle'); }
  landung() { this.rauschen(0.12, 340, 0.3); }
  ziel() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 0.2), i * 130)); }

  toggle(): boolean {
    this.an = !this.an;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this.an ? 0.5 : 0, this.ctx.currentTime, 0.05);
    }
    return this.an;
  }

  stop() {
    try {
      this.motorA?.stop(); this.motorB?.stop();
      void this.ctx?.close();
    } catch { /* egal */ }
    this.ctx = null;
  }
}
