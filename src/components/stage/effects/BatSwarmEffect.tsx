// EPISCHER Fledermaus-Schwarm: 40 Bats in verschiedenen Größen, glühende
// rote Augen, schnelle Flügelschläge, dunkler lila Screen-Schimmer für
// Halloween-Stimmung. Dauer 8s.

const SWARM = Array.from({ length: 40 }, (_, i) => {
  const sizeBase = 28 + ((i * 5) % 40);
  return {
    id: i,
    startTop: 5 + ((i * 7.3) % 80),
    startLeft: -15 - ((i * 4) % 50),
    endTop: ((i * 11) % 80),
    endLeft: 115 + ((i * 6) % 40),
    delay: ((i * 0.15) % 2.5),
    dur: 5 + ((i * 0.4) % 3),
    flapDelay: -((i * 0.08) % 0.4),
    size: sizeBase,
  };
});

export default function BatSwarmEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-swarm-screen {
          0%, 100% { opacity: 0; }
          15%, 85% { opacity: 0.35; }
        }
        @keyframes fx-swarm-cross {
          0%   { transform: translate3d(0, 0, 0) rotate(-3deg); opacity: 0; }
          12%  { opacity: 1; }
          50%  { transform: translate3d(calc(var(--dx, 100vw) * 0.5), calc(var(--dy, 0) * 0.5 - 30px), 0) rotate(2deg); }
          88%  { opacity: 1; }
          100% { transform: translate3d(var(--dx, 100vw), var(--dy, 0), 0) rotate(-2deg); opacity: 0; }
        }
        @keyframes fx-swarm-flap {
          0%, 100% { transform: scaleY(1) scaleX(1); }
          50%      { transform: scaleY(0.35) scaleX(1.05); }
        }
        @keyframes fx-swarm-eye-glow {
          0%, 100% { filter: drop-shadow(0 0 3px #dc2626); }
          50%      { filter: drop-shadow(0 0 10px #dc2626) drop-shadow(0 0 18px #dc2626); }
        }
        .fx-swarm-screen {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at center, transparent 0%, rgba(76,29,149,0.25) 60%, rgba(31,0,50,0.4) 100%);
          animation: fx-swarm-screen 8s ease-in-out forwards;
          pointer-events: none;
        }
        .fx-swarm-bat {
          position: absolute;
          will-change: transform, opacity;
          animation: fx-swarm-cross var(--d, 5s) ease-in-out forwards;
          animation-delay: var(--del, 0s);
        }
        .fx-swarm-body {
          animation: fx-swarm-flap 0.3s ease-in-out infinite;
          animation-delay: var(--fd, 0s);
          transform-origin: 50% 50%;
          will-change: transform;
        }
        .fx-swarm-eye {
          animation: fx-swarm-eye-glow 1.2s ease-in-out infinite;
        }
      `}</style>
      <div className="fx-swarm-screen" />
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
              viewBox="0 0 50 26"
              width={b.size}
              height={b.size * 0.52}
              className="fx-swarm-body"
              style={{ '--fd': `${b.flapDelay}s` } as React.CSSProperties}
            >
              {/* Flügel mit ausgefranster Bottom-Kante */}
              <path
                d="M 25 13 L 22 16 L 14 10 L 4 14 L 9 7 L 4 4 L 16 7 L 22 4 L 28 4 L 34 7 L 46 4 L 41 7 L 46 14 L 36 10 L 28 16 Z"
                fill="#0a0a0a"
              />
              {/* Körper */}
              <ellipse cx="25" cy="13" rx="3" ry="5" fill="#1c1917" />
              {/* Augen (rot, glühend) */}
              <g className="fx-swarm-eye">
                <circle cx="23.5" cy="11" r="1" fill="#dc2626" />
                <circle cx="26.5" cy="11" r="1" fill="#dc2626" />
              </g>
            </svg>
          </div>
        );
      })}
    </>
  );
}
