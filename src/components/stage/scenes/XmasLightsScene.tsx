// Lichterkette über die gesamte Tafel-Breite. Pure-CSS,
// asynchrones Blinken pro Lampe (verschiedene delays).

const BULBS = Array.from({ length: 40 }, (_, i) => {
  const colors = ['#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#a855f7', '#ec4899'];
  return {
    id: i,
    color: colors[i % colors.length],
    delay: -((i * 0.31) % 2.4),
  };
});

export default function XmasLightsScene() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 overflow-hidden"
      style={{ zIndex: 41, height: 60 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-xmas-glow {
          0%, 60%, 100% { transform: scale(1); opacity: 0.9; filter: drop-shadow(0 0 4px var(--c, #fff)); }
          30%           { transform: scale(1.25); opacity: 1; filter: drop-shadow(0 0 12px var(--c, #fff)); }
        }
        .scn-xmas-wire {
          position: absolute; top: 8px; left: 0; right: 0; height: 30px;
          background: linear-gradient(to bottom, transparent 14px, rgba(0,0,0,0.4) 15px, rgba(0,0,0,0.4) 16px, transparent 17px);
          mask-image: radial-gradient(ellipse 100% 50% at 50% 0%, black 30%, transparent 80%);
        }
        .scn-xmas-bulb {
          position: absolute; top: 24px; width: 10px; height: 12px;
          border-radius: 50% 50% 50% 50% / 40% 40% 60% 60%;
          background: var(--c, #fff);
          will-change: transform, opacity, filter;
          animation: scn-xmas-glow 2.4s ease-in-out infinite;
          animation-delay: var(--delay, 0s);
          transform-origin: 50% 0%;
        }
        @media (prefers-reduced-motion: reduce) {
          .scn-xmas-bulb { animation: none; opacity: 0.85; }
        }
      `}</style>
      <div className="scn-xmas-wire" />
      {BULBS.map((b) => (
        <span
          key={b.id}
          className="scn-xmas-bulb"
          style={{
            left: `${(b.id / BULBS.length) * 100}%`,
            '--c': b.color,
            '--delay': `${b.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
