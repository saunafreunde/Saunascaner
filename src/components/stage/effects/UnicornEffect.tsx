// Einhorn galoppiert von links nach rechts mit Regenbogen-Mähne und
// magischem Stern-Trail. Dauer 9s.

const STAR_TRAIL = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  spawnDelay: i * 0.13,
  yOffset: ((i * 7) % 60) - 30,
  size: 6 + ((i * 0.7) % 8),
  color: ['#ec4899', '#a855f7', '#3b82f6', '#22c55e', '#fbbf24', '#f97316'][i % 6],
}));

export default function UnicornEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-unicorn-gallop-h {
          0%   { transform: translate3d(-25vw, 0, 0); }
          100% { transform: translate3d(110vw, 0, 0); }
        }
        @keyframes fx-unicorn-bob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50%      { transform: translateY(-12px) rotate(2deg); }
        }
        @keyframes fx-unicorn-mane {
          0%, 100% { transform: skewY(-3deg); }
          50%      { transform: skewY(3deg); }
        }
        @keyframes fx-unicorn-star {
          0%   { transform: translate3d(0, 0, 0) scale(0) rotate(0deg); opacity: 0; }
          15%  { transform: translate3d(0, var(--yo, 0px), 0) scale(1) rotate(180deg); opacity: 1; }
          100% { transform: translate3d(-30vw, calc(var(--yo, 0px) + 80px), 0) scale(0) rotate(720deg); opacity: 0; }
        }
        .fx-unicorn-wrap {
          position: absolute; bottom: 25vh;
          will-change: transform;
          animation: fx-unicorn-gallop-h 9s linear forwards;
        }
        .fx-unicorn-bob {
          animation: fx-unicorn-bob 0.4s ease-in-out infinite;
          will-change: transform;
        }
        .fx-unicorn-mane {
          animation: fx-unicorn-mane 0.5s ease-in-out infinite;
          transform-origin: 100% 50%;
        }
        .fx-unicorn-star {
          position: absolute; bottom: 25vh;
          width: var(--s, 8px); height: var(--s, 8px);
          background: var(--c, gold);
          clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
          will-change: transform, opacity;
          animation: fx-unicorn-star 3s ease-out forwards;
          animation-delay: var(--sd, 0s);
          filter: drop-shadow(0 0 8px var(--c, gold));
          mix-blend-mode: screen;
        }
      `}</style>
      <div className="fx-unicorn-wrap">
        <div className="fx-unicorn-bob">
          <svg viewBox="0 0 220 160" width="280" height="200">
            {/* Schweif — Regenbogen */}
            <g className="fx-unicorn-mane">
              <path d="M 30 80 Q 5 85 -10 70" stroke="#dc2626" strokeWidth="10" strokeLinecap="round" fill="none" />
              <path d="M 30 85 Q 0 95 -15 85" stroke="#f97316" strokeWidth="10" strokeLinecap="round" fill="none" />
              <path d="M 30 90 Q 0 105 -10 105" stroke="#fbbf24" strokeWidth="10" strokeLinecap="round" fill="none" />
              <path d="M 30 92 Q 5 115 0 125" stroke="#22c55e" strokeWidth="10" strokeLinecap="round" fill="none" />
              <path d="M 30 95 Q 10 125 15 135" stroke="#3b82f6" strokeWidth="10" strokeLinecap="round" fill="none" />
            </g>
            {/* Körper */}
            <ellipse cx="100" cy="95" rx="55" ry="32" fill="#ffffff" />
            <ellipse cx="100" cy="100" rx="50" ry="25" fill="#fce7f3" opacity="0.6" />
            {/* Beine (vorn galoppierend) */}
            <rect x="65" y="115" width="10" height="35" rx="3" fill="#fff" transform="rotate(-15 70 130)" />
            <rect x="130" y="115" width="10" height="35" rx="3" fill="#fff" transform="rotate(15 135 130)" />
            <rect x="80" y="115" width="10" height="35" rx="3" fill="#fff" transform="rotate(10 85 130)" />
            <rect x="115" y="115" width="10" height="35" rx="3" fill="#fff" transform="rotate(-10 120 130)" />
            {/* Hufe */}
            <ellipse cx="65" cy="153" rx="6" ry="3" fill="#a855f7" />
            <ellipse cx="138" cy="153" rx="6" ry="3" fill="#a855f7" />
            <ellipse cx="83" cy="153" rx="6" ry="3" fill="#a855f7" />
            <ellipse cx="118" cy="153" rx="6" ry="3" fill="#a855f7" />
            {/* Hals */}
            <path d="M 145 95 Q 160 75 175 75 L 180 105 Q 165 110 150 105 Z" fill="#fff" />
            {/* Kopf */}
            <ellipse cx="180" cy="68" rx="24" ry="20" fill="#fff" />
            <ellipse cx="186" cy="72" rx="6" ry="4" fill="#fce7f3" />
            {/* Mähne — Regenbogen-Bündel */}
            <g className="fx-unicorn-mane">
              <path d="M 165 55 Q 160 40 170 35" stroke="#dc2626" strokeWidth="8" strokeLinecap="round" fill="none" />
              <path d="M 170 52 Q 165 35 178 30" stroke="#f97316" strokeWidth="8" strokeLinecap="round" fill="none" />
              <path d="M 175 50 Q 175 30 188 28" stroke="#fbbf24" strokeWidth="8" strokeLinecap="round" fill="none" />
              <path d="M 180 50 Q 185 32 195 35" stroke="#22c55e" strokeWidth="8" strokeLinecap="round" fill="none" />
              <path d="M 185 52 Q 195 38 200 45" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round" fill="none" />
              <path d="M 152 80 Q 145 65 160 60" stroke="#a855f7" strokeWidth="8" strokeLinecap="round" fill="none" />
            </g>
            {/* Horn — golden */}
            <polygon points="178,38 180,15 184,38" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
            <line x1="180" y1="35" x2="181" y2="25" stroke="#f59e0b" strokeWidth="1" />
            <line x1="180" y1="30" x2="181.5" y2="22" stroke="#f59e0b" strokeWidth="1" />
            {/* Auge */}
            <circle cx="188" cy="65" r="2.5" fill="#1c1917" />
            <circle cx="189" cy="64" r="0.8" fill="#fff" />
            {/* Wange (rosa) */}
            <circle cx="195" cy="73" r="3" fill="#fbcfe8" opacity="0.7" />
            {/* Lächeln */}
            <path d="M 195 78 Q 198 81 200 79" stroke="#1c1917" strokeWidth="1" fill="none" strokeLinecap="round" />
            {/* Ohren */}
            <polygon points="170,52 167,42 175,48" fill="#fff" />
            <polygon points="171,50 169,45 173,48" fill="#fce7f3" />
          </svg>
        </div>
      </div>
      {STAR_TRAIL.map((s) => (
        <span
          key={s.id}
          className="fx-unicorn-star"
          style={{
            left: `${10 + (s.id * 1.4) % 80}%`,
            '--s': `${s.size}px`,
            '--c': s.color,
            '--yo': `${s.yOffset}px`,
            '--sd': `${s.spawnDelay}s`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}
