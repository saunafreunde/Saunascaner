// Cartoon-Monster springt von rechts ins Bild, brüllt (Größenpulsation),
// verschwindet links. Dauer 5s.

export default function MonsterScareEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-monster-cross {
          0%   { transform: translate3d(110vw, 0, 0) scale(1); opacity: 0; }
          15%  { transform: translate3d(60vw, 0, 0) scale(1.1); opacity: 1; }
          50%  { transform: translate3d(40vw, 0, 0) scale(1.3); opacity: 1; }
          85%  { transform: translate3d(10vw, 0, 0) scale(1); opacity: 1; }
          100% { transform: translate3d(-30vw, 0, 0) scale(0.9); opacity: 0; }
        }
        @keyframes fx-monster-roar {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
        .fx-monster-wrap {
          position: absolute; bottom: 40px;
          will-change: transform, opacity;
          animation: fx-monster-cross 5s ease-in-out forwards;
        }
        .fx-monster-body {
          animation: fx-monster-roar 0.4s ease-in-out infinite;
          transform-origin: 50% 100%;
          will-change: transform;
        }
        @keyframes fx-monster-flash {
          0%, 100% { background: transparent; }
          5%, 8%   { background: rgba(255, 50, 50, 0.25); }
        }
        .fx-monster-flash {
          position: absolute; inset: 0;
          animation: fx-monster-flash 5s ease-out forwards;
          pointer-events: none;
        }
      `}</style>
      <div className="fx-monster-flash" />
      <div className="fx-monster-wrap">
        <div className="fx-monster-body">
          <svg viewBox="0 0 140 160" width="200" height="220">
            {/* Körper */}
            <ellipse cx="70" cy="100" rx="48" ry="55" fill="#7c3aed" />
            {/* Hörner */}
            <polygon points="40,40 30,15 50,30" fill="#4c1d95" />
            <polygon points="100,40 110,15 90,30" fill="#4c1d95" />
            {/* Augen — riesig + rot */}
            <circle cx="50" cy="80" r="14" fill="#fff" />
            <circle cx="90" cy="80" r="14" fill="#fff" />
            <circle cx="52" cy="80" r="8" fill="#dc2626" />
            <circle cx="92" cy="80" r="8" fill="#dc2626" />
            <circle cx="54" cy="78" r="3" fill="#000" />
            <circle cx="94" cy="78" r="3" fill="#000" />
            {/* Reißzähne */}
            <polygon points="50,115 56,135 62,115" fill="#fff" />
            <polygon points="78,115 84,135 90,115" fill="#fff" />
            {/* Mund (riesig offen) */}
            <ellipse cx="70" cy="120" rx="22" ry="14" fill="#1c1917" />
            {/* Arme */}
            <ellipse cx="25" cy="105" rx="10" ry="20" fill="#7c3aed" />
            <ellipse cx="115" cy="105" rx="10" ry="20" fill="#7c3aed" />
            {/* Krallen */}
            <polygon points="15,120 20,135 25,120" fill="#000" />
            <polygon points="115,120 120,135 125,120" fill="#000" />
          </svg>
        </div>
      </div>
    </>
  );
}
