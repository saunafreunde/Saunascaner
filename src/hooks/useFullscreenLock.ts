import { useEffect, useState } from 'react';

// Erzwingt Browser-Vollbild für Tablet-/Kiosk-Routen (Scanner, Öl-Raum).
//
// Browser-Realität: requestFullscreen() braucht eine User-Gesture und wird
// beim reinen Mount blockiert. Wir kombinieren drei Strategien:
//
// 1. Mount-Try: opportunistisch, klappt manchmal wenn die vorherige Navigation
//    noch als gültige Gesture im Buffer ist.
// 2. Capture-Phase Click/Touch-Listener: bei JEDER User-Geste wird nochmal
//    versucht. Spätestens beim ersten Tap ist Vollbild aktiv.
// 3. Manueller Fallback: der Aufrufer kann `enterFullscreen()` an einen
//    Button binden, falls die ersten zwei nicht greifen.
//
// Beim Unmount der Route: exitFullscreen() — verhindert dass andere Routen
// ungewollt im Vollbild bleiben.
export function useFullscreenLock(): { isFullscreen: boolean; enterFullscreen: () => void } {
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== 'undefined' && !!document.fullscreenElement
  );

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const tryEnter = () => {
      if (document.fullscreenElement) return;
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => { /* User blocked, button bleibt sichtbar */ });
      }
    };
    tryEnter();
    document.addEventListener('click', tryEnter, { capture: true });
    document.addEventListener('touchend', tryEnter, { capture: true });
    return () => {
      document.removeEventListener('click', tryEnter, { capture: true });
      document.removeEventListener('touchend', tryEnter, { capture: true });
    };
  }, []);

  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { /* ignore */ });
      }
    };
  }, []);

  const enterFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => { /* ignore */ });
    }
  };

  return { isFullscreen, enterFullscreen };
}
