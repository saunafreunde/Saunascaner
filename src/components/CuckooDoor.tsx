import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ZwergMood = 'idle' | 'waving' | 'birthday' | 'hourly' | 'dragging' | 'fleeing';

interface CuckooDoorProps {
  isOpen: boolean;
  mood: ZwergMood;
  minutesUntilNext: number;
  nextTitle: string;
  onClick: () => void;
  scale?: number;
}

// ── SVG Sauna-Zwerg ────────────────────────────────────────────────────────
function ZwergSvg({ mood }: { mood: ZwergMood }) {
  const waving = mood === 'waving' || mood === 'birthday' || mood === 'hourly';
  const fleeing = mood === 'fleeing';
  const dragging = mood === 'dragging';

  const armAnimate = waving
    ? { rotate: [0, 35, 0, 35, 0] }
    : dragging
    ? { rotate: [-30, -60, -30] }
    : fleeing
    ? { rotate: [0, -20, 0, -20, 0] }
    : { rotate: 0 };

  const armTransition = waving
    ? { duration: 1.6, repeat: Infinity, repeatDelay: 0.8 }
    : dragging
    ? { duration: 0.4, repeat: Infinity }
    : fleeing
    ? { duration: 0.3, repeat: Infinity }
    : { duration: 0.4 };

  return (
    <svg viewBox="-8 0 76 90" width="60" height="75" style={{ overflow: 'visible' }}>
      <polygon points="30,2 10,34 50,34" fill="#f08020" />
      <polygon points="30,10 20,34 30,34" fill="rgba(255,255,255,0.18)" />
      <rect x="10" y="28" width="40" height="7" rx="3" fill="#7c4a1a" />
      <circle cx="30" cy="52" r="20" fill="#ffd5aa" />
      <ellipse cx="30" cy="65" rx="16" ry="6" fill="rgba(0,0,0,0.12)" />
      <ellipse cx="21" cy="48" rx="5" ry="5.5" fill="white" />
      <ellipse cx="39" cy="48" rx="5" ry="5.5" fill="white" />
      <circle cx="22.5" cy="49" r="3" fill="#1a1a2e" />
      <circle cx="40.5" cy="49" r="3" fill="#1a1a2e" />
      <circle cx="23.5" cy="47.5" r="1.2" fill="white" />
      <circle cx="41.5" cy="47.5" r="1.2" fill="white" />
      <ellipse cx="12" cy="57" rx="6" ry="4" fill="rgba(255,120,120,0.45)" />
      <ellipse cx="48" cy="57" rx="6" ry="4" fill="rgba(255,120,120,0.45)" />
      <ellipse cx="30" cy="55" rx="3.5" ry="2.5" fill="#e8a080" />
      {mood === 'birthday' ? (
        <path d="M19 63 Q30 71 41 63" fill="none" stroke="#c47a5a" strokeWidth="2.5" strokeLinecap="round" />
      ) : mood === 'fleeing' ? (
        <ellipse cx="30" cy="65" rx="5" ry="3.5" fill="#c47a5a" />
      ) : (
        <path d="M20 62 Q30 69 40 62" fill="none" stroke="#c47a5a" strokeWidth="2.2" strokeLinecap="round" />
      )}
      <rect x="14" y="72" width="32" height="22" rx="6" fill="#2d5a3f" />
      <text x="30" y="87" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.6)">🌿</text>
      <path d="M14 78 Q -2 70 -6 60" stroke="#ffd5aa" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M-6 60 L-14 52 M-6 60 L-4 50 M-6 60 L-16 62" stroke="#8B6914" strokeWidth="2" strokeLinecap="round" fill="none" />
      <motion.g
        style={{ transformOrigin: '46px 78px' }}
        animate={armAnimate}
        transition={armTransition}
      >
        <path d="M46 78 Q 60 70 64 60" stroke="#ffd5aa" strokeWidth="7" fill="none" strokeLinecap="round" />
        {waving && (
          <>
            <circle cx="64" cy="60" r="5" fill="#ffd5aa" />
            <circle cx="62" cy="54" r="3" fill="#ffd5aa" />
            <circle cx="67" cy="55" r="3" fill="#ffd5aa" />
          </>
        )}
      </motion.g>
      {mood === 'birthday' && (
        <text x="48" y="30" fontSize="18" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>🎂</text>
      )}
      {mood === 'hourly' && (
        <text x="46" y="30" fontSize="16" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>🔔</text>
      )}
      {mood === 'dragging' && (
        <text x="46" y="32" fontSize="16">💪</text>
      )}
      {mood === 'fleeing' && (
        <text x="44" y="30" fontSize="18">😱</text>
      )}
    </svg>
  );
}

// ── Schwarzwald-Sauna ──────────────────────────────────────────────────────
export function CuckooDoor({ isOpen, mood, minutesUntilNext, nextTitle, onClick, scale = 1 }: CuckooDoorProps) {
  const [isHourlyTick, setIsHourlyTick] = useState(false);

  useEffect(() => {
    const check = () => {
      const d = new Date();
      if (d.getMinutes() === 0 && d.getSeconds() < 10) {
        setIsHourlyTick(true);
        setTimeout(() => setIsHourlyTick(false), 15_000);
      }
    };
    const id = setInterval(check, 5_000);
    check();
    return () => clearInterval(id);
  }, []);

  const effectiveMood: ZwergMood = isHourlyTick && mood === 'waving' ? 'hourly' : mood;

  const signText =
    mood === 'birthday' ? '🎂 Geburtstag!' :
    mood === 'fleeing' ? '🚨 Raus!' :
    minutesUntilNext < 999 && nextTitle
      ? `⏱ ${minutesUntilNext}m · ${nextTitle.slice(0, 10)}` :
    minutesUntilNext < 999 ? `⏱ ${minutesUntilNext} Min` :
    '🧖 Wohlfühlen!';

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
        @keyframes c-peek-pulse {
          0%, 60%, 100% { transform: scale(1); }
          30%           { transform: scale(1.18); }
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
        .c-peek        { animation: c-peek-pulse 2s infinite; }

        @media (prefers-reduced-motion: reduce) {
          .c-smoke-1, .c-smoke-2, .c-smoke-3,
          .c-spark-1, .c-spark-2,
          .c-window-glow, .c-lantern, .c-peek {
            animation: none;
          }
        }
      `}</style>

      <div
        className="absolute cursor-pointer select-none"
        style={{
          width: W,
          height: H,
          left: 0,
          top: 0,
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: 'top left',
        }}
        onClick={onClick}
        title="Klicken für Zwerg-Besuch"
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

          {/* Schornstein zentral mit Steinsockel */}
          <g>
            {/* Steinsockel breit unter dem Rohr (auf dem Dachfirst) */}
            <rect x={W / 2 - 11} y={4} width={22} height={14} fill="#6e6e72" stroke="#2a2a2e" strokeWidth="0.8" rx="1" />
            {/* Stein-Pattern */}
            <line x1={W / 2 - 10} y1={9}  x2={W / 2 + 10} y2={9}  stroke="#3a3a3e" strokeWidth="0.5" />
            <line x1={W / 2 - 4}  y1={4}  x2={W / 2 - 4}  y2={9}  stroke="#3a3a3e" strokeWidth="0.5" />
            <line x1={W / 2 + 3}  y1={9}  x2={W / 2 + 3}  y2={14} stroke="#3a3a3e" strokeWidth="0.5" />
            <line x1={W / 2 - 6}  y1={14} x2={W / 2 + 6}  y2={14} stroke="#3a3a3e" strokeWidth="0.5" />
            {/* Hellerer Highlight */}
            <rect x={W / 2 - 11} y={4} width={22} height={2} fill="#8a8a8e" rx="1" />
            {/* Dunkler Schatten unten */}
            <rect x={W / 2 - 11} y={16} width={22} height={2} fill="#3a3a3e" />
            {/* Schornstein-Rohr (Ziegel) ragt nach oben raus */}
            <rect x={W / 2 - 7} y={-10} width={14} height={14} fill="#8a3a1a" stroke="#4a1a08" strokeWidth="1.2" />
            <line x1={W / 2 - 6} y1={-6} x2={W / 2 + 6} y2={-6} stroke="#5a2010" strokeWidth="0.5" />
            <line x1={W / 2 - 6} y1={-2} x2={W / 2 + 6} y2={-2} stroke="#5a2010" strokeWidth="0.5" />
            <line x1={W / 2 - 1} y1={-10} x2={W / 2 - 1} y2={4} stroke="#5a2010" strokeWidth="0.5" />
            {/* Schornstein-Krone */}
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

          {/* Hintergrund-Wand */}
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

          {/* Astlöcher in der Holzfassade */}
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
            {/* Aufhänger-Seile */}
            <line x1={W / 2 - 26} y1="48" x2={W / 2 - 26} y2="56" stroke="#1a0808" strokeWidth="0.6" />
            <line x1={W / 2 + 26} y1="48" x2={W / 2 + 26} y2="56" stroke="#1a0808" strokeWidth="0.6" />
            {/* Brett */}
            <rect x={W / 2 - 32} y="56" width="64" height="13" fill="#8a5a2a" stroke="#3a1808" strokeWidth="0.6" rx="1" />
            <rect x={W / 2 - 32} y="56" width="64" height="3" fill="#a06530" rx="1" />
            <rect x={W / 2 - 32} y="66" width="64" height="2" fill="rgba(0,0,0,0.35)" />
            {/* Holzmaserung */}
            <line x1={W / 2 - 30} y1="62" x2={W / 2 + 30} y2="62" stroke="rgba(58,24,8,0.3)" strokeWidth="0.3" />
            <line x1={W / 2 - 28} y1="64" x2={W / 2 + 28} y2="64" stroke="rgba(58,24,8,0.25)" strokeWidth="0.3" />
            {/* Eingebrannter Text */}
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
            {/* Nägel */}
            <circle cx={W / 2 - 28} cy="58" r="0.8" fill="#1a1a1a" />
            <circle cx={W / 2 + 28} cy="58" r="0.8" fill="#1a1a1a" />
          </g>

          {/* Fenster links — warm-orange Glow */}
          <g className="c-window-glow" style={{ transformOrigin: '28px 78px' }}>
            <rect x="18" y="72" width="20" height="20" fill="url(#window-glow)" rx="1" stroke="#5a3010" strokeWidth="1.5" />
            {/* Holzkreuz */}
            <line x1="28" y1="72" x2="28" y2="92" stroke="#3a1808" strokeWidth="1.2" />
            <line x1="18" y1="82" x2="38" y2="82" stroke="#3a1808" strokeWidth="1.2" />
            {/* Fensterbank */}
            <rect x="16" y="91" width="24" height="2" fill="#5a3010" rx="0.5" />
          </g>

          {/* Fenster rechts */}
          <g className="c-window-glow" style={{ transformOrigin: `${W - 28}px 78px`, animationDelay: '-1.5s' }}>
            <rect x={W - 38} y="72" width="20" height="20" fill="url(#window-glow)" rx="1" stroke="#5a3010" strokeWidth="1.5" />
            <line x1={W - 28} y1="72" x2={W - 28} y2="92" stroke="#3a1808" strokeWidth="1.2" />
            <line x1={W - 38} y1="82" x2={W - 18} y2="82" stroke="#3a1808" strokeWidth="1.2" />
            <rect x={W - 40} y="91" width="24" height="2" fill="#5a3010" rx="0.5" />
          </g>

          {/* Türrahmen — verzierter Balken oben + 2 vertikale Pfosten */}
          <g>
            {/* Pfosten links */}
            <rect x="38" y="97" width="3.5" height="51" fill="#5a3010" />
            <rect x="38" y="97" width="1" height="51" fill="#7c4a1a" />
            {/* Pfosten rechts */}
            <rect x={W - 41.5} y="97" width="3.5" height="51" fill="#5a3010" />
            <rect x={W - 41.5} y="97" width="1" height="51" fill="#7c4a1a" />
            {/* Sturz oben */}
            <rect x="34" y="93" width={W - 68} height="6" fill="#5a3010" rx="0.5" />
            <rect x="34" y="93" width={W - 68} height="1.5" fill="#a06530" rx="0.5" />
            <rect x="34" y="98" width={W - 68} height="1" fill="rgba(0,0,0,0.5)" />
            {/* Verzierte Schnitzerei am Sturz (kleine Dreiecke) */}
            <polygon points={`${W / 2 - 12},95 ${W / 2 - 9},97 ${W / 2 - 6},95`} fill="#3a1808" />
            <polygon points={`${W / 2 - 3},95 ${W / 2},97 ${W / 2 + 3},95`} fill="#3a1808" />
            <polygon points={`${W / 2 + 6},95 ${W / 2 + 9},97 ${W / 2 + 12},95`} fill="#3a1808" />
          </g>

          {/* Tür-Öffnung (dunkler Hintergrund) */}
          <rect x={W / 2 - 28} y="100" width="56" height="48" fill="#0a0604" rx="2" />

          {/* Birkenzweig-Bündel am linken Türpfosten */}
          <g transform="translate(34, 100)">
            {/* 3 Stiele weiß-schwarz */}
            <line x1="0" y1="0" x2="-2" y2="14" stroke="#e5e5e5" strokeWidth="0.9" strokeLinecap="round" />
            <line x1="1" y1="0" x2="2" y2="13" stroke="#e5e5e5" strokeWidth="0.7" strokeLinecap="round" />
            <line x1="-1" y1="1" x2="-3" y2="13" stroke="#e5e5e5" strokeWidth="0.7" strokeLinecap="round" />
            {/* Birken-typische dunkle Streifen */}
            <line x1="-0.5" y1="4" x2="-1.2" y2="4.5" stroke="#1a1a1a" strokeWidth="0.5" />
            <line x1="-1.2" y1="9" x2="-2"   y2="9.5" stroke="#1a1a1a" strokeWidth="0.5" />
            <line x1="1.4"  y1="6" x2="2.2"  y2="6.5" stroke="#1a1a1a" strokeWidth="0.4" />
            {/* Blätter */}
            <ellipse cx="-2.5" cy="2"  rx="2"   ry="1.1" fill="#326c44" />
            <ellipse cx="2.8"  cy="4"  rx="1.7" ry="0.9" fill="#326c44" />
            <ellipse cx="-3.2" cy="7"  rx="1.9" ry="1"   fill="#2a5e3a" />
            <ellipse cx="2.3"  cy="9"  rx="1.6" ry="0.8" fill="#326c44" />
            <ellipse cx="-2.8" cy="11" rx="1.5" ry="0.8" fill="#2a5e3a" />
            {/* Bindeband */}
            <rect x="-2" y="-0.8" width="4" height="1.6" fill="#7c4a1a" rx="0.3" />
          </g>

          {/* Steinstufe (Naturstein) */}
          <g>
            {/* Schatten unter der Stufe */}
            <ellipse cx={W / 2} cy="151.5" rx="36" ry="3" fill="rgba(0,0,0,0.45)" />
            {/* Stufen-Korpus */}
            <rect x={W / 2 - 33} y="146" width="66" height="5.5" fill="#7a7a7a" rx="1" />
            <rect x={W / 2 - 33} y="146" width="66" height="1.6" fill="#9a9a9a" rx="1" />
            <rect x={W / 2 - 33} y="150" width="66" height="1" fill="#5a5a5a" />
            {/* Stein-Trennlinien */}
            <line x1={W / 2 - 14} y1="146" x2={W / 2 - 14} y2="151.5" stroke="rgba(0,0,0,0.35)" strokeWidth="0.5" />
            <line x1={W / 2 + 10} y1="146" x2={W / 2 + 10} y2="151.5" stroke="rgba(0,0,0,0.35)" strokeWidth="0.5" />
            {/* Stein-Sprenkel */}
            <circle cx={W / 2 - 22} cy="148" r="0.4" fill="#5a5a5a" />
            <circle cx={W / 2 - 5}  cy="149" r="0.3" fill="#5a5a5a" />
            <circle cx={W / 2 + 18} cy="147.8" r="0.4" fill="#5a5a5a" />
          </g>

          {/* Aufgusseimer rechts neben Tür auf der Stufe */}
          <g transform="translate(102, 134)">
            {/* Eimer-Korpus (leicht trapezförmig) */}
            <path d="M0.5 0 L 7.5 0 L 7 12 L 1 12 Z" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.5" />
            <path d="M0.5 0 L 1 12 L 0.5 12 L 0 0 Z" fill="rgba(0,0,0,0.25)" />
            {/* Eisenreifen */}
            <line x1="0.5" y1="3"  x2="7.5" y2="3"  stroke="#1a1a1a" strokeWidth="0.5" />
            <line x1="0.7" y1="9"  x2="7.3" y2="9"  stroke="#1a1a1a" strokeWidth="0.5" />
            {/* Henkel */}
            <path d="M0.5 0 Q 4 -3.5 7.5 0" stroke="#1a1a1a" strokeWidth="0.7" fill="none" />
            {/* Wasser-Andeutung im Eimer */}
            <ellipse cx="4" cy="0.8" rx="3" ry="0.8" fill="#3a6a98" opacity="0.6" />
          </g>

          {/* Saunakelle daneben (lehnt am Eimer) */}
          <g transform="translate(112, 122)">
            {/* Stiel */}
            <line x1="0" y1="0" x2="6" y2="22" stroke="#7c4a1a" strokeWidth="1" strokeLinecap="round" />
            {/* Schöpfteil oben */}
            <ellipse cx="0" cy="0" rx="2.4" ry="1.6" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.4" />
            <ellipse cx="0" cy="-0.4" rx="1.7" ry="1" fill="#5a3010" />
          </g>

          {/* Holzstapel rechts außen */}
          <g transform={`translate(${W - 4}, 132)`}>
            {/* Untere Reihe (3 Stämme) */}
            {[0, 7, 14].map((dx, i) => (
              <g key={`hs-bot-${i}`} transform={`translate(${dx}, 12)`}>
                <circle cx="0" cy="0" r="3.5" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.5" />
                <circle cx="0" cy="0" r="2.6" fill="#5a3010" />
                <circle cx="0" cy="0" r="1.6" fill="none" stroke="#7c4a1a" strokeWidth="0.4" />
                <circle cx="0" cy="0" r="0.6" fill="#3a1808" />
              </g>
            ))}
            {/* Obere Reihe (2 Stämme, versetzt) */}
            {[3.5, 10.5].map((dx, i) => (
              <g key={`hs-top-${i}`} transform={`translate(${dx}, 5)`}>
                <circle cx="0" cy="0" r="3.5" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.5" />
                <circle cx="0" cy="0" r="2.6" fill="#5a3010" />
                <circle cx="0" cy="0" r="1.6" fill="none" stroke="#7c4a1a" strokeWidth="0.4" />
              </g>
            ))}
            {/* Boden-Schatten unter Stapel */}
            <ellipse cx="9" cy="16" rx="11" ry="1.5" fill="rgba(0,0,0,0.4)" />
          </g>

          {/* Laterne links neben der Tür (Eisengestell + warmer Glow) */}
          <g transform="translate(20, 122)">
            {/* Aufhängung */}
            <line x1="6" y1="-4" x2="6" y2="0" stroke="#1a1a1a" strokeWidth="0.7" />
            <path d="M3 -4 Q6 -7 9 -4" stroke="#1a1a1a" strokeWidth="0.7" fill="none" />
            {/* Laternen-Dach */}
            <polygon points="2,0 10,0 8,-2 4,-2" fill="#1a1a1a" />
            {/* Rahmen */}
            <rect x="2" y="0" width="8" height="11" fill="rgba(20,20,20,0.45)" stroke="#1a1a1a" strokeWidth="0.6" />
            {/* Glas-Glow innen */}
            <g className="c-lantern" style={{ transformOrigin: '6px 5.5px' }}>
              <ellipse cx="6" cy="5.5" rx="3.5" ry="4.2" fill="url(#lantern-glow)" />
            </g>
            {/* Vertikale Streben */}
            <line x1="6" y1="0" x2="6" y2="11" stroke="#1a1a1a" strokeWidth="0.4" />
            <line x1="2" y1="5.5" x2="10" y2="5.5" stroke="#1a1a1a" strokeWidth="0.4" />
            {/* Bodenplatte */}
            <rect x="1.5" y="11" width="9" height="1.5" fill="#1a1a1a" rx="0.3" />
          </g>
        </svg>

        {/* Tür-Panel mit 3D-Öffnung — HTML über dem SVG (Mechanik bleibt) */}
        <div
          className="absolute z-20"
          style={{
            left: W / 2 - 28,
            top: 100,
            width: 56,
            height: 48,
            perspective: 350,
          }}
        >
          <motion.div
            className="absolute inset-0 rounded-sm overflow-hidden"
            style={{
              originX: '0%',
              background: 'repeating-linear-gradient(90deg, #6B3A0F 0px, #7c4a1a 3px, #5a3010 6px, #6B3A0F 9px)',
              boxShadow: 'inset 0 0 0 2px #4a2808',
              backfaceVisibility: 'hidden',
            }}
            animate={{ rotateY: isOpen ? -82 : 0 }}
            transition={{ duration: 0.55, ease: [0.25, 1, 0.5, 1] }}
          >
            <div
              className="absolute"
              style={{
                left: 6,
                top: 22,
                width: 44,
                height: 1.5,
                background: '#3a1808',
                transform: 'rotate(-18deg)',
                transformOrigin: '0 0',
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: 7,
                height: 7,
                background: 'radial-gradient(circle at 35% 35%, #fbbf24, #d97706)',
                right: 5,
                top: '50%',
                transform: 'translateY(-50%)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.6)',
              }}
            />
          </motion.div>

          {/* Hinter der Tür: Zwerg */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center"
                style={{ background: 'rgba(8,18,10,0.95)', borderRadius: 2 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ delay: 0.4, duration: 0.35, ease: 'easeOut' }}
                  style={{ transform: 'scale(0.65)', transformOrigin: 'center' }}
                >
                  <ZwergSvg mood={effectiveMood} />
                </motion.div>

                <motion.div
                  className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[9px] font-bold text-white"
                  style={{ background: 'rgba(15,25,20,0.95)', border: '1px solid #2d5a3f' }}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.6, duration: 0.25 }}
                >
                  {signText}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Zugeschlossen-Hinweis (CSS-Pulse) */}
        {!isOpen && (
          <div
            className="c-peek absolute z-30 w-4 h-4 rounded-full bg-forest-600 flex items-center justify-center text-[8px]"
            style={{ top: -2, right: -2 }}
          >
            👀
          </div>
        )}
      </div>
    </div>
  );
}
