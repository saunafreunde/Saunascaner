// Silvester-/Fasching-Funken: 20 leuchtende Punkte rufen am Boden auf
// und schwächen aus, mit Drift nach oben.

const SPARKS = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: ((i * 41) % 100),
  delay: -((i * 0.31) % 3),
  dur: 3 + ((i * 0.7) % 2.5),
  size: 4 + ((i * 1.3) % 3),
  color: ['#fde047', '#f97316', '#ec4899', '#22d3ee', '#a855f7'][i % 5],
}));

export default function SparklesScene() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 overflow-hidden"
      style={{ zIndex: 33, height: 220 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-sparkle-rise {
          0%   { transform: translate3d(0, 0, 0) scale(0.2); opacity: 0; }
          20%  { transform: translate3d(0, -40px, 0) scale(1); opacity: 1; }
          80%  { transform: translate3d(0, -160px, 0) scale(0.6); opacity: 0.8; }
          100% { transform: translate3d(0, -220px, 0) scale(0); opacity: 0; }
        }
        .scn-sparkle {
          position: absolute; bottom: 0;
          border-radius: 50%;
          will-change: transform, opacity;
          animation: scn-sparkle-rise var(--d, 4s) ease-out infinite;
          animation-delay: var(--del, 0s);
          box-shadow: 0 0 6px currentColor;
        }
        @media (prefers-reduced-motion: reduce) {
          .scn-sparkle { animation: none; opacity: 0.6; }
        }
      `}</style>
      {SPARKS.map((s) => (
        <span
          key={s.id}
          className="scn-sparkle"
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
    </div>
  );
}
