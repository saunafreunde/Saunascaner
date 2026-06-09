import { useMonthlyLeaderboard } from '@/lib/api';

const RANK_ICONS = ['👑', '🥈', '🥉'];
const RANK_STYLES = [
  'ring-1 ring-yellow-500/40 bg-yellow-900/20',
  'ring-1 ring-slate-400/30 bg-slate-900/30',
  'ring-1 ring-amber-700/30 bg-amber-900/20',
];

export default function MonthlyLeaderboard() {
  const lb = useMonthlyLeaderboard();
  const entries = lb.data ?? [];

  const monthName = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });

  if (lb.isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 rounded-xl bg-forest-900/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!entries.length) {
    return (
      <p className="text-sm text-forest-300/50 text-center py-4">
        Noch keine Aufgüsse diesen Monat.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-forest-400/50 uppercase tracking-wider mb-1">{monthName}</p>
      {entries.map((entry, idx) => {
        const displayName = entry.sauna_name ?? entry.name;
        const isTop3 = idx < 3;
        return (
          <div
            key={entry.member_id}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 ${isTop3 ? RANK_STYLES[idx] : 'ring-1 ring-forest-800/30'}`}
          >
            <span className="text-base w-5 text-center" aria-hidden>
              {isTop3 ? RANK_ICONS[idx] : `${idx + 1}.`}
            </span>
            <span className="flex-1 text-sm font-medium text-forest-100 truncate">{displayName}</span>
            <span className="text-sm font-bold tabular-nums text-forest-300">
              {entry.count}×
            </span>
          </div>
        );
      })}
    </div>
  );
}
