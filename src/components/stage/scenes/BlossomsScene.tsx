// Kirschblüten am Wegrand + 25 schwebende Blütenblätter in der Luft.

const PETALS = Array.from({ length: 25 }, (_, i) => ({
  id: i,
  left: ((i * 53) % 100),
  delay: -((i * 1.7) % 22),
  dur: 18 + ((i * 2.3) % 12),
  size: 5 + ((i * 0.7) % 4),
  drift: ((i * 3.1) % 60) - 30,
}));

export default function BlossomsScene() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 bottom-0 overflow-hidden"
      style={{ zIndex: 24 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-petal-drift {
          0%   { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 0; }
          15%  { opacity: 0.85; }
          85%  { opacity: 0.85; }
          100% { transform: translate3d(var(--drift, 0px), 110vh, 0) rotate(720deg); opacity: 0; }
        }
        .scn-petal {
          position: absolute; top: 0;
          background: radial-gradient(circle at 30% 30%, #fce7f3 0%, #f9a8d4 70%, #ec4899 100%);
          border-radius: 50% 0 50% 0;
          will-change: transform, opacity;
          animation: scn-petal-drift var(--dur, 22s) linear infinite;
          animation-delay: var(--delay, 0s);
        }
        @media (prefers-reduced-motion: reduce) {
          .scn-petal { animation: none; opacity: 0.5; }
        }
      `}</style>
      {PETALS.map((p) => (
        <span
          key={p.id}
          className="scn-petal"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            '--delay': `${p.delay}s`,
            '--dur': `${p.dur}s`,
            '--drift': `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
