// Vulkan-Ausbruch — Vulkan unten, Lava-Fontäne nach oben, Asche-Wolken. 8s.

const LAVA_DROPS = Array.from({ length: 50 }, (_, i) => ({
  id: i,
  delay: i * 0.08,
  xOffset: -120 + (i * 5.4),
  yPeak: -300 - (i % 4) * 80,
  size: 6 + (i % 5) * 2,
}));

const ASH = Array.from({ length: 25 }, (_, i) => ({
  id: i,
  delay: 0.5 + i * 0.18,
  xOffset: -80 + (i * 6.4),
  size: 20 + (i % 4) * 10,
}));

export default function VolcanoEruptionEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-volcano-rise {
          0%   { transform: translateY(100%); }
          15%  { transform: translateY(0); }
          90%  { transform: translateY(0); }
          100% { transform: translateY(20%); }
        }
        @keyframes fx-volcano-shake {
          0%, 100% { transform: translateX(0); }
          25%      { transform: translateX(-2px); }
          75%      { transform: translateX(2px); }
        }
        @keyframes fx-volcano-glow {
          0%, 100% { filter: drop-shadow(0 0 20px #ea580c); }
          50%      { filter: drop-shadow(0 0 50px #fbbf24) drop-shadow(0 0 80px #ea580c); }
        }
        @keyframes fx-lava-drop {
          0%   { transform: translate3d(0, 0, 0) scale(0.5); opacity: 0; }
          10%  { opacity: 1; transform: translate3d(var(--xo, 0), 0, 0) scale(1); }
          50%  { transform: translate3d(calc(var(--xo, 0) * 1.5), var(--yp, -200px), 0) scale(1); }
          100% { transform: translate3d(calc(var(--xo, 0) * 2.5), 50vh, 0) scale(0.6); opacity: 0; }
        }
        @keyframes fx-ash-rise {
          0%   { transform: translate3d(0, 0, 0) scale(0.2); opacity: 0; }
          15%  { opacity: 0.7; }
          100% { transform: translate3d(var(--xo, 0), -90vh, 0) scale(2.5); opacity: 0; }
        }
        @keyframes fx-volcano-screen-shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }

        .fx-volcano-wrap {
          position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
          will-change: transform;
          animation: fx-volcano-rise 8s cubic-bezier(0.5, 0, 0.3, 1) forwards,
                     fx-volcano-shake 0.15s linear infinite;
        }
        .fx-volcano-glow { animation: fx-volcano-glow 0.6s ease-in-out infinite; }
        .fx-lava-drop {
          position: absolute; left: 50%; bottom: 30vh;
          width: var(--s, 8px); height: var(--s, 8px);
          background: radial-gradient(circle, #fbbf24 0%, #ea580c 50%, #7f1d1d 100%);
          border-radius: 50%;
          will-change: transform, opacity;
          animation: fx-lava-drop 2.2s cubic-bezier(0.4, 0, 0.6, 1) forwards;
          animation-delay: var(--d, 0s);
          filter: drop-shadow(0 0 6px #ea580c);
          mix-blend-mode: screen;
        }
        .fx-ash-cloud {
          position: absolute; left: 50%; bottom: 35vh;
          width: var(--s, 30px); height: var(--s, 30px);
          background: radial-gradient(circle, #4b5563 0%, #1f2937 60%, transparent 100%);
          border-radius: 50%;
          will-change: transform, opacity;
          animation: fx-ash-rise 5s ease-out forwards;
          animation-delay: var(--d, 0s);
        }
        .fx-volcano-screen-overlay {
          position: absolute; inset: 0;
          background: radial-gradient(circle at 50% 100%, rgba(234,88,12,0.12) 0%, transparent 60%);
          pointer-events: none;
          animation: fx-volcano-glow 0.8s ease-in-out infinite;
        }
      `}</style>

      <div className="fx-volcano-screen-overlay" />

      <div className="fx-volcano-wrap">
        <div className="fx-volcano-glow">
          <svg viewBox="0 0 400 280" width="400" height="280">
            {/* Vulkan-Kegel (dunkles Grau) */}
            <polygon points="0,280 130,40 270,40 400,280" fill="#475569" />
            <polygon points="0,280 130,40 270,40 400,280" fill="url(#fx-volcano-grad)" />
            <defs>
              <linearGradient id="fx-volcano-grad" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="60%" stopColor="#374151" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
            </defs>
            {/* Lava-Strom rechts */}
            <path d="M 220,80 Q 250,140 310,200 Q 330,240 360,280 L 280,280 Q 250,210 220,150 Z" fill="#ea580c" opacity="0.85" />
            <path d="M 230,90 Q 255,150 305,210 Q 325,250 340,280 L 290,280 Q 260,210 235,160 Z" fill="#fbbf24" opacity="0.7" />
            {/* Lava-Strom links */}
            <path d="M 180,80 Q 140,160 90,220 Q 60,260 30,280 L 110,280 Q 140,200 180,140 Z" fill="#ea580c" opacity="0.8" />
            <path d="M 175,95 Q 140,170 100,230 Q 80,265 60,280 L 100,280 Q 135,210 175,150 Z" fill="#fbbf24" opacity="0.6" />
            {/* Krater oben (glühendes Loch) */}
            <ellipse cx="200" cy="42" rx="70" ry="14" fill="#0f172a" />
            <ellipse cx="200" cy="40" rx="60" ry="10" fill="#7f1d1d" />
            <ellipse cx="200" cy="38" rx="50" ry="8" fill="#ea580c" />
            <ellipse cx="200" cy="36" rx="40" ry="6" fill="#fbbf24" />
            {/* Felsbrocken */}
            <ellipse cx="80" cy="265" rx="20" ry="8" fill="#1c1917" />
            <ellipse cx="320" cy="270" rx="25" ry="10" fill="#1c1917" />
            {/* Glühende Risse im Vulkan-Kegel */}
            <path d="M 150,200 Q 155,180 145,140" stroke="#ea580c" strokeWidth="2" fill="none" opacity="0.8" />
            <path d="M 250,200 Q 245,180 255,140" stroke="#ea580c" strokeWidth="2" fill="none" opacity="0.8" />
            <path d="M 180,250 L 175,220" stroke="#fbbf24" strokeWidth="1.5" fill="none" opacity="0.7" />
          </svg>
        </div>
      </div>

      {/* Lava-Tropfen Fontäne */}
      {LAVA_DROPS.map((d) => (
        <span
          key={d.id}
          className="fx-lava-drop"
          style={{
            '--xo': `${d.xOffset}px`,
            '--yp': `${d.yPeak}px`,
            '--s': `${d.size}px`,
            '--d': `${d.delay}s`,
          } as React.CSSProperties}
        />
      ))}

      {/* Asche-Wolken (langsam aufsteigend) */}
      {ASH.map((a) => (
        <span
          key={a.id}
          className="fx-ash-cloud"
          style={{
            '--xo': `${a.xOffset}px`,
            '--s': `${a.size}px`,
            '--d': `${a.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}
