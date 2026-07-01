// „Logo-Reveal" (~10s): Vignette dimmt ab → Saunafreunde-Logo fliegt mit Glow
// + Overshoot herein → hält mit sanftem Gold-Glühen → 5 kleine Feuerwerks-Bursts
// drumherum → Ausblenden. Rein CSS / GPU (transform + opacity + filter), keine
// JS-Timer — passt zur 24/7-Tafel.
import type { CSSProperties } from 'react';
import { SaunafreundeLogo } from './SaunafreundeLogo';

const BURSTS = [
  { left: 24, top: 30, color: '#fbbf24', delay: 1.6 },
  { left: 77, top: 26, color: '#22c55e', delay: 2.7 },
  { left: 16, top: 64, color: '#ec4899', delay: 3.9 },
  { left: 84, top: 62, color: '#38bdf8', delay: 5.1 },
  { left: 50, top: 16, color: '#f59e0b', delay: 6.3 },
];
const PARTICLES = 16;

export default function LogoRevealEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-lr-vig { 0%{opacity:0} 12%{opacity:1} 84%{opacity:1} 100%{opacity:0} }
        @keyframes fx-lr-logo {
          0%   { opacity:0; transform: translate3d(0,24px,0) scale(0.35); filter: blur(14px); }
          14%  { opacity:1; transform: translate3d(0,0,0) scale(1.07); filter: blur(0); }
          19%  { transform: translate3d(0,0,0) scale(0.98); }
          24%  { transform: translate3d(0,0,0) scale(1); }
          84%  { opacity:1; transform: translate3d(0,0,0) scale(1); }
          100% { opacity:0; transform: translate3d(0,0,0) scale(1.06); }
        }
        @keyframes fx-lr-glow2 {
          0%,100% { filter: drop-shadow(0 0 6px rgba(251,191,36,0.0)); }
          50%     { filter: drop-shadow(0 0 26px rgba(251,191,36,0.55)) drop-shadow(0 0 60px rgba(74,122,52,0.35)); }
        }
        @keyframes fx-lr-halo {
          0%,100% { opacity:0.30; transform: translate(-50%,-50%) scale(0.92); }
          50%     { opacity:0.62; transform: translate(-50%,-50%) scale(1.10); }
        }
        @keyframes fx-lr-p {
          0%   { transform: translate3d(0,0,0) scale(0.4); opacity:0; }
          10%  { opacity:1; transform: translate3d(var(--bx),var(--by),0) scale(1.2); }
          100% { transform: translate3d(calc(var(--bx)*2.4), calc(var(--by)*2.4 + 120px),0) scale(0.2); opacity:0; }
        }
        @keyframes fx-lr-flash {
          0%,100% { opacity:0; transform: translate(-50%,-50%) scale(0.2); }
          16%     { opacity:0.9; transform: translate(-50%,-50%) scale(1); }
          100%    { opacity:0; transform: translate(-50%,-50%) scale(2.6); }
        }
        .fx-lr-vig { position:absolute; inset:0; background: radial-gradient(ellipse at 50% 46%, transparent 30%, rgba(0,0,0,0.72) 100%); animation: fx-lr-vig 10s ease-in-out forwards; }
        .fx-lr-center { position:absolute; inset:0; display:grid; place-items:center; }
        .fx-lr-halo { position:absolute; left:50%; top:50%; width:min(70vw,1100px); height:min(48vh,620px); border-radius:50%; background: radial-gradient(ellipse, rgba(255,236,170,0.55) 0%, rgba(74,122,52,0.25) 40%, transparent 70%); animation: fx-lr-halo 3.2s ease-in-out 0.6s infinite; will-change: transform,opacity; }
        .fx-lr-wrap { width:min(74vw,1200px); animation: fx-lr-logo 10s cubic-bezier(0.22,1,0.36,1) forwards; will-change: transform,opacity,filter; }
        .fx-lr-inner { background: linear-gradient(135deg,#ffffff,#edf3e7); border-radius: 2.4vw; padding: 3.4% 4.6%; box-shadow: 0 22px 64px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.85); animation: fx-lr-glow2 2.4s ease-in-out 1.6s infinite; will-change: filter; }
        .fx-lr-inner svg { display:block; width:100%; height:auto; }
        .fx-lr-burst { position:absolute; }
        .fx-lr-flash { position:absolute; left:0; top:0; width:120px; height:120px; border-radius:50%; background: radial-gradient(circle, var(--c) 0%, transparent 68%); mix-blend-mode:screen; animation: fx-lr-flash 0.8s ease-out var(--del) both; will-change: transform,opacity; }
        .fx-lr-part { position:absolute; left:0; top:0; width:9px; height:9px; border-radius:50%; background: var(--c); mix-blend-mode:screen; filter: drop-shadow(0 0 10px var(--c)) drop-shadow(0 0 20px var(--c)); animation: fx-lr-p 2.4s ease-out var(--del) both; will-change: transform,opacity; }
      `}</style>

      <div className="fx-lr-vig" />
      <div className="fx-lr-halo" />

      {BURSTS.map((b, bi) => (
        <div key={bi} className="fx-lr-burst" style={{ left: `${b.left}%`, top: `${b.top}%` }}>
          <div className="fx-lr-flash" style={{ '--c': b.color, '--del': `${b.delay}s` } as CSSProperties} />
          {Array.from({ length: PARTICLES }).map((_, pi) => {
            const a = (pi / PARTICLES) * Math.PI * 2;
            const r = 46 + (pi % 3) * 14;
            return (
              <span
                key={pi}
                className="fx-lr-part"
                style={{
                  '--c': b.color,
                  '--bx': `${Math.cos(a) * r}px`,
                  '--by': `${Math.sin(a) * r}px`,
                  '--del': `${b.delay + (pi % 4) * 0.04}s`,
                } as CSSProperties}
              />
            );
          })}
        </div>
      ))}

      <div className="fx-lr-center">
        <div className="fx-lr-wrap">
          <div className="fx-lr-inner">
            <SaunafreundeLogo />
          </div>
        </div>
      </div>
    </>
  );
}
