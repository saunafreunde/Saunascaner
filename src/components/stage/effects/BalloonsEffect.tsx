// 12 bunte Luftballons steigen langsam auf. Dauer 8s.

const BALLOONS = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  left: ((i * 17) % 95) + 2,
  delay: ((i * 0.3) % 2.5),
  dur: 6 + ((i * 0.4) % 3),
  size: 30 + ((i * 3) % 14),
  drift: ((i * 5.7) % 60) - 30,
  color: ['#ef4444', '#fbbf24', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'][i % 6],
}));

export default function BalloonsEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-balloon-rise {
          0%   { transform: translate3d(0, 20vh, 0); opacity: 0; }
          10%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translate3d(var(--drift, 0px), -120vh, 0); opacity: 0; }
        }
        .fx-balloon-wrap {
          position: absolute; bottom: 0;
          will-change: transform, opacity;
          animation: fx-balloon-rise var(--d, 8s) linear forwards;
          animation-delay: var(--del, 0s);
        }
      `}</style>
      {BALLOONS.map((b) => (
        <div
          key={b.id}
          className="fx-balloon-wrap"
          style={{
            left: `${b.left}%`,
            '--d': `${b.dur}s`,
            '--del': `${b.delay}s`,
            '--drift': `${b.drift}px`,
          } as React.CSSProperties}
        >
          <svg viewBox="0 0 50 70" width={b.size} height={b.size * 1.4}>
            <ellipse cx="25" cy="25" rx="20" ry="24" fill={b.color} />
            <ellipse cx="20" cy="18" rx="4" ry="6" fill="rgba(255,255,255,0.5)" />
            <polygon points="22,48 28,48 25,52" fill={b.color} />
            <line x1="25" y1="52" x2="25" y2="70" stroke="rgba(0,0,0,0.4)" strokeWidth="0.8" />
          </svg>
        </div>
      ))}
    </>
  );
}
