// 6 bunte Ostereier am Wiesenrand, sanftes Wiegen-Rocking.

const EGGS = [
  { left: '8%',  color: '#fbbf24', pattern: 'dots',   delay: '-0.3s' },
  { left: '20%', color: '#ec4899', pattern: 'stripes',delay: '-0.9s' },
  { left: '35%', color: '#22d3ee', pattern: 'dots',   delay: '-1.4s' },
  { left: '64%', color: '#a855f7', pattern: 'stripes',delay: '-0.6s' },
  { left: '78%', color: '#22c55e', pattern: 'dots',   delay: '-1.8s' },
  { left: '92%', color: '#f97316', pattern: 'stripes',delay: '-1.1s' },
];

export default function EasterEggsScene() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-2 overflow-hidden"
      style={{ zIndex: 32, height: 50 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-egg-rock {
          0%, 100% { transform: translateX(-50%) rotate(-3deg); }
          50%      { transform: translateX(-50%) rotate(3deg); }
        }
        .scn-egg {
          position: absolute; bottom: 4px;
          transform-origin: 50% 100%;
          animation: scn-egg-rock 3.2s ease-in-out infinite;
          animation-delay: var(--d, 0s);
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .scn-egg { animation: none; transform: translateX(-50%); }
        }
      `}</style>
      {EGGS.map((e, i) => (
        <div
          key={i}
          className="scn-egg"
          style={{ left: e.left, '--d': e.delay } as React.CSSProperties}
        >
          <svg viewBox="0 0 30 40" width="22" height="30">
            <ellipse cx="15" cy="22" rx="13" ry="17" fill={e.color} />
            {e.pattern === 'dots' && (
              <>
                <circle cx="10" cy="15" r="2" fill="rgba(255,255,255,0.7)" />
                <circle cx="20" cy="18" r="2" fill="rgba(255,255,255,0.7)" />
                <circle cx="13" cy="25" r="2" fill="rgba(255,255,255,0.7)" />
                <circle cx="18" cy="30" r="2" fill="rgba(255,255,255,0.7)" />
              </>
            )}
            {e.pattern === 'stripes' && (
              <>
                <path d="M 3 18 Q 15 14 27 18" stroke="rgba(255,255,255,0.7)" strokeWidth="2" fill="none" />
                <path d="M 3 26 Q 15 22 27 26" stroke="rgba(255,255,255,0.7)" strokeWidth="2" fill="none" />
              </>
            )}
          </svg>
        </div>
      ))}
    </div>
  );
}
