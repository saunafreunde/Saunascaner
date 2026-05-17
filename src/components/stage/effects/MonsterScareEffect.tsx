// EPISCHER Monster-Schreck: RIESIGES Monster springt rein, Screen-Shake,
// roter Background-Flash, blut-rotes Vignette. Dauer 5s.

export default function MonsterScareEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-monster-cross {
          0%   { transform: translate3d(110vw, 20vh, 0) scale(1) rotate(-15deg); opacity: 0; }
          10%  { transform: translate3d(70vw, 0, 0) scale(1.2) rotate(-5deg); opacity: 1; }
          35%  { transform: translate3d(35vw, -5vh, 0) scale(1.6) rotate(3deg); opacity: 1; }
          65%  { transform: translate3d(25vw, 0, 0) scale(1.4) rotate(-3deg); opacity: 1; }
          90%  { transform: translate3d(-10vw, 5vh, 0) scale(1) rotate(8deg); opacity: 1; }
          100% { transform: translate3d(-40vw, 10vh, 0) scale(0.8) rotate(15deg); opacity: 0; }
        }
        @keyframes fx-monster-roar {
          0%, 100% { transform: scale(1); }
          40%      { transform: scale(1.12) rotate(-2deg); }
          60%      { transform: scale(1.08) rotate(2deg); }
        }
        @keyframes fx-monster-flash {
          0%, 100% { background: transparent; }
          5%, 8%   { background: rgba(220, 38, 38, 0.55); }
          15%, 18% { background: rgba(220, 38, 38, 0.35); }
          40%, 43% { background: rgba(140, 0, 0, 0.30); }
        }
        @keyframes fx-monster-shake {
          0%, 100% { transform: translate(0, 0); }
          10%      { transform: translate(-8px, 4px); }
          20%      { transform: translate(7px, -3px); }
          30%      { transform: translate(-6px, 5px); }
          40%      { transform: translate(8px, -4px); }
          50%      { transform: translate(-5px, 3px); }
          60%      { transform: translate(6px, -2px); }
          70%      { transform: translate(-4px, 4px); }
          80%      { transform: translate(3px, -2px); }
          90%      { transform: translate(-2px, 1px); }
        }
        @keyframes fx-monster-vignette {
          0%, 100% { opacity: 0; }
          20%, 70% { opacity: 1; }
        }
        .fx-monster-shake-wrap {
          position: absolute; inset: 0;
          animation: fx-monster-shake 0.4s ease-in-out 5;
          animation-delay: 0.2s;
        }
        .fx-monster-flash {
          position: absolute; inset: 0;
          animation: fx-monster-flash 5s ease-out forwards;
          pointer-events: none;
          mix-blend-mode: multiply;
        }
        .fx-monster-vignette {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at center, transparent 30%, rgba(80,0,0,0.7) 100%);
          animation: fx-monster-vignette 5s ease-in-out forwards;
          pointer-events: none;
        }
        .fx-monster-wrap {
          position: absolute; bottom: 10vh;
          will-change: transform, opacity;
          animation: fx-monster-cross 5s ease-in-out forwards;
        }
        .fx-monster-body {
          animation: fx-monster-roar 0.5s ease-in-out infinite;
          transform-origin: 50% 100%;
          will-change: transform;
          filter: drop-shadow(0 0 30px rgba(124, 58, 237, 0.6)) drop-shadow(0 10px 20px rgba(0,0,0,0.8));
        }
      `}</style>
      <div className="fx-monster-vignette" />
      <div className="fx-monster-flash" />
      <div className="fx-monster-shake-wrap">
        <div className="fx-monster-wrap">
          <div className="fx-monster-body">
            <svg viewBox="0 0 140 180" width="380" height="490">
              {/* Klauen am Boden */}
              <polygon points="10,170 25,150 40,170" fill="#4c1d95" />
              <polygon points="100,170 115,150 130,170" fill="#4c1d95" />
              {/* Körper */}
              <ellipse cx="70" cy="115" rx="55" ry="62" fill="#7c3aed" />
              <ellipse cx="70" cy="115" rx="48" ry="55" fill="#6d28d9" />
              {/* Bauch-Highlight */}
              <ellipse cx="70" cy="125" rx="30" ry="35" fill="#8b5cf6" opacity="0.6" />
              {/* Hörner — größer + spitzer */}
              <polygon points="38,45 25,8 50,32" fill="#3b0764" />
              <polygon points="102,45 115,8 90,32" fill="#3b0764" />
              <polygon points="40,42 30,15 48,30" fill="#581c87" />
              <polygon points="100,42 110,15 92,30" fill="#581c87" />
              {/* Augen — riesig, glühend rot */}
              <circle cx="48" cy="85" r="18" fill="#fef2f2" filter="drop-shadow(0 0 12px #fff)" />
              <circle cx="92" cy="85" r="18" fill="#fef2f2" filter="drop-shadow(0 0 12px #fff)" />
              <circle cx="50" cy="85" r="11" fill="#dc2626" filter="drop-shadow(0 0 18px #dc2626)" />
              <circle cx="94" cy="85" r="11" fill="#dc2626" filter="drop-shadow(0 0 18px #dc2626)" />
              <circle cx="52" cy="82" r="4" fill="#000" />
              <circle cx="96" cy="82" r="4" fill="#000" />
              <circle cx="54" cy="80" r="1.5" fill="#fff" />
              <circle cx="98" cy="80" r="1.5" fill="#fff" />
              {/* Riesiger offener Mund */}
              <ellipse cx="70" cy="140" rx="32" ry="22" fill="#1c1917" />
              <ellipse cx="70" cy="140" rx="28" ry="18" fill="#7f1d1d" />
              {/* Zähne — viele, scharf */}
              <polygon points="48,128 52,148 56,128" fill="#fff" />
              <polygon points="58,128 62,152 66,128" fill="#fff" />
              <polygon points="68,128 72,154 76,128" fill="#fff" />
              <polygon points="78,128 82,152 86,128" fill="#fff" />
              <polygon points="88,128 92,148 96,128" fill="#fff" />
              {/* Untere Zähne */}
              <polygon points="50,152 54,142 58,152" fill="#fff" />
              <polygon points="62,154 66,144 70,154" fill="#fff" />
              <polygon points="74,154 78,144 82,154" fill="#fff" />
              <polygon points="86,152 90,142 94,152" fill="#fff" />
              {/* Arme — krallend */}
              <ellipse cx="18" cy="115" rx="14" ry="32" fill="#7c3aed" transform="rotate(-18 18 115)" />
              <ellipse cx="122" cy="115" rx="14" ry="32" fill="#7c3aed" transform="rotate(18 122 115)" />
              {/* Krallen */}
              <polygon points="5,148 12,165 18,148" fill="#000" />
              <polygon points="18,150 22,168 28,150" fill="#000" />
              <polygon points="122,150 128,168 132,150" fill="#000" />
              <polygon points="132,148 138,165 145,148" fill="#000" />
            </svg>
          </div>
        </div>
      </div>
    </>
  );
}
