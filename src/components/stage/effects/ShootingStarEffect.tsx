// Sternschnuppe schießt diagonal von oben-rechts nach unten-links. Dauer 3s.

export default function ShootingStarEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-shoot-fly {
          0%   { transform: translate3d(110vw, -10vh, 0); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translate3d(-10vw, 80vh, 0); opacity: 0; }
        }
        .fx-shoot-wrap {
          position: absolute; top: 0; left: 0;
          will-change: transform, opacity;
          animation: fx-shoot-fly 3s ease-in forwards;
        }
        .fx-shoot-trail {
          position: absolute; top: 6px; left: -200px;
          width: 200px; height: 2px;
          background: linear-gradient(to right, transparent, rgba(255,255,200,0.7));
          transform-origin: 100% 50%;
          transform: rotate(-25deg);
        }
        .fx-shoot-star {
          width: 16px; height: 16px;
          background: radial-gradient(circle, #fef3c7 0%, #fbbf24 60%, transparent 100%);
          border-radius: 50%;
          box-shadow: 0 0 12px #fde047;
        }
      `}</style>
      <div className="fx-shoot-wrap">
        <div className="fx-shoot-trail" />
        <div className="fx-shoot-star" />
      </div>
    </>
  );
}
