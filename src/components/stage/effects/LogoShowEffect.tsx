// „Große Logo-Show" (~25s), 4 Phasen:
//  1) 0-6s  Feuerwerks-Salve (10 Raketen in Wellen, je 24 Partikel)
//  2) 5-9s  Logo-Einflug mit rotierenden Lichtstrahlen + Konfetti-Regen
//  3) 9-20s Dauer-Glühen + aufsteigende Funken
//  4) 20-25s goldenes Finale (zentraler Groß-Burst + Logo-Puls) → Ausklang
// Rein CSS / GPU, keine JS-Timer (24/7-Tafel-tauglich).
import type { CSSProperties } from 'react';
import { SaunafreundeLogo } from './SaunafreundeLogo';

const COLORS = ['#ef4444', '#fbbf24', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#f59e0b', '#22d3ee', '#f97316', '#e11d48'];
const ROCKETS = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  left: 8 + (i * 9.3) % 82,
  delay: (i * 0.55) % 5.5,
  peak: 46 + (i * 11) % 34,
  color: COLORS[i % COLORS.length],
}));
const PB = 24;
const CONFETTI = Array.from({ length: 46 }, (_, i) => ({
  id: i,
  left: (i * 2.17 + (i % 5) * 3) % 100,
  delay: 5 + (i % 10) * 0.35,
  dur: 4.5 + (i % 6) * 0.6,
  color: COLORS[i % COLORS.length],
  rot: (i * 47) % 360,
}));
const SPARKS = Array.from({ length: 26 }, (_, i) => ({
  id: i,
  left: 30 + (i * 1.7 % 40),
  delay: 9 + (i % 12) * 0.5,
  dx: ((i % 7) - 3) * 22,
}));
const FINALE = 24; // Partikel im Finale-Burst

export default function LogoShowEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-ls-rise {
          0%   { transform: translate3d(0,0,0) scale(1); opacity:0; }
          6%   { opacity:1; }
          85%  { transform: translate3d(0, calc(-1 * var(--peak,60vh)), 0) scale(1); opacity:1; }
          100% { transform: translate3d(0, calc(-1 * var(--peak,60vh)), 0) scale(0); opacity:0; }
        }
        @keyframes fx-ls-p {
          0%   { transform: translate3d(0,0,0) scale(0.3); opacity:0; }
          8%   { transform: translate3d(var(--bx),var(--by),0) scale(1.3); opacity:1; }
          45%  { transform: translate3d(calc(var(--bx)*2.6), calc(var(--by)*2.6 + 26px),0) scale(1); opacity:1; }
          100% { transform: translate3d(calc(var(--bx)*3.3), calc(var(--by)*3.3 + 190px),0) scale(0.2); opacity:0; }
        }
        @keyframes fx-ls-show { to { opacity:1; } }
        @keyframes fx-ls-flash {
          0%,100% { opacity:0; transform: translate(-50%,-50%) scale(0.2); }
          15%     { opacity:0.9; transform: translate(-50%,-50%) scale(1); }
          100%    { opacity:0; transform: translate(-50%,-50%) scale(3); }
        }
        @keyframes fx-ls-logo {
          0%   { opacity:0; transform: translate3d(0,44px,0) scale(0.20); filter: blur(18px); }
          18%  { opacity:0; transform: translate3d(0,44px,0) scale(0.20); filter: blur(18px); }
          25%  { opacity:1; transform: translate3d(0,0,0) scale(1.09); filter: blur(0); }
          29%  { transform: translate3d(0,0,0) scale(0.98); }
          33%  { transform: translate3d(0,0,0) scale(1); }
          79%  { opacity:1; transform: translate3d(0,0,0) scale(1); }
          83%  { transform: translate3d(0,0,0) scale(1.10); }
          89%  { transform: translate3d(0,0,0) scale(1); }
          96%  { opacity:1; transform: translate3d(0,0,0) scale(1); }
          100% { opacity:0; transform: translate3d(0,0,0) scale(1.05); }
        }
        @keyframes fx-ls-glow {
          0%,100% { filter: drop-shadow(0 0 10px rgba(251,191,36,0.15)); }
          50%     { filter: drop-shadow(0 0 30px rgba(251,191,36,0.6)) drop-shadow(0 0 70px rgba(74,122,52,0.4)); }
        }
        @keyframes fx-ls-rays-in { 0%,18%{opacity:0} 30%{opacity:0.5} 76%{opacity:0.5} 84%{opacity:0.8} 100%{opacity:0} }
        @keyframes fx-ls-rays-spin { to { transform: translate(-50%,-50%) rotate(360deg); } }
        @keyframes fx-ls-conf { 0%{opacity:0; transform: translate3d(0,-10vh,0) rotate(0)} 8%{opacity:1} 100%{opacity:0; transform: translate3d(var(--cx,20px),108vh,0) rotate(720deg)} }
        @keyframes fx-ls-spark { 0%{opacity:0; transform: translate3d(0,0,0) scale(0.5)} 15%{opacity:1} 100%{opacity:0; transform: translate3d(var(--dx,0),-160px,0) scale(0.2)} }
        @keyframes fx-ls-finale {
          0%   { transform: translate3d(0,0,0) scale(0.3); opacity:0; }
          8%   { transform: translate3d(var(--bx),var(--by),0) scale(1.5); opacity:1; }
          100% { transform: translate3d(calc(var(--bx)*3.6), calc(var(--by)*3.6 + 160px),0) scale(0.2); opacity:0; }
        }
        @keyframes fx-ls-screen { 0%,100%{opacity:0} 4%{opacity:0.16} 8%{opacity:0} 80%{opacity:0} 84%{opacity:0.22} 90%{opacity:0} }

        .fx-ls-vig { position:absolute; inset:0; background: radial-gradient(ellipse at 50% 48%, transparent 34%, rgba(0,0,0,0.55) 100%); }
        .fx-ls-screen { position:absolute; inset:0; background:#fff; mix-blend-mode:screen; animation: fx-ls-screen 25s ease-in-out forwards; }
        .fx-ls-rocketwrap { position:absolute; bottom:56px; }
        .fx-ls-rocket { width:5px; height:18px; border-radius:50%; background: var(--c,#fff); opacity:0; animation: fx-ls-rise 2.2s ease-out var(--del,0s) forwards; filter: drop-shadow(0 0 8px var(--c,#fff)); will-change: transform,opacity; }
        .fx-ls-burst { position:absolute; opacity:0; mix-blend-mode:screen; animation: fx-ls-show 0s linear forwards; animation-delay: calc(var(--del,0s) + 2.1s); }
        .fx-ls-flash { position:absolute; left:0; top:0; width:130px; height:130px; border-radius:50%; background: radial-gradient(circle, var(--c,#fff) 0%, transparent 70%); animation: fx-ls-flash 0.8s ease-out forwards; mix-blend-mode:screen; will-change: transform,opacity; }
        .fx-ls-part { position:absolute; left:0; top:0; width:10px; height:10px; border-radius:50%; background: var(--c,#fff); filter: drop-shadow(0 0 12px var(--c,#fff)) drop-shadow(0 0 24px var(--c,#fff)); animation: fx-ls-p 2.8s ease-out forwards; will-change: transform,opacity; }

        .fx-ls-center { position:absolute; inset:0; display:grid; place-items:center; }
        .fx-ls-rays { position:absolute; left:50%; top:50%; width:min(120vw,1800px); height:min(120vw,1800px); border-radius:50%; background: repeating-conic-gradient(from 0deg, rgba(255,240,190,0.14) 0deg 5deg, transparent 5deg 16deg); mix-blend-mode:screen; animation: fx-ls-rays-spin 22s linear infinite, fx-ls-rays-in 25s ease-in-out forwards; will-change: transform,opacity; }
        .fx-ls-wrap { width:min(76vw,1240px); animation: fx-ls-logo 25s cubic-bezier(0.22,1,0.36,1) forwards; will-change: transform,opacity,filter; }
        .fx-ls-inner { background: linear-gradient(135deg,#ffffff,#edf3e7); border-radius: 2.2vw; padding: 3.2% 4.4%; box-shadow: 0 24px 70px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.85); animation: fx-ls-glow 2.6s ease-in-out 6.2s infinite; will-change: filter; }
        .fx-ls-inner svg { display:block; width:100%; height:auto; }

        .fx-ls-conf { position:absolute; top:0; width:10px; height:16px; border-radius:2px; background: var(--c); animation: fx-ls-conf var(--dur,6s) linear var(--del,0s) forwards; will-change: transform,opacity; }
        .fx-ls-spark { position:absolute; bottom:32%; width:6px; height:6px; border-radius:50%; background:#fde68a; filter: drop-shadow(0 0 8px #fbbf24); mix-blend-mode:screen; animation: fx-ls-spark 2.4s ease-out var(--del,0s) infinite; will-change: transform,opacity; }

        .fx-ls-finaleburst { position:absolute; left:50%; top:46%; }
        .fx-ls-finalepart { position:absolute; left:0; top:0; width:12px; height:12px; border-radius:50%; background: var(--c,#fde047); filter: drop-shadow(0 0 14px var(--c,#fde047)) drop-shadow(0 0 30px var(--c,#fde047)); mix-blend-mode:screen; animation: fx-ls-finale 3.6s ease-out 20s both; will-change: transform,opacity; }
      `}</style>

      <div className="fx-ls-vig" />
      <div className="fx-ls-screen" />

      {/* Phase 1: Raketen-Salve */}
      {ROCKETS.map((r) => (
        <div key={r.id} className="fx-ls-rocketwrap" style={{ left: `${r.left}%` }}>
          <div className="fx-ls-rocket" style={{ '--c': r.color, '--del': `${r.delay}s`, '--peak': `${r.peak}vh` } as CSSProperties} />
          <div className="fx-ls-burst" style={{ top: `-${r.peak}vh`, '--del': `${r.delay}s` } as CSSProperties}>
            <div className="fx-ls-flash" style={{ '--c': r.color, animationDelay: `${r.delay + 2.1}s` } as CSSProperties} />
            {Array.from({ length: PB }).map((_, pi) => {
              const a = (pi / PB) * Math.PI * 2;
              const rad = 60 + (pi % 3) * 16;
              return (
                <span key={pi} className="fx-ls-part" style={{
                  '--c': r.color,
                  '--bx': `${Math.cos(a) * rad}px`,
                  '--by': `${Math.sin(a) * rad}px`,
                  animationDelay: `${r.delay + 2.1 + (pi % 4) * 0.05}s`,
                } as CSSProperties} />
              );
            })}
          </div>
        </div>
      ))}

      {/* Phase 2: Konfetti */}
      {CONFETTI.map((c) => (
        <div key={c.id} className="fx-ls-conf" style={{
          left: `${c.left}%`, background: c.color,
          '--dur': `${c.dur}s`, '--del': `${c.delay}s`, '--cx': `${(c.rot % 60) - 30}px`,
          transform: `rotate(${c.rot}deg)`,
        } as CSSProperties} />
      ))}

      {/* Phase 2+3: Logo + Lichtstrahlen */}
      <div className="fx-ls-center">
        <div className="fx-ls-rays" />
        <div className="fx-ls-wrap">
          <div className="fx-ls-inner">
            <SaunafreundeLogo />
          </div>
        </div>
      </div>

      {/* Phase 3: aufsteigende Funken */}
      {SPARKS.map((s) => (
        <span key={s.id} className="fx-ls-spark" style={{ left: `${s.left}%`, '--del': `${s.delay}s`, '--dx': `${s.dx}px` } as CSSProperties} />
      ))}

      {/* Phase 4: goldenes Finale */}
      <div className="fx-ls-finaleburst">
        {Array.from({ length: FINALE }).map((_, pi) => {
          const a = (pi / FINALE) * Math.PI * 2;
          const rad = 70 + (pi % 4) * 18;
          const gold = ['#fde047', '#fbbf24', '#f59e0b', '#fff7cc'][pi % 4];
          return (
            <span key={pi} className="fx-ls-finalepart" style={{
              '--c': gold,
              '--bx': `${Math.cos(a) * rad}px`,
              '--by': `${Math.sin(a) * rad}px`,
              animationDelay: `${20 + (pi % 5) * 0.05}s`,
            } as CSSProperties} />
          );
        })}
      </div>
    </>
  );
}
