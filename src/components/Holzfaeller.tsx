import { useEffect, useState } from 'react';

interface Props {
  scale?: number;
}

// Hintere Bäume — auch hinter dem Holzfäller (x < 65), damit links nicht leer wirkt
const BACK_TREES = [
  { x: 6,   h: 40, delay: '-1.1s' },
  { x: 28,  h: 36, delay: '-2.7s' },
  { x: 56,  h: 44, delay: '-0.6s' },
  { x: 96,  h: 38, delay: '-3.4s' },
  { x: 115, h: 50, delay: '-0.5s' },
  { x: 158, h: 64, delay: '-2.4s' },
  { x: 184, h: 48, delay: '-1.6s' },
  { x: 205, h: 54, delay: '-3.2s' },
];

const FRONT_TREES = [
  { x: 130, h: 56, delay: '-0.9s' },
  { x: 195, h: 66, delay: '-2.8s' },
];

export function Holzfaeller({ scale = 1 }: Props) {
  // Drei Phasen für den Holzfäller selbst (wie bisher):
  // 1. Hacken · 2. Erschöpfung · 3. Baumfall
  const [treeFallen, setTreeFallen] = useState(false);
  const [isExhausted, setIsExhausted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cycle = () => {
      if (cancelled) return;
      const delay = 28000 + Math.random() * 7000;
      setTimeout(() => {
        if (cancelled) return;
        setIsExhausted(true);
        setTimeout(() => {
          if (cancelled) return;
          setIsExhausted(false);
          setTreeFallen(true);
          setTimeout(() => {
            if (cancelled) return;
            setTreeFallen(false);
            cycle();
          }, 4500);
        }, 2000);
      }, delay);
    };
    cycle();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="relative pointer-events-none select-none"
      style={{
        width: 210 * scale,
        height: 130 * scale,
        transform: `scale(${scale})`,
        transformOrigin: 'bottom left',
      }}
    >
      <style>{`
        @keyframes hfs-tree-sway     { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(1.2deg); } }
        @keyframes hfs-owl-head      {
          0%,40%,100% { transform: rotate(0deg); }
          50% { transform: rotate(-12deg); } 60% { transform: rotate(0deg); }
          70% { transform: rotate(12deg); }  80% { transform: rotate(0deg); }
        }
        @keyframes hfs-owl-blink     { 0%,90%,100% { transform: scaleY(1); } 95% { transform: scaleY(0.05); } }
        @keyframes hfs-butterfly-fly {
          0%   { transform: translate(125px, 35px); }
          25%  { transform: translate(165px, 18px); }
          50%  { transform: translate(200px, 30px); }
          75%  { transform: translate(155px, 50px); }
          100% { transform: translate(125px, 35px); }
        }
        @keyframes hfs-butterfly-flap { 0%,100% { transform: scaleX(1); } 50% { transform: scaleX(0.3); } }
        @keyframes hfs-squirrel-climb {
          0%   { transform: translateY(0)    rotate(0deg); }
          45%  { transform: translateY(-50px) rotate(0deg); }
          50%  { transform: translateY(-50px) rotate(180deg); }
          95%  { transform: translateY(0)    rotate(180deg); }
          100% { transform: translateY(0)    rotate(0deg); }
        }
        @keyframes hfs-bird-glide    { 0% { transform: translate(-30px, 8px); } 100% { transform: translate(220px, 18px); } }
        @keyframes hfs-creek-flow    { 0% { transform: translateX(0); } 100% { transform: translateX(-12px); } }
        @keyframes hfs-sparkle       { 0%,100% { opacity: 0; transform: scale(0.6); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes hfs-mushroom-bob  { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-0.5px) scale(1.02); } }
        @keyframes hfs-firefly-glow  { 0%,100% { opacity: 0.2; } 50% { opacity: 1; } }
        @keyframes hfs-firefly-drift {
          0%   { transform: translate(0, 0); }
          33%  { transform: translate(15px, -8px); }
          66%  { transform: translate(-5px, -12px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes hfs-cloud-drift {
          0%   { transform: translateX(0); } 100% { transform: translateX(35px); }
        }
        @keyframes hfs-skier-slide {
          0%   { transform: translate(0, 0)    rotate(-8deg); }
          100% { transform: translate(38px, 26px) rotate(-8deg); }
        }

        .hfs-tree            { transform-origin: bottom center; animation: hfs-tree-sway 4s infinite ease-in-out; }
        .hfs-owl-head        { transform-origin: center; animation: hfs-owl-head 6s infinite ease-in-out; }
        .hfs-owl-blink       { transform-origin: center; animation: hfs-owl-blink 5s infinite ease-in-out; }
        .hfs-butterfly-fly   { animation: hfs-butterfly-fly 18s infinite ease-in-out; }
        .hfs-butterfly-flap  { transform-origin: center; animation: hfs-butterfly-flap 0.18s infinite linear; }
        .hfs-squirrel        { transform-origin: center; animation: hfs-squirrel-climb 12s infinite ease-in-out; }
        .hfs-bird            { animation: hfs-bird-glide 25s infinite linear; }
        .hfs-creek           { animation: hfs-creek-flow 3s infinite linear; }
        .hfs-sparkle         { transform-origin: center; animation: hfs-sparkle 2.5s infinite ease-in-out; }
        .hfs-mushroom        { transform-origin: bottom center; animation: hfs-mushroom-bob 5s infinite ease-in-out; }
        .hfs-firefly         { animation: hfs-firefly-glow 9s infinite ease-in-out; }
        .hfs-firefly-drift   { animation: hfs-firefly-drift 30s infinite ease-in-out; }
        .hfs-cloud           { animation: hfs-cloud-drift 60s infinite alternate ease-in-out; }
        .hfs-skier           { transform-origin: center; animation: hfs-skier-slide 14s infinite linear; }

        @media (prefers-reduced-motion: reduce) {
          .hfs-tree, .hfs-owl-head, .hfs-owl-blink, .hfs-butterfly-fly, .hfs-butterfly-flap,
          .hfs-squirrel, .hfs-bird, .hfs-creek, .hfs-sparkle, .hfs-mushroom,
          .hfs-firefly, .hfs-firefly-drift, .hfs-cloud, .hfs-skier {
            animation: none;
          }
        }
      `}</style>

      <svg viewBox="0 0 210 130" width={210} height={130} style={{ overflow: 'visible' }}>
        {/* Boden */}
        <rect x="0" y="120" width="210" height="10" fill="rgba(20,40,25,0.4)" />

        {/* Berg rechts */}
        <Mountain />

        {/* Wolken oben */}
        <g className="hfs-cloud">
          <Cloud cx={50}  cy={14} w={20} />
        </g>
        <g className="hfs-cloud" style={{ animationDelay: '-30s' }}>
          <Cloud cx={170} cy={20} w={18} />
        </g>

        {/* Vogel */}
        <g className="hfs-bird">
          <path d="M0,0 Q3,-3 6,0 Q9,-3 12,0" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
        </g>

        {/* Skifahrer auf dem Berg */}
        <g transform="translate(155, 48)">
          <g className="hfs-skier">
            <Skier />
          </g>
        </g>

        {/* Hintere Bäume */}
        {BACK_TREES.map((t, i) => (
          <g key={`bt-${i}`} className="hfs-tree" style={{ animationDelay: t.delay }}>
            <Tree x={t.x} h={t.h} />
          </g>
        ))}

        {/* Eule auf dem mittleren Hinterbaum */}
        <g transform="translate(154, 64)">
          <Owl />
        </g>

        {/* Schmetterling */}
        <g className="hfs-butterfly-fly">
          <Butterfly />
        </g>

        {/* ──── HOLZFÄLLER + sein Baum (Mechanik unverändert) ──── */}

        {/* Schatten-Streifen unter Holzfäller-Bereich */}
        <ellipse cx="65" cy="118" rx="55" ry="2.5" fill="rgba(0,0,0,0.3)" />

        {/* Baumstumpf */}
        <rect x="78" y="104" width="18" height="12" fill="#6b3410" rx="1" />
        <ellipse cx="87" cy="104" rx="9" ry="3" fill="#a05a25" />
        <ellipse cx="87" cy="104" rx="6" ry="2" fill="none" stroke="#5a2a08" strokeWidth="0.5" />
        <ellipse cx="87" cy="104" rx="3" ry="1" fill="none" stroke="#5a2a08" strokeWidth="0.5" />

        {/* Baum (fällt) */}
        <g className={treeFallen ? 'hf-tree fallen' : 'hf-tree'} style={{ transformOrigin: '87px 104px' }}>
          <rect x="84" y="52" width="6" height="52" fill="#6b3410" rx="1" />
          <polygon points="87,24 70,64 104,64" fill="#1f4d2f" />
          <polygon points="87,36 73,70 101,70" fill="#2a5e3a" />
          <polygon points="87,50 76,80 98,80" fill="#326c44" />
          <polygon points="87,24 80,52 87,52" fill="rgba(255,255,255,0.08)" />
        </g>

        {/* Holzspäne */}
        <g className={treeFallen || isExhausted ? 'hf-chips paused' : 'hf-chips'}>
          <circle cx="76" cy="100" r="1.2" fill="#c8915a" />
          <circle cx="73" cy="104" r="1" fill="#a87241" />
          <circle cx="98" cy="98" r="1" fill="#c8915a" />
        </g>

        {/* Schatten */}
        <ellipse cx="36" cy="117" rx="22" ry="2.5" fill="rgba(0,0,0,0.25)" />

        {/* Holzfäller-Körperteile */}
        <rect x="28" y="92" width="6" height="22" fill="#3a2510" rx="1" />
        <rect x="38" y="92" width="6" height="22" fill="#3a2510" rx="1" />
        <ellipse cx="31" cy="115" rx="5" ry="2.5" fill="#1a0e05" />
        <ellipse cx="41" cy="115" rx="5" ry="2.5" fill="#1a0e05" />
        <rect x="26" y="74" width="20" height="22" fill="#2d4a78" rx="2" />
        <rect x="29" y="60" width="2" height="16" fill="#5a3a18" />
        <rect x="41" y="60" width="2" height="16" fill="#5a3a18" />
        <rect x="22" y="58" width="28" height="22" fill="#a01818" rx="3" />
        <rect x="22" y="58" width="28" height="3" fill="rgba(0,0,0,0.55)" />
        <rect x="22" y="68" width="28" height="3" fill="rgba(0,0,0,0.55)" />
        <rect x="22" y="78" width="28" height="2" fill="rgba(0,0,0,0.55)" />
        <rect x="28" y="58" width="3" height="22" fill="rgba(0,0,0,0.45)" />
        <rect x="40" y="58" width="3" height="22" fill="rgba(0,0,0,0.45)" />
        <circle cx="36" cy="48" r="11" fill="#ffd5aa" />
        <path d="M25 44 Q36 28 47 44 Z" fill="#1f4d2f" />
        <ellipse cx="36" cy="45" rx="11" ry="2" fill="#163c25" />
        <circle cx="32" cy="48" r="1.4" fill="#1a1a2e" />
        <circle cx="40" cy="48" r="1.4" fill="#1a1a2e" />
        <path d="M28 52 Q36 62 44 52 Q44 59 36 61 Q28 59 28 52 Z" fill="#8a5a2a" />
        <path d="M32 56 Q36 58 40 56" stroke="#5a2a08" strokeWidth="1" fill="none" strokeLinecap="round" />
        <path d="M26 62 Q18 68 22 78" stroke="#a01818" strokeWidth="6" fill="none" strokeLinecap="round" />

        {/* Schweiß-Wölkchen bei Erschöpfung */}
        <g className={isExhausted ? 'hf-steam exhausted' : 'hf-steam hidden'}>
          <path d="M42 50 Q50 46 58 50 Q50 54 42 50 Z" fill="white" opacity="0.6" />
          <path d="M44 48 Q50 44 56 48" stroke="white" strokeWidth="0.5" fill="none" opacity="0.8" />
        </g>

        {/* Axt-Arm */}
        <g
          className={treeFallen ? 'hf-axt fallen' : isExhausted ? 'hf-axt exhausted' : 'hf-axt'}
          style={{ transformOrigin: '46px 64px' }}
        >
          <path d="M46 64 L 64 68" stroke="#a01818" strokeWidth="6" fill="none" strokeLinecap="round" />
          <circle cx="64" cy="68" r="4" fill="#ffd5aa" />
          <rect x="62.5" y="34" width="3" height="38" fill="#7c4a1a" rx="1" />
          <polygon points="56,30 72,28 76,42 60,44" fill="#b8b8c0" stroke="#5a5a64" strokeWidth="0.8" />
          <polygon points="56,30 72,28 70,34 60,36" fill="#dcdce0" />
          <line x1="76" y1="32" x2="78" y2="42" stroke="#fff" strokeWidth="0.6" opacity="0.7" />
        </g>

        {/* ──── VORDERE BÄUME (überlappen Szene leicht) ──── */}
        {FRONT_TREES.map((t, i) => (
          <g key={`ft-${i}`} className="hfs-tree" style={{ animationDelay: t.delay }}>
            <Tree x={t.x} h={t.h} front />
          </g>
        ))}

        {/* Eichhörnchen am rechten Vorderbaum */}
        <g transform="translate(192, 110)">
          <g className="hfs-squirrel">
            <Squirrel />
          </g>
        </g>

        {/* Bach unten */}
        <g transform="translate(0, 117)">
          <Creek />
        </g>

        {/* Pilze */}
        <g className="hfs-mushroom" style={{ animationDelay: '-0.3s' }}>
          <Mushroom x={120} cap="#c0392b" />
        </g>
        <g className="hfs-mushroom" style={{ animationDelay: '-1.4s' }}>
          <Mushroom x={140} cap="#8b5a2b" small />
        </g>
        <g className="hfs-mushroom" style={{ animationDelay: '-2.1s' }}>
          <Mushroom x={170} cap="#c0392b" />
        </g>

        {/* Glühwürmchen */}
        <Firefly cx={108} cy={66}  driftDelay="-3s"  glowDelay="-1s" />
        <Firefly cx={155} cy={92}  driftDelay="-9s"  glowDelay="-3s" />
        <Firefly cx={200} cy={48}  driftDelay="-15s" glowDelay="-5s" />
      </svg>
    </div>
  );
}

// ── Berg ──────────────────────────────────────────────────────────────────
function Mountain() {
  return (
    <g opacity="0.85">
      <polygon points="155,82 200,128 110,128" fill="#3a4a55" opacity="0.6" />
      <polygon points="170,55 210,128 130,128" fill="#4a5560" />
      <polygon points="170,55 170,128 130,128" fill="#3a4550" />
      <polygon points="170,55 178,72 165,71 161,76 156,73" fill="#ecf0f4" />
      <polygon points="170,55 156,73 150,80 165,71" fill="#d8dde2" />
      <path d="M138 105 L 152 103 L 162 107" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" fill="none" />
      <path d="M180 100 L 192 103 L 200 107" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" fill="none" />
    </g>
  );
}

// ── Wolke ─────────────────────────────────────────────────────────────────
function Cloud({ cx, cy, w }: { cx: number; cy: number; w: number }) {
  return (
    <g opacity="0.5">
      <ellipse cx={cx}            cy={cy}     rx={w * 0.4} ry={3} fill="#ecf0f4" />
      <ellipse cx={cx - w * 0.3}  cy={cy + 1} rx={w * 0.3} ry={2.5} fill="#ecf0f4" />
      <ellipse cx={cx + w * 0.35} cy={cy + 1} rx={w * 0.3} ry={2.5} fill="#ecf0f4" />
      <ellipse cx={cx + w * 0.1}  cy={cy - 1} rx={w * 0.25} ry={2} fill="#ffffff" />
    </g>
  );
}

// ── Skifahrer (auf dem Berg) ──────────────────────────────────────────────
function Skier() {
  return (
    <g>
      <line x1="-6" y1="0.5" x2="0" y2="0.5" stroke="rgba(255,255,255,0.7)" strokeWidth="0.3" />
      <line x1="-1" y1="3" x2="4" y2="3.5" stroke="#dc2626" strokeWidth="0.7" strokeLinecap="round" />
      <line x1="0.5" y1="0" x2="0" y2="2.7" stroke="#1f2937" strokeWidth="1" strokeLinecap="round" />
      <line x1="2"   y1="0" x2="2.5" y2="2.7" stroke="#1f2937" strokeWidth="1" strokeLinecap="round" />
      <ellipse cx="1.5" cy="-1.5" rx="1.6" ry="1.8" fill="#dc2626" />
      <circle cx="1.5" cy="-3.8" r="1" fill="#ffd5aa" />
      <path d="M0.5 -4.2 Q1.5 -5.4 2.5 -4.2 Z" fill="#1e3a8a" />
      <line x1="0"  y1="-1" x2="-1.5" y2="3.5" stroke="#374151" strokeWidth="0.3" />
      <line x1="3"  y1="-1" x2="4"    y2="3.5" stroke="#374151" strokeWidth="0.3" />
    </g>
  );
}

// ── Tannenbaum ────────────────────────────────────────────────────────────
function Tree({ x, h, front = false }: { x: number; h: number; front?: boolean }) {
  const groundY = 120;
  const trunkW = front ? 4 : 3;
  const crownH = h - 12;
  const crownW = 18 + crownH * 0.28;
  const opacity = front ? 1 : 0.75;

  return (
    <g opacity={opacity}>
      <ellipse cx={x} cy={groundY + 1} rx={crownW * 0.5} ry={1.5} fill="rgba(0,0,0,0.35)" />
      <rect x={x - trunkW / 2} y={groundY - 12} width={trunkW} height={12} fill="#5a3010" rx={1} />
      <polygon
        points={`${x},${groundY - h} ${x - crownW / 2},${groundY - 12 - crownH * 0.05} ${x + crownW / 2},${groundY - 12 - crownH * 0.05}`}
        fill="#1f4d2f"
      />
      <polygon
        points={`${x},${groundY - h + crownH * 0.18} ${x - crownW * 0.42},${groundY - 12 + crownH * 0.05} ${x + crownW * 0.42},${groundY - 12 + crownH * 0.05}`}
        fill="#2a5e3a"
      />
      <polygon
        points={`${x},${groundY - h + crownH * 0.4} ${x - crownW * 0.34},${groundY - 12 + crownH * 0.12} ${x + crownW * 0.34},${groundY - 12 + crownH * 0.12}`}
        fill="#326c44"
      />
    </g>
  );
}

// ── Eule ──────────────────────────────────────────────────────────────────
function Owl() {
  return (
    <g>
      <ellipse cx="0" cy="0" rx="6" ry="7" fill="#5a3a1c" />
      <ellipse cx="0" cy="2" rx="4.5" ry="5" fill="#7a5a3c" />
      <g className="hfs-owl-head">
        <ellipse cx="0" cy="-5" rx="5" ry="4.5" fill="#5a3a1c" />
        <circle cx="-2" cy="-5" r="2" fill="#f5e6c8" />
        <circle cx="2"  cy="-5" r="2" fill="#f5e6c8" />
        <g className="hfs-owl-blink" style={{ transformOrigin: '-2px -5px' }}>
          <circle cx="-2" cy="-5" r="1.1" fill="#1a0e05" />
        </g>
        <g className="hfs-owl-blink" style={{ transformOrigin: '2px -5px' }}>
          <circle cx="2"  cy="-5" r="1.1" fill="#1a0e05" />
        </g>
        <polygon points="0,-3.5 -0.6,-1.8 0.6,-1.8" fill="#d97706" />
        <polygon points="-3,-9 -2.2,-7 -3.6,-7" fill="#5a3a1c" />
        <polygon points="3,-9 2.2,-7 3.6,-7" fill="#5a3a1c" />
      </g>
      <path d="M-5 1 Q-3 5 -2 6" stroke="#3a2510" strokeWidth="0.4" fill="none" />
      <path d="M5 1 Q3 5 2 6" stroke="#3a2510" strokeWidth="0.4" fill="none" />
    </g>
  );
}

// ── Schmetterling ─────────────────────────────────────────────────────────
function Butterfly() {
  return (
    <g className="hfs-butterfly-flap">
      <line x1="0" y1="-3" x2="0" y2="3" stroke="#1a0e05" strokeWidth="0.7" strokeLinecap="round" />
      <path d="M0 -3 Q-1.5 -5 -2.2 -5.5" stroke="#1a0e05" strokeWidth="0.4" fill="none" strokeLinecap="round" />
      <path d="M0 -3 Q1.5 -5 2.2 -5.5" stroke="#1a0e05" strokeWidth="0.4" fill="none" strokeLinecap="round" />
      <ellipse cx="-3"   cy="-1" rx="3"   ry="2.2" fill="#f97316" opacity="0.85" />
      <ellipse cx="-2.5" cy="2"  rx="2.2" ry="1.8" fill="#fb923c" opacity="0.85" />
      <ellipse cx="3"    cy="-1" rx="3"   ry="2.2" fill="#f97316" opacity="0.85" />
      <ellipse cx="2.5"  cy="2"  rx="2.2" ry="1.8" fill="#fb923c" opacity="0.85" />
      <circle cx="-3.2" cy="-1" r="0.5" fill="#7c2d12" />
      <circle cx="3.2"  cy="-1" r="0.5" fill="#7c2d12" />
    </g>
  );
}

// ── Eichhörnchen ──────────────────────────────────────────────────────────
function Squirrel() {
  return (
    <g>
      <path d="M-4 0 Q-7 -3 -6 -7 Q-3 -8 -2 -5 Q-3 -3 -2 0 Z" fill="#a05a1a" />
      <path d="M-5 -2 Q-6 -5 -4 -6" stroke="#7c4a1a" strokeWidth="0.5" fill="none" />
      <ellipse cx="0" cy="-1" rx="3" ry="3.5" fill="#b8651e" />
      <circle cx="2.5" cy="-3.5" r="2" fill="#b8651e" />
      <polygon points="2,-5.5 1.5,-6.5 2.6,-5.8" fill="#8a4a14" />
      <polygon points="3,-5.5 3.5,-6.5 3.6,-5.5" fill="#8a4a14" />
      <circle cx="3" cy="-3.6" r="0.4" fill="#1a0e05" />
      <ellipse cx="0" cy="2" rx="0.8" ry="1" fill="#8a4a14" />
      <ellipse cx="2" cy="2" rx="0.8" ry="1" fill="#8a4a14" />
      <ellipse cx="1" cy="2" rx="0.7" ry="0.5" fill="#5a3010" />
      <rect x="0.7" y="1.6" width="0.6" height="0.3" fill="#3a1808" />
    </g>
  );
}

// ── Bach ──────────────────────────────────────────────────────────────────
function Creek() {
  return (
    <g>
      <rect x="0" y="0" width="210" height="6" fill="#1a3a55" opacity="0.85" />
      <rect x="0" y="1" width="210" height="3" fill="#234a6e" opacity="0.85" />
      <g className="hfs-creek">
        <path
          d="M0 3 Q3 1 6 3 Q9 5 12 3 Q15 1 18 3 Q21 5 24 3 Q27 1 30 3 Q33 5 36 3 Q39 1 42 3 Q45 5 48 3 Q51 1 54 3 Q57 5 60 3 Q63 1 66 3 Q69 5 72 3 Q75 1 78 3 Q81 5 84 3 Q87 1 90 3 Q93 5 96 3 Q99 1 102 3 Q105 5 108 3 Q111 1 114 3 Q117 5 120 3 Q123 1 126 3 Q129 5 132 3 Q135 1 138 3 Q141 5 144 3 Q147 1 150 3 Q153 5 156 3 Q159 1 162 3 Q165 5 168 3 Q171 1 174 3 Q177 5 180 3 Q183 1 186 3 Q189 5 192 3 Q195 1 198 3 Q201 5 204 3 Q207 1 210 3 Q213 5 216 3 Q219 1 222 3"
          stroke="rgba(255,255,255,0.45)" strokeWidth="0.6" fill="none"
        />
      </g>
      <g className="hfs-sparkle" style={{ animationDelay: '0s', transformOrigin: '40px 2.5px' }}>
        <circle cx="40" cy="2.5" r="0.8" fill="rgba(255,255,255,0.9)" />
      </g>
      <g className="hfs-sparkle" style={{ animationDelay: '-0.9s', transformOrigin: '110px 3px' }}>
        <circle cx="110" cy="3" r="0.8" fill="rgba(255,255,255,0.9)" />
      </g>
      <g className="hfs-sparkle" style={{ animationDelay: '-1.8s', transformOrigin: '175px 2.5px' }}>
        <circle cx="175" cy="2.5" r="0.8" fill="rgba(255,255,255,0.9)" />
      </g>
    </g>
  );
}

// ── Pilze ─────────────────────────────────────────────────────────────────
function Mushroom({ x, cap, small = false }: { x: number; cap: string; small?: boolean }) {
  const w = small ? 3 : 4;
  const stemH = small ? 2.5 : 3.5;
  const baseY = 119;
  return (
    <g>
      <rect x={x - w * 0.3} y={baseY - stemH} width={w * 0.6} height={stemH} fill="#f5e6c8" rx={0.5} />
      <ellipse cx={x} cy={baseY - stemH} rx={w} ry={w * 0.7} fill={cap} />
      {cap.startsWith('#c') && (
        <>
          <circle cx={x - w * 0.4} cy={baseY - stemH - 0.3} r="0.4" fill="rgba(255,255,255,0.9)" />
          <circle cx={x + w * 0.3} cy={baseY - stemH - 0.5} r="0.3" fill="rgba(255,255,255,0.9)" />
          <circle cx={x}            cy={baseY - stemH + 0.2} r="0.3" fill="rgba(255,255,255,0.9)" />
        </>
      )}
    </g>
  );
}

// ── Glühwürmchen ──────────────────────────────────────────────────────────
function Firefly({ cx, cy, driftDelay, glowDelay }: { cx: number; cy: number; driftDelay: string; glowDelay: string }) {
  return (
    <g className="hfs-firefly-drift" style={{ animationDelay: driftDelay, transformOrigin: `${cx}px ${cy}px` }}>
      <g className="hfs-firefly" style={{ animationDelay: glowDelay }}>
        <circle cx={cx} cy={cy} r="3" fill="rgba(252,211,77,0.25)" />
        <circle cx={cx} cy={cy} r="1.5" fill="rgba(254,240,138,0.7)" />
        <circle cx={cx} cy={cy} r="0.6" fill="#fef3c7" />
      </g>
    </g>
  );
}
