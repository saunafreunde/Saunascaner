// VfB-Stuttgart-Vereinslogos jagen FC-Bayern-Logos mit ÄXTEN über einen
// Fußballplatz und hauen sie in zwei Hälften. Mit Fan-Tribünen oben+unten
// die jubeln und Bengalos zünden. 20s.
//
// User-Wünsche-Historie:
//   1. Realistischere Vereinslogos
//   2. Äxte statt Mistgabeln, Spalt-Animation
//   3. Fußballplatz als Bühne
//   4. NEU: Action nur AUF dem Spielfeld + Fan-Tribünen oben/unten +
//      Bengalos die gezündet werden
//
// Layout:
//   0%-15%   Fan-Tribüne oben (mit Bengalos)
//   15%-85%  Fußballplatz (Action-Bereich der Jagd)
//   85%-100% Fan-Tribüne unten (mit Bengalos)

type Wave = {
  id: number;
  yPercent: number; // innerhalb des Spielfelds (22-78%)
  delay: number;
  meetX: number;
};

// Wellen NUR im Spielfeld-Bereich (22-78% der Tafel-Höhe).
const WAVES: Wave[] = [
  { id: 0, yPercent: 30, delay: 0.0,  meetX: 55 },
  { id: 1, yPercent: 48, delay: 2.5,  meetX: 60 },
  { id: 2, yPercent: 65, delay: 5.0,  meetX: 50 },
  { id: 3, yPercent: 35, delay: 7.5,  meetX: 65 },
  { id: 4, yPercent: 52, delay: 10.0, meetX: 52 },
  { id: 5, yPercent: 70, delay: 12.5, meetX: 58 },
  { id: 6, yPercent: 40, delay: 15.0, meetX: 60 },
];

// Fan-Positionen oben (innerhalb 0-15% der Höhe)
const FANS_TOP = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  xPercent: 2 + i * 4.1,
  jumpDelay: (i * 0.13) % 1.5,
  variant: i % 3,
}));

// Fan-Positionen unten (innerhalb 85-100%)
const FANS_BOTTOM = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  xPercent: 2 + i * 4.1 + 1.5, // leicht versetzt
  jumpDelay: (i * 0.17 + 0.4) % 1.5,
  variant: (i + 1) % 3,
}));

// Bengalos — oben & unten in den Tribünen, gestaffelt gezündet
const FLARES = [
  { id: 0, xPercent: 15, top: true,  delay: 1.5 },
  { id: 1, xPercent: 38, top: true,  delay: 3.5 },
  { id: 2, xPercent: 65, top: true,  delay: 5.5 },
  { id: 3, xPercent: 85, top: true,  delay: 7.5 },
  { id: 4, xPercent: 25, top: false, delay: 2.5 },
  { id: 5, xPercent: 52, top: false, delay: 4.5 },
  { id: 6, xPercent: 78, top: false, delay: 6.5 },
  { id: 7, xPercent: 10, top: false, delay: 9.0 },
  { id: 8, xPercent: 92, top: false, delay: 11.0 },
  { id: 9, xPercent: 45, top: true,  delay: 13.0 },
];

// ─── FC Bayern Logo (vereinfacht, erkennbar) ─────────────────────────────
function FcbLogo({ clipSide }: { clipSide?: 'left' | 'right' }) {
  const clipPath =
    clipSide === 'left'  ? 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' :
    clipSide === 'right' ? 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)' :
    undefined;
  return (
    <div style={{ clipPath, WebkitClipPath: clipPath }}>
      <svg viewBox="0 0 130 130" width="100" height="100">
        <g fill="#fbbf24" stroke="#854d0e" strokeWidth="0.4">
          <polygon points="40,4 41.5,8 46,8 42.5,11 44,16 40,13 36,16 37.5,11 34,8 38.5,8" />
          <polygon points="55,4 56.5,8 61,8 57.5,11 59,16 55,13 51,16 52.5,11 49,8 53.5,8" />
          <polygon points="70,4 71.5,8 76,8 72.5,11 74,16 70,13 66,16 67.5,11 64,8 68.5,8" />
          <polygon points="85,4 86.5,8 91,8 87.5,11 89,16 85,13 81,16 82.5,11 79,8 83.5,8" />
        </g>
        <circle cx="65" cy="72" r="55" fill="#dc0a0a" stroke="#8b0000" strokeWidth="1.5" />
        <circle cx="65" cy="72" r="42" fill="#ffffff" />
        <defs>
          <path id="fcb-text-arc" d="M 65,72 m -49,0 a 49,49 0 1,1 98,0" fill="none" />
        </defs>
        <text fontSize="9" fontWeight="900" fill="#ffffff" letterSpacing="1">
          <textPath href="#fcb-text-arc" startOffset="50%" textAnchor="middle">
            • FC BAYERN MÜNCHEN •
          </textPath>
        </text>
        <g transform="translate(65 72) rotate(45)">
          <rect x="-26" y="-26" width="52" height="52" fill="#0066b3" />
          <rect x="-13" y="-26" width="13" height="13" fill="#ffffff" />
          <rect x="13"  y="-26" width="13" height="13" fill="#ffffff" />
          <rect x="-26" y="-13" width="13" height="13" fill="#ffffff" />
          <rect x="0"   y="-13" width="13" height="13" fill="#ffffff" />
          <rect x="-13" y="0"   width="13" height="13" fill="#ffffff" />
          <rect x="13"  y="0"   width="13" height="13" fill="#ffffff" />
          <rect x="-26" y="13"  width="13" height="13" fill="#ffffff" />
          <rect x="0"   y="13"  width="13" height="13" fill="#ffffff" />
        </g>
        <circle cx="65" cy="72" r="14" fill="#ffffff" stroke="#dc0a0a" strokeWidth="1.5" />
        <text x="65" y="76" textAnchor="middle" fontSize="13" fontWeight="900" fill="#dc0a0a">FCB</text>
      </svg>
    </div>
  );
}

// ─── VfB Stuttgart Logo ─────────────────────────────────────────────────
function VfbLogo() {
  return (
    <svg viewBox="0 0 130 130" width="110" height="110">
      <path
        d="M 10,10 L 120,10 L 120,75 Q 120,108 65,124 Q 10,108 10,75 Z"
        fill="#e30613"
        stroke="#7a0008"
        strokeWidth="2"
      />
      <path
        d="M 22,28 L 108,28 L 108,75 Q 108,98 65,110 Q 22,98 22,75 Z"
        fill="#ffffff"
        stroke="#e30613"
        strokeWidth="1"
      />
      <text
        x="65" y="78"
        textAnchor="middle"
        fontSize="58"
        fontWeight="900"
        fill="#e30613"
        style={{ fontFamily: 'Georgia, serif' }}
      >V</text>
      <text x="92" y="92" textAnchor="middle" fontSize="22" fontWeight="900" fill="#e30613">fB</text>
      <g transform="translate(65 19) scale(0.65)" fill="#000000">
        <path d="M -8,-2 Q -10,-8 -4,-10 L 4,-10 Q 10,-8 8,-2 L 6,2 L 10,4 L 4,6 L 0,4 L -4,6 L -10,4 L -6,2 Z" />
      </g>
      <g transform="translate(65 6)">
        <polygon points="-8,4 -8,0 -4,2 0,-2 4,2 8,0 8,4" fill="#fbbf24" stroke="#854d0e" strokeWidth="0.5" />
      </g>
    </svg>
  );
}

// ─── Axt ─────────────────────────────────────────────────────────────────
function AxeIcon() {
  return (
    <svg viewBox="0 0 80 110" width="70" height="100">
      <rect x="36" y="20" width="6" height="90" rx="2" fill="#854d0e" />
      <line x1="36" y1="40" x2="42" y2="40" stroke="#6b3a05" strokeWidth="0.6" />
      <line x1="36" y1="60" x2="42" y2="60" stroke="#6b3a05" strokeWidth="0.6" />
      <line x1="36" y1="80" x2="42" y2="80" stroke="#6b3a05" strokeWidth="0.6" />
      <line x1="36" y1="100" x2="42" y2="100" stroke="#6b3a05" strokeWidth="0.6" />
      <path
        d="M 39,12 L 75,5 Q 78,18 75,30 L 39,28 Z"
        fill="#cbd5e1"
        stroke="#475569"
        strokeWidth="1"
      />
      <path d="M 60,8 L 73,7 Q 75,16 73,25 L 60,24 Z" fill="#f1f5f9" opacity="0.7" />
      <line x1="65" y1="10" x2="73" y2="9" stroke="#ffffff" strokeWidth="1" opacity="0.9" />
      <path d="M 73,6 Q 77,18 73,30" stroke="#ffffff" strokeWidth="1.5" fill="none" opacity="0.6" />
      <rect x="34" y="14" width="10" height="18" rx="2" fill="#475569" />
      <rect x="34" y="14" width="10" height="2" fill="#1c1917" />
      <rect x="34" y="30" width="10" height="2" fill="#1c1917" />
    </svg>
  );
}

// ─── Fußballplatz (nimmt nur die mittlere 70% ein, top/bottom = Tribünen) ──
function FootballField() {
  return (
    <svg
      aria-hidden
      className="absolute pointer-events-none"
      viewBox="0 0 1200 700"
      preserveAspectRatio="none"
      style={{
        top: '15vh',
        bottom: '15vh',
        left: 0,
        right: 0,
        width: '100%',
        height: '70vh',
        zIndex: 0,
      }}
    >
      <defs>
        <pattern id="fb-grass" patternUnits="userSpaceOnUse" width="1200" height="100">
          <rect width="1200" height="50" fill="#1a8c3a" />
          <rect y="50" width="1200" height="50" fill="#157a30" />
        </pattern>
      </defs>
      <rect width="1200" height="700" fill="url(#fb-grass)" />
      <rect x="40" y="40" width="1120" height="620" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.85" />
      <line x1="600" y1="40" x2="600" y2="660" stroke="#ffffff" strokeWidth="4" opacity="0.85" />
      <circle cx="600" cy="350" r="100" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.85" />
      <circle cx="600" cy="350" r="4" fill="#ffffff" opacity="0.9" />
      <rect x="40" y="170" width="180" height="360" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.85" />
      <rect x="40" y="240" width="70" height="220" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.85" />
      <circle cx="160" cy="350" r="3" fill="#ffffff" opacity="0.9" />
      <path d="M 220,300 A 60,60 0 0 1 220,400" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.85" />
      <rect x="20" y="290" width="20" height="120" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.95" />
      <rect x="22" y="292" width="16" height="116" fill="rgba(255,255,255,0.1)" />
      <rect x="980" y="170" width="180" height="360" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.85" />
      <rect x="1090" y="240" width="70" height="220" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.85" />
      <circle cx="1040" cy="350" r="3" fill="#ffffff" opacity="0.9" />
      <path d="M 980,300 A 60,60 0 0 0 980,400" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.85" />
      <rect x="1160" y="290" width="20" height="120" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.95" />
      <rect x="1162" y="292" width="16" height="116" fill="rgba(255,255,255,0.1)" />
      <path d="M 40,50 A 10,10 0 0 1 50,40" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.85" />
      <path d="M 1160,40 A 10,10 0 0 1 1160,50" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.85" />
      <path d="M 40,650 A 10,10 0 0 0 50,660" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.85" />
      <path d="M 1160,660 A 10,10 0 0 0 1160,650" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.85" />
    </svg>
  );
}

// ─── Fan-Silhouette (Stadion-Besucher mit Schal, jubelnd) ───────────────
function Fan({ variant }: { variant: number }) {
  // 3 Varianten unterschiedlich gefärbt — gibt visuelle Vielfalt
  const colors = [
    { body: '#7a0008', head: '#fde68a', scarf: '#e30613' }, // dunkelrot
    { body: '#1c1917', head: '#fcd34d', scarf: '#e30613' }, // schwarz
    { body: '#e30613', head: '#fde68a', scarf: '#ffffff' }, // rot
  ][variant];
  return (
    <svg viewBox="0 0 40 70" width="34" height="60">
      {/* Kopf */}
      <circle cx="20" cy="12" r="7" fill={colors.head} />
      {/* Körper */}
      <rect x="13" y="18" width="14" height="22" rx="2" fill={colors.body} />
      {/* Schal um Hals */}
      <rect x="11" y="20" width="18" height="4" fill={colors.scarf} />
      {/* Erhobene Arme (animiert via Wrapper) */}
      <g className="fx-vfb-fan-arms">
        {/* Linker Arm hoch */}
        <rect x="6" y="16" width="4" height="14" rx="1.5" fill={colors.body} transform="rotate(-30 8 23)" />
        {/* Rechter Arm hoch */}
        <rect x="30" y="16" width="4" height="14" rx="1.5" fill={colors.body} transform="rotate(30 32 23)" />
        {/* Hände */}
        <circle cx="3" cy="10" r="2.5" fill={colors.head} />
        <circle cx="37" cy="10" r="2.5" fill={colors.head} />
      </g>
      {/* Beine */}
      <rect x="14" y="40" width="5" height="22" rx="1.5" fill="#1c1917" />
      <rect x="21" y="40" width="5" height="22" rx="1.5" fill="#1c1917" />
      {/* Schuhe */}
      <ellipse cx="16" cy="65" rx="4" ry="2" fill="#0f172a" />
      <ellipse cx="24" cy="65" rx="4" ry="2" fill="#0f172a" />
    </svg>
  );
}

// ─── Bengalo (bengalisches Feuer) — kleine SVG mit Flamme + Rauchschwaden ──
function Flare({ top }: { top: boolean }) {
  // top = Tribüne oben → Rauch steigt nach oben; bottom = Rauch geht auch nach oben
  return (
    <div className="fx-vfb-flare-wrap">
      {/* Bengalo-Stab (Hand-Halterung unten) */}
      <svg viewBox="0 0 40 80" width="36" height="72" style={{ position: 'relative', zIndex: 2 }}>
        {/* Stiel */}
        <rect x="17" y="40" width="6" height="40" rx="1.5" fill="#1c1917" />
        {/* Spitze (glühend) */}
        <rect x="15" y="32" width="10" height="10" rx="2" fill="#7f1d1d" />
        {/* Flamme — animiert */}
        <g className="fx-vfb-flare-flame">
          <ellipse cx="20" cy="20" rx="11" ry="22" fill="#ef4444" />
          <ellipse cx="20" cy="18" rx="8" ry="18" fill="#f97316" />
          <ellipse cx="20" cy="15" rx="5" ry="14" fill="#fbbf24" />
          <ellipse cx="20" cy="13" rx="3" ry="10" fill="#fef3c7" />
        </g>
        {/* Funken um die Flamme */}
        <g className="fx-vfb-flare-sparks">
          <circle cx="6"  cy="22" r="1.5" fill="#fbbf24" />
          <circle cx="34" cy="20" r="1.5" fill="#fbbf24" />
          <circle cx="10" cy="10" r="1"   fill="#ef4444" />
          <circle cx="30" cy="8"  r="1"   fill="#fbbf24" />
          <circle cx="3"  cy="14" r="1"   fill="#f97316" />
        </g>
      </svg>
      {/* Rauchschwaden (steigen vom Flammen-Punkt nach oben/außen) */}
      {[0, 1, 2, 3, 4].map((puffIdx) => (
        <span
          key={`puff-${puffIdx}`}
          className={`fx-vfb-flare-smoke ${top ? 'fx-vfb-flare-smoke-up' : 'fx-vfb-flare-smoke-down'}`}
          style={{
            left: `${10 + puffIdx * 4}px`,
            animationDelay: `${puffIdx * 0.5}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function VfBVsBayernEffect() {
  return (
    <>
      <style>{`
        /* FCB rennt von links innerhalb des Spielfelds bis meetX */
        @keyframes fx-vfb-fcb-run {
          0%   { transform: translate3d(-15vw, 0, 0) scale(0.9); opacity: 0; }
          5%   { opacity: 1; }
          50%  { transform: translate3d(calc(var(--meet, 50vw) - 8vw), -6px, 0) scale(1); }
          90%  { transform: translate3d(var(--meet, 50vw), 0, 0) scale(1.05); opacity: 1; }
          100% { transform: translate3d(var(--meet, 50vw), 0, 0) scale(1); opacity: 0; }
        }
        @keyframes fx-vfb-fcb-half-left {
          0%   { transform: translate3d(var(--meet, 50vw), 0, 0) rotate(0deg); opacity: 0; }
          3%   { opacity: 1; }
          100% { transform: translate3d(calc(var(--meet, 50vw) - 25vw), 25vh, 0) rotate(-540deg); opacity: 0; }
        }
        @keyframes fx-vfb-fcb-half-right {
          0%   { transform: translate3d(var(--meet, 50vw), 0, 0) rotate(0deg); opacity: 0; }
          3%   { opacity: 1; }
          100% { transform: translate3d(calc(var(--meet, 50vw) + 25vw), 25vh, 0) rotate(540deg); opacity: 0; }
        }
        @keyframes fx-vfb-chaser-run {
          0%   { transform: translate3d(-25vw, 0, 0); opacity: 0; }
          8%   { opacity: 1; }
          50%  { transform: translate3d(calc(var(--meet, 50vw) - 11vw), 4px, 0); }
          90%  { transform: translate3d(calc(var(--meet, 50vw) - 6vw), 0, 0); }
          100% { transform: translate3d(calc(var(--meet, 50vw) - 4vw), 0, 0); opacity: 0; }
        }
        @keyframes fx-vfb-axe-swing {
          0%, 75%  { transform: rotate(-85deg); }
          85%      { transform: rotate(-85deg); }
          90%      { transform: rotate(35deg); }
          100%     { transform: rotate(35deg); }
        }
        @keyframes fx-vfb-wobble {
          0%, 100% { transform: rotate(-2deg); }
          50%      { transform: rotate(2deg); }
        }
        @keyframes fx-vfb-impact-spark {
          0%   { transform: scale(0) rotate(var(--a, 0deg)); opacity: 0; }
          15%  { transform: scale(1) rotate(var(--a, 0deg)); opacity: 1; }
          100% { transform: scale(0.3) rotate(var(--a, 0deg)) translateX(80px); opacity: 0; }
        }
        @keyframes fx-vfb-banner-bob {
          0%, 100% { transform: translate(-50%, 0) scale(1); }
          50%      { transform: translate(-50%, -6px) scale(1.02); }
        }
        @keyframes fx-vfb-banner-glow {
          0%, 100% { filter: drop-shadow(0 0 8px #dc2626) drop-shadow(0 0 18px #fef3c7); }
          50%      { filter: drop-shadow(0 0 24px #dc2626) drop-shadow(0 0 40px #fbbf24); }
        }

        /* Fan-Tribünen-Hintergrund */
        .fx-vfb-tribune {
          position: absolute; left: 0; right: 0;
          height: 15vh;
          background:
            repeating-linear-gradient(
              90deg,
              rgba(15,23,42,0.7) 0,
              rgba(15,23,42,0.7) 12px,
              rgba(30,41,59,0.7) 12px,
              rgba(30,41,59,0.7) 24px
            ),
            linear-gradient(180deg, rgba(15,23,42,0.85) 0%, rgba(30,41,59,0.95) 100%);
          z-index: 1;
          overflow: hidden;
        }
        .fx-vfb-tribune-top    { top: 0; border-bottom: 3px solid #fbbf24; }
        .fx-vfb-tribune-bottom { bottom: 0; border-top: 3px solid #fbbf24; transform: scaleY(-1); }

        /* Fan jubelt — Arme bewegen sich + leichtes Springen */
        @keyframes fx-vfb-fan-jump {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes fx-vfb-fan-arms-wave {
          0%, 100% { transform: rotate(-5deg); }
          50%      { transform: rotate(5deg); }
        }
        .fx-vfb-fan {
          position: absolute; bottom: 0;
          will-change: transform;
          animation: fx-vfb-fan-jump 0.5s ease-in-out infinite;
          animation-delay: var(--d, 0s);
        }
        .fx-vfb-fan-arms {
          animation: fx-vfb-fan-arms-wave 0.4s ease-in-out infinite;
          transform-origin: 50% 100%;
        }

        /* Bengalo — Flamme flackert, Funken springen, Rauchschwaden steigen */
        @keyframes fx-vfb-flare-arrive {
          0%   { transform: translateY(20px) scale(0.6); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes fx-vfb-flare-flicker {
          0%, 100% { transform: scaleY(1) scaleX(1); opacity: 1; }
          25%      { transform: scaleY(1.1) scaleX(0.92); opacity: 0.95; }
          50%      { transform: scaleY(0.9) scaleX(1.05); opacity: 1; }
          75%      { transform: scaleY(1.05) scaleX(0.95); opacity: 0.9; }
        }
        @keyframes fx-vfb-flare-sparks-blink {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.4); }
        }
        @keyframes fx-vfb-flare-smoke-up {
          0%   { transform: translate3d(0, 0, 0) scale(0.4); opacity: 0; }
          15%  { opacity: 0.8; }
          100% { transform: translate3d(var(--dx, 8px), -120px, 0) scale(2.5); opacity: 0; }
        }
        @keyframes fx-vfb-flare-smoke-down {
          0%   { transform: translate3d(0, 0, 0) scale(0.4); opacity: 0; }
          15%  { opacity: 0.8; }
          100% { transform: translate3d(var(--dx, 8px), -100px, 0) scale(2.5); opacity: 0; }
        }
        .fx-vfb-flare-wrap {
          position: relative;
          will-change: transform, opacity;
          animation: fx-vfb-flare-arrive 0.4s ease-out forwards;
        }
        .fx-vfb-flare-flame {
          transform-origin: 50% 100%;
          animation: fx-vfb-flare-flicker 0.18s ease-in-out infinite;
          filter: drop-shadow(0 0 14px #f97316) drop-shadow(0 0 25px #ef4444);
        }
        .fx-vfb-flare-sparks > * {
          animation: fx-vfb-flare-sparks-blink 0.35s ease-in-out infinite;
        }
        .fx-vfb-flare-smoke {
          position: absolute;
          width: 22px; height: 22px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(254,202,202,0.85) 0%, rgba(220,38,38,0.5) 40%, rgba(80,30,30,0.2) 70%, transparent 100%);
          will-change: transform, opacity;
          --dx: 8px;
        }
        .fx-vfb-flare-smoke-up {
          bottom: 50px;
          animation: fx-vfb-flare-smoke-up 3.5s ease-out infinite;
        }
        .fx-vfb-flare-smoke-down {
          bottom: 50px;
          animation: fx-vfb-flare-smoke-down 3.2s ease-out infinite;
        }
        .fx-vfb-flare-mount {
          position: absolute; bottom: 2vh;
          opacity: 0;
          animation: fx-vfb-flare-fade-in 0.3s ease-out forwards;
          animation-delay: var(--d, 0s);
        }
        @keyframes fx-vfb-flare-fade-in {
          to { opacity: 1; }
        }

        .fx-vfb-fcb-whole {
          position: absolute; left: 0;
          will-change: transform, opacity;
          animation: fx-vfb-fcb-run 3.4s cubic-bezier(0.5, 0, 0.5, 1) forwards;
          z-index: 3;
        }
        .fx-vfb-fcb-half {
          position: absolute; left: 0;
          will-change: transform, opacity;
          z-index: 3;
        }
        .fx-vfb-fcb-half-left  { animation: fx-vfb-fcb-half-left  1.5s cubic-bezier(0.3, 0, 0.7, 1) forwards; }
        .fx-vfb-fcb-half-right { animation: fx-vfb-fcb-half-right 1.5s cubic-bezier(0.3, 0, 0.7, 1) forwards; }

        .fx-vfb-chaser {
          position: absolute; left: 0;
          will-change: transform, opacity;
          animation: fx-vfb-chaser-run 3.6s cubic-bezier(0.5, 0, 0.5, 1) forwards;
          z-index: 3;
        }
        .fx-vfb-wobble {
          animation: fx-vfb-wobble 0.28s ease-in-out infinite;
          transform-origin: 50% 80%;
        }
        .fx-vfb-axe {
          position: absolute; top: -45px; right: -55px;
          transform-origin: 50% 95%;
          animation: fx-vfb-axe-swing 3.6s cubic-bezier(0.7, 0, 0.3, 1) forwards;
        }
        .fx-vfb-impact-spark {
          position: absolute;
          width: 6px; height: 6px;
          background: linear-gradient(90deg, #fbbf24, #ef4444);
          border-radius: 50%;
          transform-origin: 0% 50%;
          will-change: transform, opacity;
          animation: fx-vfb-impact-spark 0.8s ease-out forwards;
          filter: drop-shadow(0 0 4px #fbbf24);
          z-index: 3;
        }

        .fx-vfb-banner {
          position: absolute; top: 1.5vh; left: 50%;
          transform: translate(-50%, 0);
          will-change: transform;
          animation:
            fx-vfb-banner-bob 1.4s ease-in-out infinite,
            fx-vfb-banner-glow 1.4s ease-in-out infinite;
          z-index: 5;
        }
      `}</style>

      {/* Fußballplatz in der Mitte (15vh - 85vh) */}
      <FootballField />

      {/* Fan-Tribüne oben */}
      <div className="fx-vfb-tribune fx-vfb-tribune-top">
        {FANS_TOP.map((f) => (
          <div
            key={`fan-top-${f.id}`}
            className="fx-vfb-fan"
            style={{
              left: `${f.xPercent}%`,
              '--d': `${f.jumpDelay}s`,
            } as React.CSSProperties}
          >
            <Fan variant={f.variant} />
          </div>
        ))}
      </div>

      {/* Fan-Tribüne unten */}
      <div className="fx-vfb-tribune fx-vfb-tribune-bottom">
        {FANS_BOTTOM.map((f) => (
          <div
            key={`fan-bot-${f.id}`}
            className="fx-vfb-fan"
            style={{
              left: `${f.xPercent}%`,
              '--d': `${f.jumpDelay}s`,
            } as React.CSSProperties}
          >
            <Fan variant={f.variant} />
          </div>
        ))}
      </div>

      {/* Bengalos (zünden gestaffelt — Position relativ zur Tribüne) */}
      {FLARES.map((fl) => (
        <div
          key={`flare-${fl.id}`}
          className="fx-vfb-flare-mount"
          style={{
            left: `${fl.xPercent}%`,
            ...(fl.top ? { top: '4vh' } : { bottom: '4vh' }),
            transform: 'translateX(-50%)',
            zIndex: 4,
            '--d': `${fl.delay}s`,
          } as React.CSSProperties}
        >
          <Flare top={fl.top} />
        </div>
      ))}

      {/* Banner oben */}
      <div className="fx-vfb-banner">
        <div
          style={{
            background: 'linear-gradient(135deg, #e30613, #7a0008)',
            color: '#fef3c7',
            padding: '12px 32px',
            borderRadius: '999px',
            fontSize: 'clamp(18px, 3vw, 32px)',
            fontWeight: 900,
            letterSpacing: '0.05em',
            textShadow: '0 2px 4px rgba(0,0,0,0.6)',
            border: '3px solid #fef3c7',
            whiteSpace: 'nowrap',
          }}
        >
          🪓 VfB JAGT FC BAYERN! 🪓
        </div>
      </div>

      {/* Action-Wellen NUR im Spielfeld-Bereich (22-78% der Tafel-Höhe) */}
      {WAVES.map((w) => {
        const spaltDelay = w.delay + 3.1;
        const sparkX = `${w.meetX}vw`;
        const sparkY = `${w.yPercent}%`;
        return (
          <span key={`wave-${w.id}`}>
            <div
              className="fx-vfb-fcb-whole"
              style={{
                top: `${w.yPercent}%`,
                animationDelay: `${w.delay}s`,
                '--meet': `${w.meetX}vw`,
              } as React.CSSProperties}
            >
              <div className="fx-vfb-wobble">
                <FcbLogo />
              </div>
            </div>

            <div
              className="fx-vfb-fcb-half fx-vfb-fcb-half-left"
              style={{
                top: `${w.yPercent}%`,
                animationDelay: `${spaltDelay}s`,
                '--meet': `${w.meetX}vw`,
              } as React.CSSProperties}
            >
              <FcbLogo clipSide="left" />
            </div>

            <div
              className="fx-vfb-fcb-half fx-vfb-fcb-half-right"
              style={{
                top: `${w.yPercent}%`,
                animationDelay: `${spaltDelay}s`,
                '--meet': `${w.meetX}vw`,
              } as React.CSSProperties}
            >
              <FcbLogo clipSide="right" />
            </div>

            <div
              className="fx-vfb-chaser"
              style={{
                top: `${w.yPercent}%`,
                animationDelay: `${w.delay + 0.5}s`,
                '--meet': `${w.meetX}vw`,
              } as React.CSSProperties}
            >
              <div className="fx-vfb-wobble" style={{ position: 'relative' }}>
                <VfbLogo />
                <div
                  className="fx-vfb-axe"
                  style={{ animationDelay: `${w.delay + 0.5}s` }}
                >
                  <AxeIcon />
                </div>
              </div>
            </div>

            {Array.from({ length: 12 }).map((_, sIdx) => {
              const angle = sIdx * 30;
              return (
                <span
                  key={`spark-${w.id}-${sIdx}`}
                  className="fx-vfb-impact-spark"
                  style={{
                    left: sparkX,
                    top: sparkY,
                    animationDelay: `${spaltDelay}s`,
                    '--a': `${angle}deg`,
                  } as React.CSSProperties}
                />
              );
            })}
          </span>
        );
      })}
    </>
  );
}
