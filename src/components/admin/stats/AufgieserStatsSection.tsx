import { useState } from 'react';
import {
  useStatsAufgieserLeaderboard,
  useStatsAufgieserConsistency,
  useStatsVereinRatingAvg,
  useStatsAufgieserAromaSignature,
  useAufgieserRatingRadar,
} from '@/lib/api';
import { OIL_BY_ID } from '@/lib/oils';
import { StatsCard } from './StatsCard';

const CATEGORY_LABELS = ['Chemie', 'Luft', 'Wedeln', 'Hitze', 'Musik', 'Duft'];

export function AufgieserStatsSection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <LeaderboardChart />
      <RadarChart />
      <ConsistencyChart />
      <AromaSignatureChart />
    </div>
  );
}

// ─── 1) Aufgießer-Bestenliste (Bubble) ────────────────────────────────────
function LeaderboardChart() {
  const q = useStatsAufgieserLeaderboard();
  const data = q.data ?? [];

  const maxCount = Math.max(1, ...data.map((d) => d.infusion_count));
  const W = 480, H = 280, pad = 40;
  const scaleX = (v: number) => pad + (v / maxCount) * (W - pad - 20);
  const scaleY = (r: number) => H - pad - ((r - 1) / 4) * (H - pad - 20);

  return (
    <StatsCard
      title="1. Bestenliste — Anzahl × Ø-Bewertung"
      icon="🌟"
      subtitle={`${data.length} Aufgießer`}
      loading={q.isLoading}
      empty={data.length === 0}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* Axes */}
        <line x1={pad} y1={H-pad} x2={W-20} y2={H-pad} stroke="rgba(255,255,255,0.2)" />
        <line x1={pad} y1={pad/2} x2={pad} y2={H-pad} stroke="rgba(255,255,255,0.2)" />
        {/* Y-Achse Labels (1-5 Sterne) */}
        {[1,2,3,4,5].map((s) => (
          <g key={s}>
            <text x={pad-6} y={scaleY(s)+3} fontSize="9" fill="rgba(255,255,255,0.5)" textAnchor="end">{s}★</text>
            <line x1={pad} y1={scaleY(s)} x2={W-20} y2={scaleY(s)} stroke="rgba(255,255,255,0.05)" />
          </g>
        ))}
        {/* X-Achse Label */}
        <text x={W/2} y={H-8} fontSize="9" fill="rgba(255,255,255,0.5)" textAnchor="middle">Anzahl Aufgüsse →</text>
        {/* Bubbles */}
        {data.map((d, i) => {
          const r = Math.max(4, Math.min(24, Math.sqrt(d.rating_count) * 3));
          const hue = 100 + (i * 37) % 200;
          return (
            <g key={d.member_id}>
              <circle
                cx={scaleX(d.infusion_count)}
                cy={scaleY(d.avg_rating)}
                r={r}
                fill={`hsla(${hue},60%,55%,0.5)`}
                stroke={`hsl(${hue},70%,65%)`}
                strokeWidth={1.5}
              />
              <text
                x={scaleX(d.infusion_count)}
                y={scaleY(d.avg_rating) - r - 4}
                fontSize="9"
                fill="rgba(255,255,255,0.9)"
                textAnchor="middle"
              >{d.name.split(' ')[0]}</text>
            </g>
          );
        })}
      </svg>
      <p className="text-[10px] text-forest-500 mt-2">Blasen-Größe = Anzahl Bewertungen</p>
    </StatsCard>
  );
}

// ─── 2) 6-Achsen-Radar pro Aufgießer mit Verein-Overlay ───────────────────
function RadarChart() {
  const board = useStatsAufgieserLeaderboard();
  const avg = useStatsVereinRatingAvg();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const candidates = board.data ?? [];
  const activeId = selectedId ?? candidates[0]?.member_id ?? null;
  const radar = useAufgieserRatingRadar(activeId ?? undefined);

  const avgPoint = avg.data?.[0];
  const memberData = radar.data;

  const cx = 140, cy = 130, rMax = 100;
  const points = (vals: number[]) =>
    vals.map((v, i) => {
      const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      const r = (Math.max(0, Math.min(5, v)) / 5) * rMax;
      return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
    });

  const memberVals = memberData ? [memberData.chemie, memberData.luftbewegung, memberData.wedeltechnik, memberData.hitzeniveau, memberData.musik, memberData.duftentwicklung].map((n) => Number(n ?? 0)) : null;
  const avgVals = avgPoint ? [avgPoint.chemie, avgPoint.luftbewegung, avgPoint.wedeltechnik, avgPoint.hitzeniveau, avgPoint.musik, avgPoint.duftentwicklung].map((n) => Number(n ?? 0)) : null;

  return (
    <StatsCard
      title="2. Stärken-Radar"
      icon="🎯"
      subtitle="vs. Vereinsdurchschnitt"
      loading={board.isLoading || avg.isLoading}
      empty={candidates.length === 0}
    >
      <select
        value={activeId ?? ''}
        onChange={(e) => setSelectedId(e.target.value || null)}
        className="w-full mb-3 rounded-lg bg-forest-900/70 ring-1 ring-forest-700/50 px-2 py-1.5 text-xs text-forest-100"
      >
        {candidates.map((c) => (
          <option key={c.member_id} value={c.member_id}>{c.name} ({c.rating_count} Bew.)</option>
        ))}
      </select>
      <svg viewBox="0 0 280 260" className="w-full">
        {/* Grid-Kreise */}
        {[0.2, 0.4, 0.6, 0.8, 1].map((f) => (
          <circle key={f} cx={cx} cy={cy} r={rMax*f} fill="none" stroke="rgba(255,255,255,0.08)" />
        ))}
        {/* Achsen */}
        {CATEGORY_LABELS.map((_, i) => {
          const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
          return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(angle)*rMax} y2={cy + Math.sin(angle)*rMax} stroke="rgba(255,255,255,0.12)" />;
        })}
        {/* Vereinsdurchschnitt — gestrichelt */}
        {avgVals && (
          <polygon points={points(avgVals).map((p) => p.join(',')).join(' ')} fill="rgba(180,180,180,0.15)" stroke="rgba(200,200,200,0.6)" strokeWidth={1.5} strokeDasharray="4 3" />
        )}
        {/* Member */}
        {memberVals && (
          <polygon points={points(memberVals).map((p) => p.join(',')).join(' ')} fill="rgba(34,197,94,0.35)" stroke="rgb(34,197,94)" strokeWidth={2} />
        )}
        {/* Labels */}
        {CATEGORY_LABELS.map((label, i) => {
          const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
          const r = rMax + 14;
          return (
            <text
              key={label}
              x={cx + Math.cos(angle)*r}
              y={cy + Math.sin(angle)*r}
              fontSize="10"
              fill="rgba(255,255,255,0.8)"
              textAnchor="middle"
              dominantBaseline="middle"
            >{label}</text>
          );
        })}
      </svg>
      <div className="flex items-center gap-3 mt-2 text-[10px]">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500" />Aufgießer</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-t border-dashed border-zinc-400" />Verein-Ø</span>
      </div>
    </StatsCard>
  );
}

// ─── 3) Konsistenz — Streuung pro Kategorie ───────────────────────────────
function ConsistencyChart() {
  const q = useStatsAufgieserConsistency();
  const data = q.data ?? [];

  return (
    <StatsCard
      title="3. Konsistenz (Streuung)"
      icon="📏"
      subtitle="niedriger = konstanter"
      loading={q.isLoading}
      empty={data.length === 0}
      emptyText="Mindestens 3 Bewertungen pro Aufgießer nötig."
    >
      <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
        {data.map((d) => {
          const sds = [d.chemie_sd, d.luft_sd, d.wedel_sd, d.hitze_sd, d.musik_sd, d.duft_sd].map(Number);
          const avgSd = sds.reduce((a, b) => a + b, 0) / 6;
          const consistency = Math.max(0, Math.min(1, 1 - avgSd / 2));
          return (
            <div key={d.member_id} className="text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-forest-100 truncate">{d.name}</span>
                <span className="text-forest-400 tabular-nums">{(avgSd).toFixed(2)} σ · {d.rating_count} Bew.</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-forest-900/60 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${consistency * 100}%`,
                    background: `linear-gradient(90deg, #ef4444, #f59e0b, #22c55e)`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </StatsCard>
  );
}

// ─── 4) Aroma-Signature pro Aufgießer ────────────────────────────────────
function AromaSignatureChart() {
  const board = useStatsAufgieserLeaderboard();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const candidates = board.data ?? [];
  const activeId = selectedId ?? candidates[0]?.member_id ?? null;
  const q = useStatsAufgieserAromaSignature(activeId, 12);
  const data = q.data ?? [];

  const maxUse = Math.max(1, ...data.map((d) => d.usage_count));

  return (
    <StatsCard
      title="4. Aroma-Signature"
      icon="🌿"
      subtitle="Lieblings-Öle pro Aufgießer"
      loading={board.isLoading || q.isLoading}
      empty={candidates.length === 0}
    >
      <select
        value={activeId ?? ''}
        onChange={(e) => setSelectedId(e.target.value || null)}
        className="w-full mb-3 rounded-lg bg-forest-900/70 ring-1 ring-forest-700/50 px-2 py-1.5 text-xs text-forest-100"
      >
        {candidates.map((c) => (
          <option key={c.member_id} value={c.member_id}>{c.name}</option>
        ))}
      </select>
      {data.length === 0 ? (
        <p className="text-center text-forest-500 text-xs py-6">Noch keine Aromen verwendet.</p>
      ) : (
        <div className="space-y-1">
          {data.map((d) => {
            const oil = OIL_BY_ID[d.oil_slug];
            const pct = (d.usage_count / maxUse) * 100;
            return (
              <div key={d.oil_slug} className="flex items-center gap-2 text-xs">
                <span className="w-6 text-right tabular-nums text-emerald-300/70 text-[10px]">#{oil?.number ?? '?'}</span>
                <span className="w-5">{oil?.emoji ?? '🌿'}</span>
                <span className="flex-1 truncate text-forest-200">{oil?.name ?? d.oil_slug}</span>
                <div className="w-24 h-2 rounded-full bg-forest-900/60 overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right tabular-nums text-forest-400">{d.usage_count}</span>
              </div>
            );
          })}
        </div>
      )}
    </StatsCard>
  );
}
