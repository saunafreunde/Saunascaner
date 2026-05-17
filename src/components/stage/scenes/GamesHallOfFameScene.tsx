import { useGamesHallOfFame } from '@/lib/games';
import { GAME_LABELS } from '@/components/games/registry';
import { resolveAvatarUrl } from '@/lib/avatar';

// Tafel-Layer: zeigt die aktuellen Top-1-Spieler je Spiel-Kind im oberen
// Bildschirmrand. Nur sichtbar wenn der Admin die Scene 'games-hall-of-fame'
// in der Bühne aktiviert (z.B. für Vereinsabende mit Spiele-Wettkampf).
//
// Position: oben Mitte, halbtransparent, scrollt durch alle Einträge falls > 3.

export default function GamesHallOfFameScene() {
  const top = useGamesHallOfFame('all');
  const entries = top.data ?? [];

  if (entries.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed left-1/2 -translate-x-1/2 top-20 z-40 hall-of-fame-anim"
      style={{ maxWidth: 'min(960px, 70vw)' }}
    >
      <div className="rounded-2xl bg-gradient-to-br from-amber-900/85 via-orange-900/80 to-yellow-900/85 backdrop-blur-xl px-6 py-4 ring-2 ring-amber-400/50 shadow-2xl shadow-amber-900/60">
        <div className="text-center mb-3">
          <div className="text-amber-200 text-xs font-bold uppercase tracking-[0.2em]">🏆 Hall of Fame · Spiele-Champions</div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {entries.map((e) => {
            const meta = GAME_LABELS[e.kind];
            const avatar = resolveAvatarUrl(e.avatar_path, 64);
            return (
              <div key={e.kind} className="flex items-center gap-2.5">
                <div className="text-3xl">{meta.emoji}</div>
                <div className="flex flex-col">
                  <div className="text-amber-100 text-[10px] uppercase tracking-wider">{meta.label}</div>
                  <div className="flex items-center gap-2">
                    {avatar ? (
                      <img src={avatar} alt={e.name} className="h-6 w-6 rounded-full object-cover ring-1 ring-amber-300/40" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-amber-700/60 ring-1 ring-amber-300/40 flex items-center justify-center text-amber-100 text-xs font-bold">
                        {e.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-amber-50 text-sm font-semibold whitespace-nowrap">{e.name}</span>
                    <span className="text-amber-200 text-base font-black tabular-nums">{e.score}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        @keyframes hall-of-fame-pulse {
          0%, 100% { box-shadow: 0 25px 50px -12px rgba(120, 53, 15, 0.6); transform: translateY(0); }
          50%      { box-shadow: 0 30px 60px -10px rgba(217, 119, 6, 0.7); transform: translateY(-2px); }
        }
        .hall-of-fame-anim > div {
          animation: hall-of-fame-pulse 4s ease-in-out infinite;
          will-change: transform, box-shadow;
        }
        @media (prefers-reduced-motion: reduce) {
          .hall-of-fame-anim > div { animation: none; }
        }
      `}</style>
    </div>
  );
}
