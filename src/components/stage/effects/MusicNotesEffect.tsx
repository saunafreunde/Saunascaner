// Musik-Noten steigen in Wellen-Bewegung auf, verschiedene Symbole + Farben
// + Größen + drift. Dauer 9s.

const NOTES = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  symbol: ['♪', '♫', '♩', '♬', '𝅗𝅥', '𝅘𝅥𝅮'][i % 6],
  left: ((i * 13) % 95) + 2,
  delay: ((i * 0.15) % 4),
  dur: 5 + ((i * 0.3) % 3),
  size: 28 + ((i * 5) % 50),
  swayDelay: -((i * 0.4) % 2),
  drift: ((i * 7) % 80) - 40,
  color: ['#a855f7', '#3b82f6', '#ec4899', '#22c55e', '#f97316', '#fbbf24'][i % 6],
}));

export default function MusicNotesEffect() {
  return (
    <>
      <style>{`
        @keyframes fx-note-rise {
          0%   { transform: translate3d(0, 0, 0) scale(0.4); opacity: 0; }
          10%  { transform: translate3d(0, -8vh, 0) scale(1); opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translate3d(var(--drift, 0px), -110vh, 0) scale(1.2); opacity: 0; }
        }
        @keyframes fx-note-sway {
          0%, 100% { transform: rotate(-12deg) translateX(-10px); }
          50%      { transform: rotate(12deg) translateX(10px); }
        }
        .fx-music-note {
          position: absolute; bottom: -50px;
          font-weight: bold;
          line-height: 1;
          will-change: transform, opacity;
          animation: fx-note-rise var(--d, 6s) ease-out infinite;
          animation-delay: var(--del, 0s);
          filter: drop-shadow(0 2px 8px currentColor) drop-shadow(0 0 16px currentColor);
          user-select: none;
        }
        .fx-music-note-sway {
          display: inline-block;
          animation: fx-note-sway 1.2s ease-in-out infinite;
          animation-delay: var(--sd, 0s);
          transform-origin: 50% 100%;
        }
      `}</style>
      {NOTES.map((n) => (
        <span
          key={n.id}
          className="fx-music-note"
          style={{
            left: `${n.left}%`,
            fontSize: `${n.size}px`,
            color: n.color,
            '--d': `${n.dur}s`,
            '--del': `${n.delay}s`,
            '--drift': `${n.drift}px`,
          } as React.CSSProperties}
        >
          <span className="fx-music-note-sway" style={{ '--sd': `${n.swayDelay}s` } as React.CSSProperties}>
            {n.symbol}
          </span>
        </span>
      ))}
    </>
  );
}
