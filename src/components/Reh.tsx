interface Props {
  scale?: number;
}

const TREES = [
  { x: 12,  height: 70,  scale: 0.85, delay: '-1s'   },
  { x: 60,  height: 95,  scale: 1.0,  delay: '-2.5s' },
  { x: 118, height: 55,  scale: 0.7,  delay: '-0.5s' },
  { x: 168, height: 110, scale: 1.15, delay: '-3.2s' },
  { x: 200, height: 80,  scale: 0.9,  delay: '-1.8s' },
];

export function Reh({ scale = 1 }: Props) {
  return (
    <div
      className="relative pointer-events-none select-none"
      style={{
        width: 210 * scale,
        height: 130 * scale,
        transform: `scale(${scale})`,
        transformOrigin: 'bottom right',
      }}
    >
      <style>{`
        @keyframes r-tree-sway     { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(1.2deg); } }
        @keyframes r-deer-walk     {
          0%   { transform: translateX(155px); }
          20%  { transform: translateX(110px); }
          30%  { transform: translateX(110px); }
          50%  { transform: translateX(55px);  }
          60%  { transform: translateX(55px);  }
          78%  { transform: translateX(8px);   }
          88%  { transform: translateX(8px);   }
          100% { transform: translateX(155px); }
        }
        @keyframes r-deer-head {
          0%, 19%, 31%, 77%, 89%, 100% { transform: rotate(0deg); }
          22%, 28%, 80%, 86% { transform: rotate(50deg); }
        }
        @keyframes r-deer-bob      { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.2px); } }
        @keyframes r-blink         { 0%,93%,100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
        @keyframes r-rabbit-hop    { 0%,100% { transform: translateY(0); } 35% { transform: translateY(-5px); } 70% { transform: translateY(0); } }
        @keyframes r-rabbit-cross  {
          0%   { transform: translateX(20px); }
          48%  { transform: translateX(170px); }
          52%  { transform: translateX(170px) scaleX(-1); }
          96%  { transform: translateX(20px) scaleX(-1); }
          100% { transform: translateX(20px); }
        }
        @keyframes r-owl-head      {
          0%,40%,100% { transform: rotate(0deg); }
          50%         { transform: rotate(-12deg); }
          60%         { transform: rotate(0deg); }
          70%         { transform: rotate(12deg); }
          80%         { transform: rotate(0deg); }
        }
        @keyframes r-owl-blink     { 0%,90%,100% { transform: scaleY(1); } 95% { transform: scaleY(0.05); } }
        @keyframes r-butterfly-fly {
          0%   { transform: translate(20px, 30px); }
          25%  { transform: translate(80px, 12px); }
          50%  { transform: translate(150px, 25px); }
          75%  { transform: translate(120px, 50px); }
          100% { transform: translate(20px, 30px); }
        }
        @keyframes r-butterfly-flutter { 0%,100% { transform: scaleX(1); } 50% { transform: scaleX(0.3); } }
        @keyframes r-squirrel-climb {
          0%   { transform: translateY(0)    rotate(0deg); }
          45%  { transform: translateY(-50px) rotate(0deg); }
          50%  { transform: translateY(-50px) rotate(180deg); }
          95%  { transform: translateY(0)    rotate(180deg); }
          100% { transform: translateY(0)    rotate(0deg); }
        }
        @keyframes r-bird-glide    { 0% { transform: translate(-30px, 8px); } 100% { transform: translate(220px, 18px); } }
        @keyframes r-creek-flow    { 0% { transform: translateX(0); } 100% { transform: translateX(-12px); } }
        @keyframes r-sparkle       { 0%,100% { opacity: 0; transform: scale(0.6); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes r-mushroom-bob  { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-0.5px) scale(1.02); } }
        @keyframes r-firefly-glow  { 0%,100% { opacity: 0.2; } 50% { opacity: 1; } }
        @keyframes r-firefly-drift {
          0%   { transform: translate(0, 0); }
          33%  { transform: translate(15px, -8px); }
          66%  { transform: translate(-5px, -12px); }
          100% { transform: translate(0, 0); }
        }

        .r-tree     { transform-origin: bottom center; animation: r-tree-sway 4s infinite ease-in-out; }
        .r-deer     { animation: r-deer-walk 30s infinite linear; }
        .r-deer-bob { animation: r-deer-bob 0.5s infinite ease-in-out; }
        .r-deer-head{ transform-origin: 8px 76px; animation: r-deer-head 30s infinite linear; }
        .r-blink    { transform-origin: -4px 48px; animation: r-blink 4.2s infinite; }
        .r-rabbit-hop   { animation: r-rabbit-hop 0.7s infinite ease-out; }
        .r-rabbit-cross { animation: r-rabbit-cross 22s infinite linear; transform-origin: center; }
        .r-owl-head { transform-origin: center; animation: r-owl-head 6s infinite ease-in-out; }
        .r-owl-blink{ transform-origin: center; animation: r-owl-blink 5s infinite ease-in-out; }
        .r-butterfly-fly     { animation: r-butterfly-fly 18s infinite ease-in-out; }
        .r-butterfly-flutter { transform-origin: center; animation: r-butterfly-flutter 0.18s infinite linear; }
        .r-squirrel { transform-origin: center; animation: r-squirrel-climb 12s infinite ease-in-out; }
        .r-bird     { animation: r-bird-glide 25s infinite linear; }
        .r-creek    { animation: r-creek-flow 3s infinite linear; }
        .r-sparkle  { transform-origin: center; animation: r-sparkle 2.5s infinite ease-in-out; }
        .r-mushroom { transform-origin: bottom center; animation: r-mushroom-bob 5s infinite ease-in-out; }
        .r-firefly  { animation: r-firefly-glow 2.8s infinite ease-in-out; }
        .r-firefly-drift { animation: r-firefly-drift 9s infinite ease-in-out; }

        @media (prefers-reduced-motion: reduce) {
          .r-tree, .r-deer, .r-deer-bob, .r-deer-head, .r-blink,
          .r-rabbit-hop, .r-rabbit-cross, .r-owl-head, .r-owl-blink,
          .r-butterfly-fly, .r-butterfly-flutter, .r-squirrel, .r-bird,
          .r-creek, .r-sparkle, .r-mushroom, .r-firefly, .r-firefly-drift {
            animation: none;
          }
        }
      `}</style>

      <svg viewBox="0 0 210 130" width={210} height={130} style={{ overflow: 'visible' }}>
        {/* Boden-Grundton */}
        <rect x="0" y="120" width="210" height="10" fill="rgba(20,40,25,0.4)" />

        {/* Hintere Vogel-Silhouette zieht durchs Bild */}
        <g className="r-bird">
          <path d="M0,0 Q3,-3 6,0 Q9,-3 12,0" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
        </g>

        {/* Hintergrund-Tannen mit Sway, jeder mit eigenem Delay */}
        {TREES.map((t, i) => (
          <g key={i} className="r-tree" style={{ animationDelay: t.delay }}>
            <Tree x={t.x} h={t.height} scale={t.scale} />
          </g>
        ))}

        {/* Eule oben in der Krone von Tanne 2 (x=60, h=95 → Spitze bei y=120-95=25) */}
        <g transform="translate(56, 30)">
          <Owl />
        </g>

        {/* Eichhörnchen klettert am Stamm der großen Tanne 4 (x=168), Basis bei y=110 */}
        <g transform="translate(165, 110)">
          <g className="r-squirrel">
            <Squirrel />
          </g>
        </g>

        {/* Schmetterling fliegt einen Loop in der oberen Hälfte */}
        <g className="r-butterfly-fly">
          <Butterfly />
        </g>

        {/* Reh — Walk + Bob + Head verschachtelt, kein React-State mehr */}
        <g className="r-deer">
          <g className="r-deer-bob">
            <DeerSvg />
          </g>
        </g>

        {/* Hase — hüpft + läuft horizontal hin und her */}
        <g className="r-rabbit-cross">
          <g className="r-rabbit-hop">
            <Rabbit />
          </g>
        </g>

        {/* Bach am unteren Rand */}
        <g transform="translate(0, 117)">
          <Creek />
        </g>

        {/* Pilze auf dem Boden */}
        <g className="r-mushroom" style={{ animationDelay: '-0.3s' }}>
          <Mushroom x={28}  cap="#c0392b" />
        </g>
        <g className="r-mushroom" style={{ animationDelay: '-1.4s' }}>
          <Mushroom x={48}  cap="#c0392b" small />
        </g>
        <g className="r-mushroom" style={{ animationDelay: '-2.1s' }}>
          <Mushroom x={102} cap="#8b5a2b" />
        </g>
        <g className="r-mushroom" style={{ animationDelay: '-0.9s' }}>
          <Mushroom x={195} cap="#c0392b" small />
        </g>

        {/* Glühwürmchen — pulse + drift */}
        <Firefly cx={20}  cy={70}  driftDelay="-1s" />
        <Firefly cx={92}  cy={48}  driftDelay="-3s" />
        <Firefly cx={138} cy={78}  driftDelay="-5s" />
        <Firefly cx={183} cy={45}  driftDelay="-7s" />
      </svg>
    </div>
  );
}

// ── Tannenbaum ────────────────────────────────────────────────────────────
function Tree({ x, h, scale }: { x: number; h: number; scale: number }) {
  const groundY = 120;
  const trunkW = 5 * scale;
  const crownH = h - 14;
  const crownW = 24 * scale + crownH * 0.3;

  return (
    <g>
      <ellipse cx={x} cy={groundY + 1} rx={crownW * 0.55} ry={2.5} fill="rgba(0,0,0,0.4)" />
      <rect x={x - trunkW / 2} y={groundY - 14} width={trunkW} height={14} fill="#5a3010" rx={1} />
      <polygon
        points={`${x},${groundY - h} ${x - crownW / 2},${groundY - 14 - crownH * 0.05} ${x + crownW / 2},${groundY - 14 - crownH * 0.05}`}
        fill="#1f4d2f"
      />
      <polygon
        points={`${x},${groundY - h + crownH * 0.18} ${x - crownW * 0.42},${groundY - 14 + crownH * 0.05} ${x + crownW * 0.42},${groundY - 14 + crownH * 0.05}`}
        fill="#2a5e3a"
      />
      <polygon
        points={`${x},${groundY - h + crownH * 0.4} ${x - crownW * 0.34},${groundY - 14 + crownH * 0.12} ${x + crownW * 0.34},${groundY - 14 + crownH * 0.12}`}
        fill="#326c44"
      />
      <polygon
        points={`${x},${groundY - h} ${x - crownW * 0.25},${groundY - h + crownH * 0.3} ${x - 1},${groundY - h + crownH * 0.3}`}
        fill="rgba(255,255,255,0.08)"
      />
    </g>
  );
}

// ── Reh ───────────────────────────────────────────────────────────────────
function DeerSvg() {
  const groundY = 105;
  return (
    <g>
      <ellipse cx="28" cy={groundY + 0.5} rx="22" ry="2.5" fill="rgba(0,0,0,0.35)" />
      <rect x="14" y={groundY - 22} width="3" height="22" fill="#8a5a2a" />
      <rect x="22" y={groundY - 20} width="3" height="20" fill="#8a5a2a" />
      <rect x="34" y={groundY - 22} width="3" height="22" fill="#8a5a2a" />
      <rect x="42" y={groundY - 20} width="3" height="20" fill="#8a5a2a" />
      <rect x="13.5" y={groundY - 2} width="4" height="3" fill="#3a1808" rx="1" />
      <rect x="21.5" y={groundY - 2} width="4" height="3" fill="#3a1808" rx="1" />
      <rect x="33.5" y={groundY - 2} width="4" height="3" fill="#3a1808" rx="1" />
      <rect x="41.5" y={groundY - 2} width="4" height="3" fill="#3a1808" rx="1" />
      <ellipse cx="28" cy={groundY - 24} rx="22" ry="11" fill="#a87241" />
      <ellipse cx="28" cy={groundY - 18} rx="20" ry="6" fill="#c8945a" />
      <circle cx="16" cy={groundY - 26} r="1.4" fill="#fff" opacity="0.85" />
      <circle cx="22" cy={groundY - 29} r="1.2" fill="#fff" opacity="0.8" />
      <circle cx="34" cy={groundY - 27} r="1.3" fill="#fff" opacity="0.85" />
      <circle cx="40" cy={groundY - 25} r="1.2" fill="#fff" opacity="0.8" />
      <ellipse cx="50" cy={groundY - 29} rx="3" ry="4" fill="#a87241" />
      <ellipse cx="51" cy={groundY - 27} rx="2" ry="3" fill="#fff" />

      {/* Hals + Kopf — animiert via .r-deer-head */}
      <g className="r-deer-head">
        <path d="M8 76 L -2 56 L 4 54 L 12 74 Z" fill="#a87241" />
        <ellipse cx="-4" cy="50" rx="9" ry="7" fill="#a87241" />
        <ellipse cx="-11" cy="53" rx="4" ry="3" fill="#8a5a2a" />
        <ellipse cx="-13" cy="52" rx="1.5" ry="1.2" fill="#1a0e05" />
        <ellipse cx="-4" cy="48" rx="1.5" ry="1.8" fill="#1a0e05" className="r-blink" />
        <circle cx="-3.5" cy="47.5" r="0.5" fill="#fff" />
        <ellipse cx="-2" cy="42" rx="2" ry="4" fill="#a87241" transform="rotate(-15 -2 42)" />
        <ellipse cx="-2" cy="42" rx="1" ry="2.5" fill="#e8b888" transform="rotate(-15 -2 42)" />
        <ellipse cx="-7" cy="43" rx="2" ry="4" fill="#a87241" transform="rotate(-25 -7 43)" />
        <ellipse cx="-7" cy="43" rx="1" ry="2.5" fill="#e8b888" transform="rotate(-25 -7 43)" />
      </g>
    </g>
  );
}

// ── Hase ──────────────────────────────────────────────────────────────────
function Rabbit() {
  return (
    <g transform="translate(0, 110)">
      {/* Schatten */}
      <ellipse cx="6" cy="9" rx="6" ry="1.2" fill="rgba(0,0,0,0.35)" />
      {/* Hinterbeine */}
      <ellipse cx="2.5" cy="6.5" rx="2.2" ry="2.8" fill="#8a6a4a" />
      {/* Körper */}
      <ellipse cx="6" cy="3" rx="5.5" ry="3.5" fill="#a8855f" />
      {/* Kopf */}
      <circle cx="11" cy="0" r="2.8" fill="#a8855f" />
      {/* Ohren */}
      <ellipse cx="10.5" cy="-3.5" rx="0.9" ry="2.6" fill="#8a6a4a" transform="rotate(-12 10.5 -3.5)" />
      <ellipse cx="12"   cy="-3.5" rx="0.9" ry="2.6" fill="#8a6a4a" transform="rotate(8 12 -3.5)" />
      <ellipse cx="10.5" cy="-3.5" rx="0.4" ry="1.8" fill="#e8b888" transform="rotate(-12 10.5 -3.5)" />
      <ellipse cx="12"   cy="-3.5" rx="0.4" ry="1.8" fill="#e8b888" transform="rotate(8 12 -3.5)" />
      {/* Auge */}
      <circle cx="11.6" cy="-0.2" r="0.4" fill="#1a0e05" />
      {/* Schwänzchen */}
      <circle cx="0.5" cy="2" r="1.2" fill="#fff" />
    </g>
  );
}

// ── Eule ──────────────────────────────────────────────────────────────────
function Owl() {
  return (
    <g>
      {/* Körper */}
      <ellipse cx="0" cy="0" rx="6" ry="7" fill="#5a3a1c" />
      <ellipse cx="0" cy="2" rx="4.5" ry="5" fill="#7a5a3c" />
      {/* Kopf — dreht sich */}
      <g className="r-owl-head">
        <ellipse cx="0" cy="-5" rx="5" ry="4.5" fill="#5a3a1c" />
        {/* Augen-Kreise (Eulengesicht) */}
        <circle cx="-2" cy="-5" r="2" fill="#f5e6c8" />
        <circle cx="2"  cy="-5" r="2" fill="#f5e6c8" />
        {/* Pupillen — blinzeln */}
        <g className="r-owl-blink" style={{ transformOrigin: '-2px -5px' }}>
          <circle cx="-2" cy="-5" r="1.1" fill="#1a0e05" />
        </g>
        <g className="r-owl-blink" style={{ transformOrigin: '2px -5px' }}>
          <circle cx="2"  cy="-5" r="1.1" fill="#1a0e05" />
        </g>
        {/* Schnabel */}
        <polygon points="0,-3.5 -0.6,-1.8 0.6,-1.8" fill="#d97706" />
        {/* Federbüschel */}
        <polygon points="-3,-9 -2.2,-7 -3.6,-7" fill="#5a3a1c" />
        <polygon points="3,-9 2.2,-7 3.6,-7" fill="#5a3a1c" />
      </g>
      {/* Flügel-Federn-Andeutung */}
      <path d="M-5 1 Q-3 5 -2 6" stroke="#3a2510" strokeWidth="0.4" fill="none" />
      <path d="M5 1 Q3 5 2 6" stroke="#3a2510" strokeWidth="0.4" fill="none" />
    </g>
  );
}

// ── Schmetterling ─────────────────────────────────────────────────────────
function Butterfly() {
  return (
    <g className="r-butterfly-flutter">
      {/* Körper */}
      <line x1="0" y1="-3" x2="0" y2="3" stroke="#1a0e05" strokeWidth="0.7" strokeLinecap="round" />
      {/* Antennen */}
      <path d="M0 -3 Q-1.5 -5 -2.2 -5.5" stroke="#1a0e05" strokeWidth="0.4" fill="none" strokeLinecap="round" />
      <path d="M0 -3 Q1.5 -5 2.2 -5.5" stroke="#1a0e05" strokeWidth="0.4" fill="none" strokeLinecap="round" />
      {/* Linke Flügel (oben + unten) */}
      <ellipse cx="-3" cy="-1" rx="3" ry="2.2" fill="#f97316" opacity="0.85" />
      <ellipse cx="-2.5" cy="2" rx="2.2" ry="1.8" fill="#fb923c" opacity="0.85" />
      {/* Rechte Flügel */}
      <ellipse cx="3"   cy="-1" rx="3"   ry="2.2" fill="#f97316" opacity="0.85" />
      <ellipse cx="2.5" cy="2"  rx="2.2" ry="1.8" fill="#fb923c" opacity="0.85" />
      {/* Punkte */}
      <circle cx="-3.2" cy="-1" r="0.5" fill="#7c2d12" />
      <circle cx="3.2"  cy="-1" r="0.5" fill="#7c2d12" />
    </g>
  );
}

// ── Eichhörnchen ──────────────────────────────────────────────────────────
function Squirrel() {
  return (
    <g>
      {/* Schwanz (buschig, hinten) */}
      <path d="M-4 0 Q-7 -3 -6 -7 Q-3 -8 -2 -5 Q-3 -3 -2 0 Z" fill="#a05a1a" />
      <path d="M-5 -2 Q-6 -5 -4 -6" stroke="#7c4a1a" strokeWidth="0.5" fill="none" />
      {/* Körper */}
      <ellipse cx="0" cy="-1" rx="3" ry="3.5" fill="#b8651e" />
      {/* Kopf */}
      <circle cx="2.5" cy="-3.5" r="2" fill="#b8651e" />
      {/* Ohren */}
      <polygon points="2,-5.5 1.5,-6.5 2.6,-5.8" fill="#8a4a14" />
      <polygon points="3,-5.5 3.5,-6.5 3.6,-5.5" fill="#8a4a14" />
      {/* Auge */}
      <circle cx="3" cy="-3.6" r="0.4" fill="#1a0e05" />
      {/* Pfötchen */}
      <ellipse cx="0" cy="2" rx="0.8" ry="1" fill="#8a4a14" />
      <ellipse cx="2" cy="2" rx="0.8" ry="1" fill="#8a4a14" />
      {/* Eichel zwischen den Pfoten */}
      <ellipse cx="1" cy="2" rx="0.7" ry="0.5" fill="#5a3010" />
      <rect x="0.7" y="1.6" width="0.6" height="0.3" fill="#3a1808" />
    </g>
  );
}

// ── Bach ──────────────────────────────────────────────────────────────────
function Creek() {
  return (
    <g>
      {/* Bach-Bett */}
      <rect x="0" y="0" width="210" height="6" fill="#1a3a55" opacity="0.85" />
      <rect x="0" y="1" width="210" height="3" fill="#234a6e" opacity="0.85" />
      {/* Welle (doppelt versetzt für nahtlosen Loop) */}
      <g className="r-creek">
        <path
          d="M0 3 Q3 1 6 3 Q9 5 12 3 Q15 1 18 3 Q21 5 24 3 Q27 1 30 3 Q33 5 36 3 Q39 1 42 3 Q45 5 48 3 Q51 1 54 3 Q57 5 60 3 Q63 1 66 3 Q69 5 72 3 Q75 1 78 3 Q81 5 84 3 Q87 1 90 3 Q93 5 96 3 Q99 1 102 3 Q105 5 108 3 Q111 1 114 3 Q117 5 120 3 Q123 1 126 3 Q129 5 132 3 Q135 1 138 3 Q141 5 144 3 Q147 1 150 3 Q153 5 156 3 Q159 1 162 3 Q165 5 168 3 Q171 1 174 3 Q177 5 180 3 Q183 1 186 3 Q189 5 192 3 Q195 1 198 3 Q201 5 204 3 Q207 1 210 3 Q213 5 216 3 Q219 1 222 3"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="0.6"
          fill="none"
        />
      </g>
      {/* Glitzer-Sterne */}
      <g className="r-sparkle" style={{ animationDelay: '0s', transformOrigin: '40px 2.5px' }}>
        <circle cx="40" cy="2.5" r="0.8" fill="rgba(255,255,255,0.9)" />
      </g>
      <g className="r-sparkle" style={{ animationDelay: '-0.9s', transformOrigin: '110px 3px' }}>
        <circle cx="110" cy="3" r="0.8" fill="rgba(255,255,255,0.9)" />
      </g>
      <g className="r-sparkle" style={{ animationDelay: '-1.8s', transformOrigin: '175px 2.5px' }}>
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
      {/* Stiel */}
      <rect x={x - w * 0.3} y={baseY - stemH} width={w * 0.6} height={stemH} fill="#f5e6c8" rx={0.5} />
      {/* Hut */}
      <ellipse cx={x} cy={baseY - stemH} rx={w} ry={w * 0.7} fill={cap} />
      {/* Punkte (nur bei Fliegenpilz, also rot) */}
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
function Firefly({ cx, cy, driftDelay }: { cx: number; cy: number; driftDelay: string }) {
  return (
    <g className="r-firefly-drift" style={{ animationDelay: driftDelay, transformOrigin: `${cx}px ${cy}px` }}>
      <g className="r-firefly" style={{ animationDelay: driftDelay }}>
        <circle cx={cx} cy={cy} r="3" fill="rgba(252,211,77,0.25)" />
        <circle cx={cx} cy={cy} r="1.5" fill="rgba(254,240,138,0.7)" />
        <circle cx={cx} cy={cy} r="0.6" fill="#fef3c7" />
      </g>
    </g>
  );
}
