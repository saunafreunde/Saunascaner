import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { addMinutes, isBefore } from 'date-fns';
import type { Infusion, Sauna } from '@/types/database';
import { InfusionCard } from '@/components/InfusionCard';
import type { BadgeDefinition } from '@/lib/badges';

const HIDE_AFTER_END_MIN = 5;
const TILES_PER_COLUMN = 5;

interface SaunaTileColumnProps {
  sauna: Sauna;
  infusions: Infusion[];
  meisterName: (id: string | null) => string;
  meisterBadges: (id: string | null) => BadgeDefinition[];
  coNames: (infusionId: string) => string[];
  now: Date;
  tileBgs?: (string | null)[];
}

export function SaunaTileColumn({
  sauna,
  infusions,
  meisterName,
  meisterBadges,
  coNames,
  now,
  tileBgs = [],
}: SaunaTileColumnProps) {
  const tiles = useMemo(() => {
    const cutoff = addMinutes(now, -HIDE_AFTER_END_MIN);
    const visible = infusions
      .filter((i) => i.sauna_id === sauna.id && isBefore(cutoff, new Date(i.end_time)));

    const running = visible.filter((i) => {
      const s = new Date(i.start_time);
      const e = new Date(i.end_time);
      return now >= s && now <= e;
    });
    const upcoming = visible
      .filter((i) => new Date(i.start_time) > now)
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));

    return [...running, ...upcoming].slice(0, TILES_PER_COLUMN);
  }, [infusions, now, sauna.id]);

  return (
    <div
      className="flex flex-1 min-w-0 min-h-0 flex-col rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(8,18,12,0.65)',
        borderTop: `4px solid ${sauna.accent_color}`,
        boxShadow: `0 0 36px ${sauna.accent_color}1a, inset 0 1px 0 ${sauna.accent_color}22`,
      }}
    >
      {/* Sauna header */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: sauna.accent_color, boxShadow: `0 0 10px ${sauna.accent_color}` }}
        />
        <span className="text-base font-bold text-white/90 tracking-wide truncate">
          {sauna.name}
        </span>
        <span
          className="ml-auto text-xs px-2 py-0.5 rounded-md font-medium flex-shrink-0"
          style={{ background: `${sauna.accent_color}22`, color: sauna.accent_color }}
        >
          {sauna.temperature_label}
        </span>
      </div>

      {/* 5 tile slots */}
      <div className="flex-1 min-h-0 p-2 flex flex-col gap-2">
        {tiles.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-1 items-center justify-center text-center text-forest-400/50 text-sm select-none"
          >
            Heute keine Aufgüsse
          </motion.div>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {tiles.map((inf, slotIndex) => (
              <InfusionCard
                key={inf.id}
                infusion={inf}
                sauna={sauna}
                meisterName={meisterName(inf.saunameister_id)}
                meisterBadges={meisterBadges(inf.saunameister_id)}
                coNames={coNames(inf.id)}
                now={now}
                compact
                className="flex-1 min-h-0 overflow-hidden"
                backgroundImage={tileBgs[slotIndex] ?? null}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
