import { Suspense, useEffect, useState } from 'react';
import { EFFECT_REGISTRY } from './index';

type LastEffect = { kind: string; triggered_at: string; nonce: string };

// Spielt den zuletzt ausgelösten Effekt einmal ab. Wird per `key={nonce}` neu
// gemounted bei jedem RPC-Trigger.
//
// Hört nach `durationMs` der Effect-Definition auf zu rendern (self-unmount via
// State-Toggle). Wenn der Stage-Reload alte triggered_at-Werte sieht (> 30s
// her), ignoriert die Komponente sie sofort — verhindert „Effekt-Nachholen"
// nach Tafel-Reload.

const STALE_THRESHOLD_MS = 30_000;

export function EffectPlayer({ effect }: { effect: LastEffect }) {
  const entry = EFFECT_REGISTRY[effect.kind];

  // Stale-Check direkt beim Mount — kein useState/effect nötig wenn schon zu alt
  const triggeredAtMs = new Date(effect.triggered_at).getTime();
  const ageMs = Date.now() - triggeredAtMs;
  const isStale = ageMs > STALE_THRESHOLD_MS;

  const [done, setDone] = useState(isStale);

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
      style={{ zIndex: 50 }}
      aria-hidden="true"
    >
      <Suspense fallback={null}>
        <Component />
      </Suspense>
    </div>
  );
}
