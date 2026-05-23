// Herz-Schwarm — viele Herzen schweben hoch in 3 Größen + Cupid-Pfeile + Glitzer. 8s.

const HEARTS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: 3 + (i * 1.65) % 95,
  delay: i * 0.13,
  duration: 4 + (i % 4) * 1.2,
  size: [22, 32, 42, 56][i % 4],
  drift: -40 + (i % 8) * 12,
  color: ['#ec4899', '#dc2626', '#f43f5e', '#fb7185', '#e11d48'][i % 5],
}));

const ARROWS = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  delay: 1 + i * 1.2,
  startY: 20 + i * 12,
}));

export default function HeartSwarmEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-heart-float {
          0%   { transform: translate3d(0, 0, 0) scale(0.5) rotate(-15deg); opacity: 0; }
          15%  { opacity: 1; transform: translate3d(0, 0, 0) scale(1) rotate(0deg); }
          90%  { opacity: 1; }
          100% { transform: translate3d(var(--dr, 0), -110vh, 0) scale(1.2) rotate(15deg); opacity: 0; }
        }
        @keyframes fx-heart-beat {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.15); }
        }
        @keyframes fx-arrow-fly {
          0%   { transform: translate3d(-30vw, 0, 0) rotate(15deg); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translate3d(130vw, 0, 0) rotate(-5deg); opacity: 0; }
        }
        @keyframes fx-heart-bg-pulse {
          0%, 100% { opacity: 0.1; }
          50%      { opacity: 0.25; }
        }

        .fx-heart {
          position: absolute; bottom: -10vh;
          width: var(--s, 32px); height: var(--s, 32px);
          will-change: transform, opacity;
          animation: fx-heart-float var(--du, 6s) ease-out forwards;
          animation-delay: var(--d, 0s);
        }
        .fx-heart-beat { animation: fx-heart-beat 0.6s ease-in-out infinite; }
        .fx-arrow {
          position: absolute; left: 0;
          will-change: transform, opacity;
          animation: fx-arrow-fly 2.5s linear forwards;
          animation-delay: var(--d, 0s);
        }
        .fx-heart-bg {
          position: absolute; inset: 0;
          background: radial-gradient(circle at 50% 100%, rgba(236,72,153,0.3), transparent 60%);
          pointer-events: none;
          animation: fx-heart-bg-pulse 1.5s ease-in-out infinite;
        }
      `}</style>

      <div className="fx-heart-bg" />

      {HEARTS.map((h) => (
        <span
          key={`heart-${h.id}`}
          className="fx-heart"
          style={{
            left: `${h.x}vw`,
            '--s': `${h.size}px`,
            '--du': `${h.duration}s`,
            '--d': `${h.delay}s`,
            '--dr': `${h.drift}px`,
          } as React.CSSProperties}
        >
          <div className="fx-heart-beat">
            <svg viewBox="0 0 24 24" width="100%" height="100%">
              <path
                d="M12 21s-7-4.5-7-10.5C5 7.5 7.5 5 10.5 5c1.5 0 3 .8 4.5 2.5C16.5 5.8 18 5 19.5 5 22.5 5 25 7.5 25 10.5c0 6-7 10.5-7 10.5z"
                fill={h.color}
                stroke="#ffffff"
                strokeWidth="1.2"
                filter={`drop-shadow(0 0 6px ${h.color})`}
              />
              {/* Highlight */}
              <ellipse cx="8" cy="9" rx="2" ry="3" fill="#ffffff" opacity="0.6" />
            </svg>
          </div>
        </span>
      ))}

      {ARROWS.map((a) => (
        <div
          key={`arr-${a.id}`}
          className="fx-arrow"
          style={{
            top: `${a.startY}vh`,
            '--d': `${a.delay}s`,
          } as React.CSSProperties}
        >
          <svg viewBox="0 0 200 40" width="200" height="40">
            {/* Pfeil-Schaft */}
            <rect x="40" y="17" width="120" height="4" fill="#78350f" />
            {/* Spitze (Herz) */}
            <path d="M 160 20 L 180 12 L 178 18 L 195 18 L 195 22 L 178 22 L 180 28 Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1" />
            {/* Federn hinten */}
            <polygon points="40,20 20,10 30,20 20,30" fill="#fbbf24" stroke="#854d0e" strokeWidth="1" />
            <polygon points="38,20 25,15 30,20 25,25" fill="#f97316" />
          </svg>
        </div>
      ))}
    </>
  );
}
