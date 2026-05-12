import { useStatsFeedActivity, useStatsFeedReactionDistribution, useStatsFollowerNetwork } from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import { StatsCard } from './StatsCard';

const REACTION_META: Record<string, { emoji: string; color: string; label: string }> = {
  fire:    { emoji: '🔥', color: '#ef4444', label: 'Heiß' },
  water:   { emoji: '💧', color: '#3b82f6', label: 'Erfrischend' },
  leaf:    { emoji: '🌿', color: '#22c55e', label: 'Wohltuend' },
  crown:   { emoji: '👑', color: '#f59e0b', label: 'Königlich' },
  theater: { emoji: '🎭', color: '#a855f7', label: 'Show!' },
};

export function SocialStatsSection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <FeedActivityChart />
      <ReactionDistributionChart />
      <div className="lg:col-span-2">
        <FollowerNetworkChart />
      </div>
    </div>
  );
}

// ─── 18) Feed-Aktivität pro Tag ──────────────────────────────────────────
function FeedActivityChart() {
  const q = useStatsFeedActivity(30);
  const data = q.data ?? [];

  const maxTotal = Math.max(1, ...data.map((d) => d.posts + d.reactions));
  const totalPosts = data.reduce((s, d) => s + d.posts, 0);
  const totalReactions = data.reduce((s, d) => s + d.reactions, 0);
  const W = 480, H = 200, padL = 30, padB = 24;
  const stepX = data.length > 0 ? (W - padL - 10) / data.length : 0;

  return (
    <StatsCard
      title="18. Feed-Aktivität"
      icon="📸"
      subtitle={`${totalPosts} Posts · ${totalReactions} Reactions · letzte 30 Tage`}
      loading={q.isLoading}
      empty={data.length === 0}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={padL} y1={H-padB-(H-padB-20)*f} x2={W-10} y2={H-padB-(H-padB-20)*f} stroke="rgba(255,255,255,0.06)" />
        ))}
        {data.map((d, i) => {
          const total = d.posts + d.reactions;
          if (total === 0) return null;
          const totalH = (total / maxTotal) * (H - padB - 20);
          const postsH = total > 0 ? (d.posts / total) * totalH : 0;
          const x = padL + i*stepX + 1;
          const w = Math.max(2, stepX - 2);
          return (
            <g key={d.day}>
              <rect x={x} y={H-padB-postsH} width={w} height={postsH} fill="#a855f7" />
              <rect x={x} y={H-padB-totalH} width={w} height={totalH - postsH} fill="#ec4899" opacity={0.7} />
            </g>
          );
        })}
        {/* Tages-Labels (jeder 5.) */}
        {data.filter((_, i) => i % 5 === 0).map((d, j) => {
          const i = j * 5;
          return (
            <text key={d.day} x={padL + i*stepX} y={H-6} fontSize="8" fill="rgba(255,255,255,0.5)" textAnchor="middle">
              {d.day.slice(5)}
            </text>
          );
        })}
      </svg>
      <div className="flex items-center gap-3 mt-2 text-[10px]">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-purple-500" />Posts</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-pink-500" />Reactions</span>
      </div>
    </StatsCard>
  );
}

// ─── 19) Reaction-Verteilung Donut ───────────────────────────────────────
function ReactionDistributionChart() {
  const q = useStatsFeedReactionDistribution();
  const data = q.data ?? [];
  const total = data.reduce((s, d) => s + d.count, 0);

  let cumAngle = 0;
  const segments = data.map((d) => {
    const meta = REACTION_META[d.reaction] ?? { emoji: '?', color: '#888', label: d.reaction };
    const pct = total > 0 ? d.count / total : 0;
    const startA = cumAngle;
    const endA = cumAngle + pct * Math.PI * 2;
    cumAngle = endA;
    return { ...d, meta, pct, startA, endA };
  });

  function arc(startA: number, endA: number, r: number, ri: number) {
    const cx = 60, cy = 60;
    const x1 = cx + Math.cos(startA - Math.PI/2) * r;
    const y1 = cy + Math.sin(startA - Math.PI/2) * r;
    const x2 = cx + Math.cos(endA - Math.PI/2) * r;
    const y2 = cy + Math.sin(endA - Math.PI/2) * r;
    const x1i = cx + Math.cos(startA - Math.PI/2) * ri;
    const y1i = cy + Math.sin(startA - Math.PI/2) * ri;
    const x2i = cx + Math.cos(endA - Math.PI/2) * ri;
    const y2i = cy + Math.sin(endA - Math.PI/2) * ri;
    const large = endA - startA > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x2i} ${y2i} A ${ri} ${ri} 0 ${large} 0 ${x1i} ${y1i} Z`;
  }

  return (
    <StatsCard
      title="19. Reaction-Verteilung"
      icon="❤️‍🔥"
      subtitle={`${total} Reactions gesamt`}
      loading={q.isLoading}
      empty={total === 0}
    >
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 120" className="w-32 h-32 flex-shrink-0">
          {segments.map((s) => (
            <path key={s.reaction} d={arc(s.startA, s.endA, 55, 30)} fill={s.meta.color} opacity={0.9}>
              <title>{s.meta.emoji} {s.meta.label}: {s.count} ({(s.pct*100).toFixed(0)}%)</title>
            </path>
          ))}
          <text x={60} y={64} fontSize="20" textAnchor="middle" fill="rgba(255,255,255,0.9)">
            {segments[0]?.meta.emoji ?? ''}
          </text>
        </svg>
        <div className="flex-1 space-y-1.5">
          {segments.map((s) => (
            <div key={s.reaction} className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-sm" style={{ background: s.meta.color }} />
              <span className="text-lg">{s.meta.emoji}</span>
              <span className="text-forest-200 flex-1">{s.meta.label}</span>
              <span className="text-forest-400 tabular-nums text-[10px]">{s.count} · {(s.pct*100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </StatsCard>
  );
}

// ─── 20) Follower-Netzwerk ───────────────────────────────────────────────
function FollowerNetworkChart() {
  const q = useStatsFollowerNetwork(8);
  const data = q.data ?? [];
  const stars = data.filter((d) => d.kind === 'star');
  const fans = data.filter((d) => d.kind === 'fan');

  return (
    <StatsCard
      title="20. Follower-Netzwerk"
      icon="🌟"
      subtitle="Top-Stars und Top-Fans"
      loading={q.isLoading}
      empty={data.length === 0}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h4 className="text-[10px] uppercase tracking-wider text-amber-400/80 font-semibold mb-2">🌟 Stars (meiste Fans)</h4>
          <ol className="space-y-1.5">
            {stars.map((d, i) => (
              <li key={d.member_id} className="flex items-center gap-2 text-xs">
                <span className="w-5 text-forest-500 text-right">{i+1}.</span>
                <Avatar name={d.name} avatarPath={d.avatar_path} size="xs" />
                <span className="text-forest-100 flex-1 truncate">{d.name}</span>
                <span className="text-amber-300 tabular-nums text-[10px] font-semibold">{d.n} Fans</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h4 className="text-[10px] uppercase tracking-wider text-cyan-400/80 font-semibold mb-2">🤝 Super-Fans (folgen am meisten)</h4>
          <ol className="space-y-1.5">
            {fans.map((d, i) => (
              <li key={d.member_id} className="flex items-center gap-2 text-xs">
                <span className="w-5 text-forest-500 text-right">{i+1}.</span>
                <Avatar name={d.name} avatarPath={d.avatar_path} size="xs" />
                <span className="text-forest-100 flex-1 truncate">{d.name}</span>
                <span className="text-cyan-300 tabular-nums text-[10px] font-semibold">folgt {d.n}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </StatsCard>
  );
}

