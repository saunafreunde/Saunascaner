// Meteor-Schauer — 18 Meteore stürzen diagonal mit Glow-Trail + Impact-Explosionen. 9s.

const METEORS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  delay: i * 0.4,
  startX: 30 + (i * 4),
  endX: 5 + (i * 4) - 25,
  size: 14 + (i % 4) * 6,
  duration: 1.4 + (i % 3) * 0.3,
}));

const IMPACTS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  delay: 1.4 + i * 0.4,
  x: 5 + (i * 4) - 25,
  y: 85 + (i % 3) * 4,
}));

export default function MeteorShowerEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-meteor-fall {
          0%   { transform: translate3d(0, 0, 0) rotate(35deg); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translate3d(-30vw, 70vh, 0) rotate(35deg); opacity: 0.7; }
        }
        @keyframes fx-meteor-impact {
          0%   { transform: scale(0); opacity: 0; }
          20%  { transform: scale(1); opacity: 1; }
          70%  { opacity: 0.8; }
          100% { transform: scale(3); opacity: 0; }
        }
        @keyframes fx-meteor-shockwave {
          0%   { transform: scale(0); opacity: 0.8; }
          100% { transform: scale(8); opacity: 0; }
        }
        @keyframes fx-meteor-screen-flash {
          0%, 100% { opacity: 0; }
          50%      { opacity: 0.3; }
        }
        @keyframes fx-meteor-stars {
          0%, 100% { opacity: 0.2; }
          50%      { opacity: 0.8; }
        }

        .fx-meteor {
          position: absolute; top: -5vh;
          width: var(--s, 20px);
          will-change: transform, opacity;
          animation: fx-meteor-fall var(--du, 1.6s) cubic-bezier(0.3, 0, 0.7, 1) forwards;
          animation-delay: var(--d, 0s);
        }
        .fx-meteor-head {
          width: 100%; height: var(--s, 20px);
          background: radial-gradient(circle, #fef3c7 0%, #fbbf24 40%, #ea580c 80%, transparent 100%);
          border-radius: 50%;
          filter: drop-shadow(0 0 12px #fbbf24);
        }
        .fx-meteor-tail {
          position: absolute; top: 50%; left: 50%;
          width: 200px; height: 4px;
          background: linear-gradient(90deg, transparent, rgba(251,191,36,0.85), rgba(239,68,68,0.5));
          transform-origin: 0 50%;
          transform: rotate(180deg) translateY(-50%);
          border-radius: 2px;
          filter: blur(1px);
        }
        .fx-meteor-impact {
          position: absolute;
          width: 80px; height: 80px;
          background: radial-gradient(circle, #fef3c7 0%, #fbbf24 30%, #ea580c 60%, transparent 100%);
          border-radius: 50%;
          transform: translate(-50%, -50%) scale(0);
          will-change: transform, opacity;
          animation: fx-meteor-impact 1.2s ease-out forwards;
          animation-delay: var(--d, 0s);
          mix-blend-mode: screen;
          filter: drop-shadow(0 0 16px #fbbf24);
        }
        .fx-meteor-shockwave {
          position: absolute;
          width: 40px; height: 40px;
          border: 3px solid #fbbf24;
          border-radius: 50%;
          transform: translate(-50%, -50%) scale(0);
          will-change: transform, opacity;
          animation: fx-meteor-shockwave 1.5s ease-out forwards;
          animation-delay: var(--d, 0s);
        }
        .fx-meteor-bg {
          position: absolute; inset: 0;
          background:
            radial-gradient(circle at 20% 30%, rgba(0,0,30,0.5) 0%, transparent 60%),
            radial-gradient(circle at 80% 60%, rgba(0,0,30,0.4) 0%, transparent 60%);
          pointer-events: none;
        }
        .fx-meteor-flash {
          position: absolute; inset: 0;
          background: radial-gradient(circle at 30% 90%, rgba(251,191,36,0.3), transparent 60%);
          pointer-events: none;
          animation: fx-meteor-screen-flash 0.4s ease-out 2s 4;
        }
        .fx-meteor-star {
          position: absolute;
          width: 3px; height: 3px;
          background: #ffffff;
          border-radius: 50%;
          animation: fx-meteor-stars 2s ease-in-out infinite;
          animation-delay: var(--d, 0s);
        }
      `}</style>

      <div className="fx-meteor-bg" />
      <div className="fx-meteor-flash" />

      {/* Hintergrund-Sterne */}
      {Array.from({ length: 40 }, (_, i) => (
        <span
          key={`star-${i}`}
          className="fx-meteor-star"
          style={{
            left: `${(i * 2.5) % 100}vw`,
            top: `${(i * 1.8) % 60}vh`,
            '--d': `${i * 0.05}s`,
          } as React.CSSProperties}
        />
      ))}

      {/* Stürzende Meteore */}
      {METEORS.map((m) => (
        <div
          key={`met-${m.id}`}
          className="fx-meteor"
          style={{
            left: `${m.startX}vw`,
            '--s': `${m.size}px`,
            '--du': `${m.duration}s`,
            '--d': `${m.delay}s`,
          } as React.CSSProperties}
        >
          <div className="fx-meteor-tail" />
          <div className="fx-meteor-head" />
        </div>
      ))}

      {/* Impact-Explosionen */}
      {IMPACTS.map((i) => (
        <span key={`imp-${i.id}`}>
          <span
            className="fx-meteor-impact"
            style={{
              left: `${i.x}vw`,
              top: `${i.y}vh`,
              '--d': `${i.delay}s`,
            } as React.CSSProperties}
          />
          <span
            className="fx-meteor-shockwave"
            style={{
              left: `${i.x}vw`,
              top: `${i.y}vh`,
              '--d': `${i.delay}s`,
            } as React.CSSProperties}
          />
        </span>
      ))}
    </>
  );
}
