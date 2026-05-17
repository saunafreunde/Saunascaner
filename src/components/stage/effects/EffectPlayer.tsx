import { Suspense, useEffect, useState } from 'react';
import { EFFECT_REGISTRY } from './index';

type LastEffect = { kind: string; triggered_at: string; nonce: string };

// Spielt den zuletzt ausgelösten Effekt einmal ab. Wird per `key={nonce}` neu
// gemounted bei jedem RPC-Trigger.
//
// Stale-Filter: ignoriert Effekte deren triggered_at älter als
// STALE_THRESHOLD_MS ist. Verhindert „Effekt-Nachholen" nach Tafel-Reload
// oder Tab-Wechsel. Eng gehalten, weil Realtime-Latency typischerweise < 2s.

const STALE_THRESHOLD_MS = 5_000;

export function EffectPlayer({ effect }: { effect: LastEffect }) {
  const entry = EFFECT_REGISTRY[effect.kind];

  const triggeredAtMs = new Date(effect.triggered_at).getTime();
  const ageMs = Date.now() - triggeredAtMs;
  const isStale = ageMs > STALE_THRESHOLD_MS;

  const [done, setDone] = useState(isStale);

  // Diagnose-Log (TODO: nach Fix-Bestätigung entfernen)
  // eslint-disable-next-line no-console
  console.log('[EffectPlayer] mount', { kind: effect.kind, ageMs, isStale, hasEntry: !!entry });

  useEffect(() => {
    if (isStale || !entry) return;
    const remaining = Math.max(0, entry.durationMs - ageMs);
    const t = setTimeout(() => setDone(true), remaining);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!entry || done) return null;
  const Component = entry.component;

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 100 }}
      aria-hidden="true"
    >
      <Suspense fallback={null}>
        <Component />
      </Suspense>
    </div>
  );
}
