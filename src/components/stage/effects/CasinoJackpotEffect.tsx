// Casino-Jackpot — Slot-Maschine mit rotierenden Rollen, Münzen-Regen,
// JACKPOT-Banner. 10s.

const COINS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  delay: 3 + i * 0.08,
  x: 5 + (i * 1.6) % 90,
  duration: 2 + (i % 3) * 0.4,
  rotateSpeed: 0.5 + (i % 4) * 0.2,
}));

export default function CasinoJackpotEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-casino-roll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-900px); }
        }
        @keyframes fx-casino-roll-stop {
          0% { transform: translateY(-900px); }
          100% { transform: translateY(-630px); }
        }
        @keyframes fx-casino-machine-shake {
          0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
          25%      { transform: translate(-50%, -50%) rotate(-1deg); }
          75%      { transform: translate(-50%, -50%) rotate(1deg); }
        }
        @keyframes fx-casino-coin-fall {
          0%   { transform: translate3d(0, -100px, 0) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translate3d(0, 110vh, 0) rotate(calc(720deg * var(--rs, 1))); opacity: 0.7; }
        }
        @keyframes fx-casino-banner-burst {
          0%   { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          50%  { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
          60%  { transform: translate(-50%, -50%) scale(1); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes fx-casino-banner-rainbow {
          0%   { color: #fbbf24; text-shadow: 0 0 16px #fbbf24; }
          25%  { color: #ef4444; text-shadow: 0 0 16px #ef4444; }
          50%  { color: #22c55e; text-shadow: 0 0 16px #22c55e; }
          75%  { color: #3b82f6; text-shadow: 0 0 16px #3b82f6; }
          100% { color: #fbbf24; text-shadow: 0 0 16px #fbbf24; }
        }
        @keyframes fx-casino-light-rotate {
          to { transform: rotate(360deg); }
        }

        .fx-casino-machine {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          will-change: transform;
          animation: fx-casino-machine-shake 0.1s ease-in-out infinite;
        }
        .fx-casino-reel-window { overflow: hidden; }
        .fx-casino-reel-strip {
          will-change: transform;
          animation: fx-casino-roll 0.15s linear infinite;
        }
        .fx-casino-reel-strip.stopped {
          animation: fx-casino-roll-stop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .fx-casino-coin {
          position: absolute; top: 0;
          width: 32px; height: 32px;
          background: radial-gradient(circle, #fef3c7 0%, #fbbf24 40%, #ca8a04 80%, #78350f 100%);
          border-radius: 50%;
          will-change: transform, opacity;
          animation: fx-casino-coin-fall var(--du, 2s) ease-in forwards;
          animation-delay: var(--d, 0s);
          box-shadow: inset 0 -3px 6px rgba(0,0,0,0.3), 0 0 8px rgba(251,191,36,0.7);
        }
        .fx-casino-coin::before {
          content: '$';
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          font-weight: 900; color: #78350f; font-size: 22px;
        }
        .fx-casino-banner {
          position: absolute; top: 18%; left: 50%;
          transform: translate(-50%, -50%);
          font-size: clamp(40px, 10vw, 120px);
          font-weight: 900;
          letter-spacing: 0.1em;
          will-change: transform, opacity;
          animation: fx-casino-banner-burst 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 3s forwards,
                     fx-casino-banner-rainbow 1s linear 3.5s infinite;
          opacity: 0;
        }
        .fx-casino-light-spin {
          position: absolute; inset: 0;
          background: conic-gradient(from 0deg, transparent 0deg, #fbbf24 30deg, transparent 60deg, transparent 120deg, #ef4444 150deg, transparent 180deg, transparent 240deg, #22c55e 270deg, transparent 300deg);
          opacity: 0.25;
          animation: fx-casino-light-spin-anim 4s linear infinite 3s;
          pointer-events: none;
          mix-blend-mode: screen;
        }
        @keyframes fx-casino-light-spin-anim { to { transform: rotate(360deg); } }
      `}</style>

      <div className="fx-casino-light-spin" />

      <div className="fx-casino-machine">
        <svg viewBox="0 0 420 500" width="420" height="500">
          {/* Maschinen-Gehäuse (rot) */}
          <rect x="10" y="80" width="400" height="380" rx="20" fill="#991b1b" stroke="#450a0a" strokeWidth="3" />
          {/* Top-Banner */}
          <rect x="40" y="20" width="340" height="80" rx="12" fill="#dc2626" stroke="#fbbf24" strokeWidth="4" />
          <text x="210" y="72" textAnchor="middle" fontSize="44" fontWeight="900" fill="#fbbf24" stroke="#7c2d12" strokeWidth="1.5">CASINO</text>
          {/* Lichter oben */}
          <circle cx="50" cy="60" r="6" fill="#fbbf24" />
          <circle cx="80" cy="60" r="6" fill="#ef4444" />
          <circle cx="340" cy="60" r="6" fill="#22c55e" />
          <circle cx="370" cy="60" r="6" fill="#fbbf24" />
          {/* Slot-Rollen-Container */}
          <rect x="40" y="140" width="340" height="180" rx="8" fill="#1c1917" stroke="#fbbf24" strokeWidth="3" />
          {/* 3 Rollen-Windows */}
          {[0, 1, 2].map((reel) => (
            <g key={reel}>
              <rect x={60 + reel * 105} y="155" width="95" height="150" rx="4" fill="#f5f5f4" />
              {/* Animierte Symbol-Strip per foreignObject damit wir CSS-Anim nutzen */}
              <foreignObject x={60 + reel * 105} y="155" width="95" height="150" className="fx-casino-reel-window">
                <div
                  className={`fx-casino-reel-strip ${reel === 0 ? 'stopped' : reel === 1 ? 'stopped' : 'stopped'}`}
                  style={{
                    animationDelay: `${1.5 + reel * 0.5}s`,
                    fontSize: '70px',
                    lineHeight: '150px',
                    textAlign: 'center',
                  }}
                >
                  <div>🍒</div>
                  <div>🍋</div>
                  <div>🔔</div>
                  <div>💎</div>
                  <div>⭐</div>
                  <div>🍀</div>
                  <div style={{ color: '#dc2626', fontWeight: 900 }}>7</div>
                  <div style={{ color: '#dc2626', fontWeight: 900 }}>7</div>
                  <div style={{ color: '#dc2626', fontWeight: 900 }}>7</div>
                </div>
              </foreignObject>
            </g>
          ))}
          {/* Mittel-Linie (Gewinn-Linie) */}
          <line x1="55" y1="230" x2="365" y2="230" stroke="#fbbf24" strokeWidth="2" strokeDasharray="6 3" opacity="0.7" />
          {/* Coin-Slot */}
          <rect x="170" y="350" width="80" height="30" rx="4" fill="#1c1917" />
          <text x="210" y="372" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fbbf24">INSERT</text>
          {/* Hebel rechts */}
          <line x1="410" y1="200" x2="450" y2="160" stroke="#1c1917" strokeWidth="6" strokeLinecap="round" />
          <circle cx="455" cy="155" r="14" fill="#ef4444" stroke="#7f1d1d" strokeWidth="2" />
          {/* Output unten */}
          <rect x="100" y="400" width="220" height="50" rx="8" fill="#1c1917" />
          <text x="210" y="434" textAnchor="middle" fontSize="18" fontWeight="900" fill="#fbbf24">★ WIN ★</text>
        </svg>
      </div>

      {/* JACKPOT Banner */}
      <div className="fx-casino-banner">JACKPOT!</div>

      {/* Münzen-Regen */}
      {COINS.map((c) => (
        <span
          key={c.id}
          className="fx-casino-coin"
          style={{
            left: `${c.x}vw`,
            '--du': `${c.duration}s`,
            '--d': `${c.delay}s`,
            '--rs': c.rotateSpeed,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}
