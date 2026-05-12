import { useMemo } from 'react';
import { useMemberStatsFull } from '@/lib/api';

interface Props {
  memberId: string;
}

// 12-Monats-Linien-/Bar-Chart der Sauna-Tage. Pure-SVG, kein Lib.
export function MemberAttendanceChart({ memberId }: Props) {
  const stats = useMemberStatsFull(memberId);
  const data = stats.data?.attendance_by_month ?? [];

  // Volle 12 Monate auffüllen, auch wenn 0 (für visuelle Konsistenz)
  const filled = useMemo(() => {
    const result: { month: string; count: number; label: string }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const found = data.find((m) => m.month === key);
      const label = d.toLocaleDateString('de-DE', { month: 'short' });
      result.push({ month: key, count: found?.count ?? 0, label });
    }
    return result;
  }, [data]);

  const maxCount = Math.max(1, ...filled.map((d) => d.count));
  const totalCount = filled.reduce((sum, d) => sum + d.count, 0);
  const bestMonth = filled.reduce((best, d) => d.count > best.count ? d : best, filled[0] ?? { count: 0, label: '—', month: '' });

  if (filled.every((d) => d.count === 0)) {
    return (
      <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
          📈 Deine Sauna-Aktivität
        </h2>
        <p className="text-center text-sm text-forest-400 py-4">
          Noch keine Anwesenheits-Tage aufgezeichnet — sobald du das nächste Mal eincheckst, wirst du hier deine Verlaufskurve sehen.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
      <div className="flex items-end justify-between flex-wrap gap-2 mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
          📈 Deine Sauna-Aktivität
        </h2>
        <div className="text-[11px] text-forest-400 tabular-nums">
          {totalCount} Tage in 12 Monaten
        </div>
      </div>

      {/* Bar Chart */}
      <div className="flex items-end gap-2 h-32">
        {filled.map((d) => {
          const heightPct = d.count === 0 ? 4 : Math.max(8, (d.count / maxCount) * 100);
          const isMax = d.count === bestMonth.count && d.count > 0;
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center justify-end group relative">
              <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                <div className="bg-forest-950 ring-1 ring-amber-500/40 rounded px-2 py-0.5 text-[10px] text-amber-200 whitespace-nowrap tabular-nums">
                  {d.label}: {d.count}
                </div>
              </div>
              <div
                className="w-full rounded-t transition"
                style={{
                  height: `${heightPct}%`,
                  background: d.count === 0
                    ? '#1f2937'
                    : isMax
                      ? 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)'
                      : 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
                  boxShadow: isMax ? '0 0 14px #fbbf2466' : undefined,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* X-Achse Labels */}
      <div className="flex gap-2 mt-2">
        {filled.map((d, i) => (
          <div
            key={d.month}
            className={`flex-1 text-center text-[10px] tabular-nums ${i === filled.length - 1 ? 'text-amber-300 font-semibold' : 'text-forest-500'}`}
          >
            {d.label}
          </div>
        ))}
      </div>

      {bestMonth.count > 0 && (
        <div className="mt-4 text-center text-xs text-forest-300/80">
          Bester Monat: <strong className="text-amber-300">{bestMonth.label}</strong> mit {bestMonth.count} {bestMonth.count === 1 ? 'Tag' : 'Tagen'}
        </div>
      )}
    </section>
  );
}
