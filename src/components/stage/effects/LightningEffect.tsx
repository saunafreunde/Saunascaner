// EPISCHER Blitz: 3 Zickzack-Blitze in verschiedenen Positionen + mehrere
// helle Screen-Flashes + kurzer Donner-Shake. Dauer 2.5s.

export default function LightningEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-lightning-flash {
          0%, 100% { background: transparent; }
          5%, 9%   { background: rgba(255,255,255,0.95); }
          18%, 21% { background: rgba(220,235,255,0.7); }
          35%, 38% { background: rgba(255,255,255,0.85); }
          55%, 57% { background: rgba(200,220,255,0.45); }
          80%, 82% { background: rgba(255,255,255,0.3); }
        }
        @keyframes fx-lightning-bolt-1 {
          0%, 20%, 30%, 100% { opacity: 0; }
          5%, 15%            { opacity: 1; transform: scale(1); }
          18%                { opacity: 0.8; transform: scale(1.03); }
        }
        @keyframes fx-lightning-bolt-2 {
          0%, 35%, 50%, 100% { opacity: 0; }
          37%, 45%           { opacity: 1; transform: scale(1); }
        }
        @keyframes fx-lightning-bolt-3 {
          0%, 60%, 80%, 100% { opacity: 0; }
          62%, 75%           { opacity: 1; transform: scale(1); }
        }
        @keyframes fx-lightning-shake {
          0%, 100% { transform: translate(0, 0); }
          5%       { transform: translate(-4px, 2px); }
          10%      { transform: translate(3px, -2px); }
          15%      { transform: translate(-2px, 3px); }
          20%      { transform: translate(2px, -1px); }
          35%      { transform: translate(-3px, 1px); }
          40%      { transform: translate(2px, -2px); }
        }
        .fx-lightning-overlay {
          position: absolute; inset: 0;
          animation: fx-lightning-flash 2.5s ease-out forwards;
          mix-blend-mode: screen;
        }
        .fx-lightning-shake {
          position: absolute; inset: 0;
          animation: fx-lightning-shake 2.5s ease-out forwards;
        }
        .fx-lightning-bolt {
          position: absolute; top: 0;
          height: 80vh;
          will-change: transform, opacity;
          filter: drop-shadow(0 0 12px #fde047) drop-shadow(0 0 30px #fbbf24) drop-shadow(0 0 60px #fbbf24);
        }
        .fx-lightning-bolt-1 { left: 15%; width: 200px; animation: fx-lightning-bolt-1 2.5s ease-out forwards; }
        .fx-lightning-bolt-2 { left: 55%; width: 240px; animation: fx-lightning-bolt-2 2.5s ease-out forwards; transform-origin: 50% 0%; }
        .fx-lightning-bolt-3 { left: 75%; width: 180px; animation: fx-lightning-bolt-3 2.5s ease-out forwards; }
      `}</style>
      <div className="fx-lightning-overlay" />
      <div className="fx-lightning-shake">
        <svg className="fx-lightning-bolt fx-lightning-bolt-1" viewBox="0 0 100 80" preserveAspectRatio="none">
          <polygon
            points="55,0 38,22 52,24 30,48 48,50 22,80 65,30 50,28 65,8 55,0"
            fill="#fef3c7"
            stroke="#fbbf24"
            strokeWidth="0.4"
          />
        </svg>
        <svg className="fx-lightning-bolt fx-lightning-bolt-2" viewBox="0 0 100 80" preserveAspectRatio="none">
          <polygon
            points="45,0 60,18 48,20 65,42 50,44 75,75 35,28 50,26 38,10 45,0"
            fill="#fef3c7"
            stroke="#fbbf24"
            strokeWidth="0.4"
          />
        </svg>
        <svg className="fx-lightning-bolt fx-lightning-bolt-3" viewBox="0 0 100 80" preserveAspectRatio="none">
          <polygon
            points="50,0 35,20 50,22 28,46 45,50 25,80 60,32 45,30 60,10 50,0"
            fill="#fef3c7"
            stroke="#fbbf24"
            strokeWidth="0.4"
          />
        </svg>
      </div>
    </>
  );
}
