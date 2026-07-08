import { useEffect, useMemo, useState } from 'react';
import {
  useStaffMembers,
  useStaffAvailability,
  useListPersonalShifts,
  useConfirmStaffAvailability,
  useHolidaySet,
  isHolidayDate,
} from '@/lib/api';
import { operatingHours, shiftHours, formatHoursRanges } from '@/lib/staffHours';

// CP/Admin: Verfügbarkeit sehen + bestätigen (Dienstplan-Umbau, Migration 0117).
// Pro Mitarbeiter Monatsraster, Tage untereinander:
//   grün = vom Mitarbeiter gemeldet   ·   blau = bestätigt (= Schicht in personal_shifts)
// Klick auf einen Slot toggelt „bestätigt" → confirm_staff_availability.

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const MAX_MONTHS_AHEAD = 11;

export function AvailabilityOverview() {
  const staff = useStaffMembers();
  const holidaySet = useHolidaySet();
  const confirmMut = useConfirmStaffAvailability();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [monthOffset, setMonthOffset] = useState(0);
  const [memberId, setMemberId] = useState<string | null>(null);

  const members = staff.data ?? [];
  const selectedId = memberId ?? members[0]?.id ?? null;

  const monthStart = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + monthOffset, 1),
    [today, monthOffset]
  );
  const monthEnd = useMemo(
    () => new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0),
    [monthStart]
  );

  const avail = useStaffAvailability(isoDate(monthStart), isoDate(monthEnd));
  const shifts = useListPersonalShifts(isoDate(monthStart), isoDate(monthEnd));

  // Grüne (gemeldete) Stunden je Tag für den gewählten Mitarbeiter.
  const greenByDate = useMemo(() => {
    const m = new Map<string, number[]>();
    (avail.data ?? [])
      .filter((a) => a.member_id === selectedId)
      .forEach((a) => m.set(a.date, a.hours));
    return m;
  }, [avail.data, selectedId]);

  // Bestätigte (blaue) Stunden je Tag — lokal optimistisch, aus personal_shifts geseedet.
  const [confirmedLocal, setConfirmedLocal] = useState<Record<string, number[]>>({});
  useEffect(() => {
    const m: Record<string, number[]> = {};
    (shifts.data ?? [])
      .filter((s) => s.staff_member_id === selectedId)
      .forEach((s) => {
        const arr = m[s.shift_date] ?? [];
        m[s.shift_date] = [...new Set([...arr, ...shiftHours(s.start_time, s.end_time)])].sort((a, b) => a - b);
      });
    setConfirmedLocal(m);
  }, [shifts.data, selectedId]);

  const days = useMemo(() => {
    const n = monthEnd.getDate();
    return Array.from({ length: n }, (_, i) =>
      new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1)
    );
  }, [monthStart, monthEnd]);

  const saveConfirm = (iso: string, hours: number[]) => {
    if (!selectedId) return;
    setConfirmedLocal((p) => ({ ...p, [iso]: hours }));
    confirmMut.mutate(
      { member_id: selectedId, date: iso, hours },
      { onError: () => void shifts.refetch() }
    );
  };

  const toggle = (iso: string, h: number) => {
    const cur = confirmedLocal[iso] ?? [];
    const next = cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h].sort((a, b) => a - b);
    saveConfirm(iso, next);
  };

  const confirmAllGreen = (iso: string) => {
    const green = greenByDate.get(iso) ?? [];
    const cur = confirmedLocal[iso] ?? [];
    saveConfirm(iso, [...new Set([...cur, ...green])].sort((a, b) => a - b));
  };

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
      <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
          📅 Verfügbarkeit &amp; Dienste
        </h2>
      </div>
      <p className="text-[11px] text-forest-400 mb-3">
        <span className="text-emerald-300 font-semibold">Grün</span> = Mitarbeiter hat sich gemeldet.
        Klick bestätigt den Slot → <span className="text-sky-300 font-semibold">blau</span> = eingeplanter Dienst.
      </p>

      {/* Mitarbeiter-Auswahl + Monats-Navigation */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <select
          value={selectedId ?? ''}
          onChange={(e) => setMemberId(e.target.value)}
          className="rounded-lg bg-forest-900/70 ring-1 ring-forest-800/50 px-3 py-1.5 text-sm text-forest-100"
        >
          {members.length === 0 && <option value="">Kein Personal</option>}
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonthOffset((o) => Math.max(0, o - 1))}
            disabled={monthOffset === 0}
            className="rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-3 py-1.5 text-sm text-forest-200 disabled:opacity-30"
          >
            ←
          </button>
          <div className="text-sm font-semibold text-forest-100 min-w-[130px] text-center">
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
      </div>

      {!selectedId ? (
        <div className="text-center text-sm text-forest-400 py-6">Noch kein Personal angelegt.</div>
      ) : (
        <div className="space-y-1.5">
          {days.map((d) => {
            const iso = isoDate(d);
            const isPast = d < today;
            const isHoliday = isHolidayDate(d, holidaySet);
            const slots = operatingHours(d, isHoliday);
            const green = greenByDate.get(iso) ?? [];
            const confirmed = confirmedLocal[iso] ?? [];
            const isToday = iso === isoDate(today);

            const dayLabel = (
              <div className="w-20 flex-shrink-0">
                <div className={`text-xs font-semibold ${isToday ? 'text-amber-300' : 'text-forest-100'}`}>
                  {WD[d.getDay()]} {String(d.getDate()).padStart(2, '0')}.{String(d.getMonth() + 1).padStart(2, '0')}.
                </div>
                {isHoliday && <div className="text-[9px] text-amber-400/80">Feiertag</div>}
              </div>
            );

            if (slots.length === 0) {
              return (
                <div key={iso} className="flex items-center gap-3 rounded-xl bg-forest-900/25 px-3 py-2 opacity-60">
                  {dayLabel}
                  <div className="text-[11px] italic text-forest-500">Ruhetag</div>
                </div>
              );
            }
            if (isPast) return null;

            const greenPending = green.some((h) => !confirmed.includes(h));

            return (
              <div
                key={iso}
                className={`flex items-start gap-3 rounded-xl px-3 py-2 ring-1 ${
                  isToday ? 'bg-forest-900/60 ring-amber-500/30' : 'bg-forest-900/40 ring-forest-800/30'
                }`}
              >
                {dayLabel}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1">
                    {slots.map((h) => {
                      const isConfirmed = confirmed.includes(h);
                      const isGreen = green.includes(h);
                      const cls = isConfirmed
                        ? 'bg-sky-500/50 ring-1 ring-sky-400/70 text-sky-50 hover:bg-sky-500/60'
                        : isGreen
                          ? 'bg-emerald-500/30 ring-1 ring-emerald-500/50 text-emerald-50 hover:bg-emerald-500/45'
                          : 'bg-forest-950/60 ring-1 ring-forest-800/40 text-forest-500 hover:ring-sky-500/40 hover:text-forest-300';
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => toggle(iso, h)}
                          title={`${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00${isConfirmed ? ' · bestätigt' : isGreen ? ' · gemeldet' : ''}`}
                          className={`h-8 w-9 rounded-md text-xs font-semibold tabular-nums transition ${cls}`}
                        >
                          {h}
                        </button>
                      );
                    })}
                    {greenPending && (
                      <button
                        type="button"
                        onClick={() => confirmAllGreen(iso)}
                        className="ml-1 rounded-md bg-sky-500/20 ring-1 ring-sky-500/40 px-2 h-8 text-[10px] font-semibold text-sky-200 hover:bg-sky-500/30"
                      >
                        ✓ alle grünen
                      </button>
                    )}
                  </div>
                  {confirmed.length > 0 && (
                    <div className="mt-1 text-[10px] text-sky-300/90">
                      Dienst: {formatHoursRanges(confirmed)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
