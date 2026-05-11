interface CuckooDoorProps {
  scale?: number;
  /** Legacy-Props bleiben in der Signatur damit Demo-Channel & andere Konsumenten
   *  nicht brechen — werden seit Entfernen der Kuckuck-Funktion ignoriert. */
  isOpen?: boolean;
  mood?: string;
  minutesUntilNext?: number;
  nextTitle?: string;
  onClick?: () => void;
}

export type ZwergMood = 'idle' | 'waving' | 'birthday' | 'hourly' | 'dragging' | 'fleeing';

// ── Schwarzwald-Sauna (statisch, ohne Kuckuck-Funktion) ────────────────────
export function CuckooDoor({ scale = 1 }: CuckooDoorProps) {
  const W = 140;
  const H = 155;

  return (
    <div style={{ width: W * scale, height: H * scale, position: 'relative' }}>
      <style>{`
        @keyframes c-smoke-rise-1 {
          0%   { opacity: 0; transform: translate(0, 0) scale(0.5); }
          15%  { opacity: 0.8; }
          100% { opacity: 0; transform: translate(-10px, -44px) scale(2); }
        }
        @keyframes c-smoke-rise-2 {
          0%   { opacity: 0; transform: translate(0, 0) scale(0.5); }
          15%  { opacity: 0.8; }
          100% { opacity: 0; transform: translate(8px, -44px) scale(2); }
        }
        @keyframes c-smoke-rise-3 {
          0%   { opacity: 0; transform: translate(0, 0) scale(0.5); }
          15%  { opacity: 0.7; }
          100% { opacity: 0; transform: translate(-2px, -48px) scale(2.2); }
        }
        @keyframes c-spark {
          0%, 100% { opacity: 0; transform: translateY(0) scale(0.6); }
          50%      { opacity: 1; transform: translateY(-10px) scale(1.2); }
        }
        @keyframes c-window-glow {
          0%, 100% { opacity: 0.85; }
          50%      { opacity: 1; }
        }
        @keyframes c-lantern-flicker {
          0%, 60%, 80%, 100% { opacity: 0.85; transform: scale(1); }
          65%                { opacity: 1;    transform: scale(1.08); }
          72%                { opacity: 0.7;  transform: scale(0.95); }
        }

        .c-smoke {
          position: absolute;
          width: 11px;
          height: 11px;
          left: -5.5px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(220,220,220,0.85) 0%, rgba(180,180,180,0.4) 60%, transparent 100%);
        }
        .c-smoke-1 { animation: c-smoke-rise-1 3.6s infinite ease-out; }
        .c-smoke-2 { animation: c-smoke-rise-2 3.6s infinite ease-out; animation-delay: -1.2s; }
        .c-smoke-3 { animation: c-smoke-rise-3 3.6s infinite ease-out; animation-delay: -2.4s; }

        .c-spark {
          position: absolute;
          width: 3px;
          height: 3px;
          left: -1.5px;
          border-radius: 50%;
          background: radial-gradient(circle, #fef3c7 0%, #f59e0b 60%, transparent 100%);
          box-shadow: 0 0 4px #fbbf24;
        }
        .c-spark-1 { animation: c-spark 2.5s infinite ease-out; animation-delay: -0.5s; }
        .c-spark-2 { animation: c-spark 2.8s infinite ease-out; animation-delay: -1.8s; }

        .c-window-glow { transform-origin: center; animation: c-window-glow 5s infinite ease-in-out alternate; }
        .c-lantern     { transform-origin: center; animation: c-lantern-flicker 3s infinite ease-in-out; }

        @media (prefers-reduced-motion: reduce) {
          .c-smoke-1, .c-smoke-2, .c-smoke-3,
          .c-spark-1, .c-spark-2,
          .c-window-glow, .c-lantern {
            animation: none;
          }
        }
      `}</style>

      <div
        className="absolute select-none"
        style={{
          width: W,
          height: H,
          left: 0,
          top: 0,
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {/* CSS-Rauch + Funken über dem Schornstein */}
        <div className="absolute z-30 pointer-events-none" style={{ left: W / 2, top: -8, width: 0, height: 0 }}>
          <div className="c-smoke c-smoke-1" />
          <div className="c-smoke c-smoke-2" />
          <div className="c-smoke c-smoke-3" />
          <div className="c-spark c-spark-1" />
          <div className="c-spark c-spark-2" />
        </div>

        {/* Cabin Shell als SVG */}
        <svg
          className="absolute inset-0 z-10"
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <radialGradient id="window-glow" cx="50%" cy="50%" r="60%">
              <stop offset="0%"  stopColor="#fde047" stopOpacity="1" />
              <stop offset="50%" stopColor="#fb923c" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#7c2d12" stopOpacity="0.85" />
            </radialGradient>
            <radialGradient id="lantern-glow" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#fef3c7" stopOpacity="1" />
              <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.6" />
            </radialGradient>
          </defs>

          {/* Boden-Schatten */}
          <ellipse cx={W / 2} cy={H - 1} rx={W / 2 - 4} ry="3" fill="rgba(0,0,0,0.5)" />

          {/* Schornstein mit Steinsockel */}
          <g>
            <rect x={W / 2 - 11} y={4} width={22} height={14} fill="#6e6e72" stroke="#2a2a2e" strokeWidth="0.8" rx="1" />
            <line x1={W / 2 - 10} y1={9}  x2={W / 2 + 10} y2={9}  stroke="#3a3a3e" strokeWidth="0.5" />
            <line x1={W / 2 - 4}  y1={4}  x2={W / 2 - 4}  y2={9}  stroke="#3a3a3e" strokeWidth="0.5" />
            <line x1={W / 2 + 3}  y1={9}  x2={W / 2 + 3}  y2={14} stroke="#3a3a3e" strokeWidth="0.5" />
            <line x1={W / 2 - 6}  y1={14} x2={W / 2 + 6}  y2={14} stroke="#3a3a3e" strokeWidth="0.5" />
            <rect x={W / 2 - 11} y={4} width={22} height={2} fill="#8a8a8e" rx="1" />
            <rect x={W / 2 - 11} y={16} width={22} height={2} fill="#3a3a3e" />
            <rect x={W / 2 - 7} y={-10} width={14} height={14} fill="#8a3a1a" stroke="#4a1a08" strokeWidth="1.2" />
            <line x1={W / 2 - 6} y1={-6} x2={W / 2 + 6} y2={-6} stroke="#5a2010" strokeWidth="0.5" />
            <line x1={W / 2 - 6} y1={-2} x2={W / 2 + 6} y2={-2} stroke="#5a2010" strokeWidth="0.5" />
            <line x1={W / 2 - 1} y1={-10} x2={W / 2 - 1} y2={4} stroke="#5a2010" strokeWidth="0.5" />
            <rect x={W / 2 - 9} y={-12} width={18} height={3} fill="#3a1408" rx="1" />
          </g>

          {/* Spitzdach */}
          <polygon points={`${W / 2},6 4,52 ${W - 4},52`} fill="#3a1808" stroke="#1a0808" strokeWidth="1.5" />
          <line x1="14" y1="46" x2={W - 14} y2="46" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
          <line x1="22" y1="40" x2={W - 22} y2="40" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
          <line x1="30" y1="34" x2={W - 30} y2="34" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
          <line x1="38" y1="28" x2={W - 38} y2="28" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
          <polygon points={`${W / 2},6 ${W / 2 - 28},38 ${W / 2},38`} fill="rgba(255,255,255,0.07)" />
          <line x1="0" y1="52" x2={W} y2="52" stroke="#1a0808" strokeWidth="2" />

          {/* Wand */}
          <rect x="6" y="50" width={W - 12} height={H - 56} fill="#3a2010" rx="1" />

          {/* 7 Holzstämme */}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const y = 52 + i * 14;
            return (
              <g key={i}>
                <rect x="8" y={y} width={W - 16} height="12" fill="#7c4a1a" rx="1.5" />
                <rect x="8" y={y} width={W - 16} height="3" fill="#a06530" rx="1.5" />
                <rect x="8" y={y + 10} width={W - 16} height="2.5" fill="rgba(0,0,0,0.4)" />
                <ellipse cx="8" cy={y + 6} rx="4.5" ry="6" fill="#5a3010" />
                <ellipse cx="8" cy={y + 6} rx="3" ry="4.2" fill="#3a1808" />
                <ellipse cx="8" cy={y + 6} rx="1.6" ry="2.4" fill="none" stroke="#6b3410" strokeWidth="0.5" />
                <ellipse cx={W - 8} cy={y + 6} rx="4.5" ry="6" fill="#5a3010" />
                <ellipse cx={W - 8} cy={y + 6} rx="3" ry="4.2" fill="#3a1808" />
                <ellipse cx={W - 8} cy={y + 6} rx="1.6" ry="2.4" fill="none" stroke="#6b3410" strokeWidth="0.5" />
              </g>
            );
          })}

          {/* Astlöcher */}
          <g>
            <ellipse cx="42" cy="116" rx="2" ry="1.4" fill="#1a0808" />
            <ellipse cx="42" cy="116" rx="1" ry="0.7" fill="#3a1808" />
            <path d="M40 115 Q 44 116 45 117" stroke="#3a1808" strokeWidth="0.4" fill="none" />
          </g>
          <g>
            <ellipse cx="100" cy="130" rx="1.6" ry="1.1" fill="#1a0808" />
            <ellipse cx="100" cy="130" rx="0.8" ry="0.5" fill="#3a1808" />
          </g>

          {/* Holzschild „SAUNAFREUNDE" */}
          <g transform={`rotate(-1 ${W / 2} 60)`}>
            <line x1={W / 2 - 26} y1="48" x2={W / 2 - 26} y2="56" stroke="#1a0808" strokeWidth="0.6" />
            <line x1={W / 2 + 26} y1="48" x2={W / 2 + 26} y2="56" stroke="#1a0808" strokeWidth="0.6" />
            <rect x={W / 2 - 32} y="56" width="64" height="13" fill="#8a5a2a" stroke="#3a1808" strokeWidth="0.6" rx="1" />
            <rect x={W / 2 - 32} y="56" width="64" height="3" fill="#a06530" rx="1" />
            <rect x={W / 2 - 32} y="66" width="64" height="2" fill="rgba(0,0,0,0.35)" />
            <line x1={W / 2 - 30} y1="62" x2={W / 2 + 30} y2="62" stroke="rgba(58,24,8,0.3)" strokeWidth="0.3" />
            <line x1={W / 2 - 28} y1="64" x2={W / 2 + 28} y2="64" stroke="rgba(58,24,8,0.25)" strokeWidth="0.3" />
            <text
              x={W / 2}
              y="66"
              textAnchor="middle"
              fontSize="7"
              fontWeight="800"
              fill="#2a1408"
              fontFamily="Inter, sans-serif"
              letterSpacing="0.4"
            >
              SAUNAFREUNDE
            </text>
            <circle cx={W / 2 - 28} cy="58" r="0.8" fill="#1a1a1a" />
            <circle cx={W / 2 + 28} cy="58" r="0.8" fill="#1a1a1a" />
          </g>

          {/* Fenster links + rechts mit Glow */}
          <g className="c-window-glow" style={{ transformOrigin: '28px 78px' }}>
            <rect x="18" y="72" width="20" height="20" fill="url(#window-glow)" rx="1" stroke="#5a3010" strokeWidth="1.5" />
            <line x1="28" y1="72" x2="28" y2="92" stroke="#3a1808" strokeWidth="1.2" />
            <line x1="18" y1="82" x2="38" y2="82" stroke="#3a1808" strokeWidth="1.2" />
            <rect x="16" y="91" width="24" height="2" fill="#5a3010" rx="0.5" />
          </g>
          <g className="c-window-glow" style={{ transformOrigin: `${W - 28}px 78px`, animationDelay: '-1.5s' }}>
            <rect x={W - 38} y="72" width="20" height="20" fill="url(#window-glow)" rx="1" stroke="#5a3010" strokeWidth="1.5" />
            <line x1={W - 28} y1="72" x2={W - 28} y2="92" stroke="#3a1808" strokeWidth="1.2" />
            <line x1={W - 38} y1="82" x2={W - 18} y2="82" stroke="#3a1808" strokeWidth="1.2" />
            <rect x={W - 40} y="91" width="24" height="2" fill="#5a3010" rx="0.5" />
          </g>

          {/* Türrahmen */}
          <g>
            <rect x="38" y="97" width="3.5" height="51" fill="#5a3010" />
            <rect x="38" y="97" width="1" height="51" fill="#7c4a1a" />
            <rect x={W - 41.5} y="97" width="3.5" height="51" fill="#5a3010" />
            <rect x={W - 41.5} y="97" width="1" height="51" fill="#7c4a1a" />
            <rect x="34" y="93" width={W - 68} height="6" fill="#5a3010" rx="0.5" />
            <rect x="34" y="93" width={W - 68} height="1.5" fill="#a06530" rx="0.5" />
            <rect x="34" y="98" width={W - 68} height="1" fill="rgba(0,0,0,0.5)" />
            <polygon points={`${W / 2 - 12},95 ${W / 2 - 9},97 ${W / 2 - 6},95`} fill="#3a1808" />
            <polygon points={`${W / 2 - 3},95 ${W / 2},97 ${W / 2 + 3},95`} fill="#3a1808" />
            <polygon points={`${W / 2 + 6},95 ${W / 2 + 9},97 ${W / 2 + 12},95`} fill="#3a1808" />
          </g>

          {/* Statische geschlossene Holz-Tür (keine Animation, kein Klick) */}
          <g>
            <rect
              x={W / 2 - 28}
              y="100"
              width="56"
              height="48"
              fill="#6B3A0F"
              stroke="#4a2808"
              strokeWidth="1.5"
              rx="2"
            />
            {/* Vertikale Holzlatten */}
            <line x1={W / 2 - 18} y1="100" x2={W / 2 - 18} y2="148" stroke="#3a1808" strokeWidth="0.6" />
            <line x1={W / 2 - 8}  y1="100" x2={W / 2 - 8}  y2="148" stroke="#3a1808" strokeWidth="0.6" />
            <line x1={W / 2 + 2}  y1="100" x2={W / 2 + 2}  y2="148" stroke="#3a1808" strokeWidth="0.6" />
            <line x1={W / 2 + 12} y1="100" x2={W / 2 + 12} y2="148" stroke="#3a1808" strokeWidth="0.6" />
            <line x1={W / 2 + 22} y1="100" x2={W / 2 + 22} y2="148" stroke="#3a1808" strokeWidth="0.6" />
            {/* Diagonalbalken */}
            <line x1={W / 2 - 26} y1="122" x2={W / 2 + 18} y2="100.5" stroke="#3a1808" strokeWidth="1.2" />
            {/* Türknauf */}
            <circle cx={W / 2 + 20} cy="124" r="2.2" fill="url(#lantern-glow)" stroke="#3a1808" strokeWidth="0.4" />
            <circle cx={W / 2 + 20.5} cy="123.5" r="0.7" fill="#fff" opacity="0.7" />
            {/* Querbalken oben + unten */}
            <rect x={W / 2 - 28} y="103" width="56" height="1.4" fill="#3a1808" />
            <rect x={W / 2 - 28} y="143" width="56" height="1.4" fill="#3a1808" />
          </g>

          {/* Birkenzweig am Türpfosten */}
          <g transform="translate(34, 100)">
            <line x1="0" y1="0" x2="-2" y2="14" stroke="#e5e5e5" strokeWidth="0.9" strokeLinecap="round" />
            <line x1="1" y1="0" x2="2" y2="13" stroke="#e5e5e5" strokeWidth="0.7" strokeLinecap="round" />
            <line x1="-1" y1="1" x2="-3" y2="13" stroke="#e5e5e5" strokeWidth="0.7" strokeLinecap="round" />
            <line x1="-0.5" y1="4" x2="-1.2" y2="4.5" stroke="#1a1a1a" strokeWidth="0.5" />
            <line x1="-1.2" y1="9" x2="-2"   y2="9.5" stroke="#1a1a1a" strokeWidth="0.5" />
            <line x1="1.4"  y1="6" x2="2.2"  y2="6.5" stroke="#1a1a1a" strokeWidth="0.4" />
            <ellipse cx="-2.5" cy="2"  rx="2"   ry="1.1" fill="#326c44" />
            <ellipse cx="2.8"  cy="4"  rx="1.7" ry="0.9" fill="#326c44" />
            <ellipse cx="-3.2" cy="7"  rx="1.9" ry="1"   fill="#2a5e3a" />
            <ellipse cx="2.3"  cy="9"  rx="1.6" ry="0.8" fill="#326c44" />
            <ellipse cx="-2.8" cy="11" rx="1.5" ry="0.8" fill="#2a5e3a" />
            <rect x="-2" y="-0.8" width="4" height="1.6" fill="#7c4a1a" rx="0.3" />
          </g>

          {/* Steinstufe */}
          <g>
            <ellipse cx={W / 2} cy="151.5" rx="36" ry="3" fill="rgba(0,0,0,0.45)" />
            <rect x={W / 2 - 33} y="146" width="66" height="5.5" fill="#7a7a7a" rx="1" />
            <rect x={W / 2 - 33} y="146" width="66" height="1.6" fill="#9a9a9a" rx="1" />
            <rect x={W / 2 - 33} y="150" width="66" height="1" fill="#5a5a5a" />
            <line x1={W / 2 - 14} y1="146" x2={W / 2 - 14} y2="151.5" stroke="rgba(0,0,0,0.35)" strokeWidth="0.5" />
            <line x1={W / 2 + 10} y1="146" x2={W / 2 + 10} y2="151.5" stroke="rgba(0,0,0,0.35)" strokeWidth="0.5" />
            <circle cx={W / 2 - 22} cy="148" r="0.4" fill="#5a5a5a" />
            <circle cx={W / 2 - 5}  cy="149" r="0.3" fill="#5a5a5a" />
            <circle cx={W / 2 + 18} cy="147.8" r="0.4" fill="#5a5a5a" />
          </g>

          {/* Aufgusseimer */}
          <g transform="translate(102, 134)">
            <path d="M0.5 0 L 7.5 0 L 7 12 L 1 12 Z" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.5" />
            <path d="M0.5 0 L 1 12 L 0.5 12 L 0 0 Z" fill="rgba(0,0,0,0.25)" />
            <line x1="0.5" y1="3"  x2="7.5" y2="3"  stroke="#1a1a1a" strokeWidth="0.5" />
            <line x1="0.7" y1="9"  x2="7.3" y2="9"  stroke="#1a1a1a" strokeWidth="0.5" />
            <path d="M0.5 0 Q 4 -3.5 7.5 0" stroke="#1a1a1a" strokeWidth="0.7" fill="none" />
            <ellipse cx="4" cy="0.8" rx="3" ry="0.8" fill="#3a6a98" opacity="0.6" />
          </g>

          {/* Saunakelle */}
          <g transform="translate(112, 122)">
            <line x1="0" y1="0" x2="6" y2="22" stroke="#7c4a1a" strokeWidth="1" strokeLinecap="round" />
            <ellipse cx="0" cy="0" rx="2.4" ry="1.6" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.4" />
            <ellipse cx="0" cy="-0.4" rx="1.7" ry="1" fill="#5a3010" />
          </g>

          {/* Holzstapel */}
          <g transform={`translate(${W - 4}, 132)`}>
            {[0, 7, 14].map((dx, i) => (
              <g key={`hs-bot-${i}`} transform={`translate(${dx}, 12)`}>
                <circle cx="0" cy="0" r="3.5" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.5" />
                <circle cx="0" cy="0" r="2.6" fill="#5a3010" />
                <circle cx="0" cy="0" r="1.6" fill="none" stroke="#7c4a1a" strokeWidth="0.4" />
                <circle cx="0" cy="0" r="0.6" fill="#3a1808" />
              </g>
            ))}
            {[3.5, 10.5].map((dx, i) => (
              <g key={`hs-top-${i}`} transform={`translate(${dx}, 5)`}>
                <circle cx="0" cy="0" r="3.5" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.5" />
                <circle cx="0" cy="0" r="2.6" fill="#5a3010" />
                <circle cx="0" cy="0" r="1.6" fill="none" stroke="#7c4a1a" strokeWidth="0.4" />
              </g>
            ))}
            <ellipse cx="9" cy="16" rx="11" ry="1.5" fill="rgba(0,0,0,0.4)" />
          </g>

          {/* Laterne */}
          <g transform="translate(20, 122)">
            <line x1="6" y1="-4" x2="6" y2="0" stroke="#1a1a1a" strokeWidth="0.7" />
            <path d="M3 -4 Q6 -7 9 -4" stroke="#1a1a1a" strokeWidth="0.7" fill="none" />
            <polygon points="2,0 10,0 8,-2 4,-2" fill="#1a1a1a" />
            <rect x="2" y="0" width="8" height="11" fill="rgba(20,20,20,0.45)" stroke="#1a1a1a" strokeWidth="0.6" />
            <g className="c-lantern" style={{ transformOrigin: '6px 5.5px' }}>
              <ellipse cx="6" cy="5.5" rx="3.5" ry="4.2" fill="url(#lantern-glow)" />
            </g>
            <line x1="6" y1="0" x2="6" y2="11" stroke="#1a1a1a" strokeWidth="0.4" />
            <line x1="2" y1="5.5" x2="10" y2="5.5" stroke="#1a1a1a" strokeWidth="0.4" />
            <rect x="1.5" y="11" width="9" height="1.5" fill="#1a1a1a" rx="0.3" />
          </g>
        </svg>
      </div>
    </div>
  );
}
