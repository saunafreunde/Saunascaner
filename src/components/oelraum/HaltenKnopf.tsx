import { useEffect, useRef, useState } from 'react';

/** Die einzige Geste, mit der man vom Anzeige-Modus in die Eingabe kommt.
 *
 *  Warum Halten statt Tippen: das Tablet hängt im Öl-Raum auf Ellbogenhöhe und
 *  wird im Vorbeigehen gestreift. Ein Fehlgriff wäre nicht schlimm (die Eingabe
 *  schreibt nichts, bis jemand absendet), aber die Anzeige wäre weg — und genau
 *  die soll dort stehen.
 *
 *  Warum kein PIN: der Öl-Raum lief einmal mit PIN 1234, die mit einem echten
 *  Mitglieds-PIN kollidierte. Der Zugang ist die Vereinstür, nicht dieses Feld.
 *
 *  1,2 s statt der früheren 3 s: die 3 s stammten aus der Zeit, als hier ein
 *  Sperrbildschirm den ganzen Tablet-Zugang bewachte. Jetzt bewacht die Geste
 *  nur noch den Wechsel weg von der Anzeige — da wären 3 s reine Schikane,
 *  gerade auf dem Knopf, der zum Eintragen auffordert.
 */
export const HALTEN_MS = 1200;

export function HaltenKnopf({
  children, onFertig, className = '', style, ringFarbe = 'rgba(226,232,240,0.35)', titel,
}: {
  children: React.ReactNode;
  onFertig: () => void;
  className?: string;
  style?: React.CSSProperties;
  /** Füllfarbe des Fortschritts. */
  ringFarbe?: string;
  titel?: string;
}) {
  const [fortschritt, setFortschritt] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | undefined>();
  const startRef = useRef(0);
  const fertigRef = useRef(false);

  useEffect(() => () => clearInterval(tickRef.current), []);

  function start() {
    if (fertigRef.current) return;
    startRef.current = performance.now();
    setFortschritt(0);
    clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      const t = performance.now() - startRef.current;
      const pct = Math.min(100, (t / HALTEN_MS) * 100);
      setFortschritt(pct);
      if (t >= HALTEN_MS && !fertigRef.current) {
        fertigRef.current = true;
        clearInterval(tickRef.current);
        onFertig();
      }
    }, 50);
  }

  function abbrechen() {
    clearInterval(tickRef.current);
    if (!fertigRef.current) setFortschritt(0);
  }

  return (
    <button
      type="button"
      title={titel}
      onPointerDown={start}
      onPointerUp={abbrechen}
      onPointerLeave={abbrechen}
      onPointerCancel={abbrechen}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative overflow-hidden select-none touch-none ${className}`}
      style={{ WebkitTapHighlightColor: 'transparent', ...style }}
    >
      {/* Fortschritt läuft von links durch — kein eigener Animations-Loop,
          die Breite folgt dem State und wird vom Compositor interpoliert. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 transition-[width] duration-75 pointer-events-none"
        style={{ width: `${fortschritt}%`, background: ringFarbe }}
      />
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}
