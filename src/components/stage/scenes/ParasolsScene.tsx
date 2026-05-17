// 2 Sonnenschirme + Liegestuhl am Wiesenrand. Statisch atmosphärisch.

export default function ParasolsScene() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-2 overflow-hidden"
      style={{ zIndex: 32, height: 90 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-parasol-sway {
          0%, 100% { transform: rotate(-2deg); }
          50%      { transform: rotate(2deg); }
        }
        .scn-parasol {
          position: absolute; bottom: 0;
          transform-origin: 50% 100%;
          animation: scn-parasol-sway 6s ease-in-out infinite;
          animation-delay: var(--d, 0s);
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .scn-parasol { animation: none; }
        }
      `}</style>
      {/* Linker Sonnenschirm */}
      <div className="scn-parasol" style={{ left: '10%' } as React.CSSProperties}>
        <svg viewBox="0 0 60 90" width="60" height="90">
          <path d="M 30 18 Q 5 28 5 40 L 55 40 Q 55 28 30 18 Z" fill="#ef4444" />
          <path d="M 30 18 L 30 18 L 30 30 L 30 30" stroke="#fff" strokeWidth="0.5" />
          <path d="M 30 18 Q 17 32 30 40" stroke="rgba(0,0,0,0.15)" fill="none" />
          <path d="M 30 18 Q 43 32 30 40" stroke="rgba(0,0,0,0.15)" fill="none" />
          <rect x="29" y="40" width="2" height="48" fill="#7c2d12" />
        </svg>
      </div>
      {/* Liegestuhl */}
      <div style={{ position: 'absolute', bottom: '4px', left: '18%' }}>
        <svg viewBox="0 0 70 40" width="70" height="40">
          <path d="M 6 36 L 20 16 L 50 16 L 64 36 Z" fill="#fbbf24" stroke="#a16207" strokeWidth="1" />
          <rect x="20" y="16" width="30" height="2" fill="#a16207" />
        </svg>
      </div>
      {/* Rechter Sonnenschirm */}
      <div className="scn-parasol" style={{ right: '15%', '--d': '-2.5s' } as React.CSSProperties}>
        <svg viewBox="0 0 60 90" width="60" height="90">
          <path d="M 30 18 Q 5 28 5 40 L 55 40 Q 55 28 30 18 Z" fill="#3b82f6" />
          <path d="M 30 18 Q 17 32 30 40" stroke="rgba(0,0,0,0.15)" fill="none" />
          <path d="M 30 18 Q 43 32 30 40" stroke="rgba(0,0,0,0.15)" fill="none" />
          <rect x="29" y="40" width="2" height="48" fill="#7c2d12" />
        </svg>
      </div>
    </div>
  );
}
