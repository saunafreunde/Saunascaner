// Disco-Kugel oben dreht sich + Licht-Strahlen + bunte Reflexe tanzen. 12s.

const REFLEXES = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  delay: i * 0.1,
  x: (i * 1.25) % 100,
  y: 15 + (i * 1.7) % 70,
  size: 12 + (i % 4) * 8,
  color: ['#ec4899', '#3b82f6', '#22c55e', '#fbbf24', '#a855f7', '#06b6d4', '#f97316'][i % 7],
}));

const DANCERS = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  x: 10 + i * 15,
  delay: i * 0.15,
}));

export default function DiscoBallEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-disco-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fx-disco-rays-spin {
          to { transform: translateX(-50%) rotate(360deg); }
        }
        @keyframes fx-disco-reflex {
          0%   { transform: scale(0); opacity: 0; }
          30%  { transform: scale(1); opacity: 0.9; }
          70%  { opacity: 0.9; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes fx-disco-dancer-bop {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50%      { transform: translateY(-10px) rotate(5deg); }
        }
        @keyframes fx-disco-floor-pulse {
          0%, 100% { opacity: 0.3; }
          50%      { opacity: 0.6; }
        }

        .fx-disco-ball {
          position: absolute; top: 5vh; left: 50%; transform: translateX(-50%);
          will-change: transform;
        }
        .fx-disco-ball-inner {
          animation: fx-disco-spin 3s linear infinite;
          transform-origin: center;
        }
        .fx-disco-rays {
          position: absolute; top: 10vh; left: 50%;
          width: 200vw; height: 200vh;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            rgba(236,72,153,0.15) 18deg,
            transparent 36deg,
            rgba(59,130,246,0.15) 54deg,
            transparent 72deg,
            rgba(34,197,94,0.15) 90deg,
            transparent 108deg,
            rgba(251,191,36,0.15) 126deg,
            transparent 144deg,
            rgba(168,85,247,0.15) 162deg,
            transparent 180deg
          );
          transform-origin: 50% 0;
          animation: fx-disco-rays-spin 5s linear infinite;
          mix-blend-mode: screen;
          pointer-events: none;
        }
        .fx-disco-reflex {
          position: absolute;
          width: var(--s, 15px); height: var(--s, 15px);
          background: radial-gradient(circle, var(--c, #ec4899) 0%, transparent 70%);
          border-radius: 50%;
          will-change: transform, opacity;
          animation: fx-disco-reflex 1.8s ease-in-out infinite;
          animation-delay: var(--d, 0s);
          mix-blend-mode: screen;
          filter: blur(2px);
        }
        .fx-disco-dancer {
          position: absolute; bottom: 8vh;
          will-change: transform;
          animation: fx-disco-dancer-bop 0.5s ease-in-out infinite;
          animation-delay: var(--d, 0s);
        }
        .fx-disco-floor {
          position: absolute; bottom: 0; left: 0; right: 0; height: 20vh;
          background: repeating-conic-gradient(from 0deg at 50% 100%,
            #ec4899 0deg 30deg, #3b82f6 30deg 60deg, #22c55e 60deg 90deg,
            #fbbf24 90deg 120deg, #a855f7 120deg 150deg, #ef4444 150deg 180deg);
          opacity: 0.3;
          animation: fx-disco-floor-pulse 0.8s ease-in-out infinite;
          mix-blend-mode: screen;
          pointer-events: none;
        }
      `}</style>

      <div className="fx-disco-floor" />
      <div className="fx-disco-rays" />

      {/* Disco-Kugel */}
      <div className="fx-disco-ball">
        <div className="fx-disco-ball-inner">
          <svg viewBox="0 0 200 200" width="200" height="200">
            {/* Aufhängung */}
            <line x1="100" y1="0" x2="100" y2="35" stroke="#475569" strokeWidth="2" />
            <rect x="92" y="33" width="16" height="8" fill="#1c1917" />
            {/* Kugel — gradient */}
            <circle cx="100" cy="110" r="70" fill="url(#fx-disco-grad)" />
            <defs>
              <radialGradient id="fx-disco-grad" cx="35%" cy="30%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="40%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#1e293b" />
              </radialGradient>
            </defs>
            {/* Mosaik-Fliesen */}
            <g opacity="0.7">
              {Array.from({ length: 10 }, (_, row) => (
                Array.from({ length: 14 }, (_, col) => {
                  const angle = (col / 14) * Math.PI * 2;
                  const ringR = 65 - row * 6;
                  const cx = 100 + Math.cos(angle) * ringR * 0.7;
                  const cy = 110 + Math.sin(angle) * ringR * 0.7 + row * 4;
                  if (cy < 50 || cy > 175 || cx < 40 || cx > 165) return null;
                  const color = ['#cbd5e1','#94a3b8','#e2e8f0','#ffffff'][(row + col) % 4];
                  return <rect key={`${row}-${col}`} x={cx-3} y={cy-2} width="6" height="4" fill={color} opacity="0.85" />;
                })
              )).flat()}
            </g>
            {/* Highlight */}
            <ellipse cx="80" cy="80" rx="22" ry="14" fill="#ffffff" opacity="0.5" />
          </svg>
        </div>
      </div>

      {/* Bunte Licht-Reflexe */}
      {REFLEXES.map((r) => (
        <span
          key={`ref-${r.id}`}
          className="fx-disco-reflex"
          style={{
            left: `${r.x}vw`,
            top: `${r.y}vh`,
            '--s': `${r.size}px`,
            '--c': r.color,
            '--d': `${r.delay}s`,
          } as React.CSSProperties}
        />
      ))}

      {/* Tänzer-Silhouetten unten */}
      {DANCERS.map((d) => (
        <div
          key={`dnc-${d.id}`}
          className="fx-disco-dancer"
          style={{
            left: `${d.x}vw`,
            '--d': `${d.delay}s`,
          } as React.CSSProperties}
        >
          <svg viewBox="0 0 60 100" width="60" height="100">
            {/* Silhouette */}
            <circle cx="30" cy="15" r="10" fill="#0f172a" />
            <rect x="22" y="22" width="16" height="40" rx="3" fill="#0f172a" />
            <rect x="10" y="24" width="14" height="6" rx="3" fill="#0f172a" transform="rotate(-30 17 27)" />
            <rect x="36" y="24" width="14" height="6" rx="3" fill="#0f172a" transform="rotate(30 43 27)" />
            <rect x="22" y="60" width="6" height="35" rx="2" fill="#0f172a" transform="rotate(-10 25 78)" />
            <rect x="32" y="60" width="6" height="35" rx="2" fill="#0f172a" transform="rotate(10 35 78)" />
          </svg>
        </div>
      ))}
    </>
  );
}
