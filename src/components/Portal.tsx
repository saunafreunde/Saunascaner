import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Rendert Children direkt unter <body> via React-Portal.
 *
 * Warum: Modals/Picker mit `position: fixed` werden normalerweise relativ
 * zum Viewport positioniert — ABER wenn ein Vorfahre im DOM-Tree
 * `transform`, `filter`, `backdrop-filter`, `perspective` oder
 * `will-change: transform` hat, wird der Vorfahre zum "Containing Block"
 * und das Picker wird relativ zu DIESEM positioniert. Folge: das Picker
 * landet INNERHALB des Parents, Klicks landen am falschen Element, oder
 * das Picker wird vom Parent-Overflow abgeschnitten.
 *
 * `EditInfusionModal` hat z.B. `backdrop-blur-sm` (= `backdrop-filter`).
 * Ein darin gerenderter `OilPicker` wäre eingesperrt.
 *
 * Portal löst das durch DOM-Mount auf Body-Ebene — KEIN React-Tree-Vorfahre
 * mehr, nur noch der echte Viewport.
 *
 * SSR-safe: Erst nach Mount im Client wird das Portal aktiv (kein
 * `document` auf Server). Für Vite/CSR ist das nur ein extra Render-Pass.
 */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
