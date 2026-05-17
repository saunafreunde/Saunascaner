// Tannenbaum mit Stern + Kugeln am rechten Rand der Tafel.
// Stern pulsiert, Kugeln glühen leicht.

const BAUBLES = [
  { x: '38%', y: '40%', color: '#dc2626', delay: '-0.6s' },
  { x: '62%', y: '52%', color: '#fbbf24', delay: '-1.4s' },
  { x: '45%', y: '65%', color: '#3b82f6', delay: '-2.1s' },
  { x: '58%', y: '78%', color: '#ec4899', delay: '-0.9s' },
  { x: '52%', y: '88%', color: '#a855f7', delay: '-1.7s' },
];

export default function XmasTreeScene() {
  return (
    <div
      className="pointer-events-none fixed bottom-2 overflow-hidden"
      style={{ zIndex: 31, right: '4%', width: 110, height: 180 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-tree-star-pulse {
          0%, 100% { transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 4px #fde047); }
          50%      { transform: scale(1.18) rotate(8deg); filter: drop-shadow(0 0 14px #fde047); }
        }
        @keyframes scn-tree-bauble-glow {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50%      { transform: scale(1.15); opacity: 1; }
        }
        .scn-tree-star { animation: scn-tree-star-pulse 2.4s ease-in-out infinite; will-change: transform, filter; transform-origin: 55px 8px; }
        .scn-tree-bauble {
          position: absolute; width: 8px; height: 8px; border-radius: 50%;
          will-change: transform, opacity;
          animation: scn-tree-bauble-glow 2.6s ease-in-out infinite;
          animation-delay: var(--d, 0s);
        }
        @media (prefers-reduced-motion: reduce) {
          .scn-tree-star, .scn-tree-bauble { animation: none; }
        }
      `}</style>
      <svg viewBox="0 0 110 180" width="110" height="180" style={{ position: 'absolute', left: 0, top: 0 }}>
        {/* Tannenbaum (3 Dreiecke + Stamm) */}
        <polygon points="55,15 30,75 80,75" fill="#15803d" />
        <polygon points="55,55 22,110 88,110" fill="#166534" />
        <polygon points="55,90 16,150 94,150" fill="#14532d" />
        <rect x="48" y="150" width="14" height="18" fill="#7c2d12" />
        {/* Stern */}
        <g className="scn-tree-star">
          <polygon points="55,2 58,11 67,11 60,17 63,26 55,21 47,26 50,17 43,11 52,11" fill="#fde047" />
        </g>
      </svg>
      {BAUBLES.map((b, i) => (
        <span
          key={i}
          className="scn-tree-bauble"
          style={{
            left: b.x,
            top: b.y,
            background: b.color,
            '--d': b.delay,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
