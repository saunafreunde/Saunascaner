import { motion } from 'framer-motion';
import type { Infusion, Sauna } from '@/types/database';
import { fmtClock } from '@/lib/time';

interface TodayTimelineProps {
  infusions: Infusion[];
  saunas: Sauna[];
  meisterName: (id: string | null) => string;
  now: Date;
}

const HOUR_START = 11;
const HOUR_END = 22;
const TOTAL_MIN = (HOUR_END - HOUR_START) * 60;

function minutesFromStart(d: Date): number {
  return (d.getHours() - HOUR_START) * 60 + d.getMinutes();
}

function pct(min: number): number {
  return Math.max(0, Math.min(100, (min / TOTAL_MIN) * 100));
}

export function TodayTimeline({ infusions, saunas, meisterName, now }: TodayTimelineProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayInfusions = infusions.filter(
    (i) => new Date(i.start_time) >= today && new Date(i.start_time) < new Date(today.getTime() + 86400000)
  );

  const saunaColor = (id: string) => saunas.find((s) => s.id === id)?.accent_color ?? '#22c55e';
  const saunaName = (id: string) => saunas.find((s) => s.id === id)?.name ?? '?';

  const nowPct = pct(minutesFromStart(now));
  const isWithinDay = now.getHours() >= HOUR_START && now.getHours() < HOUR_END;

  if (todayInfusions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="text-4xl mb-2">🌞</div>
        <p className="text-sm text-forest-300/80">Heute keine Aufgüsse geplant.</p>
        <p className="text-xs text-forest-400 mt-1">Ein Tag der Ruhe — genieße ihn!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Time scale */}
      <div className="relative h-12 rounded-xl bg-forest-900/40 ring-1 ring-forest-800/30 overflow-hidden">
        {/* Hour ticks */}
        {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => {
          const hour = HOUR_START + i;
          const left = (i / (HOUR_END - HOUR_START)) * 100;
          return (
            <div
              key={hour}
              className="absolute top-0 bottom-0 border-l border-forest-700/30"
              style={{ left: `${left}%` }}
            >
              {hour % 2 === 0 && (
                <span className="absolute -top-0.5 left-1 text-[9px] text-forest-500 tabular-nums">
                  {hour}
                </span>
              )}
            </div>
          );
        })}

        {/* Now marker */}
        {isWithinDay && (
          <motion.div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-20"
            style={{ left: `${nowPct}%` }}
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
          </motion.div>
        )}

        {/* Infusion dots */}
        {todayInfusions.map((i) => {
          const startMin = minutesFromStart(new Date(i.start_time));
          const left = pct(startMin);
          const color = saunaColor(i.sauna_id);
          return (
            <motion.div
              key={i.id}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="group absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
              style={{ left: `${left}%` }}
            >
              <div
                className="h-3 w-3 rounded-full ring-2 ring-forest-950 cursor-pointer transition-transform group-hover:scale-150"
                style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
              />
              {/* Tooltip on hover */}
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30">
                <div className="rounded-lg bg-forest-950 px-2 py-1 text-[10px] text-forest-100 ring-1 ring-forest-700 whitespace-nowrap shadow-lg">
                  <div className="font-semibold">{i.title}</div>
                  <div className="text-forest-400">{fmtClock(i.start_time)} · {saunaName(i.sauna_id)}</div>
                  <div className="text-forest-400">{meisterName(i.saunameister_id)}</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Compact list of next infusions */}
      <ul className="space-y-1.5">
        {todayInfusions
          .filter((i) => new Date(i.end_time) >= now)
          .slice(0, 3)
          .map((i, idx) => (
            <motion.li
              key={i.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center gap-2 text-xs text-forest-300"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: saunaColor(i.sauna_id) }}
              />
              <span className="font-semibold tabular-nums text-forest-100">{fmtClock(i.start_time)}</span>
              <span className="truncate">{i.title}</span>
              <span className="text-forest-500 shrink-0">· {meisterName(i.saunameister_id)}</span>
            </motion.li>
          ))}
      </ul>
    </div>
  );
}
