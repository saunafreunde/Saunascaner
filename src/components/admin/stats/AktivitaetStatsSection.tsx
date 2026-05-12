import {
  useStatsVolumeByMonth,
  useStatsWeekdayHourHeatmap,
  useStatsFallbackRateByMonth,
  useStatsTeamAufgussSummary,
} from '@/lib/api';
import { StatsCard } from './StatsCard';

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function AktivitaetStatsSection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <VolumeChart />
      <HeatmapChart />
      <FallbackRateChart />
      <TeamAufgussChart />
    </div>
  );
}

// ─── 5) Volumen-Trend (stacked area) ─────────────────────────────────────
function VolumeChart() {
  const q = useStatsVolumeByMonth(12);
  const data = q.data ?? [];

  const W = 480, H = 220, padL = 40, padB = 24;
  const max = Math.max(1, ...data.map((d) => d.eigen + d.fallback + d.team));
  const stepX = data.length > 1 ? (W - padL - 10) / (data.length - 1) : 0;
  const y = (v: number) => H - padB - (v / max) * (H - padB - 20);

  const eigenPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${padL + i * stepX},${y(d.eigen)}`).join(' ');
  const totalPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${padL + i * stepX},${y(d.eigen + d.fallback + d.team)}`).join(' ');

  return (
    <StatsCard
      title="5. Aufguss-Volumen pro Monat"
      icon="📈"
      subtitle="letzte 12 Monate"
      loading={q.isLoading}
      empty={data.length === 0}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* Gitter */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={padL} y1={y(max*f)} x2={W-10} y2={y(max*f)} stroke="rgba(255,255,255,0.06)" />
        ))}
        {/* Stapel */}
        {data.map((d, i) => {
          const x = padL + i * stepX;
          const total = d.eigen + d.fallback + d.team;
          const yT = y(total), yEF = y(d.eigen + d.fallback), yE = y(d.eigen);
          return (
            <g key={d.month}>
              <line x1={x} y1={y(0)} x2={x} y2={yE} stroke="#22c55e" strokeWidth={Math.max(8, stepX - 4)} opacity={0.85} />
              <line x1={x} y1={yE} x2={x} y2={yEF} stroke="#f59e0b" strokeWidth={Math.max(8, stepX - 4)} opacity={0.85} />
              <line x1={x} y1={yEF} x2={x} y2={yT} stroke="#a855f7" strokeWidth={Math.max(8, stepX - 4)} opacity={0.85} />
              <text x={x} y={H-6} fontSize="8" fill="rgba(255,255,255,0.5)" textAnchor="middle">{d.month.slice(5)}</text>
            </g>
          );
        })}
        <path d={eigenPath} fill="none" stroke="#22c55e" strokeWidth={1.5} opacity={0.7} />
        <path d={totalPath} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.5} />
      </svg>
      <div className="flex items-center gap-3 mt-2 text-[10px]">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-emerald-500" />eigen</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-amber-500" />Personal-Fallback</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-purple-500" />Team</span>
      </div>
    </StatsCard>
  );
}

// ─── 6) Wochentag × Stunde Heatmap ───────────────────────────────────────
function HeatmapChart() {
  const q = useStatsWeekdayHourHeatmap(12);
  const data = q.data ?? [];

  // Map (weekday, hour) → count, finde Min/Max
  const map = new Map<string, number>();
  let maxCount = 1;
  for (const c of data) {
    map.set(`${c.weekday}|${c.hour}`, c.count);
    if (c.count > maxCount) maxCount = c.count;
  }

  // Stunden 11-20 (alle möglichen Slot-Stunden)
  const hours = Array.from({ length: 10 }, (_, i) => 11 + i);

  return (
    <StatsCard
      title="6. Wochentag × Stunde"
      icon="🗓️"
      subtitle="Wann ist der Verein aktiv?"
      loading={q.isLoading}
      empty={data.length === 0}
    >
      <div className="overflow-x-auto">
        <table className="text-[10px] tabular-nums">
          <thead>
            <tr>
              <th></th>
              {hours.map((h) => <th key={h} className="font-normal text-forest-400 px-1">{h}h</th>)}
            </tr>
          </thead>
          <tbody>
            {[2,3,4,5,6,0].map((wd) => (
              <tr key={wd}>
                <td className="text-forest-300 pr-1.5 text-right">{WEEKDAY_LABELS[wd]}</td>
                {hours.map((h) => {
                  const v = map.get(`${wd}|${h}`) ?? 0;
                  const intensity = v / maxCount;
                  const bg = v === 0
                    ? 'rgba(255,255,255,0.04)'
                    : `hsla(20, 90%, ${20 + intensity * 50}%, ${0.3 + intensity * 0.7})`;
                  return (
                    <td key={h} className="px-0.5 py-0.5">
                      <div
                        className="w-7 h-6 rounded flex items-center justify-center text-[9px]"
                        style={{ background: bg, color: intensity > 0.5 ? '#1a0a00' : 'rgba(255,255,255,0.7)' }}
                        title={`${WEEKDAY_LABELS[wd]} ${h}:00 · ${v} Aufgüsse`}
                      >{v || ''}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-forest-500 mt-2">Hellere Kacheln = mehr Aufgüsse · Mo ist Ruhetag</p>
    </StatsCard>
  );
}

// ─── 7) Personal-Fallback-Quote über Zeit ────────────────────────────────
function FallbackRateChart() {
  const q = useStatsFallbackRateByMonth(12);
  const data = q.data ?? [];

  const W = 480, H = 200, padL = 35, padB = 24;
  const max = 100;
  const stepX = data.length > 1 ? (W - padL - 10) / (data.length - 1) : 0;
  const y = (v: number) => H - padB - (Math.min(v, max) / max) * (H - padB - 20);
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${padL + i * stepX},${y(d.fallback_pct)}`).join(' ');

  return (
    <StatsCard
      title="7. Personal-Fallback-Quote"
      icon="👨‍🍳"
      subtitle="je niedriger, je engagierter"
      loading={q.isLoading}
      empty={data.length === 0}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, 25, 50, 75, 100].map((f) => (
          <g key={f}>
            <line x1={padL} y1={y(f)} x2={W-10} y2={y(f)} stroke="rgba(255,255,255,0.06)" />
            <text x={padL-4} y={y(f)+3} fontSize="9" fill="rgba(255,255,255,0.5)" textAnchor="end">{f}%</text>
          </g>
        ))}
        <path d={path} fill="none" stroke="#f59e0b" strokeWidth={2} />
        {data.map((d, i) => (
          <g key={d.month}>
            <circle cx={padL + i*stepX} cy={y(d.fallback_pct)} r={3} fill="#f59e0b" />
            <text x={padL + i*stepX} y={H-6} fontSize="8" fill="rgba(255,255,255,0.5)" textAnchor="middle">{d.month.slice(5)}</text>
          </g>
        ))}
      </svg>
    </StatsCard>
  );
}

// ─── 8) Team-Aufguss-Anteil + Top-3 ──────────────────────────────────────
function TeamAufgussChart() {
  const q = useStatsTeamAufgussSummary();
  const data = q.data ?? [];
  const first = data[0];
  const pct = Number(first?.team_pct ?? 0);

  return (
    <StatsCard
      title="8. Team-Aufgüsse"
      icon="👥"
      subtitle="Mehrspieler-Modus"
      loading={q.isLoading}
      empty={!first}
    >
      <div className="flex items-center gap-6">
        {/* Donut */}
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx={50} cy={50} r={40} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={14} />
            <circle
              cx={50} cy={50} r={40}
              fill="none"
              stroke="#a855f7"
              strokeWidth={14}
              strokeDasharray={`${(pct/100) * 251.3} 251.3`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-purple-300 tabular-nums">{pct.toFixed(0)}%</span>
            <span className="text-[10px] text-forest-400">Team</span>
          </div>
        </div>
        {/* Top-3 */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-forest-400 mb-1.5">Top-Team-Aufgießer</p>
          <ol className="space-y-1 text-xs">
            {data.filter((r) => r.top_member_id).map((r, i) => (
              <li key={r.top_member_id} className="flex items-center justify-between gap-2">
                <span className="text-forest-100 truncate">{i+1}. {r.top_name}</span>
                <span className="text-forest-400 tabular-nums text-[10px]">{r.top_count}×</span>
              </li>
            ))}
          </ol>
          <p className="text-[10px] text-forest-500 mt-2">
            {first?.team_count ?? 0} von {first?.total ?? 0} insgesamt
          </p>
        </div>
      </div>
    </StatsCard>
  );
}
