import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { addMinutes, isBefore } from 'date-fns';
import { useNow } from '@/hooks/useNow';
import { useWakeLock } from '@/hooks/useWakeLock';
import { SaunaColumn } from '@/components/SaunaColumn';
import { AdGrid } from '@/components/AdGrid';
import { WeatherWidget } from '@/components/WeatherWidget';
import { ConnectionIndicator } from '@/components/ConnectionIndicator';
import { EvacuationOverlay } from '@/components/EvacuationOverlay';
import { fmtClock } from '@/lib/time';
import { useMockStore } from '@/mocks/store';
import { isSupabaseConfigured } from '@/lib/supabase';
import { subscribeEvac, unlockAudio } from '@/lib/evacuation';

const HIDE_AFTER_END_MIN = 5;

export default function Dashboard() {
  useWakeLock(true);
  const now = useNow(20_000); // 20s tick keeps imminent state fresh
  const saunas = useMockStore((s) => s.saunas);
  const infusions = useMockStore((s) => s.infusions);
  const meisters = useMockStore((s) => s.meisters);
  const evacuation = useMockStore((s) => s.evacuation);
  const setEvacuation = useMockStore((s) => s.setEvacuation);
  const [audioReady, setAudioReady] = useState(false);

  // Sync evacuation state across tabs
  useEffect(() => {
    return subscribeEvac((msg) => {
      if (msg.type === 'start') {
        setEvacuation({ active: true, triggeredBy: msg.triggeredBy, triggeredAt: msg.triggeredAt });
      } else {
        setEvacuation({ active: false, triggeredBy: null, triggeredAt: null });
      }
    });
  }, [setEvacuation]);

  const meisterName = (id: string | null) =>
    (id && meisters.find((m) => m.id === id)?.name) || 'Saunameister:in';

  const activeSaunas = useMemo(
    () => saunas.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [saunas]
  );

  const infusionsBySauna = useMemo(() => {
    const cutoff = addMinutes(now, -HIDE_AFTER_END_MIN);
    const visible = infusions
      .filter((i) => isBefore(cutoff, new Date(i.end_time)))
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
    const map = new Map<string, typeof visible>();
    for (const i of visible) {
      const arr = map.get(i.sauna_id) ?? [];
      arr.push(i);
      map.set(i.sauna_id, arr);
    }
    return map;
  }, [now, infusions]);

  const showAds = activeSaunas.length <= 2;
  const columnSpec =
    activeSaunas.length === 1 ? '1fr 2fr'
    : activeSaunas.length === 2 ? '1fr 1.4fr 1fr'
    : '1fr 1.4fr 1fr 1fr';

  return (
    <div className="bg-schwarzwald min-h-full text-slate-100">
      <AnimatePresence>
        {evacuation.active && (
          <EvacuationOverlay triggeredBy={evacuation.triggeredBy} withSiren={audioReady} />
        )}
      </AnimatePresence>

      {!audioReady && !evacuation.active && (
        <button
          onClick={() => { if (unlockAudio()) setAudioReady(true); }}
          className="fixed bottom-4 right-4 z-50 rounded-full bg-forest-900/80 px-4 py-2 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900"
          title="Einmal klicken um Sirene-Sound zu aktivieren (Browser-Schutz)"
        >
          🔊 Ton aktivieren
        </button>
      )}

      <header className="flex items-center justify-between px-8 pt-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-forest-100 drop-shadow">
            Saunafreunde Schwarzwald
          </h1>
          <ConnectionIndicator online={isSupabaseConfigured} />
        </div>
        <div className="flex items-center gap-4">
          <WeatherWidget />
          <span className="rounded-xl bg-forest-950/70 px-4 py-2 text-2xl font-semibold tabular-nums ring-1 ring-forest-800/60">
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
                className="col-span-full flex items-center justify-center text-3xl text-forest-300/70"
              >
                Heute keine Saunen aktiv.
              </motion.div>
            )}

            {activeSaunas.length >= 1 && activeSaunas[0] && (
              <SaunaColumn
                key={activeSaunas[0].id}
                sauna={activeSaunas[0]}
                infusions={infusionsBySauna.get(activeSaunas[0].id) ?? []}
                meisterName={meisterName}
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
                meisterName={meisterName}
                now={now}
              />
            ))}
          </AnimatePresence>
        </motion.main>
      </LayoutGroup>
    </div>
  );
}
