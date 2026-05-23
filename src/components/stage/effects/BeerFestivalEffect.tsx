// Oktoberfest — Maßkrüge mit Schaum fliegen, Brezeln + bayrische Raute. 12s.

const MUGS = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  x: 8 + (i * 7),
  delay: i * 0.4,
  scale: 0.7 + (i % 3) * 0.15,
  rotateDir: i % 2 ? 1 : -1,
}));

const PRETZELS = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  x: 5 + (i * 3.2) % 95,
  delay: 0.5 + i * 0.25,
  duration: 4 + (i % 3),
  rotateSpeed: 0.6 + (i % 4) * 0.2,
  size: 30 + (i % 4) * 15,
}));

const FOAM_DROPS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  delay: i * 0.15,
  x: (i * 1.3) % 100,
  size: 6 + (i % 4) * 3,
}));

export default function BeerFestivalEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-beer-mug-toss {
          0%   { transform: translate3d(-15vw, 110vh, 0) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          50%  { transform: translate3d(50vw, -10vh, 0) rotate(calc(180deg * var(--dir, 1))); }
          90%  { opacity: 1; }
          100% { transform: translate3d(115vw, 110vh, 0) rotate(calc(360deg * var(--dir, 1))); opacity: 0; }
        }
        @keyframes fx-beer-pretzel-fall {
          0%   { transform: translate3d(0, -15vh, 0) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translate3d(0, 110vh, 0) rotate(calc(540deg * var(--rs, 1))); opacity: 0.85; }
        }
        @keyframes fx-beer-foam-bubble {
          0%   { transform: translate3d(0, 0, 0) scale(0); opacity: 0; }
          10%  { opacity: 0.9; transform: translate3d(0, 0, 0) scale(1); }
          100% { transform: translate3d(0, -50vh, 0) scale(0.3); opacity: 0; }
        }
        @keyframes fx-beer-banner-bob {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50%      { transform: translateX(-50%) translateY(-10px); }
        }
        @keyframes fx-beer-raute-tile {
          0% { background-position: 0 0; }
          100% { background-position: 60px 60px; }
        }

        .fx-beer-bg {
          position: absolute; inset: 0;
          background-image: repeating-conic-gradient(from 0deg at 50% 50%, #1e3a8a 0deg 90deg, #ffffff 90deg 180deg);
          background-size: 60px 60px;
          opacity: 0.15;
          animation: fx-beer-raute-tile 8s linear infinite;
        }
        .fx-beer-mug {
          position: absolute; left: 0; bottom: 0;
          will-change: transform, opacity;
          animation: fx-beer-mug-toss 6s cubic-bezier(0.5, 0, 0.5, 1) forwards;
        }
        .fx-beer-pretzel {
          position: absolute; left: 0; top: 0;
          will-change: transform, opacity;
          animation: fx-beer-pretzel-fall var(--du, 5s) linear forwards;
          animation-delay: var(--d, 0s);
        }
        .fx-beer-foam {
          position: absolute; bottom: 50vh;
          width: var(--s, 8px); height: var(--s, 8px);
          background: radial-gradient(circle, #ffffff 0%, #fef3c7 50%, transparent 100%);
          border-radius: 50%;
          will-change: transform, opacity;
          animation: fx-beer-foam-bubble 3.5s ease-out forwards;
          animation-delay: var(--d, 0s);
          mix-blend-mode: screen;
        }
        .fx-beer-banner {
          position: absolute; top: 15vh; left: 50%;
          transform: translateX(-50%);
          will-change: transform;
          animation: fx-beer-banner-bob 1.2s ease-in-out infinite;
          font-size: clamp(36px, 7vw, 80px);
          font-weight: 900;
          color: #fbbf24;
          text-shadow:
            -3px -3px 0 #1e3a8a, 3px -3px 0 #1e3a8a,
            -3px 3px 0 #1e3a8a, 3px 3px 0 #1e3a8a,
            0 6px 20px rgba(0,0,0,0.5);
          letter-spacing: 0.05em;
          white-space: nowrap;
        }
      `}</style>

      <div className="fx-beer-bg" />
      <div className="fx-beer-banner">🍺 PROST! O'ZAPFT IS! 🥨</div>

      {/* Fliegende Maßkrüge */}
      {MUGS.map((m) => (
        <div
          key={`mug-${m.id}`}
          className="fx-beer-mug"
          style={{
            left: `${m.x}vw`,
            transform: `scale(${m.scale})`,
            animationDelay: `${m.delay}s`,
            '--dir': m.rotateDir,
          } as React.CSSProperties}
        >
          <svg viewBox="0 0 100 130" width="100" height="130">
            {/* Schaum-Krone oben */}
            <ellipse cx="50" cy="20" rx="34" ry="14" fill="#ffffff" />
            <ellipse cx="40" cy="14" rx="14" ry="10" fill="#ffffff" />
            <ellipse cx="60" cy="14" rx="12" ry="9" fill="#ffffff" />
            <ellipse cx="50" cy="10" rx="10" ry="7" fill="#fef3c7" />
            {/* Krug-Korpus */}
            <rect x="18" y="25" width="62" height="85" rx="4" fill="#fbbf24" />
            <rect x="22" y="29" width="54" height="77" rx="2" fill="#f59e0b" />
            {/* Bier-Inhalt (Reflex) */}
            <rect x="26" y="32" width="46" height="70" rx="1" fill="#fde047" opacity="0.7" />
            <rect x="28" y="34" width="8" height="65" rx="1" fill="#ffffff" opacity="0.3" />
            {/* Henkel */}
            <path d="M 80,40 Q 100,40 100,65 Q 100,90 80,95" stroke="#ca8a04" strokeWidth="8" fill="none" />
            <path d="M 80,40 Q 96,40 96,65 Q 96,90 80,90" stroke="#fbbf24" strokeWidth="4" fill="none" />
            {/* Boden */}
            <ellipse cx="50" cy="115" rx="32" ry="6" fill="#854d0e" />
          </svg>
        </div>
      ))}

      {/* Brezel-Regen */}
      {PRETZELS.map((p) => (
        <div
          key={`pretzel-${p.id}`}
          className="fx-beer-pretzel"
          style={{
            left: `${p.x}vw`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            '--du': `${p.duration}s`,
            '--d': `${p.delay}s`,
            '--rs': p.rotateSpeed,
          } as React.CSSProperties}
        >
          <svg viewBox="0 0 60 60" width="100%" height="100%">
            {/* Brezel — vereinfachte Form */}
            <path
              d="M 30,8 Q 12,8 12,25 Q 12,40 30,42 Q 48,40 48,25 Q 48,8 30,8 Z M 18,32 Q 25,40 35,46 M 42,32 Q 35,40 25,46"
              stroke="#854d0e"
              strokeWidth="6"
              fill="#a16207"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Salz-Körner */}
            <circle cx="18" cy="20" r="1.5" fill="#ffffff" />
            <circle cx="40" cy="22" r="1.5" fill="#ffffff" />
            <circle cx="25" cy="35" r="1.5" fill="#ffffff" />
            <circle cx="35" cy="35" r="1.5" fill="#ffffff" />
          </svg>
        </div>
      ))}

      {/* Schaum-Bläschen aufsteigend */}
      {FOAM_DROPS.map((f) => (
        <span
          key={`foam-${f.id}`}
          className="fx-beer-foam"
          style={{
            left: `${f.x}vw`,
            '--s': `${f.size}px`,
            '--d': `${f.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}
