// Animierte Unterwasser-Riff-Szene als Hintergrund für leere Tile-Slots.
//
// User-Wunsch (29.05.2026, Iteration 3): Hai raus, dafür eine freundlichere
// Crew: 🪼 Qualle, 🐙 Tintenfisch, 🛁 Saunafass (Vereinsbezug!),
// 🟡 Sponge-Charakter und 🐠 Dory-Fisch. SeaSnake bleibt, Schwarm-Fische
// bleiben (Dory ergänzt eine 4. Fisch-Variante).
//
// Architektur in 2 Layern:
//   1. <reef-bg>     overflow:hidden → Wasser, Sonnenstrahlen, Korallen,
//                    Algen, Sandboden, Bubbles, Hint-Text. Diese Elemente
//                    sollen INNERHALB der Tile bleiben (Wasser darf nicht
//                    aus der "Karte" laufen, sonst hässlich).
//   2. <reef-creatures>  overflow:visible → alle Tiere/Objekte. Dürfen
//                    über die Tile-Grenze hinaus sichtbar bleiben
//                    (geclippt nur vom Spalten-Rand).

type Direction = 'left' | 'right' | null;

type Props = {
  direction: Direction;
  hintText?: string;
};

// Hauptschwarm — 14 Fische in 4 Varianten (0=Gelb-Tropen, 1=Clown,
// 2=Blau-Doktor, 3=Dory). Verschiedene Y-Positionen + Geschwindigkeiten
// für lebendigen Schwarm-Effekt.
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

// Dory bekommt einen eigenen Slot (langsamer + größer, damit erkennbar).
const DORY = { y: 32, scale: 1.0, dur: 19, delay: 0.0 };

// Quallen — schweben vertikal, driften sanft horizontal. 2 Stück an
// verschiedenen Positionen.
const JELLIES = [
  { id: 0, x: 18, dur: 17, delay: 0.0,  hue: 320 }, // pink
  { id: 1, x: 78, dur: 21, delay: 6.0,  hue: 270 }, // lila
];

// Tintenfisch — 1 Stück, schwimmt langsam diagonal mit waberenden Tentakeln.
const OCTOPUS = { y: 58, dur: 24, delay: 4.0 };

// Saunafass — Vereinsbezug! Treibt sehr gemächlich von einer Seite zur
// anderen, mit aufsteigendem Dampf.
const BUCKET = { y: 12, dur: 32, delay: 8.0 };

// Sponge-Charakter — schwimmt aufrecht, etwas tapsig.
const SPONGE = { y: 40, dur: 16, delay: 11.0 };

const SNAKE_CYCLE = 22;   // Schlange treibt langsam quer
const DORY_CYCLE = DORY.dur;

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
  // Schwimm-Richtungen so verteilt dass immer etwas in beide Richtungen
  // läuft (kreuzendes Treiben statt einseitige Wanderung):
  //   - Schlange + Sponge: gegen die Default-Direction
  //   - Octopus + Bucket + Dory: in Default-Direction
  const mainDir: 'left' | 'right' = direction === 'left' ? 'left' : 'right';
  const counterDir: 'left' | 'right' = mainDir === 'right' ? 'left' : 'right';

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

        /* ─── DORY (eigener langsamer Lauf, größer als Schwarm) ────── */
        .reef-dory {
          position: absolute;
          left: 0;
          width: 100%;
          top: ${DORY.y}%;
          will-change: transform;
        }
        .reef-dory.swim-r { animation: reef-fish-swim-r ${DORY_CYCLE}s linear infinite; animation-delay: ${DORY.delay}s; }
        .reef-dory.swim-l { animation: reef-fish-swim-l ${DORY_CYCLE}s linear infinite; animation-delay: ${DORY.delay}s; }

        /* ─── QUALLE — vertikales schweben + Bell-Pulse ─────────────── */
        @keyframes reef-jelly-float {
          0%   { transform: translate3d(0, 110%, 0); opacity: 0; }
          10%  { opacity: 0.85; }
          50%  { transform: translate3d(var(--drift, 10px), 30%, 0); }
          90%  { opacity: 0.7; }
          100% { transform: translate3d(0, -30%, 0); opacity: 0; }
        }
        @keyframes reef-jelly-pulse {
          0%, 100% { transform: scaleY(1)   scaleX(1); }
          50%      { transform: scaleY(0.85) scaleX(1.08); }
        }
        @keyframes reef-jelly-tentacle {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(3px); }
        }
        .reef-jelly {
          position: absolute;
          width: 56px; height: 80px;
          will-change: transform, opacity;
          animation: reef-jelly-float var(--du, 18s) linear infinite;
          animation-delay: var(--d, 0s);
        }
        .reef-jelly-bell {
          transform-origin: 50% 30%;
          animation: reef-jelly-pulse 2.4s ease-in-out infinite;
        }
        .reef-jelly-tentacles {
          animation: reef-jelly-tentacle 2.4s ease-in-out infinite;
        }

        /* ─── TINTENFISCH — Jet-Style schwimmen, Tentakeln wabern ──── */
        @keyframes reef-octo-swim-r {
          0%   { transform: translate3d(-35%, 0, 0); }
          50%  { transform: translate3d(50%, -8px, 0); }
          100% { transform: translate3d(135%, 0, 0); }
        }
        @keyframes reef-octo-swim-l {
          0%   { transform: translate3d(135%, 0, 0) scaleX(-1); }
          50%  { transform: translate3d(50%, -8px, 0) scaleX(-1); }
          100% { transform: translate3d(-35%, 0, 0) scaleX(-1); }
        }
        @keyframes reef-octo-arms {
          0%, 100% { transform: rotate(-3deg); }
          50%      { transform: rotate(3deg); }
        }
        .reef-octo {
          position: absolute;
          left: 0;
          width: 100%;
          top: ${OCTOPUS.y}%;
          will-change: transform;
        }
        .reef-octo.swim-r { animation: reef-octo-swim-r ${OCTOPUS.dur}s ease-in-out infinite; animation-delay: ${OCTOPUS.delay}s; }
        .reef-octo.swim-l { animation: reef-octo-swim-l ${OCTOPUS.dur}s ease-in-out infinite; animation-delay: ${OCTOPUS.delay}s; }
        .reef-octo-arms {
          transform-origin: 50% 30%;
          animation: reef-octo-arms 1.6s ease-in-out infinite;
        }

        /* ─── SAUNAFASS — treibt gemächlich, mit Dampf ─────────────── */
        @keyframes reef-bucket-drift-r {
          0%   { transform: translate3d(-30%, 0, 0) rotate(-3deg); }
          50%  { transform: translate3d(50%, 5px, 0) rotate(2deg); }
          100% { transform: translate3d(130%, 0, 0) rotate(-3deg); }
        }
        @keyframes reef-bucket-drift-l {
          0%   { transform: translate3d(130%, 0, 0) rotate(3deg); }
          50%  { transform: translate3d(50%, 5px, 0) rotate(-2deg); }
          100% { transform: translate3d(-30%, 0, 0) rotate(3deg); }
        }
        .reef-bucket {
          position: absolute;
          left: 0;
          width: 100%;
          top: ${BUCKET.y}%;
          will-change: transform;
        }
        .reef-bucket.swim-r { animation: reef-bucket-drift-r ${BUCKET.dur}s linear infinite; animation-delay: ${BUCKET.delay}s; }
        .reef-bucket.swim-l { animation: reef-bucket-drift-l ${BUCKET.dur}s linear infinite; animation-delay: ${BUCKET.delay}s; }
        @keyframes reef-steam-rise {
          0%   { transform: translate3d(0, 0, 0) scale(0.6); opacity: 0; }
          30%  { opacity: 0.65; }
          100% { transform: translate3d(4px, -28px, 0) scale(1.4); opacity: 0; }
        }
        .reef-steam {
          will-change: transform, opacity;
          animation: reef-steam-rise 3s ease-out infinite;
          animation-delay: var(--d, 0s);
          transform-origin: 50% 100%;
        }

        /* ─── SPONGE-CHARAKTER — schwimmt aufrecht ─────────────────── */
        @keyframes reef-sponge-swim-r {
          0%   { transform: translate3d(-30%, 0, 0); }
          50%  { transform: translate3d(50%, var(--bob, -6px), 0); }
          100% { transform: translate3d(130%, 0, 0); }
        }
        @keyframes reef-sponge-swim-l {
          0%   { transform: translate3d(130%, 0, 0); }
          50%  { transform: translate3d(50%, var(--bob, -6px), 0); }
          100% { transform: translate3d(-30%, 0, 0); }
        }
        @keyframes reef-sponge-wiggle {
          0%, 100% { transform: rotate(-2deg); }
          50%      { transform: rotate(2deg); }
        }
        .reef-sponge {
          position: absolute;
          left: 0;
          width: 100%;
          top: ${SPONGE.y}%;
          will-change: transform;
        }
        .reef-sponge.swim-r { animation: reef-sponge-swim-r ${SPONGE.dur}s ease-in-out infinite; animation-delay: ${SPONGE.delay}s; }
        .reef-sponge.swim-l { animation: reef-sponge-swim-l ${SPONGE.dur}s ease-in-out infinite; animation-delay: ${SPONGE.delay}s; }
        .reef-sponge-body {
          transform-origin: 50% 100%;
          animation: reef-sponge-wiggle 1.8s ease-in-out infinite;
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
          .reef-snake, .reef-dory, .reef-jelly, .reef-jelly-bell,
          .reef-jelly-tentacles, .reef-octo, .reef-octo-arms,
          .reef-bucket, .reef-steam, .reef-sponge, .reef-sponge-body {
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

      {/* ─── LAYER 2: Tiere — Schwarm, Dory, Quallen, Octo, Bucket, Sponge, Snake ── */}
      <div className="reef-creatures" aria-hidden>
        {/* Großer Fisch-Schwarm */}
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

        {/* Dory — eigener langsamer großer Lauf, blau-gelb */}
        <div className={`reef-dory swim-${mainDir.charAt(0)}`}>
          <div style={{ display: 'inline-block', transform: `scale(${DORY.scale})`, transformOrigin: '0 50%' }}>
            <Fish variant={3} />
          </div>
        </div>

        {/* Quallen — schweben vertikal */}
        {JELLIES.map((j) => (
          <div
            key={`jelly-${j.id}`}
            className="reef-jelly"
            style={{
              left: `${j.x}%`,
              '--du': `${j.dur}s`,
              '--d': `${j.delay}s`,
              '--drift': `${(j.id % 2 ? -1 : 1) * 14}px`,
            } as React.CSSProperties}
          >
            <Jellyfish hue={j.hue} />
          </div>
        ))}

        {/* Tintenfisch — schwimmt in Default-Richtung */}
        <div className={`reef-octo swim-${mainDir.charAt(0)}`}>
          <div style={{ display: 'inline-block' }}>
            <Octopus />
          </div>
        </div>

        {/* Saunafass — treibt gemächlich, mit Dampf */}
        <div className={`reef-bucket swim-${counterDir.charAt(0)}`}>
          <div style={{ display: 'inline-block' }}>
            <SaunaBucket />
          </div>
        </div>

        {/* Sponge-Charakter — schwimmt aufrecht, gegen die Default-Richtung */}
        <div className={`reef-sponge swim-${counterDir.charAt(0)}`} style={{ '--bob': '-8px' } as React.CSSProperties}>
          <div className="reef-sponge-body" style={{ display: 'inline-block' }}>
            <SpongeCharacter />
          </div>
        </div>

        {/* Sea-Snake / Aal — gegen die Default-Richtung */}
        <div className={`reef-snake swim-${counterDir.charAt(0)}`}>
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
  if (variant === 3) {
    // Dory — Pacific Tang: blau Körper, gelber Schwanz, schwarze Markierung
    return (
      <svg viewBox="0 0 80 40" width="80" height="40" style={{ overflow: 'visible' }}>
        <g className="reef-fish-tail" style={{ transformOrigin: '0px 20px' }}>
          <polygon points="0,20 -18,2 -10,20 -18,38" fill="#fbbf24" stroke="#1c1917" strokeWidth="0.9" />
        </g>
        <ellipse cx="38" cy="20" rx="32" ry="14" fill="#1d4ed8" />
        <path d="M 18,8 Q 38,3 58,8 L 55,14 L 21,14 Z" fill="#1e40af" stroke="#1c1917" strokeWidth="0.6" />
        <path d="M 14,16 Q 28,11 50,14 Q 60,20 55,29 Q 38,33 16,28 Z" fill="#000000" opacity="0.78" />
        <path d="M 14,16 Q 28,11 50,14 L 50,18 Q 28,15 14,20 Z" fill="#1d4ed8" />
        <path d="M 56,12 Q 70,10 73,16 L 66,20 Z" fill="#fbbf24" stroke="#1c1917" strokeWidth="0.5" />
        <path d="M 26,32 Q 34,36 42,32 Z" fill="#fbbf24" stroke="#1c1917" strokeWidth="0.5" />
        <circle cx="62" cy="16" r="4" fill="#ffffff" stroke="#1c1917" strokeWidth="0.8" />
        <circle cx="62.5" cy="16" r="2.2" fill="#1c1917" />
        <circle cx="63" cy="15" r="0.8" fill="#ffffff" />
        <path d="M 70,20 Q 73,22 70,25" stroke="#1c1917" strokeWidth="1" fill="none" />
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

// ─── Qualle ────────────────────────────────────────────────────────────
function Jellyfish({ hue }: { hue: number }) {
  const bell = `hsla(${hue}, 75%, 70%, 0.78)`;
  const inner = `hsla(${hue}, 60%, 85%, 0.55)`;
  const tent = `hsla(${hue}, 70%, 75%, 0.55)`;
  return (
    <svg viewBox="0 0 56 80" width="56" height="80" style={{ overflow: 'visible' }}>
      {/* Bell (oben) — pulsiert */}
      <g className="reef-jelly-bell">
        <ellipse cx="28" cy="28" rx="26" ry="22" fill={bell} />
        <ellipse cx="28" cy="20" rx="20" ry="12" fill={inner} />
        <ellipse cx="20" cy="18" rx="3" ry="2" fill="rgba(255,255,255,0.9)" />
        {/* Bell-Saum unten */}
        <path
          d="M 2,30 Q 8,42 14,32 Q 20,42 28,32 Q 36,42 42,32 Q 48,42 54,30 L 54,36 Q 28,46 2,36 Z"
          fill={bell}
        />
      </g>
      {/* Tentakeln (lang nach unten, wabern) */}
      <g className="reef-jelly-tentacles">
        <path d="M 10,38 Q 8,55 12,76"  stroke={tent} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 18,40 Q 22,58 16,78" stroke={tent} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 28,42 Q 24,60 30,78" stroke={tent} strokeWidth="3"   fill="none" strokeLinecap="round" />
        <path d="M 38,40 Q 42,58 36,78" stroke={tent} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 46,38 Q 50,58 44,76" stroke={tent} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ─── Tintenfisch (Oktopus) ─────────────────────────────────────────────
function Octopus() {
  return (
    <svg viewBox="0 0 90 70" width="90" height="70" style={{ overflow: 'visible' }}>
      {/* Tentakeln (hintere Schicht) */}
      <g className="reef-octo-arms">
        <path d="M 22,40 Q 12,55 8,68"  stroke="#a855f7" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M 30,46 Q 24,60 18,70" stroke="#a855f7" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M 42,48 Q 40,62 36,70" stroke="#9333ea" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M 50,48 Q 52,62 56,70" stroke="#9333ea" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M 60,46 Q 66,60 72,70" stroke="#a855f7" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M 68,40 Q 78,55 82,68" stroke="#a855f7" strokeWidth="6" fill="none" strokeLinecap="round" />
      </g>
      {/* Kopf-Mantel */}
      <ellipse cx="45" cy="30" rx="32" ry="26" fill="#c084fc" />
      <ellipse cx="45" cy="22" rx="26" ry="14" fill="#d8b4fe" />
      <ellipse cx="36" cy="18" rx="4" ry="2.5" fill="rgba(255,255,255,0.85)" />
      {/* Augen */}
      <circle cx="34" cy="28" r="5" fill="#ffffff" stroke="#1c1917" strokeWidth="0.8" />
      <circle cx="34" cy="29" r="2.6" fill="#1c1917" />
      <circle cx="35" cy="28" r="0.8" fill="#ffffff" />
      <circle cx="56" cy="28" r="5" fill="#ffffff" stroke="#1c1917" strokeWidth="0.8" />
      <circle cx="56" cy="29" r="2.6" fill="#1c1917" />
      <circle cx="57" cy="28" r="0.8" fill="#ffffff" />
      {/* Lächeln */}
      <path d="M 38,40 Q 45,46 52,40" stroke="#1c1917" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ─── Saunafass (Vereinsbezug!) ──────────────────────────────────────────
function SaunaBucket() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" style={{ overflow: 'visible' }}>
      {/* Dampf über dem Fass (3 kleine Wölkchen mit gestaffelten Delays) */}
      <g transform="translate(28, 8)">
        <ellipse className="reef-steam" cx="6"  cy="0" rx="5" ry="3" fill="rgba(255,255,255,0.6)" style={{ animationDelay: '0s' }} />
        <ellipse className="reef-steam" cx="14" cy="0" rx="6" ry="3.5" fill="rgba(255,255,255,0.5)" style={{ animationDelay: '0.8s' }} />
        <ellipse className="reef-steam" cx="22" cy="0" rx="5" ry="3" fill="rgba(255,255,255,0.55)" style={{ animationDelay: '1.6s' }} />
      </g>
      {/* Fass-Korpus */}
      <defs>
        <linearGradient id="bucket-wood" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#7c4a1a" />
          <stop offset="30%"  stopColor="#a0651e" />
          <stop offset="60%"  stopColor="#8a5318" />
          <stop offset="100%" stopColor="#5a3010" />
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="25" rx="28" ry="6" fill="#5a3010" />
      <path
        d="M 12,25 Q 12,68 18,72 L 62,72 Q 68,68 68,25 Z"
        fill="url(#bucket-wood)"
        stroke="#3a2008"
        strokeWidth="1"
      />
      {/* Wasser oben */}
      <ellipse cx="40" cy="25" rx="26" ry="4.5" fill="#7dd3fc" />
      <ellipse cx="40" cy="24.5" rx="20" ry="2.5" fill="#bae6fd" opacity="0.7" />
      {/* Holz-Lamellen */}
      <line x1="22" y1="28" x2="22" y2="70" stroke="#3a2008" strokeWidth="0.7" />
      <line x1="32" y1="28" x2="32" y2="71" stroke="#3a2008" strokeWidth="0.7" />
      <line x1="48" y1="28" x2="48" y2="71" stroke="#3a2008" strokeWidth="0.7" />
      <line x1="58" y1="28" x2="58" y2="70" stroke="#3a2008" strokeWidth="0.7" />
      {/* Metall-Bänder */}
      <path d="M 14,40 L 66,40" stroke="#cbd5e1" strokeWidth="2.5" />
      <path d="M 14,40 L 66,40" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
      <path d="M 15,60 L 65,60" stroke="#cbd5e1" strokeWidth="2.5" />
      <path d="M 15,60 L 65,60" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
      {/* Henkel */}
      <path d="M 10,30 Q 4,18 22,18" stroke="#cbd5e1" strokeWidth="2" fill="none" />
      {/* Aufkleber: kleines Saunafreunde-Logo (S) */}
      <circle cx="40" cy="55" r="7" fill="#fef3c7" stroke="#92400e" strokeWidth="0.8" />
      <text x="40" y="58.5" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#92400e">S</text>
    </svg>
  );
}

// ─── Sponge-Charakter (gelber Würfel mit Hose) ─────────────────────────
function SpongeCharacter() {
  return (
    <svg viewBox="0 0 60 80" width="60" height="80" style={{ overflow: 'visible' }}>
      {/* Beine */}
      <rect x="18" y="64" width="6" height="14" fill="#fde68a" stroke="#1c1917" strokeWidth="0.6" rx="1" />
      <rect x="36" y="64" width="6" height="14" fill="#fde68a" stroke="#1c1917" strokeWidth="0.6" rx="1" />
      <ellipse cx="21" cy="78" rx="4" ry="2" fill="#1c1917" />
      <ellipse cx="39" cy="78" rx="4" ry="2" fill="#1c1917" />
      {/* Hose (braun) mit Gürtel */}
      <rect x="10" y="52" width="40" height="16" fill="#92400e" stroke="#1c1917" strokeWidth="0.7" />
      <rect x="10" y="52" width="40" height="2.5" fill="#1c1917" />
      <rect x="28" y="52" width="4" height="2.5" fill="#fbbf24" />
      {/* Hauptkörper — gelber Schwamm-Würfel mit Löchern */}
      <rect x="6" y="8" width="48" height="48" rx="3" fill="#fbbf24" stroke="#1c1917" strokeWidth="0.9" />
      {/* Schwamm-Löcher */}
      <circle cx="12" cy="16" r="1.6" fill="#d97706" opacity="0.5" />
      <circle cx="22" cy="14" r="2.2" fill="#d97706" opacity="0.5" />
      <circle cx="44" cy="20" r="1.6" fill="#d97706" opacity="0.5" />
      <circle cx="48" cy="34" r="2"   fill="#d97706" opacity="0.5" />
      <circle cx="10" cy="38" r="2"   fill="#d97706" opacity="0.5" />
      <circle cx="32" cy="42" r="1.6" fill="#d97706" opacity="0.5" />
      <circle cx="14" cy="48" r="2"   fill="#d97706" opacity="0.5" />
      {/* Weißes Hemd-Kragen-Detail */}
      <rect x="12" y="44" width="36" height="6" fill="#ffffff" stroke="#1c1917" strokeWidth="0.5" />
      <rect x="28" y="44" width="4" height="6" fill="#dc2626" />
      {/* Augen */}
      <circle cx="22" cy="26" r="6" fill="#ffffff" stroke="#1c1917" strokeWidth="0.8" />
      <circle cx="22" cy="27" r="3.5" fill="#3b82f6" />
      <circle cx="22" cy="27" r="1.5" fill="#1c1917" />
      <circle cx="23" cy="26" r="0.6" fill="#ffffff" />
      <circle cx="38" cy="26" r="6" fill="#ffffff" stroke="#1c1917" strokeWidth="0.8" />
      <circle cx="38" cy="27" r="3.5" fill="#3b82f6" />
      <circle cx="38" cy="27" r="1.5" fill="#1c1917" />
      <circle cx="39" cy="26" r="0.6" fill="#ffffff" />
      {/* Wimpern */}
      <path d="M 17,21 L 19,22.5" stroke="#1c1917" strokeWidth="0.8" />
      <path d="M 22,19 L 22,21" stroke="#1c1917" strokeWidth="0.8" />
      <path d="M 38,19 L 38,21" stroke="#1c1917" strokeWidth="0.8" />
      <path d="M 43,21 L 41,22.5" stroke="#1c1917" strokeWidth="0.8" />
      {/* Großer Smile mit Zähnen */}
      <path d="M 18,36 Q 30,44 42,36 L 42,38 Q 30,46 18,38 Z" fill="#ffffff" stroke="#1c1917" strokeWidth="0.8" />
      <line x1="27" y1="36.5" x2="27" y2="42" stroke="#1c1917" strokeWidth="0.5" />
      <line x1="33" y1="36.5" x2="33" y2="42" stroke="#1c1917" strokeWidth="0.5" />
      {/* Nase */}
      <ellipse cx="30" cy="32" rx="1.5" ry="2" fill="#f59e0b" />
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
