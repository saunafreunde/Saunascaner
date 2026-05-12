import { useStatsRatingCoverage, useStatsRatingDistribution } from '@/lib/api';
import { StatsCard } from './StatsCard';

export function BewertungenStatsSection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <CoverageChart />
      <DistributionChart />
    </div>
  );
}

// ─── 16) Bewertungs-Coverage über Zeit ───────────────────────────────────
function CoverageChart() {
  const q = useStatsRatingCoverage(12);
  const data = q.data ?? [];

  const totalAll = data.reduce((s, d) => s + d.total, 0);
  const ratedAll = data.reduce((s, d) => s + d.rated, 0);
  const avgCoverage = totalAll > 0 ? Math.round((ratedAll / totalAll) * 100) : 0;

  const W = 480, H = 200, padL = 35, padB = 24;
  const stepX = data.length > 1 ? (W - padL - 10) / (data.length - 1) : 0;
  const y = (v: number) => H - padB - (Math.min(v, 100) / 100) * (H - padB - 20);
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${padL + i*stepX},${y(Number(d.coverage_pct))}`).join(' ');

  return (
    <StatsCard
      title="16. Bewertungs-Coverage"
      icon="📊"
      subtitle={`Ø ${avgCoverage}% bewertet · letzte 12 Monate`}
      loading={q.isLoading}
      empty={data.length === 0}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0,25,50,75,100].map((f) => (
          <g key={f}>
            <line x1={padL} y1={y(f)} x2={W-10} y2={y(f)} stroke="rgba(255,255,255,0.06)" />
            <text x={padL-4} y={y(f)+3} fontSize="9" fill="rgba(255,255,255,0.5)" textAnchor="end">{f}%</text>
          </g>
        ))}
        {/* Area-Fill */}
        <path
          d={`${path} L${padL + (data.length-1)*stepX},${y(0)} L${padL},${y(0)} Z`}
          fill="rgba(34,197,94,0.15)"
        />
        <path d={path} fill="none" stroke="#22c55e" strokeWidth={2} />
        {data.map((d, i) => (
          <g key={d.month}>
            <circle cx={padL + i*stepX} cy={y(Number(d.coverage_pct))} r={3} fill="#22c55e" />
            <text x={padL + i*stepX} y={H-6} fontSize="8" fill="rgba(255,255,255,0.5)" textAnchor="middle">{d.month.slice(5)}</text>
          </g>
        ))}
      </svg>
      <p className="text-[10px] text-forest-500 mt-2">{ratedAll} von {totalAll} Aufgüssen bewertet</p>
    </StatsCard>
  );
}

// ─── 17) Sterne-Verteilung ───────────────────────────────────────────────
function DistributionChart() {
  const q = useStatsRatingDistribution();
  const data = q.data ?? [];

  const total = data.reduce((s, d) => s + d.count, 0);
  const avg = total > 0 ? data.reduce((s, d) => s + d.stars * d.count, 0) / total : 0;
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <StatsCard
      title="17. Sterne-Verteilung"
      icon="⭐"
      subtitle={`Ø ${avg.toFixed(2)}★ · ${total} Einzelbewertungen`}
      loading={q.isLoading}
      empty={total === 0}
    >
      <div className="space-y-2 mt-2">
        {[5, 4, 3, 2, 1].map((s) => {
          const row = data.find((d) => d.stars === s);
          const c = row?.count ?? 0;
          const pct = (c / max) * 100;
          const overallPct = total > 0 ? (c / total) * 100 : 0;
          return (
            <div key={s} className="flex items-center gap-2 text-xs">
              <span className="w-12 text-amber-300">{'★'.repeat(s)}<span className="text-forest-700">{'★'.repeat(5-s)}</span></span>
              <div className="flex-1 h-4 rounded bg-forest-900/60 overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${pct}%`,
                    background: `hsl(${s*15 + 10}, 80%, 55%)`,
                  }}
                />
              </div>
              <span className="w-16 text-right tabular-nums text-forest-400 text-[10px]">{c} · {overallPct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-forest-500 mt-3">Aggregat über alle 6 Bewertungs-Kategorien</p>
    </StatsCard>
  );
}
