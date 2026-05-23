// Bubble-Trouble — 100 Seifenblasen schweben auf, reflektieren bunt + Pop-Effekt
// am Top der Tafel. 10s.

const BUBBLES = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  x: (i * 1.0) % 100,
  size: 30 + (i % 5) * 22,
  delay: i * 0.1,
  duration: 4 + (i % 4) * 1.4,
  drift: -50 + (i % 10) * 12,
  popDelay: i * 0.1 + 4 + (i % 4) * 1.4,
}));

export default function BubbleTroubleEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-bubble-rise {
          0%   { transform: translate3d(0, 110vh, 0) scale(0.3); opacity: 0; }
          15%  { opacity: 1; transform: translate3d(0, 90vh, 0) scale(1); }
          85%  { opacity: 1; }
          100% { transform: translate3d(var(--dr, 0), -20vh, 0) scale(1.2); opacity: 0; }
        }
        @keyframes fx-bubble-wobble {
          0%, 100% { transform: scale(1) translateX(0); }
          50%      { transform: scale(1.05) translateX(8px); }
        }
        @keyframes fx-bubble-pop {
          0%   { transform: scale(1); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }

        .fx-bubble {
          position: absolute; bottom: 0;
          width: var(--s, 50px); height: var(--s, 50px);
          will-change: transform, opacity;
          animation: fx-bubble-rise var(--du, 5s) cubic-bezier(0.4, 0, 0.6, 1) forwards;
          animation-delay: var(--d, 0s);
        }
        .fx-bubble-inner {
          width: 100%; height: 100%;
          border-radius: 50%;
          background:
            radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.2) 25%, transparent 35%),
            radial-gradient(circle at 70% 70%, rgba(236,72,153,0.4) 0%, transparent 50%),
            radial-gradient(circle at 60% 40%, rgba(59,130,246,0.3) 0%, transparent 60%),
            radial-gradient(circle at 50% 50%, rgba(34,197,94,0.2) 0%, transparent 80%);
          border: 2px solid rgba(255,255,255,0.5);
          box-shadow:
            inset -8px -8px 16px rgba(59,130,246,0.2),
            inset 8px 8px 16px rgba(236,72,153,0.2),
            0 0 16px rgba(255,255,255,0.4);
          animation: fx-bubble-wobble 2s ease-in-out infinite;
        }
      `}</style>

      {BUBBLES.map((b) => (
        <div
          key={`bub-${b.id}`}
          className="fx-bubble"
          style={{
            left: `${b.x}vw`,
            '--s': `${b.size}px`,
            '--du': `${b.duration}s`,
            '--d': `${b.delay}s`,
            '--dr': `${b.drift}px`,
          } as React.CSSProperties}
        >
          <div className="fx-bubble-inner" />
        </div>
      ))}
    </>
  );
}
