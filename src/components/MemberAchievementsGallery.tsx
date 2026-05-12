import { useMemo, useState } from 'react';
import { useMyBadges } from '@/lib/api';
import {
  ALL_BADGES, CATEGORY_LABEL, TIER_STYLES, TIER_LABEL,
  type BadgeCategory, type BadgeDefinition,
} from '@/lib/badges';

interface Props {
  memberId: string;
  /** Welche Kategorien anzeigen — default: alle Gäste-relevanten */
  categories?: BadgeCategory[];
}

const DEFAULT_CATEGORIES: BadgeCategory[] = [
  'attendance', 'rating', 'discovery', 'community', 'season',
];

// Achievement-Galerie mit Kategorie-Tabs.
// Verdiente Badges hell, nicht-verdiente in 30% Opacity mit Lock-Icon.
export function MemberAchievementsGallery({ memberId, categories = DEFAULT_CATEGORIES }: Props) {
  const badgesQ = useMyBadges(memberId);
  const earnedIds = useMemo(() => new Set((badgesQ.data ?? []).map((b) => b.badge_id)), [badgesQ.data]);

  const [activeTab, setActiveTab] = useState<BadgeCategory>(categories[0]);

  const tabBadges = useMemo(() => {
    const list = ALL_BADGES.filter((b) => b.category === activeTab);
    // dedupe nach id (Streak-Badges waren früher in 'special' definiert)
    const seen = new Set<string>();
    return list.filter((b) => seen.has(b.id) ? false : (seen.add(b.id), true));
  }, [activeTab]);

  const totalCounts = useMemo(() => {
    const c = {} as Record<BadgeCategory, { earned: number; total: number }>;
    categories.forEach((cat) => {
      const list = ALL_BADGES.filter((b) => b.category === cat);
      const seen = new Set<string>();
      const dedup = list.filter((b) => seen.has(b.id) ? false : (seen.add(b.id), true));
      c[cat] = {
        earned: dedup.filter((b) => earnedIds.has(b.id)).length,
        total: dedup.length,
      };
    });
    return c;
  }, [categories, earnedIds]);

  const overall = useMemo(() => {
    const allRelevant = ALL_BADGES.filter((b) => categories.includes(b.category));
    const seen = new Set<string>();
    const dedup = allRelevant.filter((b) => seen.has(b.id) ? false : (seen.add(b.id), true));
    return { earned: dedup.filter((b) => earnedIds.has(b.id)).length, total: dedup.length };
  }, [categories, earnedIds]);

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5 backdrop-blur space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
          🏅 Deine Auszeichnungen
        </h2>
        <div className="text-[11px] text-forest-400 tabular-nums">
          {overall.earned} / {overall.total} verdient
        </div>
      </div>

      {/* Kategorie-Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => {
          const meta = CATEGORY_LABEL[c];
          const cnt = totalCounts[c];
          const active = activeTab === c;
          return (
            <button
              key={c}
              onClick={() => setActiveTab(c)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                active
                  ? 'bg-amber-500/20 text-amber-200 ring-amber-500/50'
                  : 'bg-forest-900/60 text-forest-300 ring-forest-800/50 hover:bg-forest-800/70'
              }`}
            >
              <span>{meta.emoji}</span>
              <span>{meta.label}</span>
              <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? 'bg-amber-500/30' : 'bg-forest-950/60'}`}>
                {cnt.earned}/{cnt.total}
              </span>
            </button>
          );
        })}
      </div>

      {/* Badge-Grid */}
      {tabBadges.length === 0 ? (
        <p className="text-center text-sm text-forest-400 py-6">
          Keine Auszeichnungen in dieser Kategorie.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {tabBadges.map((badge) => {
            const earned = earnedIds.has(badge.id);
            return <BadgeChipFull key={badge.id} badge={badge} earned={earned} />;
          })}
        </div>
      )}
    </section>
  );
}

function BadgeChipFull({ badge, earned }: { badge: BadgeDefinition; earned: boolean }) {
  const style = TIER_STYLES[badge.tier];
  return (
    <div
      className={`relative rounded-2xl p-3 transition ${earned ? '' : 'opacity-40 grayscale'}`}
      style={{
        background: earned ? style.bg : '#1a1f23',
        boxShadow: earned
          ? `${style.shadow}, inset 0 0 0 1px ${style.ring}`
          : 'inset 0 0 0 1px #3f3f46',
      }}
    >
      <div className="absolute top-1 right-1 text-[9px] uppercase tracking-wider font-bold" style={{ color: earned ? style.text : '#52525b' }}>
        {TIER_LABEL[badge.tier]}
      </div>
      <div className="text-center">
        <div className="text-3xl">{badge.emoji}</div>
        <div className="mt-1 text-xs font-semibold leading-tight" style={{ color: earned ? style.text : '#71717a' }}>
          {badge.label}
        </div>
        <div className="mt-1 text-[10px] text-forest-400/80 leading-snug">
          {badge.description}
        </div>
        {!earned && (
          <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-forest-500">
            <span>🔒</span><span>noch nicht verdient</span>
          </div>
        )}
      </div>
    </div>
  );
}
