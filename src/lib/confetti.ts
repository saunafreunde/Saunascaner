// Lazy-loaded confetti — only fetched when actually triggered.
type ConfettiFn = (opts?: Record<string, unknown>) => void;
let confettiPromise: Promise<ConfettiFn> | null = null;

function loadConfetti(): Promise<ConfettiFn> {
  if (!confettiPromise) {
    confettiPromise = import('canvas-confetti').then((mod) => (mod.default ?? mod) as unknown as ConfettiFn);
  }
  return confettiPromise;
}

/** Big celebratory burst — used for badge unlocks. */
export async function fireBadgeUnlock() {
  const confetti = await loadConfetti();
  const duration = 1800;
  const end = Date.now() + duration;
  const colors = ['#22c55e', '#f59e0b', '#a78bfa', '#facc15', '#86efac'];

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.65 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.65 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/**
 * Once-per-day burst when user creates their first own infusion of the day.
 * Uses localStorage to ensure idempotency.
 */
export async function fireFirstInfusionOfDay(memberId: string) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `firstInfusion_${memberId}_${today}`;
  if (localStorage.getItem(key)) return false;
  localStorage.setItem(key, '1');

  const confetti = await loadConfetti();
  // Warm sauna-themed burst from bottom-center
  confetti({
    particleCount: 80,
    spread: 90,
    startVelocity: 45,
    origin: { x: 0.5, y: 1 },
    colors: ['#f97316', '#f59e0b', '#facc15', '#fcd34d', '#fed7aa'],
    scalar: 1.1,
  });
  return true;
}
