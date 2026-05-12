import { Link } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { FollowButton } from '@/components/FollowButton';
import { SPECIALTY_LABELS, type StarSpecialty } from '@/lib/api';
import type { AufgieserStar, StarStats } from '@/types/database';

interface StarTradingCardProps {
  star: AufgieserStar;
  stats?: StarStats | null;
  size?: 'compact' | 'full';
  showFollow?: boolean;
  href?: string;
}

// Trading-Card für Aufgießer-Star — schwarze Glanz-Optik mit Accent-Tint.
// `compact` für /aufgieser-Übersicht, `full` für /aufgieser/:id Detail-Header.
export function StarTradingCard({
  star, stats, size = 'compact', showFollow = true, href,
}: StarTradingCardProps) {
  const accent = star.star_accent_color ?? '#f59e0b';
  const totalAufguss = stats?.total_aufguss ?? star.total_aufguss ?? 0;
  const fanCount = stats?.fan_count ?? star.fan_count ?? 0;
  const avgRating = stats?.avg_rating ?? star.avg_rating ?? null;
  const badgeCount = stats?.badge_count ?? 0;
  const teamAufguss = stats?.team_aufguss ?? 0;
  const favTemp = stats?.favorite_temp ?? null;

  const specialties = (star.specialties ?? []) as StarSpecialty[];

  const body = (
    <div
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest-950/95 to-forest-900/90 ring-1 ring-forest-800/60 shadow-xl ${size === 'full' ? 'p-7' : 'p-4'}`}
      style={{
        boxShadow: `0 0 32px ${accent}33, inset 0 0 0 1px ${accent}44`,
      }}
    >
      {/* Accent-Glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(120% 80% at 50% 0%, ${accent}26 0%, transparent 60%)`,
        }}
        aria-hidden
      />

      <div className="relative flex flex-col items-center text-center">
        <Avatar
          name={star.name}
          avatarPath={star.avatar_path}
          size={size === 'full' ? 'xl' : 'lg'}
          isAufgieser
        />
        <h3 className={`mt-3 font-bold text-forest-100 ${size === 'full' ? 'text-2xl' : 'text-lg'}`}>
          {star.name}
        </h3>
        {star.signature_aufguss && (
          <p className="mt-1 text-xs font-medium uppercase tracking-widest" style={{ color: accent }}>
            {star.signature_aufguss}
          </p>
        )}
        {star.style_quote && size === 'full' && (
          <p className="mt-3 italic text-sm text-forest-300/90">„{star.style_quote}"</p>
        )}

        {specialties.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {specialties.map((sp) => {
              const def = SPECIALTY_LABELS[sp];
              if (!def) return null;
              return (
                <span
                  key={sp}
                  className="inline-flex items-center gap-1 rounded-full bg-forest-900/80 ring-1 ring-forest-700/50 px-2.5 py-0.5 text-[11px] text-forest-200"
                >
                  <span>{def.emoji}</span>
                  <span>{def.label}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Stats-Grid */}
        <div className={`mt-4 grid w-full gap-2 ${size === 'full' ? 'grid-cols-3' : 'grid-cols-3'}`}>
          <StatTile label="Aufgüsse" value={totalAufguss} />
          <StatTile label="Fans" value={fanCount} accent={accent} />
          <StatTile label="⌀ Rating" value={avgRating ? `${avgRating.toFixed(1)}★` : '—'} />
          {size === 'full' && (
            <>
              <StatTile label="Team" value={teamAufguss} />
              <StatTile label="Badges" value={badgeCount} />
              <StatTile label="Temp" value={favTemp ? `${favTemp}°C` : '—'} />
            </>
          )}
        </div>

        {showFollow && (
          <div className="mt-4">
            <FollowButton memberId={star.id} compact={size === 'compact'} />
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link to={href} className="block transition hover:-translate-y-0.5">{body}</Link>;
  }
  return body;
}

function StatTile({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded-xl bg-forest-950/70 ring-1 ring-forest-800/50 px-2 py-2">
      <div className="text-base font-bold tabular-nums" style={{ color: accent ?? '#d1d5db' }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-forest-400">{label}</div>
    </div>
  );
}
