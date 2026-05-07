import { motion } from 'framer-motion';
import type { Infusion } from '@/types/database';
import { fmtClock, dayLabel } from '@/lib/time';

export function InfusionCard({ infusion, now }: { infusion: Infusion; now: Date }) {
  const label = dayLabel(infusion.start_time, now);
  const suffix = label === 'heute' ? 'Uhr' : label === 'morgen' ? 'morgen' : label;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-5 backdrop-blur"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-5xl font-semibold tracking-tight text-heat-400 tabular-nums">
          {fmtClock(infusion.start_time)}
        </span>
        <span className="text-base text-slate-400">{suffix}</span>
      </div>
      <h3 className="mt-2 text-2xl font-medium text-slate-100">{infusion.title}</h3>
      {infusion.description && (
        <p className="mt-1 text-base text-slate-400">{infusion.description}</p>
      )}
    </motion.div>
  );
}
