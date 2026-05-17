// 2 schwebende Geister, sanftes Auf-Ab + opacity-pulse.

const GHOSTS = [
  { left: '25%', delay: '0s', dur: '7s' },
  { left: '75%', delay: '-3s', dur: '8s' },
];

export default function GhostsScene() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-2 overflow-hidden"
      style={{ zIndex: 36, height: 200 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-ghost-float {
          0%, 100% { transform: translate3d(0, 0, 0); opacity: 0.55; }
          50%      { transform: translate3d(8px, -30px, 0); opacity: 0.85; }
        }
        .scn-ghost {
          position: absolute; bottom: 60px;
          transform: translateX(-50%);
          will-change: transform, opacity;
          animation: scn-ghost-float var(--d, 7s) ease-in-out infinite;
          animation-delay: var(--del, 0s);
        }
        @media (prefers-reduced-motion: reduce) {
          .scn-ghost { animation: none; opacity: 0.7; }
        }
      `}</style>
      {GHOSTS.map((g, i) => (
        <div
          key={i}
          className="scn-ghost"
          style={{ left: g.left, '--d': g.dur, '--del': g.delay } as React.CSSProperties}
        >
          <svg viewBox="0 0 60 80" width="50" height="68">
            {/* Geist-Körper */}
            <path
              d="M 8 60 Q 8 20 30 20 Q 52 20 52 60 L 52 72 L 46 66 L 40 72 L 34 66 L 28 72 L 22 66 L 16 72 L 8 66 Z"
              fill="rgba(255,255,255,0.85)"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1"
            />
            {/* Augen */}
            <ellipse cx="22" cy="42" rx="3" ry="5" fill="#1c1917" />
            <ellipse cx="38" cy="42" rx="3" ry="5" fill="#1c1917" />
            {/* Mund */}
            <ellipse cx="30" cy="54" rx="3" ry="4" fill="#1c1917" />
          </svg>
        </div>
      ))}
    </div>
  );
}
