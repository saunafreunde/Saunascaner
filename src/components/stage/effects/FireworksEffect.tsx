// 5 Raketen steigen, explodieren an verschiedenen Positionen, 10s gesamt.
// Pure-CSS One-shot (iteration-count: 1).

const ROCKETS = [
  { left: '15%', delay: 0,   color: '#ef4444' },
  { left: '35%', delay: 1.5, color: '#fbbf24' },
  { left: '55%', delay: 3.0, color: '#22c55e' },
  { left: '75%', delay: 4.5, color: '#3b82f6' },
  { left: '85%', delay: 6.0, color: '#a855f7' },
];

const PARTICLE_COUNT = 16;

export default function FireworksEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-fw-rise {
          0%   { transform: translate3d(0, 0, 0); opacity: 1; }
          90%  { transform: translate3d(0, calc(-1 * var(--peak, 60vh)), 0); opacity: 1; }
          100% { transform: translate3d(0, calc(-1 * var(--peak, 60vh)), 0); opacity: 0; }
        }
        @keyframes fx-fw-burst {
          0%   { transform: translate3d(0, 0, 0) scale(0.5); opacity: 0; }
          10%  { transform: translate3d(var(--bx, 0), var(--by, 0), 0) scale(1); opacity: 1; }
          80%  { transform: translate3d(calc(var(--bx, 0) * 2.5), calc(var(--by, 0) * 2.5 + 60px), 0) scale(1); opacity: 1; }
          100% { transform: translate3d(calc(var(--bx, 0) * 2.5), calc(var(--by, 0) * 2.5 + 100px), 0) scale(0); opacity: 0; }
        }
        .fx-fw-rocket-wrap {
          position: absolute; bottom: 60px;
        }
        .fx-fw-rocket {
          width: 4px; height: 14px; border-radius: 50%;
          background: var(--c, #fff);
          box-shadow: 0 0 8px var(--c, #fff);
          will-change: transform, opacity;
          animation: fx-fw-rise 1.8s ease-out forwards;
          animation-delay: var(--del, 0s);
          opacity: 0;
        }
        .fx-fw-burst-wrap {
          position: absolute;
          opacity: 0;
          animation: fx-fw-burst-show 0s linear forwards;
          animation-delay: calc(var(--del, 0s) + 1.7s);
        }
        @keyframes fx-fw-burst-show { to { opacity: 1; } }
        .fx-fw-particle {
          position: absolute;
          width: 5px; height: 5px;
          border-radius: 50%;
          background: var(--c, #fff);
          box-shadow: 0 0 6px var(--c, #fff);
          will-change: transform, opacity;
          animation: fx-fw-burst 2.2s ease-out forwards;
        }
      `}</style>
      {ROCKETS.map((r, ri) => {
        const peak = 50 + ((ri * 7) % 25);
        return (
          <div key={ri} className="fx-fw-rocket-wrap" style={{ left: r.left }}>
            <div
              className="fx-fw-rocket"
              style={{
                '--c': r.color,
                '--del': `${r.delay}s`,
                '--peak': `${peak}vh`,
              } as React.CSSProperties}
            />
            <div
              className="fx-fw-burst-wrap"
              style={{
                top: `-${peak}vh`,
                left: 0,
                '--del': `${r.delay}s`,
              } as React.CSSProperties}
            >
              {Array.from({ length: PARTICLE_COUNT }).map((_, pi) => {
                const angle = (pi / PARTICLE_COUNT) * Math.PI * 2;
                const radius = 40;
                const bx = Math.cos(angle) * radius;
                const by = Math.sin(angle) * radius;
                return (
                  <span
                    key={pi}
                    className="fx-fw-particle"
                    style={{
                      '--c': r.color,
                      '--bx': `${bx}px`,
                      '--by': `${by}px`,
                    } as React.CSSProperties}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
