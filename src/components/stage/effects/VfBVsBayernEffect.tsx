// VfB-Stuttgart-Logos jagen FC-Bayern-Logos mit Mistgabeln über die Tafel.
// User-Wunsch — humorvolles 20s-Spektakel für den Sauna-Verein.
// Pure-CSS-Animation, Inline-SVG, keine externen Assets, 24/7-tauglich.
//
// Visuell vereinfachte Wappen-Andeutungen (kein 1:1-Logo-Klon — rechtlich
// sicherer). FCB als rotes Quadrat mit blau-weißer Raute, VfB als rotes
// Wappen mit weißem "V". Mistgabeln (🍴) wackeln drohend.
//
// Choreografie: 6 FCB-Wappen fliehen von links nach rechts in 5 Wellen,
// gefolgt von 8 VfB-Verfolgern mit Mistgabeln. Verschiedene Y-Positionen
// damit es chaotisch wirkt wie eine echte Verfolgungsjagd.

const FCBS = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  yPercent: 18 + (i * 12) + ((i % 3) * 4),
  delay: i * 1.4,
  scale: 0.85 + (i % 3) * 0.1,
}));

const VFBS = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  yPercent: 22 + (i * 9) + ((i % 4) * 3),
  delay: 0.6 + i * 1.1,
  scale: 0.9 + (i % 3) * 0.12,
}));

export default function VfBVsBayernEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-vfb-flee-fcb {
          0%   { transform: translate3d(-22vw, 0, 0) rotate(0deg); opacity: 0; }
          5%   { opacity: 1; }
          50%  { transform: translate3d(50vw, -8px, 0) rotate(-8deg); }
          95%  { opacity: 1; }
          100% { transform: translate3d(125vw, 0, 0) rotate(8deg); opacity: 0; }
        }
        @keyframes fx-vfb-chase {
          0%   { transform: translate3d(-30vw, 0, 0) rotate(0deg); opacity: 0; }
          7%   { opacity: 1; }
          50%  { transform: translate3d(48vw, 6px, 0) rotate(4deg); }
          93%  { opacity: 1; }
          100% { transform: translate3d(122vw, 0, 0) rotate(-3deg); opacity: 0; }
        }
        @keyframes fx-vfb-wobble {
          0%, 100% { transform: rotate(-3deg); }
          50%      { transform: rotate(3deg); }
        }
        @keyframes fx-vfb-pitchfork {
          0%, 100% { transform: rotate(-20deg) translateY(0); }
          50%      { transform: rotate(20deg) translateY(-4px); }
        }
        @keyframes fx-vfb-banner {
          0%   { transform: translate(-50%, -100px) scale(0.4); opacity: 0; }
          10%  { transform: translate(-50%, 0) scale(1.1); opacity: 1; }
          15%  { transform: translate(-50%, 0) scale(1); }
          85%  { opacity: 1; transform: translate(-50%, 0) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50px) scale(0.9); }
        }
        @keyframes fx-vfb-banner-glow {
          0%, 100% { filter: drop-shadow(0 0 8px #dc2626) drop-shadow(0 0 18px #fef3c7); }
          50%      { filter: drop-shadow(0 0 24px #dc2626) drop-shadow(0 0 40px #fbbf24); }
        }
        .fx-vfb-fcb-runner {
          position: absolute; left: 0;
          will-change: transform, opacity;
          animation: fx-vfb-flee-fcb 7s ease-in-out forwards;
        }
        .fx-vfb-chaser-runner {
          position: absolute; left: 0;
          will-change: transform, opacity;
          animation: fx-vfb-chase 7.5s ease-in-out forwards;
        }
        .fx-vfb-wobble {
          animation: fx-vfb-wobble 0.35s ease-in-out infinite;
          transform-origin: center;
        }
        .fx-vfb-pitchfork {
          animation: fx-vfb-pitchfork 0.3s ease-in-out infinite;
          transform-origin: 50% 100%;
        }
        .fx-vfb-banner {
          position: absolute; top: 18vh; left: 50%;
          will-change: transform, opacity;
          animation:
            fx-vfb-banner 20s ease-in-out forwards,
            fx-vfb-banner-glow 1.4s ease-in-out infinite;
        }
      `}</style>

      {/* "JAGD AUF DEN REKORDMEISTER!" Banner oben */}
      <div className="fx-vfb-banner">
        <div
          style={{
            background: 'linear-gradient(135deg, #dc2626, #991b1b)',
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
          🔱 VfB JAGT FC BAYERN! 🔱
        </div>
      </div>

      {/* Mehrere FCB-Wellen fliehen über die Tafel */}
      {FCBS.map((f) => {
        // Mehrere Wellen — jede Wave 5s lang, neue startet nach delay
        const waves = [0, 7, 14]; // 3 Wellen über 20s
        return waves.map((waveOffset) => (
          <div
            key={`fcb-${f.id}-${waveOffset}`}
            className="fx-vfb-fcb-runner"
            style={{
              top: `${f.yPercent}%`,
              animationDelay: `${f.delay + waveOffset}s`,
              transform: `scale(${f.scale})`,
            }}
          >
            <div className="fx-vfb-wobble">
              <svg viewBox="0 0 80 100" width="80" height="100">
                {/* FCB-Wappen — vereinfachte rote Schild-Form */}
                <path
                  d="M 5,5 L 75,5 L 75,55 Q 75,80 40,95 Q 5,80 5,55 Z"
                  fill="#dc2626"
                  stroke="#7f1d1d"
                  strokeWidth="2"
                />
                {/* Weißer Innen-Kreis */}
                <circle cx="40" cy="42" r="22" fill="#ffffff" stroke="#dc2626" strokeWidth="1.5" />
                {/* Bayrische Raute (blau-weiß) */}
                <g transform="translate(28, 30)">
                  <rect width="6" height="6" fill="#1e3a8a" />
                  <rect x="6" width="6" height="6" fill="#ffffff" />
                  <rect x="12" width="6" height="6" fill="#1e3a8a" />
                  <rect width="6" height="6" y="6" fill="#ffffff" />
                  <rect x="6" y="6" width="6" height="6" fill="#1e3a8a" />
                  <rect x="12" y="6" width="6" height="6" fill="#ffffff" />
                  <rect width="6" height="6" y="12" fill="#1e3a8a" />
                  <rect x="6" y="12" width="6" height="6" fill="#ffffff" />
                  <rect x="12" y="12" width="6" height="6" fill="#1e3a8a" />
                </g>
                {/* "FCB" Text unter Kreis */}
                <text x="40" y="80" textAnchor="middle" fontSize="14" fontWeight="900" fill="#ffffff" stroke="#7f1d1d" strokeWidth="0.5">FCB</text>
                {/* Schweißtropfen — "fliehen vor Angst" */}
                <ellipse cx="70" cy="20" rx="3" ry="5" fill="#60a5fa" opacity="0.8" />
                <ellipse cx="14" cy="25" rx="2.5" ry="4" fill="#60a5fa" opacity="0.7" />
              </svg>
            </div>
          </div>
        ));
      }).flat()}

      {/* VfB-Verfolger mit Mistgabeln */}
      {VFBS.map((v) => {
        const waves = [0, 7, 14];
        return waves.map((waveOffset) => (
          <div
            key={`vfb-${v.id}-${waveOffset}`}
            className="fx-vfb-chaser-runner"
            style={{
              top: `${v.yPercent}%`,
              animationDelay: `${v.delay + waveOffset}s`,
              transform: `scale(${v.scale})`,
            }}
          >
            <div className="fx-vfb-wobble" style={{ animationDuration: '0.25s' }}>
              <svg viewBox="0 0 130 100" width="130" height="100">
                {/* VfB-Wappen — rotes Schild mit weißem "V" */}
                <path
                  d="M 5,5 L 75,5 L 75,55 Q 75,80 40,95 Q 5,80 5,55 Z"
                  fill="#e30613"
                  stroke="#7a0008"
                  strokeWidth="2"
                />
                {/* Weiße Brustringen-Andeutung */}
                <rect x="5" y="30" width="70" height="8" fill="#ffffff" />
                <rect x="5" y="48" width="70" height="8" fill="#ffffff" />
                {/* Großes weißes "V" */}
                <text
                  x="40" y="42"
                  textAnchor="middle"
                  fontSize="44"
                  fontWeight="900"
                  fill="#ffffff"
                  stroke="#e30613"
                  strokeWidth="1.5"
                  style={{ fontFamily: 'system-ui, sans-serif' }}
                >V</text>
                {/* "fB" klein unten */}
                <text x="40" y="78" textAnchor="middle" fontSize="11" fontWeight="900" fill="#ffffff">fB</text>
                {/* Wut-Augen */}
                <circle cx="18" cy="14" r="3" fill="#fbbf24" />
                <circle cx="62" cy="14" r="3" fill="#fbbf24" />

                {/* Mistgabel rechts — drohend gehoben */}
                <g className="fx-vfb-pitchfork" transform="translate(82, 30)">
                  {/* Stiel */}
                  <rect x="4" y="0" width="3" height="60" fill="#854d0e" rx="1" />
                  <rect x="4" y="0" width="3" height="60" fill="url(#fx-vfb-wood)" opacity="0.5" />
                  {/* Gabel-Spitzen (4 Zinken) */}
                  <g fill="#cbd5e1" stroke="#475569" strokeWidth="0.8">
                    <path d="M 0,5 L 2,-12 L 4,5 Z" />
                    <path d="M 3,5 L 5,-15 L 7,5 Z" />
                    <path d="M 6,5 L 8,-12 L 10,5 Z" />
                    <path d="M 9,5 L 11,-10 L 13,5 Z" />
                  </g>
                  {/* Glanz auf Mistgabel */}
                  <line x1="3" y1="-10" x2="3" y2="2" stroke="#f1f5f9" strokeWidth="0.6" opacity="0.8" />
                  {/* Querverbindung */}
                  <rect x="-1" y="3" width="14" height="2.5" fill="#475569" rx="0.5" />
                </g>

                {/* Wood-pattern für Stiel */}
                <defs>
                  <pattern id="fx-vfb-wood" patternUnits="userSpaceOnUse" width="3" height="6">
                    <line x1="0" y1="0" x2="3" y2="0" stroke="#6b3a05" strokeWidth="0.3" />
                    <line x1="0" y1="3" x2="3" y2="3" stroke="#6b3a05" strokeWidth="0.3" />
                  </pattern>
                </defs>
              </svg>
            </div>
          </div>
        ));
      }).flat()}
    </>
  );
}
