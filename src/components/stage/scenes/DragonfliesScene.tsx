// 2 Libellen mit schnellem Flügelschlag (Memory: 0.4s ist OK).

const DRAGONFLIES = [
  { id: 0, top: '20%', left: '35%', color: '#22d3ee', dur: '13s', delay: '0s' },
  { id: 1, top: '45%', left: '70%', color: '#06b6d4', dur: '17s', delay: '-7s' },
];

export default function DragonfliesScene() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 bottom-0 overflow-hidden"
      style={{ zIndex: 38 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-dragonfly-path {
          0%   { transform: translate3d(0, 0, 0); }
          30%  { transform: translate3d(80px, -20px, 0); }
          60%  { transform: translate3d(-30px, 30px, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
        @keyframes scn-dragonfly-flap {
          0%, 100% { transform: scaleY(1); }
          50%      { transform: scaleY(0.25); }
        }
        .scn-dragonfly {
          position: absolute;
          will-change: transform;
          animation: scn-dragonfly-path var(--d, 14s) ease-in-out infinite;
          animation-delay: var(--del, 0s);
        }
        .scn-dragonfly-wings {
          animation: scn-dragonfly-flap 0.42s ease-in-out infinite;
          transform-origin: 50% 50%;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .scn-dragonfly, .scn-dragonfly-wings { animation: none; }
        }
      `}</style>
      {DRAGONFLIES.map((d) => (
        <div
          key={d.id}
          className="scn-dragonfly"
          style={{
            top: d.top,
            left: d.left,
            '--d': d.dur,
            '--del': d.delay,
          } as React.CSSProperties}
        >
          <svg viewBox="0 0 30 14" width="30" height="14">
            {/* Körper */}
            <rect x="13" y="6" width="14" height="2" rx="1" fill={d.color} />
            {/* Kopf */}
            <circle cx="13" cy="7" r="2" fill="#1c1917" />
            {/* Flügel (animiert) */}
            <g className="scn-dragonfly-wings">
              <ellipse cx="18" cy="3"  rx="6" ry="2.5" fill={d.color} opacity="0.5" />
              <ellipse cx="18" cy="11" rx="6" ry="2.5" fill={d.color} opacity="0.5" />
              <ellipse cx="24" cy="3"  rx="5" ry="2"   fill={d.color} opacity="0.4" />
              <ellipse cx="24" cy="11" rx="5" ry="2"   fill={d.color} opacity="0.4" />
            </g>
          </svg>
        </div>
      ))}
    </div>
  );
}
