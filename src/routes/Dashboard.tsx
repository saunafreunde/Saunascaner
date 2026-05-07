import { useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { addMinutes, isBefore } from 'date-fns';
import { useNow } from '@/hooks/useNow';
import { useWakeLock } from '@/hooks/useWakeLock';
import { SaunaColumn } from '@/components/SaunaColumn';
import { AdGrid } from '@/components/AdGrid';
import { WeatherWidget } from '@/components/WeatherWidget';
import { ConnectionIndicator } from '@/components/ConnectionIndicator';
import { fmtClock } from '@/lib/time';
import { mockSaunas, mockInfusions } from '@/mocks/data';
import { isSupabaseConfigured } from '@/lib/supabase';

const HIDE_AFTER_END_MIN = 5;

export default function Dashboard() {
  useWakeLock(true);
  const now = useNow(15_000);

  const activeSaunas = useMemo(
    () => mockSaunas.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order),
    []
  );

  const infusionsBySauna = useMemo(() => {
    const cutoff = addMinutes(now, -HIDE_AFTER_END_MIN);
    const visible = mockInfusions
      .filter((i) => isBefore(cutoff, new Date(i.end_time)))
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
    const map = new Map<string, typeof visible>();
    for (const i of visible) {
      const arr = map.get(i.sauna_id) ?? [];
      arr.push(i);
      map.set(i.sauna_id, arr);
    }
    return map;
  }, [now]);

  // Declarative layout: middle ad grid stays only when 0–2 saunas are active.
  // 3 active → ads make room for the third column.
  const showAds = activeSaunas.length <= 2;
  const columnSpec =
    activeSaunas.length === 1 ? '1fr 2fr'
    : activeSaunas.length === 2 ? '1fr 1.4fr 1fr'
    : '1fr 1.4fr 1fr 1fr';

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 text-slate-100">
      <header className="flex items-center justify-between px-8 pt-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Saunafreunde Schwarzwald</h1>
          <ConnectionIndicator online={isSupabaseConfigured} />
        </div>
        <div className="flex items-center gap-4">
          <WeatherWidget />
          <span className="rounded-xl bg-slate-900/60 px-4 py-2 text-2xl font-semibold tabular-nums ring-1 ring-slate-800/60">
            {fmtClock(now)}
          </span>
        </div>
      </header>

      <LayoutGroup>
        <motion.main
          layout
          transition={{ layout: { duration: 0.6, ease: [0.25, 1, 0.5, 1] } }}
          className="grid h-[calc(100vh-6rem)] gap-5 px-8 py-6"
          style={{ gridTemplateColumns: columnSpec }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {activeSaunas.length === 0 && (
              <motion.div
                key="closed"
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="col-span-full flex items-center justify-center text-3xl text-slate-500"
              >
                Heute keine Saunen aktiv.
              </motion.div>
            )}

            {activeSaunas.length >= 1 && activeSaunas[0] && (
              <SaunaColumn
                key={activeSaunas[0].id}
                sauna={activeSaunas[0]}
                infusions={infusionsBySauna.get(activeSaunas[0].id) ?? []}
                now={now}
              />
            )}

            {showAds && activeSaunas.length > 0 && (
              <motion.div
                key="ads"
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.5 }}
              >
                <AdGrid images={[]} />
              </motion.div>
            )}

            {activeSaunas.slice(1).map((s) => (
              <SaunaColumn
                key={s.id}
                sauna={s}
                infusions={infusionsBySauna.get(s.id) ?? []}
                now={now}
              />
            ))}
          </AnimatePresence>
        </motion.main>
      </LayoutGroup>
    </div>
  );
}
