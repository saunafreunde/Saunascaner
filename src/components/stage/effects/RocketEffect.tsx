// Rakete fliegt schräg von links-unten nach rechts-oben mit Streifen. Dauer 6s.

export default function RocketEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-rocket-fly {
          0%   { transform: translate3d(-10vw, 80vh, 0) rotate(-45deg); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translate3d(110vw, -20vh, 0) rotate(-45deg); opacity: 0; }
        }
        @keyframes fx-rocket-flame {
          0%, 100% { transform: scaleY(1); opacity: 0.9; }
          50%      { transform: scaleY(1.4); opacity: 1; }
        }
        .fx-rocket-wrap {
          position: absolute; top: 0; left: 0;
          will-change: transform, opacity;
          animation: fx-rocket-fly 6s ease-in-out forwards;
        }
        .fx-rocket-flame {
          animation: fx-rocket-flame 0.15s ease-in-out infinite;
          transform-origin: 50% 0%;
        }
      `}</style>
      <div className="fx-rocket-wrap">
        <svg viewBox="0 0 60 100" width="60" height="100">
          {/* Streifen */}
          <ellipse cx="30" cy="85" rx="6" ry="20" fill="rgba(255,255,255,0.3)" />
          {/* Flamme */}
          <ellipse className="fx-rocket-flame" cx="30" cy="68" rx="10" ry="18" fill="#fb923c" />
          <ellipse className="fx-rocket-flame" cx="30" cy="68" rx="6"  ry="12" fill="#fde047" />
          {/* Körper */}
          <ellipse cx="30" cy="40" rx="11" ry="28" fill="#e5e7eb" />
          {/* Spitze */}
          <polygon points="30,8 22,30 38,30" fill="#dc2626" />
          {/* Fenster */}
          <circle cx="30" cy="38" r="5" fill="#60a5fa" stroke="#1e3a8a" strokeWidth="1.2" />
          {/* Finnen */}
          <polygon points="19,60 8,75 19,70" fill="#dc2626" />
          <polygon points="41,60 52,75 41,70" fill="#dc2626" />
        </svg>
      </div>
    </>
  );
}
