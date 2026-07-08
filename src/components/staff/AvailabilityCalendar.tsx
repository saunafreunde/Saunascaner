import { useEffect, useMemo, useState } from 'react';
import {
  useMyAvailability,
  useSetMyAvailabilityHours,
  useListPersonalShifts,
  useCurrentMember,
  useHolidaySet,
  isHolidayDate,
} from '@/lib/api';
import { operatingHours, shiftHours, formatHoursRanges } from '@/lib/staffHours';

// Mitarbeiter-Verfügbarkeit (Dienstplan-Umbau, Migration 0117).
// Monatsansicht, Tage untereinander. Pro Tag klickbare Stunden-Slots:
//   grün = ich bin verfügbar (Klick toggelt)   ·   blau = vom CP bestätigt (= Dienst, read-only)
// Betriebszeiten je Wochentag/Feiertag aus src/lib/staffHours.ts.

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const MAX_MONTHS_AHEAD = 11;

export function AvailabilityCalendar() {
  const me = useCurrentMember();
  const holidaySet = useHolidaySet();
  const setHours = useSetMyAvailabilityHours();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [monthOffset, setMonthOffset] = useState(0);

  const monthStart = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + monthOffset, 1),
    [today, monthOffset]
  );
  const monthEnd = useMemo(
    () => new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0),
    [monthStart]
  );

  const avail = useMyAvailability(isoDate(monthStart), isoDate(monthEnd));
  const shifts = useListPersonalShifts(isoDate(monthStart), isoDate(monthEnd));

  // Lokale, sofort reagierende Kopie der grünen Stunden je Tag (optimistisch).
  const [local, setLocal] = useState<Record<string, number[]>>({});
  useEffect(() => {
    const m: Record<string, number[]> = {};
    (avail.data ?? []).forEach((a) => {
      m[a.date] = a.hours;
    });
    setLocal(m);
  }, [avail.data]);

  // Bestätigte (blaue) Stunden je Tag aus den eigenen Schichten.
  const confirmedByDate = useMemo(() => {
    const m = new Map<string, Set<number>>();
    (shifts.data ?? [])
      .filter((s) => !me.data || s.staff_member_id === me.data.id)
      .forEach((s) => {
        const set = m.get(s.shift_date) ?? new Set<number>();
        shiftHours(s.start_time, s.end_time).forEach((h) => set.add(h));
        m.set(s.shift_date, set);
      });
    return m;
  }, [shifts.data, me.data]);

  const days = useMemo(() => {
    const n = monthEnd.getDate();
    return Array.from({ length: n }, (_, i) =>
      new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1)
    );
  }, [monthStart, monthEnd]);

  const toggle = (iso: string, h: number, locked: boolean) => {
    if (locked) return;
    const cur = local[iso] ?? [];
    const next = cur.includes(h)
      ? cur.filter((x) => x !== h)
      : [...cur, h].sort((a, b) => a - b);
    setLocal((p) => ({ ...p, [iso]: next }));
    setHours.mutate(
      { date: iso, hours: next },
      { onError: () => void avail.refetch() }
    );
  };

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
      <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
          📅 Meine Verfügbarkeit
        </h2>
        <span className="text-[10px] text-forest-400">
          Nicht bindend — wir versuchen das zu berücksichtigen
        </span>
      </div>
      <p className="text-xs text-forest-300/80 mb-3 leading-relaxed">
        Tippe die Stunden an, in denen du kannst — <span className="text-emerald-300 font-semibold">grün</span> = verfügbar.
        Sobald wir dich einplanen, wird der Slot <span className="text-sky-300 font-semibold">blau</span> = dein Dienst.
      </p>

      {/* Monats-Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMonthOffset((o) => Math.max(0, o - 1))}
          disabled={monthOffset === 0}
          className="rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-3 py-1.5 text-sm text-forest-200 disabled:opacity-30"
        >
          ←
        </button>
        <div className="text-sm font-semibold text-forest-100">
          {MONTHS[monthStart.getMonth()]} {monthStart.getFullYear()}
        </div>
        <button
          onClick={() => setMonthOffset((o) => Math.min(MAX_MONTHS_AHEAD, o + 1))}
          disabled={monthOffset >= MAX_MONTHS_AHEAD}
          className="rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-3 py-1.5 text-sm text-forest-200 disabled:opacity-30"
        >
          →
        </button>
      </div>

      {/* Legende */}
      <div className="flex items-center gap-4 mb-3 text-[11px] text-forest-300">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-emerald-500/30 ring-1 ring-emerald-500/50" /> verfügbar
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-sky-500/40 ring-1 ring-sky-400/60" /> bestätigter Dienst
        </span>
      </div>

      <div className="space-y-1.5">
        {days.map((d) => {
          const iso = isoDate(d);
          const isPast = d < today;
          const isHoliday = isHolidayDate(d, holidaySet);
          const slots = operatingHours(d, isHoliday);
          const confirmed = confirmedByDate.get(iso) ?? new Set<number>();
          const greenHours = local[iso] ?? [];
          const isToday = iso === isoDate(today);

          const dayLabel = (
            <div className="w-20 flex-shrink-0">
              <div className={`text-xs font-semibold ${isToday ? 'text-amber-300' : 'text-forest-100'}`}>
                {WD[d.getDay()]} {String(d.getDate()).padStart(2, '0')}.{String(d.getMonth() + 1).padStart(2, '0')}.
              </div>
              {isHoliday && <div className="text-[9px] text-amber-400/80">Feiertag</div>}
            </div>
          );

          // Ruhetag (Montag) — keine Slots
          if (slots.length === 0) {
            return (
              <div key={iso} className="flex items-center gap-3 rounded-xl bg-forest-900/25 px-3 py-2 opacity-60">
                {dayLabel}
                <div className="text-[11px] italic text-forest-500">Ruhetag</div>
              </div>
            );
          }
          // Vergangene Tage — nur anzeigen, nicht editierbar
          if (isPast) {
            return (
              <div key={iso} className="flex items-center gap-3 rounded-xl bg-forest-900/25 px-3 py-2 opacity-40">
                {dayLabel}
                <div className="text-[11px] italic text-forest-600">vergangen</div>
              </div>
            );
          }

          const confirmedHours = [...confirmed].sort((a, b) => a - b);

          return (
            <div
              key={iso}
              className={`flex items-start gap-3 rounded-xl px-3 py-2 ring-1 ${
                isToday ? 'bg-forest-900/60 ring-amber-500/30' : 'bg-forest-900/40 ring-forest-800/30'
              }`}
            >
              {dayLabel}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1">
                  {slots.map((h) => {
                    const isConfirmed = confirmed.has(h);
                    const isGreen = greenHours.includes(h);
                    const cls = isConfirmed
                      ? 'bg-sky-500/40 ring-1 ring-sky-400/60 text-sky-50 cursor-default'
                      : isGreen
                        ? 'bg-emerald-500/30 ring-1 ring-emerald-500/50 text-emerald-50 hover:bg-emerald-500/40'
                        : 'bg-forest-950/60 ring-1 ring-forest-800/40 text-forest-500 hover:ring-emerald-500/40 hover:text-forest-300';
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => toggle(iso, h, isConfirmed)}
                        title={`${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00${isConfirmed ? ' · bestätigt' : ''}`}
                        className={`h-8 w-9 rounded-md text-xs font-semibold tabular-nums transition ${cls}`}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
                {confirmedHours.length > 0 && (
                  <div className="mt-1 text-[10px] text-sky-300/90">
                    Dienst: {formatHoursRanges(confirmedHours)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
