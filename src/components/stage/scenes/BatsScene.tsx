// 5 Fledermäuse fliegen langsam horizontal in verschiedenen Höhen,
// flap-flap mit den Flügeln.

const BATS = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  top: 20 + ((i * 23) % 60),
  delay: -((i * 7) % 24),
  dur: 22 + ((i * 4) % 8),
  flapDelay: -((i * 0.21) % 0.6),
  direction: i % 2 === 0 ? 1 : -1,
}));

export default function BatsScene() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 bottom-0 overflow-hidden"
      style={{ zIndex: 38 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-bat-fly-r {
          0%   { transform: translate3d(-120px, 0, 0); }
          100% { transform: translate3d(calc(100vw + 120px), 0, 0); }
        }
        @keyframes scn-bat-fly-l {
          0%   { transform: translate3d(calc(100vw + 120px), 0, 0); }
          100% { transform: translate3d(-120px, 0, 0); }
        }
        @keyframes scn-bat-flap {
          0%, 100% { transform: scaleY(1); }
          50%      { transform: scaleY(0.55); }
        }
        .scn-bat-wrap {
          position: absolute; will-change: transform;
        }
        .scn-bat-wrap.dir-r { animation: scn-bat-fly-r var(--d, 24s) linear infinite; animation-delay: var(--del, 0s); }
        .scn-bat-wrap.dir-l { animation: scn-bat-fly-l var(--d, 24s) linear infinite; animation-delay: var(--del, 0s); }
        .scn-bat-body { animation: scn-bat-flap 0.5s ease-in-out infinite; animation-delay: var(--fd, 0s); transform-origin: 50% 50%; will-change: transform; }
        @media (prefers-reduced-motion: reduce) {
          .scn-bat-wrap, .scn-bat-body { animation: none; }
        }
      `}</style>
      {BATS.map((b) => (
        <div
          key={b.id}
          className={`scn-bat-wrap ${b.direction > 0 ? 'dir-r' : 'dir-l'}`}
          style={{
            top: `${b.top}%`,
            '--d': `${b.dur}s`,
            '--del': `${b.delay}s`,
          } as React.CSSProperties}
        >
          <svg
            viewBox="0 0 40 20"
            width="40"
            height="20"
            className="scn-bat-body"
            style={{ '--fd': `${b.flapDelay}s` } as React.CSSProperties}
          >
            <path
              d="M 20 10 L 18 12 L 12 8 L 4 12 L 8 6 L 4 4 L 14 6 L 18 4 L 22 4 L 26 6 L 36 4 L 32 6 L 36 12 L 28 8 L 22 12 Z"
              fill="#1c1917"
            />
          </svg>
        </div>
      ))}
    </div>
  );
}
