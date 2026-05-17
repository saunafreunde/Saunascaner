// Massive zentrale Explosion: weiß-gelb-orange Kern + 4 Schock-Wellen-
// Ringe + 80 fliegende Trümmer-Partikel + Screen-Whiteout. Dauer 5s.

const DEBRIS = Array.from({ length: 80 }, (_, i) => {
  const angle = (i / 80) * Math.PI * 2;
  const radius = 200 + ((i * 7) % 400);
  return {
    id: i,
    bx: Math.cos(angle) * radius,
    by: Math.sin(angle) * radius,
    size: 6 + ((i * 0.7) % 10),
    color: ['#fef3c7', '#fbbf24', '#f97316', '#ef4444', '#7c2d12'][i % 5],
    delay: ((i * 0.005) % 0.3),
  };
});

export default function ExplosionEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-explosion-whiteout {
          0%, 100% { opacity: 0; }
          5%, 8%   { opacity: 0.95; }
          18%, 22% { opacity: 0.5; }
          40%      { opacity: 0.1; }
        }
        @keyframes fx-explosion-core {
          0%   { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          5%   { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
          15%  { transform: translate(-50%, -50%) scale(2.2); opacity: 1; }
          35%  { transform: translate(-50%, -50%) scale(3); opacity: 0.8; }
          70%  { transform: translate(-50%, -50%) scale(3.5); opacity: 0.3; }
          100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
        }
        @keyframes fx-explosion-shockwave {
          0%   { transform: translate(-50%, -50%) scale(0); opacity: 0; border-width: 12px; }
          8%   { opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(8); opacity: 0; border-width: 1px; }
        }
        @keyframes fx-explosion-debris {
          0%   { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
          8%   { transform: translate(calc(-50% + var(--bx) * 0.3), calc(-50% + var(--by) * 0.3), 0) scale(1); opacity: 1; }
          60%  { transform: translate(calc(-50% + var(--bx)), calc(-50% + var(--by)), 0) scale(0.9); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--bx) * 1.3), calc(-50% + var(--by) * 1.3 + 200px), 0) scale(0); opacity: 0; }
        }
        .fx-explosion-whiteout {
          position: absolute; inset: 0;
          background: white;
          animation: fx-explosion-whiteout 5s ease-out forwards;
          mix-blend-mode: screen;
          pointer-events: none;
        }
        .fx-explosion-core {
          position: absolute; top: 50%; left: 50%;
          width: 200px; height: 200px;
          background: radial-gradient(circle, #ffffff 0%, #fef3c7 20%, #fbbf24 45%, #f97316 70%, #dc2626 90%, transparent 100%);
          border-radius: 50%;
          will-change: transform, opacity;
          animation: fx-explosion-core 5s ease-out forwards;
          mix-blend-mode: screen;
          filter: blur(2px);
        }
        .fx-explosion-shockwave {
          position: absolute; top: 50%; left: 50%;
          width: 100px; height: 100px;
          border: 12px solid rgba(255,240,200,0.9);
          border-radius: 50%;
          will-change: transform, opacity, border-width;
          animation: fx-explosion-shockwave 2.5s ease-out forwards;
          mix-blend-mode: screen;
        }
        .fx-explosion-shockwave-2 { animation-delay: 0.4s; border-color: rgba(251,191,36,0.85); }
        .fx-explosion-shockwave-3 { animation-delay: 0.8s; border-color: rgba(249,115,22,0.7); }
        .fx-explosion-shockwave-4 { animation-delay: 1.2s; border-color: rgba(220,38,38,0.6); }
        .fx-explosion-debris {
          position: absolute; top: 50%; left: 50%;
          border-radius: 30%;
          will-change: transform, opacity;
          animation: fx-explosion-debris 3.5s ease-out forwards;
          animation-delay: var(--del, 0s);
          filter: drop-shadow(0 0 4px currentColor);
        }
      `}</style>
      <div className="fx-explosion-whiteout" />
      <div className="fx-explosion-core" />
      <div className="fx-explosion-shockwave" />
      <div className="fx-explosion-shockwave fx-explosion-shockwave-2" />
      <div className="fx-explosion-shockwave fx-explosion-shockwave-3" />
      <div className="fx-explosion-shockwave fx-explosion-shockwave-4" />
      {DEBRIS.map((d) => (
        <span
          key={d.id}
          className="fx-explosion-debris"
          style={{
            width: `${d.size}px`,
            height: `${d.size}px`,
            background: d.color,
            color: d.color,
            '--bx': `${d.bx}px`,
            '--by': `${d.by}px`,
            '--del': `${d.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}
