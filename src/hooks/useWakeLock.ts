import { useEffect } from 'react';

type WakeLockSentinel = { release: () => Promise<void>; addEventListener: (e: string, cb: () => void) => void };

export function useWakeLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> } };
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        sentinel = await nav.wakeLock!.request('screen');
        sentinel.addEventListener('release', () => { sentinel = null; });
      } catch { /* user denied or unsupported */ }
    };

    acquire();
    const onVisible = () => { if (document.visibilityState === 'visible' && !sentinel && !cancelled) acquire(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}
