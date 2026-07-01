// Vektor-Nachbau des „Saunafreunde Schwarzwald"-Logos (stylisiert) für die
// TV-Tafel-Logo-Effekte. Wortmarke links (schwarz/grün) + rundes „Black Forest"-
// Siegel rechts: Schwarzwald-Tannen, hölzerner Aufguss-Kübel mit Kelle auf
// Saunasteinen, zwei Tannenzapfen. Rein SVG — die Wortmarke nutzt eine
// Rundschrift-Stack mit System-Fallback (kein externer Font nötig).
import type { CSSProperties } from 'react';

const BLACK = '#14181d';
const GREEN = '#4b7a34';
const GREEN_DARK = '#2f5a2f';
const WOOD = '#cca070';
const WOOD_LT = '#e0c290';
const WOOD_DK = '#a97f4c';
const BAND = '#8d8d8d';

function FirTree({ scale = 1, shade = GREEN_DARK }: { scale?: number; shade?: string }) {
  return (
    <g transform={`scale(${scale})`}>
      <rect x="-3" y="28" width="6" height="16" fill="#5a4327" />
      <polygon points="0,-36 -20,2 20,2" fill={shade} />
      <polygon points="0,-18 -25,20 25,20" fill={shade} />
      <polygon points="0,0 -30,34 30,34" fill={shade} />
    </g>
  );
}

function PineCone({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx="0" cy="0" rx="11" ry="17" fill="#7a5a34" />
      {[-9, -2, 5, 12].map((cy, i) => (
        <path key={i} d={`M -9 ${cy} Q 0 ${cy + 6} 9 ${cy}`} fill="none" stroke="#553c1f" strokeWidth="2" />
      ))}
    </g>
  );
}

export function SaunafreundeLogo({ className, style }: { className?: string; style?: CSSProperties }) {
  const font = "'Comfortaa','Quicksand','Nunito','Segoe UI',system-ui,sans-serif";
  return (
    <svg
      viewBox="0 0 1180 380"
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Saunafreunde Schwarzwald"
    >
      {/* ── Wortmarke ── */}
      <text x="6" y="168" fontFamily={font} fontSize="150" fontWeight={600} fill={BLACK} letterSpacing="-2">Saunafreunde</text>
      <text x="34" y="332" fontFamily={font} fontSize="150" fontWeight={600} fill={GREEN} letterSpacing="0">Schwarzwald</text>

      {/* ── Rundes Siegel ── */}
      <g transform="translate(1000,190)">
        <defs>
          <path id="sfl-arc-top" d="M -128 0 A 128 128 0 0 1 128 0" fill="none" />
          <path id="sfl-arc-bottom" d="M -134 6 A 134 134 0 0 0 134 6" fill="none" />
          <clipPath id="sfl-clip"><circle r="118" /></clipPath>
        </defs>

        {/* Ringe */}
        <circle r="166" fill="#f3f6ef" stroke={GREEN_DARK} strokeWidth="6" />
        <circle r="150" fill="none" stroke="#7fae5f" strokeWidth="2.5" />

        {/* Bogen-Texte */}
        <text fontFamily="'Segoe UI',system-ui,sans-serif" fontSize="46" fontWeight={800} fill={GREEN_DARK} letterSpacing="1">
          <textPath href="#sfl-arc-top" startOffset="50%" textAnchor="middle">100%</textPath>
        </text>
        <text fontFamily="'Segoe UI',system-ui,sans-serif" fontSize="37" fontWeight={700} fill={GREEN_DARK} letterSpacing="3">
          <textPath href="#sfl-arc-bottom" startOffset="50%" textAnchor="middle">Black Forest</textPath>
        </text>

        {/* Innen-Szene */}
        <g clipPath="url(#sfl-clip)">
          <rect x="-118" y="-118" width="236" height="236" fill="#eaf1e3" />
          {/* Tannen-Reihe */}
          {[-92, -60, -28, 4, 36, 68, 96].map((tx, i) => (
            <g key={i} transform={`translate(${tx}, ${-34 + (i % 2) * 10})`}>
              <FirTree scale={0.85 + (i % 3) * 0.14} shade={i % 2 === 0 ? '#356b34' : '#2b5629'} />
            </g>
          ))}
          {/* Saunasteine */}
          <ellipse cx="-42" cy="88" rx="36" ry="19" fill="#8c8c8c" />
          <ellipse cx="12" cy="96" rx="48" ry="21" fill="#a8a8a8" />
          <ellipse cx="60" cy="88" rx="30" ry="16" fill="#7c7c7c" />
          <ellipse cx="-6" cy="82" rx="26" ry="13" fill="#bcbcbc" />
          {/* Tannenzapfen flankierend */}
          <PineCone x={-98} y={30} />
          <PineCone x={98} y={30} />
          {/* Aufguss-Kübel */}
          <g transform="translate(0,30)">
            {/* Henkel */}
            <path d="M -50 -28 Q 0 -66 50 -28" fill="none" stroke={WOOD_DK} strokeWidth="5" />
            {/* Korpus (oben breiter) */}
            <path d="M -52 -32 L 52 -32 L 40 52 L -40 52 Z" fill={WOOD} stroke={WOOD_DK} strokeWidth="2" />
            {/* Dauben */}
            {[-34, -17, 0, 17, 34].map((sx, i) => (
              <line key={i} x1={sx} y1="-30" x2={sx * 0.78} y2="50" stroke={WOOD_DK} strokeWidth="1.6" opacity="0.55" />
            ))}
            {/* Metallbänder */}
            <rect x="-50" y="-18" width="100" height="8" rx="2" fill={BAND} />
            <rect x="-44" y="30" width="88" height="8" rx="2" fill={BAND} />
            {/* oberer Rand */}
            <ellipse cx="0" cy="-32" rx="52" ry="10" fill={WOOD_LT} stroke={WOOD_DK} strokeWidth="2" />
            {/* Kelle */}
            <g transform="rotate(-16)">
              <rect x="18" y="-58" width="70" height="7" rx="3.5" fill={WOOD} stroke={WOOD_DK} strokeWidth="1.5" />
              <ellipse cx="14" cy="-49" rx="17" ry="12" fill={WOOD_LT} stroke={WOOD_DK} strokeWidth="2" />
              <ellipse cx="14" cy="-49" rx="10" ry="6.5" fill="#b98d55" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
