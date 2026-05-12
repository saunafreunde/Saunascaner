import {
  useStatsStreakLeaderboard,
  useStatsActivityScore,
  useStatsMemberGrowth,
  useStatsGuestRetentionFunnel,
} from '@/lib/api';
import { StatsCard } from './StatsCard';

const ROLE_EMOJI: Record<string, string> = { admin: '⚙️', aufgieser: '🧖', guest_aufgieser: '🌍', staff: '👨‍🍳', member: '🤝', gast: '👋' };
const ROLE_LABEL: Record<string, string> = { admin: 'Admin', aufgieser: 'Aufgießer', guest_aufgieser: 'Gast-Aufg.', staff: 'Personal', member: 'Mitglied', gast: 'Gast' };
const ROLE_COLOR: Record<string, string> = { admin: '#a855f7', staff: '#94a3b8', member: '#22c55e', guest_aufgieser: '#06b6d4', gast: '#f59e0b' };

export function MitgliederStatsSection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <StreakChart />
      <ActivityScoreChart />
      <MemberGrowthChart />
      <RetentionFunnelChart />
    </div>
  );
}

// ─── 12) Streak-Hall-of-Fame ─────────────────────────────────────────────
function StreakChart() {
  const q = useStatsStreakLeaderboard(12);
  const data = q.data ?? [];
  const maxStreak = Math.max(1, ...data.map((d) => d.longest_streak));

  return (
    <StatsCard
      title="12. Streak-Hall-of-Fame"
      icon="🔥"
      subtitle="längste Anwesenheits-Serie in Wochen"
      loading={q.isLoading}
      empty={data.length === 0}
    >
      <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
        {data.map((d, i) => {
          const pct = (d.longest_streak / maxStreak) * 100;
          return (
            <div key={d.member_id} className="text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-forest-100 truncate">
                  <span className="text-forest-500 mr-1">{i+1}.</span>
                  {d.name}
                </span>
                <span className="text-forest-400 tabular-nums text-[10px]">
                  {d.longest_streak} Wo {d.current_streak > 0 && <span className="text-emerald-300">· aktuell {d.current_streak}</span>}
                </span>
              </div>
              <div className="mt-0.5 h-1.5 rounded-full bg-forest-900/60 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </StatsCard>
  );
}

// ─── 13) Aktivitäts-Score ────────────────────────────────────────────────
function ActivityScoreChart() {
  const q = useStatsActivityScore(15);
  const data = q.data ?? [];
  const maxScore = Math.max(1, ...data.map((d) => Number(d.total_score)));

  return (
    <StatsCard
      title="13. Aktivitäts-Score"
      icon="⚡"
      subtitle="Aufguss×5 + Besuch×2 + Rating + Post×3 + Reaction×0.5"
      loading={q.isLoading}
      empty={data.length === 0}
    >
      <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
        {data.map((d, i) => {
          const score = Number(d.total_score);
          const pct = (score / maxScore) * 100;
          const seg = (n: number, mult: number) => (n * mult / score) * pct;
          return (
            <div key={d.member_id} className="text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-forest-100 truncate flex items-center gap-1">
                  <span className="text-forest-500">{i+1}.</span>
                  <span>{ROLE_EMOJI[d.role] ?? '·'}</span>
                  {d.name}
                </span>
                <span className="text-amber-300 tabular-nums text-[10px] font-semibold">{score.toFixed(0)} P.</span>
              </div>
              <div className="mt-0.5 flex h-2 rounded-full overflow-hidden bg-forest-900/60">
                <div style={{ width: `${seg(d.infusions_done, 5)}%`, background: '#22c55e' }} title={`${d.infusions_done} Aufgüsse`} />
                <div style={{ width: `${seg(d.attendances, 2)}%`, background: '#0ea5e9' }} title={`${d.attendances} Besuche`} />
                <div style={{ width: `${seg(d.ratings_given, 1)}%`, background: '#f59e0b' }} title={`${d.ratings_given} Bewertungen`} />
                <div style={{ width: `${seg(d.posts, 3)}%`, background: '#a855f7' }} title={`${d.posts} Posts`} />
                <div style={{ width: `${seg(d.reactions_made, 0.5)}%`, background: '#ec4899' }} title={`${d.reactions_made} Reactions`} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2 text-[9px]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" />Aufguss</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-sky-500" />Besuch</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500" />Rating</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-500" />Post</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-pink-500" />Reaction</span>
      </div>
    </StatsCard>
  );
}

// ─── 14) Mitgliederwachstum nach Rolle ───────────────────────────────────
function MemberGrowthChart() {
  const q = useStatsMemberGrowth(12);
  const data = q.data ?? [];

  // Aggregate by month + role
  const months = Array.from(new Set(data.map((d) => d.month))).sort();
  const roles = Array.from(new Set(data.map((d) => d.role)));

  type Bucket = { month: string; perRole: Record<string, number>; total: number };
  const buckets: Bucket[] = months.map((m) => {
    const perRole: Record<string, number> = {};
    let total = 0;
    for (const r of roles) {
      const row = data.find((d) => d.month === m && d.role === r);
      perRole[r] = row?.joined ?? 0;
      total += perRole[r];
    }
    return { month: m, perRole, total };
  });

  const maxTotal = Math.max(1, ...buckets.map((b) => b.total));
  const W = 480, H = 220, padL = 30, padB = 24;
  const stepX = buckets.length > 1 ? (W - padL - 10) / (buckets.length - 1) : 0;

  return (
    <StatsCard
      title="14. Mitgliederwachstum"
      icon="📈"
      subtitle="neue Mitglieder pro Monat & Rolle"
      loading={q.isLoading}
      empty={buckets.length === 0}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {buckets.map((b, i) => {
          const x = padL + i * stepX;
          let yCursor = H - padB;
          return (
            <g key={b.month}>
              {roles.map((r) => {
                const v = b.perRole[r] ?? 0;
                if (v === 0) return null;
                const h = (v / maxTotal) * (H - padB - 20);
                yCursor -= h;
                return (
                  <rect
                    key={r}
                    x={x - stepX*0.3}
                    y={yCursor}
                    width={Math.max(8, stepX*0.6)}
                    height={h}
                    fill={ROLE_COLOR[r] ?? '#22c55e'}
                    opacity={0.85}
                  >
                    <title>{ROLE_LABEL[r] ?? r}: {v} im {b.month}</title>
                  </rect>
                );
              })}
              <text x={x} y={H-6} fontSize="8" fill="rgba(255,255,255,0.5)" textAnchor="middle">{b.month.slice(5)}</text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px]">
        {roles.map((r) => (
          <span key={r} className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm" style={{ background: ROLE_COLOR[r] ?? '#22c55e' }} />
            {ROLE_LABEL[r] ?? r}
          </span>
        ))}
      </div>
    </StatsCard>
  );
}

// ─── 15) Wiederkehr-Funnel ───────────────────────────────────────────────
function RetentionFunnelChart() {
  const q = useStatsGuestRetentionFunnel();
  const data = q.data ?? [];
  // sortier nach Bucket-Reihenfolge
  const order = ['all_gaeste', '>=1 Besuch', '>=2 Besuche', '>=5 Besuche', '>=10 Besuche'];
  const sorted = [...data].sort((a, b) => order.indexOf(a.bucket) - order.indexOf(b.bucket));
  const max = Math.max(1, ...sorted.map((d) => d.member_count));

  return (
    <StatsCard
      title="15. Gäste-Wiederkehr"
      icon="🔄"
      subtitle="Funnel von Erst- zu Stamm-Gästen"
      loading={q.isLoading}
      empty={sorted.length === 0}
    >
      <div className="space-y-2 mt-2">
        {sorted.map((d, i) => {
          const pct = (d.member_count / max) * 100;
          const previous = i > 0 ? sorted[i-1]?.member_count : null;
          const dropoff = previous && previous > 0 ? Math.round(100 - (d.member_count / previous) * 100) : null;
          return (
            <div key={d.bucket}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-forest-100">{d.bucket}</span>
                <span className="text-forest-400 tabular-nums text-[10px]">
                  {d.member_count}
                  {dropoff !== null && dropoff > 0 && <span className="text-rose-400 ml-1.5">−{dropoff}%</span>}
                </span>
              </div>
              <div className="mt-1 h-4 rounded bg-forest-900/60 overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${pct}%`,
                    background: `hsl(${200 - i*40}, 70%, 55%)`,
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
