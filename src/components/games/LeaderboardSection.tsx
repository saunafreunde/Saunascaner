import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentMember } from '@/lib/api';
import { useGameLeaderboard, type GameKind } from '@/lib/games';
import { GAME_LABELS, GAME_REGISTRY } from './registry';
import { Avatar } from '@/components/Avatar';

// Alle Solo-Spiele aus der Registry (Phase 1 + 2 = Tetris, Memory, Snake, 2048, Solitaire, Sudoku)
const SOLO_KINDS_AVAILABLE: GameKind[] = (Object.keys(GAME_REGISTRY) as GameKind[]).filter(
  (k) => GAME_REGISTRY[k]?.mode === 'solo',
);
const PERIODS: Array<{ id: 'all' | 'month' | 'week'; label: string }> = [
  { id: 'all',   label: 'Gesamt' },
  { id: 'month', label: 'Monat' },
  { id: 'week',  label: 'Woche' },
];

export function LeaderboardSection() {
  const [kind, setKind] = useState<GameKind>('tetris');
  const [period, setPeriod] = useState<'all' | 'month' | 'week'>('all');
  const me = useCurrentMember();
  const lb = useGameLeaderboard(kind, period);
  const meta = GAME_LABELS[kind];
  const myRank = (lb.data ?? []).findIndex((e) => e.member_id === me.data?.id);

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-forest-300 uppercase tracking-wider">🏆 Bestenliste</h2>

      {/* Spiel-Picker */}
      <div className="mb-2 flex flex-wrap gap-1">
        {SOLO_KINDS_AVAILABLE.map((k) => {
          const lbl = GAME_LABELS[k];
          return (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-xl px-3 py-1.5 text-sm transition ${
                kind === k
                  ? 'bg-amber-500/80 text-forest-950 font-semibold'
                  : 'bg-forest-900/60 text-forest-300 hover:bg-forest-900/80 ring-1 ring-forest-800/50'
              }`}
            >
              {lbl.emoji} {lbl.label}
            </button>
          );
        })}
      </div>

      {/* Zeitraum-Filter */}
      <div className="mb-3 flex gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`rounded-lg px-3 py-1 text-xs transition ${
              period === p.id
                ? 'bg-forest-200/20 text-forest-100 font-semibold ring-1 ring-forest-300/30'
                : 'bg-forest-950/40 text-forest-400 hover:bg-forest-900/60'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-forest-900/60 ring-1 ring-forest-800/50 overflow-hidden">
        {lb.isLoading ? (
          <div className="p-6 text-center text-forest-400">Lade…</div>
        ) : (lb.data?.length ?? 0) === 0 ? (
          <div className="p-6 text-center">
            <div className="text-forest-300 mb-2">Noch keine Scores in {meta.label} ({PERIODS.find(p => p.id === period)?.label}).</div>
            <Link to={`/spiele/solo/${kind}`} className="inline-block rounded-xl bg-amber-500/80 px-4 py-2 text-sm font-bold text-forest-950 hover:bg-amber-400">
              {meta.emoji} Sei der Erste
            </Link>
          </div>
        ) : (
          <ol className="divide-y divide-forest-800/40">
            {lb.data!.map((e, i) => {
              const isMe = e.member_id === me.data?.id;
              const isTop3 = i < 3;
              const medal = ['🥇', '🥈', '🥉'][i] ?? `#${i + 1}`;
              return (
                <li key={e.member_id + e.created_at}
                    className={`flex items-center gap-3 px-3 py-2.5 ${
                      isMe ? 'bg-amber-500/10' : isTop3 ? 'bg-forest-950/30' : ''
                    }`}>
                  <div className={`w-9 text-center text-lg font-bold tabular-nums ${
                    isTop3 ? '' : 'text-forest-500 text-sm'
                  }`}>{medal}</div>
                  <Link to={`/profile/${e.member_id}`} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80">
                    <Avatar name={e.name} avatarPath={e.avatar_path} size="xs" />
                    <span className={`text-sm truncate ${isMe ? 'text-amber-200 font-bold' : 'text-forest-200'}`}>
                      {e.name}{isMe ? ' (du)' : ''}
                    </span>
                  </Link>
                  <div className={`tabular-nums font-bold ${
                    isTop3 ? 'text-amber-300 text-lg' : 'text-forest-300'
                  }`}>{e.score}</div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {myRank >= 0 && (
        <div className="mt-2 text-center text-xs text-forest-400">
          Dein Rang: <span className="text-amber-300 font-semibold">#{myRank + 1}</span>
        </div>
      )}
    </section>
  );
}
