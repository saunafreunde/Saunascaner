// Admin-Tab zur Pflege von Feiertagen (Migration 0113, 30.05.2026).
//
// An Feiertagen wird die Sauna wie an Sa/So behandelt:
//   - Aufguss ab 11:00 (statt erst 14:00 wie Di/Mi/Do)
//   - Auch Mo wird zum Aufguss-Tag (selbst wenn schedule_settings.monday_open=false)
//   - Fr-Spezial (11/12/13 alle 80°C) bleibt erhalten wenn Feiertag auf Fr fällt

import { useState } from 'react';
import { useHolidays, useAdminAddHoliday, useAdminDeleteHoliday } from '@/lib/api';

export function HolidaysTab() {
  const holidaysQ = useHolidays();
  const add = useAdminAddHoliday();
  const del = useAdminDeleteHoliday();
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!date) { setErr('Datum fehlt.'); return; }
    try {
      await add.mutateAsync({ date, label: label.trim() || 'Feiertag' });
      setDate(''); setLabel('');
    } catch (e) { setErr((e as Error).message); }
  }

  async function remove(d: string) {
    if (!window.confirm(`Feiertag ${d} löschen?`)) return;
    try {
      await del.mutateAsync(d);
    } catch (e) { window.alert((e as Error).message); }
  }

  const sorted = [...(holidaysQ.data ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const past = sorted.filter((h) => new Date(h.date) < now);
  const upcoming = sorted.filter((h) => new Date(h.date) >= now);

  function fmtDate(d: string): string {
    const dt = new Date(d);
    return dt.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl bg-forest-950/60 ring-1 ring-forest-700/40 p-5">
        <h2 className="text-base font-bold text-forest-100 flex items-center gap-2">
          <span>🎉</span><span>Feiertage</span>
        </h2>
        <p className="mt-1 text-xs text-forest-400 leading-relaxed">
          An diesen Tagen läuft der Sauna-Betrieb <strong>wie an einem Sonntag</strong> — erster Aufguss um 11:00 (statt erst 14:00 wie Di/Mi/Do).
          Wenn ein Feiertag auf einen Montag fällt, ist die Sauna offen (auch wenn Mo normalerweise geschlossen ist).
        </p>
      </div>

      <form onSubmit={submit} className="rounded-2xl bg-forest-950/60 ring-1 ring-forest-700/40 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-forest-200">➕ Neuen Feiertag hinzufügen</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
          />
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={'Bezeichnung (z.B. Christi Himmelfahrt)'}
            className="rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400/60 sm:col-span-1"
          />
          <button
            type="submit"
            disabled={!date || add.isPending}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-forest-950 hover:bg-amber-400 disabled:opacity-50 transition"
          >
            {add.isPending ? '…' : '+ Hinzufügen'}
          </button>
        </div>
        {err && <p className="text-xs text-rose-300">{err}</p>}
      </form>

      {upcoming.length > 0 && (
        <div className="rounded-2xl bg-forest-950/60 ring-1 ring-forest-700/40 p-5">
          <h3 className="text-sm font-semibold text-forest-200 mb-3">📅 Kommende Feiertage ({upcoming.length})</h3>
          <ul className="space-y-2">
            {upcoming.map((h) => (
              <li key={h.date} className="flex items-center justify-between gap-3 rounded-lg bg-forest-900/60 px-3 py-2.5 ring-1 ring-forest-800/40">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-forest-100">{h.label}</div>
                  <div className="text-[11px] text-forest-400">{fmtDate(h.date)}</div>
                </div>
                <button
                  onClick={() => remove(h.date)}
                  disabled={del.isPending}
                  className="rounded-md bg-rose-500/15 px-2.5 py-1 text-[11px] font-medium text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/25 disabled:opacity-30"
                  title="Feiertag löschen"
                >
                  ✕ Löschen
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {past.length > 0 && (
        <details className="rounded-2xl bg-forest-950/40 ring-1 ring-forest-800/40 p-4">
          <summary className="cursor-pointer text-xs font-semibold text-forest-400 uppercase tracking-wider">
            Vergangene Feiertage ({past.length})
          </summary>
          <ul className="mt-3 space-y-1">
            {past.map((h) => (
              <li key={h.date} className="flex items-center justify-between gap-3 text-xs text-forest-500">
                <span>{h.label} · {fmtDate(h.date)}</span>
                <button
                  onClick={() => remove(h.date)}
                  className="text-[10px] text-forest-600 hover:text-rose-400"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {upcoming.length === 0 && past.length === 0 && !holidaysQ.isLoading && (
        <div className="rounded-2xl bg-forest-950/40 p-5 text-center text-sm text-forest-500">
          Noch keine Feiertage eingetragen.
        </div>
      )}
    </section>
  );
}
