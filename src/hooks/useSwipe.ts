// Touch-Swipe-Detection für Spiele (Tetris, Snake, 2048).
//
// Verwendung:
//   const swipeProps = useSwipe({
//     onSwipeLeft:  () => moveLeft(),
//     onSwipeRight: () => moveRight(),
//     onSwipeUp:    () => rotate(),
//     onSwipeDown:  () => hardDrop(),
//     onTap:        () => rotate(),  // optional, für Tap-zu-Rotate
//   });
//   return <div {...swipeProps}>…</div>
//
// Erkennung:
//   - Wisch >= MIN_DISTANCE (40px) in eine dominante Richtung (>= 1.5× andere Achse)
//   - Tap: < 10px Bewegung in < 250ms
//
// onTouchMove ruft preventDefault → kein Browser-Scroll während Wisch
// (wichtig fürs Spielfeld auf Mobile). Caller muss touch-action: none setzen.

import { useRef, useCallback, type TouchEventHandler } from 'react';

type Dir = 'left' | 'right' | 'up' | 'down';

export interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
}

interface Options {
  /** Mindest-Distanz in px für eine gültige Wisch-Geste. Default 40. */
  minDistance?: number;
  /** Wenn `true`, wird preventDefault auf touchMove gerufen (kein Browser-Scroll). Default true. */
  preventScroll?: boolean;
}

interface SwipeProps {
  onTouchStart: TouchEventHandler;
  onTouchMove: TouchEventHandler;
  onTouchEnd: TouchEventHandler;
  style: React.CSSProperties;
}

export function useSwipe(handlers: SwipeHandlers, opts: Options = {}): SwipeProps {
  const minDistance = opts.minDistance ?? 40;
  const preventScroll = opts.preventScroll ?? true;

  const start = useRef<{ x: number; y: number; t: number } | null>(null);

  const onTouchStart: TouchEventHandler = useCallback((e) => {
    const t = e.touches[0];
    if (!t) return;
    start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, []);

  const onTouchMove: TouchEventHandler = useCallback((e) => {
    // Verhindert Browser-Scroll während aktiver Wisch-Geste auf Spielfeld
    if (preventScroll && start.current) {
      // passive:false ist via touch-action: none / Style sichergestellt;
      // preventDefault hier reicht auf den meisten Browsern als Backup
      if (e.cancelable) e.preventDefault();
    }
  }, [preventScroll]);

  const onTouchEnd: TouchEventHandler = useCallback((e) => {
    if (!start.current) return;
    const s = start.current;
    start.current = null;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const dt = Date.now() - s.t;

    // Tap-Erkennung: kurze Bewegung in kurzer Zeit
    if (adx < 10 && ady < 10 && dt < 250) {
      handlers.onTap?.();
      return;
    }

    // Keine echte Wisch-Geste
    if (adx < minDistance && ady < minDistance) return;

    let dir: Dir;
    if (adx > ady * 1.2) {
      dir = dx > 0 ? 'right' : 'left';
    } else if (ady > adx * 1.2) {
      dir = dy > 0 ? 'down' : 'up';
    } else {
      // Diagonale → nichts auslösen, vermeidet Fehl-Trigger
      return;
    }

    switch (dir) {
      case 'left':  handlers.onSwipeLeft?.(); break;
      case 'right': handlers.onSwipeRight?.(); break;
      case 'up':    handlers.onSwipeUp?.(); break;
      case 'down':  handlers.onSwipeDown?.(); break;
    }
  }, [handlers, minDistance]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    // touch-action: none verhindert dass der Browser eigene Geste-Interpretation
    // macht (z.B. Pull-to-Refresh, vertikales Scrollen).
    style: { touchAction: 'none', WebkitTouchCallout: 'none' as React.CSSProperties['WebkitTouchCallout'], userSelect: 'none' },
  };
}
