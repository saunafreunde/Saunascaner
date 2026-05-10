import type { ReactNode } from 'react';

interface Props {
  children: ReactNode; // Das Blockhaus
}

const W = 460;
const H = 200;

export function BlockhausScene({ children }: Props) {
  return (
    <div className="relative pointer-events-none" style={{ width: W, height: H }}>
      {/* CSS-Animationen direkt in der Komponente */}
      <style>{`
        @keyframes hf-wind {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(1.5deg); }
        }
        @keyframes hf-sway {
          0%, 100% { transform: rotate(0deg) skewX(0deg); }
          50% { transform: rotate(2deg) skewX(1deg); }
        }
        @keyframes hf-ripple {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(3); opacity: 0; }
        }
        @keyframes hf-float-bird {
          0% { transform: translate(-50px, 40px); }
          100% { transform: translate(500px, 20px); }
        }
        @keyframes hf-breath {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.03); }
        }
        @keyframes hf-rod-twitch {
          0%, 90%, 100% { transform: rotate(0deg); }
          93% { transform: rotate(-2deg); }
          96% { transform: rotate(1deg); }
        }

        .anim-tree   { transform-origin: bottom center; animation: hf-wind 4s infinite ease-in-out; }
        .anim-reeds  { transform-origin: bottom center; animation: hf-sway 3s infinite ease-in-out; }
        .anim-ripple { transform-origin: center;        animation: hf-ripple 3s infinite ease-out; }
        .anim-bird   { animation: hf-float-bird 15s infinite linear; }
        .anim-fisher { transform-origin: bottom center; animation: hf-breath 3s infinite ease-in-out; }
        .anim-rod    { transform-origin: 24px 4px;       animation: hf-rod-twitch 5s infinite; }
      `}</style>

      <svg className="absolute inset-0" viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ overflow: 'visible' }}>
        {/* Schatten & Boden */}
        <ellipse cx={W / 2} cy={H - 4} rx={W / 2 - 6} ry="6" fill="rgba(20,40,25,0.45)" />

        {/* Hintergrund-Wald (animiert) */}
        <g className="anim-tree" style={{ animationDelay: '-1s' }}>
          <BackTree x={30} h={80} dimmer />
        </g>
        <g className="anim-tree" style={{ animationDelay: '-2.5s' }}>
          <BackTree x={70} h={95} />
        </g>
        <g className="anim-tree" style={{ animationDelay: '-0.5s' }}>
          <BackTree x={150} h={110} dimmer />
        </g>
        <g className="anim-tree" style={{ animationDelay: '-3.2s' }}>
          <BackTree x={380} h={90} />
        </g>
        <g className="anim-tree" style={{ animationDelay: '-1.8s' }}>
          <BackTree x={430} h={75} dimmer />
        </g>

        {/* Vogel zieht hinter der Szene durch */}
        <g className="anim-bird">
          <path d="M0,0 Q5,-5 10,0 M0,0 Q5,-2 10,0" fill="none" stroke="white" strokeWidth="1" opacity="0.4" />
        </g>

        {/* Teich + Wasserringe */}
        <Pond cx={360} cy={175} rx={65} ry={16} />

        {/* Schilf */}
        <g className="anim-reeds" style={{ animationDelay: '-0.2s' }}>
          <Reeds x={310} y={178} />
        </g>
        <g className="anim-reeds" style={{ animationDelay: '-1.5s' }}>
          <Reeds x={425} y={172} />
        </g>

        {/* Bank + Angler */}
        <Bench x={310} y={148} />
        <g className="anim-fisher">
          <Fisher x={316} y={116} />
        </g>

        {/* Angelrute mit Twitch */}
        <g transform="translate(340, 120)" className="anim-rod">
          <line x1="0" y1="0" x2="45" y2="12" stroke="#c8915a" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="45" y1="12" x2="45" y2="52" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
          <circle cx="45" cy="52" r="1" fill="#fbbf24" />
        </g>
      </svg>

      {/* Hütte zentral als Overlay */}
      <div className="absolute" style={{ left: 130, top: 18, pointerEvents: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

// ── Mini-Tannenbaum ────────────────────────────────────────────────────────
function BackTree({ x, h, dimmer = false }: { x: number; h: number; dimmer?: boolean }) {
  const opacity = dimmer ? 0.4 : 0.8;
  return (
    <g opacity={opacity} transform={`translate(${x}, 188)`}>
      <rect x="-2" y="-10" width="4" height="10" fill="#4a2608" />
      <polygon points={`0,${-h} -15,-10 15,-10`} fill="#1b3d26" />
      <polygon points={`0,${-h + 15} -12,0 12,0`} fill="#244d32" />
    </g>
  );
}

// ── Teich mit animierten Wasserringen ─────────────────────────────────────
function Pond({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#1a3a55" />
      <ellipse cx={cx} cy={cy - 2} rx={rx - 4} ry={ry - 3} fill="#234a6e" />
      <circle className="anim-ripple" cx={cx + 25} cy={cy + 5} r="2" fill="none" stroke="white" strokeWidth="0.5" />
      <circle
        className="anim-ripple"
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

// ── Schilf-Halme ──────────────────────────────────────────────────────────
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
