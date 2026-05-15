import { useMemo, useState } from 'react';
import { useRatingsAnonymous } from '@/lib/api';

// Anonymisierte Bewertungs-Übersicht für CP-Verantwortliche.
// Aggregiert über Sauna × Wochentag × Stunde — KEINE Aufgießer-Bezüge.
// Zeigt eine Heat-Map (Wochentag-Zeilen × Stunden-Spalten) mit ⭐-Schnitt.

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const HOURS = Array.from({ length: 15 }, (_, i) => 8 + i); // 08:00 - 22:00

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function ratingColor(avg: number | null | undefined): string {
  if (avg == null) return 'bg-forest-900/40';
  if (avg >= 4.5) return 'bg-emerald-500/60';
  if (avg >= 4.0) return 'bg-emerald-500/40';
  if (avg >= 3.5) return 'bg-amber-500/40';
  if (avg >= 3.0) return 'bg-amber-500/30';
  if (avg >= 2.0) return 'bg-rose-500/30';
  return 'bg-rose-500/50';
}

export function RatingsAnonymousOverview() {
  const today = new Date();
  const ago = new Date(today);
  ago.setDate(today.getDate() - 90);

  const [from, setFrom] = useState<string>(isoDate(ago));
  const [to, setTo] = useState<string>(isoDate(today));

  const ratings = useRatingsAnonymous(from, to);

  // Aggregate über Saunen weg → pro Wochentag×Stunde der gesamtdurchschnitt
  const heatmap = useMemo(() => {
    const map = new Map<string, { sum: number; count: number; n: number }>();
    (ratings.data ?? []).forEach((r) => {
      const key = `${r.weekday}-${r.hour_of_day}`;
      const prev = map.get(key) ?? { sum: 0, count: 0, n: 0 };
      // sum und count gewichten mit rating_count
      if (r.avg_overall != null) {
        prev.sum += r.avg_overall * r.rating_count;
        prev.count += r.rating_count;
        prev.n += 1;
      }
      map.set(key, prev);
    });
    return map;
  }, [ratings.data]);

  const getCell = (weekday: number, hour: number) => {
    const entry = heatmap.get(`${weekday}-${hour}`);
    if (!entry || entry.count === 0) return { avg: null, count: 0 };
    return { avg: entry.sum / entry.count, count: entry.count };
  };

  const totalRatings = (ratings.data ?? []).reduce((a, r) => a + r.rating_count, 0);

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
          ⭐ Bewertungs-Übersicht (anonym)
        </h2>
        <span className="text-[10px] text-forest-400">{totalRatings} Bewertungen im Zeitraum</span>
      </div>

      <p className="text-xs text-forest-300/80 mb-4 leading-relaxed">
        Aggregat-Auswertung über Wochentag × Stunde. <strong>Ohne Aufgießer-Bezug</strong> — die View
        gibt nur Durchschnittswerte pro Slot-Zeit zurück, nicht wer den Aufguss gemacht hat.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <label className="text-xs text-forest-300">
          Von
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-2 py-1.5 text-sm text-forest-100"
          />
        </label>
        <label className="text-xs text-forest-300">
          Bis
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-2 py-1.5 text-sm text-forest-100"
          />
        </label>
      </div>

      {ratings.isLoading ? (
        <div className="text-center text-sm text-forest-400 py-4">Lade…</div>
      ) : totalRatings === 0 ? (
        <div className="text-center text-sm text-forest-400 py-4">Keine Bewertungen im Zeitraum.</div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="text-[10px] font-mono">
            <thead>
              <tr>
                <th className="px-1 text-forest-500"></th>
                {HOURS.map((h) => (
                  <th key={h} className="px-1 text-forest-500 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
                <tr key={wd}>
                  <td className="px-1 py-0.5 text-forest-400 font-semibold">{WEEKDAYS[wd]}</td>
                  {HOURS.map((h) => {
                    const cell = getCell(wd, h);
                    return (
                      <td key={h} className="p-0.5">
                        <div
                          className={`w-7 h-7 rounded ${ratingColor(cell.avg)} flex items-center justify-center text-[9px] font-semibold text-white/90`}
                          title={cell.avg != null ? `${cell.avg.toFixed(2)} ⭐ (${cell.count} Bewertungen)` : 'keine Daten'}
                        >
                          {cell.avg != null ? cell.avg.toFixed(1) : ''}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-forest-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/60" />4.5+</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/40" />4.0+</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/40" />3.5+</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/30" />3.0+</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500/30" />2.0+</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500/50" />&lt; 2.0</span>
      </div>
    </section>
  );
}
