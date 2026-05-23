// Piratenschiff segelt von rechts nach links, Kanonen schießen, Schatz-Münzen-Regen. 12s.

const CANNON_SHOTS = [
  { delay: 2.0, dx: -300, dy: -120 },
  { delay: 3.5, dx: -380, dy: -80 },
  { delay: 5.5, dx: -340, dy: -100 },
  { delay: 7.5, dx: -360, dy: -90 },
  { delay: 9.0, dx: -320, dy: -110 },
];

const TREASURE_COINS = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  x: 10 + (i * 2.3) % 80,
  delay: 4 + i * 0.15,
  duration: 3 + (i % 3) * 0.5,
}));

const WAVES = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  delay: i * 0.3,
  yOffset: i * 8,
}));

export default function PirateShipEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-pirate-ship-sail {
          0%   { transform: translate3d(115vw, 0, 0); }
          100% { transform: translate3d(-30vw, 0, 0); }
        }
        @keyframes fx-pirate-ship-bob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50%      { transform: translateY(-12px) rotate(2deg); }
        }
        @keyframes fx-pirate-flag-wave {
          0%, 100% { transform: skewX(-8deg); }
          50%      { transform: skewX(8deg); }
        }
        @keyframes fx-pirate-cannonball {
          0%   { transform: translate3d(0, 0, 0); opacity: 0; }
          5%   { opacity: 1; }
          50%  { transform: translate3d(calc(var(--dx, 0) / 2), calc(var(--dy, 0) - 30px), 0); }
          100% { transform: translate3d(var(--dx, 0), var(--dy, 0), 0); opacity: 0.8; }
        }
        @keyframes fx-pirate-cannon-flash {
          0%, 100% { opacity: 0; transform: scale(0); }
          20%      { opacity: 1; transform: scale(1.4); }
          100%     { opacity: 0; transform: scale(2); }
        }
        @keyframes fx-pirate-coin {
          0%   { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translate3d(0, 110vh, 0) rotate(720deg); opacity: 0.7; }
        }
        @keyframes fx-pirate-water-wave {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .fx-pirate-ship {
          position: absolute; bottom: 18vh; left: 0;
          will-change: transform;
          animation: fx-pirate-ship-sail 12s linear forwards;
        }
        .fx-pirate-ship-inner { animation: fx-pirate-ship-bob 1.8s ease-in-out infinite; }
        .fx-pirate-flag { animation: fx-pirate-flag-wave 0.6s ease-in-out infinite; transform-origin: 0% 50%; }
        .fx-pirate-cannonball {
          position: absolute; top: 50vh;
          width: 18px; height: 18px;
          background: radial-gradient(circle, #475569 30%, #0f172a 80%);
          border-radius: 50%;
          will-change: transform, opacity;
          animation: fx-pirate-cannonball 1.5s cubic-bezier(0.4, 0, 0.7, 1) forwards;
          animation-delay: var(--d, 0s);
          box-shadow: inset 0 -3px 4px rgba(0,0,0,0.5);
        }
        .fx-pirate-cannon-flash {
          position: absolute; top: 50vh;
          width: 60px; height: 60px;
          background: radial-gradient(circle, #fef3c7 0%, #fbbf24 30%, #ea580c 70%, transparent 100%);
          border-radius: 50%;
          will-change: transform, opacity;
          animation: fx-pirate-cannon-flash 0.4s ease-out forwards;
          animation-delay: var(--d, 0s);
          mix-blend-mode: screen;
        }
        .fx-pirate-coin {
          position: absolute; top: 0;
          width: 24px; height: 24px;
          background: radial-gradient(circle, #fef3c7 0%, #fbbf24 40%, #ca8a04 80%, #78350f 100%);
          border-radius: 50%;
          will-change: transform, opacity;
          animation: fx-pirate-coin var(--du, 3.5s) ease-in forwards;
          animation-delay: var(--d, 0s);
          box-shadow: inset 0 -2px 4px rgba(0,0,0,0.3), 0 0 6px rgba(251,191,36,0.6);
        }
        .fx-pirate-water {
          position: absolute; bottom: 0; left: 0; right: 0;
          height: 22vh;
          background: linear-gradient(180deg,
            rgba(30,64,175,0.5) 0%,
            rgba(30,58,138,0.85) 100%);
          pointer-events: none;
        }
        .fx-pirate-wave {
          position: absolute; left: 0; right: 0;
          height: 12px;
          background: repeating-linear-gradient(90deg,
            rgba(147,197,253,0.4) 0px,
            rgba(147,197,253,0.4) 15px,
            transparent 15px,
            transparent 30px);
          will-change: transform;
          animation: fx-pirate-water-wave 4s linear infinite;
          animation-delay: var(--d, 0s);
        }
      `}</style>

      {/* Wasser unten */}
      <div className="fx-pirate-water">
        {WAVES.map((w) => (
          <div
            key={`wave-${w.id}`}
            className="fx-pirate-wave"
            style={{
              top: `${w.yOffset}px`,
              '--d': `${w.delay}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Schiff */}
      <div className="fx-pirate-ship">
        <div className="fx-pirate-ship-inner">
          <svg viewBox="0 0 360 260" width="360" height="260">
            {/* Rumpf */}
            <path
              d="M 30,160 Q 50,140 80,140 L 280,140 Q 320,140 340,170 L 320,210 Q 290,225 200,225 Q 110,225 60,210 Z"
              fill="#78350f"
              stroke="#451a03"
              strokeWidth="2"
            />
            {/* Rumpf-Bretter */}
            <line x1="60" y1="170" x2="320" y2="170" stroke="#451a03" strokeWidth="1" opacity="0.6" />
            <line x1="60" y1="185" x2="320" y2="185" stroke="#451a03" strokeWidth="1" opacity="0.6" />
            <line x1="60" y1="200" x2="320" y2="200" stroke="#451a03" strokeWidth="1" opacity="0.6" />
            {/* Bullaugen (Kanonen-Löcher) */}
            <circle cx="120" cy="180" r="6" fill="#0f172a" />
            <circle cx="180" cy="180" r="6" fill="#0f172a" />
            <circle cx="240" cy="180" r="6" fill="#0f172a" />
            {/* Kanone (rechts heraus) */}
            <rect x="280" y="175" width="40" height="10" rx="2" fill="#1e293b" />
            <circle cx="320" cy="180" r="6" fill="#0f172a" />
            {/* Hauptmast */}
            <rect x="175" y="20" width="6" height="135" fill="#78350f" />
            {/* Großes Hauptsegel */}
            <path d="M 60,40 L 178,30 L 178,135 L 60,125 Z" fill="#f5f5f4" />
            <path d="M 60,40 L 178,30 L 178,135 L 60,125 Z" fill="#fafaf9" opacity="0.5" />
            {/* Schwarze Totenkopf-Flagge */}
            <g className="fx-pirate-flag">
              <rect x="178" y="20" width="100" height="55" fill="#0f172a" />
              {/* Totenkopf */}
              <circle cx="220" cy="40" r="9" fill="#ffffff" />
              <rect x="216" y="48" width="8" height="8" fill="#ffffff" />
              {/* Augenhöhlen */}
              <circle cx="216" cy="38" r="2.5" fill="#0f172a" />
              <circle cx="224" cy="38" r="2.5" fill="#0f172a" />
              {/* Gekreuzte Knochen */}
              <line x1="200" y1="52" x2="240" y2="68" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
              <line x1="200" y1="68" x2="240" y2="52" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
              <circle cx="200" cy="52" r="3" fill="#ffffff" />
              <circle cx="200" cy="68" r="3" fill="#ffffff" />
              <circle cx="240" cy="52" r="3" fill="#ffffff" />
              <circle cx="240" cy="68" r="3" fill="#ffffff" />
            </g>
            {/* Mast-Spitze */}
            <circle cx="178" cy="20" r="5" fill="#fbbf24" />
            {/* Bug-Verzierung */}
            <path d="M 20,155 L 35,150 L 30,165 Z" fill="#451a03" />
            <text x="200" y="155" textAnchor="middle" fontSize="14" fontWeight="900" fill="#fbbf24">★ FREIBEUTER ★</text>
          </svg>
        </div>
      </div>

      {/* Kanonenkugeln + Mündungsfeuer */}
      {CANNON_SHOTS.map((s, i) => (
        <span key={`shot-${i}`}>
          <span
            className="fx-pirate-cannon-flash"
            style={{
              left: '50vw',
              top: '55vh',
              '--d': `${s.delay}s`,
            } as React.CSSProperties}
          />
          <span
            className="fx-pirate-cannonball"
            style={{
              left: '50vw',
              top: '55vh',
              '--dx': `${s.dx}px`,
              '--dy': `${s.dy}px`,
              '--d': `${s.delay + 0.15}s`,
            } as React.CSSProperties}
          />
        </span>
      ))}

      {/* Schatzmünzen-Regen */}
      {TREASURE_COINS.map((c) => (
        <span
          key={`treas-${c.id}`}
          className="fx-pirate-coin"
          style={{
            left: `${c.x}vw`,
            '--du': `${c.duration}s`,
            '--d': `${c.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}
