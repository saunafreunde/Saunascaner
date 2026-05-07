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

export function unlockAudio(): boolean {
  // Must be called from a user gesture once per tab.
  try {
    const Ctx = (window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return false;
    if (!ctx) ctx = new Ctx();
    if (ctx.state === 'suspended') void ctx.resume();
    return true;
  } catch { return false; }
}

export function startSiren() {
  if (!ctx) unlockAudio();
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
