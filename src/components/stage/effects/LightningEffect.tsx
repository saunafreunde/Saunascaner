// Kurzer Blitz: 2 weiße Aufflacker + Zickzack-Form. Dauer 1.5s.

export default function LightningEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-lightning-flash {
          0%, 100% { background: transparent; }
          10%, 14% { background: rgba(255,255,255,0.85); }
          40%, 44% { background: rgba(255,255,255,0.6); }
        }
        @keyframes fx-lightning-bolt {
          0%, 25%, 30%, 100% { opacity: 0; }
          10%, 12%, 27%      { opacity: 1; }
        }
        .fx-lightning-overlay {
          position: absolute; inset: 0;
          animation: fx-lightning-flash 1.5s ease-out forwards;
        }
        .fx-lightning-bolt {
          position: absolute; top: 0;
          width: 100%;
          height: 60vh;
          animation: fx-lightning-bolt 1.5s ease-out forwards;
        }
      `}</style>
      <div className="fx-lightning-overlay" />
      <svg className="fx-lightning-bolt" viewBox="0 0 100 60" preserveAspectRatio="none">
        <polygon
          points="50,0 45,20 52,22 42,40 48,42 38,60 56,30 49,28 56,12 50,10 55,0"
          fill="#fef3c7"
          stroke="#fbbf24"
          strokeWidth="0.3"
          style={{ filter: 'drop-shadow(0 0 8px #fde047)' }}
        />
      </svg>
    </>
  );
}
