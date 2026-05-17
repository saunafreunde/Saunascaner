// 80 bunte Konfetti-Schnipsel regnen 8s lang. Pure-CSS one-shot.

const PIECES = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  left: ((i * 37) % 100),
  delay: ((i * 0.11) % 1.5),
  dur: 4 + ((i * 0.13) % 3),
  size: 6 + ((i * 0.7) % 6),
  drift: ((i * 2.7) % 80) - 40,
  rotate: ((i * 17) % 720) - 360,
  color: ['#ef4444', '#fbbf24', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#22d3ee'][i % 7],
}));

export default function ConfettiEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-confetti-fall {
          0%   { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translate3d(var(--drift, 0px), 110vh, 0) rotate(var(--rot, 360deg)); opacity: 0; }
        }
        .fx-confetti {
          position: absolute; top: 0;
          will-change: transform, opacity;
          animation: fx-confetti-fall var(--d, 6s) linear forwards;
          animation-delay: var(--del, 0s);
        }
      `}</style>
      {PIECES.map((p) => (
        <span
          key={p.id}
          className="fx-confetti"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 0.5}px`,
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
