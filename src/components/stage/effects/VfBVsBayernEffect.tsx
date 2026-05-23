// VfB-Stuttgart-Vereinslogos jagen FC-Bayern-Logos mit ÄXTEN über einen
// Fußballplatz und hauen sie in zwei Hälften. 20s.
//
// User-Wunsch (Mai 2026): realistischere Vereinslogos, Äxte statt
// Mistgabeln, FCB-Logos werden gespalten, Fußballplatz als Bühne.
//
// Logos sind vereinfachte aber deutlich erkennbare Vereins-Andeutungen
// (kein 1:1-Logo-Klon — rechtlich sicherer). Pure-CSS, Inline-SVG.
//
// Choreografie pro "Opfer-Welle":
//   0.0s - FCB-Logo rennt von links über das Spielfeld
//   1.5s - VfB-Verfolger kommt mit erhobener Axt hinterher
//   3.2s - AXTHIEB (Axt schnell nach unten, FCB verschwindet)
//   3.3s - Spalt-Hälften erscheinen + fallen mit Rotation auseinander
//   4.5s - Hälften aus dem Bild
// 3 Wellen über 18-20s damit es kontinuierlich was passiert.

type Wave = {
  id: number;
  yPercent: number;
  delay: number;
  meetX: number; // wo der Schlag passiert (vw)
};

const WAVES: Wave[] = [
  { id: 0, yPercent: 32, delay: 0.0,  meetX: 55 },
  { id: 1, yPercent: 50, delay: 2.5,  meetX: 60 },
  { id: 2, yPercent: 68, delay: 5.0,  meetX: 50 },
  { id: 3, yPercent: 38, delay: 7.5,  meetX: 65 },
  { id: 4, yPercent: 56, delay: 10.0, meetX: 52 },
  { id: 5, yPercent: 70, delay: 12.5, meetX: 58 },
  { id: 6, yPercent: 42, delay: 15.0, meetX: 60 },
];

// ─── FC Bayern Logo (vereinfacht, erkennbar) ─────────────────────────────
// Roter Kreis + weißer Innenkreis + bayrische Raute + Text + 4 Sterne.
function FcbLogo({ clipSide }: { clipSide?: 'left' | 'right' }) {
  // clipSide spaltet das Logo: 'left' zeigt nur linke Hälfte, 'right' nur rechte.
  // undefined = ganzes Logo.
  const clipPath =
    clipSide === 'left'  ? 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' :
    clipSide === 'right' ? 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)' :
    undefined;
  return (
    <div style={{ clipPath, WebkitClipPath: clipPath }}>
      <svg viewBox="0 0 130 130" width="100" height="100">
        {/* 4 weiße Sterne oben (Stern-Reihe für Meisterschaften) */}
        <g fill="#fbbf24" stroke="#854d0e" strokeWidth="0.4">
          <polygon points="40,4 41.5,8 46,8 42.5,11 44,16 40,13 36,16 37.5,11 34,8 38.5,8" />
          <polygon points="55,4 56.5,8 61,8 57.5,11 59,16 55,13 51,16 52.5,11 49,8 53.5,8" />
          <polygon points="70,4 71.5,8 76,8 72.5,11 74,16 70,13 66,16 67.5,11 64,8 68.5,8" />
          <polygon points="85,4 86.5,8 91,8 87.5,11 89,16 85,13 81,16 82.5,11 79,8 83.5,8" />
        </g>
        {/* Außen-Ring rot */}
        <circle cx="65" cy="72" r="55" fill="#dc0a0a" stroke="#8b0000" strokeWidth="1.5" />
        {/* Innen-Ring weiß */}
        <circle cx="65" cy="72" r="42" fill="#ffffff" />
        {/* Schriftband außen — "FC BAYERN MÜNCHEN" entlang des Rings */}
        <defs>
          <path id="fcb-text-arc" d="M 65,72 m -49,0 a 49,49 0 1,1 98,0" fill="none" />
        </defs>
        <text fontSize="9" fontWeight="900" fill="#ffffff" letterSpacing="1">
          <textPath href="#fcb-text-arc" startOffset="50%" textAnchor="middle">
            • FC BAYERN MÜNCHEN •
          </textPath>
        </text>
        {/* Bayrische Raute im Inneren — 4x4 Karos in blau-weiß diagonal */}
        <g transform="translate(65 72) rotate(45)">
          {/* Hintergrund-Blau */}
          <rect x="-26" y="-26" width="52" height="52" fill="#0066b3" />
          {/* Weiße Karos in Schachbrett-Muster */}
          <rect x="-13" y="-26" width="13" height="13" fill="#ffffff" />
          <rect x="13"  y="-26" width="13" height="13" fill="#ffffff" />
          <rect x="-26" y="-13" width="13" height="13" fill="#ffffff" />
          <rect x="0"   y="-13" width="13" height="13" fill="#ffffff" />
          <rect x="-13" y="0"   width="13" height="13" fill="#ffffff" />
          <rect x="13"  y="0"   width="13" height="13" fill="#ffffff" />
          <rect x="-26" y="13"  width="13" height="13" fill="#ffffff" />
          <rect x="0"   y="13"  width="13" height="13" fill="#ffffff" />
        </g>
        {/* Mittelkreis weiß mit FCB-Buchstaben */}
        <circle cx="65" cy="72" r="14" fill="#ffffff" stroke="#dc0a0a" strokeWidth="1.5" />
        <text x="65" y="76" textAnchor="middle" fontSize="13" fontWeight="900" fill="#dc0a0a">FCB</text>
      </svg>
    </div>
  );
}

// ─── VfB Stuttgart Logo (vereinfacht, erkennbar) ─────────────────────────
function VfbLogo() {
  return (
    <svg viewBox="0 0 130 130" width="110" height="110">
      {/* Wappen-Schild rot */}
      <path
        d="M 10,10 L 120,10 L 120,75 Q 120,108 65,124 Q 10,108 10,75 Z"
        fill="#e30613"
        stroke="#7a0008"
        strokeWidth="2"
      />
      {/* Weißer Mittel-Bereich (Brust-Bereich des Wappens) */}
      <path
        d="M 22,28 L 108,28 L 108,75 Q 108,98 65,110 Q 22,98 22,75 Z"
        fill="#ffffff"
        stroke="#e30613"
        strokeWidth="1"
      />
      {/* Großes rotes "V" mittig */}
      <text
        x="65" y="78"
        textAnchor="middle"
        fontSize="58"
        fontWeight="900"
        fill="#e30613"
        style={{ fontFamily: 'Georgia, serif' }}
      >V</text>
      {/* "fB" klein rechts unten neben V */}
      <text x="92" y="92" textAnchor="middle" fontSize="22" fontWeight="900" fill="#e30613">fB</text>
      {/* Stuttgart-Pferd-Andeutung oben (vereinfachtes Rössle) */}
      <g transform="translate(65 19) scale(0.65)" fill="#000000">
        <path d="M -8,-2 Q -10,-8 -4,-10 L 4,-10 Q 10,-8 8,-2 L 6,2 L 10,4 L 4,6 L 0,4 L -4,6 L -10,4 L -6,2 Z" />
      </g>
      {/* Krone oben */}
      <g transform="translate(65 6)">
        <polygon points="-8,4 -8,0 -4,2 0,-2 4,2 8,0 8,4" fill="#fbbf24" stroke="#854d0e" strokeWidth="0.5" />
      </g>
    </svg>
  );
}

// ─── Axt (kann hochgehoben sein oder schlagen) ──────────────────────────
function AxeIcon() {
  return (
    <svg viewBox="0 0 80 110" width="70" height="100">
      {/* Holzstiel */}
      <rect x="36" y="20" width="6" height="90" rx="2" fill="#854d0e" />
      {/* Holz-Maserung */}
      <line x1="36" y1="40" x2="42" y2="40" stroke="#6b3a05" strokeWidth="0.6" />
      <line x1="36" y1="60" x2="42" y2="60" stroke="#6b3a05" strokeWidth="0.6" />
      <line x1="36" y1="80" x2="42" y2="80" stroke="#6b3a05" strokeWidth="0.6" />
      <line x1="36" y1="100" x2="42" y2="100" stroke="#6b3a05" strokeWidth="0.6" />
      {/* Axt-Kopf — eine große Klinge */}
      <path
        d="M 39,12 L 75,5 Q 78,18 75,30 L 39,28 Z"
        fill="#cbd5e1"
        stroke="#475569"
        strokeWidth="1"
      />
      {/* Klinge-Glanz */}
      <path d="M 60,8 L 73,7 Q 75,16 73,25 L 60,24 Z" fill="#f1f5f9" opacity="0.7" />
      <line x1="65" y1="10" x2="73" y2="9" stroke="#ffffff" strokeWidth="1" opacity="0.9" />
      {/* Schneide-Kante (heller) */}
      <path d="M 73,6 Q 77,18 73,30" stroke="#ffffff" strokeWidth="1.5" fill="none" opacity="0.6" />
      {/* Befestigung am Stiel */}
      <rect x="34" y="14" width="10" height="18" rx="2" fill="#475569" />
      <rect x="34" y="14" width="10" height="2" fill="#1c1917" />
      <rect x="34" y="30" width="10" height="2" fill="#1c1917" />
    </svg>
  );
}

// ─── Fußballplatz-Hintergrund (grüner Rasen mit Linien) ─────────────────
function FootballField() {
  return (
    <svg
      aria-hidden
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1200 700"
      preserveAspectRatio="none"
      style={{ zIndex: 0 }}
    >
      {/* Rasen-Hintergrund mit horizontalen Streifen (hell/dunkel wie gemäht) */}
      <defs>
        <pattern id="fb-grass" patternUnits="userSpaceOnUse" width="1200" height="100">
          <rect width="1200" height="50" fill="#1a8c3a" />
          <rect y="50" width="1200" height="50" fill="#157a30" />
        </pattern>
      </defs>
      <rect width="1200" height="700" fill="url(#fb-grass)" />

      {/* Spielfeld-Außenlinie (etwas eingerückt) */}
      <rect x="40" y="40" width="1120" height="620" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.85" />

      {/* Mittellinie vertikal */}
      <line x1="600" y1="40" x2="600" y2="660" stroke="#ffffff" strokeWidth="4" opacity="0.85" />

      {/* Mittelkreis */}
      <circle cx="600" cy="350" r="100" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.85" />
      <circle cx="600" cy="350" r="4" fill="#ffffff" opacity="0.9" />

      {/* Linker Strafraum */}
      <rect x="40" y="170" width="180" height="360" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.85" />
      {/* Linker 5m-Raum */}
      <rect x="40" y="240" width="70" height="220" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.85" />
      {/* Linker Elfmeterpunkt */}
      <circle cx="160" cy="350" r="3" fill="#ffffff" opacity="0.9" />
      {/* Linker Tor-Bogen (Halbkreis) */}
      <path d="M 220,300 A 60,60 0 0 1 220,400" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.85" />
      {/* Linkes Tor */}
      <rect x="20" y="290" width="20" height="120" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.95" />
      <rect x="22" y="292" width="16" height="116" fill="rgba(255,255,255,0.1)" />

      {/* Rechter Strafraum */}
      <rect x="980" y="170" width="180" height="360" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.85" />
      {/* Rechter 5m-Raum */}
      <rect x="1090" y="240" width="70" height="220" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.85" />
      {/* Rechter Elfmeterpunkt */}
      <circle cx="1040" cy="350" r="3" fill="#ffffff" opacity="0.9" />
      {/* Rechter Tor-Bogen */}
      <path d="M 980,300 A 60,60 0 0 0 980,400" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.85" />
      {/* Rechtes Tor */}
      <rect x="1160" y="290" width="20" height="120" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.95" />
      <rect x="1162" y="292" width="16" height="116" fill="rgba(255,255,255,0.1)" />

      {/* Eckbögen 4x */}
      <path d="M 40,50 A 10,10 0 0 1 50,40" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.85" />
      <path d="M 1160,40 A 10,10 0 0 1 1160,50" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.85" />
      <path d="M 40,650 A 10,10 0 0 0 50,660" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.85" />
      <path d="M 1160,660 A 10,10 0 0 0 1160,650" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.85" />
    </svg>
  );
}

export default function VfBVsBayernEffect() {
  return (
    <>
      <style>{`
        /* FCB-Ganzes-Logo: rennt von links über das Feld + verschwindet nach 3.1s */
        @keyframes fx-vfb-fcb-run {
          0%   { transform: translate3d(-15vw, 0, 0) scale(0.9); opacity: 0; }
          5%   { opacity: 1; }
          50%  { transform: translate3d(calc(var(--meet, 50vw) - 8vw), -6px, 0) scale(1); }
          90%  { transform: translate3d(var(--meet, 50vw), 0, 0) scale(1.05); opacity: 1; }
          95%  { opacity: 1; }
          100% { transform: translate3d(var(--meet, 50vw), 0, 0) scale(1); opacity: 0; }
        }
        /* Linke Hälfte: nach Spalt fliegt nach links-unten + rotiert */
        @keyframes fx-vfb-fcb-half-left {
          0%   { transform: translate3d(var(--meet, 50vw), 0, 0) rotate(0deg); opacity: 0; }
          3%   { opacity: 1; }
          100% { transform: translate3d(calc(var(--meet, 50vw) - 25vw), 90vh, 0) rotate(-540deg); opacity: 0; }
        }
        @keyframes fx-vfb-fcb-half-right {
          0%   { transform: translate3d(var(--meet, 50vw), 0, 0) rotate(0deg); opacity: 0; }
          3%   { opacity: 1; }
          100% { transform: translate3d(calc(var(--meet, 50vw) + 25vw), 90vh, 0) rotate(540deg); opacity: 0; }
        }
        /* VfB-Verfolger: rennt schneller, holt FCB ein, schwingt Axt */
        @keyframes fx-vfb-chaser-run {
          0%   { transform: translate3d(-25vw, 0, 0); opacity: 0; }
          8%   { opacity: 1; }
          50%  { transform: translate3d(calc(var(--meet, 50vw) - 11vw), 4px, 0); }
          90%  { transform: translate3d(calc(var(--meet, 50vw) - 6vw), 0, 0); }
          95%  { opacity: 1; }
          100% { transform: translate3d(calc(var(--meet, 50vw) - 4vw), 0, 0); opacity: 0; }
        }
        /* Axt-Hebe-Schlag */
        @keyframes fx-vfb-axe-swing {
          0%, 75%  { transform: rotate(-85deg); }
          85%      { transform: rotate(-85deg); }
          90%      { transform: rotate(35deg); }
          100%     { transform: rotate(35deg); }
        }
        /* Wackeln im Lauf */
        @keyframes fx-vfb-wobble {
          0%, 100% { transform: rotate(-2deg); }
          50%      { transform: rotate(2deg); }
        }
        /* Schlag-Funken am Aufprall-Punkt */
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

        .fx-vfb-fcb-whole {
          position: absolute; left: 0;
          will-change: transform, opacity;
          animation: fx-vfb-fcb-run 3.4s cubic-bezier(0.5, 0, 0.5, 1) forwards;
        }
        .fx-vfb-fcb-half {
          position: absolute; left: 0;
          will-change: transform, opacity;
        }
        .fx-vfb-fcb-half-left  { animation: fx-vfb-fcb-half-left  1.5s cubic-bezier(0.3, 0, 0.7, 1) forwards; }
        .fx-vfb-fcb-half-right { animation: fx-vfb-fcb-half-right 1.5s cubic-bezier(0.3, 0, 0.7, 1) forwards; }

        .fx-vfb-chaser {
          position: absolute; left: 0;
          will-change: transform, opacity;
          animation: fx-vfb-chaser-run 3.6s cubic-bezier(0.5, 0, 0.5, 1) forwards;
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
        }

        .fx-vfb-banner {
          position: absolute; top: 6vh; left: 50%;
          transform: translate(-50%, 0);
          will-change: transform;
          animation:
            fx-vfb-banner-bob 1.4s ease-in-out infinite,
            fx-vfb-banner-glow 1.4s ease-in-out infinite;
          z-index: 5;
        }
      `}</style>

      {/* Fußballplatz als Hintergrund-Layer */}
      <FootballField />

      {/* Banner oben */}
      <div className="fx-vfb-banner">
        <div
          style={{
            background: 'linear-gradient(135deg, #e30613, #7a0008)',
            color: '#fef3c7',
            padding: '14px 36px',
            borderRadius: '999px',
            fontSize: 'clamp(20px, 3.5vw, 38px)',
            fontWeight: 900,
            letterSpacing: '0.05em',
            textShadow: '0 2px 4px rgba(0,0,0,0.6)',
            border: '4px solid #fef3c7',
            whiteSpace: 'nowrap',
          }}
        >
          🪓 VfB JAGT FC BAYERN! 🪓
        </div>
      </div>

      {/* Pro Welle: Ganz-Logo (rennt + verschwindet) + zwei Hälften (Spalt) +
          Verfolger mit Axt + Funken am Aufprall-Punkt */}
      {WAVES.map((w) => {
        const spaltDelay = w.delay + 3.1; // Zeitpunkt des Schlags
        const sparkX = `${w.meetX}vw`;
        const sparkY = `${w.yPercent}%`;
        return (
          <span key={`wave-${w.id}`}>
            {/* FCB ganz */}
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

            {/* Linke Hälfte fliegt weg */}
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

            {/* Rechte Hälfte fliegt weg */}
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

            {/* VfB-Verfolger mit Axt */}
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

            {/* Funken am Aufprall-Punkt */}
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
