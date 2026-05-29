import { useEffect, useState } from 'react';

/**
 * Liefert `new Date()` alle `intervalMs`. Triggert ZUSÄTZLICH einen
 * Sofort-Update bei `visibilitychange` und `focus`, weil Chrome `setInterval`
 * auf hidden Tabs auf 1×/Minute drosselt — sonst würde die TV-Tafel nach
 * Browser-Standby/Screensaver mit veraltetem `now` rendern und Aufguss-Cards
 * stehen lassen, bis der Interval wieder tickt (Bug 29.05.2026).
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, intervalMs);
    // Tab kommt zurück aus Background/Screensaver → sofort frische Zeit
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs]);
  return now;
}
