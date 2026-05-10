import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  scale?: number;
}

type RehAction = 'walk' | 'pause' | 'graze';

interface Step {
  x: number;
  action: RehAction;
  duration: number;
}

// Bäume verschiedener Höhe — der Reh läuft zwischen ihnen durch.
// y-Werte sind unterer Rand (Boden = 105).
const TREES = [
  { x: 12,  height: 70, scale: 0.85 },
  { x: 60,  height: 95, scale: 1.0  },
  { x: 118, height: 55, scale: 0.7  },
  { x: 168, height: 110, scale: 1.15 },
];

// Wegpunkte für den Spaziergang. x = Mittelpunkt des Rehs.
const PATH: Step[] = [
  { x: 195, action: 'walk', duration: 0 },     // Start: rechts hinter dem Wald
  { x: 145, action: 'walk', duration: 8 },     // hinter Baum 4 hervor
  { x: 145, action: 'graze', duration: 6 },    // pausiert / frisst zwischen Baum 3 und 4
  { x: 88,  action: 'walk', duration: 9 },     // läuft Richtung Mitte
  { x: 88,  action: 'pause', duration: 4 },    // schaut sich um
  { x: 36,  action: 'walk', duration: 9 },     // weiter nach links
  { x: 36,  action: 'graze', duration: 7 },    // frisst links
  { x: 195, action: 'walk', duration: 14 },    // läuft komplett zurück (versteckt sich)
];

export function Reh({ scale = 1 }: Props) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (PATH[stepIdx].duration === 0) {
      // Initial step — sofort weiter
      const t = setTimeout(() => setStepIdx(1), 50);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setStepIdx((i) => (i + 1) % PATH.length);
    }, PATH[stepIdx].duration * 1000);
    return () => clearTimeout(t);
  }, [stepIdx]);

  const current = PATH[stepIdx];
  const previous = PATH[(stepIdx - 1 + PATH.length) % PATH.length];
  const isMoving = current.x !== previous.x;
  const isGrazing = current.action === 'graze';

  // Boden-Y für das Reh
  const groundY = 105;

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
      <svg viewBox="0 0 210 130" width={210} height={130} style={{ overflow: 'visible' }}>
        {/* Boden-Grundton */}
        <rect x="0" y="120" width="210" height="10" fill="rgba(20,40,25,0.4)" />

        {/* Bäume — nach Größe sortiert für Perspektive (kleinere vorne) */}
        {TREES.map((t, i) => (
          <Tree key={i} x={t.x} h={t.height} scale={t.scale} />
        ))}

        {/* Reh — wandert zwischen den Bäumen */}
        <motion.g
          animate={{ x: current.x - 28 }}
          transition={{
            duration: isMoving ? current.duration : 0.4,
            ease: isMoving ? 'linear' : 'easeOut',
          }}
        >
          {/* leichter Auf-/Abschwung beim Laufen (bobbing) */}
          <motion.g
            animate={isMoving ? { y: [0, -1.5, 0, -1.5, 0] } : { y: 0 }}
            transition={isMoving ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
          >
            {/* Kopf-Position dreht sich beim Grasen */}
            <RehSvg groundY={groundY} grazing={isGrazing} />
          </motion.g>
        </motion.g>
      </svg>
    </div>
  );
}

// ── Einzelner Baum (Tannenbaum mit 3 Lagen Triangle) ─────────────────────
function Tree({ x, h, scale }: { x: number; h: number; scale: number }) {
  // Stamm-Höhe ist proportional, Kronen-Höhe = h - 12
  const groundY = 120;
  const trunkW = 5 * scale;
  const crownH = h - 14;
  const crownW = 24 * scale + crownH * 0.3;

  return (
    <g>
      {/* Bodenschatten */}
      <ellipse cx={x} cy={groundY + 1} rx={crownW * 0.55} ry={2.5} fill="rgba(0,0,0,0.4)" />
      {/* Stamm */}
      <rect
        x={x - trunkW / 2}
        y={groundY - 14}
        width={trunkW}
        height={14}
        fill="#5a3010"
        rx={1}
      />
      {/* 3-Lagen Tannen-Krone */}
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
      {/* Highlight links */}
      <polygon
        points={`${x},${groundY - h} ${x - crownW * 0.25},${groundY - h + crownH * 0.3} ${x - 1},${groundY - h + crownH * 0.3}`}
        fill="rgba(255,255,255,0.08)"
      />
    </g>
  );
}

// ── Reh-SVG ────────────────────────────────────────────────────────────────
function RehSvg({ groundY, grazing }: { groundY: number; grazing: boolean }) {
  // Reh-Mittelpunkt steht bei x≈28, der Schädel zeigt nach links (x klein)
  const headRotate = grazing ? 50 : 0;

  return (
    <g>
      {/* Boden-Schatten */}
      <ellipse cx="28" cy={groundY + 0.5} rx="22" ry="2.5" fill="rgba(0,0,0,0.35)" />

      {/* Beine */}
      <rect x="14" y={groundY - 22} width="3" height="22" fill="#8a5a2a" />
      <rect x="22" y={groundY - 20} width="3" height="20" fill="#8a5a2a" />
      <rect x="34" y={groundY - 22} width="3" height="22" fill="#8a5a2a" />
      <rect x="42" y={groundY - 20} width="3" height="20" fill="#8a5a2a" />
      {/* Hufe */}
      <rect x="13.5" y={groundY - 2} width="4" height="3" fill="#3a1808" rx="1" />
      <rect x="21.5" y={groundY - 2} width="4" height="3" fill="#3a1808" rx="1" />
      <rect x="33.5" y={groundY - 2} width="4" height="3" fill="#3a1808" rx="1" />
      <rect x="41.5" y={groundY - 2} width="4" height="3" fill="#3a1808" rx="1" />

      {/* Körper */}
      <ellipse cx="28" cy={groundY - 24} rx="22" ry="11" fill="#a87241" />
      <ellipse cx="28" cy={groundY - 18} rx="20" ry="6" fill="#c8945a" />
      {/* Bambi-Punkte */}
      <circle cx="16" cy={groundY - 26} r="1.4" fill="#fff" opacity="0.85" />
      <circle cx="22" cy={groundY - 29} r="1.2" fill="#fff" opacity="0.8" />
      <circle cx="34" cy={groundY - 27} r="1.3" fill="#fff" opacity="0.85" />
      <circle cx="40" cy={groundY - 25} r="1.2" fill="#fff" opacity="0.8" />
      {/* Schwänzchen */}
      <ellipse cx="50" cy={groundY - 29} rx="3" ry="4" fill="#a87241" />
      <ellipse cx="51" cy={groundY - 27} rx="2" ry="3" fill="#fff" />

      {/* Hals + Kopf — beim Grasen senkt der Kopf nach unten */}
      <motion.g
        style={{ transformOrigin: '8px 76px' }}
        animate={{ rotate: headRotate }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
      >
        {/* Hals */}
        <path d="M8 76 L -2 56 L 4 54 L 12 74 Z" fill="#a87241" />
        {/* Kopf */}
        <ellipse cx="-4" cy="50" rx="9" ry="7" fill="#a87241" />
        {/* Schnauze */}
        <ellipse cx="-11" cy="53" rx="4" ry="3" fill="#8a5a2a" />
        <ellipse cx="-13" cy="52" rx="1.5" ry="1.2" fill="#1a0e05" />

        {/* Auge mit Blink-Animation */}
        <motion.ellipse
          cx="-4"
          cy="48"
          rx="1.5"
          ry="1.8"
          fill="#1a0e05"
          animate={{ scaleY: [1, 0.1, 1] }}
          transition={{ duration: 0.25, repeat: Infinity, repeatDelay: 3.5 }}
          style={{ transformOrigin: '-4px 48px' }}
        />
        <circle cx="-3.5" cy="47.5" r="0.5" fill="#fff" />

        {/* Ohren */}
        <ellipse cx="-2" cy="42" rx="2" ry="4" fill="#a87241" transform="rotate(-15 -2 42)" />
        <ellipse cx="-2" cy="42" rx="1" ry="2.5" fill="#e8b888" transform="rotate(-15 -2 42)" />
        <ellipse cx="-7" cy="43" rx="2" ry="4" fill="#a87241" transform="rotate(-25 -7 43)" />
        <ellipse cx="-7" cy="43" rx="1" ry="2.5" fill="#e8b888" transform="rotate(-25 -7 43)" />
      </motion.g>
    </g>
  );
}
