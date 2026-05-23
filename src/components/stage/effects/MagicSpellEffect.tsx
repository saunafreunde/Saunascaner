// Magic-Spell — Zauberhut in der Mitte, magische Runen wirbeln, Pentagramm
// zeichnet sich, Sterne explodieren. 10s.

const SPARKLES = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  delay: 2 + i * 0.06,
  angle: i * 4.5,
  distance: 100 + (i % 5) * 60,
  size: 8 + (i % 4) * 4,
  color: ['#a855f7', '#3b82f6', '#ec4899', '#fbbf24', '#22c55e'][i % 5],
}));

const RUNES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  angle: i * 30,
  delay: 1 + i * 0.1,
  glyph: ['◇', '☆', '✦', '✧', '✺', '✹', '◈', '✱', '✶', '❋', '✳', '✴'][i],
}));

export default function MagicSpellEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-magic-hat-rise {
          0%   { transform: translate(-50%, 100vh) rotate(0deg); }
          15%  { transform: translate(-50%, 50%) rotate(-8deg); }
          25%  { transform: translate(-50%, 50%) rotate(8deg); }
          35%  { transform: translate(-50%, 50%) rotate(-3deg); }
          100% { transform: translate(-50%, 50%) rotate(0deg); }
        }
        @keyframes fx-magic-pentagram-draw {
          0%   { stroke-dashoffset: 1000; opacity: 0; }
          15%  { opacity: 0.8; }
          100% { stroke-dashoffset: 0; opacity: 0.95; }
        }
        @keyframes fx-magic-rune-orbit {
          0%   { transform: rotate(0deg) translateX(180px) rotate(0deg); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: rotate(720deg) translateX(180px) rotate(-720deg); opacity: 0.8; }
        }
        @keyframes fx-magic-sparkle-burst {
          0%   { transform: rotate(var(--a, 0deg)) translateX(0) scale(0); opacity: 0; }
          20%  { opacity: 1; transform: rotate(var(--a, 0deg)) translateX(20px) scale(1); }
          100% { transform: rotate(var(--a, 0deg)) translateX(var(--dist, 200px)) scale(0); opacity: 0; }
        }
        @keyframes fx-magic-bg-pulse {
          0%, 100% { opacity: 0.15; }
          50%      { opacity: 0.5; }
        }

        .fx-magic-bg {
          position: absolute; inset: 0;
          background:
            radial-gradient(circle at 50% 50%, rgba(168,85,247,0.5) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(30,27,75,0.6) 50%, transparent 70%);
          pointer-events: none;
          animation: fx-magic-bg-pulse 1.2s ease-in-out infinite;
        }
        .fx-magic-hat {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, 50%);
          will-change: transform;
          animation: fx-magic-hat-rise 2.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .fx-magic-pentagram {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          stroke-dasharray: 1000;
          will-change: stroke-dashoffset, opacity;
          animation: fx-magic-pentagram-draw 4s ease-in-out 1.5s forwards;
          filter: drop-shadow(0 0 18px #a855f7) drop-shadow(0 0 40px #ec4899);
        }
        .fx-magic-rune-wrap {
          position: absolute; top: 50%; left: 50%;
          width: 0; height: 0;
        }
        .fx-magic-rune {
          position: absolute;
          font-size: 36px; font-weight: 900;
          color: #fbbf24;
          text-shadow: 0 0 10px #a855f7, 0 0 20px #ec4899;
          will-change: transform, opacity;
          animation: fx-magic-rune-orbit 6s linear forwards;
          animation-delay: var(--d, 0s);
        }
        .fx-magic-sparkle {
          position: absolute; top: 50%; left: 50%;
          width: var(--s, 12px); height: var(--s, 12px);
          background: radial-gradient(circle, #ffffff 0%, var(--c, #a855f7) 50%, transparent 100%);
          border-radius: 50%;
          will-change: transform, opacity;
          animation: fx-magic-sparkle-burst 3.5s ease-out forwards;
          animation-delay: var(--d, 0s);
          mix-blend-mode: screen;
          filter: drop-shadow(0 0 6px var(--c, #a855f7));
        }
      `}</style>

      <div className="fx-magic-bg" />

      {/* Pentagramm — Linien zeichnen sich */}
      <svg
        className="fx-magic-pentagram"
        width="500"
        height="500"
        viewBox="-100 -100 200 200"
      >
        <polygon
          points="0,-80 47,65 -76,-25 76,-25 -47,65"
          fill="none"
          stroke="#a855f7"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle
          cx="0" cy="0" r="85"
          fill="none"
          stroke="#a855f7"
          strokeWidth="2"
          opacity="0.7"
        />
      </svg>

      {/* Zauberhut */}
      <div className="fx-magic-hat">
        <svg viewBox="0 0 200 250" width="200" height="250">
          {/* Hutkrempe */}
          <ellipse cx="100" cy="220" rx="95" ry="14" fill="#1e1b4b" stroke="#0f0a3e" strokeWidth="2" />
          {/* Hutkegel */}
          <path d="M 30,220 Q 50,180 75,130 Q 95,75 105,20 Q 120,80 135,135 Q 155,180 170,220 Z" fill="#312e81" />
          <path d="M 35,220 Q 55,180 80,130 Q 100,75 105,25 Q 115,80 130,135 Q 150,180 165,220 Z" fill="#1e1b4b" opacity="0.6" />
          {/* Stern auf dem Hut */}
          <polygon points="100,80 105,95 120,95 108,105 113,120 100,110 87,120 92,105 80,95 95,95" fill="#fbbf24" stroke="#854d0e" strokeWidth="1" />
          {/* Mond */}
          <path d="M 70,150 A 12 12 0 1 0 78 162 A 8 8 0 1 1 70 150 Z" fill="#fbbf24" />
          {/* Mini-Sterne */}
          <circle cx="125" cy="155" r="2" fill="#fbbf24" />
          <circle cx="50" cy="200" r="1.5" fill="#fbbf24" />
          <circle cx="145" cy="195" r="1.5" fill="#fbbf24" />
          {/* Goldener Saum */}
          <ellipse cx="100" cy="218" rx="95" ry="6" fill="#fbbf24" opacity="0.85" />
        </svg>
      </div>

      {/* Magische Runen — orbital */}
      <div className="fx-magic-rune-wrap">
        {RUNES.map((r) => (
          <span
            key={`rune-${r.id}`}
            className="fx-magic-rune"
            style={{
              transform: `rotate(${r.angle}deg) translateX(180px) rotate(${-r.angle}deg)`,
              '--d': `${r.delay}s`,
            } as React.CSSProperties}
          >
            {r.glyph}
          </span>
        ))}
      </div>

      {/* Funken-Burst aus der Mitte */}
      {SPARKLES.map((s) => (
        <span
          key={`spk-${s.id}`}
          className="fx-magic-sparkle"
          style={{
            '--a': `${s.angle}deg`,
            '--dist': `${s.distance}px`,
            '--s': `${s.size}px`,
            '--c': s.color,
            '--d': `${s.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}
