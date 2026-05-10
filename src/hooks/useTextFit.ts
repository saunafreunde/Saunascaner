import { useLayoutEffect, useRef, useState } from 'react';

interface Options {
  maxFontPx?: number;
  minFontPx?: number;
}

// ResizeObserver-basiertes Shrink-to-Fit. Misst Text + Container und sucht
// per Bisektion die größte Schriftgröße, bei der scrollWidth/scrollHeight
// noch in den Container passt. Niemals truncate, niemals Überlauf — solange
// der Text bei minFontPx in den Container passt.
export function useTextFit<
  C extends HTMLElement = HTMLDivElement,
  T extends HTMLElement = HTMLElement,
>(text: string, opts: Options = {}) {
  const { maxFontPx = 48, minFontPx = 10 } = opts;
  const containerRef = useRef<C | null>(null);
  const textRef = useRef<T | null>(null);
  const [fontPx, setFontPx] = useState(maxFontPx);

  useLayoutEffect(() => {
    const c = containerRef.current;
    const t = textRef.current;
    if (!c || !t) return;

    const fit = () => {
      let lo = minFontPx;
      let hi = maxFontPx;
      let best = minFontPx;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        t.style.fontSize = `${mid}px`;
        const fits = t.scrollWidth <= c.clientWidth && t.scrollHeight <= c.clientHeight;
        if (fits) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
      }
      t.style.fontSize = `${best}px`;
      setFontPx(best);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, [text, maxFontPx, minFontPx]);

  return { containerRef, textRef, fontPx };
}
