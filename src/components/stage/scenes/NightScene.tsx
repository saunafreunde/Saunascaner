// Nacht-Modus: dunkler Overlay + Mond + 30 funkelnde Sterne.

const STARS = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  left: ((i * 41) % 100),
  top: ((i * 23) % 50),  // nur in der oberen Hälfte
  size: 2 + ((i * 0.7) % 2),
  delay: -((i * 0.27) % 3),
}));

export default function NightScene() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0"
        style={{ zIndex: 21, background: 'radial-gradient(circle at 50% 90%, rgba(0,0,30,0.0) 0%, rgba(0,0,30,0.4) 100%)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 bottom-0 overflow-hidden"
        style={{ zIndex: 22 }}
        aria-hidden="true"
      >
        <style>{`
          @keyframes scn-night-twinkle {
            0%, 100% { opacity: 0.4; transform: scale(1); }
            50%      { opacity: 1; transform: scale(1.3); }
          }
          @keyframes scn-night-moon-glow {
            0%, 100% { filter: drop-shadow(0 0 8px rgba(255,255,200,0.5)); }
            50%      { filter: drop-shadow(0 0 18px rgba(255,255,200,0.8)); }
          }
          .scn-night-star {
            position: absolute;
            background: #fff;
            border-radius: 50%;
            will-change: transform, opacity;
            animation: scn-night-twinkle 3s ease-in-out infinite;
            animation-delay: var(--d, 0s);
          }
          .scn-night-moon {
            position: absolute; top: 30px; right: 8%;
            animation: scn-night-moon-glow 4s ease-in-out infinite;
            will-change: filter;
          }
          @media (prefers-reduced-motion: reduce) {
            .scn-night-star, .scn-night-moon { animation: none; }
          }
        `}</style>
        <div className="scn-night-moon">
          <svg viewBox="0 0 60 60" width="60" height="60">
            <circle cx="30" cy="30" r="24" fill="#fef3c7" />
            <circle cx="22" cy="24" r="3" fill="rgba(0,0,0,0.08)" />
            <circle cx="36" cy="34" r="2" fill="rgba(0,0,0,0.08)" />
            <circle cx="38" cy="22" r="1.5" fill="rgba(0,0,0,0.08)" />
          </svg>
        </div>
        {STARS.map((s) => (
          <span
            key={s.id}
            className="scn-night-star"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              '--d': `${s.delay}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </>
  );
}
