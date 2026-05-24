// Animierte Unterwasser-Riff-Szene als Hintergrund für leere Tile-Slots.
//
// User-Wunsch (Mai 2026): wenn auf der TV-Tafel ein Slot leer ist, soll
// statt der statischen "🚫 Kein Aufguss"-Anzeige ein lebendiges
// Korallen-Riff laufen. Die Fische schwimmen in Richtung der gerade
// aktiven Sauna (Direction-Prop) — so wird die Aufmerksamkeit auf die
// andere Spalte gelenkt statt einfach "leer" zu signalisieren.
//
// Pattern: Pure-CSS, inline <style>, Inline-SVG. Analog zu den Bühnen-
// Scenes (ButterfliesScene, Holzfaeller etc.) — GPU-only, 24/7-tauglich.

type Direction = 'left' | 'right' | null;

type Props = {
  /** Schwimm-Richtung der Fische:
   *  - 'right': Fische schwimmen nach RECHTS (zur rechten Sauna-Spalte)
   *  - 'left':  Fische schwimmen nach LINKS (zur linken Sauna-Spalte)
   *  - null:    Beide Saunen leer → Fische schwimmen zufällig in beide Richtungen */
  direction: Direction;
  /** Dezenter Leit-Text, z.B. "→ Jetzt bei Kelo 80°C". Wird unten mittig
   *  in einer halbtransparenten Pille gerendert wenn gesetzt. */
  hintText?: string;
};

// Fisch-Konfigurationen. Jeder Fisch bekommt eigene Y-Position, Größe,
// Geschwindigkeit und Delay — sorgt für lebendigen Schwarm-Effekt.
const FISH = [
  { id: 0, yPercent: 18, scale: 0.95, duration: 14, delay: 0.0,  variant: 0 },
  { id: 1, yPercent: 32, scale: 0.75, duration: 11, delay: 2.5,  variant: 1 },
  { id: 2, yPercent: 45, scale: 1.10, duration: 16, delay: 1.0,  variant: 2 },
  { id: 3, yPercent: 28, scale: 0.65, duration: 9,  delay: 4.0,  variant: 1 },
  { id: 4, yPercent: 55, scale: 0.85, duration: 13, delay: 6.0,  variant: 0 },
  { id: 5, yPercent: 38, scale: 0.70, duration: 10, delay: 3.5,  variant: 1 },
  { id: 6, yPercent: 22, scale: 0.90, duration: 15, delay: 7.0,  variant: 2 },
];

// Aufsteigende Blasen — über die ganze Breite verteilt, verschiedene Größen
const BUBBLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  xPercent: (i * 5.8) % 100,
  size: 4 + (i % 4) * 3,
  delay: (i * 0.45) % 6,
  duration: 5 + (i % 4) * 1.2,
  drift: -8 + (i % 5) * 4,
}));

// Algen — 5 Stück, an Korallen-Höhe verankert
const ALGAE = [
  { id: 0, xPercent: 10, height: 60, color: '#15803d', delay: 0.0 },
  { id: 1, xPercent: 25, height: 75, color: '#16a34a', delay: 0.5 },
  { id: 2, xPercent: 48, height: 50, color: '#15803d', delay: 1.2 },
  { id: 3, xPercent: 70, height: 70, color: '#22c55e', delay: 0.8 },
  { id: 4, xPercent: 88, height: 55, color: '#16a34a', delay: 1.5 },
];

// Korallen — bunte Cluster am Boden
const CORALS = [
  { id: 0, xPercent: 8,  color1: '#fb923c', color2: '#ea580c', size: 1.0 },
  { id: 1, xPercent: 30, color1: '#ec4899', color2: '#be185d', size: 1.2 },
  { id: 2, xPercent: 55, color1: '#a855f7', color2: '#7c3aed', size: 0.9 },
  { id: 3, xPercent: 78, color1: '#fb923c', color2: '#dc2626', size: 1.1 },
  { id: 4, xPercent: 92, color1: '#f472b6', color2: '#db2777', size: 0.8 },
];

export function ReefScene({ direction, hintText }: Props) {
  return (
    <>
      <style>{`
        /* ─── Hintergrund-Gradient (Wasser von hell oben nach dunkel unten) ─── */
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

        /* Sonnenstrahlen von oben */
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

        /* ─── Fisch-Schwimm-Animation ───────────────────────────────────── */
        /* Variable --swim-direction: 1 (rechts) | -1 (links).
           Fisch wird via scaleX(--swim-direction) gespiegelt damit er
           immer "nach vorne" schwimmt. */
        @keyframes reef-fish-swim-r {
          0%   { transform: translate3d(-25%, 0, 0) scaleX(1); }
          50%  { transform: translate3d(50%, var(--bob, 4px), 0) scaleX(1); }
          100% { transform: translate3d(125%, 0, 0) scaleX(1); }
        }
        @keyframes reef-fish-swim-l {
          0%   { transform: translate3d(125%, 0, 0) scaleX(-1); }
          50%  { transform: translate3d(50%, var(--bob, 4px), 0) scaleX(-1); }
          100% { transform: translate3d(-25%, 0, 0) scaleX(-1); }
        }
        @keyframes reef-fish-tail {
          0%, 100% { transform: rotate(-12deg); }
          50%      { transform: rotate(12deg); }
        }
        .reef-fish {
          position: absolute;
          will-change: transform;
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

        /* ─── Blasen aufsteigend ─────────────────────────────────────────── */
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

        /* ─── Algen wedeln ──────────────────────────────────────────────── */
        @keyframes reef-algae-sway {
          0%, 100% { transform: skewX(-4deg); }
          50%      { transform: skewX(4deg); }
        }
        .reef-algae {
          position: absolute;
          bottom: 0;
          width: var(--w, 12px);
          height: var(--h, 60%);
          transform-origin: bottom center;
          will-change: transform;
          animation: reef-algae-sway 3.5s ease-in-out infinite;
          animation-delay: var(--d, 0s);
        }

        /* ─── Korallen-Cluster — sehr leichtes Wiegen ──────────────────── */
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

        /* ─── Sandboden ───────────────────────────────────────────────── */
        .reef-floor {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 12%;
          background: linear-gradient(180deg, transparent, rgba(254, 243, 199, 0.35) 60%, rgba(217, 119, 6, 0.5) 100%);
          pointer-events: none;
          border-radius: 50% 50% 0 0 / 30% 30% 0 0;
        }

        /* ─── Leit-Text-Pille ──────────────────────────────────────────── */
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

        /* prefers-reduced-motion → ruhige Szene */
        @media (prefers-reduced-motion: reduce) {
          .reef-fish, .reef-bubble, .reef-algae, .reef-coral, .reef-hint {
            animation: none !important;
          }
        }
      `}</style>

      <div className="reef-bg" aria-hidden>
        {/* Sonnenstrahlen */}
        <div className="reef-sunray reef-sunray-1" />
        <div className="reef-sunray reef-sunray-2" />
        <div className="reef-sunray reef-sunray-3" />

        {/* Sandboden */}
        <div className="reef-floor" />

        {/* Algen */}
        {ALGAE.map((a) => (
          <div
            key={`algae-${a.id}`}
            className="reef-algae"
            style={{
              left: `${a.xPercent}%`,
              '--h': `${a.height}%`,
              '--w': '14px',
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
              <path
                d={`M 10,100 Q ${a.id % 2 ? 4 : 16},75 10,50 Q ${a.id % 2 ? 16 : 4},25 10,0`}
                stroke={a.color}
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
                opacity="0.5"
              />
            </svg>
          </div>
        ))}

        {/* Korallen */}
        {CORALS.map((c) => (
          <div
            key={`coral-${c.id}`}
            className="reef-coral"
            style={{
              left: `${c.xPercent}%`,
              transform: `translateX(-50%) scale(${c.size})`,
              '--d': `${c.id * 0.7}s`,
            } as React.CSSProperties}
          >
            <svg viewBox="0 0 60 60" width="60" height="60">
              {/* Korallen-Stamm */}
              <path
                d="M 30,60 Q 28,40 30,30 Q 32,20 30,10"
                stroke={c.color2}
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
              />
              {/* Verzweigungen */}
              <path
                d="M 30,40 Q 20,32 18,22"
                stroke={c.color2}
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M 30,35 Q 42,28 44,20"
                stroke={c.color2}
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
              {/* Knöllchen (Polypen) */}
              <circle cx="30" cy="10" r="5" fill={c.color1} />
              <circle cx="18" cy="22" r="4" fill={c.color1} />
              <circle cx="44" cy="20" r="4" fill={c.color1} />
              <circle cx="30" cy="28" r="3" fill={c.color1} opacity="0.8" />
              {/* Highlight */}
              <circle cx="28" cy="9" r="1.5" fill="#ffffff" opacity="0.7" />
            </svg>
          </div>
        ))}

        {/* Fische — Schwarm. Container nimmt volle Tile-Breite (width:100%)
            damit die translateX(%)-Werte relativ zur Tile funktionieren —
            so flutscht der Fisch garantiert von links-außen nach rechts-
            außen über die ganze Tile-Breite. */}
        {FISH.map((f) => {
          // Wenn beide Saunen leer (direction === null), wechseln Fische
          // pseudo-zufällig die Richtung anhand ihrer id.
          const swimClass =
            direction === 'right' ? 'swim-r' :
            direction === 'left'  ? 'swim-l' :
            (f.id % 2 === 0 ? 'swim-r' : 'swim-l');
          return (
            <div
              key={`fish-${f.id}`}
              className={`reef-fish ${swimClass}`}
              style={{
                top: `${f.yPercent}%`,
                left: 0,
                width: '100%',
                pointerEvents: 'none',
                '--du': `${f.duration}s`,
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

        {/* Aufsteigende Blasen */}
        {BUBBLES.map((b) => (
          <span
            key={`bubble-${b.id}`}
            className="reef-bubble"
            style={{
              left: `${b.xPercent}%`,
              '--size': `${b.size}px`,
              '--du': `${b.duration}s`,
              '--d': `${b.delay}s`,
              '--drift': `${b.drift}px`,
            } as React.CSSProperties}
          />
        ))}

        {/* Leit-Text unten */}
        {hintText && <div className="reef-hint">{hintText}</div>}
      </div>
    </>
  );
}

// ─── Fisch-SVG-Varianten ──────────────────────────────────────────────
// 3 Typen: Tropenfisch (gelb-blau), Clownfisch (orange-weiß), Doktorfisch
// (blau-gelb). Alle blicken nach RECHTS — die Schwimm-Animation spiegelt
// via scaleX(±1) je nach Direction.
function Fish({ variant }: { variant: number }) {
  if (variant === 1) {
    // Clownfisch (orange/weiß/schwarz)
    return (
      <svg viewBox="0 0 70 36" width="70" height="36" style={{ overflow: 'visible' }}>
        {/* Schwanz — wackelt separat */}
        <g className="reef-fish-tail" style={{ transformOrigin: '0px 18px' }}>
          <polygon points="0,18 -16,4 -10,18 -16,32" fill="#f97316" stroke="#1c1917" strokeWidth="0.8" />
        </g>
        {/* Körper */}
        <ellipse cx="32" cy="18" rx="28" ry="13" fill="#f97316" />
        {/* Weiße Streifen */}
        <path d="M 18,7 Q 18,18 18,30 L 24,30 Q 23,18 24,6 Z" fill="#ffffff" />
        <path d="M 38,6 Q 38,18 38,30 L 44,30 Q 43,18 44,6 Z" fill="#ffffff" />
        {/* Schwarze Konturen der Streifen */}
        <line x1="18" y1="7" x2="18" y2="30" stroke="#1c1917" strokeWidth="1" />
        <line x1="24" y1="6" x2="24" y2="30" stroke="#1c1917" strokeWidth="1" />
        <line x1="38" y1="6" x2="38" y2="30" stroke="#1c1917" strokeWidth="1" />
        <line x1="44" y1="6" x2="44" y2="30" stroke="#1c1917" strokeWidth="1" />
        {/* Rückenflosse */}
        <path d="M 25,5 Q 35,0 45,5 L 42,9 L 28,9 Z" fill="#f97316" stroke="#1c1917" strokeWidth="0.6" />
        {/* Bauchflosse */}
        <path d="M 28,30 Q 33,34 38,30 Z" fill="#f97316" stroke="#1c1917" strokeWidth="0.6" />
        {/* Auge */}
        <circle cx="55" cy="15" r="3.5" fill="#ffffff" stroke="#1c1917" strokeWidth="0.8" />
        <circle cx="55.5" cy="15" r="1.8" fill="#1c1917" />
        <circle cx="56" cy="14" r="0.6" fill="#ffffff" />
        {/* Mund */}
        <path d="M 62,19 Q 65,21 62,23" stroke="#1c1917" strokeWidth="1" fill="none" />
      </svg>
    );
  }
  if (variant === 2) {
    // Doktorfisch (königsblau mit gelbem Schwanz)
    return (
      <svg viewBox="0 0 80 42" width="80" height="42" style={{ overflow: 'visible' }}>
        {/* Schwanz */}
        <g className="reef-fish-tail" style={{ transformOrigin: '0px 21px' }}>
          <polygon points="0,21 -20,5 -12,21 -20,37" fill="#fbbf24" stroke="#1c1917" strokeWidth="0.8" />
        </g>
        {/* Körper — eiförmig */}
        <ellipse cx="38" cy="21" rx="33" ry="16" fill="#3b82f6" />
        {/* Dunkler Akzent-Streifen */}
        <path d="M 12,21 Q 12,32 22,38 L 60,38 Q 65,32 65,28 L 12,28 Z" fill="#1e3a8a" opacity="0.7" />
        {/* Gelbe Seitenflosse */}
        <path d="M 60,15 Q 70,13 72,18 L 65,22 Z" fill="#fbbf24" />
        {/* Rückenflosse */}
        <path d="M 22,5 Q 38,2 54,5 L 50,11 L 28,11 Z" fill="#3b82f6" stroke="#1c1917" strokeWidth="0.6" />
        {/* Auge */}
        <circle cx="64" cy="18" r="4" fill="#ffffff" stroke="#1c1917" strokeWidth="0.8" />
        <circle cx="64.5" cy="18" r="2" fill="#1c1917" />
        <circle cx="65" cy="17" r="0.7" fill="#ffffff" />
        {/* Mund */}
        <path d="M 71,22 Q 75,24 71,26" stroke="#1c1917" strokeWidth="1" fill="none" />
      </svg>
    );
  }
  // Default Variant 0: Tropenfisch (gelb mit blauen Streifen)
  return (
    <svg viewBox="0 0 70 36" width="70" height="36" style={{ overflow: 'visible' }}>
      <g className="reef-fish-tail" style={{ transformOrigin: '0px 18px' }}>
        <polygon points="0,18 -15,5 -8,18 -15,31" fill="#facc15" stroke="#1c1917" strokeWidth="0.8" />
      </g>
      {/* Körper */}
      <ellipse cx="32" cy="18" rx="28" ry="13" fill="#facc15" />
      {/* Blaue Diagonal-Streifen */}
      <path d="M 12,8 L 18,8 L 28,28 L 22,28 Z" fill="#1d4ed8" />
      <path d="M 25,7 L 31,7 L 41,29 L 35,29 Z" fill="#1d4ed8" />
      <path d="M 38,8 L 44,8 L 50,26 L 44,26 Z" fill="#1d4ed8" />
      {/* Rückenflosse */}
      <path d="M 25,5 Q 35,1 45,5 L 42,9 L 28,9 Z" fill="#fbbf24" stroke="#1c1917" strokeWidth="0.6" />
      {/* Auge */}
      <circle cx="55" cy="15" r="3.5" fill="#ffffff" stroke="#1c1917" strokeWidth="0.8" />
      <circle cx="55.5" cy="15" r="1.8" fill="#1c1917" />
      <circle cx="56" cy="14" r="0.6" fill="#ffffff" />
      {/* Mund */}
      <path d="M 62,19 Q 65,21 62,23" stroke="#1c1917" strokeWidth="1" fill="none" />
    </svg>
  );
}
