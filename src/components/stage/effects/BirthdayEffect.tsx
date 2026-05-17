// Geburtstagstorte erscheint mittig + Konfetti drumherum. Dauer 8s.

const CONFETTI = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  angle: (i / 30) * Math.PI * 2,
  delay: ((i * 0.1) % 1.2),
  color: ['#ef4444', '#fbbf24', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'][i % 6],
}));

export default function BirthdayEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-bday-cake-pop {
          0%   { transform: translateX(-50%) translateY(40px) scale(0.6); opacity: 0; }
          15%  { transform: translateX(-50%) translateY(-20px) scale(1.1); opacity: 1; }
          25%  { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
          85%  { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
          100% { transform: translateX(-50%) translateY(-30px) scale(1.05); opacity: 0; }
        }
        @keyframes fx-bday-confetti {
          0%   { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
          15%  { transform: translate3d(calc(var(--cx) * 0.5), calc(var(--cy) * 0.5), 0) rotate(180deg); opacity: 1; }
          80%  { transform: translate3d(var(--cx), var(--cy), 0) rotate(540deg); opacity: 1; }
          100% { transform: translate3d(var(--cx), calc(var(--cy) + 80px), 0) rotate(720deg); opacity: 0; }
        }
        @keyframes fx-bday-flame {
          0%, 100% { transform: scale(1) translateY(0); }
          50%      { transform: scale(1.15) translateY(-1px); }
        }
        .fx-bday-cake {
          position: absolute; bottom: 30vh; left: 50%;
          will-change: transform, opacity;
          animation: fx-bday-cake-pop 8s ease-in-out forwards;
        }
        .fx-bday-flame {
          animation: fx-bday-flame 0.4s ease-in-out infinite;
          transform-origin: 50% 100%;
        }
        .fx-bday-confetti {
          position: absolute; top: 50vh; left: 50%;
          width: 8px; height: 4px;
          will-change: transform, opacity;
          animation: fx-bday-confetti 7.5s ease-out forwards;
          animation-delay: var(--del, 0s);
        }
      `}</style>
      <div className="fx-bday-cake">
        <svg viewBox="0 0 140 130" width="180" height="170">
          {/* Teller */}
          <ellipse cx="70" cy="125" rx="55" ry="6" fill="#e5e7eb" />
          {/* Torte 3 Etagen */}
          <rect x="20" y="80" width="100" height="40" rx="4" fill="#fda4af" />
          <rect x="30" y="55" width="80"  height="30" rx="4" fill="#f9a8d4" />
          <rect x="40" y="35" width="60"  height="25" rx="4" fill="#fce7f3" />
          {/* Glasur-Tropfen */}
          <path d="M 20 90 Q 35 100 50 90 Q 65 100 80 90 Q 95 100 110 90 Q 120 100 120 95" fill="#fff" opacity="0.6" />
          {/* Kerzen */}
          <rect x="55" y="20" width="3" height="15" fill="#fbbf24" />
          <rect x="68" y="18" width="3" height="17" fill="#fbbf24" />
          <rect x="82" y="20" width="3" height="15" fill="#fbbf24" />
          {/* Flammen */}
          <g className="fx-bday-flame">
            <ellipse cx="56.5" cy="18" rx="2.5" ry="4" fill="#f97316" />
            <ellipse cx="69.5" cy="16" rx="2.5" ry="4" fill="#f97316" />
            <ellipse cx="83.5" cy="18" rx="2.5" ry="4" fill="#f97316" />
          </g>
        </svg>
      </div>
      {CONFETTI.map((c) => {
        const radius = 200;
        const cx = Math.cos(c.angle) * radius;
        const cy = Math.sin(c.angle) * radius * 0.7;
        return (
          <span
            key={c.id}
            className="fx-bday-confetti"
            style={{
              background: c.color,
              '--cx': `${cx}px`,
              '--cy': `${cy}px`,
              '--del': `${c.delay}s`,
            } as React.CSSProperties}
          />
        );
      })}
    </>
  );
}
