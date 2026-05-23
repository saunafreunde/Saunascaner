// Pinguine waddeln in einer Parade von links nach rechts + Schneefall. 11s.

const PENGUINS = Array.from({ length: 7 }, (_, i) => ({
  id: i,
  delay: i * 0.55,
  scale: 0.8 + (i % 3) * 0.1,
}));

const FLAKES = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  x: (i * 1.25) % 100,
  delay: i * 0.12,
  duration: 4 + (i % 4) * 1.2,
  size: 8 + (i % 4) * 4,
  drift: -30 + (i % 6) * 12,
}));

export default function PenguinParadeEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-penguin-walk {
          0%   { transform: translate3d(-20vw, 0, 0); }
          100% { transform: translate3d(115vw, 0, 0); }
        }
        @keyframes fx-penguin-waddle {
          0%, 100% { transform: rotate(-3deg); }
          50%      { transform: rotate(3deg); }
        }
        @keyframes fx-penguin-flipper {
          0%, 100% { transform: rotate(-10deg); }
          50%      { transform: rotate(10deg); }
        }
        @keyframes fx-snow-fall {
          0%   { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 0; }
          10%  { opacity: 0.9; }
          100% { transform: translate3d(var(--dr, 0), 110vh, 0) rotate(360deg); opacity: 0.4; }
        }
        @keyframes fx-snow-ground-build {
          0%   { transform: scaleY(0); opacity: 0; }
          100% { transform: scaleY(1); opacity: 0.9; }
        }
        .fx-penguin-wrap {
          position: absolute; bottom: 8vh; left: 0;
          will-change: transform;
          animation: fx-penguin-walk 11s linear forwards;
          animation-delay: var(--d, 0s);
        }
        .fx-penguin-waddle { animation: fx-penguin-waddle 0.45s ease-in-out infinite; }
        .fx-penguin-flipper-l { animation: fx-penguin-flipper 0.45s ease-in-out infinite; transform-origin: 100% 0; }
        .fx-penguin-flipper-r { animation: fx-penguin-flipper 0.45s ease-in-out infinite reverse; transform-origin: 0% 0; }
        .fx-snowflake {
          position: absolute; top: 0;
          width: var(--s, 8px); height: var(--s, 8px);
          will-change: transform, opacity;
          animation: fx-snow-fall var(--du, 5s) linear forwards;
          animation-delay: var(--d, 0s);
        }
        .fx-snow-ground {
          position: absolute; bottom: 0; left: 0; right: 0;
          height: 8vh;
          background: linear-gradient(180deg, rgba(255,255,255,0.95), rgba(241,245,249,0.85));
          border-radius: 50% 50% 0 0 / 25% 25% 0 0;
          transform-origin: bottom;
          animation: fx-snow-ground-build 3s ease-out forwards;
          box-shadow: 0 -4px 16px rgba(99,102,241,0.3);
        }
      `}</style>

      <div className="fx-snow-ground" />

      {/* Pinguin-Parade */}
      {PENGUINS.map((p) => (
        <div
          key={`peng-${p.id}`}
          className="fx-penguin-wrap"
          style={{
            transform: `scale(${p.scale})`,
            '--d': `${p.delay}s`,
          } as React.CSSProperties}
        >
          <div className="fx-penguin-waddle">
            <svg viewBox="0 0 100 130" width="100" height="130">
              {/* Körper — schwarzer Mantel */}
              <ellipse cx="50" cy="75" rx="35" ry="48" fill="#0f172a" />
              {/* Weißer Bauch */}
              <ellipse cx="50" cy="80" rx="22" ry="40" fill="#ffffff" />
              {/* Kopf */}
              <ellipse cx="50" cy="25" rx="25" ry="22" fill="#0f172a" />
              {/* Weiße Maske (Gesicht) */}
              <ellipse cx="50" cy="28" rx="15" ry="12" fill="#ffffff" />
              {/* Augen */}
              <circle cx="42" cy="22" r="3" fill="#ffffff" />
              <circle cx="58" cy="22" r="3" fill="#ffffff" />
              <circle cx="42" cy="22" r="1.5" fill="#0f172a" />
              <circle cx="58" cy="22" r="1.5" fill="#0f172a" />
              {/* Schnabel — orange */}
              <polygon points="44,30 56,30 50,42" fill="#f97316" stroke="#c2410c" strokeWidth="1" />
              {/* Wangen — rosa */}
              <ellipse cx="36" cy="32" rx="3" ry="2" fill="#fbcfe8" opacity="0.7" />
              <ellipse cx="64" cy="32" rx="3" ry="2" fill="#fbcfe8" opacity="0.7" />
              {/* Flossen (Flipper) — animiert */}
              <g className="fx-penguin-flipper-l" transform="translate(15, 60)">
                <ellipse cx="0" cy="15" rx="10" ry="20" fill="#0f172a" />
                <ellipse cx="0" cy="15" rx="6" ry="16" fill="#1e293b" />
              </g>
              <g className="fx-penguin-flipper-r" transform="translate(85, 60)">
                <ellipse cx="0" cy="15" rx="10" ry="20" fill="#0f172a" />
                <ellipse cx="0" cy="15" rx="6" ry="16" fill="#1e293b" />
              </g>
              {/* Füße */}
              <ellipse cx="40" cy="125" rx="8" ry="4" fill="#f97316" />
              <ellipse cx="60" cy="125" rx="8" ry="4" fill="#f97316" />
              {/* Krawatte (eleganter Tuxedo-Look) */}
              <polygon points="46,42 54,42 50,52" fill="#dc2626" />
              <polygon points="48,52 52,52 50,60" fill="#dc2626" />
            </svg>
          </div>
        </div>
      ))}

      {/* Schneeflocken */}
      {FLAKES.map((f) => (
        <span
          key={`flake-${f.id}`}
          className="fx-snowflake"
          style={{
            left: `${f.x}vw`,
            '--s': `${f.size}px`,
            '--d': `${f.delay}s`,
            '--du': `${f.duration}s`,
            '--dr': `${f.drift}px`,
            color: '#ffffff',
          } as React.CSSProperties}
        >
          <svg viewBox="0 0 24 24" width="100%" height="100%">
            <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="2" x2="12" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
              <line x1="12" y1="2" x2="9" y2="5" />
              <line x1="12" y1="2" x2="15" y2="5" />
              <line x1="12" y1="22" x2="9" y2="19" />
              <line x1="12" y1="22" x2="15" y2="19" />
            </g>
          </svg>
        </span>
      ))}
    </>
  );
}
