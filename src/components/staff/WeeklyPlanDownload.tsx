import { useMemo, useState } from 'react';
import { useCurrentMember, useListPersonalShifts } from '@/lib/api';
import { downloadShiftPlanPdf } from '@/lib/shiftPlanPdf';
import { shiftHours } from '@/lib/staffHours';

// Wochenplan-Download für Personal (Migration 0117). Woche wählen → PDF der
// bestätigten Dienste (personal_shifts) herunterladen.

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=So
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
}
function fmt(d: Date): string {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}
const MAX_WEEKS_AHEAD = 12;

export function WeeklyPlanDownload() {
  const me = useCurrentMember();
  const [weekOffset, setWeekOffset] = useState(0);

  const baseMonday = useMemo(() => mondayOf(new Date()), []);
  const weekStart = useMemo(() => addDays(baseMonday, weekOffset * 7), [baseMonday, weekOffset]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const shifts = useListPersonalShifts(isoDate(weekStart), isoDate(weekEnd));
  const myShifts = useMemo(
    () => (shifts.data ?? []).filter((s) => !me.data || s.staff_member_id === me.data.id),
    [shifts.data, me.data]
  );
  const totalHours = useMemo(
    () => myShifts.reduce((sum, s) => sum + shiftHours(s.start_time, s.end_time).length, 0),
    [myShifts]
  );

  const handleDownload = () => {
    if (!me.data) return;
    downloadShiftPlanPdf({
      staffName: me.data.name,
      weekStart,
      shifts: myShifts.map((s) => ({
        shift_date: s.shift_date,
        start_time: s.start_time,
        end_time: s.end_time,
      })),
    });
  };

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
        📄 Wochenplan
      </h2>

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setWeekOffset((o) => Math.max(-1, o - 1))}
          disabled={weekOffset <= -1}
          className="rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-3 py-1.5 text-sm text-forest-200 disabled:opacity-30"
        >
          ←
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold text-forest-100">
            {fmt(weekStart)} – {fmt(weekEnd)}
          </div>
          <div className="text-[11px] text-forest-400">
            {totalHours > 0 ? `${myShifts.length} Dienst${myShifts.length === 1 ? '' : 'e'} · ${totalHours} Std` : 'keine Dienste'}
          </div>
        </div>
        <button
          onClick={() => setWeekOffset((o) => Math.min(MAX_WEEKS_AHEAD, o + 1))}
          disabled={weekOffset >= MAX_WEEKS_AHEAD}
          className="rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-3 py-1.5 text-sm text-forest-200 disabled:opacity-30"
        >
          →
        </button>
      </div>

      <button
        onClick={handleDownload}
        disabled={!me.data}
        className="w-full rounded-xl bg-amber-500/25 text-amber-100 ring-1 ring-amber-500/50 px-4 py-3 text-sm font-semibold hover:bg-amber-500/35 disabled:opacity-40"
      >
        📄 Diese Woche als PDF herunterladen
      </button>
    </section>
  );
}
