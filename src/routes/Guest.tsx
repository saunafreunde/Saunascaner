import { useMemo } from 'react';
import { addMinutes, isBefore } from 'date-fns';
import { useNow } from '@/hooks/useNow';
import { fmtClock, dayLabel } from '@/lib/time';
import { useMockStore } from '@/mocks/store';

export default function Guest() {
  const now = useNow(30_000);
  const saunas = useMockStore((s) => s.saunas);
  const infusions = useMockStore((s) => s.infusions);

  const visible = useMemo(() => {
    const cutoff = addMinutes(now, -5);
    return infusions
      .filter((i) => isBefore(cutoff, new Date(i.end_time)))
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
  }, [now, infusions]);

  const saunaName = (id: string) => saunas.find((s) => s.id === id)?.name ?? '';
  const saunaTemp = (id: string) => saunas.find((s) => s.id === id)?.temperature_label ?? '';

  return (
    <div className="bg-schwarzwald-soft min-h-full text-slate-100">
      <header className="sticky top-0 z-10 border-b border-forest-800/40 bg-forest-950/85 backdrop-blur px-5 py-4">
        <h1 className="text-xl font-semibold text-forest-100">Aufgussplan</h1>
        <p className="text-sm text-forest-300/80">Saunafreunde Schwarzwald</p>
      </header>

      <ul className="divide-y divide-forest-800/40">
        {visible.length === 0 && (
          <li className="px-5 py-8 text-center text-forest-300/60">Heute keine Aufgüsse mehr.</li>
        )}
        {visible.map((i) => {
          const day = dayLabel(i.start_time, now);
          return (
            <li key={i.id} className="flex gap-4 px-5 py-4 bg-forest-950/40 backdrop-blur">
              <div className="w-20 shrink-0">
                <div className="text-2xl font-semibold tabular-nums text-forest-300">
                  {fmtClock(i.start_time)}
                </div>
                <div className="text-xs uppercase tracking-wide text-forest-500">{day}</div>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-medium text-slate-100">{i.title}</h2>
                {i.description && (
                  <p className="text-sm text-slate-300/80">{i.description}</p>
                )}
                <p className="mt-1 text-xs text-forest-300/70">
                  {saunaName(i.sauna_id)} · {saunaTemp(i.sauna_id)} · {i.duration_minutes} Min
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
