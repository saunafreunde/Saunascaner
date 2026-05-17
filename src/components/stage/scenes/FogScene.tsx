// Diffuser Nebel-Layer: 3 große weiche Bänder driften horizontal.

export default function FogScene() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 bottom-0 overflow-hidden"
      style={{ zIndex: 27 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-fog-drift {
          0%   { transform: translate3d(-30vw, 0, 0); }
          100% { transform: translate3d(30vw, 0, 0); }
        }
        .scn-fog-band {
          position: absolute; left: -30vw; right: -30vw;
          height: 90px;
          background: radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.2) 50%, transparent 100%);
          will-change: transform;
          animation: scn-fog-drift var(--d, 80s) ease-in-out infinite alternate;
          animation-delay: var(--del, 0s);
        }
        @media (prefers-reduced-motion: reduce) {
          .scn-fog-band { animation: none; }
        }
      `}</style>
      <div className="scn-fog-band" style={{ top: '40%', '--d': '90s', '--del': '0s' } as React.CSSProperties} />
      <div className="scn-fog-band" style={{ top: '55%', '--d': '110s', '--del': '-25s' } as React.CSSProperties} />
      <div className="scn-fog-band" style={{ top: '70%', '--d': '75s', '--del': '-50s' } as React.CSSProperties} />
    </div>
  );
}
