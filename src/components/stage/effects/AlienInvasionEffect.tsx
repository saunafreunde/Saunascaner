// Alien-Invasion — 3 UFOs landen + hüpfende grüne Aliens + Laser-Strahlen. 12s.

const ALIENS = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  x: 12 + (i * 7),
  hopDelay: i * 0.15,
  size: 0.6 + (i % 4) * 0.1,
}));

const LASERS = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  ufoIdx: i % 3,
  delay: 1 + i * 0.9,
  angle: -60 + i * 18,
}));

export default function AlienInvasionEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-alien-ufo-arrive {
          0%   { transform: translateY(-200vh) rotate(-10deg); }
          30%  { transform: translateY(0) rotate(5deg); }
          50%  { transform: translateY(-10px) rotate(-3deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        @keyframes fx-alien-ufo-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(8px); }
        }
        @keyframes fx-alien-ufo-light {
          0%, 100% { opacity: 0.4; transform: scaleX(0.8); }
          50%      { opacity: 0.85; transform: scaleX(1.1); }
        }
        @keyframes fx-alien-hop {
          0%, 100% { transform: translateY(0) scaleY(1); }
          40%      { transform: translateY(-30px) scaleY(1.1); }
          70%      { transform: translateY(0) scaleY(0.9); }
        }
        @keyframes fx-alien-laser {
          0%   { transform: scaleY(0); opacity: 0; }
          20%  { transform: scaleY(1); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: scaleY(1); opacity: 0; }
        }
        @keyframes fx-alien-laser-flash {
          0%, 100% { filter: drop-shadow(0 0 8px #22c55e); }
          50%      { filter: drop-shadow(0 0 20px #22c55e) drop-shadow(0 0 40px #4ade80); }
        }
        .fx-alien-ufo {
          position: absolute; top: 10vh;
          will-change: transform;
          animation: fx-alien-ufo-arrive 2.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .fx-alien-ufo-inner { animation: fx-alien-ufo-bob 1.8s ease-in-out infinite; animation-delay: 2.5s; }
        .fx-alien-light {
          transform-origin: 50% 0;
          animation: fx-alien-ufo-light 1.2s ease-in-out infinite;
          mix-blend-mode: screen;
        }
        .fx-alien-creature {
          position: absolute; bottom: 8vh;
          will-change: transform; opacity: 0;
          animation: fx-alien-hop 0.6s ease-in-out infinite, fx-alien-appear 0.5s ease-out forwards;
          animation-delay: var(--d, 0s), var(--ad, 2s);
        }
        @keyframes fx-alien-appear {
          0% { opacity: 0; transform: scale(0); }
          100% { opacity: 1; transform: scale(1); }
        }
        .fx-alien-laser-beam {
          position: absolute;
          width: 6px; transform-origin: 50% 0;
          background: linear-gradient(180deg, rgba(34,197,94,0.95), rgba(74,222,128,0.4) 60%, transparent);
          border-radius: 3px;
          will-change: transform, opacity;
          animation: fx-alien-laser 0.4s ease-out forwards, fx-alien-laser-flash 0.4s ease-in-out infinite;
          animation-delay: var(--d, 0s), var(--d, 0s);
        }
      `}</style>

      {/* 3 UFOs */}
      {[0, 1, 2].map((ufoIdx) => {
        const xVw = 20 + ufoIdx * 30;
        return (
          <div
            key={`ufo-${ufoIdx}`}
            className="fx-alien-ufo"
            style={{ left: `${xVw}vw`, animationDelay: `${ufoIdx * 0.4}s` }}
          >
            <div className="fx-alien-ufo-inner">
              <svg viewBox="0 0 200 100" width="200" height="100">
                {/* Lichtstrahl (Beam) nach unten */}
                <polygon
                  className="fx-alien-light"
                  points="60,50 140,50 180,180 20,180"
                  fill="url(#fx-alien-beam-grad)"
                />
                <defs>
                  <linearGradient id="fx-alien-beam-grad" x1="50%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" stopColor="#86efac" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* UFO-Unterseite (Disc) */}
                <ellipse cx="100" cy="55" rx="80" ry="14" fill="#94a3b8" />
                <ellipse cx="100" cy="50" rx="80" ry="14" fill="#cbd5e1" />
                {/* UFO-Kuppel */}
                <path d="M 50,50 Q 50,18 100,18 Q 150,18 150,50 Z" fill="#475569" opacity="0.85" />
                <path d="M 60,46 Q 60,28 100,28 Q 140,28 140,46 Z" fill="#0ea5e9" opacity="0.6" />
                {/* Lichter unten */}
                <circle cx="50" cy="55" r="3" fill="#fbbf24" />
                <circle cx="80" cy="58" r="3" fill="#22c55e" />
                <circle cx="120" cy="58" r="3" fill="#ec4899" />
                <circle cx="150" cy="55" r="3" fill="#3b82f6" />
              </svg>
            </div>
          </div>
        );
      })}

      {/* Hüpfende Aliens */}
      {ALIENS.map((a) => (
        <div
          key={`alien-${a.id}`}
          className="fx-alien-creature"
          style={{
            left: `${a.x}vw`,
            transform: `scale(${a.size})`,
            '--d': `${a.hopDelay}s`,
            '--ad': `${2 + a.hopDelay * 0.3}s`,
          } as React.CSSProperties}
        >
          <svg viewBox="0 0 60 80" width="60" height="80">
            {/* Körper */}
            <ellipse cx="30" cy="55" rx="18" ry="20" fill="#16a34a" />
            <ellipse cx="30" cy="55" rx="14" ry="16" fill="#22c55e" opacity="0.7" />
            {/* Kopf — groß und oval */}
            <ellipse cx="30" cy="25" rx="20" ry="22" fill="#16a34a" />
            <ellipse cx="30" cy="22" rx="16" ry="18" fill="#22c55e" />
            {/* Antenne */}
            <line x1="30" y1="5" x2="30" y2="-2" stroke="#16a34a" strokeWidth="2" />
            <circle cx="30" cy="-5" r="3" fill="#fbbf24" />
            {/* Riesige Augen */}
            <ellipse cx="22" cy="22" rx="6" ry="8" fill="#1c1917" />
            <ellipse cx="38" cy="22" rx="6" ry="8" fill="#1c1917" />
            <circle cx="23" cy="20" r="2" fill="#ffffff" />
            <circle cx="39" cy="20" r="2" fill="#ffffff" />
            {/* Mini-Mund */}
            <line x1="27" y1="36" x2="33" y2="36" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round" />
            {/* Arme */}
            <line x1="13" y1="50" x2="5" y2="65" stroke="#16a34a" strokeWidth="5" strokeLinecap="round" />
            <line x1="47" y1="50" x2="55" y2="65" stroke="#16a34a" strokeWidth="5" strokeLinecap="round" />
            {/* 3 Finger pro Hand */}
            <circle cx="5" cy="68" r="2" fill="#22c55e" />
            <circle cx="55" cy="68" r="2" fill="#22c55e" />
            {/* Beine */}
            <line x1="22" y1="73" x2="20" y2="80" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" />
            <line x1="38" y1="73" x2="40" y2="80" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
      ))}

      {/* Laser-Strahlen aus UFOs */}
      {LASERS.map((l) => {
        const ufoX = 20 + l.ufoIdx * 30;
        return (
          <div
            key={`laser-${l.id}`}
            className="fx-alien-laser-beam"
            style={{
              top: '18vh',
              left: `calc(${ufoX}vw + 100px)`,
              height: '60vh',
              transform: `rotate(${l.angle}deg)`,
              '--d': `${l.delay}s`,
            } as React.CSSProperties}
          />
        );
      })}
    </>
  );
}
