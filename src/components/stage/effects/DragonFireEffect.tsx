// Drache fliegt diagonal über die Tafel + atmet Flammenstrahl + Funken-Trail.
// Pure-CSS, 10s.

const SPARKS = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  delay: i * 0.18,
  x: 10 + (i * 2.3) % 80,
  size: 4 + (i % 5),
}));

export default function DragonFireEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-dragon-fly {
          0%   { transform: translate3d(-30vw, -10vh, 0) rotate(8deg); }
          100% { transform: translate3d(120vw, 50vh, 0) rotate(-4deg); }
        }
        @keyframes fx-dragon-wing {
          0%, 100% { transform: scaleY(1) translateY(0); }
          50%      { transform: scaleY(-0.4) translateY(-6px); }
        }
        @keyframes fx-dragon-flame-pulse {
          0%, 100% { transform: scaleX(1); opacity: 0.85; }
          50%      { transform: scaleX(1.3); opacity: 1; }
        }
        @keyframes fx-dragon-spark {
          0%   { transform: translate3d(0, 0, 0) scale(0); opacity: 0; }
          15%  { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
          100% { transform: translate3d(80px, 60px, 0) scale(0); opacity: 0; }
        }
        .fx-dragon-wrap {
          position: absolute; top: 0; left: 0;
          will-change: transform;
          animation: fx-dragon-fly 10s linear forwards;
        }
        .fx-dragon-wing { animation: fx-dragon-wing 0.35s ease-in-out infinite; transform-origin: 50% 50%; }
        .fx-dragon-flame {
          animation: fx-dragon-flame-pulse 0.25s ease-in-out infinite;
          transform-origin: 0% 50%;
          mix-blend-mode: screen;
        }
        .fx-dragon-spark {
          position: absolute;
          width: var(--s, 6px); height: var(--s, 6px);
          background: radial-gradient(circle, #fbbf24 0%, #ea580c 60%, transparent 100%);
          border-radius: 50%;
          will-change: transform, opacity;
          animation: fx-dragon-spark 2.5s ease-out forwards;
          animation-delay: var(--d, 0s);
          mix-blend-mode: screen;
        }
      `}</style>

      <div className="fx-dragon-wrap">
        <svg viewBox="0 0 340 180" width="340" height="180">
          {/* Schweif */}
          <path d="M 0,90 Q 40,80 80,95 Q 110,108 140,100" stroke="#7c2d12" strokeWidth="14" fill="none" strokeLinecap="round" />
          <path d="M 0,90 Q 40,82 80,95 Q 110,108 140,100" stroke="#a16207" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.7" />
          {/* Körper */}
          <ellipse cx="160" cy="95" rx="55" ry="32" fill="#15803d" />
          <ellipse cx="160" cy="100" rx="48" ry="22" fill="#166534" />
          {/* Bauch-Schuppen */}
          <ellipse cx="160" cy="110" rx="40" ry="15" fill="#a3e635" opacity="0.5" />
          {/* Flügel oben */}
          <g className="fx-dragon-wing">
            <path d="M 140,65 Q 130,20 90,30 Q 105,55 130,70 Z" fill="#166534" />
            <path d="M 145,65 Q 140,25 105,35 Q 115,55 135,72 Z" fill="#15803d" opacity="0.85" />
            <path d="M 180,65 Q 195,20 235,30 Q 220,55 195,70 Z" fill="#166534" />
            <path d="M 175,65 Q 185,25 220,35 Q 210,55 190,72 Z" fill="#15803d" opacity="0.85" />
          </g>
          {/* Beine */}
          <ellipse cx="145" cy="128" rx="9" ry="14" fill="#14532d" />
          <ellipse cx="175" cy="128" rx="9" ry="14" fill="#14532d" />
          <polygon points="138,140 142,148 146,140" fill="#fbbf24" />
          <polygon points="170,140 175,148 180,140" fill="#fbbf24" />
          {/* Hals */}
          <path d="M 215,90 Q 245,80 265,72 L 270,95 Q 245,105 215,100 Z" fill="#15803d" />
          {/* Kopf */}
          <ellipse cx="280" cy="68" rx="30" ry="22" fill="#15803d" />
          <ellipse cx="285" cy="74" rx="22" ry="14" fill="#166534" />
          {/* Hörner */}
          <polygon points="265,52 263,30 275,48" fill="#4a4a4a" stroke="#1c1917" strokeWidth="1" />
          <polygon points="285,50 290,28 295,48" fill="#4a4a4a" stroke="#1c1917" strokeWidth="1" />
          {/* Augen — wütend, rot */}
          <ellipse cx="285" cy="62" rx="5" ry="4" fill="#dc2626" />
          <circle cx="286" cy="61" r="1.8" fill="#fbbf24" />
          <circle cx="287" cy="60" r="0.8" fill="#ffffff" />
          {/* Augenbrauen (wütend) */}
          <path d="M 278,55 L 290,58" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />
          {/* Maul — geöffnet, mit Reißzähnen */}
          <path d="M 300,72 Q 322,72 330,80 L 330,86 Q 322,90 300,86 Z" fill="#1c1917" />
          <polygon points="305,78 308,86 311,78" fill="#ffffff" />
          <polygon points="318,78 321,86 324,78" fill="#ffffff" />
          {/* Nüstern (rauchend) */}
          <circle cx="306" cy="66" r="1.5" fill="#1c1917" />
          <circle cx="313" cy="66" r="1.5" fill="#1c1917" />
          {/* Rauch aus Nüstern */}
          <circle cx="320" cy="60" r="3" fill="#cbd5e1" opacity="0.5" />
          <circle cx="324" cy="55" r="2" fill="#cbd5e1" opacity="0.4" />

          {/* Flammenstrahl aus Maul (orange-gelb, animiert) */}
          <g className="fx-dragon-flame">
            <ellipse cx="380" cy="82" rx="50" ry="14" fill="#f97316" opacity="0.7" />
            <ellipse cx="395" cy="80" rx="45" ry="10" fill="#fbbf24" opacity="0.85" />
            <ellipse cx="405" cy="78" rx="35" ry="7" fill="#fef3c7" opacity="0.9" />
            <ellipse cx="415" cy="77" rx="25" ry="5" fill="#ffffff" opacity="0.7" />
          </g>
        </svg>
      </div>

      {/* Funken-Trail über die Tafel */}
      {SPARKS.map((s) => (
        <span
          key={s.id}
          className="fx-dragon-spark"
          style={{
            top: `${20 + (s.id * 1.6) % 60}vh`,
            left: `${s.x}vw`,
            '--s': `${s.size}px`,
            '--d': `${s.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}
