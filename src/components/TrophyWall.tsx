import { motion } from 'framer-motion';
import { useMyBadges } from '@/lib/api';
import { ALL_BADGES, TIER_STYLES, type BadgeDefinition } from '@/lib/badges';

interface TrophyWallProps {
  memberId: string;
}

export function TrophyWall({ memberId }: TrophyWallProps) {
  const { data: earned } = useMyBadges(memberId);
  const earnedIds = new Set((earned ?? []).map((a) => a.badge_id));

  const unlocked = ALL_BADGES.filter((b) => earnedIds.has(b.id));
  const locked = ALL_BADGES.filter((b) => !earnedIds.has(b.id));

  return (
    <div className="space-y-4">
      {/* Reihe 1: Freigeschaltete Badges (groß) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-violet-300/80 uppercase tracking-[0.12em]">
            Freigeschaltet
          </h3>
          <span className="text-[10px] text-forest-400 tabular-nums">
            {unlocked.length} / {ALL_BADGES.length}
          </span>
        </div>
        {unlocked.length === 0 ? (
          <div className="flex flex-col items-center py-4 text-center rounded-xl bg-forest-900/30 ring-1 ring-dashed ring-forest-700/40">
            <div className="text-3xl mb-1">🌱</div>
            <p className="text-xs text-forest-400">Noch keine Erfolge — bald geht's los!</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unlocked.map((badge, idx) => (
              <UnlockedTrophy key={badge.id} badge={badge} delay={idx * 0.03} />
            ))}
          </div>
        )}
      </div>

      {/* Reihe 2: Gesperrte Badges (klein) */}
      {locked.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold text-forest-500 uppercase tracking-[0.12em] mb-2">
            Noch zu erreichen
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {locked.map((badge, idx) => (
              <LockedTrophy key={badge.id} badge={badge} delay={idx * 0.02} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UnlockedTrophy({ badge, delay }: { badge: BadgeDefinition; delay: number }) {
  const tier = TIER_STYLES[badge.tier];
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 220, delay }}
      whileHover={{ y: -2 }}
      className="group relative"
    >
      <div
        className="flex h-20 w-20 sm:h-24 sm:w-24 flex-col items-center justify-center rounded-2xl ring-1 cursor-default transition-shadow"
        style={{
          background: tier.bg,
          boxShadow: tier.shadow,
          borderColor: tier.ring,
          borderWidth: 1,
        }}
      >
        <motion.span
          whileHover={{ rotate: 360 }}
          transition={{ duration: 0.6 }}
          className="text-3xl sm:text-4xl"
        >
          {badge.emoji}
        </motion.span>
        <span
          className="text-[9px] sm:text-[10px] font-semibold text-center mt-0.5 px-1 truncate w-full"
          style={{ color: tier.text }}
        >
          {badge.label}
        </span>
      </div>
      {/* Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30">
        <div className="rounded-lg bg-forest-950 px-3 py-2 text-xs text-forest-100 ring-1 ring-forest-700 max-w-[200px] shadow-xl">
          <div className="font-bold mb-0.5" style={{ color: tier.text }}>{badge.label}</div>
          <div className="text-forest-300 leading-snug">{badge.description}</div>
        </div>
      </div>
    </motion.div>
  );
}

function LockedTrophy({ badge, delay }: { badge: BadgeDefinition; delay: number }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 0.55 }}
      transition={{ delay }}
      whileHover={{ scale: 1.15, opacity: 1 }}
      className="group relative"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-900/60 ring-1 ring-forest-700/40 grayscale text-xl">
        {badge.emoji}
      </div>
      <span className="absolute -bottom-0.5 -right-0.5 text-[8px]">🔒</span>
      {/* Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30">
        <div className="rounded-lg bg-forest-950 px-3 py-2 text-xs text-forest-100 ring-1 ring-forest-700 max-w-[180px] shadow-xl">
          <div className="font-bold mb-0.5 text-forest-200">🔒 {badge.label}</div>
          <div className="text-forest-400 leading-snug">{badge.description}</div>
        </div>
      </div>
    </motion.div>
  );
}
