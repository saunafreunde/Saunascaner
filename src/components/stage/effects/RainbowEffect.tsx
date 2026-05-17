// Regenbogen-Bogen: 7 farbige Streifen erscheinen von links nach rechts,
// glühend, mit drift. Plus sanfter Goldregen drumherum. Dauer 10s.

const COLORS = [
  { c: '#dc2626', delay: 0.0 },
  { c: '#f97316', delay: 0.15 },
  { c: '#fbbf24', delay: 0.3 },
  { c: '#22c55e', delay: 0.45 },
  { c: '#3b82f6', delay: 0.6 },
  { c: '#6366f1', delay: 0.75 },
  { c: '#a855f7', delay: 0.9 },
];

const SPARKLES = Array.from({ length: 50 }, (_, i) => ({
  id: i,
  left: ((i * 17) % 100),
  delay: ((i * 0.12) % 3),
  dur: 2.5 + ((i * 0.13) % 2),
  size: 4 + ((i * 0.5) % 5),
  color: ['#fbbf24', '#fef3c7', '#fde047'][i % 3],
}));

export default function RainbowEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-rainbow-draw {
          0%   { stroke-dasharray: 0 2000; opacity: 0; }
          15%  { opacity: 1; }
          50%  { stroke-dasharray: 2000 0; opacity: 1; }
          90%  { opacity: 1; }
          100% { stroke-dasharray: 2000 0; opacity: 0; }
        }
        @keyframes fx-rainbow-sparkle {
          0%   { transform: translate3d(0, 0, 0) scale(0); opacity: 0; }
          25%  { transform: translate3d(0, -30vh, 0) scale(1); opacity: 1; }
          100% { transform: translate3d(0, -90vh, 0) scale(0); opacity: 0; }
        }
        .fx-rainbow-arc {
          fill: none;
          stroke-width: 28;
          stroke-linecap: round;
          will-change: stroke-dasharray, opacity;
          animation: fx-rainbow-draw 10s ease-in-out forwards;
          filter: drop-shadow(0 0 12px currentColor);
        }
        .fx-rainbow-sparkle {
          position: absolute; bottom: 0;
          border-radius: 50%;
          will-change: transform, opacity;
          animation: fx-rainbow-sparkle var(--d, 3s) ease-out infinite;
          animation-delay: var(--del, 0s);
          box-shadow: 0 0 8px currentColor;
        }
      `}</style>
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        {COLORS.map((b, i) => {
          const radius = 800 - i * 32;
          return (
            <path
              key={i}
              className="fx-rainbow-arc"
              d={`M 100,900 A ${radius},${radius} 0 0 1 1820,900`}
              style={{
                stroke: b.c,
                color: b.c,
                animationDelay: `${b.delay}s`,
              }}
            />
          );
        })}
      </svg>
      {SPARKLES.map((s) => (
        <span
          key={s.id}
          className="fx-rainbow-sparkle"
          style={{
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: s.color,
            color: s.color,
            '--d': `${s.dur}s`,
            '--del': `${s.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}
