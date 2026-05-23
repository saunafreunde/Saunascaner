// Ninja springt diagonal über die Tafel, wirft Shuriken, Smoke-Bombe explodiert. 7s.

const SHURIKENS = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  delay: 0.3 + i * 0.4,
  startX: 70 - i * 5,
  startY: 30 + i * 5,
  endX: 10 + (i % 4) * 12,
  endY: 50 + (i % 3) * 10,
}));

const SMOKE = Array.from({ length: 25 }, (_, i) => ({
  id: i,
  delay: 4.5 + i * 0.08,
  angle: i * 14.4,
  distance: 80 + (i % 4) * 40,
  size: 30 + (i % 4) * 15,
}));

export default function NinjaStrikeEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-ninja-jump {
          0%   { transform: translate3d(110vw, -20vh, 0) rotate(0deg); }
          30%  { transform: translate3d(50vw, -10vh, 0) rotate(-15deg); }
          70%  { transform: translate3d(20vw, 70vh, 0) rotate(15deg); }
          85%  { transform: translate3d(5vw, 80vh, 0) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translate3d(5vw, 80vh, 0) rotate(0deg) scale(0.3); opacity: 0; }
        }
        @keyframes fx-ninja-shuriken-throw {
          0%   { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translate3d(var(--dx, -300px), var(--dy, 200px), 0) rotate(1440deg); opacity: 0.8; }
        }
        @keyframes fx-ninja-smoke {
          0%   { transform: translate3d(0, 0, 0) scale(0); opacity: 0; }
          15%  { opacity: 0.9; transform: translate3d(0, 0, 0) scale(1); }
          100% { transform: translate3d(var(--dx, 0), var(--dy, 0), 0) scale(2.5); opacity: 0; }
        }
        @keyframes fx-ninja-flash {
          0%, 100% { opacity: 0; }
          50%      { opacity: 0.6; }
        }
        @keyframes fx-ninja-blade-flash {
          0%, 100% { opacity: 0.3; }
          50%      { opacity: 1; filter: drop-shadow(0 0 10px #ffffff); }
        }
        .fx-ninja-wrap {
          position: absolute; top: 0; left: 0;
          will-change: transform;
          animation: fx-ninja-jump 5.5s cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }
        .fx-ninja-blade { animation: fx-ninja-blade-flash 0.4s ease-in-out infinite; }
        .fx-ninja-shuriken {
          position: absolute; top: 30vh; left: 70vw;
          width: 36px; height: 36px;
          will-change: transform, opacity;
          animation: fx-ninja-shuriken-throw 1.2s linear forwards;
          animation-delay: var(--d, 0s);
        }
        .fx-ninja-smoke-puff {
          position: absolute; bottom: 18vh; left: 8vw;
          width: var(--s, 30px); height: var(--s, 30px);
          background: radial-gradient(circle, #cbd5e1 0%, #475569 60%, transparent 100%);
          border-radius: 50%;
          will-change: transform, opacity;
          animation: fx-ninja-smoke 2.5s ease-out forwards;
          animation-delay: var(--d, 4.5s);
        }
        .fx-ninja-flash-overlay {
          position: absolute; inset: 0;
          background: radial-gradient(circle at 10% 85%, rgba(239,68,68,0.4) 0%, transparent 50%);
          pointer-events: none;
          animation: fx-ninja-flash 0.15s ease-in-out 4.4s 3;
        }
      `}</style>

      <div className="fx-ninja-wrap">
        <svg viewBox="0 0 140 180" width="140" height="180">
          {/* Ninja-Schatten/Outline (schwarzer Anzug) */}
          {/* Körper */}
          <rect x="50" y="60" width="40" height="55" rx="4" fill="#0f172a" />
          {/* Bauch-Band (rot, Ninja-Schärpe) */}
          <rect x="50" y="85" width="40" height="8" fill="#dc2626" />
          {/* Kopf — Ninja-Maske */}
          <ellipse cx="70" cy="35" rx="22" ry="24" fill="#0f172a" />
          {/* Augen-Schlitz (weiß) */}
          <ellipse cx="70" cy="32" rx="14" ry="4" fill="#fef3c7" />
          {/* Pupillen */}
          <rect x="60" y="30" width="4" height="4" fill="#0f172a" />
          <rect x="76" y="30" width="4" height="4" fill="#0f172a" />
          {/* Stirnband-Knoten hinten */}
          <polygon points="92,28 105,20 105,38" fill="#dc2626" />
          {/* Arme — gestreckt mit Schwert */}
          <rect x="38" y="65" width="12" height="40" rx="3" fill="#0f172a" transform="rotate(20 44 85)" />
          <rect x="90" y="65" width="12" height="50" rx="3" fill="#0f172a" transform="rotate(-30 96 90)" />
          {/* Schwert (Katana) in rechter Hand — Klinge */}
          <g transform="rotate(-30 96 90)">
            <line className="fx-ninja-blade" x1="96" y1="60" x2="96" y2="15" stroke="#e2e8f0" strokeWidth="3" />
            <line x1="96" y1="60" x2="96" y2="15" stroke="#cbd5e1" strokeWidth="1" />
            {/* Griff */}
            <rect x="93" y="60" width="6" height="14" fill="#1c1917" />
            <rect x="91" y="58" width="10" height="3" fill="#fbbf24" />
          </g>
          {/* Beine */}
          <rect x="55" y="115" width="12" height="50" rx="3" fill="#0f172a" transform="rotate(-10 61 140)" />
          <rect x="75" y="115" width="12" height="50" rx="3" fill="#0f172a" transform="rotate(15 81 140)" />
          {/* Ninja-Stiefel */}
          <ellipse cx="50" cy="170" rx="9" ry="5" fill="#1c1917" />
          <ellipse cx="92" cy="170" rx="9" ry="5" fill="#1c1917" />
          {/* Cape im Wind */}
          <path d="M 50,65 Q 30,80 25,120 Q 35,110 45,100 Z" fill="#1e293b" opacity="0.8" />
        </svg>
      </div>

      {/* Shuriken */}
      {SHURIKENS.map((s) => (
        <div
          key={`shu-${s.id}`}
          className="fx-ninja-shuriken"
          style={{
            left: `${s.startX}vw`,
            top: `${s.startY}vh`,
            '--dx': `${(s.endX - s.startX)}vw`,
            '--dy': `${(s.endY - s.startY)}vh`,
            '--d': `${s.delay}s`,
          } as React.CSSProperties}
        >
          <svg viewBox="0 0 40 40" width="36" height="36">
            <polygon
              points="20,2 24,16 38,20 24,24 20,38 16,24 2,20 16,16"
              fill="#0f172a"
              stroke="#475569"
              strokeWidth="1"
            />
            <circle cx="20" cy="20" r="3" fill="#dc2626" />
            <circle cx="20" cy="20" r="1.5" fill="#fbbf24" />
          </svg>
        </div>
      ))}

      {/* Smoke-Bombe explodiert beim Landen */}
      {SMOKE.map((s) => {
        const dx = Math.cos(s.angle * Math.PI / 180) * s.distance;
        const dy = Math.sin(s.angle * Math.PI / 180) * s.distance;
        return (
          <span
            key={`smoke-${s.id}`}
            className="fx-ninja-smoke-puff"
            style={{
              '--dx': `${dx}px`,
              '--dy': `${dy}px`,
              '--s': `${s.size}px`,
              '--d': `${s.delay}s`,
            } as React.CSSProperties}
          />
        );
      })}

      {/* Roter Flash bei Aufprall */}
      <div className="fx-ninja-flash-overlay" />
    </>
  );
}
