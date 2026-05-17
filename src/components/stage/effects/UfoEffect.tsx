// UFO mit Lichtstrahl fliegt langsam horizontal. Dauer 8s.

export default function UfoEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-ufo-cross {
          0%   { transform: translate3d(-15vw, 0, 0); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translate3d(115vw, 0, 0); opacity: 0; }
        }
        @keyframes fx-ufo-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes fx-ufo-beam {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 0.6; }
        }
        @keyframes fx-ufo-lights {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50%      { transform: scale(1.4); opacity: 1; }
        }
        .fx-ufo-wrap {
          position: absolute; top: 12%;
          will-change: transform, opacity;
          animation: fx-ufo-cross 8s linear forwards;
        }
        .fx-ufo-bob { animation: fx-ufo-bob 1.6s ease-in-out infinite; }
        .fx-ufo-beam { animation: fx-ufo-beam 1.2s ease-in-out infinite; }
        .fx-ufo-light {
          animation: fx-ufo-lights 1s ease-in-out infinite;
          transform-origin: 50% 50%;
        }
      `}</style>
      <div className="fx-ufo-wrap">
        <div className="fx-ufo-bob">
          <svg viewBox="0 0 140 220" width="160" height="240">
            {/* Lichtstrahl */}
            <polygon
              className="fx-ufo-beam"
              points="50,75 90,75 130,220 10,220"
              fill="rgba(200,230,255,0.4)"
            />
            {/* Untertasse */}
            <ellipse cx="70" cy="60" rx="55" ry="14" fill="#9ca3af" />
            <ellipse cx="70" cy="50" rx="35" ry="20" fill="#6b7280" />
            {/* Kuppel */}
            <ellipse cx="70" cy="38" rx="22" ry="18" fill="#a5b4fc" opacity="0.85" />
            {/* Lichter unten */}
            <circle className="fx-ufo-light" cx="35" cy="70" r="3" fill="#fde047" style={{ animationDelay: '0s' } as React.CSSProperties} />
            <circle className="fx-ufo-light" cx="55" cy="74" r="3" fill="#ef4444" style={{ animationDelay: '-0.25s' } as React.CSSProperties} />
            <circle className="fx-ufo-light" cx="75" cy="74" r="3" fill="#22c55e" style={{ animationDelay: '-0.5s' } as React.CSSProperties} />
            <circle className="fx-ufo-light" cx="95" cy="74" r="3" fill="#3b82f6" style={{ animationDelay: '-0.75s' } as React.CSSProperties} />
            <circle className="fx-ufo-light" cx="115" cy="70" r="3" fill="#a855f7" style={{ animationDelay: '-0.4s' } as React.CSSProperties} />
          </svg>
        </div>
      </div>
    </>
  );
}
