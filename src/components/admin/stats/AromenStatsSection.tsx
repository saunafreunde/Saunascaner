import {
  useStatsTopOils,
  useStatsOilRatingCorrelation,
  useStatsOilSeasonality,
} from '@/lib/api';
import { OIL_BY_ID, OILS } from '@/lib/oils';
import { StatsCard } from './StatsCard';

const MONTH_LABELS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

export function AromenStatsSection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <TopOilsChart />
      <OilRatingCorrelationChart />
      <div className="lg:col-span-2">
        <OilSeasonalityChart />
      </div>
    </div>
  );
}

// ─── 9) Top-20 Aromen ────────────────────────────────────────────────────
function TopOilsChart() {
  const q = useStatsTopOils(20);
  const data = q.data ?? [];
  const maxUse = Math.max(1, ...data.map((d) => d.usage_count));

  return (
    <StatsCard
      title="9. Top-20 Aromen"
      icon="🌿"
      subtitle="Verein gesamt"
      loading={q.isLoading}
      empty={data.length === 0}
    >
      <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
        {data.map((d, i) => {
          const oil = OIL_BY_ID[d.oil_slug];
          const pct = (d.usage_count / maxUse) * 100;
          return (
            <div key={d.oil_slug} className="flex items-center gap-2 text-xs">
              <span className="w-5 text-right tabular-nums text-forest-500 text-[10px]">{i+1}.</span>
              <span className="w-6 text-right tabular-nums text-emerald-300/70 text-[10px]">#{oil?.number ?? '?'}</span>
              <span className="w-5">{oil?.emoji ?? '🌿'}</span>
              <span className="flex-1 truncate text-forest-200">{oil?.name ?? d.oil_slug}</span>
              <div className="w-28 h-2 rounded-full bg-forest-900/60 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 text-right tabular-nums text-forest-400">{d.usage_count}</span>
            </div>
          );
        })}
      </div>
    </StatsCard>
  );
}

// ─── 10) Aroma-Erfolg-Bubble: Häufigkeit × Ø-Rating ──────────────────────
function OilRatingCorrelationChart() {
  const q = useStatsOilRatingCorrelation(1);
  const data = q.data ?? [];
  const maxUse = Math.max(1, ...data.map((d) => d.usage_count));
  const W = 480, H = 280, padL = 36, padB = 24;
  const x = (use: number) => padL + (use / maxUse) * (W - padL - 20);
  const y = (rating: number) => H - padB - (Math.max(0, rating - 1) / 4) * (H - padB - 20);

  return (
    <StatsCard
      title="10. Aroma-Erfolg"
      icon="✨"
      subtitle="Häufigkeit × Ø-Bewertung"
      loading={q.isLoading}
      empty={data.length === 0}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* Y */}
        {[1,2,3,4,5].map((s) => (
          <g key={s}>
            <line x1={padL} y1={y(s)} x2={W-10} y2={y(s)} stroke="rgba(255,255,255,0.06)" />
            <text x={padL-4} y={y(s)+3} fontSize="9" fill="rgba(255,255,255,0.5)" textAnchor="end">{s}★</text>
          </g>
        ))}
        <line x1={padL} y1={y(1)} x2={W-10} y2={y(1)} stroke="rgba(255,255,255,0.2)" />
        <line x1={padL} y1={y(1)} x2={padL} y2={20} stroke="rgba(255,255,255,0.2)" />
        <text x={W/2} y={H-6} fontSize="9" fill="rgba(255,255,255,0.5)" textAnchor="middle">Häufigkeit →</text>
        {/* Bubbles */}
        {data.map((d) => {
          const oil = OIL_BY_ID[d.oil_slug];
          if (Number(d.avg_rating) === 0) return null;
          const r = Math.max(3, Math.min(18, Math.sqrt(d.rating_count + 1) * 3));
          return (
            <g key={d.oil_slug}>
              <circle
                cx={x(d.usage_count)}
                cy={y(Number(d.avg_rating))}
                r={r}
                fill="rgba(34,197,94,0.45)"
                stroke="rgb(34,197,94)"
                strokeWidth={1.2}
              >
                <title>{oil?.name ?? d.oil_slug} · {d.usage_count}× · {Number(d.avg_rating).toFixed(2)}★ ({d.rating_count} Bew.)</title>
              </circle>
              <text x={x(d.usage_count)} y={y(Number(d.avg_rating)) - r - 2} fontSize="8" fill="rgba(255,255,255,0.75)" textAnchor="middle">
                {oil?.emoji ?? ''}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-[10px] text-forest-500 mt-2">Hover für Details · oben+rechts = ideal · unten-rechts = oft aber schwach bewertet</p>
    </StatsCard>
  );
}

// ─── 11) Aromen-Saisonalität (Kategorie × Monat) ─────────────────────────
function OilSeasonalityChart() {
  const q = useStatsOilSeasonality();
  const data = q.data ?? [];

  // Aggregiere pro Aroma-Kategorie × Monat
  const byCatMonth = new Map<string, number>();
  let maxV = 1;
  for (const row of data) {
    const oil = OIL_BY_ID[row.oil_slug];
    if (!oil) continue;
    const key = `${oil.category}|${row.month}`;
    const sum = (byCatMonth.get(key) ?? 0) + row.usage_count;
    byCatMonth.set(key, sum);
    if (sum > maxV) maxV = sum;
  }

  const categories = Array.from(new Set(OILS.map((o) => o.category)));

  return (
    <StatsCard
      title="11. Aromen-Saisonalität"
      icon="🌸"
      subtitle="Kategorie × Monat (welche Aromen wann?)"
      loading={q.isLoading}
      empty={data.length === 0}
    >
      <div className="overflow-x-auto">
        <table className="text-[10px] tabular-nums">
          <thead>
            <tr>
              <th className="text-left text-forest-400 pr-2 pb-1">Kategorie</th>
              {MONTH_LABELS.map((m) => <th key={m} className="font-normal text-forest-400 px-1 pb-1">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat}>
                <td className="text-forest-200 pr-2 capitalize whitespace-nowrap">{cat}</td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => {
                  const v = byCatMonth.get(`${cat}|${mo}`) ?? 0;
                  const intensity = v / maxV;
                  const bg = v === 0
                    ? 'rgba(255,255,255,0.04)'
                    : `hsla(140, 60%, ${25 + intensity * 45}%, ${0.3 + intensity * 0.7})`;
                  return (
                    <td key={mo} className="px-0.5 py-0.5">
                      <div
                        className="w-7 h-6 rounded flex items-center justify-center text-[9px]"
                        style={{ background: bg, color: intensity > 0.5 ? '#06180e' : 'rgba(255,255,255,0.7)' }}
                        title={`${cat} im ${MONTH_LABELS[mo-1]} · ${v} Einsätze`}
                      >{v || ''}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StatsCard>
  );
}
