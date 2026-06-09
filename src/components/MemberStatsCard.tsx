import { formatInTimeZone } from 'date-fns-tz';
import { useMemberStatsFull } from '@/lib/api';

interface Props {
  memberId: string;
  compact?: boolean;
}

// 8-Tile Stats-Hero für Gast-Dashboard / Profil.
// Zeigt sauna_days, streak, ratings, aufgusse_attended, unique_aufgieser, follows,
// favorite_aufgieser, favorite_sauna. Plus „Mitglied seit"-Footer + Ø-Bewertung.
export function MemberStatsCard({ memberId, compact = false }: Props) {
  const stats = useMemberStatsFull(memberId);

  if (stats.isLoading) {
    return (
      <div className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5 text-center text-forest-400">
        Lädt…
      </div>
    );
  }
  if (!stats.data) return null;
  const s = stats.data;

  const memberSinceLabel = formatMemberSince(s.member_since);
  const avg = s.avg_rating_given ?? null;

  return (
    <section className="rounded-3xl bg-gradient-to-br from-amber-900/15 via-forest-950/85 to-forest-950/85 ring-1 ring-amber-500/20 p-5 backdrop-blur space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
          📊 Deine Statistik
        </h2>
        <div className="text-[11px] text-forest-400">
          Mitglied seit {memberSinceLabel}
        </div>
      </div>

      <div className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'}`}>
        <StatTile emoji="🔥" value={s.sauna_days} label="Sauna-Tage" accent="#f59e0b" />
        <StatTile emoji="📅" value={s.streak_weeks > 0 ? `${s.streak_weeks}w` : '—'} label="Streak" accent="#22c55e" />
        <StatTile emoji="🧖" value={s.aufgusse_attended} label="Aufgüsse erlebt" accent="#ec4899" />
        <StatTile emoji="⭐" value={s.ratings_given} label="Bewertungen" accent="#fbbf24" />
        <StatTile emoji="🔍" value={s.unique_aufgieser} label="Versch. Aufgießer" accent="#a78bfa" />
        <StatTile emoji="❤️" value={s.follows_count} label="Folgst du" accent="#ef4444" />
        <StatTile emoji="🌟" value={s.favorite_aufgieser ?? '—'} label="Lieblings-Aufgießer" accent="#facc15" small />
        <StatTile emoji="🌡️" value={s.favorite_sauna ?? '—'} label="Lieblings-Sauna" accent="#fb923c" small />
      </div>

      {avg !== null && (
        <div className="text-center text-xs text-forest-300/80">
          Deine Ø-Bewertung: <strong className="text-amber-300 tabular-nums">{avg.toFixed(1)}★</strong>
        </div>
      )}
    </section>
  );
}

function StatTile({ emoji, value, label, accent, small }: {
  emoji: string;
  value: number | string;
  label: string;
  accent: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-3 text-center hover:ring-amber-500/30 transition min-w-0" title={String(value)}>
      <div className="text-2xl">{emoji}</div>
      <div
        title={String(value)}
        className={`mt-1 font-bold tabular-nums truncate ${small ? 'text-xs leading-tight' : 'text-xl'}`}
        style={{ color: accent }}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-forest-400 truncate" title={label}>{label}</div>
    </div>
  );
}

function formatMemberSince(iso: string): string {
  // Jahr/Monat in Berliner Zeit bestimmen, damit die Mitgliedsdauer nicht an
  // Monatsgrenzen um einen Monat abweicht, wenn das Gerät nicht in Berlin steht.
  const now = new Date();
  const dY = Number(formatInTimeZone(iso, 'Europe/Berlin', 'yyyy'));
  const dM = Number(formatInTimeZone(iso, 'Europe/Berlin', 'M'));
  const nY = Number(formatInTimeZone(now, 'Europe/Berlin', 'yyyy'));
  const nM = Number(formatInTimeZone(now, 'Europe/Berlin', 'M'));
  const months = (nY - dY) * 12 + (nM - dM);
  if (months < 1) return 'diesem Monat';
  if (months < 12) return `${months} Monaten`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 Jahr' : `${years} Jahren`;
}
