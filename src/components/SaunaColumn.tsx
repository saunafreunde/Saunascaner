import { motion, AnimatePresence } from 'framer-motion';
import type { Sauna, Infusion } from '@/types/database';
import { InfusionCard } from './InfusionCard';

const MAX_VISIBLE = 4;

export function SaunaColumn({
  sauna,
  infusions,
  meisterName,
  now,
}: {
  sauna: Sauna;
  infusions: Infusion[];
  meisterName: (id: string | null) => string;
  now: Date;
}) {
  const visible = infusions.slice(0, MAX_VISIBLE);

  return (
    <motion.section
      layout
      transition={{ layout: { duration: 0.6, ease: [0.25, 1, 0.5, 1] } }}
      className="flex h-full flex-col rounded-2xl bg-gradient-to-b from-forest-950/85 to-slate-950/85 p-6 shadow-2xl ring-1 ring-forest-800/50 backdrop-blur"
      style={{ boxShadow: `inset 0 1px 0 ${sauna.accent_color}33, 0 12px 30px rgba(0,0,0,0.45)` }}
    >
      <header className="mb-5 border-b border-forest-800/40 pb-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-100">
            {sauna.name}
          </h2>
          <span
            className="rounded-full px-3 py-1 text-xl font-bold tabular-nums text-forest-950"
            style={{ backgroundColor: sauna.accent_color }}
          >
            {sauna.temperature_label}
          </span>
        </div>
        <div
          className="mt-3 h-1 rounded-full"
          style={{ background: `linear-gradient(90deg, ${sauna.accent_color}, transparent)` }}
        />
      </header>

      <div className="flex-1 space-y-3 overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.length === 0 ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-forest-300/60"
            >
              Keine Aufgüsse geplant.
            </motion.p>
          ) : (
            visible.map((i) => (
              <InfusionCard
                key={i.id}
                infusion={i}
                sauna={sauna}
                meisterName={meisterName(i.saunameister_id)}
                now={now}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
