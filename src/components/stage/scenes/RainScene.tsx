// 80 Regenfäden, schnelles Fallen.

const DROPS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  left: ((i * 37) % 100),
  delay: -((i * 0.13) % 1.5),
  dur: 0.8 + ((i * 0.07) % 0.5),
  height: 18 + ((i * 0.31) % 12),
}));

export default function RainScene() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 bottom-0 overflow-hidden"
      style={{ zIndex: 23 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-rain-fall {
          0%   { transform: translate3d(0, -10vh, 0); opacity: 0; }
          15%  { opacity: 0.6; }
          85%  { opacity: 0.6; }
          100% { transform: translate3d(-6px, 110vh, 0); opacity: 0; }
        }
        .scn-rain-drop {
          position: absolute; top: 0;
          width: 1.5px;
          background: linear-gradient(to bottom, rgba(180,210,255,0.0), rgba(180,210,255,0.7));
          will-change: transform, opacity;
          animation: scn-rain-fall var(--dur, 1s) linear infinite;
          animation-delay: var(--delay, 0s);
        }
        @media (prefers-reduced-motion: reduce) {
          .scn-rain-drop { animation: none; opacity: 0.3; }
        }
      `}</style>
      {DROPS.map((d) => (
        <span
          key={d.id}
          className="scn-rain-drop"
          style={{
            left: `${d.left}%`,
            height: `${d.height}px`,
            '--delay': `${d.delay}s`,
            '--dur': `${d.dur}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
