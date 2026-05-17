// 3 Schmetterlinge flattern in der Luft, sanftes Auf-Ab + Flügelschlag.
// Memory: Flügelschlag 0.4-0.6s (langsamer = nicht hektisch).

const BUTTERFLIES = [
  { id: 0, top: '15%', left: '20%', color: '#ec4899', dur: '14s', delay: '0s'   },
  { id: 1, top: '35%', left: '60%', color: '#a855f7', dur: '18s', delay: '-5s'  },
  { id: 2, top: '25%', left: '85%', color: '#fbbf24', dur: '16s', delay: '-9s'  },
];

export default function ButterfliesScene() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 bottom-0 overflow-hidden"
      style={{ zIndex: 39 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-butterfly-path {
          0%   { transform: translate3d(0, 0, 0); }
          25%  { transform: translate3d(60px, -30px, 0); }
          50%  { transform: translate3d(20px, 20px, 0); }
          75%  { transform: translate3d(-40px, -15px, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
        @keyframes scn-butterfly-flap {
          0%, 100% { transform: scaleX(1); }
          50%      { transform: scaleX(0.3); }
        }
        .scn-butterfly {
          position: absolute;
          will-change: transform;
          animation: scn-butterfly-path var(--d, 15s) ease-in-out infinite;
          animation-delay: var(--del, 0s);
        }
        .scn-butterfly-body {
          animation: scn-butterfly-flap 0.55s ease-in-out infinite;
          transform-origin: 50% 50%;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .scn-butterfly, .scn-butterfly-body { animation: none; }
        }
      `}</style>
      {BUTTERFLIES.map((b) => (
        <div
          key={b.id}
          className="scn-butterfly"
          style={{
            top: b.top,
            left: b.left,
            '--d': b.dur,
            '--del': b.delay,
          } as React.CSSProperties}
        >
          <svg viewBox="0 0 24 18" width="24" height="18" className="scn-butterfly-body">
            {/* Flügel oben */}
            <ellipse cx="6"  cy="6" rx="5" ry="5" fill={b.color} opacity="0.85" />
            <ellipse cx="18" cy="6" rx="5" ry="5" fill={b.color} opacity="0.85" />
            {/* Flügel unten */}
            <ellipse cx="7"  cy="13" rx="4" ry="3.5" fill={b.color} opacity="0.7" />
            <ellipse cx="17" cy="13" rx="4" ry="3.5" fill={b.color} opacity="0.7" />
            {/* Körper */}
            <ellipse cx="12" cy="9" rx="0.8" ry="6" fill="#1c1917" />
          </svg>
        </div>
      ))}
    </div>
  );
}
