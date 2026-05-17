// Tornado: rotierender lila-grauer Wirbel kreuzt die Tafel von rechts nach
// links, mit fliegenden Wind-Partikeln. Dauer 8s.

const DEBRIS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  top: 20 + ((i * 7) % 70),
  size: 4 + ((i * 0.7) % 8),
  spinDelay: -((i * 0.13) % 1.5),
  color: i % 3 === 0 ? '#7c3aed' : i % 3 === 1 ? '#9ca3af' : '#6b7280',
}));

export default function TornadoEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-tornado-cross {
          0%   { transform: translate3d(110vw, 0, 0); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translate3d(-30vw, 0, 0); opacity: 0; }
        }
        @keyframes fx-tornado-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes fx-tornado-sway {
          0%, 100% { transform: skewX(-3deg); }
          50%      { transform: skewX(3deg); }
        }
        @keyframes fx-tornado-debris-fly {
          0%   { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translate3d(-30vw, var(--dy, 0px), 0) rotate(720deg); opacity: 0; }
        }
        @keyframes fx-tornado-darken {
          0%, 100% { background: transparent; }
          15%, 85% { background: rgba(30, 20, 40, 0.35); }
        }
        .fx-tornado-darken {
          position: absolute; inset: 0;
          animation: fx-tornado-darken 8s ease-in-out forwards;
          pointer-events: none;
        }
        .fx-tornado-wrap {
          position: absolute; bottom: 0;
          width: 200px; height: 100vh;
          will-change: transform, opacity;
          animation: fx-tornado-cross 8s ease-in-out forwards;
        }
        .fx-tornado-sway {
          width: 100%; height: 100%;
          animation: fx-tornado-sway 1.2s ease-in-out infinite;
          transform-origin: 50% 100%;
        }
        .fx-tornado-cone {
          position: absolute; bottom: 0; left: 50%;
          transform: translateX(-50%);
          width: 100%; height: 100%;
          background: conic-gradient(from 0deg at 50% 100%,
            rgba(124, 58, 237, 0.0) 0deg,
            rgba(124, 58, 237, 0.6) 90deg,
            rgba(76, 29, 149, 0.8) 180deg,
            rgba(124, 58, 237, 0.6) 270deg,
            rgba(124, 58, 237, 0.0) 360deg);
          clip-path: polygon(45% 0%, 55% 0%, 90% 100%, 10% 100%);
          animation: fx-tornado-spin 0.8s linear infinite;
          filter: blur(4px);
        }
        .fx-tornado-cone-inner {
          position: absolute; bottom: 0; left: 50%;
          transform: translateX(-50%);
          width: 80%; height: 90%;
          background: conic-gradient(from 180deg at 50% 100%,
            rgba(196, 181, 253, 0.0) 0deg,
            rgba(196, 181, 253, 0.7) 120deg,
            rgba(167, 139, 250, 0.9) 240deg,
            rgba(196, 181, 253, 0.0) 360deg);
          clip-path: polygon(48% 0%, 52% 0%, 90% 100%, 10% 100%);
          animation: fx-tornado-spin 0.5s linear infinite reverse;
          filter: blur(3px);
        }
        .fx-tornado-debris {
          position: absolute; right: 50%;
          will-change: transform, opacity;
          animation: fx-tornado-debris-fly 1.8s ease-out infinite;
          animation-delay: var(--sd, 0s);
          border-radius: 30%;
        }
      `}</style>
      <div className="fx-tornado-darken" />
      <div className="fx-tornado-wrap">
        <div className="fx-tornado-sway">
          <div className="fx-tornado-cone" />
          <div className="fx-tornado-cone-inner" />
          {DEBRIS.map((d) => (
            <span
              key={d.id}
              className="fx-tornado-debris"
              style={{
                top: `${d.top}%`,
                width: `${d.size}px`,
                height: `${d.size}px`,
                background: d.color,
                '--sd': `${d.spinDelay}s`,
                '--dy': `${((d.id * 13) % 200) - 100}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
    </>
  );
}
