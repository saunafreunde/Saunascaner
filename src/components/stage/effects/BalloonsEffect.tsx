// EPISCHE Luftballons: 35 in verschiedenen Größen, sanftes Schwanken,
// Highlights für Tiefe, Schnüre die wehen. Dauer 10s.

const BALLOONS = Array.from({ length: 35 }, (_, i) => ({
  id: i,
  left: ((i * 13) % 95) + 2,
  delay: ((i * 0.18) % 3),
  dur: 7 + ((i * 0.4) % 4),
  size: 45 + ((i * 4) % 35),
  drift: ((i * 5.7) % 80) - 40,
  swayDelay: -((i * 0.5) % 3),
  color: ['#ef4444', '#fbbf24', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#06b6d4'][i % 8],
}));

export default function BalloonsEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-balloon-rise {
          0%   { transform: translate3d(0, 20vh, 0); opacity: 0; }
          6%   { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translate3d(var(--drift, 0px), -130vh, 0); opacity: 0; }
        }
        @keyframes fx-balloon-sway {
          0%, 100% { transform: rotate(-3deg); }
          50%      { transform: rotate(3deg); }
        }
        .fx-balloon-wrap {
          position: absolute; bottom: 0;
          will-change: transform, opacity;
          animation: fx-balloon-rise var(--d, 8s) linear forwards;
          animation-delay: var(--del, 0s);
        }
        .fx-balloon-sway {
          animation: fx-balloon-sway 2.5s ease-in-out infinite;
          animation-delay: var(--sd, 0s);
          transform-origin: 50% 100%;
          filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));
        }
      `}</style>
      {BALLOONS.map((b) => (
        <div
          key={b.id}
          className="fx-balloon-wrap"
          style={{
            left: `${b.left}%`,
            '--d': `${b.dur}s`,
            '--del': `${b.delay}s`,
            '--drift': `${b.drift}px`,
          } as React.CSSProperties}
        >
          <div className="fx-balloon-sway" style={{ '--sd': `${b.swayDelay}s` } as React.CSSProperties}>
            <svg viewBox="0 0 60 90" width={b.size} height={b.size * 1.5}>
              {/* Ballon-Hauptkörper */}
              <ellipse cx="30" cy="30" rx="24" ry="30" fill={b.color} />
              {/* Schatten unten */}
              <ellipse cx="30" cy="35" rx="22" ry="25" fill={b.color} opacity="0.7" />
              {/* Highlight */}
              <ellipse cx="22" cy="20" rx="6" ry="10" fill="rgba(255,255,255,0.55)" />
              <ellipse cx="20" cy="18" rx="3" ry="5" fill="rgba(255,255,255,0.85)" />
              {/* Knoten */}
              <polygon points="26,58 34,58 30,64" fill={b.color} />
              {/* Schnur — gewellt */}
              <path
                d="M 30 64 Q 28 70 32 76 Q 28 82 30 90"
                stroke="rgba(0,0,0,0.4)"
                strokeWidth="1"
                fill="none"
              />
            </svg>
          </div>
        </div>
      ))}
    </>
  );
}
