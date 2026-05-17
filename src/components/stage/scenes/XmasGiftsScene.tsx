// 3 Geschenke unter dem Blockhaus mittig. Statisch mit leichtem
// Atmen-Glow auf den Schleifen.

const GIFTS = [
  { left: '46%', size: 38, color: '#dc2626', ribbon: '#fbbf24', delay: '-0.4s' },
  { left: '51%', size: 30, color: '#16a34a', ribbon: '#f87171', delay: '-1.1s' },
  { left: '55%', size: 34, color: '#2563eb', ribbon: '#f9a8d4', delay: '-0.7s' },
];

export default function XmasGiftsScene() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-2 overflow-hidden"
      style={{ zIndex: 32, height: 80 }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes scn-gift-glow {
          0%, 100% { opacity: 0.85; }
          50%      { opacity: 1; }
        }
        .scn-gift-box { position: absolute; bottom: 4px; transform: translateX(-50%); }
        .scn-gift-body { width: 100%; height: 70%; border-radius: 3px; }
        .scn-gift-ribbon-v {
          position: absolute; top: 0; bottom: 30%; left: 50%; width: 14%;
          transform: translateX(-50%);
        }
        .scn-gift-ribbon-h {
          position: absolute; left: 0; right: 0; top: 32%; height: 14%;
        }
        .scn-gift-bow {
          position: absolute; left: 50%; top: -6px; width: 60%; height: 16px;
          transform: translateX(-50%);
          border-radius: 50% 50% 30% 30% / 60% 60% 40% 40%;
          animation: scn-gift-glow 2.6s ease-in-out infinite;
          animation-delay: var(--d, 0s);
          will-change: opacity;
        }
        @media (prefers-reduced-motion: reduce) {
          .scn-gift-bow { animation: none; }
        }
      `}</style>
      {GIFTS.map((g, i) => (
        <div
          key={i}
          className="scn-gift-box"
          style={{ left: g.left, width: g.size, height: g.size + 10 }}
        >
          <div className="scn-gift-body" style={{ background: g.color, top: `${(g.size + 10) * 0.3}px`, position: 'absolute', bottom: 0 }} />
          <div className="scn-gift-ribbon-v" style={{ background: g.ribbon }} />
          <div className="scn-gift-ribbon-h" style={{ background: g.ribbon, top: `${(g.size + 10) * 0.45}px` }} />
          <div
            className="scn-gift-bow"
            style={{ background: g.ribbon, '--d': g.delay } as React.CSSProperties}
          />
        </div>
      ))}
    </div>
  );
}
