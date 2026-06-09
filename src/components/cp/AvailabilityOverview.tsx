import { useMemo, useState } from 'react';
import { useStaffAvailability } from '@/lib/api';

// CP-Übersicht: wer ist wann verfügbar
// Zeigt 14 Tage voraus als Tabelle: Mitarbeiter × Tag → Zeitfenster

function isoDate(d: Date): string {
  // Lokaler Kalendertag (Europe/Berlin am Vereins-Gerät) — NICHT toISOString(),
  // das eine lokal um Mitternacht gebaute Date in UTC zum Vortag verschiebt.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const DAYS_AHEAD = 14;

export function AvailabilityOverview() {
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const weekEnd = useMemo(() => addDays(weekStart, DAYS_AHEAD - 1), [weekStart]);
  const days = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const list = useStaffAvailability(isoDate(weekStart), isoDate(weekEnd));

  // Gruppieren: member_id → { date → entry }
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; byDate: Map<string, { start: string; end: string; note: string | null }> }>();
    (list.data ?? []).forEach((a) => {
      let entry = map.get(a.member_id);
      if (!entry) {
        entry = { name: a.member_name, byDate: new Map() };
        map.set(a.member_id, entry);
      }
      entry.byDate.set(a.date, {
        start: a.start_time.slice(0, 5),
        end: a.end_time.slice(0, 5),
        note: a.note,
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [list.data]);

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
          📅 Verfügbarkeits-Übersicht
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(addDays(weekStart, -DAYS_AHEAD))}
            className="rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-2 py-1 text-xs text-forest-200 hover:ring-amber-500/40"
          >
            ←
          </button>
          <span className="text-xs font-mono text-forest-300">
            {weekStart.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}–{weekEnd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
          </span>
          <button
            onClick={() => setWeekStart(addDays(weekStart, DAYS_AHEAD))}
            className="rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-2 py-1 text-xs text-forest-200 hover:ring-amber-500/40"
          >
            →
          </button>
        </div>
      </div>

      <p className="text-[11px] text-forest-400 mb-3">
        Wann haben deine Mitarbeiter Zeit? Nicht bindend, aber als Planungs-Hilfe. Leere Zellen = keine Angabe.
      </p>

      {grouped.length === 0 ? (
        <div className="text-center text-sm text-forest-400 py-4">
          Niemand hat für diesen Zeitraum Verfügbarkeit eingetragen.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="text-[10px] font-mono">
            <thead>
              <tr>
                <th className="px-1 text-left text-forest-500 font-semibold">Mitarbeiter</th>
                {days.map((d) => (
                  <th key={isoDate(d)} className="px-1 text-center text-forest-500 font-normal min-w-[50px]">
                    <div className="text-[9px] uppercase">{d.toLocaleDateString('de-DE', { weekday: 'short' })}</div>
                    <div>{d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <tr key={g.name}>
                  <td className="px-1 py-1 text-forest-100 font-semibold whitespace-nowrap">{g.name}</td>
                  {days.map((d) => {
                    const entry = g.byDate.get(isoDate(d));
                    return (
                      <td key={isoDate(d)} className="px-0.5 py-0.5 text-center">
                        {entry ? (
                          <div
                            className="rounded bg-emerald-500/20 ring-1 ring-emerald-500/40 text-emerald-100 px-1 py-0.5"
                            title={entry.note ?? ''}
                          >
                            {entry.start}–{entry.end}
                          </div>
                        ) : (
                          <div className="text-forest-700">·</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
