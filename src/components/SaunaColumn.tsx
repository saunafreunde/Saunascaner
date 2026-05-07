import { motion, AnimatePresence } from 'framer-motion';
import type { Sauna, Infusion } from '@/types/database';
import { InfusionCard } from './InfusionCard';

export function SaunaColumn({
  sauna,
  infusions,
  now,
}: {
  sauna: Sauna;
  infusions: Infusion[];
  now: Date;
}) {
  return (
    <motion.section
      layout
      transition={{ layout: { duration: 0.6, ease: [0.25, 1, 0.5, 1] } }}
      className="flex h-full flex-col rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-6 shadow-2xl ring-1 ring-slate-800/60"
    >
      <header className="mb-6 flex items-baseline justify-between">
        <h2 className="text-3xl font-semibold tracking-tight">{sauna.name}</h2>
        <span className="rounded-full bg-heat-600/20 px-3 py-1 text-xl font-semibold text-heat-400 tabular-nums">
          {sauna.temperature_label}
        </span>
      </header>
      <div className="flex-1 space-y-3 overflow-hidden">
        <AnimatePresence initial={false}>
          {infusions.length === 0 ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-slate-500"
            >
              Keine Aufgüsse geplant.
            </motion.p>
          ) : (
            infusions.map((i) => <InfusionCard key={i.id} infusion={i} now={now} />)
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
