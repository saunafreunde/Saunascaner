// Zwei Segelflieger ziehen ihre Bahnen über die gesamte Schwarzwald-Bühne.
// Pure-CSS-Animation, GPU-only (transform + opacity).
export function Gliders() {
  return (
    <div
      className="absolute inset-x-0 pointer-events-none"
      style={{ top: -80, height: 90, overflow: 'hidden' }}
    >
      <style>{`
        @keyframes glider-1 {
          0%   { transform: translate(-120px, 0); }
          50%  { transform: translate(50vw, -8px); }
          100% { transform: translate(calc(100vw + 120px), 4px); }
        }
        @keyframes glider-2 {
          0%   { transform: translate(calc(100vw + 100px), 0); }
          50%  { transform: translate(40vw, 12px); }
          100% { transform: translate(-100px, -6px); }
        }
        @keyframes glider-bank {
          0%, 100% { transform: rotate(-2deg); }
          50%      { transform: rotate(2deg); }
        }

        .glider-path-1 { animation: glider-1 110s infinite linear; }
        .glider-path-2 { animation: glider-2 88s infinite linear; animation-delay: -22s; }
        .glider-bank   { transform-origin: center; animation: glider-bank 14s infinite ease-in-out; }

        @media (prefers-reduced-motion: reduce) {
          .glider-path-1, .glider-path-2, .glider-bank { animation: none; }
        }
      `}</style>

      {/* Segelflieger 1 — weiß, größer, fliegt links → rechts */}
      <div className="absolute" style={{ top: 8, left: 0 }}>
        <div className="glider-path-1">
          <div className="glider-bank">
            <Sailplane width={56} primary="#f5f5f5" accent="#dc2626" />
          </div>
        </div>
      </div>

      {/* Segelflieger 2 — gelb, kleiner, fliegt rechts → links, etwas tiefer */}
      <div className="absolute" style={{ top: 38, left: 0 }}>
        <div className="glider-path-2">
          <div className="glider-bank" style={{ animationDelay: '-7s' }}>
            <Sailplane width={42} primary="#fde047" accent="#1d4ed8" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Sailplane({ width, primary, accent }: { width: number; primary: string; accent: string }) {
  const h = width * 0.42;
  return (
    <svg
      width={width}
      height={h}
      viewBox="0 0 100 42"
      style={{ overflow: 'visible', display: 'block', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.25))' }}
    >
      {/* Lange schmale Flügel (typisch Segelflieger) */}
      <ellipse cx="50" cy="20" rx="46" ry="2.4" fill={primary} stroke="#1a1a1a" strokeWidth="0.6" />
      {/* Flügel-Highlight */}
      <ellipse cx="50" cy="19" rx="40" ry="0.8" fill="rgba(255,255,255,0.6)" />
      {/* Akzentstreifen */}
      <line x1="4" y1="20" x2="96" y2="20" stroke={accent} strokeWidth="0.6" opacity="0.85" />
      {/* Rumpf */}
      <path
        d="M 30 19 L 70 18 Q 82 18.5 88 21 Q 82 22.5 70 22 L 30 21 Z"
        fill={primary}
        stroke="#1a1a1a"
        strokeWidth="0.6"
      />
      <path d="M 30 19 L 70 18 Q 82 18.5 88 21 Q 82 22.5 70 22 L 30 21 Z" fill="rgba(0,0,0,0.08)" />
      {/* Cockpit-Glas */}
      <path d="M 64 18 Q 75 16 84 19 L 80 20 L 67 20 Z" fill="#0891b2" opacity="0.85" stroke="#1a1a1a" strokeWidth="0.4" />
      <path d="M 66 18 Q 73 17 80 19 L 78 19.4 L 68 19.4 Z" fill="rgba(255,255,255,0.4)" />
      {/* Pilot-Andeutung */}
      <circle cx="76" cy="19" r="1" fill="#1a0e05" />
      {/* Akzent am Rumpf */}
      <rect x="34" y="20" width="22" height="0.7" fill={accent} opacity="0.85" />
      {/* Leitwerk hinten */}
      <polygon points="22,16 32,20 22,20" fill={primary} stroke="#1a1a1a" strokeWidth="0.5" />
      <polygon points="22,16 26,18 22,20" fill={accent} opacity="0.9" />
      {/* Höhenleitwerk */}
      <ellipse cx="24" cy="20" rx="6" ry="0.8" fill={primary} stroke="#1a1a1a" strokeWidth="0.5" />
      {/* Nasen-Spitze */}
      <ellipse cx="88" cy="20.5" rx="2.5" ry="1" fill={accent} stroke="#1a1a1a" strokeWidth="0.4" />
    </svg>
  );
}
