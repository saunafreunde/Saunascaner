// Schneesturm: massiv-dichter Schnee (400 Flocken) mit Wind-Streifen
// und kurzem hellem Flash. Dauer 7s.

const FLAKES = Array.from({ length: 400 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280;
  const left = (seed / 233280) * 100;
  return {
    id: i,
    left,
    delay: -((i * 0.13) % 4),
    dur: 1.5 + ((i * 0.07) % 2.5),
    size: 3 + ((i * 0.5) % 10),
    drift: ((i * 5.7) % 80) - 60,
  };
});

const WIND_STREAKS = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  top: ((i * 17) % 80) + 5,
  delay: ((i * 0.21) % 2),
  dur: 1 + ((i * 0.11) % 1.5),
}));

export default function SnowstormEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-snowstorm-flash {
          0%, 100% { opacity: 0; }
          10%, 20% { opacity: 0.3; }
          50%      { opacity: 0.15; }
        }
        @keyframes fx-snowstorm-fall {
          0%   { transform: translate3d(0, -10vh, 0); opacity: 0; }
          10%  { opacity: 0.9; }
          90%  { opacity: 0.9; }
          100% { transform: translate3d(var(--drift, 0px), 110vh, 0); opacity: 0; }
        }
        @keyframes fx-wind-streak {
          0%   { transform: translate3d(-200px, 0, 0) scaleX(0.5); opacity: 0; }
          20%  { opacity: 0.7; transform: translate3d(50vw, 0, 0) scaleX(1.2); }
          100% { transform: translate3d(110vw, 0, 0) scaleX(0.5); opacity: 0; }
        }
        .fx-snowstorm-flash {
          position: absolute; inset: 0;
          background: white;
          animation: fx-snowstorm-flash 7s ease-in-out forwards;
          mix-blend-mode: screen;
          pointer-events: none;
        }
        .fx-snowstorm-flake {
          position: absolute; top: 0;
          background: radial-gradient(circle, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.5) 60%, transparent 100%);
          border-radius: 50%;
          will-change: transform, opacity;
          animation: fx-snowstorm-fall var(--dur) linear infinite;
          animation-delay: var(--delay);
          filter: drop-shadow(0 0 2px white);
        }
        .fx-wind-streak {
          position: absolute;
          height: 2px;
          width: 80px;
          background: linear-gradient(to right, transparent, rgba(255,255,255,0.7), transparent);
          will-change: transform, opacity;
          animation: fx-wind-streak var(--d, 1.5s) ease-out infinite;
          animation-delay: var(--del, 0s);
        }
      `}</style>
      <div className="fx-snowstorm-flash" />
      {FLAKES.map((f) => (
        <span
          key={f.id}
          className="fx-snowstorm-flake"
          style={{
            left: `${f.left}%`,
            width: `${f.size}px`,
            height: `${f.size}px`,
            '--delay': `${f.delay}s`,
            '--dur': `${f.dur}s`,
            '--drift': `${f.drift}px`,
          } as React.CSSProperties}
        />
      ))}
      {WIND_STREAKS.map((w) => (
        <div
          key={w.id}
          className="fx-wind-streak"
          style={{
            top: `${w.top}%`,
            '--d': `${w.dur}s`,
            '--del': `${w.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}
