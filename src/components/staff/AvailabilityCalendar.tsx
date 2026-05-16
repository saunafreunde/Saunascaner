import { useMemo, useState } from 'react';
import type { AvailabilityEntry } from '@/lib/api';
import {
  useMyAvailability,
  useSetMyAvailability,
  useDeleteMyAvailability,
} from '@/lib/api';

// Mitarbeiter-Verfügbarkeit für nächste 60 Tage
// Pro Tag: verfügbar/nicht verfügbar + optionales Zeitfenster + Notiz
// „Nicht bindend" — CP nutzt es als Planungs-Hilfe.

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtDayShort(d: Date): string {
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

const DAYS_AHEAD = 60;

export function AvailabilityCalendar() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const horizonEnd = useMemo(() => addDays(today, DAYS_AHEAD), [today]);

  const list = useMyAvailability(isoDate(today), isoDate(horizonEnd));
  const setAvail = useSetMyAvailability();
  const deleteAvail = useDeleteMyAvailability();

  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ start: string; end: string; note: string }>({
    start: '18:00',
    end: '22:00',
    note: '',
  });

  const days = useMemo(
    () => Array.from({ length: DAYS_AHEAD + 1 }, (_, i) => addDays(today, i)),
    [today]
  );

  const availByDate = useMemo(() => {
    const map = new Map<string, AvailabilityEntry>();
    (list.data ?? []).forEach((a) => map.set(a.date, a));
    return map;
  }, [list.data]);

  const openEdit = (date: string) => {
    setEditingDate(date);
    const existing = availByDate.get(date);
    setDraft({
      start: existing?.start_time.slice(0, 5) ?? '18:00',
      end: existing?.end_time.slice(0, 5) ?? '22:00',
      note: existing?.note ?? '',
    });
  };

  const save = async () => {
    if (!editingDate) return;
    await setAvail.mutateAsync({
      date: editingDate,
      start_time: draft.start,
      end_time: draft.end,
      note: draft.note || null,
    });
    setEditingDate(null);
  };

  const removeDate = async (date: string) => {
    await deleteAvail.mutateAsync(date);
    if (editingDate === date) setEditingDate(null);
  };

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
          📅 Meine Verfügbarkeit
        </h2>
        <span className="text-[10px] text-forest-400">
          Nicht bindend — wir versuchen das zu berücksichtigen
        </span>
      </div>

      <p className="text-xs text-forest-300/80 mb-4 leading-relaxed">
        Trag ein, wann du im Folgemonat (oder weiter voraus) Zeit hast. Du gibst pro Tag ein
        Zeitfenster + optional eine Notiz an. Du kannst jederzeit ändern oder löschen.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {days.map((d) => {
          const iso = isoDate(d);
          const entry = availByDate.get(iso);
          const isEditing = editingDate === iso;
          return (
            <button
              key={iso}
              onClick={() => openEdit(iso)}
              className={`text-left rounded-xl px-3 py-2 ring-1 transition ${
                entry
                  ? 'bg-emerald-500/15 ring-emerald-500/40 text-emerald-100'
                  : 'bg-forest-900/40 ring-forest-800/30 text-forest-400 hover:ring-amber-500/40'
              } ${isEditing ? 'ring-2 ring-amber-500' : ''}`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                {fmtDayShort(d)}
              </div>
              {entry ? (
                <>
                  <div className="text-xs font-semibold font-mono mt-0.5">
                    {entry.start_time.slice(0, 5)}–{entry.end_time.slice(0, 5)}
                  </div>
                  {entry.note && (
                    <div className="text-[10px] opacity-70 truncate mt-0.5">{entry.note}</div>
                  )}
                </>
              ) : (
                <div className="text-[10px] italic mt-1">+ verfügbar</div>
              )}
            </button>
          );
        })}
      </div>

      {editingDate && (
        <div className="mt-4 rounded-2xl bg-forest-900/60 ring-1 ring-amber-500/30 p-4 space-y-3">
          <div className="text-xs font-semibold text-amber-200">
            {new Date(editingDate).toLocaleDateString('de-DE', {
              weekday: 'long',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-forest-300">
              Von
              <input
                type="time"
                value={draft.start}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                className="mt-1 w-full rounded-lg bg-forest-950/80 ring-1 ring-forest-800/40 px-2 py-1.5 text-sm text-forest-100"
              />
            </label>
            <label className="text-xs text-forest-300">
              Bis
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
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder={'z.B. „Nur kurz, eil danach Termin"'}
              className="mt-1 w-full rounded-lg bg-forest-950/80 ring-1 ring-forest-800/40 px-2 py-1.5 text-sm text-forest-100"
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={setAvail.isPending}
              className="flex-1 rounded-lg bg-amber-500/30 text-amber-100 ring-1 ring-amber-500/50 px-3 py-2 text-sm font-semibold hover:bg-amber-500/40 disabled:opacity-40"
            >
              {setAvail.isPending ? 'Speichere…' : 'Speichern'}
            </button>
            {availByDate.has(editingDate) && (
              <button
                onClick={() => removeDate(editingDate)}
                disabled={deleteAvail.isPending}
                className="rounded-lg bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/40 px-3 py-2 text-sm font-semibold hover:bg-rose-500/30 disabled:opacity-40"
              >
                Löschen
              </button>
            )}
            <button
              onClick={() => setEditingDate(null)}
              className="rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-3 py-2 text-sm text-forest-200"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
