import { useMemo, useState } from 'react';
import {
  useStaffMembers,
  useListPersonalShifts,
  useCreatePersonalShift,
  useDeletePersonalShift,
} from '@/lib/api';

// Schicht-Planung für Personal — 7-Tage-Wochenansicht
// Pro Tag: Liste der eingeplanten Mitarbeiter mit Start/Ende.
// CP-Verantwortlicher kann Schichten anlegen + löschen.

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

function fmtDay(d: Date): string {
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export function PersonalShiftPlanner() {
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = today.getDay();
    const monOffset = dow === 0 ? -6 : 1 - dow; // Montag als Wochenstart
    return addDays(today, monOffset);
  });

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const shifts = useListPersonalShifts(isoDate(weekStart), isoDate(weekEnd));
  const staff = useStaffMembers();
  const createShift = useCreatePersonalShift();
  const deleteShift = useDeletePersonalShift();

  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<{ staff_id: string; date: string; start: string; end: string; notes: string }>({
    staff_id: '',
    date: isoDate(new Date()),
    start: '08:00',
    end: '16:00',
    notes: '',
  });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, typeof shifts.data>();
    (shifts.data ?? []).forEach((s) => {
      const arr = map.get(s.shift_date) ?? [];
      arr.push(s);
      map.set(s.shift_date, arr);
    });
    return map;
  }, [shifts.data]);

  const submitDraft = async () => {
    if (!draft.staff_id) return;
    await createShift.mutateAsync({
      staff_member_id: draft.staff_id,
      shift_date: draft.date,
      start_time: draft.start,
      end_time: draft.end,
      notes: draft.notes || null,
    });
    setShowAdd(false);
    setDraft({ ...draft, notes: '' });
  };

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
          🗓️ Personal-Schichtplan
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-2 py-1 text-xs text-forest-200 hover:ring-amber-500/40"
          >
            ←
          </button>
          <span className="text-xs text-forest-300 font-mono">
            {fmtDay(weekStart)} – {fmtDay(weekEnd)}
          </span>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-2 py-1 text-xs text-forest-200 hover:ring-amber-500/40"
          >
            →
          </button>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="rounded-lg bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40 px-3 py-1 text-xs font-semibold hover:bg-amber-500/30"
          >
            {showAdd ? 'Abbrechen' : '+ Schicht'}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="mb-4 rounded-2xl bg-forest-900/60 ring-1 ring-amber-500/30 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-forest-300">
              Mitarbeiter
              <select
                value={draft.staff_id}
                onChange={(e) => setDraft({ ...draft, staff_id: e.target.value })}
                className="mt-1 w-full rounded-lg bg-forest-950/80 ring-1 ring-forest-800/40 px-2 py-1.5 text-sm text-forest-100"
              >
                <option value="">— wählen —</option>
                {(staff.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-forest-300">
              Datum
              <input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                className="mt-1 w-full rounded-lg bg-forest-950/80 ring-1 ring-forest-800/40 px-2 py-1.5 text-sm text-forest-100"
              />
            </label>
            <label className="text-xs text-forest-300">
              Start
              <input
                type="time"
                value={draft.start}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                className="mt-1 w-full rounded-lg bg-forest-950/80 ring-1 ring-forest-800/40 px-2 py-1.5 text-sm text-forest-100"
              />
            </label>
            <label className="text-xs text-forest-300">
              Ende
              <input
                type="time"
                value={draft.end}
                onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                className="mt-1 w-full rounded-lg bg-forest-950/80 ring-1 ring-forest-800/40 px-2 py-1.5 text-sm text-forest-100"
              />
            </label>
          </div>
          <label className="block text-xs text-forest-300">
            Notiz (optional)
            <input
              type="text"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder={'z.B. ‚Spätschicht‘'}
              className="mt-1 w-full rounded-lg bg-forest-950/80 ring-1 ring-forest-800/40 px-2 py-1.5 text-sm text-forest-100"
            />
          </label>
          <button
            onClick={submitDraft}
            disabled={!draft.staff_id || createShift.isPending}
            className="w-full rounded-lg bg-amber-500/30 text-amber-100 ring-1 ring-amber-500/50 px-3 py-2 text-sm font-semibold hover:bg-amber-500/40 disabled:opacity-40"
          >
            {createShift.isPending ? 'Speichere…' : 'Schicht speichern'}
          </button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-2">
        {days.map((d) => {
          const iso = isoDate(d);
          const list = shiftsByDay.get(iso) ?? [];
          return (
            <div key={iso} className="rounded-xl bg-forest-900/40 ring-1 ring-forest-800/30 p-2 min-h-[120px]">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-forest-400 mb-1.5">
                {fmtDay(d)}
              </div>
              {list.length === 0 ? (
                <div className="text-[10px] text-forest-600 italic">keine Schicht</div>
              ) : (
                <ul className="space-y-1">
                  {list.map((s) => (
                    <li key={s.id} className="rounded-md bg-amber-500/10 ring-1 ring-amber-500/30 px-2 py-1">
                      <div className="text-xs font-semibold text-amber-100 truncate">{s.staff_name}</div>
                      <div className="text-[10px] text-amber-200/70 font-mono">
                        {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                      </div>
                      {s.notes && <div className="text-[10px] text-forest-300 truncate mt-0.5">{s.notes}</div>}
                      <button
                        onClick={() => deleteShift.mutate(s.id)}
                        className="text-[9px] text-rose-300/70 hover:text-rose-300 mt-1"
                      >
                        löschen
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
