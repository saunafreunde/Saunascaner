// 15 Fledermäuse fliegen wirr durch die Szene. One-shot, 6s.

const SWARM = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  startTop: 20 + ((i * 7) % 60),
  startLeft: -10 - ((i * 3) % 30),
  endTop: ((i * 11) % 70),
  endLeft: 110 + ((i * 5) % 30),
  delay: ((i * 0.2) % 1.2),
  dur: 4 + ((i * 0.3) % 2),
  flapDelay: -((i * 0.07) % 0.5),
}));

export default function BatSwarmEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-swarm-cross {
          0%   { transform: translate3d(0, 0, 0); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translate3d(var(--dx, 100vw), var(--dy, 0), 0); opacity: 0; }
        }
        @keyframes fx-swarm-flap {
          0%, 100% { transform: scaleY(1); }
          50%      { transform: scaleY(0.45); }
        }
        .fx-swarm-bat {
          position: absolute;
          will-change: transform, opacity;
          animation: fx-swarm-cross var(--d, 5s) ease-in-out forwards;
          animation-delay: var(--del, 0s);
        }
        .fx-swarm-body {
          animation: fx-swarm-flap 0.4s ease-in-out infinite;
          animation-delay: var(--fd, 0s);
          transform-origin: 50% 50%;
        }
      `}</style>
      {SWARM.map((b) => {
        const dx = b.endLeft - b.startLeft;
        const dy = b.endTop - b.startTop;
        return (
          <div
            key={b.id}
            className="fx-swarm-bat"
            style={{
              top: `${b.startTop}%`,
              left: `${b.startLeft}%`,
              '--dx': `${dx}vw`,
              '--dy': `${dy}vh`,
              '--d': `${b.dur}s`,
              '--del': `${b.delay}s`,
            } as React.CSSProperties}
          >
            <svg
              viewBox="0 0 40 20"
              width="36"
              height="18"
              className="fx-swarm-body"
              style={{ '--fd': `${b.flapDelay}s` } as React.CSSProperties}
            >
              <path
                d="M 20 10 L 18 12 L 12 8 L 4 12 L 8 6 L 4 4 L 14 6 L 18 4 L 22 4 L 26 6 L 36 4 L 32 6 L 36 12 L 28 8 L 22 12 Z"
                fill="#1c1917"
              />
            </svg>
          </div>
        );
      })}
    </>
  );
}
