import { useState } from 'react';
import { useStaffMonthlyStats, useSetMemberPayroll } from '@/lib/api';

// CP-Übersicht: Pro Mitarbeiter Stunden + Euro + Limit-Auslastung für einen Monat
// Sortiert: wer am höchsten ausgelastet ist, ist oben — wer noch Luft hat, unten.
// Ziel: gerechte Verteilung sodass keiner früh 610€ ausschöpft.

function usageColor(pct: number): string {
  if (pct >= 100) return 'bg-rose-500/60 ring-rose-500';
  if (pct >= 85) return 'bg-rose-500/40 ring-rose-500/60';
  if (pct >= 70) return 'bg-amber-500/40 ring-amber-500/60';
  if (pct >= 50) return 'bg-amber-500/25 ring-amber-500/40';
  return 'bg-emerald-500/30 ring-emerald-500/40';
}

export function MonthlyHoursOverview() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  const stats = useStaffMonthlyStats(year, month);
  const setPayroll = useSetMemberPayroll();

  const [editing, setEditing] = useState<{ id: string; rate: number; limit: number } | null>(null);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };
  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const submitEdit = async () => {
    if (!editing) return;
    await setPayroll.mutateAsync({
      member_id: editing.id,
      hourly_rate_eur: editing.rate,
      monthly_hour_limit_eur: editing.limit,
    });
    setEditing(null);
  };

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
          💰 Monatsstunden
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-2 py-1 text-xs text-forest-200 hover:ring-amber-500/40">←</button>
          <span className="text-xs font-mono text-forest-300 min-w-[120px] text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-2 py-1 text-xs text-forest-200 hover:ring-amber-500/40">→</button>
        </div>
      </div>

      <p className="text-[11px] text-forest-400 mb-3">
        Sortiert nach Auslastung — wer oben steht, hat das Monats-Limit fast erreicht. Klick auf den Stundensatz, um pro Mitarbeiter zu ändern.
      </p>

      {stats.isLoading ? (
        <div className="text-center text-sm text-forest-400 py-4">Lade…</div>
      ) : (stats.data?.length ?? 0) === 0 ? (
        <div className="text-center text-sm text-forest-400 py-4">Kein Personal angelegt.</div>
      ) : (
        <ul className="space-y-2">
          {(stats.data ?? []).map((s) => (
            <li key={s.member_id} className="rounded-xl bg-forest-900/40 ring-1 ring-forest-800/30 px-4 py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-forest-100 truncate">{s.name}</div>
                  <div className="text-[11px] text-forest-400">
                    {s.shift_count}× Schicht · {s.total_hours} h
                    {' · '}
                    <button
                      onClick={() =>
                        setEditing({
                          id: s.member_id,
                          rate: s.hourly_rate_eur,
                          limit: s.monthly_limit_eur,
                        })
                      }
                      className="underline hover:text-amber-300"
                    >
                      {s.hourly_rate_eur} €/h · Limit {s.monthly_limit_eur} €
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${s.total_earned_eur >= s.monthly_limit_eur ? 'text-rose-300' : 'text-amber-100'}`}>
                    {s.total_earned_eur.toFixed(2)} €
                  </div>
                  <div className="text-[10px] text-forest-400">
                    noch {s.limit_remaining_eur.toFixed(2)} €
                  </div>
                </div>
              </div>
              {/* Auslastungs-Balken */}
              <div className="mt-2 h-1.5 bg-forest-950/60 rounded-full overflow-hidden">
                <div
                  className={`h-full ring-1 ${usageColor(s.limit_usage_pct)}`}
                  style={{ width: `${Math.min(s.limit_usage_pct, 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-forest-500 text-right mt-0.5">
                {s.limit_usage_pct}% des Monats-Limits
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="mt-4 rounded-2xl bg-forest-900/60 ring-1 ring-amber-500/40 p-4 space-y-3">
          <div className="text-xs font-semibold text-amber-200">Vergütung anpassen</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-forest-300">
              Stundensatz (€)
              <input
                type="number"
                step="0.50"
                min="1"
                value={editing.rate}
                onChange={(e) => setEditing({ ...editing, rate: parseFloat(e.target.value) || 0 })}
                className="mt-1 w-full rounded-lg bg-forest-950/80 ring-1 ring-forest-800/40 px-2 py-1.5 text-sm text-forest-100"
              />
            </label>
            <label className="text-xs text-forest-300">
              Monats-Limit (€)
              <input
                type="number"
                step="10"
                min="0"
                value={editing.limit}
                onChange={(e) => setEditing({ ...editing, limit: parseFloat(e.target.value) || 0 })}
                className="mt-1 w-full rounded-lg bg-forest-950/80 ring-1 ring-forest-800/40 px-2 py-1.5 text-sm text-forest-100"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={submitEdit}
              disabled={setPayroll.isPending}
              className="flex-1 rounded-lg bg-amber-500/30 text-amber-100 ring-1 ring-amber-500/50 px-3 py-2 text-sm font-semibold hover:bg-amber-500/40 disabled:opacity-40"
            >
              {setPayroll.isPending ? 'Speichere…' : 'Speichern'}
            </button>
            <button
              onClick={() => setEditing(null)}
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
