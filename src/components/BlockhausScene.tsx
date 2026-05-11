import { useEffect, useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

const W = 460;
const H = 200;

// ──── BÄUME — bilden zusammen die hinterste Schicht (Z-Order-Regel) ────

// Drei Tiefen-Ebenen für realistische Wald-Perspektive

// Ebene 1: Horizont-Bäume (Silhouette, sehr dunst-blass)
const FAR_TREES = [
  { x: 75,  h: 36, delay: '-1.9s' },
  { x: 160, h: 38, delay: '-2.4s' },
  { x: 230, h: 34, delay: '-0.5s' },
  { x: 305, h: 36, delay: '-2.6s' },
  { x: 380, h: 38, delay: '-1.7s' },
];

// Ebene 2: Mittel-ferne Bäume
const BACK_TREES = [
  { x: 30,  h: 58, dimmer: true,  delay: '-0.4s' },
  { x: 122, h: 64, dimmer: false, delay: '-3.1s' },
  { x: 200, h: 78, dimmer: false, delay: '-3.6s' },
  { x: 332, h: 60, dimmer: true,  delay: '-2.0s' },
  { x: 410, h: 76, dimmer: false, delay: '-1.6s' },
];

// Ebene 3: Vordere Baumkulisse (rahmt die Szene links + rechts)
const MID_TREES = [
  { x: 6,   h: 70, delay: '-2.8s' },
  { x: 448, h: 80, delay: '-0.6s' },
];

const CLOUDS = [
  { cx: 60,  cy: 18, w: 22, delay: '0s'   },
  { cx: 170, cy: 14, w: 20, delay: '-25s' },
  { cx: 275, cy: 22, w: 26, delay: '-12s' },
  { cx: 380, cy: 16, w: 22, delay: '-38s' },
];

export function BlockhausScene({ children }: Props) {
  // Saunameister: nur in den letzten 10 Min vor jeder vollen Stunde sichtbar
  const [showSaunameister, setShowSaunameister] = useState(false);

  useEffect(() => {
    const check = () => {
      setShowSaunameister(new Date().getMinutes() >= 50);
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative pointer-events-none" style={{ width: W, height: H }}>
      <style>{`
        @keyframes bs-tree-sway      { 0%,100% { transform: rotate(0deg); }       50% { transform: rotate(1.5deg); } }
        @keyframes bs-reeds-sway     { 0%,100% { transform: rotate(0deg) skewX(0deg); } 50% { transform: rotate(2deg) skewX(1deg); } }
        @keyframes bs-ripple         { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(3); opacity: 0; } }
        @keyframes bs-bird-1         { 0% { transform: translate(-50px, 30px); } 100% { transform: translate(500px, 18px); } }
        @keyframes bs-bird-2         { 0% { transform: translate(500px, 14px); } 100% { transform: translate(-50px, 28px); } }
        @keyframes bs-fisher-breath  { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.03); } }
        @keyframes bs-cloud-drift    { 0% { transform: translateX(0); } 100% { transform: translateX(50px); } }
        @keyframes bs-butterfly-fly  {
          0%   { transform: translate(180px, 60px); }
          25%  { transform: translate(240px, 35px); }
          50%  { transform: translate(290px, 55px); }
          75%  { transform: translate(220px, 80px); }
          100% { transform: translate(180px, 60px); }
        }
        @keyframes bs-butterfly-flap { 0%,100% { transform: scaleX(1); } 50% { transform: scaleX(0.3); } }
        @keyframes bs-firefly-glow   { 0%,100% { opacity: 0.2; } 50% { opacity: 1; } }
        @keyframes bs-firefly-drift  {
          0%   { transform: translate(0, 0); }
          33%  { transform: translate(15px, -8px); }
          66%  { transform: translate(-5px, -12px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes bs-climber-hike {
          0%   { transform: translate(0, 0); }
          25%  { transform: translate(8px, -8px); }
          50%  { transform: translate(20px, -18px); }
          75%  { transform: translate(32px, -28px); }
          100% { transform: translate(45px, -38px); }
        }
        @keyframes bs-climber-step   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1px); } }
        @keyframes bs-duck-swim      {
          0%   { transform: translateX(0); }
          50%  { transform: translateX(36px) scaleX(-1); }
          100% { transform: translateX(0) scaleX(1); }
        }
        @keyframes bs-duck-bob       { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-0.6px); } }
        @keyframes bs-fox-peek {
          0%, 70%, 100% { opacity: 0; transform: translateX(8px); }
          75%, 92%      { opacity: 1; transform: translateX(0); }
        }
        @keyframes bs-specht-peck {
          0%, 100%        { transform: rotate(0deg); }
          8%, 24%, 40%    { transform: rotate(-18deg); }
          16%, 32%, 48%   { transform: rotate(0deg); }
        }
        @keyframes bs-bee-orbit {
          0%   { transform: translate(0, 0); }
          25%  { transform: translate(8px, -3px); }
          50%  { transform: translate(4px, -8px); }
          75%  { transform: translate(-6px, -4px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes bs-master-enter {
          0%   { transform: translate(0, 0)   scale(0.85); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translate(45px, 0) scale(1.6);  opacity: 1; }
        }
        @keyframes bs-mole {
          0%, 60%, 100% { transform: translateY(2.5px); opacity: 0.3; }
          70%, 92%      { transform: translateY(0); opacity: 1; }
          95%           { transform: translateY(2.5px); opacity: 0.3; }
        }
        @keyframes bs-grill-smoke {
          0%   { opacity: 0; transform: translate(0, 0) scale(0.5); }
          20%  { opacity: 0.7; }
          100% { opacity: 0; transform: translate(2px, -10px) scale(1.6); }
        }
        @keyframes bs-balloon {
          0%   { transform: translate(-40px, 20px); }
          25%  { transform: translate(110px, 8px); }
          50%  { transform: translate(240px, 16px); }
          75%  { transform: translate(370px, 6px); }
          100% { transform: translate(510px, 14px); }
        }
        @keyframes bs-balloon-flame {
          0%, 88%, 100% { opacity: 0; transform: scaleY(0.6); }
          90%, 95%      { opacity: 1; transform: scaleY(1.2); }
        }
        @keyframes bs-bush-sway {
          0%, 100% { transform: scale(1, 1); }
          50%      { transform: scale(1.03, 0.97); }
        }
        @keyframes bs-dragonfly {
          0%   { transform: translate(330px, 160px) rotate(0deg); }
          20%  { transform: translate(360px, 150px) rotate(15deg); }
          40%  { transform: translate(400px, 158px) rotate(-10deg); }
          60%  { transform: translate(380px, 168px) rotate(5deg); }
          80%  { transform: translate(345px, 162px) rotate(-8deg); }
          100% { transform: translate(330px, 160px) rotate(0deg); }
        }
        @keyframes bs-dragonfly-2 {
          0%   { transform: translate(395px, 155px) rotate(0deg); }
          25%  { transform: translate(360px, 168px) rotate(-12deg); }
          50%  { transform: translate(335px, 158px) rotate(8deg); }
          75%  { transform: translate(370px, 152px) rotate(-5deg); }
          100% { transform: translate(395px, 155px) rotate(0deg); }
        }
        @keyframes bs-wing-buzz { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(0.2); } }
        @keyframes bs-heron-head {
          0%, 38%, 100% { transform: rotate(0deg); }
          42%, 56%      { transform: rotate(-25deg); }
          60%           { transform: rotate(0deg); }
          78%, 92%      { transform: rotate(15deg); }
          96%           { transform: rotate(0deg); }
        }
        @keyframes bs-shooting-star {
          0%, 88%, 100% { opacity: 0; transform: translate(0, 0); }
          90%           { opacity: 1; transform: translate(0, 0); }
          97%           { opacity: 0; transform: translate(80px, 30px); }
        }
        @keyframes bs-ladybug-crawl {
          0%, 100% { transform: translate(0, 0); }
          50%      { transform: translate(2.5px, -1.5px); }
        }
        @keyframes bs-sign-creak {
          0%, 100% { transform: rotate(-1deg); }
          50%      { transform: rotate(1deg); }
        }
        @keyframes bs-towel-sway {
          0%, 100% { transform: rotate(-3deg); }
          50%      { transform: rotate(4deg); }
        }
        @keyframes bs-hedgehog-walk {
          0%   { transform: translate(0, 0); }
          50%  { transform: translate(45px, 0) scaleX(-1); }
          100% { transform: translate(0, 0) scaleX(1); }
        }
        @keyframes bs-hedgehog-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-0.4px); } }
        @keyframes bs-sunflower-sway {
          0%, 100% { transform: rotate(-2deg); }
          50%      { transform: rotate(3deg); }
        }
        @keyframes bs-kingfisher {
          0%, 95%, 100% { opacity: 0; transform: translate(-30px, 165px); }
          5%            { opacity: 1; transform: translate(-30px, 165px); }
          45%           { opacity: 1; transform: translate(230px, 158px); }
          50%           { opacity: 1; transform: translate(490px, 167px); }
          55%           { opacity: 0; transform: translate(490px, 167px); }
        }
        @keyframes bs-string-light {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
        @keyframes bs-pond-shimmer {
          0%, 100% { opacity: 0.3; transform: translateX(0); }
          50%      { opacity: 0.7; transform: translateX(4px); }
        }

        .bs-tree            { transform-origin: bottom center; animation: bs-tree-sway 4s infinite ease-in-out; }
        .bs-reeds           { transform-origin: bottom center; animation: bs-reeds-sway 3s infinite ease-in-out; }
        .bs-ripple          { transform-origin: center;        animation: bs-ripple 3s infinite ease-out; }
        .bs-bird-1          { animation: bs-bird-1 22s infinite linear; }
        .bs-bird-2          { animation: bs-bird-2 28s infinite linear; }
        .bs-fisher          { transform-origin: bottom center; animation: bs-fisher-breath 3s infinite ease-in-out; }
        .bs-cloud           { animation: bs-cloud-drift 70s infinite alternate ease-in-out; }
        .bs-butterfly-fly   { animation: bs-butterfly-fly 22s infinite ease-in-out; }
        .bs-butterfly-flap  { transform-origin: center; animation: bs-butterfly-flap 0.55s infinite ease-in-out; }
        .bs-firefly         { animation: bs-firefly-glow 9s infinite ease-in-out; }
        .bs-firefly-drift   { animation: bs-firefly-drift 30s infinite ease-in-out; }
        .bs-climber         { animation: bs-climber-hike 18s infinite ease-in-out alternate; }
        .bs-climber-step    { animation: bs-climber-step 0.9s infinite ease-in-out; }
        .bs-duck            { animation: bs-duck-swim 14s infinite ease-in-out; }
        .bs-duck-bob        { animation: bs-duck-bob 1.4s infinite ease-in-out; }
        .bs-fox             { animation: bs-fox-peek 30s infinite ease-in-out; }
        .bs-specht          { transform-origin: 4px 0px; animation: bs-specht-peck 5s infinite ease-in-out; }
        .bs-bee             { animation: bs-bee-orbit 2.4s infinite linear; }
        .bs-master-enter    { animation: bs-master-enter 6s ease-out forwards; animation-iteration-count: 1; }
        .bs-mole            { transform-origin: center; animation: bs-mole 18s infinite ease-in-out; }
        .bs-grill-smoke     { animation: bs-grill-smoke 4s infinite ease-out; }
        .bs-balloon         { animation: bs-balloon 90s infinite linear; }
        .bs-balloon-flame   { transform-origin: center bottom; animation: bs-balloon-flame 3s infinite ease-in-out; }
        .bs-bush            { transform-origin: bottom center; animation: bs-bush-sway 5s infinite ease-in-out; }
        .bs-dragonfly       { animation: bs-dragonfly 9s infinite ease-in-out; }
        .bs-dragonfly-2     { animation: bs-dragonfly-2 11s infinite ease-in-out; }
        .bs-wing-buzz       { transform-origin: center; animation: bs-wing-buzz 0.32s infinite ease-in-out; }
        .bs-heron-head      { transform-origin: 0 0; animation: bs-heron-head 14s infinite ease-in-out; }
        .bs-shooting-star   { animation: bs-shooting-star 18s infinite ease-out; }
        .bs-ladybug         { animation: bs-ladybug-crawl 8s infinite ease-in-out; }
        .bs-sign            { transform-origin: top center; animation: bs-sign-creak 6s infinite ease-in-out; }
        .bs-towel           { transform-origin: top center; animation: bs-towel-sway 3.4s infinite ease-in-out; }
        .bs-hedgehog        { animation: bs-hedgehog-walk 40s infinite ease-in-out; }
        .bs-hedgehog-bob    { animation: bs-hedgehog-bob 0.6s infinite ease-in-out; }
        .bs-sunflower       { transform-origin: bottom center; animation: bs-sunflower-sway 4.5s infinite ease-in-out; }
        .bs-kingfisher      { animation: bs-kingfisher 28s infinite ease-out; }
        .bs-string-light    { animation: bs-string-light 2s infinite ease-in-out; }
        .bs-pond-shimmer    { animation: bs-pond-shimmer 6s infinite ease-in-out; }

        @media (prefers-reduced-motion: reduce) {
          .bs-tree, .bs-reeds, .bs-ripple, .bs-bird-1, .bs-bird-2,
          .bs-fisher, .bs-cloud, .bs-butterfly-fly, .bs-butterfly-flap,
          .bs-firefly, .bs-firefly-drift, .bs-climber, .bs-climber-step,
          .bs-duck, .bs-duck-bob, .bs-fox, .bs-specht, .bs-bee,
          .bs-master-enter, .bs-mole, .bs-grill-smoke,
          .bs-balloon, .bs-balloon-flame, .bs-bush,
          .bs-dragonfly, .bs-dragonfly-2, .bs-wing-buzz,
          .bs-heron-head, .bs-shooting-star, .bs-ladybug, .bs-sign,
          .bs-towel, .bs-hedgehog, .bs-hedgehog-bob, .bs-sunflower,
          .bs-kingfisher, .bs-string-light, .bs-pond-shimmer {
            animation: none;
          }
        }
      `}</style>

      <svg className="absolute inset-0" viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ overflow: 'visible' }}>
        <defs>
          {/* Atmosphärischer Dunst am Horizont für Tiefe */}
          <linearGradient id="bs-haze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="rgba(180,200,210,0.0)" />
            <stop offset="50%" stopColor="rgba(160,180,195,0.45)" />
            <stop offset="100%" stopColor="rgba(120,150,170,0.0)" />
          </linearGradient>
        </defs>

        {/* Bodensaum */}
        <ellipse cx={W / 2} cy={H - 4} rx={W / 2 - 6} ry="6" fill="rgba(20,40,25,0.45)" />

        {/* Tiefen-Layer: Fern-Berg + Horizont-Dunst */}
        <DistantMountain />
        <rect x="0" y="115" width={W} height="35" fill="url(#bs-haze)" opacity="0.55" />

        {/* Berg links + Bergsteiger */}
        <Mountain />
        <g transform="translate(35, 130)">
          <g className="bs-climber">
            <g className="bs-climber-step">
              <Climber />
            </g>
          </g>
        </g>

        {/* ──────── BÄUME — drei Tiefen-Ebenen ──────── */}
        {FAR_TREES.map((t, i) => (
          <g key={`fr-${i}`} className="bs-tree" style={{ animationDelay: t.delay }}>
            <BackTree x={t.x} h={t.h} dimmer veryFar />
          </g>
        ))}
        {BACK_TREES.map((t, i) => (
          <g key={`bt-${i}`} className="bs-tree" style={{ animationDelay: t.delay }}>
            <BackTree x={t.x} h={t.h} dimmer={t.dimmer} />
          </g>
        ))}
        {MID_TREES.map((t, i) => (
          <g key={`mt-${i}`} className="bs-tree" style={{ animationDelay: t.delay }}>
            <BackTree x={t.x} h={t.h} dimmer={false} front />
          </g>
        ))}

        {/* Wolken über den Bäumen */}
        {CLOUDS.map((c, i) => (
          <g key={`cl-${i}`} className="bs-cloud" style={{ animationDelay: c.delay }}>
            <Cloud cx={c.cx} cy={c.cy} w={c.w} />
          </g>
        ))}

        {/* ÜBERRASCHUNG: Heißluftballon mit Saunafreunde-Banner zieht über die Tafel */}
        <g className="bs-balloon">
          <HotAirBalloon />
        </g>

        {/* Sternschnuppe — selten und kurz, mit Schweif */}
        <g className="bs-shooting-star">
          <line x1="50" y1="20" x2="20" y2="8" stroke="rgba(255,255,255,0.85)" strokeWidth="1.1" strokeLinecap="round" />
          <line x1="50" y1="20" x2="32" y2="13" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" strokeLinecap="round" />
          <circle cx="50" cy="20" r="1.8" fill="#fef9c3" />
          <circle cx="50" cy="20" r="1" fill="#fff" />
        </g>

        {/* 2 Vögel */}
        <g className="bs-bird-1">
          <path d="M0,0 Q3,-3 6,0 Q9,-3 12,0" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
        </g>
        <g className="bs-bird-2">
          <path d="M0,0 Q3,-3 6,0 Q9,-3 12,0" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.7" />
        </g>

        {/* Schmetterling */}
        <g className="bs-butterfly-fly">
          <Butterfly />
        </g>

        {/* Teich */}
        <Pond cx={360} cy={175} rx={65} ry={16} />

        {/* Subtile Glitzer-Reflexion auf der Wasseroberfläche */}
        <g className="bs-pond-shimmer">
          <ellipse cx={345} cy={172} rx="6" ry="0.5" fill="rgba(255,255,255,0.7)" />
          <ellipse cx={375} cy={174} rx="4" ry="0.4" fill="rgba(255,255,255,0.6)" />
          <ellipse cx={400} cy={176} rx="5" ry="0.4" fill="rgba(255,255,255,0.5)" />
        </g>

        {/* Zwei Büsche an den Teich-Ufern (reduziert von 4) */}
        <g className="bs-bush" style={{ animationDelay: '-0.4s', transformOrigin: '305px 191px' }}>
          <Bush cx={305} cy={191} size={0.9} />
        </g>
        <g className="bs-bush" style={{ animationDelay: '-2.1s', transformOrigin: '410px 191px' }}>
          <Bush cx={410} cy={191} size={0.95} dark />
        </g>

        {/* Wegweiser direkt vor dem Teich, klar rechts von Sauna */}
        <Wegweiser x={310} y={193} />

        {/* Fischreiher steht im hinteren Teich */}
        <g transform="translate(395, 170)">
          <Heron />
        </g>

        {/* Eine Libelle über dem Teich (reduziert von 2) */}
        <g className="bs-dragonfly">
          <Dragonfly />
        </g>

        {/* Vogelhäuschen am rechten Hinterbaum */}
        <g transform="translate(415, 168)">
          <Vogelhaus />
        </g>

        {/* Schilf am Teichufer (reduziert von 5 auf 3) */}
        <g className="bs-reeds" style={{ animationDelay: '-0.2s' }}>
          <Reeds x={302} y={185} />
        </g>
        <g className="bs-reeds" style={{ animationDelay: '-1.5s' }}>
          <Reeds x={418} y={185} />
        </g>
        <g className="bs-reeds" style={{ animationDelay: '-1.0s' }}>
          <Reeds x={388} y={189} />
        </g>

        {/* Frosch auf Seerose */}
        <g transform="translate(345, 174)">
          <ellipse cx="0" cy="0.5" rx="6" ry="2" fill="#1f5a3a" />
          <ellipse cx="0" cy="-0.3" rx="4.5" ry="1.4" fill="#2a7048" />
          <ellipse cx="0" cy="-2" rx="3" ry="2" fill="#326c44" />
          <ellipse cx="0" cy="-3" rx="2" ry="1.5" fill="#4a8a5a" />
          <circle cx="-1.5" cy="-4" r="1" fill="#326c44" />
          <circle cx="1.5"  cy="-4" r="1" fill="#326c44" />
          <circle cx="-1.5" cy="-4" r="0.5" fill="#fbbf24" />
          <circle cx="1.5"  cy="-4" r="0.5" fill="#fbbf24" />
          <circle cx="-1.5" cy="-4" r="0.2" fill="#1a0e05" />
          <circle cx="1.5"  cy="-4" r="0.2" fill="#1a0e05" />
          <path d="M-1.5 -2 Q0 -1.4 1.5 -2" stroke="#1a0e05" strokeWidth="0.3" fill="none" />
        </g>

        {/* Enten-Familie */}
        <g transform="translate(330, 172)">
          <g className="bs-duck">
            <g className="bs-duck-bob">
              <Duck />
              <g transform="translate(-9, 1)"><Duckling /></g>
              <g transform="translate(-15, 0.3)"><Duckling /></g>
              <g transform="translate(-21, 1)"><Duckling /></g>
            </g>
          </g>
        </g>

        {/* Bienenstand — EIN großer Stock + Imker, ruhig komponiert */}
        <g transform="translate(80, 195) scale(1.9)">
          <Beehive x={0} y={0} />
        </g>
        <g transform="translate(115, 195) scale(1.9)">
          <Imker />
        </g>
        {/* 3 Bienen schwirren ums Nest (statt 8) */}
        <Bee cx={80}  cy={178} delay="0s" />
        <Bee cx={95}  cy={172} delay="-0.8s" />
        <Bee cx={105} cy={180} delay="-1.6s" />

        {/* Bank + Angler — rechts vom Teich */}
        <Bench x={427} y={148} />
        <g className="bs-fisher">
          <Fisher x={428} y={116} />
        </g>

        {/* 2 Sonnenblumen-Gruppen links */}
        <g className="bs-sunflower" style={{ animationDelay: '0s', transformOrigin: '50px 188px' }}>
          <Sunflower x={50} y={188} h={14} />
        </g>
        <g className="bs-sunflower" style={{ animationDelay: '-1.4s', transformOrigin: '57px 188px' }}>
          <Sunflower x={57} y={188} h={11} />
        </g>

        {/* Wiesenblumen — nur 3, sparsam verteilt */}
        <Flower cx={42}  cy={196} color="#fbbf24" />
        <Flower cx={140} cy={196} color="#a78bfa" />
        <Flower cx={430} cy={193} color="#ec4899" />

        {/* Briefkasten rechts der Sauna, vor dem Wegweiser */}
        <g transform="translate(295, 195)">
          <rect x="-0.7" y="-13" width="1.4" height="13" fill="#5a3010" />
          <rect x="-4" y="-20" width="8" height="6" fill="#dc2626" stroke="#7c2d12" strokeWidth="0.4" rx="0.5" />
          <rect x="-4" y="-20" width="8" height="1.5" fill="#7c2d12" rx="0.5" />
          <rect x="-2.5" y="-18" width="5" height="0.6" fill="#1a0e05" />
          <line x1="3" y1="-20" x2="3" y2="-23" stroke="#5a3010" strokeWidth="0.4" />
          <polygon points="3,-23 6,-22 3,-21" fill="#fbbf24" />
        </g>

        {/* Gartenzwerg ganz vorne links */}
        <g transform="translate(15, 192)">
          <ellipse cx="0" cy="0" rx="2.5" ry="0.5" fill="rgba(0,0,0,0.4)" />
          <rect x="-0.8" y="-3" width="1.4" height="3" fill="#1f4d2f" />
          <rect x="0.4"  y="-3" width="1.4" height="3" fill="#1f4d2f" />
          <ellipse cx="-0.1" cy="0" rx="0.9" ry="0.4" fill="#1a0e05" />
          <ellipse cx="1.1"  cy="0" rx="0.9" ry="0.4" fill="#1a0e05" />
          <ellipse cx="0.5" cy="-5" rx="2.2" ry="2" fill="#dc2626" />
          <path d="M-1.5 -7 Q0.5 -5 2.5 -7 Q2 -5.5 0.5 -5.5 Q-1 -5.5 -1.5 -7 Z" fill="#fff" />
          <circle cx="0.5" cy="-8" r="1.5" fill="#ffd5aa" />
          <polygon points="0.5,-12 -1.5,-7.5 2.5,-7.5" fill="#dc2626" />
          <ellipse cx="0.5" cy="-7.5" rx="2.2" ry="0.4" fill="#7c2d12" />
          <circle cx="0" cy="-8" r="0.2" fill="#1a0e05" />
          <circle cx="1"  cy="-8" r="0.2" fill="#1a0e05" />
        </g>

        {/* Maulwurfshügel vor der Bank rechts */}
        <g transform="translate(452, 192)">
          <ellipse cx="0" cy="2" rx="6" ry="1.5" fill="#5a3a1c" />
          <ellipse cx="0" cy="1" rx="5" ry="1.8" fill="#6b4a2a" />
          <g className="bs-mole">
            <ellipse cx="0" cy="-1" rx="2.2" ry="1.8" fill="#1a1a1a" />
            <circle cx="-0.8" cy="-1.4" r="0.3" fill="#fff" />
            <circle cx="0.8"  cy="-1.4" r="0.3" fill="#fff" />
            <ellipse cx="0" cy="-0.4" rx="0.7" ry="0.5" fill="#ffd5aa" />
          </g>
        </g>
      </svg>

      {/* Sauna-Veranda — Holzdeck unter der Sauna, lässt sie in die Szene eintauchen */}
      <svg
        className="absolute inset-0"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        {/* Steinfundament hinter dem Deck */}
        <rect x="170" y="163" width="120" height="6" fill="#5a5a62" />
        <rect x="170" y="163" width="120" height="1.5" fill="#7a7a82" />
        {[180, 200, 220, 240, 260, 280].map((sx) => (
          <line key={sx} x1={sx} y1="163" x2={sx} y2="169" stroke="#3a3a42" strokeWidth="0.4" />
        ))}

        {/* Hauptdeck — Holzplanken horizontal */}
        <rect x="168" y="167" width="124" height="22" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.5" rx="1" />
        <rect x="168" y="167" width="124" height="1.5" fill="#a06530" />
        {[171, 175, 179, 183, 187].map((py) => (
          <line key={py} x1="168" y1={py} x2="292" y2={py} stroke="#5a3010" strokeWidth="0.3" />
        ))}
        {/* Brett-Trennlinien vertikal (Plankenkanten) */}
        {[195, 220, 245, 270].map((px) => (
          <line key={px} x1={px} y1="167" x2={px} y2="189" stroke="#3a1808" strokeWidth="0.4" />
        ))}
        {/* Astknoten in den Planken */}
        <ellipse cx="185" cy="178" rx="1.2" ry="0.7" fill="#3a1808" />
        <ellipse cx="260" cy="174" rx="1" ry="0.6" fill="#3a1808" />
        <ellipse cx="232" cy="183" rx="0.9" ry="0.5" fill="#3a1808" />

        {/* Untere Deck-Kante mit Schatten zum Boden */}
        <rect x="168" y="189" width="124" height="2" fill="#3a1808" />
        <ellipse cx="230" cy="193" rx="58" ry="2" fill="rgba(0,0,0,0.45)" />

        {/* Mittlere Treppe vom Deck zum Boden */}
        <g>
          <rect x="218" y="189" width="24" height="2" fill="#a06530" stroke="#3a1808" strokeWidth="0.3" />
          <rect x="216" y="191" width="28" height="2" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.3" />
          <rect x="214" y="193" width="32" height="2" fill="#5a3010" stroke="#3a1808" strokeWidth="0.3" />
        </g>

        {/* Grasbüschel an den Deck-Ecken (weiche Verzahnung mit Boden) */}
        <g>
          {[167, 170, 173, 287, 290, 293].map((gx, i) => (
            <g key={`gt-${i}`}>
              <line x1={gx} y1="195" x2={gx - 1} y2="191" stroke="#326c44" strokeWidth="0.6" strokeLinecap="round" />
              <line x1={gx + 1} y1="195" x2={gx + 1.5} y2="191.5" stroke="#2a5e3a" strokeWidth="0.5" strokeLinecap="round" />
              <line x1={gx + 0.4} y1="195" x2={gx - 0.4} y2="192" stroke="#4a8a5a" strokeWidth="0.5" strokeLinecap="round" />
            </g>
          ))}
        </g>

        {/* Mini-Holzgeländer links/rechts vom Deck */}
        <g>
          {/* Links */}
          <rect x="168" y="158" width="1.2" height="10" fill="#5a3010" />
          <rect x="178" y="158" width="1.2" height="10" fill="#5a3010" />
          <rect x="167" y="158" width="13" height="1.4" fill="#7c4a1a" />
          {/* Rechts */}
          <rect x="280.8" y="158" width="1.2" height="10" fill="#5a3010" />
          <rect x="290.8" y="158" width="1.2" height="10" fill="#5a3010" />
          <rect x="280" y="158" width="13" height="1.4" fill="#7c4a1a" />
        </g>

        {/* Blumenkasten neben der Treppe */}
        <g transform="translate(195, 187)">
          <rect x="0" y="0" width="14" height="3" fill="#5a3010" stroke="#3a1808" strokeWidth="0.3" rx="0.4" />
          <rect x="0" y="0" width="14" height="0.6" fill="#7c4a1a" rx="0.4" />
          {/* Erde */}
          <rect x="0.6" y="0.7" width="12.8" height="0.8" fill="#3a2010" />
          {/* Blümchen */}
          {[2, 5, 8, 11].map((bx, i) => (
            <g key={`fl-${i}`}>
              <line x1={bx} y1="0.7" x2={bx} y2="-2" stroke="#326c44" strokeWidth="0.4" />
              <circle cx={bx} cy="-2.4" r="0.7" fill={['#dc2626', '#fbbf24', '#ec4899', '#a78bfa'][i]} />
              <circle cx={bx} cy="-2.4" r="0.25" fill="#fbbf24" />
            </g>
          ))}
        </g>
      </svg>

      {/* Sauna (HTML-Overlay) — 28 % kleiner, höher, mittig auf der Veranda */}
      <div className="absolute" style={{ left: 180, top: 55, pointerEvents: 'auto' }}>
        {children}
      </div>

      {/* Vordergrund-SVG — nur Elemente, die ÜBER der Sauna liegen müssen */}
      <svg
        className="absolute inset-0"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        {/* Fuchs peekt hinter der Sauna-Wand hervor */}
        <g transform="translate(244, 188)">
          <g className="bs-fox">
            <Fox />
          </g>
        </g>

        {/* Saunameister: nur 10 min vor voller Stunde sichtbar.
            Startet vor der Sauna-Tür (x=200, mittig) und läuft ein paar Schritte
            Richtung Teich (Endposition x=245), bleibt dort mit Eimer + Kelle. */}
        {showSaunameister && (
          <g transform="translate(200, 192)">
            <g className="bs-master-enter">
              <Saunameister />
            </g>
          </g>
        )}

        {/* Glühwürmchen — auf 2 reduziert für ruhigere Atmosphäre */}
        <Firefly cx={235} cy={150} driftDelay="-9s"  glowDelay="-3s" />
        <Firefly cx={400} cy={140} driftDelay="-21s" glowDelay="-7s" />
      </svg>
    </div>
  );
}

// ── Ferner Berg-Schatten ganz hinten (Tiefen-Layer) ───────────────────────
function DistantMountain() {
  return (
    <g opacity="0.35">
      {/* Sehr ferne Bergkette, blau-grau, niedrig */}
      <polygon points="0,138 80,108 145,128 220,98 305,118 380,105 460,125 460,140 0,140" fill="#5a7080" />
      <polygon points="80,108 105,118 145,128" fill="#4a6070" />
      <polygon points="220,98 250,112 305,118" fill="#4a6070" />
      <polygon points="380,105 410,116 460,125" fill="#4a6070" />
      {/* Schneekappen-Andeutung */}
      <polygon points="220,98 232,108 220,106" fill="#dde3e8" opacity="0.6" />
    </g>
  );
}

// ── Berg links ────────────────────────────────────────────────────────────
function Mountain() {
  return (
    <g opacity="0.85">
      <polygon points="115,98 145,135 75,135" fill="#3a4a55" opacity="0.6" />
      <polygon points="55,72 130,138 0,138" fill="#4a5560" />
      <polygon points="55,72 55,138 0,138" fill="#3a4550" />
      <polygon points="55,72 65,88 50,86 44,92 38,88" fill="#ecf0f4" />
      <polygon points="55,72 38,88 30,96 50,86" fill="#d8dde2" />
      <path d="M22 110 L 35 108 L 45 112" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" fill="none" />
      <path d="M70 102 L 85 106 L 95 110" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" fill="none" />
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

function Climber() {
  return (
    <g>
      <line x1="-3" y1="-1" x2="-5" y2="6"  stroke="#374151" strokeWidth="0.4" />
      <line x1="4"  y1="-1" x2="6"  y2="6"  stroke="#374151" strokeWidth="0.4" />
      <line x1="0.5" y1="0" x2="0"   y2="3.2" stroke="#1f2937" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="2"   y1="0" x2="2.5" y2="3.2" stroke="#1f2937" strokeWidth="1.1" strokeLinecap="round" />
      <ellipse cx="0"   cy="3.5" rx="0.9" ry="0.5" fill="#1a0e05" />
      <ellipse cx="2.5" cy="3.5" rx="0.9" ry="0.5" fill="#1a0e05" />
      <ellipse cx="1.2" cy="-1.7" rx="1.7" ry="2" fill="#dc2626" />
      <rect x="-1" y="-3" width="2" height="3" fill="#15803d" rx="0.3" />
      <rect x="-1" y="-3" width="2" height="0.6" fill="#166534" />
      <circle cx="1.2" cy="-4" r="1.1" fill="#ffd5aa" />
      <path d="M0 -4.4 Q1.2 -5.5 2.4 -4.4 L 2.4 -4 L 0 -4 Z" fill="#92400e" />
      <ellipse cx="1.2" cy="-4" rx="1.4" ry="0.3" fill="#7c2d12" />
    </g>
  );
}

function Beehive({ x, y, small = false }: { x: number; y: number; small?: boolean }) {
  const s = small ? 0.8 : 1;
  return (
    <g transform={`translate(${x}, ${y}) scale(${s})`}>
      <ellipse cx="0" cy="0"   rx="9" ry="2" fill="rgba(0,0,0,0.4)" />
      <ellipse cx="0" cy="-2"  rx="8" ry="3" fill="#a06530" />
      <ellipse cx="0" cy="-6"  rx="7" ry="2.5" fill="#7c4a1a" />
      <ellipse cx="0" cy="-9"  rx="6" ry="2.2" fill="#a06530" />
      <ellipse cx="0" cy="-12" rx="5" ry="2" fill="#7c4a1a" />
      <ellipse cx="0" cy="-14" rx="3.5" ry="1.4" fill="#5a3010" />
      <rect x="-1.5" y="-3" width="3" height="2" fill="#1a0808" rx="0.5" />
    </g>
  );
}

function Imker() {
  return (
    <g>
      <ellipse cx="1.5" cy="0" rx="3.5" ry="0.7" fill="rgba(0,0,0,0.4)" />
      <line x1="0"  y1="-2" x2="-0.5" y2="0" stroke="#1a1a1a" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="3"  y1="-2" x2="3.5" y2="0" stroke="#1a1a1a" strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="-0.5" cy="0" rx="1.2" ry="0.5" fill="#1a0808" />
      <ellipse cx="3.5"  cy="0" rx="1.2" ry="0.5" fill="#1a0808" />
      <ellipse cx="1.5" cy="-5" rx="3.5" ry="4" fill="#f5f5f5" stroke="#d4d4d4" strokeWidth="0.4" />
      <line x1="-1.5" y1="-5" x2="-3.5" y2="-2" stroke="#f5f5f5" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="4.5"  y1="-5" x2="6.5"  y2="-2" stroke="#f5f5f5" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="-3.5" cy="-2" r="0.8" fill="#d4d4d4" />
      <circle cx="6.5"  cy="-2" r="0.8" fill="#d4d4d4" />
      <ellipse cx="1.5" cy="-10" rx="2.5" ry="2.8" fill="#f5f5f5" />
      <line x1="-0.8" y1="-10.5" x2="3.8" y2="-10.5" stroke="#5a5a5a" strokeWidth="0.3" />
      <line x1="-0.8" y1="-9.5"  x2="3.8" y2="-9.5"  stroke="#5a5a5a" strokeWidth="0.3" />
      <line x1="0"    y1="-11.5" x2="0"   y2="-9"    stroke="#5a5a5a" strokeWidth="0.3" />
      <line x1="3"    y1="-11.5" x2="3"   y2="-9"    stroke="#5a5a5a" strokeWidth="0.3" />
      <ellipse cx="1.5" cy="-13" rx="3.5" ry="0.9" fill="#3a1808" />
      <rect x="0" y="-14.5" width="3" height="2" fill="#5a3a18" rx="0.3" />
    </g>
  );
}

function Bee({ cx, cy, delay }: { cx: number; cy: number; delay: string }) {
  return (
    <g className="bs-bee" style={{ animationDelay: delay }}>
      <circle cx={cx} cy={cy} r="1.1" fill="#1a1a1a" />
      <ellipse cx={cx} cy={cy} rx="2.2" ry="0.8" fill="rgba(252,211,77,0.85)" />
    </g>
  );
}

function Fox() {
  return (
    <g>
      <ellipse cx="0" cy="0" rx="6" ry="3" fill="#d97706" />
      <ellipse cx="0" cy="1" rx="5" ry="2" fill="#fbbf24" opacity="0.7" />
      <circle cx="6" cy="-1" r="3" fill="#d97706" />
      <ellipse cx="9" cy="-0.5" rx="1.8" ry="1.2" fill="#1a1a1a" />
      <circle cx="10" cy="-0.5" r="0.3" fill="#1a0e05" />
      <circle cx="6.5" cy="-1.5" r="0.5" fill="#1a0e05" />
      <circle cx="6.7" cy="-1.7" r="0.15" fill="#fff" />
      <polygon points="3.5,-3.5 4.5,-5 5.5,-3" fill="#d97706" />
      <polygon points="4,-3.5 4.5,-4.5 5,-3.5" fill="#1a1a1a" />
      <polygon points="6.5,-3 7.5,-5 8.5,-3" fill="#d97706" />
      <polygon points="7,-3 7.5,-4.5 8,-3" fill="#1a1a1a" />
      <path d="M-6 0 Q-9 -1 -8 -3" stroke="#d97706" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="-8" cy="-3" r="1.3" fill="#fff" />
      <ellipse cx="-2" cy="2.5" rx="1" ry="1.5" fill="#a04510" />
      <ellipse cx="3" cy="2.5" rx="1" ry="1.5" fill="#a04510" />
    </g>
  );
}

// ── Saunameister mit Wassereimer + Saunakelle ────────────────────────────
function Saunameister() {
  return (
    <g>
      {/* Schatten */}
      <ellipse cx="0" cy="2.5" rx="3" ry="0.7" fill="rgba(0,0,0,0.35)" />
      {/* Beine */}
      <line x1="-1" y1="0" x2="-1" y2="2.5" stroke="#ffd5aa" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1"  y1="0" x2="1"  y2="2.5" stroke="#ffd5aa" strokeWidth="1.5" strokeLinecap="round" />
      {/* Handtuch um die Hüfte */}
      <rect x="-3" y="-3" width="6" height="4" fill="#fff" rx="0.5" />
      <rect x="-3" y="-3" width="6" height="1.2" fill="#dc2626" rx="0.5" />
      {/* Oberkörper */}
      <ellipse cx="0" cy="-5" rx="2.2" ry="2" fill="#ffd5aa" />
      {/* Linker Arm hängt zum Eimer */}
      <line x1="-2.2" y1="-5" x2="-3.5" y2="-2" stroke="#ffd5aa" strokeWidth="1.2" strokeLinecap="round" />
      {/* Rechter Arm hält Kelle leicht nach oben */}
      <line x1="2.2"  y1="-5" x2="3.8"  y2="-3" stroke="#ffd5aa" strokeWidth="1.2" strokeLinecap="round" />
      {/* Kopf */}
      <circle cx="0" cy="-8" r="1.8" fill="#ffd5aa" />
      <path d="M-1.5 -9 Q0 -10 1.5 -9" stroke="#3a1808" strokeWidth="0.6" fill="none" strokeLinecap="round" />
      <circle cx="-0.6" cy="-8" r="0.2" fill="#1a0e05" />
      <circle cx="0.6"  cy="-8" r="0.2" fill="#1a0e05" />
      <path d="M-0.6 -7.4 Q0 -7.1 0.6 -7.4" stroke="#3a1808" strokeWidth="0.3" fill="none" strokeLinecap="round" />

      {/* Wassereimer in der linken Hand */}
      <g transform="translate(-3.7, -1.6)">
        <path d="M-1.4 0 L 1.4 0 L 1.1 3.6 L -1.1 3.6 Z" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.3" />
        <line x1="-1.3" y1="1"   x2="1.3" y2="1"   stroke="#1a1a1a" strokeWidth="0.3" />
        <line x1="-1.2" y1="2.6" x2="1.2" y2="2.6" stroke="#1a1a1a" strokeWidth="0.3" />
        <path d="M-1.4 0 Q 0 -1.4 1.4 0" stroke="#1a1a1a" strokeWidth="0.4" fill="none" />
        <ellipse cx="0" cy="0.4" rx="1" ry="0.3" fill="#3a6a98" opacity="0.7" />
      </g>

      {/* Saunakelle in der rechten Hand */}
      <g transform="translate(3.9, -2.8) rotate(25)">
        <line x1="0" y1="0" x2="0" y2="5" stroke="#7c4a1a" strokeWidth="0.7" strokeLinecap="round" />
        <ellipse cx="0" cy="5.2" rx="1.1" ry="0.6" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.25" />
        <ellipse cx="0" cy="5"   rx="0.7" ry="0.4" fill="#5a3010" />
      </g>
    </g>
  );
}

function BackTree({ x, h, dimmer = false, front = false, veryFar = false }: {
  x: number; h: number; dimmer?: boolean; front?: boolean; veryFar?: boolean;
}) {
  const groundY = front ? 192 : veryFar ? 175 : 188;
  const trunkW = front ? 4 : veryFar ? 2 : 3;
  const crownH = h - 10;
  const crownW = (veryFar ? 11 : 16) + crownH * (veryFar ? 0.22 : 0.28);
  const opacity = veryFar ? 0.55 : dimmer ? 0.55 : front ? 1 : 0.85;

  return (
    <g opacity={opacity}>
      {!veryFar && (
        <ellipse cx={x} cy={groundY + 1} rx={crownW * 0.5} ry={1.5} fill="rgba(0,0,0,0.35)" />
      )}
      <rect x={x - trunkW / 2} y={groundY - 10} width={trunkW} height={10} fill={veryFar ? '#3a2010' : '#5a3010'} rx={1} />
      <polygon
        points={`${x},${groundY - h} ${x - crownW / 2},${groundY - 10 - crownH * 0.05} ${x + crownW / 2},${groundY - 10 - crownH * 0.05}`}
        fill={veryFar ? '#1a3022' : '#1f4d2f'}
      />
      {!veryFar && (
        <>
          <polygon
            points={`${x},${groundY - h + crownH * 0.2} ${x - crownW * 0.42},${groundY - 10 + crownH * 0.05} ${x + crownW * 0.42},${groundY - 10 + crownH * 0.05}`}
            fill="#2a5e3a"
          />
          <polygon
            points={`${x},${groundY - h + crownH * 0.42} ${x - crownW * 0.34},${groundY - 10 + crownH * 0.12} ${x + crownW * 0.34},${groundY - 10 + crownH * 0.12}`}
            fill="#326c44"
          />
        </>
      )}
    </g>
  );
}

function Pond({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#1a3a55" />
      <ellipse cx={cx} cy={cy - 2} rx={rx - 4} ry={ry - 3} fill="#234a6e" />
      <circle className="bs-ripple" cx={cx + 25} cy={cy + 5} r="2" fill="none" stroke="white" strokeWidth="0.5" />
      <circle
        className="bs-ripple"
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

function Duck() {
  return (
    <g>
      <ellipse cx="0" cy="2" rx="6" ry="0.7" fill="rgba(0,0,0,0.4)" />
      <ellipse cx="0" cy="0" rx="5" ry="2.5" fill="#f5e6c8" />
      <ellipse cx="0" cy="-0.3" rx="4" ry="1.8" fill="#fff" />
      <polygon points="-5,0 -7,-1.5 -5,-1" fill="#f5e6c8" />
      <ellipse cx="3.5" cy="-2" rx="1.5" ry="2" fill="#f5e6c8" />
      <circle cx="4" cy="-3.5" r="1.6" fill="#1f4d2f" />
      <polygon points="5.2,-3.5 6.6,-3.2 5.2,-3" fill="#fbbf24" />
      <circle cx="4.4" cy="-3.7" r="0.3" fill="#1a0e05" />
    </g>
  );
}

function Duckling() {
  return (
    <g>
      <ellipse cx="0" cy="1" rx="2.5" ry="0.4" fill="rgba(0,0,0,0.3)" />
      <ellipse cx="0" cy="0" rx="2.2" ry="1.4" fill="#fde047" />
      <ellipse cx="0" cy="-0.2" rx="1.8" ry="1" fill="#fef9c3" />
      <polygon points="-2.2,0 -3,-0.5 -2.2,-0.4" fill="#fde047" />
      <circle cx="1.5" cy="-1.2" r="1" fill="#fde047" />
      <polygon points="2.3,-1.2 3.1,-1 2.3,-0.9" fill="#f59e0b" />
      <circle cx="1.7" cy="-1.4" r="0.2" fill="#1a0e05" />
    </g>
  );
}

function Butterfly() {
  return (
    <g className="bs-butterfly-flap">
      <line x1="0" y1="-3" x2="0" y2="3" stroke="#1a0e05" strokeWidth="0.7" strokeLinecap="round" />
      <path d="M0 -3 Q-1.5 -5 -2.2 -5.5" stroke="#1a0e05" strokeWidth="0.4" fill="none" strokeLinecap="round" />
      <path d="M0 -3 Q1.5 -5 2.2 -5.5" stroke="#1a0e05" strokeWidth="0.4" fill="none" strokeLinecap="round" />
      <ellipse cx="-3"   cy="-1" rx="3"   ry="2.2" fill="#a78bfa" opacity="0.85" />
      <ellipse cx="-2.5" cy="2"  rx="2.2" ry="1.8" fill="#c4b5fd" opacity="0.85" />
      <ellipse cx="3"    cy="-1" rx="3"   ry="2.2" fill="#a78bfa" opacity="0.85" />
      <ellipse cx="2.5"  cy="2"  rx="2.2" ry="1.8" fill="#c4b5fd" opacity="0.85" />
      <circle cx="-3.2" cy="-1" r="0.5" fill="#4c1d95" />
      <circle cx="3.2"  cy="-1" r="0.5" fill="#4c1d95" />
    </g>
  );
}

function Reeds({ x, y }: { x: number; y: number }) {
  return (
    <g stroke="#2d4a1e" strokeWidth="1.2" strokeLinecap="round">
      <line x1={x} y1={y} x2={x - 2} y2={y - 12} />
      <line x1={x + 4} y1={y} x2={x + 5} y2={y - 15} />
      <line x1={x + 8} y1={y} x2={x + 7} y2={y - 10} />
    </g>
  );
}

function Bench({ x, y }: { x: number; y: number }) {
  return (
    <g fill="#5a3010">
      <rect x={x} y={y + 10} width="2" height="12" />
      <rect x={x + 30} y={y + 10} width="2" height="12" />
      <rect x={x - 2} y={y + 6} width="36" height="4" rx="1" fill="#7c4a1a" />
    </g>
  );
}

function Fisher({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x + 7}  y={y + 27} width="2.5" height="7" fill="#1f2937" />
      <rect x={x + 13} y={y + 27} width="2.5" height="7" fill="#1f2937" />
      <ellipse cx={x + 8.2}  cy={y + 35} rx="2.3" ry="1" fill="#1a0e05" />
      <ellipse cx={x + 14.2} cy={y + 35} rx="2.3" ry="1" fill="#1a0e05" />
      <ellipse cx={x + 11} cy={y + 36.2} rx="6" ry="0.8" fill="rgba(0,0,0,0.35)" />
      <rect x={x + 5} y={y + 15} width="12" height="12" fill="#2d4a78" rx="2" />
      <rect x={x + 5} y={y + 15} width="12" height="2" fill="#3a5a88" />
      <circle cx={x + 11} cy={y + 19} r="0.4" fill="#1a1a1a" />
      <circle cx={x + 11} cy={y + 23} r="0.4" fill="#1a1a1a" />
      <circle cx={x + 11} cy={y + 8} r="6" fill="#ffd5aa" />
      <path d={`M${x + 4} ${y + 5} Q${x + 11} ${y - 5} ${x + 18} ${y + 5}`} fill="#5a3a18" />
      <ellipse cx={x + 11} cy={y + 5} rx="7" ry="0.8" fill="#3a1808" />
      <path d={`M${x + 8} ${y + 10} Q${x + 11} ${y + 12} ${x + 14} ${y + 10}`} stroke="#333" strokeWidth="0.5" fill="none" />
      <circle cx={x + 9} cy={y + 7} r="0.4" fill="#1a1a1a" />
      <circle cx={x + 13} cy={y + 7} r="0.4" fill="#1a1a1a" />
    </g>
  );
}

// ── Heißluftballon mit Saunafreunde-Banner ────────────────────────────────
function HotAirBalloon() {
  return (
    <g>
      {/* Seile vom Korb zum Ballon */}
      <line x1="-3" y1="34" x2="-5" y2="22" stroke="#3a2510" strokeWidth="0.5" />
      <line x1="3"  y1="34" x2="5"  y2="22" stroke="#3a2510" strokeWidth="0.5" />
      <line x1="-2" y1="34" x2="-2" y2="22" stroke="#3a2510" strokeWidth="0.4" />
      <line x1="2"  y1="34" x2="2"  y2="22" stroke="#3a2510" strokeWidth="0.4" />

      {/* Ballon-Hülle (Tropfen-Form, Saunafreunde-Farben: dunkelgrün + rot + creme) */}
      <ellipse cx="0" cy="10" rx="12" ry="13" fill="#2d5a3f" />
      {/* Senkrechte Farb-Segmente */}
      <path d="M -8 8 Q -10 14 -5 22 L -2 22 Q -3 14 -2 4 Z" fill="#dc2626" />
      <path d="M 2 4 Q 1 14 2 22 L 5 22 Q 10 14 8 8 Z" fill="#dc2626" />
      <path d="M -2 4 Q -3 14 -2 22 L 2 22 Q 1 14 2 4 Z" fill="#f5e6c8" />
      {/* Highlight links */}
      <ellipse cx="-5" cy="6" rx="3" ry="6" fill="rgba(255,255,255,0.25)" />
      {/* Aufdruck-Stern auf der Front */}
      <polygon
        points="0,12 1.2,15.3 4.5,15.3 1.9,17.4 3,20.6 0,18.7 -3,20.6 -1.9,17.4 -4.5,15.3 -1.2,15.3"
        fill="#fbbf24"
      />
      {/* Ballon-Naht unten (Öffnung) */}
      <ellipse cx="0" cy="22" rx="5" ry="0.8" fill="#1a3a25" />

      {/* Brenner-Flamme im Ballon-Mund (CSS-Pulse) */}
      <g className="bs-balloon-flame" style={{ transformOrigin: '0px 23px' }}>
        <ellipse cx="0" cy="22" rx="1.8" ry="2.5" fill="#fbbf24" />
        <ellipse cx="0" cy="22.5" rx="1.2" ry="1.8" fill="#dc2626" opacity="0.85" />
      </g>

      {/* Korb (Weidengeflecht) */}
      <rect x="-3.5" y="34" width="7" height="5" fill="#7c4a1a" stroke="#3a1808" strokeWidth="0.4" rx="0.4" />
      <line x1="-3.5" y1="36" x2="3.5" y2="36" stroke="#3a1808" strokeWidth="0.3" />
      <line x1="-3.5" y1="38" x2="3.5" y2="38" stroke="#3a1808" strokeWidth="0.3" />
      <line x1="-2"   y1="34" x2="-2"  y2="39" stroke="#3a1808" strokeWidth="0.3" />
      <line x1="0"    y1="34" x2="0"   y2="39" stroke="#3a1808" strokeWidth="0.3" />
      <line x1="2"    y1="34" x2="2"   y2="39" stroke="#3a1808" strokeWidth="0.3" />

      {/* Banner unter dem Korb */}
      <path d="M -8 40 L 8 40 L 6 44 L -6 44 Z" fill="#f5e6c8" stroke="#5a3010" strokeWidth="0.3" />
      <text
        x="0"
        y="43"
        textAnchor="middle"
        fontSize="3"
        fontWeight="800"
        fill="#2d5a3f"
        fontFamily="Inter, sans-serif"
      >
        SAUNAFREUNDE
      </text>

      {/* Mini-Winker im Korb */}
      <circle cx="0" cy="33.5" r="0.9" fill="#ffd5aa" />
      <line x1="0" y1="33" x2="1.2" y2="30" stroke="#ffd5aa" strokeWidth="0.5" strokeLinecap="round" />
    </g>
  );
}

// ── Busch / Strauch — kompakte runde Blattform ────────────────────────────
function Bush({ cx, cy, size = 1, dark = false }: { cx: number; cy: number; size?: number; dark?: boolean }) {
  const base = dark ? '#1f4d2f' : '#2a6e44';
  const mid  = dark ? '#2a5e3a' : '#326c44';
  const hi   = dark ? '#326c44' : '#4a8a5a';
  const w = 8 * size;
  return (
    <g>
      {/* Bodenschatten */}
      <ellipse cx={cx} cy={cy + 0.5} rx={w * 0.7} ry={1.2} fill="rgba(0,0,0,0.35)" />
      {/* Drei überlappende Blattklumpen */}
      <ellipse cx={cx - w * 0.35} cy={cy - w * 0.35} rx={w * 0.55} ry={w * 0.55} fill={base} />
      <ellipse cx={cx + w * 0.30} cy={cy - w * 0.30} rx={w * 0.55} ry={w * 0.55} fill={base} />
      <ellipse cx={cx}            cy={cy - w * 0.55} rx={w * 0.55} ry={w * 0.55} fill={mid} />
      {/* Highlights */}
      <ellipse cx={cx - w * 0.10} cy={cy - w * 0.70} rx={w * 0.22} ry={w * 0.18} fill={hi} opacity="0.75" />
      <ellipse cx={cx + w * 0.40} cy={cy - w * 0.45} rx={w * 0.18} ry={w * 0.15} fill={hi} opacity="0.6" />
      {/* Vereinzelte Beeren-Tupfer (nur bei dunklem Busch) */}
      {dark && (
        <>
          <circle cx={cx - w * 0.20} cy={cy - w * 0.45} r={w * 0.06} fill="#dc2626" />
          <circle cx={cx + w * 0.25} cy={cy - w * 0.60} r={w * 0.06} fill="#dc2626" />
        </>
      )}
    </g>
  );
}

// ── Schwarzwald-Wegweiser ─────────────────────────────────────────────────
function Wegweiser({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {/* Bodenschatten */}
      <ellipse cx={x} cy={y + 1} rx="2.5" ry="0.5" fill="rgba(0,0,0,0.4)" />
      {/* Pfahl */}
      <rect x={x - 0.7} y={y - 22} width="1.4" height="22" fill="#5a3010" />
      <rect x={x - 0.7} y={y - 22} width="0.5" height="22" fill="#7c4a1a" />
      {/* Mini-Stein-Sockel um den Pfahl */}
      <ellipse cx={x} cy={y} rx="2.2" ry="0.8" fill="#7a7a82" />

      {/* Oberes Schild → SAUNA → (zeigt nach rechts) */}
      <g className="bs-sign" style={{ transformOrigin: `${x}px ${y - 20}px` }}>
        <polygon
          points={`${x + 0.5},${y - 21} ${x + 13},${y - 21} ${x + 15},${y - 18.5} ${x + 13},${y - 16} ${x + 0.5},${y - 16}`}
          fill="#7c4a1a"
          stroke="#3a1808"
          strokeWidth="0.4"
        />
        <text x={x + 2} y={y - 18} fontSize="2.6" fontWeight="800" fill="#1a0e05" fontFamily="Inter, sans-serif">SAUNA</text>
        <circle cx={x + 0.6} cy={y - 18.5} r="0.4" fill="#1a1a1a" />
      </g>

      {/* Mittleres Schild ← BERG (zeigt nach links) */}
      <g className="bs-sign" style={{ transformOrigin: `${x}px ${y - 14}px`, animationDelay: '-2s' }}>
        <polygon
          points={`${x - 0.5},${y - 15} ${x - 13},${y - 15} ${x - 15},${y - 12.5} ${x - 13},${y - 10} ${x - 0.5},${y - 10}`}
          fill="#5a3010"
          stroke="#3a1808"
          strokeWidth="0.4"
        />
        <text x={x - 12} y={y - 12} fontSize="2.6" fontWeight="800" fill="#f5e6c8" fontFamily="Inter, sans-serif">BERG</text>
        <circle cx={x - 0.6} cy={y - 12.5} r="0.4" fill="#1a1a1a" />
      </g>

      {/* Unteres Schild → TEICH (zeigt nach rechts, klein) */}
      <g className="bs-sign" style={{ transformOrigin: `${x}px ${y - 8}px`, animationDelay: '-4s' }}>
        <polygon
          points={`${x + 0.5},${y - 9} ${x + 10},${y - 9} ${x + 11.5},${y - 6.5} ${x + 10},${y - 4} ${x + 0.5},${y - 4}`}
          fill="#a06530"
          stroke="#3a1808"
          strokeWidth="0.4"
        />
        <text x={x + 1.6} y={y - 6} fontSize="2.4" fontWeight="800" fill="#1a0e05" fontFamily="Inter, sans-serif">TEICH</text>
      </g>
    </g>
  );
}

// ── Fischreiher (Heron) — steht im Teich, schaut umher ────────────────────
function Heron() {
  return (
    <g>
      {/* Wasser-Reflexion am Fuß */}
      <ellipse cx="0" cy="6.5" rx="2" ry="0.4" fill="rgba(255,255,255,0.4)" />
      {/* Beine (sehr dünn) */}
      <line x1="-0.6" y1="2" x2="-0.6" y2="6" stroke="#d97706" strokeWidth="0.4" />
      <line x1="0.6"  y1="2" x2="0.6"  y2="6" stroke="#d97706" strokeWidth="0.4" />
      {/* Körper grau-weiß */}
      <ellipse cx="0" cy="0" rx="3.5" ry="2.3" fill="#cbd5e1" />
      <ellipse cx="0" cy="0.4" rx="2.8" ry="1.6" fill="#f1f5f9" />
      {/* Flügel-Andeutung */}
      <path d="M -2.5 -0.5 Q 0 1.5 3 -0.5" fill="#94a3b8" />
      <line x1="-2" y1="-0.5" x2="2.5" y2="-0.5" stroke="#64748b" strokeWidth="0.3" />
      {/* Schwanz-Federn */}
      <polygon points="-3.5,0 -5.5,0.5 -3.5,1.2" fill="#94a3b8" />
      {/* Hals — nach oben gebogen */}
      <g className="bs-heron-head" style={{ transformOrigin: '2.5px -1px' }}>
        <path d="M 2.5 -1 Q 4.5 -3 4.2 -6" stroke="#cbd5e1" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        {/* Kopf */}
        <ellipse cx="4.2" cy="-6.5" rx="1.4" ry="1.1" fill="#cbd5e1" />
        {/* Federbusch hinten am Kopf */}
        <path d="M 3.5 -7 Q 2.5 -8 1.5 -7.5" stroke="#475569" strokeWidth="0.4" fill="none" />
        {/* Auge */}
        <circle cx="4.6" cy="-6.7" r="0.35" fill="#fbbf24" />
        <circle cx="4.7" cy="-6.7" r="0.18" fill="#1a0e05" />
        {/* Schnabel — lang spitz gelb */}
        <polygon points="5.5,-6.5 8.2,-6.2 5.5,-6" fill="#f59e0b" stroke="#92400e" strokeWidth="0.2" />
      </g>
    </g>
  );
}

// ── Libelle ──────────────────────────────────────────────────────────────
function Dragonfly({ tint = '#a78bfa' }: { tint?: string }) {
  return (
    <g>
      {/* Körper schmal länglich */}
      <ellipse cx="0" cy="0" rx="2.5" ry="0.4" fill="#1f2937" />
      <ellipse cx="-1.8" cy="0" rx="0.8" ry="0.5" fill={tint} />
      {/* Kopf */}
      <circle cx="2.3" cy="0" r="0.6" fill="#0f172a" />
      <circle cx="2.55" cy="-0.1" r="0.15" fill="#fbbf24" />
      {/* 4 Flügel mit Buzz */}
      <g className="bs-wing-buzz" style={{ transformOrigin: '0.5px -0.5px' }}>
        <ellipse cx="-0.5" cy="-1.6" rx="2"   ry="0.7" fill={tint} opacity="0.6" />
        <ellipse cx="1.5"  cy="-1.6" rx="1.8" ry="0.6" fill={tint} opacity="0.6" />
      </g>
      <g className="bs-wing-buzz" style={{ transformOrigin: '0.5px 0.5px', animationDelay: '-0.06s' }}>
        <ellipse cx="-0.5" cy="1.6" rx="2"   ry="0.7" fill={tint} opacity="0.55" />
        <ellipse cx="1.5"  cy="1.6" rx="1.8" ry="0.6" fill={tint} opacity="0.55" />
      </g>
    </g>
  );
}

// ── Vogelhäuschen am Baumstamm ────────────────────────────────────────────
function Vogelhaus() {
  return (
    <g>
      {/* Aufhängung */}
      <line x1="0" y1="-5" x2="0" y2="0" stroke="#1a1a1a" strokeWidth="0.4" />
      {/* Dach */}
      <polygon points="-4,0 4,0 0,-3" fill="#3a1808" stroke="#1a0808" strokeWidth="0.3" />
      <line x1="-3.5" y1="-0.4" x2="3.5" y2="-0.4" stroke="#1a0808" strokeWidth="0.2" />
      {/* Korpus */}
      <rect x="-3" y="0" width="6" height="6" fill="#a06530" stroke="#3a1808" strokeWidth="0.4" />
      <rect x="-3" y="0" width="6" height="1" fill="#7c4a1a" />
      {/* Eingangsloch */}
      <circle cx="0" cy="2.5" r="1.2" fill="#1a0808" />
      <circle cx="0" cy="2.5" r="0.9" fill="#3a1808" />
      {/* Sitzstange */}
      <line x1="-0.6" y1="3.7" x2="0.6" y2="3.7" stroke="#3a1808" strokeWidth="0.5" />
      {/* Mini-Meise schaut raus */}
      <circle cx="0" cy="2.2" r="0.5" fill="#fde047" />
      <circle cx="0.15" cy="2.1" r="0.15" fill="#1a0e05" />
      {/* Holzmaserung */}
      <line x1="-3" y1="3.5" x2="3" y2="3.5" stroke="rgba(58,24,8,0.4)" strokeWidth="0.2" />
      <line x1="-3" y1="5"   x2="3" y2="5"   stroke="rgba(58,24,8,0.3)" strokeWidth="0.2" />
    </g>
  );
}

// ── Sonnenblume ───────────────────────────────────────────────────────────
function Sunflower({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <g>
      {/* Stiel */}
      <line x1={x} y1={y} x2={x} y2={y - h} stroke="#2d5a3f" strokeWidth="0.8" strokeLinecap="round" />
      {/* Blätter am Stiel */}
      <ellipse cx={x - 2} cy={y - h * 0.5} rx="2" ry="0.8" fill="#326c44" transform={`rotate(-30 ${x - 2} ${y - h * 0.5})`} />
      <ellipse cx={x + 2} cy={y - h * 0.65} rx="2" ry="0.8" fill="#326c44" transform={`rotate(30 ${x + 2} ${y - h * 0.65})`} />
      {/* Blütenblätter (gelb, sternförmig) */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <ellipse
          key={deg}
          cx={x}
          cy={y - h - 2}
          rx="1.2"
          ry="2.5"
          fill="#fbbf24"
          transform={`rotate(${deg} ${x} ${y - h - 2})`}
        />
      ))}
      {/* Innen-Scheibe */}
      <circle cx={x} cy={y - h - 2} r="1.6" fill="#7c2d12" />
      <circle cx={x} cy={y - h - 2} r="1" fill="#92400e" />
      {/* Kerne als Punkte */}
      <circle cx={x - 0.5} cy={y - h - 2.3} r="0.2" fill="#1a0e05" />
      <circle cx={x + 0.4} cy={y - h - 1.8} r="0.2" fill="#1a0e05" />
      <circle cx={x}       cy={y - h - 2}   r="0.2" fill="#1a0e05" />
    </g>
  );
}

// ── Wiesen-Blume (klein, statisch) ────────────────────────────────────────
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

function Firefly({ cx, cy, driftDelay, glowDelay }: { cx: number; cy: number; driftDelay: string; glowDelay: string }) {
  return (
    <g className="bs-firefly-drift" style={{ animationDelay: driftDelay, transformOrigin: `${cx}px ${cy}px` }}>
      <g className="bs-firefly" style={{ animationDelay: glowDelay }}>
        <circle cx={cx} cy={cy} r="3" fill="rgba(252,211,77,0.25)" />
        <circle cx={cx} cy={cy} r="1.5" fill="rgba(254,240,138,0.7)" />
        <circle cx={cx} cy={cy} r="0.6" fill="#fef3c7" />
      </g>
    </g>
  );
}
