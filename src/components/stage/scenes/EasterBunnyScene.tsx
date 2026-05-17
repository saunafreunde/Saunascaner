// Osterhase hoppelt langsam von links nach rechts.
// translateX langsam + kleine Hops (translateY).

export default function EasterBunnyScene() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-2 overflow-hidden"
      style={{ zIndex: 34, height: 60 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-bunny-walk {
          0%   { transform: translateX(-80px); }
          100% { transform: translateX(calc(100vw + 80px)); }
        }
        @keyframes scn-bunny-hop {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        .scn-bunny-wrap {
          position: absolute; bottom: 4px;
          animation: scn-bunny-walk 38s linear infinite;
          will-change: transform;
        }
        .scn-bunny-body {
          animation: scn-bunny-hop 0.9s ease-in-out infinite;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .scn-bunny-wrap, .scn-bunny-body { animation: none; }
        }
      `}</style>
      <div className="scn-bunny-wrap">
        <div className="scn-bunny-body">
          <svg viewBox="0 0 40 36" width="40" height="36">
            {/* Körper */}
            <ellipse cx="22" cy="24" rx="12" ry="9" fill="#f5e9d8" />
            {/* Kopf */}
            <ellipse cx="10" cy="20" rx="7" ry="6" fill="#f5e9d8" />
            {/* Ohren */}
            <ellipse cx="8"  cy="9"  rx="2" ry="7" fill="#f5e9d8" />
            <ellipse cx="12" cy="9"  rx="2" ry="7" fill="#f5e9d8" />
            <ellipse cx="8"  cy="10" rx="1" ry="5" fill="#ec4899" opacity="0.5" />
            <ellipse cx="12" cy="10" rx="1" ry="5" fill="#ec4899" opacity="0.5" />
            {/* Auge */}
            <circle cx="9" cy="19" r="1.2" fill="#1c1917" />
            {/* Schwanz */}
            <circle cx="33" cy="22" r="3" fill="#fff" />
          </svg>
        </div>
      </div>
    </div>
  );
}
