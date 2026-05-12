import {
  MILESTONE_BADGES, SPECIAL_BADGES, GAST_BADGES, TIER_STYLES, TIER_LABEL,
  type BadgeDefinition,
} from '@/lib/badges';
import { useMyBadges, useMemberStats, useMember } from '@/lib/api';
import type { MemberAchievement } from '@/lib/api';

type Props = {
  memberId: string;
};

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-1.5 w-full rounded-full bg-forest-900/60 overflow-hidden mt-1.5">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

function BadgeItem({
  badge,
  achievement,
  stats,
}: {
  badge: BadgeDefinition;
  achievement: MemberAchievement | undefined;
  stats: { total_infusions: number; team_infusions: number } | undefined;
}) {
  const s = TIER_STYLES[badge.tier];
  const earned = !!achievement;

  const progressCount =
    badge.category === 'infusion'
      ? stats?.total_infusions ?? 0
      : badge.category === 'team'
      ? stats?.team_infusions ?? 0
      : null;

  return (
    <div
      className={`rounded-xl p-3 transition-all ${earned ? '' : 'opacity-40 grayscale'}`}
      style={
        earned
          ? { background: s.bg, border: `1px solid ${s.ring}`, boxShadow: s.shadow }
          : { background: '#0e1a10', border: '1px dashed #2d4a30' }
      }
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden>{badge.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-sm font-bold leading-tight"
              style={{ color: earned ? s.text : '#4a7a50' }}
            >
              {badge.label}
            </span>
            <span
              className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold uppercase"
              style={
                earned
                  ? { background: s.ring + '30', color: s.ring }
                  : { background: '#1a3a1a', color: '#3a6a3a' }
              }
            >
              {TIER_LABEL[badge.tier]}
            </span>
          </div>
          <p className="text-[11px] text-forest-400/70 leading-tight mt-0.5 line-clamp-2">
            {badge.description}
          </p>
          {earned && achievement?.earned_at && (
            <p className="text-[10px] text-forest-400/50 mt-0.5">
              Freigeschaltet {new Date(achievement.earned_at).toLocaleDateString('de-DE')}
            </p>
          )}
        </div>
      </div>

      {!earned && badge.threshold !== undefined && progressCount !== null && (
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-forest-400/60">
            <span>{progressCount} von {badge.threshold}</span>
            <span>{Math.max(0, badge.threshold - progressCount)} fehlen</span>
          </div>
          <ProgressBar value={progressCount} max={badge.threshold} color={s.ring} />
        </div>
      )}
    </div>
  );
}

export default function BadgeShowcase({ memberId }: Props) {
  const badgesQ = useMyBadges(memberId);
  const statsQ = useMemberStats(memberId);
  const memberQ = useMember(memberId);

  const achievements = badgesQ.data ?? [];
  const stats = statsQ.data;
  const isAufgieserMember = !!memberQ.data?.is_aufgieser;

  function getAchievement(badgeId: string) {
    return achievements.find((a) => a.badge_id === badgeId);
  }

  // Bei Gast / Nicht-Aufgießer-Mitglied: nur die Gast-Kategorien zeigen
  if (!isAufgieserMember) {
    // Dedupe — manche Badges (streak_4w etc.) existieren in beiden Quellen
    const seen = new Set<string>();
    const guestRelevant = GAST_BADGES.filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
    return (
      <div className="space-y-4">
        <section>
          <p className="text-[11px] text-forest-400/80 mb-2">
            Hier siehst du deine verdienten Auszeichnungen. Eine vollständige Übersicht aller verfügbaren Badges findest du in deinem Bereich.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {guestRelevant.map((badge) => (
              <BadgeItem
                key={badge.id}
                badge={badge}
                achievement={getAchievement(badge.id)}
                stats={stats}
              />
            ))}
          </div>
        </section>
      </div>
    );
  }

  // Aufgießer: vollständiger Showcase mit allen drei Sektionen
  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-xs font-semibold text-forest-400 uppercase tracking-wider mb-2">
          Aufguss-Meilensteine
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {MILESTONE_BADGES.filter((b) => b.category === 'infusion').map((badge) => (
            <BadgeItem
              key={badge.id}
              badge={badge}
              achievement={getAchievement(badge.id)}
              stats={stats}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-forest-400 uppercase tracking-wider mb-2">
          Team-Badges
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {MILESTONE_BADGES.filter((b) => b.category === 'team').map((badge) => (
            <BadgeItem
              key={badge.id}
              badge={badge}
              achievement={getAchievement(badge.id)}
              stats={stats}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-forest-400 uppercase tracking-wider mb-2">
          Besondere Auszeichnungen
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {SPECIAL_BADGES.map((badge) => (
            <BadgeItem
              key={badge.id}
              badge={badge}
              achievement={getAchievement(badge.id)}
              stats={stats}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
