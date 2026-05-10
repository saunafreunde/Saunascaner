import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Props {
  children: ReactNode; // CuckooDoor
}

// Größe der Bühne — Hütte sitzt links, Teich+Bank+Angler rechts daneben
const W = 380;
const H = 180;

export function BlockhausScene({ children }: Props) {
  return (
    <div className="relative pointer-events-none" style={{ width: W, height: H }}>
      {/* Hintergrund-Kulisse: Boden, Bäume, Teich, Bank — als SVG */}
      <svg
        className="absolute inset-0"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={{ overflow: 'visible' }}
      >
        {/* Bodensaum */}
        <ellipse cx={W / 2} cy={H - 4} rx={W / 2 - 6} ry="6" fill="rgba(20,40,25,0.45)" />

        {/* Hinterer kleiner Tannenbaum links neben dem Haus */}
        <BackTree x={20} h={75} />
        {/* Hintere kleine Tanne hinter der Hütte */}
        <BackTree x={88} h={62} dimmer />
        {/* Hintere Tanne rechts vom Haus */}
        <BackTree x={210} h={88} />

        {/* Teich — rechts neben der Hütte */}
        <Pond cx={300} cy={148} rx={56} ry={16} />

        {/* Schilf am Teichrand */}
        <Reeds x={252} y={148} />
        <Reeds x={350} y={150} />

        {/* Seerose */}
        <g transform="translate(295, 152)">
          <ellipse cx="0" cy="0" rx="6" ry="2.5" fill="#1f5a3a" />
          <ellipse cx="0" cy="-1.5" rx="3" ry="1.2" fill="#2a7048" />
          <circle cx="0" cy="-2" r="1.2" fill="#fcd5d8" />
        </g>

        {/* Bank am Teichrand */}
        <Bench x={284} y={138} />

        {/* Angler auf der Bank */}
        <Fisher x={290} y={120} />
      </svg>

      {/* Hütte als positioniertes Kind über dem SVG */}
      <div className="absolute" style={{ left: 110, top: 5, pointerEvents: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

// ── Mini-Tannenbaum (Hintergrund-Deko) ─────────────────────────────────────
function BackTree({ x, h, dimmer = false }: { x: number; h: number; dimmer?: boolean }) {
  const groundY = 175;
  const trunkW = 4;
  const crownH = h - 10;
  const crownW = 18 + crownH * 0.28;
  const opacity = dimmer ? 0.65 : 1;

  return (
    <g opacity={opacity}>
      <ellipse cx={x} cy={groundY + 1} rx={crownW * 0.5} ry={2} fill="rgba(0,0,0,0.35)" />
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
      {/* Boden-Schatten unter dem Teich */}
      <ellipse cx={cx} cy={cy + ry + 1} rx={rx + 2} ry={3} fill="rgba(0,0,0,0.4)" />
      {/* Wasserfläche */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#1a3a55" />
      <ellipse cx={cx} cy={cy} rx={rx - 3} ry={ry - 2} fill="#2a5078" />
      <ellipse cx={cx - 6} cy={cy - 4} rx={rx * 0.6} ry={ry * 0.45} fill="#3a6a98" opacity="0.7" />
      {/* Glanzlicht */}
      <ellipse cx={cx - rx * 0.4} cy={cy - ry * 0.3} rx={rx * 0.35} ry={1.5} fill="rgba(255,255,255,0.35)" />
      <ellipse cx={cx + rx * 0.2} cy={cy + ry * 0.1} rx={rx * 0.25} ry={1} fill="rgba(255,255,255,0.18)" />

      {/* Wasser-Wellen Animation um die Angel-Stelle (Rute schaut bei cx+18, cy-2) */}
      <motion.circle
        cx={cx + 18}
        cy={cy - 2}
        r={2}
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={0.8}
        animate={{ r: [2, 8, 2], opacity: [0.7, 0, 0.7] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
      />
      <motion.circle
        cx={cx + 18}
        cy={cy - 2}
        r={2}
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={0.6}
        animate={{ r: [2, 12, 2], opacity: [0.5, 0, 0.5] }}
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
      {/* Schatten */}
      <ellipse cx={x + 12} cy={y + 14} rx={18} ry={2} fill="rgba(0,0,0,0.4)" />
      {/* Beine */}
      <rect x={x} y={y + 4} width="2" height="10" fill="#3a1808" />
      <rect x={x + 22} y={y + 4} width="2" height="10" fill="#3a1808" />
      {/* Sitzfläche */}
      <rect x={x - 2} y={y + 2} width="28" height="3" fill="#7c4a1a" rx="0.5" />
      <rect x={x - 2} y={y + 2} width="28" height="0.8" fill="#a06530" rx="0.5" />
      {/* Lehne (zwei Pfosten + horizontaler Balken) */}
      <rect x={x + 1} y={y - 8} width="1.5" height="10" fill="#5a3010" />
      <rect x={x + 21} y={y - 8} width="1.5" height="10" fill="#5a3010" />
      <rect x={x} y={y - 6} width="24" height="2" fill="#7c4a1a" rx="0.5" />
    </g>
  );
}

// ── Angler auf der Bank ───────────────────────────────────────────────────
function Fisher({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {/* Beine (sitzend, kurz) */}
      <rect x={x + 4} y={y + 12} width="2.5" height="9" fill="#2d4a78" />
      <rect x={x + 9} y={y + 12} width="2.5" height="9" fill="#2d4a78" />
      {/* Schuhe */}
      <ellipse cx={x + 5.2} cy={y + 22} rx="2" ry="1" fill="#1a0e05" />
      <ellipse cx={x + 10.2} cy={y + 22} rx="2" ry="1" fill="#1a0e05" />

      {/* Körper - kariertes Hemd */}
      <rect x={x + 2} y={y + 4} width="11" height="10" fill="#7a3030" rx="1" />
      <rect x={x + 2} y={y + 7} width="11" height="1" fill="rgba(0,0,0,0.5)" />
      <rect x={x + 2} y={y + 11} width="11" height="1" fill="rgba(0,0,0,0.5)" />
      <rect x={x + 5} y={y + 4} width="1.5" height="10" fill="rgba(0,0,0,0.4)" />
      <rect x={x + 9} y={y + 4} width="1.5" height="10" fill="rgba(0,0,0,0.4)" />

      {/* Kopf */}
      <circle cx={x + 7.5} cy={y + 1} r="3" fill="#ffd5aa" />
      {/* Hut */}
      <ellipse cx={x + 7.5} cy={y - 1.5} rx="4" ry="1" fill="#3a2510" />
      <rect x={x + 5.5} y={y - 4} width="4" height="3" fill="#5a3a18" rx="1" />
      {/* Auge */}
      <circle cx={x + 8} cy={y + 1} r="0.4" fill="#1a1a2e" />

      {/* Arm + Angelrute — Arm geht von Schulter (x+11, y+5) Richtung Pond */}
      <path d={`M${x + 11} ${y + 5} Q ${x + 17} ${y + 1} ${x + 22} ${y - 2}`} stroke="#7a3030" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Angelrute - lang nach rechts ins Wasser */}
      <line x1={x + 22} y1={y - 2} x2={x + 38} y2={y + 5} stroke="#c8915a" strokeWidth="1.2" strokeLinecap="round" />
      {/* Schnur runter ins Wasser */}
      <motion.line
        x1={x + 38}
        y1={y + 5}
        x2={x + 38}
        y2={y + 22}
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="0.5"
        animate={{ x2: [x + 38, x + 38.5, x + 37.5, x + 38] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
    </g>
  );
}
