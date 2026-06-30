import { useMemo, useState } from 'react';
import { OILS_BY_CATEGORY, CATEGORY_LABELS, CATEGORY_ORDER, type Oil } from '@/lib/oils';
import {
  useOilWeighings, useRecordOilWeighing, useDeleteOilWeighing, useDisabledOils,
  type OilWeighing,
} from '@/lib/api';

// Admin-Tab: Öl-Verbrauch dokumentieren (Migration 0114, Tabelle oil_weighings).
// Der Admin wiegt jede Flasche und trägt das aktuelle Gesamtgewicht (g) ein.
// Verbrauch = Differenz zur vorherigen Wiegung — reine Dokumentation,
// kein Soll-/Mindestbestand.

function fmtG(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' g';
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function OilWeighingTab() {
  const weighings = useOilWeighings();
  const record = useRecordOilWeighing();
  const del = useDeleteOilWeighing();
  const disabled = useDisabledOils();

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Wiegungen nach Öl gruppieren. get_oil_weighings liefert created_at desc,
  // d.h. je Öl ist [0] die jüngste, [1] die vorletzte Wiegung.
  const byOil = useMemo(() => {
    const map: Record<string, OilWeighing[]> = {};
    for (const w of weighings.data ?? []) {
      (map[w.oil_id] ??= []).push(w);
    }
    return map;
  }, [weighings.data]);

  async function save(oil: Oil) {
    const raw = (inputs[oil.id] ?? '').trim().replace(',', '.');
    const val = parseFloat(raw);
    if (!Number.isFinite(val) || val < 0) return;
    try {
      await record.mutateAsync({ oil: oil.id, weightG: val });
      setInputs((s) => ({ ...s, [oil.id]: '' }));
    } catch (e) {
      console.error('record weighing failed', oil.id, e);
    }
  }

  const totalWeighings = weighings.data?.length ?? 0;
  const oilsTracked = Object.keys(byOil).length;
  const lastActivity = weighings.data?.[0]?.created_at;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-forest-100">⚖️ Öl-Verbrauch dokumentieren</h2>
          <span className="text-xs font-medium text-amber-300 tabular-nums">
            {oilsTracked} Öle · {totalWeighings} Wiegungen
          </span>
        </div>
        <p className="mt-1 text-xs text-forest-300/70">
          Flasche wiegen und das aktuelle Gesamtgewicht in Gramm eintragen. Der
          Verbrauch ergibt sich automatisch als Differenz zur letzten Wiegung.
          {lastActivity && <> Letzte Wiegung: {fmtDate(lastActivity)}.</>}
        </p>
      </section>

      {CATEGORY_ORDER.map((cat) => {
        const oils = OILS_BY_CATEGORY[cat] ?? [];
        if (oils.length === 0) return null;
        return (
          <section key={cat} className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50">
            <h3 className="text-sm font-bold text-forest-200 uppercase tracking-wider mb-3">
              {CATEGORY_LABELS[cat]}
            </h3>
            <ul className="space-y-2">
              {oils.map((o) => {
                const hist = byOil[o.id] ?? [];
                const latest = hist[0];
                const prev = hist[1];
                const delta = latest && prev ? prev.weight_g - latest.weight_g : null;
                const isDisabled = !!disabled.data?.[o.id];
                const isOpen = !!expanded[o.id];
                const hasInput = !!(inputs[o.id] ?? '').trim();
                return (
                  <li key={o.id} className="rounded-xl bg-forest-900/50 ring-1 ring-forest-800/40 p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex w-7 justify-center rounded bg-forest-950/80 px-1 py-0.5 text-[10px] tabular-nums ring-1 ring-forest-700/40 shrink-0">{o.number}</span>
                      <span className="text-base shrink-0">{o.emoji}</span>
                      <span className="text-sm font-medium text-forest-100 flex-1 min-w-0 truncate">{o.name}</span>
                      {isDisabled && (
                        <span className="text-[9px] uppercase tracking-wider text-rose-300/80 bg-rose-950/40 ring-1 ring-rose-900/40 rounded px-1.5 py-0.5">nicht im Regal</span>
                      )}
                    </div>

                    {/* Aktueller Stand + Verbrauch seit letzter Wiegung */}
                    <div className="mt-2 flex items-center gap-3 flex-wrap text-xs">
                      {latest ? (
                        <>
                          <span className="text-forest-200">
                            Aktuell: <span className="font-semibold text-amber-200 tabular-nums">{fmtG(latest.weight_g)}</span>
                            <span className="text-forest-400"> · {fmtDate(latest.created_at)}</span>
                          </span>
                          {delta !== null && (
                            <span className={`tabular-nums font-medium ${delta > 0 ? 'text-rose-300' : delta < 0 ? 'text-emerald-300' : 'text-forest-400'}`}>
                              {delta > 0 ? `Verbrauch: −${fmtG(delta)}` : delta < 0 ? `Nachgefüllt: +${fmtG(-delta)}` : '±0 g'}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-forest-400/70 italic">Noch keine Wiegung erfasst</span>
                      )}
                    </div>

                    {/* Eingabe neues Gewicht */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="relative">
                        <input
                          value={inputs[o.id] ?? ''}
                          onChange={(e) => setInputs((s) => ({ ...s, [o.id]: e.target.value.replace(/[^0-9.,]/g, '') }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(o); } }}
                          inputMode="decimal"
                          placeholder="Gewicht"
                          className="w-28 rounded-lg bg-forest-950/80 pl-2.5 pr-7 py-1.5 text-sm tabular-nums ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-forest-400">g</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => save(o)}
                        disabled={record.isPending || !hasInput}
                        className="rounded-lg bg-forest-600 px-3 py-1.5 text-xs font-semibold text-forest-50 hover:bg-forest-500 transition disabled:opacity-40"
                      >
                        Eintragen
                      </button>
                      {hist.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpanded((s) => ({ ...s, [o.id]: !s[o.id] }))}
                          className="ml-auto rounded-lg bg-forest-900/60 px-2.5 py-1.5 text-[11px] text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-900 transition"
                        >
                          Verlauf ({hist.length}) {isOpen ? '▴' : '▾'}
                        </button>
                      )}
                    </div>

                    {/* Verlauf mit Schritt-Deltas + Löschen (Korrektur) */}
                    {isOpen && hist.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-forest-800/40 pt-2">
                        {hist.map((w, i) => {
                          const older = hist[i + 1];
                          const d = older ? older.weight_g - w.weight_g : null;
                          return (
                            <li key={w.id} className="flex items-center gap-2 text-[11px] text-forest-300">
                              <span className="tabular-nums text-forest-400 w-28 shrink-0">{fmtDate(w.created_at)}</span>
                              <span className="tabular-nums font-medium text-amber-200/90 w-20 shrink-0">{fmtG(w.weight_g)}</span>
                              <span className={`tabular-nums w-24 shrink-0 ${d === null ? 'text-forest-600' : d > 0 ? 'text-rose-300/80' : d < 0 ? 'text-emerald-300/80' : 'text-forest-500'}`}>
                                {d === null ? '—' : d > 0 ? `−${fmtG(d)}` : d < 0 ? `+${fmtG(-d)}` : '±0'}
                              </span>
                              {w.weighed_by_name && <span className="text-forest-500 truncate flex-1 min-w-0">{w.weighed_by_name}</span>}
                              <button
                                type="button"
                                onClick={() => del.mutate(w.id)}
                                disabled={del.isPending}
                                title="Wiegung löschen"
                                className="ml-auto shrink-0 text-rose-400/70 hover:text-rose-300 disabled:opacity-40"
                              >
                                ✕
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {weighings.isLoading && <p className="text-xs text-forest-400 text-center py-4">Lade Wiegungen…</p>}
    </div>
  );
}
