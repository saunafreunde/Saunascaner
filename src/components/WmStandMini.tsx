import { Link } from 'react-router-dom';
import { useWmLeaderboard, useWmMatches } from '@/lib/api';

interface Props {
  memberId: string;
}

/**
 * Compact WM-Tipspiel widget for the Profil-Zone in Planner.
 * Shows rank, points, streak — links into full /wm page.
 */
export function WmStandMini({ memberId }: Props) {
  const lb = useWmLeaderboard();
  const matchesQ = useWmMatches();

  const totalMatches = (matchesQ.data ?? []).length;
  const noTournamentYet = totalMatches === 0;

  const rows = lb.data ?? [];
  const myEntry = rows.find((e) => e.member_id === memberId);
  const myRank = myEntry ? rows.findIndex((e) => e.member_id === memberId) + 1 : null;

  const podiumEmoji = myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '⚽';

  return (
    <Link
      to="/wm"
      className="block rounded-2xl bg-gradient-to-br from-amber-950/40 via-forest-950/60 to-forest-950/40 ring-1 ring-amber-700/40 p-4 transition hover:ring-amber-500/60 hover:shadow-lg hover:shadow-amber-900/30 group"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-600 text-2xl shadow-lg shrink-0 group-hover:scale-110 transition-transform">
            🏆
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-amber-200 leading-tight">
              WM-Tipspiel 2026
            </h3>
            {noTournamentYet ? (
              <p className="text-xs text-amber-300/70 mt-0.5 italic">Spielplan noch nicht angelegt — antippen zum Öffnen</p>
            ) : myEntry ? (
              <p className="text-xs text-forest-300 mt-0.5">
                <span className="text-2xl">{podiumEmoji}</span>{' '}
                Platz <strong className="text-amber-200">{myRank}</strong>
                {' · '}
                <strong className="text-amber-200 tabular-nums">{myEntry.total_points}</strong> Punkte
              </p>
            ) : (
              <p className="text-xs text-forest-300 mt-0.5 italic">Noch nicht getippt — los geht's!</p>
            )}
            {myEntry && myEntry.streak_bonus > 0 && (
              <p className="text-[10px] text-amber-400 mt-0.5">🔥 Streak-Bonus +{myEntry.streak_bonus}</p>
            )}
          </div>
        </div>
        <span className="text-amber-400/60 group-hover:text-amber-300 group-hover:translate-x-1 transition-all">→</span>
      </div>

      {myEntry && (
        <div className="mt-3 pt-3 border-t border-amber-800/30 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-forest-400">Tipps</div>
            <div className="text-sm font-semibold tabular-nums">{myEntry.tips_correct}/{myEntry.tips_total}</div>
          </div>
          <div>
            <div className="text-xs text-forest-400">Final</div>
            <div className="text-sm font-semibold tabular-nums">{myEntry.champion_bonus > 0 ? '✓' : '–'}</div>
          </div>
          <div>
            <div className="text-xs text-forest-400">Quali</div>
            <div className="text-sm font-semibold tabular-nums">{myEntry.group_bonus > 0 ? `+${myEntry.group_bonus}` : '–'}</div>
          </div>
        </div>
      )}
    </Link>
  );
}
