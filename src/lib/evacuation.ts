// Cross-tab sync of the evacuation flag.
// Each tab listens; the planner tab broadcasts; the dashboard tab reacts.

const CHANNEL = 'saunafreunde-evac';

type EvacMessage =
  | { type: 'start'; triggeredBy: string; triggeredAt: number }
  | { type: 'stop' };

let bc: BroadcastChannel | null = null;
function channel(): BroadcastChannel {
  if (!bc) bc = new BroadcastChannel(CHANNEL);
  return bc;
}

export function broadcastEvac(msg: EvacMessage) {
  try { channel().postMessage(msg); } catch { /* noop */ }
}

export function subscribeEvac(cb: (msg: EvacMessage) => void): () => void {
  const handler = (e: MessageEvent<EvacMessage>) => cb(e.data);
  channel().addEventListener('message', handler);
  return () => channel().removeEventListener('message', handler);
}

// ─── Siren via Web Audio (no audio file needed) ────────────────────────────
let ctx: AudioContext | null = null;
let osc: OscillatorNode | null = null;
let gain: GainNode | null = null;
let toggleTimer: number | null = null;
const zustandsHoerer = new Set<() => void>();

function audioKlasse(): typeof AudioContext | undefined {
  return window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

/**
 * AudioContext anlegen bzw. fortsetzen. Ohne Bedienung (Tipp, Taste) lässt der
 * Browser ihn meist „suspended" — dann einfach bei der nächsten Bedienung noch
 * einmal aufrufen. Mit Autoplay-Freigabe (Kiosk-Browser) läuft er sofort.
 */
export function unlockAudio(): boolean {
  try {
    const Ctx = audioKlasse();
    if (!Ctx) return false;
    if (!ctx) {
      ctx = new Ctx();
      ctx.addEventListener('statechange', () => { for (const h of zustandsHoerer) h(); });
    }
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
    return true;
  } catch { return false; }
}

/**
 * Kann die Sirene gerade tönen? 'gesperrt' = der Browser wartet noch auf eine
 * Bedienung (nach jedem Neuladen der Tafel so, Audit-Runde 2, 25.09.2026).
 * 'unmoeglich' = kein Web Audio (sehr alter TV-Browser) — dann hilft auch kein Tastendruck.
 */
export function audioZustand(): 'laeuft' | 'gesperrt' | 'unmoeglich' {
  if (!audioKlasse()) return 'unmoeglich';
  return ctx?.state === 'running' ? 'laeuft' : 'gesperrt';
}

/** Meldet jeden Zustandswechsel des AudioContext (Ereignis, kein Timer). */
export function beiAudioZustand(cb: () => void): () => void {
  zustandsHoerer.add(cb);
  return () => { zustandsHoerer.delete(cb); };
}

/** Startet die Sirene. Ist der Ton noch gesperrt, läuft sie stumm an und wird
 *  hörbar, sobald eine Bedienung den AudioContext fortsetzt (unlockAudio). */
export function startSiren() {
  unlockAudio();
  if (!ctx) return;
  if (osc) return;
  osc = ctx.createOscillator();
  gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 600;
  gain.gain.value = 0.18;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  let high = false;
  toggleTimer = window.setInterval(() => {
    if (!osc) return;
    high = !high;
    osc.frequency.setTargetAtTime(high ? 950 : 600, ctx!.currentTime, 0.01);
  }, 500);
}

export function stopSiren() {
  if (toggleTimer) { clearInterval(toggleTimer); toggleTimer = null; }
  if (osc) { try { osc.stop(); } catch { /* noop */ } osc.disconnect(); osc = null; }
  if (gain) { gain.disconnect(); gain = null; }
}
