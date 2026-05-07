import { useMemo } from 'react';
import { addMinutes, isBefore } from 'date-fns';
import { useNow } from '@/hooks/useNow';
import { fmtClock, dayLabel } from '@/lib/time';
import { mockSaunas, mockInfusions } from '@/mocks/data';

export default function Guest() {
  const now = useNow(30_000);

  const visible = useMemo(() => {
    const cutoff = addMinutes(now, -5);
    return mockInfusions
      .filter((i) => isBefore(cutoff, new Date(i.end_time)))
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
  }, [now]);

  const saunaName = (id: string) => mockSaunas.find((s) => s.id === id)?.name ?? '';
  const saunaTemp = (id: string) => mockSaunas.find((s) => s.id === id)?.temperature_label ?? '';

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur px-5 py-4">
        <h1 className="text-xl font-semibold">Aufgussplan</h1>
        <p className="text-sm text-slate-400">Saunafreunde Schwarzwald</p>
      </header>

      <ul className="divide-y divide-slate-800/60">
        {visible.length === 0 && (
          <li className="px-5 py-8 text-center text-slate-500">Heute keine Aufgüsse mehr.</li>
        )}
        {visible.map((i) => {
          const day = dayLabel(i.start_time, now);
          return (
            <li key={i.id} className="flex gap-4 px-5 py-4">
              <div className="w-20 shrink-0">
                <div className="text-2xl font-semibold tabular-nums text-heat-400">
                  {fmtClock(i.start_time)}
                </div>
                <div className="text-xs uppercase tracking-wide text-slate-500">{day}</div>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-medium">{i.title}</h2>
                {i.description && (
                  <p className="text-sm text-slate-400">{i.description}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">
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
