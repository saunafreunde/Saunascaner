// EPISCHES Feuerwerk: 15 Raketen in Wellen, je 32 Partikel pro Burst,
// Bloom-Glow via drop-shadow + mix-blend-mode: screen für additive Lichter.
// Plus Screen-Flash beim Burst-Peak. Dauer 15s.

const ROCKETS = Array.from({ length: 15 }, (_, i) => {
  const colors = ['#ef4444', '#fbbf24', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#f59e0b', '#22d3ee'];
  return {
    id: i,
    left: 5 + (i * 6.3) % 90,
    delay: (i * 0.7) % 12,
    peak: 50 + ((i * 7) % 30),
    color: colors[i % colors.length],
  };
});

const PARTICLES_PER_BURST = 32;

export default function FireworksEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-fw-rise {
          0%   { transform: translate3d(0, 0, 0) scale(1); opacity: 0; }
          5%   { opacity: 1; }
          85%  { transform: translate3d(0, calc(-1 * var(--peak, 60vh)), 0) scale(1); opacity: 1; }
          100% { transform: translate3d(0, calc(-1 * var(--peak, 60vh)), 0) scale(0); opacity: 0; }
        }
        @keyframes fx-fw-burst {
          0%   { transform: translate3d(0, 0, 0) scale(0.3); opacity: 0; }
          8%   { transform: translate3d(var(--bx), var(--by), 0) scale(1.4); opacity: 1; }
          45%  { transform: translate3d(calc(var(--bx) * 2.8), calc(var(--by) * 2.8 + 30px), 0) scale(1); opacity: 1; }
          100% { transform: translate3d(calc(var(--bx) * 3.5), calc(var(--by) * 3.5 + 200px), 0) scale(0.2); opacity: 0; }
        }
        @keyframes fx-fw-screen-flash {
          0%, 100% { opacity: 0; }
          50%      { opacity: 0.18; }
        }
        @keyframes fx-fw-burst-flash {
          0%, 100% { opacity: 0; transform: translate3d(0, 0, 0) scale(0.2); }
          15%      { opacity: 0.9; transform: translate3d(0, 0, 0) scale(1); }
          50%      { opacity: 0.3; transform: translate3d(0, 0, 0) scale(2.5); }
          100%     { opacity: 0; transform: translate3d(0, 0, 0) scale(3); }
        }
        .fx-fw-rocket-wrap { position: absolute; bottom: 60px; }
        .fx-fw-rocket {
          width: 5px; height: 18px;
          border-radius: 50%;
          background: var(--c, #fff);
          will-change: transform, opacity;
          animation: fx-fw-rise 2.2s ease-out forwards;
          animation-delay: var(--del, 0s);
          opacity: 0;
          filter: drop-shadow(0 0 8px var(--c, #fff));
        }
        .fx-fw-burst-wrap {
          position: absolute;
          opacity: 0;
          animation: fx-fw-burst-show 0s linear forwards;
          animation-delay: calc(var(--del, 0s) + 2.1s);
          mix-blend-mode: screen;
        }
        @keyframes fx-fw-burst-show { to { opacity: 1; } }
        .fx-fw-particle {
          position: absolute;
          width: 10px; height: 10px;
          border-radius: 50%;
          background: var(--c, #fff);
          will-change: transform, opacity;
          animation: fx-fw-burst 2.8s ease-out forwards;
          filter: drop-shadow(0 0 12px var(--c, #fff)) drop-shadow(0 0 24px var(--c, #fff));
        }
        .fx-fw-burst-flash {
          position: absolute;
          width: 120px; height: 120px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--c, #fff) 0%, transparent 70%);
          left: -60px; top: -60px;
          animation: fx-fw-burst-flash 0.8s ease-out forwards;
          mix-blend-mode: screen;
          will-change: transform, opacity;
        }
        .fx-fw-screen {
          position: absolute; inset: 0;
          background: white;
          animation: fx-fw-screen-flash 15s ease-in-out forwards;
          mix-blend-mode: screen;
          pointer-events: none;
        }
      `}</style>
      <div className="fx-fw-screen" />
      {ROCKETS.map((r) => (
        <div key={r.id} className="fx-fw-rocket-wrap" style={{ left: `${r.left}%` }}>
          <div
            className="fx-fw-rocket"
            style={{ '--c': r.color, '--del': `${r.delay}s`, '--peak': `${r.peak}vh` } as React.CSSProperties}
          />
          <div
            className="fx-fw-burst-wrap"
            style={{ top: `-${r.peak}vh`, left: 0, '--del': `${r.delay}s` } as React.CSSProperties}
          >
            <div className="fx-fw-burst-flash" style={{ '--c': r.color, animationDelay: `${r.delay + 2.1}s` } as React.CSSProperties} />
            {Array.from({ length: PARTICLES_PER_BURST }).map((_, pi) => {
              const angle = (pi / PARTICLES_PER_BURST) * Math.PI * 2;
              const radius = 60 + (pi % 3) * 15;
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
                    animationDelay: `${r.delay + 2.1 + (pi % 4) * 0.05}s`,
                  } as React.CSSProperties}
                />
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
