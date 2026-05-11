// Durchgängige Schwarzwald-Bergkette + Wald-Silhouette über die gesamte
// Bottom-Bar-Breite. Statisches Backdrop, GPU-billig, sorgt für visuelle
// Verbindung aller Szenen und realistische Luftperspektive.
export function BackdropMountains() {
  return (
    <div
      className="absolute inset-x-0 bottom-0 pointer-events-none"
      style={{ height: 200, zIndex: -1 }}
    >
      <svg
        width="100%"
        height={200}
        viewBox="0 0 1920 200"
        preserveAspectRatio="none"
        style={{ overflow: 'visible', display: 'block' }}
      >
        <defs>
          {/* Atmosphären-Verdichtung von oben dunkler zu unten heller-blau */}
          <linearGradient id="bm-sky-haze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(60,75,90,0)" />
            <stop offset="60%"  stopColor="rgba(140,160,180,0.18)" />
            <stop offset="100%" stopColor="rgba(180,200,220,0.35)" />
          </linearGradient>
          <linearGradient id="bm-far-mountain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#9aabc0" />
            <stop offset="100%" stopColor="#6e8295" />
          </linearGradient>
          <linearGradient id="bm-mid-mountain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#566c80" />
            <stop offset="100%" stopColor="#3e5365" />
          </linearGradient>
          <linearGradient id="bm-near-mountain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#2f4252" />
            <stop offset="100%" stopColor="#1f3040" />
          </linearGradient>
        </defs>

        {/* Himmel-Dunst */}
        <rect x="0" y="0" width="1920" height="160" fill="url(#bm-sky-haze)" opacity="0.55" />

        {/* ── Layer 1: Sehr ferne Bergkette (hellstes Blau, weichste Linie) ── */}
        <path
          d="M 0 140
             L 80 100  L 160 120  L 240 85   L 340 110  L 440 70
             L 540 95  L 640 75   L 740 100  L 840 60   L 940 90
             L 1040 70 L 1140 95  L 1240 65  L 1360 100 L 1460 75
             L 1560 105 L 1660 80 L 1760 110 L 1860 90  L 1920 105
             L 1920 200 L 0 200 Z"
          fill="url(#bm-far-mountain)"
          opacity="0.55"
        />
        {/* Schneekappen auf den fernen Gipfeln */}
        {[
          [440, 70, 8], [840, 60, 9], [1040, 70, 7], [1240, 65, 8], [1460, 75, 7],
        ].map(([x, y, w], i) => (
          <polygon
            key={`fs-${i}`}
            points={`${x},${y} ${x - w},${y + 6} ${x + w},${y + 6}`}
            fill="#dde5ec"
            opacity="0.7"
          />
        ))}

        {/* ── Layer 2: Mittel-ferne Bergkette (zackiger) ──────────────────── */}
        <path
          d="M 0 165
             L 60 135  L 130 150  L 210 115  L 290 145  L 380 110
             L 460 135 L 540 105  L 620 130  L 700 100  L 790 125
             L 880 105 L 970 130  L 1060 115 L 1150 138 L 1240 110
             L 1330 130 L 1420 105 L 1510 125 L 1600 100 L 1690 130
             L 1780 115 L 1860 135 L 1920 120
             L 1920 200 L 0 200 Z"
          fill="url(#bm-mid-mountain)"
          opacity="0.75"
        />
        {/* Schneekappen auf den höchsten mittleren Gipfeln */}
        {[
          [210, 115, 7], [700, 100, 8], [1240, 110, 7], [1600, 100, 8],
        ].map(([x, y, w], i) => (
          <polygon
            key={`ms-${i}`}
            points={`${x},${y} ${x - w},${y + 5} ${x + w},${y + 5}`}
            fill="#e8edf2"
            opacity="0.8"
          />
        ))}

        {/* ── Layer 3: Vordere Bergsilhouette (dunkler, näher) ───────────── */}
        <path
          d="M 0 180
             L 70 158  L 150 170  L 230 150  L 320 168  L 400 145
             L 480 165 L 560 148  L 650 168  L 740 150  L 830 172
             L 920 155 L 1010 175 L 1100 158 L 1190 178 L 1290 155
             L 1380 175 L 1470 158 L 1560 178 L 1650 160 L 1740 180
             L 1830 165 L 1920 175
             L 1920 200 L 0 200 Z"
          fill="url(#bm-near-mountain)"
          opacity="0.9"
        />

        {/* ── Layer 4: Durchgehender Wald-Saum aus Tannensilhouetten ────── */}
        {/* Weit-entfernte Tannen — verteilt entlang einer hügeligen Linie,
            harmonisch über die ganze Breite */}
        {Array.from({ length: 70 }).map((_, i) => {
          // Pseudo-random aber deterministisch (kein Math.random, damit SSR-stabil)
          const x = i * 28 + ((i * 73) % 17);
          const baseline = 175 + Math.sin(i * 0.8) * 5; // wellige Linie
          const h = 14 + ((i * 31) % 11);
          const w = 6 + ((i * 17) % 4);
          const dimmer = i % 3 === 0;
          return (
            <g key={`tr-${i}`} opacity={dimmer ? 0.55 : 0.85}>
              {/* Stamm */}
              <rect x={x - 0.4} y={baseline - 3} width="0.8" height="3" fill="#3a2010" />
              {/* Tanne als 3-stufiges Dreieck */}
              <polygon
                points={`${x},${baseline - h} ${x - w / 2},${baseline - h * 0.65} ${x + w / 2},${baseline - h * 0.65}`}
                fill="#1a3a25"
              />
              <polygon
                points={`${x},${baseline - h * 0.85} ${x - w * 0.62},${baseline - h * 0.4} ${x + w * 0.62},${baseline - h * 0.4}`}
                fill="#1f4d2f"
              />
              <polygon
                points={`${x},${baseline - h * 0.55} ${x - w * 0.75},${baseline - h * 0.1} ${x + w * 0.75},${baseline - h * 0.1}`}
                fill="#2a5e3a"
              />
            </g>
          );
        })}

        {/* ── Layer 5: Wiesen-Saum direkt unter den Waldrand ─────────────── */}
        <path
          d="M 0 188
             Q 480 184 960 188 Q 1440 192 1920 186
             L 1920 200 L 0 200 Z"
          fill="rgba(20,40,25,0.4)"
        />
      </svg>
    </div>
  );
}
