import { Link } from 'react-router-dom';
import { useGameMemberStats, type GameKind } from '@/lib/games';
import { GAME_LABELS } from './registry';

export function GameStatsCard({ memberId }: { memberId: string }) {
  const statsQ = useGameMemberStats(memberId);
  const s = statsQ.data;
  const hasAny = !!s && (
    Object.keys(s.highscores ?? {}).length > 0 ||
    Object.keys(s.pvp ?? {}).length > 0
  );

  return (
    <section className="rounded-2xl bg-forest-900/60 p-4 ring-1 ring-forest-800/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-forest-100 uppercase tracking-wider">🎮 Spiele</h3>
        <Link to="/spiele" className="text-xs text-amber-400 hover:text-amber-300">Zum Hub →</Link>
      </div>

      {statsQ.isLoading ? (
        <div className="text-forest-400 text-sm">Lade Stats…</div>
      ) : !hasAny ? (
        <div className="text-center py-4">
          <div className="text-forest-300 text-sm mb-2">Noch keine Spiele gespielt.</div>
          <Link to="/spiele" className="inline-block rounded-xl bg-amber-500/80 px-4 py-2 text-sm font-bold text-forest-950 hover:bg-amber-400">
            Jetzt spielen
          </Link>
        </div>
      ) : (
        <>
          {Object.keys(s!.highscores ?? {}).length > 0 && (
            <>
              <div className="text-xs text-forest-400 mb-1">Highscores</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                {Object.entries(s!.highscores ?? {}).map(([kind, score]) => {
                  const meta = GAME_LABELS[kind as GameKind];
                  return (
                    <div key={kind} className="rounded-xl bg-forest-950/60 p-2 ring-1 ring-forest-800/40">
                      <div className="text-lg">{meta.emoji}</div>
                      <div className="text-xs text-forest-400">{meta.label}</div>
                      <div className="text-amber-300 font-bold tabular-nums">{score}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {Object.keys(s!.pvp ?? {}).length > 0 && (
            <>
              <div className="text-xs text-forest-400 mb-1">Duelle (W/N/U)</div>
              <div className="space-y-1">
                {Object.entries(s!.pvp ?? {}).map(([kind, wl]) => {
                  const meta = GAME_LABELS[kind as GameKind];
                  return (
                    <div key={kind} className="flex items-center gap-2 text-sm">
                      <span className="text-base">{meta.emoji}</span>
                      <span className="flex-1 text-forest-200">{meta.label}</span>
                      <span className="tabular-nums text-emerald-300">{wl.wins}</span>
                      <span className="text-forest-500">/</span>
                      <span className="tabular-nums text-rose-300">{wl.losses}</span>
                      <span className="text-forest-500">/</span>
                      <span className="tabular-nums text-forest-400">{wl.draws}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
