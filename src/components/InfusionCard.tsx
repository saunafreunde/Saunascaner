import { motion } from 'framer-motion';
import { differenceInMinutes } from 'date-fns';
import type { Infusion, Sauna } from '@/types/database';
import { fmtClock, dayLabel } from '@/lib/time';
import { ATTR_BY_ID } from '@/lib/attributes';

const IMMINENT_MIN = 10;

export function InfusionCard({
  infusion,
  sauna,
  meisterName,
  now,
  compact = false,
}: {
  infusion: Infusion;
  sauna: Sauna;
  meisterName?: string;
  now: Date;
  compact?: boolean;
}) {
  const start = new Date(infusion.start_time);
  const minsToStart = differenceInMinutes(start, now);
  const imminent = minsToStart >= 0 && minsToStart <= IMMINENT_MIN;
  const running = now >= start && now < new Date(infusion.end_time);

  const label = dayLabel(infusion.start_time, now);
  const suffix = label === 'heute' ? 'Uhr' : label === 'morgen' ? 'morgen' : label;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      animate={{
        opacity: 1, y: 0, scale: 1,
        boxShadow: imminent
          ? [`0 0 0 0 ${sauna.accent_color}55`, `0 0 0 14px ${sauna.accent_color}00`, `0 0 0 0 ${sauna.accent_color}55`]
          : '0 0 0 0 rgba(0,0,0,0)',
      }}
      exit={{ opacity: 0, y: -30, scale: 0.96 }}
      transition={{
        layout: { duration: 0.55, ease: [0.25, 1, 0.5, 1] },
        opacity: { duration: 0.35 },
        boxShadow: imminent ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 },
      }}
      className={`relative overflow-hidden rounded-2xl border bg-forest-950/55 p-5 backdrop-blur ${
        running
          ? 'border-emerald-400/50 ring-1 ring-emerald-400/30'
          : imminent
            ? 'border-transparent'
            : 'border-forest-800/40'
      }`}
      style={imminent ? { borderColor: sauna.accent_color } : undefined}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: sauna.accent_color }}
      />

      <div className="flex items-baseline justify-between gap-3 pl-2">
        <div className="flex items-baseline gap-3">
          <span
            className={`font-semibold tracking-tight tabular-nums ${compact ? 'text-3xl' : 'text-5xl'}`}
            style={{ color: sauna.accent_color }}
          >
            {fmtClock(infusion.start_time)}
          </span>
          <span className="text-sm text-forest-300/70">{suffix}</span>
        </div>
        {imminent && (
          <span
            className="rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-forest-950"
            style={{ backgroundColor: sauna.accent_color }}
          >
            in {minsToStart} Min
          </span>
        )}
        {running && !imminent && (
          <span className="rounded-full bg-emerald-400 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-forest-950 animate-pulse">
            Läuft
          </span>
        )}
      </div>

      <h3 className={`mt-2 pl-2 font-medium text-slate-100 ${compact ? 'text-lg' : 'text-2xl'}`}>
        {infusion.title}
      </h3>

      {infusion.description && !compact && (
        <p className="pl-2 mt-1 text-base text-slate-300/80">{infusion.description}</p>
      )}

      {infusion.attributes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 pl-2">
          {infusion.attributes.map((a) => {
            const meta = ATTR_BY_ID[a];
            if (!meta) return null;
            return (
              <span
                key={a}
                title={meta.label}
                className="inline-flex items-center gap-1 rounded-full bg-forest-900/70 px-2 py-0.5 text-xs ring-1 ring-forest-800/60"
              >
                <span aria-hidden>{meta.emoji}</span>
                <span className="text-forest-100/85">{meta.label}</span>
              </span>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between pl-2 text-xs text-forest-300/70">
        <span>{meisterName ? `Aufguss: ${meisterName}` : '—'}</span>
        <span>{infusion.duration_minutes} Min</span>
      </div>
    </motion.div>
  );
}
