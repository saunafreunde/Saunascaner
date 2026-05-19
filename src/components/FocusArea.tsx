import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { addMinutes, isBefore } from 'date-fns';
import type { Infusion, Sauna } from '@/types/database';
import { InfusionCard } from '@/components/InfusionCard';

const HIDE_AFTER_END_MIN = 5;

interface FocusAreaProps {
  infusions: Infusion[];
  saunas: Sauna[];
  meisterName: (id: string | null) => string;
  coNames: (infusionId: string) => string[];
  now: Date;
}

function FeierabendScreen() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-1 min-h-0 items-center justify-center text-center select-none"
    >
      <div>
        <div className="text-7xl mb-5">🍺</div>
        <p className="text-3xl font-semibold text-forest-200">Feierabend!</p>
        <p className="text-forest-400 mt-2 text-lg">Bis morgen — genießt den Abend</p>
      </div>
    </motion.div>
  );
}

export function FocusArea({ infusions, saunas, meisterName, coNames, now }: FocusAreaProps) {
  const getSauna = (sauna_id: string) => saunas.find((s) => s.id === sauna_id);

  const focusInfusions = useMemo(() => {
    const cutoff = addMinutes(now, -HIDE_AFTER_END_MIN);
    const visible = infusions.filter((i) => isBefore(cutoff, new Date(i.end_time)));

    const running = visible.filter((i) => {
      const s = new Date(i.start_time);
      const e = new Date(i.end_time);
      return now >= s && now <= e;
    });

    const upcoming = visible
      .filter((i) => new Date(i.start_time) > now)
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));

    return [...running, ...upcoming].slice(0, 5);
  }, [infusions, now]);

  const nowH = now.getHours();
  const nowM = now.getMinutes();
  const isFeierabend = (nowH === 20 && nowM >= 30) || (nowH === 21 && nowM === 0);

  if (focusInfusions.length === 0) {
    if (isFeierabend) return <FeierabendScreen />;
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center select-none"
        >
          <div className="text-7xl mb-5">🧖</div>
          <p className="text-3xl font-semibold text-forest-200">Keine Aufgüsse geplant</p>
          <p className="text-forest-400 mt-2 text-lg">Genieße die Stille — der nächste Aufguss kommt bestimmt</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 min-w-0 flex-col gap-3">
      <AnimatePresence initial={false} mode="popLayout">
        {focusInfusions.map((inf) => {
          const sauna = getSauna(inf.sauna_id);
          if (!sauna) return null;
          return (
            <motion.div
              key={inf.id}
              layout
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.96 }}
              transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
              className="flex flex-1 min-h-0 flex-col rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(8,18,12,0.9)',
                borderTop: `4px solid ${sauna.accent_color}`,
                boxShadow: `0 0 40px ${sauna.accent_color}1a, inset 0 1px 0 ${sauna.accent_color}22`,
              }}
            >
              {/* Sauna header bar */}
              <div
                className="flex items-center gap-3 px-5 py-2.5 flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: sauna.accent_color, boxShadow: `0 0 10px ${sauna.accent_color}` }}
                />
                <span className="text-sm font-bold text-white/90 tracking-wide">{sauna.name}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-md font-medium"
                  style={{ background: `${sauna.accent_color}22`, color: sauna.accent_color }}
                >
                  {sauna.temperature_label}
                </span>
              </div>

              {/* InfusionCard fills remaining height */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 scrollbar-thin">
                <InfusionCard
                  infusion={inf}
                  sauna={sauna}
                  meisterName={meisterName(inf.saunameister_id)}
                  coNames={coNames(inf.id)}
                  now={now}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
