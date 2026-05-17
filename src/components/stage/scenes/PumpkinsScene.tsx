// 4 Kürbisse mit Schnitzgesicht am Wiesenrand, leichtes inneres Glimmen.

const PUMPKINS = [
  { left: '10%', scale: 1.0, delay: '-0.4s' },
  { left: '30%', scale: 0.85, delay: '-1.2s' },
  { left: '70%', scale: 0.9, delay: '-0.8s' },
  { left: '88%', scale: 1.1, delay: '-1.6s' },
];

export default function PumpkinsScene() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-2 overflow-hidden"
      style={{ zIndex: 32, height: 70 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-pumpkin-glow {
          0%, 100% { filter: drop-shadow(0 0 3px #f97316); }
          50%      { filter: drop-shadow(0 0 10px #fb923c); }
        }
        .scn-pumpkin {
          position: absolute; bottom: 4px;
          transform: translateX(-50%) scale(var(--s, 1));
          transform-origin: 50% 100%;
          animation: scn-pumpkin-glow 2.8s ease-in-out infinite;
          animation-delay: var(--d, 0s);
          will-change: filter;
        }
        @media (prefers-reduced-motion: reduce) {
          .scn-pumpkin { animation: none; }
        }
      `}</style>
      {PUMPKINS.map((p, i) => (
        <div
          key={i}
          className="scn-pumpkin"
          style={{ left: p.left, '--s': p.scale, '--d': p.delay } as React.CSSProperties}
        >
          <svg viewBox="0 0 60 50" width="50" height="42">
            {/* Stiel */}
            <rect x="27" y="2" width="6" height="8" fill="#15803d" />
            {/* Kürbis-Körper (4 Lappen) */}
            <ellipse cx="14" cy="30" rx="10" ry="18" fill="#c2410c" />
            <ellipse cx="46" cy="30" rx="10" ry="18" fill="#c2410c" />
            <ellipse cx="22" cy="30" rx="11" ry="20" fill="#ea580c" />
            <ellipse cx="38" cy="30" rx="11" ry="20" fill="#ea580c" />
            <ellipse cx="30" cy="30" rx="13" ry="22" fill="#f97316" />
            {/* Gesicht */}
            <polygon points="22,26 26,21 30,26" fill="#1c1917" />
            <polygon points="30,26 34,21 38,26" fill="#1c1917" />
            <polygon points="20,40 24,36 28,40 32,36 36,40 40,36 44,40 44,44 20,44" fill="#1c1917" />
          </svg>
        </div>
      ))}
    </div>
  );
}
