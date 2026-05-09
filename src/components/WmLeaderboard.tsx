import { useWmLeaderboard } from '@/lib/api';

interface Props {
  myMemberId?: string;
}

export function WmLeaderboard({ myMemberId }: Props) {
  const lb = useWmLeaderboard();
  const rows = lb.data ?? [];
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  if (lb.isLoading) {
    return <div className="text-center text-forest-500 text-sm py-8">Lade Rangliste…</div>;
  }
  if (rows.length === 0) {
    return <div className="text-center text-forest-500 text-sm py-8">Noch keine Tipps abgegeben.</div>;
  }

  // Podium order: 2 - 1 - 3 (so #1 stands tallest in middle)
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Top-3 Podium */}
      <div className="grid grid-cols-3 gap-2 items-end">
        {podiumOrder.map((entry, idx) => {
          if (!entry) return <div key={idx} />;
          const realRank = top3.indexOf(entry) + 1;
          const isMe = entry.member_id === myMemberId;
          const heights = ['h-28', 'h-36', 'h-24']; // 2nd, 1st, 3rd
          const colors = [
            'from-slate-300 to-slate-500',  // silver
            'from-amber-300 to-amber-500',  // gold
            'from-orange-300 to-orange-500', // bronze
          ];
          const colorIdx = realRank === 1 ? 1 : realRank === 2 ? 0 : 2;
          const visualIdx = idx; // for height
          const medals = ['🥈', '🥇', '🥉'];
          const visualHeights = [heights[0], heights[1], heights[2]];

          return (
            <div key={entry.member_id} className="flex flex-col items-center">
              <div className="text-3xl mb-1 animate-bounce-slow">{medals[visualIdx]}</div>
              <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${colors[colorIdx]} flex items-center justify-center text-2xl font-black text-forest-950 shadow-lg ring-2 ${isMe ? 'ring-amber-300 ring-offset-2 ring-offset-forest-950' : 'ring-white/20'}`}>
                {entry.name.charAt(0).toUpperCase()}
              </div>
              <div className={`mt-2 text-center ${isMe ? 'text-amber-200' : 'text-forest-200'}`}>
                <div className="text-sm font-semibold truncate max-w-[100px]">{entry.name.split(' ')[0]}{isMe && ' ✦'}</div>
                {entry.sauna_name && <div className="text-[10px] text-forest-400 truncate max-w-[100px]">{entry.sauna_name}</div>}
              </div>
              <div className={`mt-1 text-2xl font-black tabular-nums ${realRank === 1 ? 'text-amber-300' : realRank === 2 ? 'text-slate-200' : 'text-orange-300'}`}>
                {entry.total_points}
              </div>
              <div className={`mt-1 w-full ${visualHeights[visualIdx]} rounded-t-xl bg-gradient-to-b ${colors[colorIdx]} opacity-30`} />
            </div>
          );
        })}
      </div>

      {/* Rest of table */}
      {rest.length > 0 && (
        <div className="rounded-2xl bg-forest-950/40 ring-1 ring-forest-800/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-forest-900/50 text-forest-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-2 py-2 text-right">Tipps</th>
                <th className="px-2 py-2 text-right">Joker</th>
                <th className="px-3 py-2 text-right">Punkte</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((r, i) => {
                const rank = i + 4;
                const isMe = r.member_id === myMemberId;
                return (
                  <tr key={r.member_id} className={`border-t border-forest-800/30 ${isMe ? 'bg-amber-950/30' : ''}`}>
                    <td className="px-3 py-2 text-forest-400 tabular-nums">{rank}.</td>
                    <td className="px-3 py-2 font-medium">
                      {r.name}{isMe && ' ✦'}
                      {r.sauna_name && <span className="ml-1.5 text-xs text-forest-400">{r.sauna_name}</span>}
                    </td>
                    <td className="px-2 py-2 text-right text-xs text-forest-300 tabular-nums">
                      {r.tips_correct}/{r.tips_total}
                    </td>
                    <td className="px-2 py-2 text-right text-xs text-forest-400 tabular-nums">
                      {r.streak_bonus > 0 && <span className="text-amber-400">🔥{r.streak_bonus}</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">
                      {r.total_points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
