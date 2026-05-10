interface Props {
  variant: 'forest' | 'playground';
}

const W = 320;
const H = 200;

// ── Brücke zwischen den 3 Schwarzwald-Szenen ──────────────────────────────
// "forest"     → zwischen Holzfäller und Sauna: Pfad, Wanderer, Pilze, Brücke
// "playground" → zwischen Sauna und Reh: Sandkasten, Schaukel, Rutsche, Wippe
export function GapBridge({ variant }: Props) {
  return (
    <div
      className="pointer-events-none relative flex-1"
      style={{ height: H, minWidth: 0 }}
    >
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMax meet"
        style={{ overflow: 'visible', display: 'block' }}
      >
        <style>{`
          @keyframes gb-tree-sway   { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(1.3deg); } }
          @keyframes gb-bush-sway   { 0%,100% { transform: scale(1, 1); } 50% { transform: scale(1.03, 0.97); } }
          @keyframes gb-walk        {
            0%   { transform: translate(-10px, 0); }
            100% { transform: translate(310px, 0); }
          }
          @keyframes gb-step        { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1px); } }
          @keyframes gb-swing       {
            0%, 100% { transform: rotate(-22deg); }
            50%      { transform: rotate(22deg); }
          }
          @keyframes gb-seesaw      {
            0%, 100% { transform: rotate(-8deg); }
            50%      { transform: rotate(8deg); }
          }
          @keyframes gb-slide-kid {
            0%, 12%, 100% { transform: translate(0, 0); opacity: 1; }
            14%, 35%      { transform: translate(14px, 13px); opacity: 1; }
            38%           { transform: translate(14px, 13px); opacity: 0; }
            55%, 100%     { transform: translate(0, 0); opacity: 1; }
          }
          @keyframes gb-spring-rider {
            0%, 100% { transform: rotate(-6deg); }
            50%      { transform: rotate(6deg); }
          }
          @keyframes gb-creek       { 0% { transform: translateX(0); } 100% { transform: translateX(-12px); } }
          @keyframes gb-bird-glide  { 0% { transform: translate(-30px, 8px); } 100% { transform: translate(360px, 22px); } }
          @keyframes gb-firefly     { 0%,100% { opacity: 0.2; } 50% { opacity: 1; } }
          @keyframes gb-ball-bounce {
            0%, 100% { transform: translate(0, 0); }
            45%      { transform: translate(8px, -14px); }
            50%      { transform: translate(10px, -16px); }
            95%      { transform: translate(18px, 0); }
          }

          .gb-tree         { transform-origin: bottom center; animation: gb-tree-sway 4s infinite ease-in-out; }
          .gb-bush         { transform-origin: bottom center; animation: gb-bush-sway 5s infinite ease-in-out; }
          .gb-walk         { animation: gb-walk 60s infinite linear; }
          .gb-step         { animation: gb-step 0.55s infinite ease-in-out; }
          .gb-swing        { transform-origin: 160px 158px; animation: gb-swing 2.4s infinite ease-in-out; }
          .gb-seesaw       { transform-origin: 265px 184px; animation: gb-seesaw 3s infinite ease-in-out; }
          .gb-slide-kid    { animation: gb-slide-kid 6s infinite ease-in-out; }
          .gb-spring-rider { transform-origin: bottom center; animation: gb-spring-rider 1.6s infinite ease-in-out; }
          .gb-creek        { animation: gb-creek 3s infinite linear; }
          .gb-bird         { animation: gb-bird-glide 24s infinite linear; }
          .gb-firefly      { animation: gb-firefly 7s infinite ease-in-out; }
          .gb-ball         { animation: gb-ball-bounce 4s infinite ease-in-out; }

          @media (prefers-reduced-motion: reduce) {
            .gb-tree, .gb-bush, .gb-walk, .gb-step, .gb-swing, .gb-seesaw,
            .gb-slide-kid, .gb-spring-rider, .gb-creek, .gb-bird, .gb-firefly, .gb-ball {
              animation: none;
            }
          }
        `}</style>

        {/* Durchgehender Bodensaum (verbindet die Szenen visuell) */}
        <rect x="0" y={H - 7} width={W} height="7" fill="rgba(20,40,25,0.45)" />
        <rect x="0" y={H - 4} width={W} height="4" fill="rgba(20,40,25,0.55)" />

        {/* Hintere Bäume (Wald-Tiefe — durchgängig zu den Nachbarszenen) */}
        <BackTree x={15}  h={48} dimmer delay="-0.3s" />
        <BackTree x={45}  h={52} dimmer delay="-1.6s" />
        <BackTree x={290} h={52} dimmer delay="-2.2s" />
        <BackTree x={305} h={46} dimmer delay="-0.8s" />

        {/* Wolken */}
        <Cloud cx={80}  cy={20} w={22} />
        <Cloud cx={210} cy={14} w={18} />

        {/* Ein paar verstreute Vögel im Himmel */}
        <g className="gb-bird">
          <path d="M0,0 Q3,-3 6,0 Q9,-3 12,0" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
        </g>

        {variant === 'forest' ? <ForestPath /> : <Playground />}
      </svg>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// FOREST-PFAD zwischen Holzfäller und Sauna
// ════════════════════════════════════════════════════════════════════════
function ForestPath() {
  return (
    <g>
      {/* Geschwungener Sandpfad quer durch */}
      <path
        d="M -10 195 Q 80 185 160 190 Q 240 195 330 188"
        stroke="#a07c4a"
        strokeWidth="9"
        fill="none"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M -10 195 Q 80 185 160 190 Q 240 195 330 188"
        stroke="#7c4a1a"
        strokeWidth="0.6"
        fill="none"
        opacity="0.4"
      />

      {/* Kleiner Bach quert den Pfad mit Holzbrücke */}
      <g transform="translate(160, 188)">
        {/* Bach unter der Brücke */}
        <rect x="-22" y="2" width="44" height="5" fill="#1a3a55" opacity="0.85" />
        <rect x="-22" y="3" width="44" height="2.5" fill="#234a6e" />
        <g className="gb-creek">
          <path
            d="M-25 5 Q-20 3 -15 5 Q-10 7 -5 5 Q0 3 5 5 Q10 7 15 5 Q20 3 25 5 Q30 7 35 5"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="0.4"
            fill="none"
          />
        </g>
        {/* Holzbrücke */}
        <rect x="-20" y="-2" width="40" height="4" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.4" rx="0.5" />
        {/* Bretter-Linien */}
        {[-14, -8, -2, 4, 10, 16].map((dx) => (
          <line key={dx} x1={dx} y1="-2" x2={dx} y2="2" stroke="#3a1808" strokeWidth="0.4" />
        ))}
        {/* Geländer */}
        <rect x="-20" y="-7" width="40" height="0.7" fill="#5a3010" />
        <rect x="-20" y="-9" width="1.2" height="6" fill="#5a3010" />
        <rect x="0"   y="-9" width="1.2" height="6" fill="#5a3010" />
        <rect x="20"  y="-9" width="1.2" height="6" fill="#5a3010" />
      </g>

      {/* Wanderer mit Stock — wandert über den Pfad */}
      <g className="gb-walk">
        <g transform="translate(0, 192)">
          <g className="gb-step">
            <Wanderer />
          </g>
        </g>
      </g>

      {/* Pilze entlang des Pfades */}
      <Mushroom x={35}  cap="#c0392b" />
      <Mushroom x={48}  cap="#8b5a2b" small />
      <Mushroom x={120} cap="#c0392b" />
      <Mushroom x={210} cap="#c0392b" small />
      <Mushroom x={245} cap="#8b5a2b" />
      <Mushroom x={295} cap="#c0392b" />

      {/* Büsche an Pfad-Rändern */}
      <g className="gb-bush" style={{ transformOrigin: '70px 192px', animationDelay: '-0.5s' }}>
        <Bush cx={70}  cy={192} size={1.1} />
      </g>
      <g className="gb-bush" style={{ transformOrigin: '230px 192px', animationDelay: '-2s' }}>
        <Bush cx={230} cy={192} size={0.95} dark />
      </g>
      <g className="gb-bush" style={{ transformOrigin: '275px 193px', animationDelay: '-3.2s' }}>
        <Bush cx={275} cy={193} size={0.85} />
      </g>

      {/* Wegweiser am Pfad */}
      <g transform="translate(100, 193)">
        <rect x="-0.5" y="-16" width="1" height="16" fill="#5a3010" />
        <polygon points="-7,-15 4,-15 6,-13 4,-11 -7,-11" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.3" />
        <text x="-6" y="-12" fontSize="2.4" fontWeight="800" fill="#1a0e05" fontFamily="Inter, sans-serif">SAUNA</text>
      </g>

      {/* Wiesenblumen */}
      <Flower cx={20}  cy={196} color="#fbbf24" />
      <Flower cx={90}  cy={197} color="#ec4899" />
      <Flower cx={140} cy={197} color="#a78bfa" />
      <Flower cx={195} cy={196} color="#fbbf24" />
      <Flower cx={260} cy={197} color="#ec4899" />
      <Flower cx={315} cy={196} color="#a78bfa" />

      {/* Glühwürmchen-Hauch */}
      <g className="gb-firefly" style={{ animationDelay: '-1s', transformOrigin: '195px 150px' }}>
        <circle cx="195" cy="150" r="2" fill="rgba(252,211,77,0.3)" />
        <circle cx="195" cy="150" r="0.8" fill="#fef3c7" />
      </g>
      <g className="gb-firefly" style={{ animationDelay: '-3s', transformOrigin: '85px 145px' }}>
        <circle cx="85" cy="145" r="2" fill="rgba(252,211,77,0.3)" />
        <circle cx="85" cy="145" r="0.8" fill="#fef3c7" />
      </g>
    </g>
  );
}

function Wanderer() {
  return (
    <g>
      {/* Schatten */}
      <ellipse cx="0" cy="0" rx="3" ry="0.6" fill="rgba(0,0,0,0.35)" />
      {/* Wanderstock */}
      <line x1="4.5" y1="-1" x2="6" y2="-14" stroke="#5a3010" strokeWidth="0.7" strokeLinecap="round" />
      {/* Mini-Schleife am Stock */}
      <circle cx="6" cy="-14" r="0.6" fill="#dc2626" />
      {/* Beine */}
      <line x1="-1.2" y1="-1.5" x2="-1.5" y2="0" stroke="#2d4a78" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="1.2"  y1="-1.5" x2="1.5"  y2="0" stroke="#2d4a78" strokeWidth="1.2" strokeLinecap="round" />
      {/* Wanderschuhe */}
      <ellipse cx="-1.5" cy="0" rx="1.3" ry="0.4" fill="#1a0e05" />
      <ellipse cx="1.5"  cy="0" rx="1.3" ry="0.4" fill="#1a0e05" />
      {/* Rucksack */}
      <rect x="-3.5" y="-9" width="2.5" height="6" fill="#5a3010" stroke="#3a1808" strokeWidth="0.3" rx="0.5" />
      <rect x="-3.5" y="-9" width="2.5" height="1" fill="#7c4a1a" />
      {/* Körper (rote Outdoor-Jacke) */}
      <rect x="-2" y="-7" width="4" height="6" fill="#dc2626" rx="0.6" />
      <line x1="0" y1="-7" x2="0" y2="-1.5" stroke="#7c2d12" strokeWidth="0.4" />
      {/* Arme */}
      <line x1="-2" y1="-6" x2="-3.5" y2="-3" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="2"  y1="-6" x2="4.5"  y2="-2" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round" />
      {/* Kopf */}
      <circle cx="0" cy="-9" r="1.6" fill="#ffd5aa" />
      {/* Wanderhut */}
      <ellipse cx="0" cy="-10.3" rx="2.4" ry="0.5" fill="#3a1808" />
      <rect x="-1.4" y="-11.5" width="2.8" height="1.5" fill="#5a3010" rx="0.3" />
      {/* Augen + Lächeln */}
      <circle cx="-0.5" cy="-9" r="0.18" fill="#1a0e05" />
      <circle cx="0.5"  cy="-9" r="0.18" fill="#1a0e05" />
      <path d="M-0.6 -8.3 Q0 -8 0.6 -8.3" stroke="#3a1808" strokeWidth="0.25" fill="none" />
    </g>
  );
}

// ════════════════════════════════════════════════════════════════════════
// KINDERSPIELPLATZ zwischen Sauna und Reh
// ════════════════════════════════════════════════════════════════════════
function Playground() {
  return (
    <g>
      {/* Gepflasterter Bereich (heller Sand-/Kiesboden) */}
      <ellipse cx={160} cy={195} rx={155} ry={5} fill="#c8a16a" opacity="0.45" />
      <ellipse cx={160} cy={194} rx={150} ry={3} fill="#d4b078" opacity="0.5" />

      {/* Sandkasten links */}
      <g transform="translate(40, 193)">
        {/* Holzrahmen */}
        <rect x="-22" y="-3" width="44" height="3.5" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.4" />
        <rect x="-22" y="-3" width="44" height="1"   fill="#a06530" />
        <rect x="-23" y="-5" width="2" height="5"    fill="#5a3010" />
        <rect x="21"  y="-5" width="2" height="5"    fill="#5a3010" />
        {/* Sand */}
        <rect x="-21" y="-2" width="42" height="2" fill="#f5d28a" />
        <circle cx="-12" cy="-1.5" r="0.4" fill="#d4b078" />
        <circle cx="5"   cy="-1.2" r="0.5" fill="#d4b078" />
        <circle cx="14"  cy="-1.6" r="0.3" fill="#d4b078" />
        {/* Sand-Burg */}
        <rect x="-3" y="-5" width="6" height="3" fill="#e8b66e" />
        <rect x="-4" y="-5" width="8" height="1" fill="#d4b078" />
        <polygon points="-3,-5 -3,-6.5 -1,-6.5 -1,-5" fill="#e8b66e" />
        <polygon points="1,-5 1,-6.5 3,-6.5 3,-5" fill="#e8b66e" />
        {/* Mini-Fahne auf der Burg */}
        <line x1="0" y1="-5.5" x2="0" y2="-8" stroke="#5a3010" strokeWidth="0.3" />
        <polygon points="0,-8 2,-7.5 0,-7" fill="#dc2626" />
        {/* Kind kauert daneben mit Schaufel */}
        <g transform="translate(-15, -0.5)">
          <ellipse cx="0" cy="0.5" rx="1.6" ry="0.4" fill="rgba(0,0,0,0.3)" />
          <rect x="-1.2" y="-1.5" width="2.4" height="2" fill="#fbbf24" rx="0.3" />
          <circle cx="0" cy="-3.2" r="1.4" fill="#ffd5aa" />
          <path d="M-1.3 -3.8 Q0 -4.8 1.3 -3.8" stroke="#3a1808" strokeWidth="0.5" fill="none" />
          <circle cx="-0.4" cy="-3.2" r="0.2" fill="#1a0e05" />
          <circle cx="0.4"  cy="-3.2" r="0.2" fill="#1a0e05" />
          <path d="M-0.4 -2.7 Q0 -2.4 0.4 -2.7" stroke="#3a1808" strokeWidth="0.25" fill="none" />
          {/* Arm mit Schaufel */}
          <line x1="1.2" y1="-1.6" x2="2.5" y2="-0.2" stroke="#ffd5aa" strokeWidth="0.7" strokeLinecap="round" />
          <line x1="2.5" y1="-0.2" x2="3"   y2="-1.5" stroke="#3a1808" strokeWidth="0.4" />
          <rect x="2.7" y="-2.4" width="1"   height="1" fill="#dc2626" />
        </g>
        {/* Mini-Eimer mit Schaufel daneben */}
        <g transform="translate(13, -1)">
          <path d="M-1.4 0 L 1.4 0 L 1.1 2.8 L -1.1 2.8 Z" fill="#3b82f6" stroke="#1e3a8a" strokeWidth="0.3" />
          <path d="M-1.4 0 Q 0 -1 1.4 0" stroke="#1e3a8a" strokeWidth="0.3" fill="none" />
        </g>
      </g>

      {/* Schaukel mit schaukelndem Kind */}
      <g transform="translate(135, 193)">
        {/* A-Frame */}
        <line x1="-15" y1="-1" x2="-5" y2="-30" stroke="#3a1808" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="15"  y1="-1" x2="5"  y2="-30" stroke="#3a1808" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="-13" y1="-1" x2="-3" y2="-30" stroke="#3a1808" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="13"  y1="-1" x2="3"  y2="-30" stroke="#3a1808" strokeWidth="1.4" strokeLinecap="round" />
        {/* Querbalken */}
        <rect x="-20" y="-32" width="40" height="2.5" fill="#5a3010" stroke="#3a1808" strokeWidth="0.4" rx="0.5" />
        {/* Schaukel-Seile + Sitz + Kind */}
        <g className="gb-swing">
          <line x1="-3" y1="-30" x2="-3" y2="-13" stroke="#1a1a1a" strokeWidth="0.5" />
          <line x1="3"  y1="-30" x2="3"  y2="-13" stroke="#1a1a1a" strokeWidth="0.5" />
          {/* Sitz */}
          <rect x="-4" y="-13" width="8" height="1.5" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.3" />
          {/* Kind */}
          <ellipse cx="0" cy="-12" rx="2.4" ry="0.4" fill="rgba(0,0,0,0.3)" />
          <rect x="-1.6" y="-15" width="3.2" height="2.5" fill="#a78bfa" rx="0.4" />
          <circle cx="0" cy="-17" r="1.7" fill="#ffd5aa" />
          <path d="M-1.6 -17.8 Q0 -19 1.6 -17.8 Q1.4 -17.2 0 -17.2 Q-1.4 -17.2 -1.6 -17.8" fill="#7c4a1a" />
          <circle cx="-0.5" cy="-17" r="0.2" fill="#1a0e05" />
          <circle cx="0.5"  cy="-17" r="0.2" fill="#1a0e05" />
          <path d="M-0.5 -16.4 Q0 -16 0.5 -16.4" stroke="#3a1808" strokeWidth="0.3" fill="none" />
          {/* Arme an Seilen */}
          <line x1="-1.8" y1="-15" x2="-3" y2="-13.5" stroke="#ffd5aa" strokeWidth="0.6" strokeLinecap="round" />
          <line x1="1.8"  y1="-15" x2="3"  y2="-13.5" stroke="#ffd5aa" strokeWidth="0.6" strokeLinecap="round" />
          {/* Beine */}
          <line x1="-1" y1="-12.5" x2="-1" y2="-10" stroke="#1e3a8a" strokeWidth="1" strokeLinecap="round" />
          <line x1="1"  y1="-12.5" x2="1"  y2="-10" stroke="#1e3a8a" strokeWidth="1" strokeLinecap="round" />
        </g>
      </g>

      {/* Rutsche */}
      <g transform="translate(200, 193)">
        {/* Plattform oben */}
        <rect x="-3" y="-18" width="10" height="3" fill="#5a3010" stroke="#3a1808" strokeWidth="0.3" />
        <rect x="-3" y="-18" width="10" height="0.6" fill="#7c4a1a" />
        {/* Leiter */}
        <line x1="-2.5" y1="-15" x2="-2.5" y2="0" stroke="#3a1808" strokeWidth="0.8" />
        <line x1="0.5"  y1="-15" x2="0.5"  y2="0" stroke="#3a1808" strokeWidth="0.8" />
        {[-13, -10, -7, -4, -1].map((dy) => (
          <line key={dy} x1="-2.5" y1={dy} x2="0.5" y2={dy} stroke="#3a1808" strokeWidth="0.5" />
        ))}
        {/* Rutsch-Bahn */}
        <path d="M 6 -17 L 26 -1 L 24 1 L 4 -15 Z" fill="#22d3ee" stroke="#0891b2" strokeWidth="0.4" />
        <path d="M 6 -17 L 26 -1 L 24 1 L 4 -15 Z" fill="rgba(255,255,255,0.25)" />
        {/* Rutsch-Endrolle */}
        <ellipse cx="25" cy="0" rx="2.5" ry="0.9" fill="#0e7490" />
        {/* Geländer rechts an der Rutsche */}
        <line x1="6"  y1="-17" x2="3"  y2="-19" stroke="#5a3010" strokeWidth="0.5" />
        <line x1="26" y1="-1"  x2="26" y2="-4"  stroke="#5a3010" strokeWidth="0.4" />
        {/* Kind rutscht hinunter */}
        <g className="gb-slide-kid">
          <g transform="translate(11, -10)">
            <rect x="-1.2" y="-1.5" width="2.4" height="2" fill="#22c55e" rx="0.3" transform="rotate(-38)" />
            <circle cx="0.6" cy="-2.8" r="1.4" fill="#ffd5aa" />
            <circle cx="0.2" cy="-2.8" r="0.18" fill="#1a0e05" />
            <circle cx="1"   cy="-2.8" r="0.18" fill="#1a0e05" />
            <path d="M0.1 -2.2 Q0.6 -1.8 1.1 -2.2" stroke="#3a1808" strokeWidth="0.25" fill="none" />
            {/* Arme hoch (Spaß!) */}
            <line x1="-0.5" y1="-3.5" x2="-2"   y2="-5" stroke="#ffd5aa" strokeWidth="0.6" strokeLinecap="round" />
            <line x1="1.6"  y1="-3.5" x2="3"    y2="-5" stroke="#ffd5aa" strokeWidth="0.6" strokeLinecap="round" />
          </g>
        </g>
      </g>

      {/* Wippe (Seesaw) */}
      <g transform="translate(265, 193)">
        {/* Drehpunkt */}
        <polygon points="0,-9 -3,-2 3,-2" fill="#5a3010" stroke="#3a1808" strokeWidth="0.4" />
        <rect x="-4" y="-2" width="8" height="2" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.4" rx="0.3" />
        {/* Planke + 2 Kinder */}
        <g className="gb-seesaw">
          <rect x="-22" y="-10" width="44" height="2" fill="#a06530" stroke="#3a1808" strokeWidth="0.4" rx="0.4" />
          {/* Holzmaserung */}
          <line x1="-22" y1="-9" x2="22" y2="-9" stroke="#7c4a1a" strokeWidth="0.3" />
          {/* Griff links */}
          <rect x="-19" y="-13" width="1.4" height="3" fill="#3a1808" />
          <rect x="17.6" y="-13" width="1.4" height="3" fill="#3a1808" />
          {/* Kind links (rosa) */}
          <g transform="translate(-18, -10)">
            <rect x="-1.6" y="-2.5" width="3.2" height="2.5" fill="#ec4899" rx="0.4" />
            <circle cx="0" cy="-4.5" r="1.6" fill="#ffd5aa" />
            <path d="M-1.6 -5.4 Q0 -6.4 1.6 -5.4 L 1.6 -4.8 L -1.6 -4.8 Z" fill="#7c4a1a" />
            <circle cx="-0.5" cy="-4.5" r="0.2" fill="#1a0e05" />
            <circle cx="0.5"  cy="-4.5" r="0.2" fill="#1a0e05" />
            <path d="M-0.5 -3.9 Q0 -3.6 0.5 -3.9" stroke="#3a1808" strokeWidth="0.25" fill="none" />
            {/* Zöpfe */}
            <ellipse cx="-1.7" cy="-4" rx="0.4" ry="0.9" fill="#7c4a1a" />
            <ellipse cx="1.7"  cy="-4" rx="0.4" ry="0.9" fill="#7c4a1a" />
          </g>
          {/* Kind rechts (gelb) */}
          <g transform="translate(18, -10)">
            <rect x="-1.6" y="-2.5" width="3.2" height="2.5" fill="#fbbf24" rx="0.4" />
            <circle cx="0" cy="-4.5" r="1.6" fill="#ffd5aa" />
            <circle cx="0" cy="-5.2" r="1.7" fill="#3a1808" />
            <rect x="-1.5" y="-5.5" width="3" height="0.6" fill="#3a1808" />
            <circle cx="-0.5" cy="-4.5" r="0.2" fill="#1a0e05" />
            <circle cx="0.5"  cy="-4.5" r="0.2" fill="#1a0e05" />
            <path d="M-0.5 -3.9 Q0 -3.6 0.5 -3.9" stroke="#3a1808" strokeWidth="0.25" fill="none" />
          </g>
        </g>
      </g>

      {/* Federwippe (Mini-Pferd) im Vordergrund */}
      <g transform="translate(85, 193)">
        {/* Feder */}
        <line x1="0" y1="-2" x2="0" y2="-7" stroke="#5a5a5a" strokeWidth="0.6" />
        <path
          d="M -0.7 -2 Q 0.7 -3 -0.7 -4 Q 0.7 -5 -0.7 -6 Q 0.7 -7 0 -7.5"
          stroke="#5a5a5a"
          strokeWidth="0.5"
          fill="none"
        />
        {/* Pferd-Korpus */}
        <g className="gb-spring-rider" style={{ transformOrigin: '0px -7px' }}>
          <ellipse cx="0" cy="-9" rx="4" ry="2.4" fill="#dc2626" />
          {/* Kopf vorne */}
          <ellipse cx="3.6" cy="-10" rx="1.6" ry="1.6" fill="#dc2626" />
          <circle cx="4.4" cy="-10.2" r="0.25" fill="#1a0e05" />
          <ellipse cx="4.8" cy="-9.5" rx="0.6" ry="0.4" fill="#7c2d12" />
          {/* Ohren */}
          <polygon points="3.2,-11.2 3.7,-12 4.1,-11.2" fill="#dc2626" />
          {/* Mähne */}
          <path d="M 1 -11 L 1.5 -10 L 0.5 -10.5 L 1 -10 Z" fill="#7c2d12" />
          {/* Sattel mit Kind */}
          <rect x="-1.6" y="-12" width="3.2" height="2.5" fill="#2d5a3f" rx="0.3" />
          <circle cx="0" cy="-13.8" r="1.4" fill="#ffd5aa" />
          <circle cx="-0.4" cy="-13.8" r="0.18" fill="#1a0e05" />
          <circle cx="0.4"  cy="-13.8" r="0.18" fill="#1a0e05" />
          <path d="M-0.4 -13.2 Q0 -12.9 0.4 -13.2" stroke="#3a1808" strokeWidth="0.25" fill="none" />
          <path d="M-1.4 -14.6 Q0 -15.4 1.4 -14.6" fill="#3a1808" />
        </g>
      </g>

      {/* Spielzeug-Ball hüpft */}
      <g transform="translate(225, 195)" className="gb-ball">
        <circle cx="0" cy="-2" r="2.4" fill="#dc2626" />
        <path d="M -2.4 -2 Q 0 -3.8 2.4 -2" stroke="#fff" strokeWidth="0.4" fill="none" />
        <path d="M -2.4 -2 Q 0 -0.2 2.4 -2" stroke="#fff" strokeWidth="0.4" fill="none" />
        <line x1="0" y1="-4.4" x2="0" y2="0.4" stroke="#fff" strokeWidth="0.4" />
      </g>

      {/* Eltern-Bank rechts daneben */}
      <g transform="translate(305, 192)">
        <rect x="-6" y="-3" width="1.2" height="3" fill="#5a3010" />
        <rect x="4.8" y="-3" width="1.2" height="3" fill="#5a3010" />
        <rect x="-7" y="-4.5" width="14" height="1.5" fill="#7c4a1a" rx="0.4" />
        <rect x="-6.5" y="-6.5" width="13" height="0.7" fill="#5a3010" />
        {/* Sitzende Mutter */}
        <g transform="translate(-2, -4.5)">
          <rect x="-1.5" y="-3" width="3" height="3" fill="#3b82f6" rx="0.4" />
          <circle cx="0" cy="-4.5" r="1.5" fill="#ffd5aa" />
          <path d="M-1.5 -5.4 Q0 -6.4 1.5 -5.4 L 1.5 -5 L -1.5 -5 Z" fill="#7c4a1a" />
          <circle cx="-0.4" cy="-4.5" r="0.18" fill="#1a0e05" />
          <circle cx="0.4"  cy="-4.5" r="0.18" fill="#1a0e05" />
          <path d="M-0.4 -3.9 Q0 -3.7 0.4 -3.9" stroke="#3a1808" strokeWidth="0.22" fill="none" />
        </g>
      </g>

      {/* Bunte Wimpelkette über dem Spielplatz */}
      <path d="M 20 165 Q 160 178 305 162" stroke="#1a1a1a" strokeWidth="0.4" fill="none" opacity="0.6" />
      {[
        { t: 0.08, color: '#dc2626' },
        { t: 0.18, color: '#fbbf24' },
        { t: 0.28, color: '#3b82f6' },
        { t: 0.38, color: '#22c55e' },
        { t: 0.48, color: '#ec4899' },
        { t: 0.58, color: '#dc2626' },
        { t: 0.68, color: '#fbbf24' },
        { t: 0.78, color: '#3b82f6' },
        { t: 0.88, color: '#22c55e' },
      ].map((f, i) => {
        // Bezier-Annäherung: Punkte entlang Pfad
        const x = (1 - f.t) * (1 - f.t) * 20 + 2 * (1 - f.t) * f.t * 160 + f.t * f.t * 305;
        const y = (1 - f.t) * (1 - f.t) * 165 + 2 * (1 - f.t) * f.t * 178 + f.t * f.t * 162;
        return (
          <polygon
            key={i}
            points={`${x - 2},${y} ${x + 2},${y} ${x},${y + 4.5}`}
            fill={f.color}
            opacity="0.9"
          />
        );
      })}

      {/* Wiesenblumen */}
      <Flower cx={15}  cy={196} color="#ec4899" />
      <Flower cx={70}  cy={197} color="#fbbf24" />
      <Flower cx={170} cy={197} color="#a78bfa" />
      <Flower cx={250} cy={197} color="#fbbf24" />
      <Flower cx={295} cy={197} color="#ec4899" />
    </g>
  );
}

// ────────────── kleine Hilfs-Komponenten ──────────────────────────────────

function BackTree({ x, h, dimmer, delay }: { x: number; h: number; dimmer?: boolean; delay: string }) {
  const groundY = 188;
  const crownH = h - 10;
  const crownW = 16 + crownH * 0.28;
  const opacity = dimmer ? 0.55 : 0.85;
  return (
    <g opacity={opacity} className="gb-tree" style={{ animationDelay: delay }}>
      <ellipse cx={x} cy={groundY + 1} rx={crownW * 0.5} ry={1.5} fill="rgba(0,0,0,0.35)" />
      <rect x={x - 1.5} y={groundY - 10} width="3" height="10" fill="#5a3010" rx="1" />
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

function Cloud({ cx, cy, w }: { cx: number; cy: number; w: number }) {
  return (
    <g opacity="0.5">
      <ellipse cx={cx}            cy={cy}     rx={w * 0.4} ry={3} fill="#ecf0f4" />
      <ellipse cx={cx - w * 0.3}  cy={cy + 1} rx={w * 0.3} ry={2.5} fill="#ecf0f4" />
      <ellipse cx={cx + w * 0.35} cy={cy + 1} rx={w * 0.3} ry={2.5} fill="#ecf0f4" />
      <ellipse cx={cx + w * 0.1}  cy={cy - 1} rx={w * 0.25} ry={2} fill="#ffffff" />
    </g>
  );
}

function Bush({ cx, cy, size = 1, dark = false }: { cx: number; cy: number; size?: number; dark?: boolean }) {
  const base = dark ? '#1f4d2f' : '#2a6e44';
  const mid  = dark ? '#2a5e3a' : '#326c44';
  const w = 8 * size;
  return (
    <g>
      <ellipse cx={cx} cy={cy + 0.5} rx={w * 0.7} ry={1.2} fill="rgba(0,0,0,0.35)" />
      <ellipse cx={cx - w * 0.35} cy={cy - w * 0.35} rx={w * 0.55} ry={w * 0.55} fill={base} />
      <ellipse cx={cx + w * 0.30} cy={cy - w * 0.30} rx={w * 0.55} ry={w * 0.55} fill={base} />
      <ellipse cx={cx}            cy={cy - w * 0.55} rx={w * 0.55} ry={w * 0.55} fill={mid} />
    </g>
  );
}

function Mushroom({ x, cap, small = false }: { x: number; cap: string; small?: boolean }) {
  const w = small ? 2.4 : 3.2;
  const stemH = small ? 2.2 : 3;
  const baseY = 195;
  return (
    <g>
      <rect x={x - w * 0.3} y={baseY - stemH} width={w * 0.6} height={stemH} fill="#f5e6c8" rx={0.5} />
      <ellipse cx={x} cy={baseY - stemH} rx={w} ry={w * 0.7} fill={cap} />
      {cap.startsWith('#c') && (
        <>
          <circle cx={x - w * 0.4} cy={baseY - stemH - 0.3} r="0.4" fill="rgba(255,255,255,0.9)" />
          <circle cx={x + w * 0.3} cy={baseY - stemH - 0.5} r="0.3" fill="rgba(255,255,255,0.9)" />
        </>
      )}
    </g>
  );
}

function Flower({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <g>
      <line x1={cx} y1={cy} x2={cx} y2={cy - 2.2} stroke="#2d5a3f" strokeWidth="0.4" strokeLinecap="round" />
      <circle cx={cx - 0.6} cy={cy - 2.4} r="0.5" fill={color} />
      <circle cx={cx + 0.6} cy={cy - 2.4} r="0.5" fill={color} />
      <circle cx={cx}       cy={cy - 3.0} r="0.5" fill={color} />
      <circle cx={cx - 0.6} cy={cy - 3.2} r="0.5" fill={color} />
      <circle cx={cx + 0.6} cy={cy - 3.2} r="0.5" fill={color} />
      <circle cx={cx}       cy={cy - 2.7} r="0.35" fill="#fbbf24" />
    </g>
  );
}
