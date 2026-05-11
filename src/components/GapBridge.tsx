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
            0%, 100% { transform: rotate(-9deg); }
            50%      { transform: rotate(9deg); }
          }
          @keyframes gb-seesaw      {
            0%, 100% { transform: rotate(-3.5deg); }
            50%      { transform: rotate(3.5deg); }
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
          /* Perspektivischer Ball — kleiner wenn hinten, größer wenn vorne */
          @keyframes gb-soccer-ball {
            0%   { transform: translate(70px, 138px)  scale(1.0); }
            10%  { transform: translate(30px, 130px)  scale(0.8); }
            18%  { transform: translate(30px, 130px)  scale(0.8); }
            28%  { transform: translate(135px, 100px) scale(0.55); }
            40%  { transform: translate(205px, 122px) scale(0.8); }
            52%  { transform: translate(258px, 138px) scale(1.0); }
            62%  { transform: translate(258px, 138px) scale(1.0); }
            72%  { transform: translate(180px, 118px) scale(0.75); }
            85%  { transform: translate(100px, 128px) scale(0.85); }
            100% { transform: translate(70px, 138px)  scale(1.0); }
          }
          /* Schwarzwald-Bähnle dampft durch die hinteren Hügel */
          @keyframes gb-train {
            0%   { transform: translate(-90px, 0); }
            100% { transform: translate(420px, 0); }
          }
          @keyframes gb-train-wheels { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } }
          @keyframes gb-steam {
            0%   { opacity: 0; transform: translate(0, 0) scale(0.4); }
            15%  { opacity: 0.95; }
            100% { opacity: 0; transform: translate(-6px, -22px) scale(2.2); }
          }
          @keyframes gb-passenger-wave {
            0%, 100% { transform: rotate(0); }
            50%      { transform: rotate(25deg); }
          }
          @keyframes gb-board-pulse {
            0%, 100% { opacity: 0.85; }
            50%      { opacity: 1; }
          }
          @keyframes gb-ball-spin   { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } }
          @keyframes gb-player-run  { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1px); } }
          @keyframes gb-keeper-jump {
            0%, 30%, 100% { transform: translate(0, 0); }
            45%, 60%      { transform: translate(-3px, -4px) rotate(-15deg); }
          }
          @keyframes gb-keeper-2 {
            0%, 60%, 100% { transform: translate(0, 0); }
            75%, 88%      { transform: translate(3px, -4px) rotate(15deg); }
          }
          @keyframes gb-cheer {
            0%, 30%, 100% { transform: translateY(0); }
            40%, 60%      { transform: translateY(-2px); }
          }
          @keyframes gb-kite-bob {
            0%, 100% { transform: translate(0, 0) rotate(-4deg); }
            25%      { transform: translate(2px, -3px) rotate(0deg); }
            50%      { transform: translate(4px, 0) rotate(5deg); }
            75%      { transform: translate(2px, -2px) rotate(2deg); }
          }
          @keyframes gb-tail-wave {
            0%, 100% { transform: rotate(-6deg); }
            50%      { transform: rotate(6deg); }
          }
          @keyframes gb-flag-wave {
            0%, 100% { transform: scaleX(1); }
            50%      { transform: scaleX(0.6); }
          }

          .gb-tree         { transform-origin: bottom center; animation: gb-tree-sway 4s infinite ease-in-out; }
          .gb-bush         { transform-origin: bottom center; animation: gb-bush-sway 5s infinite ease-in-out; }
          .gb-walk         { animation: gb-walk 60s infinite linear; }
          .gb-step         { animation: gb-step 0.55s infinite ease-in-out; }
          .gb-swing        { animation: gb-swing 2.6s infinite ease-in-out; }
          .gb-seesaw       { animation: gb-seesaw 3.2s infinite ease-in-out; }
          .gb-slide-kid    { animation: gb-slide-kid 6s infinite ease-in-out; }
          .gb-spring-rider { transform-origin: bottom center; animation: gb-spring-rider 1.6s infinite ease-in-out; }
          .gb-creek        { animation: gb-creek 3s infinite linear; }
          .gb-bird         { animation: gb-bird-glide 24s infinite linear; }
          .gb-firefly      { animation: gb-firefly 7s infinite ease-in-out; }
          .gb-ball         { animation: gb-ball-bounce 4s infinite ease-in-out; }
          .gb-soccer-ball  { animation: gb-soccer-ball 16s infinite cubic-bezier(.4,0,.6,1); }
          .gb-ball-spin    { animation: gb-ball-spin 1.4s infinite linear; transform-origin: center; }
          .gb-player-run   { animation: gb-player-run 0.4s infinite ease-in-out; }
          .gb-keeper-1     { transform-origin: bottom center; animation: gb-keeper-jump 16s infinite ease-in-out; }
          .gb-keeper-2     { transform-origin: bottom center; animation: gb-keeper-2 16s infinite ease-in-out; }
          .gb-cheer        { animation: gb-cheer 1s infinite ease-in-out; }
          .gb-kite         { transform-origin: 50% 0%; animation: gb-kite-bob 5s infinite ease-in-out; }
          .gb-tail         { transform-origin: top center; animation: gb-tail-wave 2.5s infinite ease-in-out; }
          .gb-flag         { transform-origin: left center; animation: gb-flag-wave 2.5s infinite ease-in-out; }
          .gb-train          { animation: gb-train 75s infinite linear; }
          .gb-train-wheels   { transform-origin: center; animation: gb-train-wheels 0.8s infinite linear; }
          .gb-steam          { animation: gb-steam 2.6s infinite ease-out; }
          .gb-passenger-wave { transform-origin: bottom center; animation: gb-passenger-wave 1.8s infinite ease-in-out; }
          .gb-board-pulse    { animation: gb-board-pulse 1.5s infinite ease-in-out; }

          @media (prefers-reduced-motion: reduce) {
            .gb-tree, .gb-bush, .gb-walk, .gb-step, .gb-swing, .gb-seesaw,
            .gb-slide-kid, .gb-spring-rider, .gb-creek, .gb-bird, .gb-firefly, .gb-ball,
            .gb-soccer-ball, .gb-ball-spin, .gb-player-run, .gb-keeper-1, .gb-keeper-2,
            .gb-cheer, .gb-kite, .gb-tail, .gb-flag,
            .gb-train, .gb-train-wheels, .gb-steam, .gb-passenger-wave, .gb-board-pulse {
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
      {/* ── HINTERSTE EBENE: Schwarzwald-Bähnle dampft durch die Hügel ──── */}
      <g className="gb-train">
        <Baehnle />
      </g>

      {/* ── HINTERGRUND: Isometrischer Fußballplatz mit laufendem Spiel ── */}
      <PerspectiveSoccerField />

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

      {/* ÜBERRASCHUNG OBEN: Schwarzwald-Drachen schwebt über dem Pfad,
          Schnur geht runter zu einem kleinen Drachenkind am Pfadrand */}
      <Drachen />

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
      {/* ── HINTERGRUND: Vereinshaus rahmt die Spielwiese ─────────────────── */}
      <Vereinshaus />

      {/* ── PERSPEKTIV-SPIELWIESE: Trapez-Bodenfläche (hinten schmal, vorn breit) ── */}
      {/* Sand/Kies-Belag, perspektivisch */}
      <polygon points="80,158 240,158 315,195 5,195" fill="#c8a16a" opacity="0.5" />
      <polygon points="85,160 235,160 305,193 15,193" fill="#d4b078" opacity="0.55" />
      {/* Streifenmuster im Boden für Tiefen-Hinweis */}
      <polygon points="80,158 240,158 250,170 70,170" fill="rgba(168,140,80,0.35)" />
      <polygon points="70,170 250,170 265,183 55,183" fill="rgba(200,170,110,0.3)" />
      <polygon points="55,183 265,183 305,193 15,193" fill="rgba(168,140,80,0.3)" />
      {/* Pfad-Andeutung vom Vereinshaus zum Spielbereich */}
      <polygon points="148,158 172,158 210,195 110,195" fill="rgba(140,110,70,0.4)" />

      {/* ── BACK-LAYER (klein, weiter weg) ─────────────────────────────────── */}
      {/* Klettergerüst — Holz-A-Frame mit Klettertau */}
      <g transform="translate(195, 170) scale(0.7)">
        {/* A-Frame Stützen */}
        <line x1="-12" y1="0" x2="-4" y2="-22" stroke="#5a3010" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="12"  y1="0" x2="4"  y2="-22" stroke="#5a3010" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="-10" y1="0" x2="-2" y2="-22" stroke="#5a3010" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="10"  y1="0" x2="2"  y2="-22" stroke="#5a3010" strokeWidth="1.6" strokeLinecap="round" />
        {/* Querbalken oben */}
        <rect x="-7" y="-24" width="14" height="2.5" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.4" rx="0.3" />
        {/* Klettertau hängt herab */}
        <path d="M 0 -22 Q -2 -14 1 -6 Q -1 0 0 4" stroke="#5a3010" strokeWidth="0.7" fill="none" />
        {/* Knoten im Tau */}
        <ellipse cx="-1" cy="-13" rx="0.9" ry="0.6" fill="#3a1808" />
        <ellipse cx="0.5" cy="-6" rx="0.9" ry="0.6" fill="#3a1808" />
        {/* Strickleiter rechts */}
        <line x1="3" y1="-22" x2="6" y2="0" stroke="#3a1808" strokeWidth="0.5" />
        <line x1="5" y1="-22" x2="8" y2="0" stroke="#3a1808" strokeWidth="0.5" />
        {[-19, -15, -11, -7, -3].map((dy) => (
          <line key={dy} x1="3" y1={dy} x2="8" y2={dy + 0.6} stroke="#7c4a1a" strokeWidth="0.4" />
        ))}
      </g>

      {/* Picknicktisch in der Mitte-Back (scale 0.75) */}
      <g transform="translate(115, 173) scale(0.75)">
        {/* Schatten */}
        <ellipse cx="0" cy="2" rx="12" ry="1.2" fill="rgba(0,0,0,0.3)" />
        {/* Beine */}
        <line x1="-8" y1="0" x2="-6" y2="-3" stroke="#5a3010" strokeWidth="0.8" />
        <line x1="8"  y1="0" x2="6"  y2="-3" stroke="#5a3010" strokeWidth="0.8" />
        <line x1="-8" y1="0" x2="-10" y2="-3" stroke="#5a3010" strokeWidth="0.8" />
        <line x1="8"  y1="0" x2="10" y2="-3" stroke="#5a3010" strokeWidth="0.8" />
        {/* Tischplatte */}
        <ellipse cx="0" cy="-3" rx="11" ry="2.5" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.4" />
        <ellipse cx="0" cy="-3.5" rx="11" ry="2" fill="#a06530" />
        {/* Bretter-Andeutung auf der Tischplatte */}
        <line x1="-9" y1="-3.5" x2="9" y2="-3.5" stroke="#7c4a1a" strokeWidth="0.3" />
        <line x1="-8" y1="-3.1" x2="8" y2="-3.1" stroke="#7c4a1a" strokeWidth="0.3" />
        {/* Sonnenschirm */}
        <line x1="0" y1="-3.5" x2="0" y2="-15" stroke="#5a3010" strokeWidth="0.7" />
        <path d="M -8 -12 Q 0 -20 8 -12 Z" fill="#dc2626" stroke="#7c2d12" strokeWidth="0.4" />
        <path d="M -8 -12 Q 0 -16 8 -12" fill="rgba(255,255,255,0.2)" />
        <line x1="-5" y1="-13.2" x2="-5" y2="-12" stroke="#7c2d12" strokeWidth="0.3" />
        <line x1="0" y1="-15" x2="0" y2="-12" stroke="#7c2d12" strokeWidth="0.3" />
        <line x1="5" y1="-13.2" x2="5" y2="-12" stroke="#7c2d12" strokeWidth="0.3" />
        <circle cx="0" cy="-15" r="0.4" fill="#fbbf24" />
        {/* 2 Bierkrüge auf dem Tisch */}
        <rect x="-4" y="-5" width="1.8" height="2" fill="#a06530" stroke="#5a3010" strokeWidth="0.2" rx="0.2" />
        <ellipse cx="-3.1" cy="-5" rx="0.9" ry="0.3" fill="#fef3c7" />
        <rect x="2" y="-5" width="1.8" height="2" fill="#a06530" stroke="#5a3010" strokeWidth="0.2" rx="0.2" />
        <ellipse cx="2.9" cy="-5" rx="0.9" ry="0.3" fill="#fef3c7" />
      </g>

      {/* Eltern-Bank — ZURÜCK in den Mittel-Layer (scale 0.85) */}
      <g transform="translate(258, 175) scale(0.85)">
        <ellipse cx="0" cy="0" rx="10" ry="0.8" fill="rgba(0,0,0,0.3)" />
        <rect x="-6" y="-3" width="1.2" height="3" fill="#5a3010" />
        <rect x="4.8" y="-3" width="1.2" height="3" fill="#5a3010" />
        <rect x="-7" y="-4.5" width="14" height="1.5" fill="#7c4a1a" rx="0.4" />
        <rect x="-6.5" y="-6.5" width="13" height="0.7" fill="#5a3010" />
        {/* 2 Latten im Rücken */}
        <rect x="-6.5" y="-9" width="13" height="0.7" fill="#5a3010" />
        <rect x="-6.5" y="-11.5" width="13" height="0.7" fill="#5a3010" />
        {/* Sitzender Vater mit Kind */}
        <g transform="translate(-2, -4.5)">
          <rect x="-1.5" y="-3" width="3" height="3" fill="#3b82f6" rx="0.4" />
          <circle cx="0" cy="-4.5" r="1.5" fill="#ffd5aa" />
          <path d="M-1.5 -5.4 Q0 -6.4 1.5 -5.4 L 1.5 -5 L -1.5 -5 Z" fill="#7c4a1a" />
          <circle cx="-0.4" cy="-4.5" r="0.18" fill="#1a0e05" />
          <circle cx="0.4"  cy="-4.5" r="0.18" fill="#1a0e05" />
          <path d="M-0.4 -3.9 Q0 -3.7 0.4 -3.9" stroke="#3a1808" strokeWidth="0.22" fill="none" />
        </g>
        {/* Mini-Kind rechts auf der Bank */}
        <g transform="translate(3.5, -4.5)">
          <rect x="-1" y="-2.2" width="2" height="2.2" fill="#ec4899" rx="0.3" />
          <circle cx="0" cy="-3.6" r="1.1" fill="#ffd5aa" />
          <path d="M-1.1 -4.3 Q0 -5.1 1.1 -4.3 L 1.1 -4 L -1.1 -4 Z" fill="#fbbf24" />
          <circle cx="-0.3" cy="-3.6" r="0.15" fill="#1a0e05" />
          <circle cx="0.3"  cy="-3.6" r="0.15" fill="#1a0e05" />
        </g>
      </g>

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
        {/* Schaukel-Seile + Sitz + Kind — Drehpunkt am Querbalken.
            CSS transform-origin auf SVG-<g> nutzt SVG-Wurzel-Koords:
            Schaukel-Wrapper translate(135,193), Ropes hängen bei lokal y=-30
            → Wurzel-Koord (135, 163) */}
        <g className="gb-swing" style={{ transformOrigin: '135px 163px' }}>
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
        {/* Planke + 2 Kinder — Drehpunkt an der Dreieck-Spitze.
            Wippe-Wrapper translate(265,193), Apex bei lokal y=-9
            → Wurzel-Koord (265, 184) */}
        <g className="gb-seesaw" style={{ transformOrigin: '265px 184px' }}>
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
        {/* Pferd-Korpus — Drehpunkt an der Feder-Oberseite (Wurzel-Koords) */}
        <g className="gb-spring-rider" style={{ transformOrigin: '85px 186px' }}>
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

// ════════════════════════════════════════════════════════════════════════
// ISOMETRISCHER FUSSBALLPLATZ — perspektivisch, im Forest-Gap zwischen
// Holzfäller und Sauna. Trapez-Feld: hinten schmal, vorn breit.
// Geometrie:
//   far-left  = (85, 98)    far-right  = (235, 98)
//   near-left = (20, 158)   near-right = (300, 158)
// Spieler skaliert mit Tiefe (hinten klein, vorn groß).
// ════════════════════════════════════════════════════════════════════════
function PerspectiveSoccerField() {
  // Feld-Trapez Ecken (bilineares Koordinatensystem)
  //   far-left  (85, 98)    far-right  (235, 98)
  //   near-left (20, 158)   near-right (300, 158)
  // Linien werden mit der Hilfsfunktion bilin(u,v) gezeichnet:
  //   u = 0…1 entlang der Längsachse (links→rechts)
  //   v = 0…1 entlang der Breite (oben→unten)
  // bilin(u,v) → { x: 85 + (-65)v + (150+130v)u, y: 98 + 60v }
  return (
    <g>
      {/* Sanfter Bodenschatten unter dem Feld */}
      <polygon points="20,159 300,159 247,99 88,99" fill="rgba(0,0,0,0.22)" />

      {/* Mähstreifen — 5 perspektivische Trapeze, abwechselnd dunkler/heller */}
      <polygon points="85,98 235,98 247.5,108 72.5,108" fill="#2d6240" />
      <polygon points="72.5,108 247.5,108 261.25,123 58.75,123" fill="#4a8a5a" opacity="0.85" />
      <polygon points="58.75,123 261.25,123 274,138 46,138" fill="#326c44" />
      <polygon points="46,138 274,138 287.5,153 32.5,153" fill="#4a8a5a" opacity="0.85" />
      <polygon points="32.5,153 287.5,153 300,158 20,158" fill="#326c44" />

      {/* Außenlinie */}
      <polygon points="85,98 235,98 300,158 20,158" fill="none" stroke="#fff" strokeWidth="0.7" opacity="0.95" />

      {/* Mittellinie — vertikal zwischen far-mid und near-mid (beide bei x=160) */}
      <line x1="160" y1="98" x2="160" y2="158" stroke="#fff" strokeWidth="0.7" opacity="0.95" />

      {/* Mittelkreis als perspektivisches Oval (gestaucht, mit gewölbten Linien) */}
      <ellipse cx="160" cy="128" rx="22" ry="7.5" fill="none" stroke="#fff" strokeWidth="0.7" opacity="0.95" />
      <circle cx="160" cy="128" r="1" fill="#fff" />

      {/* Strafraum LINKS — exakte bilineare Trapez-Ecken
          Goal-line-corners: u=0, v∈[0.164, 0.836]
          Innen-Field-corners: u=0.165, v∈[0.164, 0.836] */}
      <polygon
        points="74.3,107.8 102.6,107.8 73.3,148.2 30.7,148.2"
        fill="none" stroke="#fff" strokeWidth="0.55" opacity="0.9"
      />

      {/* Strafraum RECHTS — gespiegelt: u=0.835 bis u=1 */}
      <polygon
        points="245.7,107.8 217.4,107.8 246.7,148.2 289.3,148.2"
        fill="none" stroke="#fff" strokeWidth="0.55" opacity="0.9"
      />

      {/* Torraum LINKS (Goal box, 5.5m × 18m) — kleinere konzentrische Form */}
      <polygon
        points="64.8,117.1 75.4,117.1 53.8,138.9 40.7,138.9"
        fill="none" stroke="#fff" strokeWidth="0.4" opacity="0.85"
      />
      {/* Torraum RECHTS */}
      <polygon
        points="255.2,117.1 244.6,117.1 266.2,138.9 279.3,138.9"
        fill="none" stroke="#fff" strokeWidth="0.4" opacity="0.85"
      />

      {/* Elfmeter-Punkte — 11m von Tor entfernt, in der Mitte des Strafraums */}
      <circle cx="76" cy="128" r="0.8" fill="#fff" />
      <circle cx="244" cy="128" r="0.8" fill="#fff" />

      {/* ════════ TOR LINKS ════════
          Vorderpfosten sind an den Trapez-Ecken (85,98) und (20,158).
          Höhe perspektivisch: hinten klein (9), vorne groß (18).
          Goal extends LEFT of the field edge (out of play). */}
      <g>
        {/* Netz-Hintergrund — Polygon das die Goal-Tiefe füllt
            Front: Pfosten-Linie der Außenkante (85,98)→(20,158)
            Back: 12-15px nach LINKS versetzt (perspektivisch) */}
        <polygon
          points="85,89 73,92 5,144 20,140"
          fill="rgba(255,255,255,0.08)"
        />
        <polygon
          points="85,89 73,92 73,103 85,98"
          fill="rgba(255,255,255,0.18)"
        />
        <polygon
          points="20,140 5,144 5,162 20,158"
          fill="rgba(255,255,255,0.2)"
        />
        <polygon
          points="73,92 5,144 5,162 73,103"
          fill="rgba(255,255,255,0.1)"
        />

        {/* Netz-Mesh: feine vertikale Linien hinten + diagonale Querstrebe */}
        <line x1="64" y1="93" x2="64" y2="105" stroke="#fff" strokeWidth="0.2" opacity="0.45" />
        <line x1="50" y1="98" x2="50" y2="112" stroke="#fff" strokeWidth="0.2" opacity="0.45" />
        <line x1="35" y1="115" x2="35" y2="135" stroke="#fff" strokeWidth="0.2" opacity="0.45" />
        <line x1="20" y1="142" x2="20" y2="158" stroke="#fff" strokeWidth="0.2" opacity="0.45" />
        {/* Horizontale Mesh-Linien */}
        <line x1="73" y1="98" x2="5" y2="153" stroke="#fff" strokeWidth="0.2" opacity="0.35" />

        {/* Hintere Tor-Pfosten */}
        <line x1="73" y1="92" x2="73" y2="103" stroke="#fff" strokeWidth="0.4" opacity="0.7" />
        <line x1="5"  y1="144" x2="5" y2="162" stroke="#fff" strokeWidth="0.5" opacity="0.75" />
        {/* Hintere obere Verbindung */}
        <line x1="73" y1="92" x2="5" y2="144" stroke="#fff" strokeWidth="0.4" opacity="0.7" />
        {/* Hintere untere Verbindung (Bodenlinie des Netzes) */}
        <line x1="73" y1="103" x2="5" y2="162" stroke="#fff" strokeWidth="0.4" opacity="0.7" />

        {/* Vordere obere Pfosten + Querbalken (kräftiger weiß) */}
        <line x1="85" y1="98" x2="85" y2="89" stroke="#ffffff" strokeWidth="0.9" />
        <line x1="20" y1="158" x2="20" y2="140" stroke="#ffffff" strokeWidth="1.2" />
        <line x1="85" y1="89" x2="20" y2="140" stroke="#ffffff" strokeWidth="0.9" />

        {/* Verbinder Front → Back (Goal-Tiefe-Linien) */}
        <line x1="85" y1="89" x2="73" y2="92" stroke="#fff" strokeWidth="0.5" opacity="0.85" />
        <line x1="20" y1="140" x2="5" y2="144" stroke="#fff" strokeWidth="0.55" opacity="0.85" />
      </g>

      {/* ════════ TOR RECHTS ════════ — symmetrisch gespiegelt */}
      <g>
        <polygon points="235,89 247,92 315,144 300,140" fill="rgba(255,255,255,0.08)" />
        <polygon points="235,89 247,92 247,103 235,98" fill="rgba(255,255,255,0.18)" />
        <polygon points="300,140 315,144 315,162 300,158" fill="rgba(255,255,255,0.2)" />
        <polygon points="247,92 315,144 315,162 247,103" fill="rgba(255,255,255,0.1)" />

        <line x1="256" y1="93" x2="256" y2="105" stroke="#fff" strokeWidth="0.2" opacity="0.45" />
        <line x1="270" y1="98" x2="270" y2="112" stroke="#fff" strokeWidth="0.2" opacity="0.45" />
        <line x1="285" y1="115" x2="285" y2="135" stroke="#fff" strokeWidth="0.2" opacity="0.45" />
        <line x1="300" y1="142" x2="300" y2="158" stroke="#fff" strokeWidth="0.2" opacity="0.45" />
        <line x1="247" y1="98" x2="315" y2="153" stroke="#fff" strokeWidth="0.2" opacity="0.35" />

        <line x1="247" y1="92" x2="247" y2="103" stroke="#fff" strokeWidth="0.4" opacity="0.7" />
        <line x1="315" y1="144" x2="315" y2="162" stroke="#fff" strokeWidth="0.5" opacity="0.75" />
        <line x1="247" y1="92" x2="315" y2="144" stroke="#fff" strokeWidth="0.4" opacity="0.7" />
        <line x1="247" y1="103" x2="315" y2="162" stroke="#fff" strokeWidth="0.4" opacity="0.7" />

        <line x1="235" y1="98" x2="235" y2="89" stroke="#ffffff" strokeWidth="0.9" />
        <line x1="300" y1="158" x2="300" y2="140" stroke="#ffffff" strokeWidth="1.2" />
        <line x1="235" y1="89" x2="300" y2="140" stroke="#ffffff" strokeWidth="0.9" />

        <line x1="235" y1="89" x2="247" y2="92" stroke="#fff" strokeWidth="0.5" opacity="0.85" />
        <line x1="300" y1="140" x2="315" y2="144" stroke="#fff" strokeWidth="0.55" opacity="0.85" />
      </g>

      {/* Vier Eck-Fähnchen an den Trapez-Ecken */}
      {[
        { x: 85,  y: 98,  i: 0 },
        { x: 235, y: 98,  i: 1 },
        { x: 20,  y: 158, i: 2 },
        { x: 300, y: 158, i: 3 },
      ].map((c) => (
        <g key={c.i}>
          <line x1={c.x} y1={c.y - 4.5} x2={c.x} y2={c.y} stroke="#1a1a1a" strokeWidth="0.4" />
          <g className="gb-flag" style={{ transformOrigin: `${c.x}px ${c.y - 4.5}px`, animationDelay: `${-c.i * 0.5}s` }}>
            <polygon
              points={`${c.x},${c.y - 4.5} ${c.x + 2.4},${c.y - 3.7} ${c.x},${c.y - 2.9}`}
              fill="#fbbf24"
              stroke="#92400e"
              strokeWidth="0.15"
            />
          </g>
        </g>
      ))}

      {/* Anzeigetafel — schwebt über dem Feld auf Pfahl */}
      <g transform="translate(160, 80)">
        {/* Pfahl */}
        <line x1="0" y1="9" x2="0" y2="16" stroke="#3a3a3a" strokeWidth="0.5" />
        <line x1="-13" y1="9" x2="13" y2="9" stroke="#3a3a3a" strokeWidth="0.4" />
        {/* Anzeigetafel */}
        <rect x="-15" y="-6" width="30" height="14" fill="#1a1a1a" stroke="#5a5a5a" strokeWidth="0.4" rx="0.6" />
        <rect x="-14" y="-5" width="28" height="3" fill="#0a0a0a" />
        <text x="-9" y="-2.4" fontSize="2.4" fontWeight="700" fill="#dc2626" fontFamily="Inter, sans-serif">ROT</text>
        <text x="9"  y="-2.4" fontSize="2.4" fontWeight="700" fill="#3b82f6" fontFamily="Inter, sans-serif" textAnchor="middle">BLAU</text>
        <g className="gb-board-pulse">
          <text x="-9" y="3.2" fontSize="4.5" fontWeight="800" fill="#22c55e" fontFamily="Inter, sans-serif" textAnchor="middle">2</text>
          <text x="0"  y="3.2" fontSize="4" fontWeight="700" fill="#fbbf24" fontFamily="Inter, sans-serif" textAnchor="middle">:</text>
          <text x="9"  y="3.2" fontSize="4.5" fontWeight="800" fill="#22c55e" fontFamily="Inter, sans-serif" textAnchor="middle">1</text>
        </g>
        <text x="0" y="6.8" fontSize="1.5" fontWeight="800" fill="#fbbf24" fontFamily="Inter, sans-serif" textAnchor="middle">SAUNA CUP</text>
      </g>

      {/* ── SPIELER mit Tiefen-Skalierung ──────────────────────────────── */}
      {/* HINTEN (klein, scale 0.55) — nah an far-Linie */}
      <g transform="translate(125, 110) scale(0.55)" className="gb-player-run" style={{ animationDelay: '-0.1s' }}>
        <SoccerPlayer color="#dc2626" />
      </g>
      <g transform="translate(195, 110) scale(0.55)" className="gb-player-run" style={{ animationDelay: '-0.3s' }}>
        <SoccerPlayer color="#1d4ed8" />
      </g>

      {/* MITTE (scale 0.78) */}
      <g transform="translate(105, 128) scale(0.78)" className="gb-player-run" style={{ animationDelay: '-0.05s' }}>
        <SoccerPlayer color="#dc2626" />
      </g>
      <g transform="translate(160, 128) scale(0.78)" className="gb-player-run" style={{ animationDelay: '-0.15s' }}>
        <Referee />
      </g>
      <g transform="translate(225, 132) scale(0.82)" className="gb-player-run" style={{ animationDelay: '-0.3s' }}>
        <SoccerPlayer color="#1d4ed8" kicking />
      </g>

      {/* VORNE (groß, scale 1.05) */}
      <g transform="translate(70, 150) scale(1.05)" className="gb-player-run" style={{ animationDelay: '-0.2s' }}>
        <SoccerPlayer color="#dc2626" />
      </g>
      <g transform="translate(255, 152) scale(1.05)" className="gb-player-run" style={{ animationDelay: '-0.25s' }}>
        <SoccerPlayer color="#1d4ed8" />
      </g>

      {/* TORHÜTER — in den Tor-Mündern an der jeweiligen Seitenlinie */}
      <g transform="translate(45, 130) scale(0.7)" className="gb-keeper-1">
        <SoccerPlayer color="#dc2626" keeper />
      </g>
      <g transform="translate(275, 130) scale(0.7)" className="gb-keeper-2">
        <SoccerPlayer color="#1d4ed8" keeper />
      </g>

      {/* BALL — fliegt perspektivisch, kleiner wenn hinten */}
      <g className="gb-soccer-ball">
        <g className="gb-ball-spin">
          <circle cx="0" cy="0" r="1.4" fill="#fff" stroke="#1a1a1a" strokeWidth="0.3" />
          <polygon points="0,-1.4 0.8,-0.4 0.5,0.6 -0.5,0.6 -0.8,-0.4" fill="#1a1a1a" />
          <polygon points="0,-1.4 0.4,-0.6 -0.4,-0.6" fill="#fff" />
        </g>
      </g>

      {/* Zuschauer-Tribüne hinter dem Feld (oben, schmal — perspektivisch entfernt) */}
      <g transform="translate(160, 93)">
        <rect x="-32" y="-2" width="64" height="2.5" fill="#5a3010" />
        <rect x="-32" y="-3.4" width="64" height="1.4" fill="#7c4a1a" />
        {/* Tiny fans als Punkte */}
        {[-25, -18, -11, -4, 3, 10, 17, 24].map((dx, i) => (
          <g key={`fan-${i}`} className="gb-cheer" style={{ animationDelay: `${-i * 0.18}s` }}>
            <circle cx={dx} cy="-4.5" r="0.7" fill="#ffd5aa" />
            <rect x={dx - 0.55} y="-4" width="1.1" height="1.2" fill={['#fbbf24','#a78bfa','#22c55e','#ec4899','#3b82f6','#dc2626','#f97316','#fde047'][i]} rx="0.1" />
          </g>
        ))}
      </g>

      {/* Zaun zwischen Spielfeld und Pfad davor */}
      <g>
        <line x1="20" y1="160" x2="300" y2="160" stroke="#5a5a62" strokeWidth="0.4" opacity="0.7" />
        {[40, 80, 120, 160, 200, 240, 280].map((zx) => (
          <line key={zx} x1={zx} y1="160" x2={zx} y2="164" stroke="#5a5a62" strokeWidth="0.3" opacity="0.7" />
        ))}
        <line x1="20" y1="162" x2="300" y2="162" stroke="#5a5a62" strokeWidth="0.3" opacity="0.6" />
      </g>
    </g>
  );
}

// Schiedsrichter (gelb-schwarz) — Wrapper um SoccerPlayer-Body
function Referee() {
  return (
    <g>
      <ellipse cx="0" cy="1" rx="1.5" ry="0.4" fill="rgba(0,0,0,0.4)" />
      <line x1="-0.6" y1="-0.5" x2="-0.6" y2="1" stroke="#1a1a1a" strokeWidth="0.7" />
      <line x1="0.6"  y1="-0.5" x2="0.6"  y2="1" stroke="#1a1a1a" strokeWidth="0.7" />
      <ellipse cx="-0.7" cy="1.1" rx="0.6" ry="0.25" fill="#1a0e05" />
      <ellipse cx="0.7"  cy="1.1" rx="0.6" ry="0.25" fill="#1a0e05" />
      <rect x="-1.4" y="-3.5" width="2.8" height="3" fill="#fbbf24" rx="0.3" />
      <rect x="-1.4" y="-2.8" width="2.8" height="0.5" fill="#1a1a1a" />
      <rect x="-1.4" y="-1.6" width="2.8" height="0.4" fill="#1a1a1a" />
      <line x1="-1.5" y1="-3" x2="-2.5" y2="-1" stroke="#fbbf24" strokeWidth="0.7" strokeLinecap="round" />
      <line x1="1.5"  y1="-3" x2="2.5"  y2="-1" stroke="#fbbf24" strokeWidth="0.7" strokeLinecap="round" />
      <circle cx="0" cy="-5" r="1.2" fill="#ffd5aa" />
      <path d="M-1.2 -5.7 Q0 -6.5 1.2 -5.7 L 1.2 -5.3 L -1.2 -5.3 Z" fill="#1a1a1a" />
      <ellipse cx="2.2" cy="-1.5" rx="0.4" ry="0.3" fill="#1a1a1a" />
    </g>
  );
}

// ════════════════════════════════════════════════════════════════════════
// SCHWARZWALD-BÄHNLE — Dampflok mit 2 Wagons zieht durch die Hügel
// ════════════════════════════════════════════════════════════════════════
function Baehnle() {
  // Zug-Layout (alles in Lokalkoords, y=0 ist die Schienen-Höhe):
  //   Lok          translate(50, 0)   inner -7…14 → abs 43…64   (Lok 21 wide)
  //   Wagon 1 grün translate(26, 0)   inner 0…14  → abs 26…40   (gap 3 zu Lok)
  //   Wagon 2 orng translate(8,  0)   inner 0…14  → abs 8…22    (gap 4)
  //   Wagon 3 blau translate(-12, 0)  inner 0…14  → abs -12…2   (gap 6)
  //   Gesamt-Span: -12 bis 64 = 76 Einheiten
  const wagon = (x: number, body: string, head: string, windowFill: string[],
                 hatColors: string[], waveIndex: number | null, delay: string) => (
    <g transform={`translate(${x}, 0)`}>
      {/* Korpus */}
      <rect x="0" y="3" width="14" height="8" fill={body} stroke={head} strokeWidth="0.4" rx="0.3" />
      <rect x="0" y="3" width="14" height="1.4" fill={head} />
      {/* Dach-Glanz */}
      <rect x="0.6" y="3.3" width="12.8" height="0.4" fill="rgba(255,255,255,0.2)" />
      {/* 3 Fenster mit Mini-Passagieren */}
      {[2, 6.25, 10.5].map((wx, i) => (
        <g key={`win-${i}`}>
          <rect x={wx} y="4.5" width="2.4" height="2.6" fill={windowFill[i]} opacity="0.95" />
          <line x1={wx + 1.2} y1="4.5" x2={wx + 1.2} y2="7.1" stroke={head} strokeWidth="0.2" />
          <circle cx={wx + 1.2} cy="6" r="0.7" fill="#ffd5aa" />
          <rect x={wx + 0.55} y="6.4" width="1.3" height="0.6" fill={hatColors[i]} rx="0.1" />
        </g>
      ))}
      {/* Mini-Winker im jeweils ausgewählten Fenster */}
      {waveIndex !== null && (
        <g
          className="gb-passenger-wave"
          style={{
            transformOrigin: `${[3.2, 7.45, 11.7][waveIndex]}px 6px`,
            animationDelay: delay,
          }}
        >
          <line
            x1={[3.2, 7.45, 11.7][waveIndex]}
            y1="5.8"
            x2={[3.2, 7.45, 11.7][waveIndex] + 1.1}
            y2="4.2"
            stroke="#ffd5aa"
            strokeWidth="0.4"
            strokeLinecap="round"
          />
        </g>
      )}
      {/* Räder */}
      <g className="gb-train-wheels" style={{ transformOrigin: '3px 12px', animationDelay: delay }}>
        <circle cx="3" cy="12" r="1.9" fill="#1a1a1a" stroke="#3a3a3a" strokeWidth="0.3" />
        <line x1="1.2" y1="12" x2="4.8" y2="12" stroke="#7a7a7a" strokeWidth="0.3" />
        <line x1="3" y1="10.2" x2="3" y2="13.8" stroke="#7a7a7a" strokeWidth="0.3" />
      </g>
      <g className="gb-train-wheels" style={{ transformOrigin: '11px 12px', animationDelay: '-0.4s' }}>
        <circle cx="11" cy="12" r="1.9" fill="#1a1a1a" stroke="#3a3a3a" strokeWidth="0.3" />
        <line x1="9.2" y1="12" x2="12.8" y2="12" stroke="#7a7a7a" strokeWidth="0.3" />
        <line x1="11" y1="10.2" x2="11" y2="13.8" stroke="#7a7a7a" strokeWidth="0.3" />
      </g>
    </g>
  );

  return (
    <g transform="translate(0, 60)">
      {/* Schienen-Andeutung als feine Linie quer durch */}
      <rect x="-15" y="14" width="80" height="0.6" fill="#5a5a62" opacity="0.7" />
      <rect x="-15" y="14.6" width="80" height="0.3" fill="#3a3a42" opacity="0.6" />
      {/* Schwellen */}
      {[-12, -7, -2, 3, 8, 13, 18, 23, 28, 33, 38, 43, 48, 53, 58, 63].map((sx) => (
        <rect key={sx} x={sx} y="14.6" width="3" height="0.9" fill="#5a3010" opacity="0.55" />
      ))}

      {/* Rauchwolken aus dem Lok-Schornstein (Lok ist bei x=50, Schornstein bei +7 = x=57) */}
      <g className="gb-steam" style={{ animationDelay: '0s' }}>
        <circle cx="57" cy="-2" r="2" fill="rgba(225,225,225,0.85)" />
      </g>
      <g className="gb-steam" style={{ animationDelay: '-0.85s' }}>
        <circle cx="57" cy="-2" r="2.6" fill="rgba(215,215,215,0.75)" />
      </g>
      <g className="gb-steam" style={{ animationDelay: '-1.75s' }}>
        <circle cx="57" cy="-2" r="2.3" fill="rgba(220,220,220,0.7)" />
      </g>

      {/* ── LOK (rot, Schwarzwaldbahn-Stil) — vorne rechts ─────────────── */}
      <g transform="translate(50, 0)">
        {/* Hauptkessel */}
        <rect x="0" y="3.5" width="14" height="7.5" fill="#a01818" stroke="#5a0808" strokeWidth="0.4" rx="0.5" />
        <rect x="0" y="3.5" width="14" height="1.6" fill="#dc2626" />
        <rect x="0.4" y="3.7" width="13.2" height="0.4" fill="rgba(255,255,255,0.25)" />
        {/* Kessel-Bänder */}
        <line x1="0" y1="6" x2="14" y2="6" stroke="#5a0808" strokeWidth="0.3" />
        <line x1="0" y1="9" x2="14" y2="9" stroke="#5a0808" strokeWidth="0.3" />
        {/* Schornstein */}
        <rect x="6" y="-1" width="3" height="4.5" fill="#1a1a1a" />
        <rect x="5.5" y="-1.5" width="4" height="0.8" fill="#3a3a3a" />
        {/* Glocken-Hütchen oben am Kessel */}
        <ellipse cx="2" cy="3.4" rx="1.2" ry="0.6" fill="#fbbf24" stroke="#7c2d12" strokeWidth="0.2" />
        {/* Führerstand */}
        <rect x="-7" y="1.5" width="7" height="9.5" fill="#5a0808" stroke="#3a0404" strokeWidth="0.4" />
        <rect x="-6.2" y="3" width="5.4" height="3.2" fill="#fef3c7" opacity="0.9" />
        <line x1="-3.5" y1="3" x2="-3.5" y2="6.2" stroke="#3a0404" strokeWidth="0.3" />
        <line x1="-6.2" y1="4.5" x2="-0.8" y2="4.5" stroke="#3a0404" strokeWidth="0.2" />
        {/* Lokführer im Cockpit */}
        <circle cx="-3" cy="5.2" r="0.7" fill="#ffd5aa" />
        <rect x="-3.5" y="5.7" width="1" height="0.5" fill="#1d4ed8" rx="0.1" />
        {/* Dach */}
        <rect x="-7.5" y="0.8" width="8" height="1.2" fill="#1a1a1a" rx="0.2" />
        {/* Lichter vorne */}
        <circle cx="14.3" cy="6.5" r="1" fill="#fef3c7" />
        <circle cx="14.3" cy="6.5" r="0.5" fill="#fbbf24" />
        {/* Stoßstange */}
        <rect x="13.5" y="9.5" width="1.5" height="2" fill="#3a3a3a" rx="0.2" />
        {/* Räder mit Speichen (große Antriebsräder) */}
        <g className="gb-train-wheels" style={{ transformOrigin: '2.5px 12px' }}>
          <circle cx="2.5" cy="12" r="2.2" fill="#1a1a1a" stroke="#3a3a3a" strokeWidth="0.3" />
          <line x1="0.3" y1="12" x2="4.7" y2="12" stroke="#7a7a7a" strokeWidth="0.3" />
          <line x1="2.5" y1="9.8" x2="2.5" y2="14.2" stroke="#7a7a7a" strokeWidth="0.3" />
          <line x1="1.05" y1="10.5" x2="3.95" y2="13.5" stroke="#5a5a5a" strokeWidth="0.25" />
        </g>
        <g className="gb-train-wheels" style={{ transformOrigin: '11px 12px', animationDelay: '-0.2s' }}>
          <circle cx="11" cy="12" r="2.2" fill="#1a1a1a" stroke="#3a3a3a" strokeWidth="0.3" />
          <line x1="8.8" y1="12" x2="13.2" y2="12" stroke="#7a7a7a" strokeWidth="0.3" />
          <line x1="11" y1="9.8" x2="11" y2="14.2" stroke="#7a7a7a" strokeWidth="0.3" />
          <line x1="9.55" y1="10.5" x2="12.45" y2="13.5" stroke="#5a5a5a" strokeWidth="0.25" />
        </g>
        {/* Lok-Schatten unter Räder */}
        <ellipse cx="6" cy="14.3" rx="9" ry="0.4" fill="rgba(0,0,0,0.35)" />
      </g>

      {/* Kupplung Lok ↔ Wagon 1 */}
      <line x1="40" y1="11.5" x2="50" y2="11.5" stroke="#1a1a1a" strokeWidth="0.5" />

      {/* ── WAGON 1 (Saunafreunde-grün) ───────────────────────────────── */}
      {wagon(26, '#2d5a3f', '#1a3a25',
        ['#fef3c7', '#fef3c7', '#fef3c7'],
        ['#dc2626', '#a78bfa', '#fbbf24'],
        1, '-0.3s')}

      {/* Kupplung Wagon 1 ↔ Wagon 2 */}
      <line x1="22" y1="11.5" x2="26" y2="11.5" stroke="#1a1a1a" strokeWidth="0.5" />

      {/* ── WAGON 2 (Saunascaner-orange) ──────────────────────────────── */}
      {wagon(8, '#d97706', '#7c2d12',
        ['#fef3c7', '#fef3c7', '#fef3c7'],
        ['#3b82f6', '#22c55e', '#ec4899'],
        0, '-0.9s')}

      {/* Kupplung Wagon 2 ↔ Wagon 3 */}
      <line x1="2" y1="11.5" x2="8" y2="11.5" stroke="#1a1a1a" strokeWidth="0.5" />

      {/* ── WAGON 3 (Schwarzwald-blau) ────────────────────────────────── */}
      {wagon(-12, '#1d4ed8', '#1e3a8a',
        ['#fef3c7', '#fef3c7', '#fef3c7'],
        ['#fbbf24', '#dc2626', '#22c55e'],
        2, '-1.5s')}

      {/* Hinterer Puffer */}
      <rect x="-13.5" y="9.5" width="1.5" height="2" fill="#3a3a3a" rx="0.2" />

      {/* Zug-Gesamt-Schatten unter den Rädern */}
      <ellipse cx="25" cy="14.5" rx="44" ry="0.5" fill="rgba(0,0,0,0.25)" />
    </g>
  );
}

// ════════════════════════════════════════════════════════════════════════
// VEREINSHAUS — kleiner Schwarzwald-Pavillon hinter dem Spielplatz
// ════════════════════════════════════════════════════════════════════════
function Vereinshaus() {
  return (
    <g transform="translate(160, 158)">
      {/* Boden-Schatten */}
      <ellipse cx="0" cy="3" rx="55" ry="3" fill="rgba(0,0,0,0.25)" />

      {/* Dachüberstand hinten */}
      <polygon points="-52,-22 52,-22 50,-23 -50,-23" fill="#3a1808" />

      {/* Spitzdach */}
      <polygon points="-50,-23 50,-23 38,-42 -38,-42" fill="#5a0808" stroke="#3a0404" strokeWidth="0.5" />
      <polygon points="-50,-23 50,-23 0,-46" fill="#7c1818" />
      <line x1="-44" y1="-26" x2="44" y2="-26" stroke="rgba(0,0,0,0.45)" strokeWidth="0.4" />
      <line x1="-38" y1="-31" x2="38" y2="-31" stroke="rgba(0,0,0,0.45)" strokeWidth="0.4" />
      <line x1="-32" y1="-36" x2="32" y2="-36" stroke="rgba(0,0,0,0.45)" strokeWidth="0.4" />
      {/* Glanz-Streifen */}
      <polygon points="-50,-23 -22,-37 -28,-23" fill="rgba(255,255,255,0.07)" />

      {/* Korpus aus hellem Schwarzwald-Holz */}
      <rect x="-48" y="-22" width="96" height="24" fill="#c8a16a" stroke="#7c4a1a" strokeWidth="0.5" />
      {/* Holzlatten-Linien */}
      {[-14, -2, 10].map((y) => (
        <line key={y} x1="-48" y1={y} x2="48" y2={y} stroke="#7c4a1a" strokeWidth="0.3" opacity="0.6" />
      ))}

      {/* Kreuzbalken (Fachwerk) */}
      <line x1="-48" y1="-22" x2="-32" y2="2" stroke="#3a1808" strokeWidth="0.8" />
      <line x1="-32" y1="-22" x2="-48" y2="2" stroke="#3a1808" strokeWidth="0.8" />
      <line x1="32"  y1="-22" x2="48"  y2="2" stroke="#3a1808" strokeWidth="0.8" />
      <line x1="48"  y1="-22" x2="32"  y2="2" stroke="#3a1808" strokeWidth="0.8" />
      {/* Vertikale Balken */}
      <line x1="-32" y1="-22" x2="-32" y2="2" stroke="#3a1808" strokeWidth="0.6" />
      <line x1="32"  y1="-22" x2="32"  y2="2" stroke="#3a1808" strokeWidth="0.6" />
      <line x1="-48" y1="-22" x2="-48" y2="2" stroke="#3a1808" strokeWidth="0.6" />
      <line x1="48"  y1="-22" x2="48"  y2="2" stroke="#3a1808" strokeWidth="0.6" />

      {/* Fenster links + rechts (Sprossen + warm-orange Innenglow) */}
      <g>
        <rect x="-27" y="-18" width="14" height="11" fill="#fb923c" stroke="#3a1808" strokeWidth="0.5" rx="0.3" />
        <rect x="-27" y="-18" width="14" height="2.5" fill="rgba(0,0,0,0.4)" />
        <line x1="-20" y1="-18" x2="-20" y2="-7" stroke="#3a1808" strokeWidth="0.5" />
        <line x1="-27" y1="-12.5" x2="-13" y2="-12.5" stroke="#3a1808" strokeWidth="0.5" />
        {/* Sims */}
        <rect x="-28" y="-7" width="16" height="1.4" fill="#5a3010" rx="0.2" />
        {/* Blumenkasten */}
        <rect x="-27.5" y="-5.6" width="15" height="2.3" fill="#3a1808" />
        <circle cx="-24" cy="-6.4" r="0.7" fill="#dc2626" />
        <circle cx="-20" cy="-6.6" r="0.7" fill="#fbbf24" />
        <circle cx="-16" cy="-6.5" r="0.7" fill="#a78bfa" />
      </g>
      <g>
        <rect x="13" y="-18" width="14" height="11" fill="#fb923c" stroke="#3a1808" strokeWidth="0.5" rx="0.3" />
        <rect x="13" y="-18" width="14" height="2.5" fill="rgba(0,0,0,0.4)" />
        <line x1="20" y1="-18" x2="20" y2="-7" stroke="#3a1808" strokeWidth="0.5" />
        <line x1="13" y1="-12.5" x2="27" y2="-12.5" stroke="#3a1808" strokeWidth="0.5" />
        <rect x="12" y="-7" width="16" height="1.4" fill="#5a3010" rx="0.2" />
        <rect x="12.5" y="-5.6" width="15" height="2.3" fill="#3a1808" />
        <circle cx="16" cy="-6.4" r="0.7" fill="#ec4899" />
        <circle cx="20" cy="-6.6" r="0.7" fill="#fbbf24" />
        <circle cx="24" cy="-6.5" r="0.7" fill="#22c55e" />
      </g>

      {/* Tür mittig */}
      <rect x="-7" y="-15" width="14" height="17" fill="#5a3010" stroke="#3a1808" strokeWidth="0.5" rx="0.4" />
      <line x1="-3" y1="-15" x2="-3" y2="2" stroke="#3a1808" strokeWidth="0.3" />
      <line x1="3"  y1="-15" x2="3"  y2="2" stroke="#3a1808" strokeWidth="0.3" />
      <line x1="-7" y1="-7" x2="7" y2="-7" stroke="#3a1808" strokeWidth="0.4" />
      <circle cx="4.5" cy="-6" r="0.5" fill="#fbbf24" />
      {/* Bogen über Tür */}
      <path d="M -8 -15 Q 0 -19 8 -15" stroke="#3a1808" strokeWidth="0.6" fill="none" />

      {/* Holzschild „SAUNAFREUNDE VEREINSHAUS" über dem Dach */}
      <g transform="translate(0, -47)">
        <rect x="-26" y="-3" width="52" height="6" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.4" rx="0.5" />
        <rect x="-26" y="-3" width="52" height="1.6" fill="#a06530" />
        <text x="0" y="1.4" textAnchor="middle" fontSize="3.2" fontWeight="800" fill="#1a0e05" fontFamily="Inter, sans-serif" letterSpacing="0.2">SAUNAFREUNDE</text>
        {/* Halterungen */}
        <line x1="-15" y1="-3" x2="-15" y2="-5" stroke="#3a1808" strokeWidth="0.4" />
        <line x1="15"  y1="-3" x2="15"  y2="-5" stroke="#3a1808" strokeWidth="0.4" />
      </g>

      {/* Schornstein hinten links mit kleinem Rauchpuff */}
      <rect x="-30" y="-46" width="3.5" height="9" fill="#5a3010" stroke="#3a1808" strokeWidth="0.3" />
      <rect x="-30.5" y="-46" width="4.5" height="1.5" fill="#3a1808" rx="0.2" />
      <g className="gb-steam" style={{ animationDelay: '-1.2s' }}>
        <circle cx="-28" cy="-48" r="1.4" fill="rgba(220,220,220,0.7)" />
      </g>
    </g>
  );
}

function SoccerPlayer({ color, kicking = false, keeper = false }: { color: string; kicking?: boolean; keeper?: boolean }) {
  return (
    <g>
      {/* Schatten */}
      <ellipse cx="0" cy="1" rx="1.5" ry="0.4" fill="rgba(0,0,0,0.4)" />
      {/* Beine */}
      {kicking ? (
        <>
          <line x1="-0.6" y1="-0.5" x2="-0.6" y2="1" stroke="#1a1a1a" strokeWidth="0.7" />
          <line x1="0.4"  y1="-0.5" x2="1.8"  y2="-1.2" stroke="#1a1a1a" strokeWidth="0.7" strokeLinecap="round" />
        </>
      ) : (
        <>
          <line x1="-0.6" y1="-0.5" x2="-0.7" y2="1" stroke="#1a1a1a" strokeWidth="0.7" />
          <line x1="0.6"  y1="-0.5" x2="0.7"  y2="1" stroke="#1a1a1a" strokeWidth="0.7" />
        </>
      )}
      {/* Schuhe */}
      <ellipse cx="-0.7" cy="1.1" rx="0.6" ry="0.25" fill="#1a0e05" />
      <ellipse cx={kicking ? 1.8 : 0.7} cy={kicking ? -1.2 : 1.1} rx="0.6" ry="0.25" fill="#1a0e05" />
      {/* Trikot */}
      <rect x="-1.4" y="-3.5" width="2.8" height="3" fill={color} rx="0.3" />
      {/* Streifen */}
      <rect x="-1.4" y="-2.6" width="2.8" height="0.4" fill="rgba(255,255,255,0.7)" />
      {keeper && (
        <text x="0" y="-1.4" textAnchor="middle" fontSize="1.5" fontWeight="800" fill="#fff">1</text>
      )}
      {/* Arme */}
      <line x1="-1.5" y1="-3" x2={keeper ? -2.6 : -2.2} y2={keeper ? -4.2 : -2} stroke={color} strokeWidth="0.7" strokeLinecap="round" />
      <line x1="1.5"  y1="-3" x2={keeper ? 2.6 : 2.2} y2={keeper ? -4.2 : -2} stroke={color} strokeWidth="0.7" strokeLinecap="round" />
      {/* Kopf */}
      <circle cx="0" cy="-5" r="1.2" fill="#ffd5aa" />
      {/* Haare */}
      <path d="M-1.1 -5.7 Q0 -6.5 1.1 -5.7 L 1.1 -5.3 L -1.1 -5.3 Z" fill="#3a1808" />
      {/* Mini-Augen */}
      <circle cx="-0.3" cy="-5" r="0.12" fill="#1a0e05" />
      <circle cx="0.3"  cy="-5" r="0.12" fill="#1a0e05" />
    </g>
  );
}

// ════════════════════════════════════════════════════════════════════════
// SCHWARZWALD-DRACHEN — schwebt über dem Wald-Pfad,
// Schnur geht runter zu einem kleinen Drachenkind
// ════════════════════════════════════════════════════════════════════════
function Drachen() {
  return (
    <g>
      {/* Drachenkind am Pfadrand */}
      <g transform="translate(135, 193)">
        <ellipse cx="0" cy="0" rx="2.5" ry="0.6" fill="rgba(0,0,0,0.4)" />
        {/* Beine */}
        <line x1="-0.8" y1="-2" x2="-0.8" y2="0" stroke="#1e3a8a" strokeWidth="1" />
        <line x1="0.8"  y1="-2" x2="0.8"  y2="0" stroke="#1e3a8a" strokeWidth="1" />
        {/* Schuhe */}
        <ellipse cx="-0.8" cy="0" rx="0.8" ry="0.3" fill="#1a0e05" />
        <ellipse cx="0.8"  cy="0" rx="0.8" ry="0.3" fill="#1a0e05" />
        {/* Hose */}
        <rect x="-1.4" y="-4" width="2.8" height="2.2" fill="#1e3a8a" rx="0.3" />
        {/* Pulli */}
        <rect x="-1.8" y="-7" width="3.6" height="3.2" fill="#22c55e" rx="0.4" />
        <rect x="-1.8" y="-7" width="3.6" height="0.5" fill="#15803d" rx="0.4" />
        {/* Linker Arm (hält die Spule unten) */}
        <line x1="-1.6" y1="-6" x2="-2.6" y2="-3.5" stroke="#22c55e" strokeWidth="1" strokeLinecap="round" />
        {/* Rechter Arm hochgestreckt zum Drachen */}
        <line x1="1.6" y1="-6" x2="3" y2="-9" stroke="#22c55e" strokeWidth="1" strokeLinecap="round" />
        {/* Spule */}
        <rect x="-3.4" y="-4" width="1.6" height="1.2" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.2" />
        {/* Kopf */}
        <circle cx="0" cy="-9" r="1.6" fill="#ffd5aa" />
        {/* Haare blond */}
        <path d="M-1.5 -9.8 Q0 -11 1.5 -9.8 L 1.5 -9.2 L -1.5 -9.2 Z" fill="#fbbf24" />
        {/* Augen + Mund */}
        <circle cx="-0.5" cy="-9" r="0.18" fill="#1a0e05" />
        <circle cx="0.5"  cy="-9" r="0.18" fill="#1a0e05" />
        <path d="M-0.6 -8.4 Q0 -8 0.6 -8.4" stroke="#3a1808" strokeWidth="0.3" fill="none" strokeLinecap="round" />
      </g>

      {/* Drachenschnur — vom Kind hoch zum Drachen */}
      <path
        d="M 138 184 Q 155 110 175 75"
        stroke="#1a1a1a"
        strokeWidth="0.4"
        fill="none"
        opacity="0.7"
        strokeDasharray="0.5 0.6"
      />

      {/* Der eigentliche DRACHE — groß und bunt */}
      <g className="gb-kite" style={{ transformOrigin: '175px 60px' }}>
        <g transform="translate(175, 60)">
          {/* Diamant-Hauptkörper (4 farbige Felder) */}
          <polygon points="0,-25 18,0 0,25 -18,0" fill="#dc2626" stroke="#1a0808" strokeWidth="0.6" />
          {/* Vertikales Spann-Holz */}
          <line x1="0" y1="-25" x2="0" y2="25" stroke="#3a1808" strokeWidth="0.5" />
          {/* Horizontales Spann-Holz */}
          <line x1="-18" y1="0" x2="18" y2="0" stroke="#3a1808" strokeWidth="0.5" />
          {/* Farbige Quadranten überlagert */}
          <polygon points="0,-25 18,0 0,0" fill="#fbbf24" opacity="0.85" stroke="#1a0808" strokeWidth="0.3" />
          <polygon points="0,0 -18,0 0,25" fill="#22c55e" opacity="0.85" stroke="#1a0808" strokeWidth="0.3" />
          <polygon points="0,0 18,0 0,25" fill="#3b82f6" opacity="0.85" stroke="#1a0808" strokeWidth="0.3" />

          {/* Aufdruck SF in der Mitte */}
          <circle cx="0" cy="0" r="3" fill="#fff" stroke="#1a0808" strokeWidth="0.3" />
          <text x="0" y="1.4" textAnchor="middle" fontSize="3.5" fontWeight="800" fill="#2d5a3f" fontFamily="Inter, sans-serif">SF</text>

          {/* Glanzlicht */}
          <polygon points="-6,-15 -3,-12 0,-19" fill="rgba(255,255,255,0.3)" />

          {/* Schnur-Anknüpfung unten */}
          <line x1="0" y1="25" x2="0" y2="28" stroke="#1a0808" strokeWidth="0.4" />

          {/* Langer Regenbogen-Schweif mit Schleifen */}
          <g className="gb-tail">
            <path
              d="M 0 28 Q -8 38 -4 48 Q 4 58 -2 68 Q -10 78 -4 88"
              stroke="#1a0808"
              strokeWidth="0.3"
              fill="none"
            />
            {/* 7 Schleifen am Schweif (Regenbogen) */}
            {[
              { y: 32, color: '#dc2626' },
              { y: 40, color: '#f97316' },
              { y: 48, color: '#fbbf24' },
              { y: 56, color: '#22c55e' },
              { y: 64, color: '#3b82f6' },
              { y: 72, color: '#a78bfa' },
              { y: 80, color: '#ec4899' },
            ].map((b, i) => {
              const wave = i % 2 === 0 ? -1 : 1;
              const dx = wave * (3 + (i % 3));
              return (
                <g key={i}>
                  <ellipse cx={dx - 2.5} cy={b.y} rx="2" ry="1" fill={b.color} stroke="#1a0808" strokeWidth="0.2" />
                  <ellipse cx={dx + 2.5} cy={b.y} rx="2" ry="1" fill={b.color} stroke="#1a0808" strokeWidth="0.2" />
                  <circle cx={dx} cy={b.y} r="0.4" fill="#1a0808" />
                </g>
              );
            })}
          </g>
        </g>
      </g>
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
