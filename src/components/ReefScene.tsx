// Animierte Unterwasser-Riff-Szene als Hintergrund für leere Tile-Slots.
//
// User-Wunsch (Mai 2026, Iteration 2):
//   - mehr Fische als ein Schwarm
//   - +1 Hai mit Pacman-Maul (frisst Fische beim Vorbeischwimmen)
//   - +1 Unterwasserschlange (schlängelt sich)
//   - alle Tiere schwimmen über die Tile-Grenze hinaus ("aus der Karte heraus")
//   - Schwimm-Richtung passt zur direction-Prop
//
// Architektur in 2 Layern:
//   1. <reef-bg>     overflow:hidden → Wasser, Sonnenstrahlen, Korallen,
//                    Algen, Sandboden, Bubbles, Hint-Text. Diese Elemente
//                    sollen INNERHALB der Tile bleiben (Wasser darf nicht
//                    aus der "Karte" laufen, sonst hässlich).
//   2. <reef-creatures>  overflow:visible → Fische, Hai, Schlange, Snacks.
//                    Diese Tiere DÜRFEN über die Tile-Grenze hinaus
//                    sichtbar bleiben (geclippt nur vom Spalten-Rand).
//
// Pacman-Hai-Logik: Hai schwimmt 1× durch (18s). Synchron dazu
// erscheinen "snack-Fische" entlang des Hai-Pfads, die kurz vor dem
// Hai-Maul aufpoppen und beim Bite-Frame mit shrink+fade verschwinden.
// Reine CSS-Choreographie über animation-delay.

type Direction = 'left' | 'right' | null;

type Props = {
  direction: Direction;
  hintText?: string;
};

// Hauptschwarm — 14 Fische in 3 Varianten, verschiedene Y-Positionen +
// Geschwindigkeiten für lebendigen Schwarm-Effekt.
const FISH = [
  { id: 0,  y: 14, scale: 0.95, dur: 14, delay: 0.0,  variant: 0 },
  { id: 1,  y: 22, scale: 0.70, dur: 11, delay: 2.0,  variant: 1 },
  { id: 2,  y: 30, scale: 1.05, dur: 16, delay: 0.5,  variant: 2 },
  { id: 3,  y: 38, scale: 0.65, dur: 9,  delay: 3.5,  variant: 1 },
  { id: 4,  y: 26, scale: 0.85, dur: 13, delay: 5.5,  variant: 0 },
  { id: 5,  y: 44, scale: 0.75, dur: 10, delay: 1.5,  variant: 1 },
  { id: 6,  y: 18, scale: 0.90, dur: 15, delay: 6.5,  variant: 2 },
  { id: 7,  y: 52, scale: 0.80, dur: 12, delay: 4.0,  variant: 0 },
  { id: 8,  y: 35, scale: 0.60, dur: 8,  delay: 7.0,  variant: 1 },
  { id: 9,  y: 48, scale: 1.00, dur: 14, delay: 2.8,  variant: 2 },
  { id: 10, y: 20, scale: 0.70, dur: 11, delay: 8.0,  variant: 1 },
  { id: 11, y: 28, scale: 0.85, dur: 13, delay: 0.8,  variant: 0 },
  { id: 12, y: 42, scale: 0.65, dur: 10, delay: 5.0,  variant: 1 },
  { id: 13, y: 54, scale: 0.95, dur: 15, delay: 3.0,  variant: 0 },
];

// Snack-Fische — die "vom Hai gefressen" werden. Timing ist auf die
// Hai-Animation (HAI_CYCLE = 18s) abgestimmt — sie erscheinen kurz
// vor dem Hai am gleichen Punkt und verschwinden beim Bite-Frame.
const SNACKS = [
  { id: 0, y: 32, snackAt: 4 },   // Hai erreicht Mitte bei ~4s
  { id: 1, y: 32, snackAt: 7 },
  { id: 2, y: 33, snackAt: 11 },
  { id: 3, y: 31, snackAt: 14 },
];

const HAI_CYCLE = 18;     // Hai braucht 18s für einen Durchgang
const SNAKE_CYCLE = 22;   // Schlange noch langsamer

const BUBBLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x: (i * 4.7) % 100,
  size: 4 + (i % 4) * 3,
  delay: (i * 0.42) % 6,
  dur: 5 + (i % 4) * 1.2,
  drift: -8 + (i % 5) * 4,
}));

const ALGAE = [
  { id: 0, x: 8,  h: 60, color: '#15803d', delay: 0.0 },
  { id: 1, x: 22, h: 75, color: '#16a34a', delay: 0.5 },
  { id: 2, x: 40, h: 50, color: '#15803d', delay: 1.2 },
  { id: 3, x: 60, h: 70, color: '#22c55e', delay: 0.8 },
  { id: 4, x: 78, h: 55, color: '#16a34a', delay: 1.5 },
  { id: 5, x: 92, h: 65, color: '#15803d', delay: 0.3 },
];

const CORALS = [
  { id: 0, x: 6,  c1: '#fb923c', c2: '#ea580c', s: 1.0 },
  { id: 1, x: 28, c1: '#ec4899', c2: '#be185d', s: 1.2 },
  { id: 2, x: 50, c1: '#a855f7', c2: '#7c3aed', s: 0.9 },
  { id: 3, x: 72, c1: '#fb923c', c2: '#dc2626', s: 1.1 },
  { id: 4, x: 92, c1: '#f472b6', c2: '#db2777', s: 0.8 },
];

export function ReefScene({ direction, hintText }: Props) {
  // Default-Direction für Hai + Schlange wenn beide Spalten leer:
  // Hai immer 'right', Schlange immer 'left' → kreuzendes Treiben
  const haiDir: 'left' | 'right' = direction === 'left' ? 'left' : 'right';
  const snakeDir: 'left' | 'right' = direction === 'right' ? 'right' : 'left';

  return (
    <>
      <style>{`
        /* ─── Wasser-Hintergrund ─────────────────────────────────────── */
        .reef-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg,
            #67e8f9 0%,
            #06b6d4 30%,
            #0e7490 65%,
            #155e75 100%);
          overflow: hidden;
          border-radius: inherit;
        }
        .reef-sunray {
          position: absolute;
          top: -10%;
          width: 14%;
          height: 80%;
          background: linear-gradient(180deg, rgba(255,255,240,0.35), transparent 70%);
          transform-origin: top center;
          filter: blur(2px);
          mix-blend-mode: screen;
          pointer-events: none;
        }
        .reef-sunray-1 { left: 22%; transform: rotate(-12deg); }
        .reef-sunray-2 { left: 52%; transform: rotate(4deg); }
        .reef-sunray-3 { left: 78%; transform: rotate(-6deg); }

        /* ─── Tier-Layer (overflow:visible, Fische ragen aus Tile raus) ─ */
        .reef-creatures {
          position: absolute;
          inset: 0;
          overflow: visible;
          pointer-events: none;
        }

        /* ─── Fisch-Schwimm-Animation — verlängerter Pfad damit Fisch
              aus der Tile rausragt ──────────────────────────────────── */
        @keyframes reef-fish-swim-r {
          0%   { transform: translate3d(-40%, 0, 0) scaleX(1); }
          50%  { transform: translate3d(50%, var(--bob, 4px), 0) scaleX(1); }
          100% { transform: translate3d(140%, 0, 0) scaleX(1); }
        }
        @keyframes reef-fish-swim-l {
          0%   { transform: translate3d(140%, 0, 0) scaleX(-1); }
          50%  { transform: translate3d(50%, var(--bob, 4px), 0) scaleX(-1); }
          100% { transform: translate3d(-40%, 0, 0) scaleX(-1); }
        }
        @keyframes reef-fish-tail {
          0%, 100% { transform: rotate(-12deg); }
          50%      { transform: rotate(12deg); }
        }
        .reef-fish {
          position: absolute;
          left: 0;
          width: 100%;
          will-change: transform;
          pointer-events: none;
        }
        .reef-fish.swim-r {
          animation: reef-fish-swim-r var(--du, 13s) linear infinite;
          animation-delay: var(--d, 0s);
        }
        .reef-fish.swim-l {
          animation: reef-fish-swim-l var(--du, 13s) linear infinite;
          animation-delay: var(--d, 0s);
        }
        .reef-fish-tail {
          transform-origin: 0% 50%;
          animation: reef-fish-tail 0.35s ease-in-out infinite;
        }

        /* ─── HAI ─────────────────────────────────────────────────────
           Großer grauer Hai schwimmt 1× pro Cycle quer durch — langsam.
           Pacman-Maul öffnet/schließt sich für "Fressen"-Effekt. */
        @keyframes reef-hai-swim-r {
          0%   { transform: translate3d(-45%, 0, 0) scaleX(1); }
          50%  { transform: translate3d(50%, var(--bob, 8px), 0) scaleX(1); }
          100% { transform: translate3d(145%, 0, 0) scaleX(1); }
        }
        @keyframes reef-hai-swim-l {
          0%   { transform: translate3d(145%, 0, 0) scaleX(-1); }
          50%  { transform: translate3d(50%, var(--bob, 8px), 0) scaleX(-1); }
          100% { transform: translate3d(-45%, 0, 0) scaleX(-1); }
        }
        .reef-hai {
          position: absolute;
          left: 0;
          width: 100%;
          top: 28%;
          will-change: transform;
        }
        .reef-hai.swim-r { animation: reef-hai-swim-r ${HAI_CYCLE}s linear infinite; }
        .reef-hai.swim-l { animation: reef-hai-swim-l ${HAI_CYCLE}s linear infinite; }

        /* Pacman-Maul öffnet/schließt sich periodisch.
           Wichtig: das öffnen via transform: rotate auf einem Pfad-Teil */
        @keyframes reef-hai-mouth {
          0%, 60%, 100% { transform: rotate(0deg); }   /* Maul zu */
          70%, 90%      { transform: rotate(-24deg); } /* Maul auf — Bite-Frame */
        }
        .reef-hai-jaw-upper {
          transform-origin: 20px 35px; /* Drehpunkt am Hai-Maul-Hinge */
          animation: reef-hai-mouth 2.5s ease-in-out infinite;
        }
        @keyframes reef-hai-tail {
          0%, 100% { transform: rotate(-18deg); }
          50%      { transform: rotate(18deg); }
        }
        .reef-hai-tail {
          transform-origin: 0% 50%;
          animation: reef-hai-tail 0.5s ease-in-out infinite;
        }

        /* ─── Snack-Fische (werden vom Hai gefressen) ────────────────
           Erscheinen kurz, werden vom Hai überrollt, dann shrink+fade. */
        @keyframes reef-snack-life {
          0%, 4%   { transform: scale(0); opacity: 0; }
          8%       { transform: scale(1); opacity: 1; }
          70%      { transform: scale(1); opacity: 1; }
          75%      { transform: scale(0.6) rotate(45deg); opacity: 0.6; }
          80%, 100% { transform: scale(0) rotate(180deg); opacity: 0; }
        }
        .reef-snack {
          position: absolute;
          left: 0; width: 100%;
          will-change: transform, opacity;
          animation: reef-snack-life 6s ease-in-out infinite;
          animation-delay: var(--d, 0s);
        }
        /* Container für Snack-Position innerhalb der Tile-Breite */
        .reef-snack-pos {
          position: absolute;
          display: inline-block;
          font-size: 22px;
          line-height: 1;
        }

        /* ─── Unterwasserschlange ─────────────────────────────────────
           Schlängelt sich quer durch — pseudo-Aal/Sea-Snake.
           Mehrere Segmente in CSS-Wellen-Bewegung. */
        @keyframes reef-snake-swim-r {
          0%   { transform: translate3d(-50%, 0, 0) scaleX(1); }
          100% { transform: translate3d(150%, 0, 0) scaleX(1); }
        }
        @keyframes reef-snake-swim-l {
          0%   { transform: translate3d(150%, 0, 0) scaleX(-1); }
          100% { transform: translate3d(-50%, 0, 0) scaleX(-1); }
        }
        .reef-snake {
          position: absolute;
          left: 0;
          width: 100%;
          top: 65%;
          will-change: transform;
        }
        .reef-snake.swim-r { animation: reef-snake-swim-r ${SNAKE_CYCLE}s linear infinite; }
        .reef-snake.swim-l { animation: reef-snake-swim-l ${SNAKE_CYCLE}s linear infinite; }

        @keyframes reef-snake-undulate {
          0%, 100% { transform: skewY(-3deg); }
          50%      { transform: skewY(3deg); }
        }
        .reef-snake-body {
          animation: reef-snake-undulate 0.7s ease-in-out infinite;
          transform-origin: 50% 50%;
        }

        /* ─── Blasen ────────────────────────────────────────────────── */
        @keyframes reef-bubble-rise {
          0%   { transform: translate3d(0, 0, 0) scale(0.6); opacity: 0; }
          15%  { opacity: 0.85; transform: translate3d(0, -10%, 0) scale(1); }
          80%  { opacity: 0.7; }
          100% { transform: translate3d(var(--drift, 0px), -110%, 0) scale(1.1); opacity: 0; }
        }
        .reef-bubble {
          position: absolute;
          bottom: 0;
          width: var(--size, 8px); height: var(--size, 8px);
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95) 0%, rgba(186,230,253,0.6) 60%, transparent 100%);
          will-change: transform, opacity;
          animation: reef-bubble-rise var(--du, 6s) linear infinite;
          animation-delay: var(--d, 0s);
          box-shadow: 0 0 4px rgba(255,255,255,0.4);
        }

        /* ─── Algen + Korallen + Sandboden ─────────────────────────── */
        @keyframes reef-algae-sway {
          0%, 100% { transform: skewX(-4deg); }
          50%      { transform: skewX(4deg); }
        }
        .reef-algae {
          position: absolute;
          bottom: 0;
          width: var(--w, 14px);
          height: var(--h, 60%);
          transform-origin: bottom center;
          will-change: transform;
          animation: reef-algae-sway 3.5s ease-in-out infinite;
          animation-delay: var(--d, 0s);
        }
        @keyframes reef-coral-sway {
          0%, 100% { transform: rotate(-1.5deg); }
          50%      { transform: rotate(1.5deg); }
        }
        .reef-coral {
          position: absolute;
          bottom: 0;
          transform-origin: bottom center;
          will-change: transform;
          animation: reef-coral-sway 5s ease-in-out infinite;
          animation-delay: var(--d, 0s);
        }
        .reef-floor {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 12%;
          background: linear-gradient(180deg, transparent, rgba(254, 243, 199, 0.35) 60%, rgba(217, 119, 6, 0.5) 100%);
          pointer-events: none;
          border-radius: 50% 50% 0 0 / 30% 30% 0 0;
        }

        /* ─── Hint-Text ───────────────────────────────────────────── */
        @keyframes reef-hint-bob {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50%      { transform: translateX(-50%) translateY(-3px); }
        }
        .reef-hint {
          position: absolute;
          bottom: 8%;
          left: 50%;
          transform: translateX(-50%);
          padding: 4px 12px;
          background: rgba(255, 255, 255, 0.92);
          border-radius: 999px;
          color: #0c4a6e;
          font-weight: 800;
          font-size: clamp(10px, 2.2cqh, 16px);
          letter-spacing: 0.02em;
          text-shadow: 0 1px 0 rgba(255,255,255,0.5);
          box-shadow: 0 2px 8px rgba(8, 47, 73, 0.4);
          white-space: nowrap;
          will-change: transform;
          animation: reef-hint-bob 1.6s ease-in-out infinite;
          z-index: 5;
        }

        @media (prefers-reduced-motion: reduce) {
          .reef-fish, .reef-bubble, .reef-algae, .reef-coral, .reef-hint,
          .reef-hai, .reef-snake, .reef-snack {
            animation: none !important;
          }
        }
      `}</style>

      {/* ─── LAYER 1: Wasser, Korallen, Algen, Blasen ─────────────── */}
      <div className="reef-bg" aria-hidden>
        <div className="reef-sunray reef-sunray-1" />
        <div className="reef-sunray reef-sunray-2" />
        <div className="reef-sunray reef-sunray-3" />
        <div className="reef-floor" />

        {ALGAE.map((a) => (
          <div
            key={`algae-${a.id}`}
            className="reef-algae"
            style={{
              left: `${a.x}%`,
              '--h': `${a.h}%`,
              '--d': `${a.delay}s`,
            } as React.CSSProperties}
          >
            <svg viewBox="0 0 20 100" width="100%" height="100%" preserveAspectRatio="none">
              <path
                d={`M 10,100 Q ${a.id % 2 ? 4 : 16},75 10,50 Q ${a.id % 2 ? 16 : 4},25 10,0`}
                stroke={a.color}
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
                opacity="0.85"
              />
            </svg>
          </div>
        ))}

        {CORALS.map((c) => (
          <div
            key={`coral-${c.id}`}
            className="reef-coral"
            style={{
              left: `${c.x}%`,
              transform: `translateX(-50%) scale(${c.s})`,
              '--d': `${c.id * 0.7}s`,
            } as React.CSSProperties}
          >
            <svg viewBox="0 0 60 60" width="60" height="60">
              <path d="M 30,60 Q 28,40 30,30 Q 32,20 30,10" stroke={c.c2} strokeWidth="4" fill="none" strokeLinecap="round" />
              <path d="M 30,40 Q 20,32 18,22" stroke={c.c2} strokeWidth="3" fill="none" strokeLinecap="round" />
              <path d="M 30,35 Q 42,28 44,20" stroke={c.c2} strokeWidth="3" fill="none" strokeLinecap="round" />
              <circle cx="30" cy="10" r="5" fill={c.c1} />
              <circle cx="18" cy="22" r="4" fill={c.c1} />
              <circle cx="44" cy="20" r="4" fill={c.c1} />
              <circle cx="30" cy="28" r="3" fill={c.c1} opacity="0.8" />
              <circle cx="28" cy="9" r="1.5" fill="#ffffff" opacity="0.7" />
            </svg>
          </div>
        ))}

        {BUBBLES.map((b) => (
          <span
            key={`bubble-${b.id}`}
            className="reef-bubble"
            style={{
              left: `${b.x}%`,
              '--size': `${b.size}px`,
              '--du': `${b.dur}s`,
              '--d': `${b.delay}s`,
              '--drift': `${b.drift}px`,
            } as React.CSSProperties}
          />
        ))}

        {hintText && <div className="reef-hint">{hintText}</div>}
      </div>

      {/* ─── LAYER 2: Tiere — Fische, Hai, Schlange, Snacks ───────── */}
      <div className="reef-creatures" aria-hidden>
        {/* Großer Hai-Schwarm */}
        {FISH.map((f) => {
          const swimClass =
            direction === 'right' ? 'swim-r' :
            direction === 'left'  ? 'swim-l' :
            (f.id % 2 === 0 ? 'swim-r' : 'swim-l');
          return (
            <div
              key={`fish-${f.id}`}
              className={`reef-fish ${swimClass}`}
              style={{
                top: `${f.y}%`,
                '--du': `${f.dur}s`,
                '--d': `${f.delay}s`,
                '--bob': `${(f.id % 2 ? -1 : 1) * 6}px`,
              } as React.CSSProperties}
            >
              <div style={{ display: 'inline-block', transform: `scale(${f.scale})`, transformOrigin: '0 50%' }}>
                <Fish variant={f.variant} />
              </div>
            </div>
          );
        })}

        {/* Hai */}
        <div className={`reef-hai swim-${haiDir.charAt(0)}`}>
          <div style={{ display: 'inline-block' }}>
            <Hai />
          </div>
        </div>

        {/* Snack-Fische die "vom Hai gefressen" werden */}
        {SNACKS.map((s) => {
          // Snack erscheint synchron zum Hai bei seiner X-Position
          // Hai-Cycle ist 18s → wenn snackAt=4, ist Hai bei ~22% Tile-Breite
          // Wir setzen Snack einfach in der Tile-Mitte (50%) und timing es so
          // dass er kurz vor Hai-Mitte erscheint und beim Bite verschwindet
          const xPercent = 30 + (s.id * 12); // verteilt 30-66%
          return (
            <div
              key={`snack-${s.id}`}
              className="reef-snack-pos reef-snack"
              style={{
                left: `${xPercent}%`,
                top: `${s.y}%`,
                animationDelay: `${s.snackAt - 1}s`,
                animationDuration: `${HAI_CYCLE}s`,
              } as React.CSSProperties}
            >
              🐟
            </div>
          );
        })}

        {/* Sea-Snake / Aal */}
        <div className={`reef-snake swim-${snakeDir.charAt(0)}`}>
          <div className="reef-snake-body" style={{ display: 'inline-block' }}>
            <SeaSnake />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Fisch-SVG-Varianten ──────────────────────────────────────────────
function Fish({ variant }: { variant: number }) {
  if (variant === 1) {
    return (
      <svg viewBox="0 0 70 36" width="70" height="36" style={{ overflow: 'visible' }}>
        <g className="reef-fish-tail" style={{ transformOrigin: '0px 18px' }}>
          <polygon points="0,18 -16,4 -10,18 -16,32" fill="#f97316" stroke="#1c1917" strokeWidth="0.8" />
        </g>
        <ellipse cx="32" cy="18" rx="28" ry="13" fill="#f97316" />
        <path d="M 18,7 Q 18,18 18,30 L 24,30 Q 23,18 24,6 Z" fill="#ffffff" />
        <path d="M 38,6 Q 38,18 38,30 L 44,30 Q 43,18 44,6 Z" fill="#ffffff" />
        <line x1="18" y1="7" x2="18" y2="30" stroke="#1c1917" strokeWidth="1" />
        <line x1="24" y1="6" x2="24" y2="30" stroke="#1c1917" strokeWidth="1" />
        <line x1="38" y1="6" x2="38" y2="30" stroke="#1c1917" strokeWidth="1" />
        <line x1="44" y1="6" x2="44" y2="30" stroke="#1c1917" strokeWidth="1" />
        <path d="M 25,5 Q 35,0 45,5 L 42,9 L 28,9 Z" fill="#f97316" stroke="#1c1917" strokeWidth="0.6" />
        <path d="M 28,30 Q 33,34 38,30 Z" fill="#f97316" stroke="#1c1917" strokeWidth="0.6" />
        <circle cx="55" cy="15" r="3.5" fill="#ffffff" stroke="#1c1917" strokeWidth="0.8" />
        <circle cx="55.5" cy="15" r="1.8" fill="#1c1917" />
        <circle cx="56" cy="14" r="0.6" fill="#ffffff" />
        <path d="M 62,19 Q 65,21 62,23" stroke="#1c1917" strokeWidth="1" fill="none" />
      </svg>
    );
  }
  if (variant === 2) {
    return (
      <svg viewBox="0 0 80 42" width="80" height="42" style={{ overflow: 'visible' }}>
        <g className="reef-fish-tail" style={{ transformOrigin: '0px 21px' }}>
          <polygon points="0,21 -20,5 -12,21 -20,37" fill="#fbbf24" stroke="#1c1917" strokeWidth="0.8" />
        </g>
        <ellipse cx="38" cy="21" rx="33" ry="16" fill="#3b82f6" />
        <path d="M 12,21 Q 12,32 22,38 L 60,38 Q 65,32 65,28 L 12,28 Z" fill="#1e3a8a" opacity="0.7" />
        <path d="M 60,15 Q 70,13 72,18 L 65,22 Z" fill="#fbbf24" />
        <path d="M 22,5 Q 38,2 54,5 L 50,11 L 28,11 Z" fill="#3b82f6" stroke="#1c1917" strokeWidth="0.6" />
        <circle cx="64" cy="18" r="4" fill="#ffffff" stroke="#1c1917" strokeWidth="0.8" />
        <circle cx="64.5" cy="18" r="2" fill="#1c1917" />
        <circle cx="65" cy="17" r="0.7" fill="#ffffff" />
        <path d="M 71,22 Q 75,24 71,26" stroke="#1c1917" strokeWidth="1" fill="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 70 36" width="70" height="36" style={{ overflow: 'visible' }}>
      <g className="reef-fish-tail" style={{ transformOrigin: '0px 18px' }}>
        <polygon points="0,18 -15,5 -8,18 -15,31" fill="#facc15" stroke="#1c1917" strokeWidth="0.8" />
      </g>
      <ellipse cx="32" cy="18" rx="28" ry="13" fill="#facc15" />
      <path d="M 12,8 L 18,8 L 28,28 L 22,28 Z" fill="#1d4ed8" />
      <path d="M 25,7 L 31,7 L 41,29 L 35,29 Z" fill="#1d4ed8" />
      <path d="M 38,8 L 44,8 L 50,26 L 44,26 Z" fill="#1d4ed8" />
      <path d="M 25,5 Q 35,1 45,5 L 42,9 L 28,9 Z" fill="#fbbf24" stroke="#1c1917" strokeWidth="0.6" />
      <circle cx="55" cy="15" r="3.5" fill="#ffffff" stroke="#1c1917" strokeWidth="0.8" />
      <circle cx="55.5" cy="15" r="1.8" fill="#1c1917" />
      <circle cx="56" cy="14" r="0.6" fill="#ffffff" />
      <path d="M 62,19 Q 65,21 62,23" stroke="#1c1917" strokeWidth="1" fill="none" />
    </svg>
  );
}

// ─── Hai (mit Pacman-Maul) ─────────────────────────────────────────────
function Hai() {
  return (
    <svg viewBox="-50 -10 200 90" width="200" height="90" style={{ overflow: 'visible' }}>
      {/* Schwanz — animiert */}
      <g className="reef-hai-tail" style={{ transformOrigin: '0px 35px' }}>
        <polygon points="0,35 -38,5 -22,35 -38,65" fill="#475569" stroke="#1c1917" strokeWidth="1.2" />
      </g>
      {/* Körper-Hauptmasse (Unterseite — bleibt fest) */}
      <ellipse cx="70" cy="42" rx="70" ry="22" fill="#64748b" />
      {/* Heller Bauch */}
      <ellipse cx="70" cy="55" rx="60" ry="14" fill="#cbd5e1" />
      {/* Trennlinie */}
      <path d="M 5,46 Q 70,52 135,46" stroke="#475569" strokeWidth="1.5" fill="none" />

      {/* Rückenflosse */}
      <path d="M 60,22 Q 75,5 90,22 L 85,32 L 65,32 Z" fill="#475569" stroke="#1c1917" strokeWidth="0.8" />
      {/* Brustflosse */}
      <path d="M 55,60 Q 50,75 70,72 L 75,62 Z" fill="#475569" stroke="#1c1917" strokeWidth="0.8" />

      {/* OBERKIEFER — Pacman-Maul, dreht sich (animiert) */}
      <g className="reef-hai-jaw-upper">
        <path
          d="M 130,42 Q 135,30 120,28 L 70,32 Q 70,28 110,30 L 130,35 Z"
          fill="#64748b"
          stroke="#1c1917"
          strokeWidth="0.8"
        />
        {/* Reißzähne oben */}
        <polygon points="80,32 82,40 84,32" fill="#ffffff" />
        <polygon points="88,32 90,42 92,32" fill="#ffffff" />
        <polygon points="100,32 102,42 104,32" fill="#ffffff" />
        <polygon points="115,30 117,40 119,30" fill="#ffffff" />
      </g>

      {/* UNTERKIEFER — bleibt fest */}
      <path
        d="M 130,42 Q 135,55 120,58 L 70,52 Q 70,56 110,55 L 130,50 Z"
        fill="#475569"
        stroke="#1c1917"
        strokeWidth="0.8"
      />
      {/* Reißzähne unten */}
      <polygon points="80,52 82,44 84,52" fill="#ffffff" />
      <polygon points="88,52 90,42 92,52" fill="#ffffff" />
      <polygon points="100,52 102,42 104,52" fill="#ffffff" />
      <polygon points="115,55 117,45 119,55" fill="#ffffff" />

      {/* Auge — wütend */}
      <circle cx="100" cy="22" r="5" fill="#ffffff" stroke="#1c1917" strokeWidth="1" />
      <circle cx="101" cy="22" r="2.5" fill="#1c1917" />
      <circle cx="102" cy="21" r="0.8" fill="#ffffff" />
      {/* Augenbraue (wütend) */}
      <path d="M 93,15 L 107,18" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />

      {/* Kiemen */}
      <path d="M 78,38 Q 80,42 78,48" stroke="#1c1917" strokeWidth="1" fill="none" opacity="0.7" />
      <path d="M 84,38 Q 86,42 84,48" stroke="#1c1917" strokeWidth="1" fill="none" opacity="0.7" />
      <path d="M 90,38 Q 92,42 90,48" stroke="#1c1917" strokeWidth="1" fill="none" opacity="0.7" />
    </svg>
  );
}

// ─── Sea-Snake / Aal ───────────────────────────────────────────────────
function SeaSnake() {
  return (
    <svg viewBox="0 0 180 50" width="180" height="50" style={{ overflow: 'visible' }}>
      {/* Schlangen-Körper als Wellen-Pfad mit gradient */}
      <defs>
        <linearGradient id="snake-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#0891b2" />
          <stop offset="100%" stopColor="#155e75" />
        </linearGradient>
      </defs>
      {/* Haupt-Körper */}
      <path
        d="M 0,25 Q 25,8 50,25 T 100,25 T 150,25 Q 165,25 175,22"
        stroke="url(#snake-grad)"
        strokeWidth="14"
        fill="none"
        strokeLinecap="round"
      />
      {/* Heller Bauch-Streifen */}
      <path
        d="M 0,25 Q 25,8 50,25 T 100,25 T 150,25 Q 165,25 175,22"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      {/* Kopf — rundlicher Endpunkt rechts */}
      <ellipse cx="175" cy="22" rx="10" ry="8" fill="#0e7490" stroke="#155e75" strokeWidth="1" />
      {/* Auge */}
      <circle cx="178" cy="20" r="2" fill="#fbbf24" />
      <circle cx="178.5" cy="20" r="0.8" fill="#1c1917" />
      {/* Maul / Zunge */}
      <line x1="184" y1="22" x2="190" y2="20" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="184" y1="22" x2="190" y2="24" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round" />
      {/* Schuppen-Andeutung — kleine Punkte entlang des Körpers */}
      <circle cx="30" cy="18" r="1.5" fill="#67e8f9" opacity="0.7" />
      <circle cx="70" cy="22" r="1.5" fill="#67e8f9" opacity="0.7" />
      <circle cx="110" cy="20" r="1.5" fill="#67e8f9" opacity="0.7" />
      <circle cx="140" cy="24" r="1.5" fill="#67e8f9" opacity="0.7" />
    </svg>
  );
}
