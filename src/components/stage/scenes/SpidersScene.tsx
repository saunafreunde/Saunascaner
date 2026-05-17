// 2 Spinnen hängen an Fäden, leichtes Auf-Ab schwingen.

const SPIDERS = [
  { left: '15%', ropeLen: 90, delay: '-0.5s', dur: '3.5s' },
  { left: '82%', ropeLen: 130, delay: '-2.1s', dur: '4.2s' },
];

export default function SpidersScene() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 overflow-hidden"
      style={{ zIndex: 37, height: 200 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-spider-swing {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50%      { transform: translateY(8px) rotate(3deg); }
        }
        .scn-spider-rope {
          position: absolute; top: 0; width: 1px;
          background: rgba(180,180,180,0.45);
        }
        .scn-spider-body {
          position: absolute; left: 50%; transform: translateX(-50%);
          transform-origin: 50% -50px;
          animation: scn-spider-swing var(--d, 4s) ease-in-out infinite;
          animation-delay: var(--del, 0s);
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .scn-spider-body { animation: none; }
        }
      `}</style>
      {SPIDERS.map((s, i) => (
        <div key={i} style={{ position: 'absolute', left: s.left, top: 0, height: s.ropeLen + 30 }}>
          <div className="scn-spider-rope" style={{ height: s.ropeLen, left: '50%' }} />
          <div
            className="scn-spider-body"
            style={{
              top: s.ropeLen,
              '--d': s.dur,
              '--del': s.delay,
            } as React.CSSProperties}
          >
            <svg viewBox="0 0 30 30" width="26" height="26">
              {/* 8 Beine */}
              <g stroke="#1c1917" strokeWidth="1.5" fill="none" strokeLinecap="round">
                <path d="M 15 14 L 4 8" />
                <path d="M 15 14 L 2 14" />
                <path d="M 15 14 L 4 20" />
                <path d="M 15 14 L 8 25" />
                <path d="M 15 14 L 26 8" />
                <path d="M 15 14 L 28 14" />
                <path d="M 15 14 L 26 20" />
                <path d="M 15 14 L 22 25" />
              </g>
              {/* Körper */}
              <ellipse cx="15" cy="14" rx="6" ry="5" fill="#1c1917" />
              {/* Augen */}
              <circle cx="13" cy="13" r="1" fill="#fbbf24" />
              <circle cx="17" cy="13" r="1" fill="#fbbf24" />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}
