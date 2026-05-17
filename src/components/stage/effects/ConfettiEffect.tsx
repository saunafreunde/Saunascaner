// EPISCHES Konfetti: 250 Schnipsel in 3 Formen (Streifen, Quadrate, Kreise),
// größer, mit drop-shadow für Tiefe. Dauer 10s.

const PIECES = Array.from({ length: 250 }, (_, i) => ({
  id: i,
  left: ((i * 37) % 100) + ((i * 0.31) % 1),
  delay: ((i * 0.07) % 2.5),
  dur: 5 + ((i * 0.13) % 4),
  width: 10 + ((i * 0.7) % 10),
  height: 5 + ((i * 0.5) % 12),
  drift: ((i * 2.7) % 120) - 60,
  rotate: ((i * 17) % 1080) - 540,
  shape: i % 3, // 0: streifen, 1: quadrat, 2: kreis
  color: ['#ef4444', '#fbbf24', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#22d3ee', '#f97316'][i % 8],
}));

export default function ConfettiEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-confetti-fall {
          0%   { transform: translate3d(0, -10vh, 0) rotate(0deg) rotateX(0deg); opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { transform: translate3d(var(--drift, 0px), 110vh, 0) rotate(var(--rot, 360deg)) rotateX(720deg); opacity: 0; }
        }
        .fx-confetti {
          position: absolute; top: 0;
          will-change: transform, opacity;
          animation: fx-confetti-fall var(--d, 6s) cubic-bezier(0.4, 0.0, 0.6, 1) forwards;
          animation-delay: var(--del, 0s);
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));
        }
        .fx-confetti-circle { border-radius: 50%; }
      `}</style>
      {PIECES.map((p) => (
        <span
          key={p.id}
          className={`fx-confetti ${p.shape === 2 ? 'fx-confetti-circle' : ''}`}
          style={{
            left: `${p.left}%`,
            width: `${p.shape === 0 ? p.width : Math.max(p.width, p.height)}px`,
            height: `${p.shape === 0 ? p.height * 0.3 : p.shape === 1 ? p.height : Math.max(p.width, p.height)}px`,
            background: p.color,
            '--d': `${p.dur}s`,
            '--del': `${p.delay}s`,
            '--drift': `${p.drift}px`,
            '--rot': `${p.rotate}deg`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}
