import { Suspense, useEffect, useRef, useState } from 'react';
import { EFFECT_REGISTRY } from './index';

type LastEffect = { kind: string; triggered_at: string; nonce: string };

// Spielt den zuletzt ausgelösten Effekt einmal ab. Wird per `key={nonce}` neu
// gemounted bei jedem RPC-Trigger.
//
// FIX 0107 (Audit Phase 9.E): Stale-Filter war Clock-basiert (Date.now() vs
// triggered_at). Bei Client-Clock-Drift (NTP-Probleme auf RPi/Android-TV nach
// 72h) wurden Effekte entweder NIE angezeigt (Clock zu schnell) oder DOPPELT
// (Clock zu langsam, beim Polling-Refetch gleiches nonce wieder reingerendert).
// Neu: zusätzlich Seen-Nonce-Memory (modul-scope Set) — selbst wenn die
// Tafel-Uhr driftet, wird jeder nonce nur einmal pro Session abgespielt.
//
// STALE_THRESHOLD_MS bleibt als grobe Wand (>10min = ignorieren), damit nach
// langem Offline-Reload kein 8h-alter Konfetti nachschießt.

const STALE_THRESHOLD_MS = 10 * 60_000;
const seenNonces = new Set<string>();

export function EffectPlayer({ effect }: { effect: LastEffect }) {
  const entry = EFFECT_REGISTRY[effect.kind];

  const triggeredAtMs = new Date(effect.triggered_at).getTime();
  const ageMs = Date.now() - triggeredAtMs;
  const isAncient = ageMs > STALE_THRESHOLD_MS;
  const alreadySeen = seenNonces.has(effect.nonce);

  // Initial-Done wenn entweder schon abgespielt oder uralt
  const [done, setDone] = useState(isAncient || alreadySeen);
  const noncedRef = useRef(effect.nonce);

  useEffect(() => {
    if (isAncient || alreadySeen || !entry) return;
    seenNonces.add(noncedRef.current);
    // Cap remaining-time bei durationMs damit negative ageMs (Clock-Drift)
    // nicht zu unendlichen Timern werden.
    const remaining = Math.max(0, Math.min(entry.durationMs, entry.durationMs - Math.max(0, ageMs)));
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
