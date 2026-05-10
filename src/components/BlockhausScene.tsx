import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Props {
  children: ReactNode; // CuckooDoor
}

// Größe der Bühne — Hütte sitzt links, Teich+Bank+Angler rechts daneben
const W = 460;
const H = 200;

export function BlockhausScene({ children }: Props) {
  return (
    <div className="relative pointer-events-none" style={{ width: W, height: H }}>
      {/* Hintergrund-Kulisse */}
      <svg
        className="absolute inset-0"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={{ overflow: 'visible' }}
      >
        {/* Bodensaum */}
        <ellipse cx={W / 2} cy={H - 4} rx={W / 2 - 6} ry="6" fill="rgba(20,40,25,0.45)" />

        {/* Hintere Bäume — Reihe ganz hinten (klein, dunkel, blasser) */}
        <BackTree x={20}  h={70}  dimmer />
        <BackTree x={60}  h={86} />
        <BackTree x={100} h={62}  dimmer />
        <BackTree x={148} h={78} />
        <BackTree x={206} h={92}  dimmer />
        <BackTree x={258} h={70} />
        <BackTree x={310} h={88} />
        <BackTree x={400} h={75}  dimmer />
        <BackTree x={440} h={82} />

        {/* Vordere Bäume (näher dran, kräftiger) */}
        <BackTree x={36}  h={58} front />
        <BackTree x={368} h={62} front />

        {/* Teich — rechts neben der Hütte */}
        <Pond cx={345} cy={172} rx={68} ry={16} />

        {/* Schilf am Teichrand */}
        <Reeds x={290} y={172} />
        <Reeds x={405} y={172} />

        {/* Seerose im Teich */}
        <g transform="translate(340, 175)">
          <ellipse cx="0" cy="0" rx="7" ry="3" fill="#1f5a3a" />
          <ellipse cx="0" cy="-1.5" rx="3.5" ry="1.4" fill="#2a7048" />
          <circle cx="0" cy="-2" r="1.5" fill="#fcd5d8" />
        </g>

        {/* Bank am Teichrand — auf trockenem Boden ÜBER dem Teich */}
        <Bench x={300} y={146} />

        {/* Angler auf der Bank — sitzt sauber auf der Bank, größer (1.5x) */}
        <Fisher x={306} y={114} />

        {/* Schnur vom Anglers Rute ins Wasser */}
        <motion.line
          x1={372}
          y1={130}
          x2={372}
          y2={170}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="0.6"
          animate={{ x2: [372, 372.5, 371.5, 372] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </svg>

      {/* Hütte als positioniertes Kind über dem SVG */}
      <div className="absolute" style={{ left: 130, top: 18, pointerEvents: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

// ── Mini-Tannenbaum ────────────────────────────────────────────────────────
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

// ── Teich mit Wasser-Schimmer ─────────────────────────────────────────────
function Pond({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy + ry + 1} rx={rx + 2} ry={3} fill="rgba(0,0,0,0.4)" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#1a3a55" />
      <ellipse cx={cx} cy={cy} rx={rx - 3} ry={ry - 2} fill="#2a5078" />
      <ellipse cx={cx - 6} cy={cy - 4} rx={rx * 0.6} ry={ry * 0.45} fill="#3a6a98" opacity="0.7" />
      <ellipse cx={cx - rx * 0.4} cy={cy - ry * 0.3} rx={rx * 0.35} ry={1.5} fill="rgba(255,255,255,0.35)" />
      <ellipse cx={cx + rx * 0.2} cy={cy + ry * 0.1} rx={rx * 0.25} ry={1} fill="rgba(255,255,255,0.18)" />

      {/* Wellenkreise um die Angel-Stelle (cx + 27, cy - 2) */}
      <motion.circle
        cx={cx + 27}
        cy={cy - 2}
        r={2}
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={0.8}
        animate={{ r: [2, 9, 2], opacity: [0.7, 0, 0.7] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
      />
      <motion.circle
        cx={cx + 27}
        cy={cy - 2}
        r={2}
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={0.6}
        animate={{ r: [2, 13, 2], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: 0.6 }}
      />
    </g>
  );
}

// ── Schilf-Halme ──────────────────────────────────────────────────────────
function Reeds({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {[0, 1, 2, 3].map((i) => {
        const offX = i * 3 - 4;
        const len = 8 + (i % 2) * 4;
        return (
          <motion.line
            key={i}
            x1={x + offX}
            y1={y}
            x2={x + offX + (i % 2 === 0 ? -1 : 1)}
            y2={y - len}
            stroke="#3a6028"
            strokeWidth="1"
            strokeLinecap="round"
            animate={{ x2: [x + offX + (i % 2 === 0 ? -1 : 1), x + offX + (i % 2 === 0 ? -2 : 2), x + offX + (i % 2 === 0 ? -1 : 1)] }}
            transition={{ duration: 2.4 + i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
          />
        );
      })}
    </g>
  );
}

// ── Bank ──────────────────────────────────────────────────────────────────
function Bench({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {/* Boden-Schatten */}
      <ellipse cx={x + 18} cy={y + 22} rx={26} ry={2.5} fill="rgba(0,0,0,0.5)" />
      {/* Beine */}
      <rect x={x} y={y + 6} width="3" height="16" fill="#3a1808" rx="0.5" />
      <rect x={x + 33} y={y + 6} width="3" height="16" fill="#3a1808" rx="0.5" />
      {/* Sitzfläche */}
      <rect x={x - 3} y={y + 4} width="42" height="4" fill="#7c4a1a" rx="0.5" />
      <rect x={x - 3} y={y + 4} width="42" height="1" fill="#a06530" rx="0.5" />
      {/* Lehne */}
      <rect x={x + 1} y={y - 12} width="2" height="16" fill="#5a3010" />
      <rect x={x + 33} y={y - 12} width="2" height="16" fill="#5a3010" />
      <rect x={x} y={y - 10} width="36" height="2.5" fill="#7c4a1a" rx="0.5" />
      <rect x={x} y={y - 5} width="36" height="2.5" fill="#7c4a1a" rx="0.5" />
    </g>
  );
}

// ── Angler auf der Bank — größer (1.5x), klar oberhalb des Teichs ─────────
function Fisher({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {/* Beine (sitzend) */}
      <rect x={x + 6} y={y + 18} width="4" height="14" fill="#2d4a78" rx="0.5" />
      <rect x={x + 13} y={y + 18} width="4" height="14" fill="#2d4a78" rx="0.5" />
      {/* Schuhe */}
      <ellipse cx={x + 8} cy={y + 33} rx="3" ry="1.5" fill="#1a0e05" />
      <ellipse cx={x + 15} cy={y + 33} rx="3" ry="1.5" fill="#1a0e05" />

      {/* Karierter Pullover */}
      <rect x={x + 3} y={y + 5} width="16" height="15" fill="#7a3030" rx="1.5" />
      {/* Karo-Pattern */}
      <rect x={x + 3} y={y + 9}  width="16" height="1.5" fill="rgba(0,0,0,0.5)" />
      <rect x={x + 3} y={y + 14} width="16" height="1.5" fill="rgba(0,0,0,0.5)" />
      <rect x={x + 7} y={y + 5}  width="2" height="15" fill="rgba(0,0,0,0.4)" />
      <rect x={x + 13} y={y + 5} width="2" height="15" fill="rgba(0,0,0,0.4)" />

      {/* Kopf */}
      <circle cx={x + 11} cy={y + 1} r="4.5" fill="#ffd5aa" />
      {/* Ohr */}
      <ellipse cx={x + 6.2} cy={y + 1.5} rx="0.8" ry="1.2" fill="#e8a878" />
      {/* Hut mit Krempe */}
      <ellipse cx={x + 11} cy={y - 2.5} rx="6.5" ry="1.5" fill="#3a2510" />
      <rect x={x + 7.5} y={y - 6} width="7" height="3.5" fill="#5a3a18" rx="1" />
      {/* Hut-Band */}
      <rect x={x + 7.5} y={y - 3.5} width="7" height="0.8" fill="#2a1408" />
      {/* Auge */}
      <circle cx={x + 12} cy={y + 1.5} r="0.6" fill="#1a1a2e" />
      {/* Lächeln */}
      <path d={`M${x + 10} ${y + 3.5} Q ${x + 12} ${y + 4.2} ${x + 13} ${y + 3.2}`} stroke="#5a2a08" strokeWidth="0.5" fill="none" strokeLinecap="round" />
      {/* Bart-Andeutung */}
      <path d={`M${x + 8} ${y + 3.5} Q ${x + 11} ${y + 6} ${x + 14} ${y + 3.5}`} stroke="#8a5a2a" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6" />

      {/* Arm + Angelrute */}
      {/* Arm: Schulter (x+18, y+8) → Hand (x+24, y+4) */}
      <path d={`M${x + 18} ${y + 8} Q ${x + 22} ${y + 6} ${x + 24} ${y + 4}`} stroke="#7a3030" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Hand */}
      <circle cx={x + 24} cy={y + 4} r="1.8" fill="#ffd5aa" />
      {/* Angelrute - lang nach rechts ins Wasser */}
      <line x1={x + 24} y1={y + 4} x2={x + 66} y2={y + 16} stroke="#c8915a" strokeWidth="1.5" strokeLinecap="round" />
      {/* Spitze der Rute */}
      <circle cx={x + 66} cy={y + 16} r="0.8" fill="#fbbf24" />
    </g>
  );
}
