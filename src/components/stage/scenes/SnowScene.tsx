// 60 Schneeflocken fallen über die gesamte untere Bildhälfte. Pure-CSS,
// Animation nur auf transform + opacity. Static-erzeugte Positions, kein
// React-State (60 keyframes-instances, geteiltes @keyframes-Set).

const FLAKES = Array.from({ length: 60 }, (_, i) => {
  // Deterministische Pseudo-Verteilung
  const seed = (i * 9301 + 49297) % 233280;
  const left = (seed / 233280) * 100;
  const delay = -((i * 0.7) % 18);
  const dur = 12 + ((i * 1.3) % 10);
  const size = 4 + ((i * 1.7) % 5);
  const drift = ((i * 2.1) % 30) - 15;
  return { id: i, left, delay, dur, size, drift };
});

export default function SnowScene() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 bottom-0 overflow-hidden"
      style={{ zIndex: 22 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-snow-fall {
          0%   { transform: translate3d(0, -10vh, 0); opacity: 0; }
          10%  { opacity: 0.9; }
          90%  { opacity: 0.9; }
          100% { transform: translate3d(var(--drift, 0px), 110vh, 0); opacity: 0; }
        }
        .scn-snow-flake {
          position: absolute;
          top: 0;
          background: radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.4) 60%, transparent 100%);
          border-radius: 50%;
          will-change: transform, opacity;
          animation: scn-snow-fall var(--dur, 18s) linear infinite;
          animation-delay: var(--delay, 0s);
        }
        @media (prefers-reduced-motion: reduce) {
          .scn-snow-flake { animation: none; opacity: 0.6; }
        }
      `}</style>
      {FLAKES.map((f) => (
        <span
          key={f.id}
          className="scn-snow-flake"
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
    </div>
  );
}
