// 40 fallende Herbstblätter (gelb/orange/rot), drehen + driften.

const LEAVES = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  left: ((i * 71) % 100),
  delay: -((i * 1.3) % 20),
  dur: 14 + ((i * 1.7) % 10),
  size: 8 + ((i * 0.9) % 6),
  drift: ((i * 4.3) % 80) - 40,
  color: ['#dc2626', '#f97316', '#fbbf24', '#a16207', '#b45309'][i % 5],
}));

export default function AutumnLeavesScene() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 bottom-0 overflow-hidden"
      style={{ zIndex: 25 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-leaf-fall {
          0%   { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 0; }
          10%  { opacity: 0.95; }
          90%  { opacity: 0.95; }
          100% { transform: translate3d(var(--drift, 0px), 110vh, 0) rotate(540deg); opacity: 0; }
        }
        .scn-leaf {
          position: absolute; top: 0;
          border-radius: 50% 0 50% 50%;
          will-change: transform, opacity;
          animation: scn-leaf-fall var(--dur, 20s) linear infinite;
          animation-delay: var(--delay, 0s);
          transform-origin: 50% 50%;
        }
        @media (prefers-reduced-motion: reduce) {
          .scn-leaf { animation: none; opacity: 0.4; }
        }
      `}</style>
      {LEAVES.map((l) => (
        <span
          key={l.id}
          className="scn-leaf"
          style={{
            left: `${l.left}%`,
            width: `${l.size}px`,
            height: `${l.size}px`,
            background: l.color,
            '--delay': `${l.delay}s`,
            '--dur': `${l.dur}s`,
            '--drift': `${l.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
