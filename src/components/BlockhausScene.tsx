import type { ReactNode } from 'react';

interface Props {
  children: ReactNode; // Das Blockhaus
}

const W = 460;
const H = 200;

// Hintere Bäume (vor dem Berg, hinter der Sauna)
const BACK_TREES = [
  { x: 22,  h: 68, dimmer: true,  delay: '-0.4s' },
  { x: 95,  h: 86, dimmer: false, delay: '-2.5s' },
  { x: 145, h: 70, dimmer: true,  delay: '-1.2s' },
  { x: 200, h: 92, dimmer: false, delay: '-3.6s' },
  { x: 255, h: 75, dimmer: true,  delay: '-0.9s' },
  { x: 305, h: 65, dimmer: true,  delay: '-2.0s' },
  { x: 415, h: 95, dimmer: false, delay: '-1.6s' },
];

// Vordere Bäume (vor der Sauna, kräftiger)
const FRONT_TREES = [
  { x: 60,  h: 58, delay: '-1.0s' },
  { x: 270, h: 62, delay: '-2.8s' },
  { x: 440, h: 70, delay: '-0.6s' },
];

export function BlockhausScene({ children }: Props) {
  return (
    <div className="relative pointer-events-none" style={{ width: W, height: H }}>
      <style>{`
        @keyframes bs-tree-sway      { 0%,100% { transform: rotate(0deg); }       50% { transform: rotate(1.5deg); } }
        @keyframes bs-reeds-sway     { 0%,100% { transform: rotate(0deg) skewX(0deg); } 50% { transform: rotate(2deg) skewX(1deg); } }
        @keyframes bs-ripple         { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(3); opacity: 0; } }
        @keyframes bs-bird-1         { 0% { transform: translate(-50px, 30px); } 100% { transform: translate(500px, 18px); } }
        @keyframes bs-bird-2         { 0% { transform: translate(500px, 14px); } 100% { transform: translate(-50px, 28px); } }
        @keyframes bs-fisher-breath  { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.03); } }
        @keyframes bs-rod-twitch     { 0%,90%,100% { transform: rotate(0deg); } 93% { transform: rotate(-2deg); } 96% { transform: rotate(1deg); } }
        @keyframes bs-cloud-drift    { 0% { transform: translateX(0); } 100% { transform: translateX(50px); } }
        @keyframes bs-butterfly-fly  {
          0%   { transform: translate(180px, 60px); }
          25%  { transform: translate(240px, 35px); }
          50%  { transform: translate(290px, 55px); }
          75%  { transform: translate(220px, 80px); }
          100% { transform: translate(180px, 60px); }
        }
        @keyframes bs-butterfly-flap { 0%,100% { transform: scaleX(1); } 50% { transform: scaleX(0.3); } }
        @keyframes bs-firefly-glow   { 0%,100% { opacity: 0.2; } 50% { opacity: 1; } }
        @keyframes bs-firefly-drift  {
          0%   { transform: translate(0, 0); }
          33%  { transform: translate(15px, -8px); }
          66%  { transform: translate(-5px, -12px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes bs-climber-hike {
          0%   { transform: translate(0, 0)   rotate(0deg); }
          25%  { transform: translate(8px, -8px) rotate(0deg); }
          50%  { transform: translate(20px, -18px) rotate(0deg); }
          75%  { transform: translate(32px, -28px) rotate(0deg); }
          100% { transform: translate(45px, -38px) rotate(0deg); }
        }
        @keyframes bs-climber-step   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1px); } }
        @keyframes bs-duck-swim {
          0%   { transform: translateX(0); }
          50%  { transform: translateX(36px) scaleX(-1); }
          100% { transform: translateX(0) scaleX(1); }
        }
        @keyframes bs-duck-bob       { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-0.6px); } }

        .bs-tree     { transform-origin: bottom center; animation: bs-tree-sway 4s infinite ease-in-out; }
        .bs-reeds    { transform-origin: bottom center; animation: bs-reeds-sway 3s infinite ease-in-out; }
        .bs-ripple   { transform-origin: center;        animation: bs-ripple 3s infinite ease-out; }
        .bs-bird-1   { animation: bs-bird-1 22s infinite linear; }
        .bs-bird-2   { animation: bs-bird-2 28s infinite linear; }
        .bs-fisher   { transform-origin: bottom center; animation: bs-fisher-breath 3s infinite ease-in-out; }
        .bs-rod      { transform-origin: 24px 4px;       animation: bs-rod-twitch 5s infinite; }
        .bs-cloud    { animation: bs-cloud-drift 70s infinite alternate ease-in-out; }
        .bs-butterfly-fly  { animation: bs-butterfly-fly 22s infinite ease-in-out; }
        .bs-butterfly-flap { transform-origin: center; animation: bs-butterfly-flap 0.18s infinite linear; }
        .bs-firefly        { animation: bs-firefly-glow 9s infinite ease-in-out; }
        .bs-firefly-drift  { animation: bs-firefly-drift 30s infinite ease-in-out; }
        .bs-climber  { animation: bs-climber-hike 18s infinite ease-in-out alternate; }
        .bs-climber-step { animation: bs-climber-step 0.9s infinite ease-in-out; }
        .bs-duck     { animation: bs-duck-swim 14s infinite ease-in-out; }
        .bs-duck-bob { animation: bs-duck-bob 1.4s infinite ease-in-out; }

        @media (prefers-reduced-motion: reduce) {
          .bs-tree, .bs-reeds, .bs-ripple, .bs-bird-1, .bs-bird-2,
          .bs-fisher, .bs-rod, .bs-cloud, .bs-butterfly-fly, .bs-butterfly-flap,
          .bs-firefly, .bs-firefly-drift, .bs-climber, .bs-climber-step,
          .bs-duck, .bs-duck-bob { animation: none; }
        }
      `}</style>

      <svg className="absolute inset-0" viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ overflow: 'visible' }}>
        {/* Bodensaum */}
        <ellipse cx={W / 2} cy={H - 4} rx={W / 2 - 6} ry="6" fill="rgba(20,40,25,0.45)" />

        {/* ──── Berg links mit Schnee-Gipfel ──── */}
        <Mountain />

        {/* ──── Wolken oben ──── */}
        <g className="bs-cloud">
          <Cloud cx={70}  cy={20} w={26} />
        </g>
        <g className="bs-cloud" style={{ animationDelay: '-30s' }}>
          <Cloud cx={250} cy={14} w={22} />
        </g>
        <g className="bs-cloud" style={{ animationDelay: '-50s' }}>
          <Cloud cx={395} cy={22} w={18} />
        </g>

        {/* ──── 2 Vögel ziehen quer ──── */}
        <g className="bs-bird-1">
          <path d="M0,0 Q3,-3 6,0 Q9,-3 12,0" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
        </g>
        <g className="bs-bird-2">
          <path d="M0,0 Q3,-3 6,0 Q9,-3 12,0" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.7" />
        </g>

        {/* ──── Bergsteiger auf dem Berghang ──── */}
        <g transform="translate(50, 110)">
          <g className="bs-climber">
            <g className="bs-climber-step">
              <Climber />
            </g>
          </g>
        </g>

        {/* ──── Hintere Bäume ──── */}
        {BACK_TREES.map((t, i) => (
          <g key={`bt-${i}`} className="bs-tree" style={{ animationDelay: t.delay }}>
            <BackTree x={t.x} h={t.h} dimmer={t.dimmer} />
          </g>
        ))}

        {/* ──── Schmetterling fliegt im rechten Bereich ──── */}
        <g className="bs-butterfly-fly">
          <Butterfly />
        </g>

        {/* ──── Teich mit Wasserringen ──── */}
        <Pond cx={360} cy={175} rx={65} ry={16} />

        {/* ──── Schilf ──── */}
        <g className="bs-reeds" style={{ animationDelay: '-0.2s' }}>
          <Reeds x={310} y={178} />
        </g>
        <g className="bs-reeds" style={{ animationDelay: '-1.5s' }}>
          <Reeds x={425} y={172} />
        </g>

        {/* ──── Ente im Teich ──── */}
        <g transform="translate(330, 172)">
          <g className="bs-duck">
            <g className="bs-duck-bob">
              <Duck />
            </g>
          </g>
        </g>

        {/* ──── Bank + Angler ──── */}
        <Bench x={310} y={148} />
        <g className="bs-fisher">
          <Fisher x={316} y={116} />
        </g>

        {/* ──── Angelrute mit Twitch ──── */}
        <g transform="translate(340, 120)" className="bs-rod">
          <line x1="0" y1="0" x2="45" y2="12" stroke="#c8915a" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="45" y1="12" x2="45" y2="52" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
          <circle cx="45" cy="52" r="1" fill="#fbbf24" />
        </g>

        {/* ──── Vordere Bäume (überlappen die Sauna leicht) ──── */}
        {FRONT_TREES.map((t, i) => (
          <g key={`ft-${i}`} className="bs-tree" style={{ animationDelay: t.delay }}>
            <BackTree x={t.x} h={t.h} dimmer={false} front />
          </g>
        ))}

        {/* ──── Glühwürmchen ──── */}
        <Firefly cx={30}  cy={130} driftDelay="-3s"  glowDelay="-1s" />
        <Firefly cx={235} cy={150} driftDelay="-9s"  glowDelay="-3s" />
        <Firefly cx={290} cy={130} driftDelay="-15s" glowDelay="-5s" />
        <Firefly cx={400} cy={140} driftDelay="-21s" glowDelay="-7s" />
      </svg>

      {/* Sauna mittig — jetzt am Boden (top angepasst von 18 → 40) */}
      <div className="absolute" style={{ left: 130, top: 40, pointerEvents: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

// ── Berg links ────────────────────────────────────────────────────────────
function Mountain() {
  return (
    <g opacity="0.85">
      {/* Hinterer kleinerer Gipfel rechts vom Hauptgipfel */}
      <polygon points="115,55 145,115 75,115" fill="#3a4a55" opacity="0.6" />
      {/* Haupt-Berg */}
      <polygon points="55,30 130,118 0,118" fill="#4a5560" />
      {/* Schatten-Seite */}
      <polygon points="55,30 55,118 0,118" fill="#3a4550" />
      {/* Schnee-Gipfel */}
      <polygon points="55,30 68,52 50,50 44,56 38,52" fill="#ecf0f4" />
      {/* Schnee-Akzent rechts */}
      <polygon points="55,30 38,52 30,60 50,50" fill="#d8dde2" />
      {/* Felsen-Linien */}
      <path d="M22 88 L 35 86 L 45 90" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" fill="none" />
      <path d="M70 80 L 85 84 L 95 88" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" fill="none" />
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

// ── Bergsteiger ───────────────────────────────────────────────────────────
function Climber() {
  return (
    <g>
      {/* Wanderstöcke */}
      <line x1="-3" y1="-1" x2="-5" y2="6"  stroke="#374151" strokeWidth="0.4" />
      <line x1="4"  y1="-1" x2="6"  y2="6"  stroke="#374151" strokeWidth="0.4" />
      {/* Beine */}
      <line x1="0.5" y1="0" x2="0"   y2="3.2" stroke="#1f2937" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="2"   y1="0" x2="2.5" y2="3.2" stroke="#1f2937" strokeWidth="1.1" strokeLinecap="round" />
      {/* Wanderschuhe */}
      <ellipse cx="0"   cy="3.5" rx="0.9" ry="0.5" fill="#1a0e05" />
      <ellipse cx="2.5" cy="3.5" rx="0.9" ry="0.5" fill="#1a0e05" />
      {/* Körper (rote Wanderjacke) */}
      <ellipse cx="1.2" cy="-1.7" rx="1.7" ry="2" fill="#dc2626" />
      {/* Rucksack hinten */}
      <rect x="-1" y="-3" width="2" height="3" fill="#15803d" rx="0.3" />
      <rect x="-1" y="-3" width="2" height="0.6" fill="#166534" />
      {/* Kopf */}
      <circle cx="1.2" cy="-4" r="1.1" fill="#ffd5aa" />
      {/* Hut/Mütze */}
      <path d="M0 -4.4 Q1.2 -5.5 2.4 -4.4 L 2.4 -4 L 0 -4 Z" fill="#92400e" />
      <ellipse cx="1.2" cy="-4" rx="1.4" ry="0.3" fill="#7c2d12" />
    </g>
  );
}

// ── Mini-Tannenbaum ───────────────────────────────────────────────────────
function BackTree({ x, h, dimmer = false, front = false }: { x: number; h: number; dimmer?: boolean; front?: boolean }) {
  const groundY = front ? 192 : 188;
  const trunkW = front ? 4 : 3;
  const crownH = h - 10;
  const crownW = 16 + crownH * 0.28;
  const opacity = dimmer ? 0.55 : front ? 1 : 0.85;

  return (
    <g opacity={opacity}>
      <ellipse cx={x} cy={groundY + 1} rx={crownW * 0.5} ry={1.5} fill="rgba(0,0,0,0.35)" />
      <rect x={x - trunkW / 2} y={groundY - 10} width={trunkW} height={10} fill="#5a3010" rx={1} />
      <polygon
        points={`${x},${groundY - h} ${x - crownW / 2},${groundY - 10 - crownH * 0.05} ${x + crownW / 2},${groundY - 10 - crownH * 0.05}`}
        fill="#1f4d2f"
      />
      <polygon
        points={`${x},${groundY - h + crownH * 0.2} ${x - crownW * 0.42},${groundY - 10 + crownH * 0.05} ${x + crownW * 0.42},${groundY - 10 + crownH * 0.05}`}
        fill="#2a5e3a"
      />
      <polygon
        points={`${x},${groundY - h + crownH * 0.42} ${x - crownW * 0.34},${groundY - 10 + crownH * 0.12} ${x + crownW * 0.34},${groundY - 10 + crownH * 0.12}`}
        fill="#326c44"
      />
    </g>
  );
}

// ── Teich mit animierten Wasserringen ─────────────────────────────────────
function Pond({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#1a3a55" />
      <ellipse cx={cx} cy={cy - 2} rx={rx - 4} ry={ry - 3} fill="#234a6e" />
      <circle className="bs-ripple" cx={cx + 25} cy={cy + 5} r="2" fill="none" stroke="white" strokeWidth="0.5" />
      <circle
        className="bs-ripple"
        cx={cx - 15}
        cy={cy - 2}
        r="2"
        fill="none"
        stroke="white"
        strokeWidth="0.5"
        style={{ animationDelay: '-1.5s' }}
      />
    </g>
  );
}

// ── Ente ──────────────────────────────────────────────────────────────────
function Duck() {
  return (
    <g>
      {/* Schatten / Wasser-Reflektion */}
      <ellipse cx="0" cy="2" rx="6" ry="0.7" fill="rgba(0,0,0,0.4)" />
      {/* Körper */}
      <ellipse cx="0" cy="0" rx="5" ry="2.5" fill="#f5e6c8" />
      <ellipse cx="0" cy="-0.3" rx="4" ry="1.8" fill="#fff" />
      {/* Schwanz */}
      <polygon points="-5,0 -7,-1.5 -5,-1" fill="#f5e6c8" />
      {/* Hals + Kopf */}
      <ellipse cx="3.5" cy="-2" rx="1.5" ry="2" fill="#f5e6c8" />
      <circle cx="4" cy="-3.5" r="1.6" fill="#1f4d2f" />
      {/* Schnabel */}
      <polygon points="5.2,-3.5 6.6,-3.2 5.2,-3" fill="#fbbf24" />
      {/* Auge */}
      <circle cx="4.4" cy="-3.7" r="0.3" fill="#1a0e05" />
    </g>
  );
}

// ── Schmetterling ─────────────────────────────────────────────────────────
function Butterfly() {
  return (
    <g className="bs-butterfly-flap">
      <line x1="0" y1="-3" x2="0" y2="3" stroke="#1a0e05" strokeWidth="0.7" strokeLinecap="round" />
      <path d="M0 -3 Q-1.5 -5 -2.2 -5.5" stroke="#1a0e05" strokeWidth="0.4" fill="none" strokeLinecap="round" />
      <path d="M0 -3 Q1.5 -5 2.2 -5.5" stroke="#1a0e05" strokeWidth="0.4" fill="none" strokeLinecap="round" />
      <ellipse cx="-3"   cy="-1" rx="3"   ry="2.2" fill="#a78bfa" opacity="0.85" />
      <ellipse cx="-2.5" cy="2"  rx="2.2" ry="1.8" fill="#c4b5fd" opacity="0.85" />
      <ellipse cx="3"    cy="-1" rx="3"   ry="2.2" fill="#a78bfa" opacity="0.85" />
      <ellipse cx="2.5"  cy="2"  rx="2.2" ry="1.8" fill="#c4b5fd" opacity="0.85" />
      <circle cx="-3.2" cy="-1" r="0.5" fill="#4c1d95" />
      <circle cx="3.2"  cy="-1" r="0.5" fill="#4c1d95" />
    </g>
  );
}

// ── Schilf ────────────────────────────────────────────────────────────────
function Reeds({ x, y }: { x: number; y: number }) {
  return (
    <g stroke="#2d4a1e" strokeWidth="1.2" strokeLinecap="round">
      <line x1={x} y1={y} x2={x - 2} y2={y - 12} />
      <line x1={x + 4} y1={y} x2={x + 5} y2={y - 15} />
      <line x1={x + 8} y1={y} x2={x + 7} y2={y - 10} />
    </g>
  );
}

// ── Bank ──────────────────────────────────────────────────────────────────
function Bench({ x, y }: { x: number; y: number }) {
  return (
    <g fill="#5a3010">
      <rect x={x} y={y + 10} width="2" height="12" />
      <rect x={x + 30} y={y + 10} width="2" height="12" />
      <rect x={x - 2} y={y + 6} width="36" height="4" rx="1" fill="#7c4a1a" />
    </g>
  );
}

// ── Angler ────────────────────────────────────────────────────────────────
function Fisher({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x + 5} y={y + 15} width="12" height="12" fill="#2d4a78" rx="2" />
      <circle cx={x + 11} cy={y + 8} r="6" fill="#ffd5aa" />
      <path d={`M${x + 4} ${y + 5} Q${x + 11} ${y - 5} ${x + 18} ${y + 5}`} fill="#5a3a18" />
      <path
        d={`M${x + 8} ${y + 10} Q${x + 11} ${y + 12} ${x + 14} ${y + 10}`}
        stroke="#333"
        strokeWidth="0.5"
        fill="none"
      />
    </g>
  );
}

// ── Glühwürmchen ──────────────────────────────────────────────────────────
function Firefly({ cx, cy, driftDelay, glowDelay }: { cx: number; cy: number; driftDelay: string; glowDelay: string }) {
  return (
    <g className="bs-firefly-drift" style={{ animationDelay: driftDelay, transformOrigin: `${cx}px ${cy}px` }}>
      <g className="bs-firefly" style={{ animationDelay: glowDelay }}>
        <circle cx={cx} cy={cy} r="3" fill="rgba(252,211,77,0.25)" />
        <circle cx={cx} cy={cy} r="1.5" fill="rgba(254,240,138,0.7)" />
        <circle cx={cx} cy={cy} r="0.6" fill="#fef3c7" />
      </g>
    </g>
  );
}
