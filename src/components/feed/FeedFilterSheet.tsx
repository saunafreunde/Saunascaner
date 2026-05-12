import { useState } from 'react';
import { format } from 'date-fns';
import { useInfusions } from '@/lib/api';
import { OILS_BY_CATEGORY, OIL_BY_ID, CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/oils';

type Props = {
  activeOil: string | null;
  activeInfusion: string | null;
  onApply: (filter: { oil: string | null; infusion: string | null }) => void;
  onClose: () => void;
};

export function FeedFilterSheet({ activeOil, activeInfusion, onApply, onClose }: Props) {
  const [tab, setTab] = useState<'oil' | 'infusion'>(activeInfusion ? 'infusion' : 'oil');
  const infusionsQ = useInfusions();

  const recentInfusions = (() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 3600_000;
    return (infusionsQ.data ?? [])
      .filter((i) => !i.is_personal_fallback && i.saunameister_id)
      .filter((i) => {
        const t = new Date(i.start_time).getTime();
        return t >= weekAgo && t <= now + 24 * 3600_000;
      })
      .sort((a, b) => +new Date(b.start_time) - +new Date(a.start_time))
      .slice(0, 30);
  })();

  function applyOil(oilId: string | null) {
    onApply({ oil: oilId, infusion: null });
    onClose();
  }

  function applyInfusion(infId: string | null) {
    onApply({ oil: null, infusion: infId });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-forest-950 ring-1 ring-forest-700/50 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-forest-800/40">
          <h2 className="text-base font-semibold text-forest-100">Feed filtern</h2>
          <button onClick={onClose} className="text-forest-300 hover:text-forest-100 text-xl">×</button>
        </div>

        <div className="flex border-b border-forest-800/40">
          <button
            onClick={() => setTab('oil')}
            className={`flex-1 py-2.5 text-sm font-medium transition ${
              tab === 'oil' ? 'text-emerald-200 border-b-2 border-emerald-400' : 'text-forest-400 hover:text-forest-200'
            }`}
          >🌿 Aroma</button>
          <button
            onClick={() => setTab('infusion')}
            className={`flex-1 py-2.5 text-sm font-medium transition ${
              tab === 'infusion' ? 'text-amber-200 border-b-2 border-amber-400' : 'text-forest-400 hover:text-forest-200'
            }`}
          >🧖 Aufguss</button>
        </div>

        <div className="p-4">
          {(activeOil || activeInfusion) && (
            <button
              onClick={() => { onApply({ oil: null, infusion: null }); onClose(); }}
              className="mb-3 text-[11px] text-rose-300 hover:text-rose-200 underline"
            >Filter aufheben</button>
          )}

          {tab === 'oil' && (
            <div className="space-y-3">
              {CATEGORY_ORDER.map((cat) => {
                const oils = OILS_BY_CATEGORY[cat] ?? [];
                if (!oils.length) return null;
                return (
                  <div key={cat}>
                    <div className="text-[10px] uppercase tracking-wider text-emerald-300/70 font-bold mb-1.5">{CATEGORY_LABELS[cat]}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {oils.map((o) => {
                        const active = activeOil === o.id;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => applyOil(active ? null : o.id)}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ring-1 transition ${
                              active
                                ? 'bg-emerald-500 text-emerald-950 ring-emerald-400 font-semibold'
                                : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                            }`}
                          >
                            <span className="rounded bg-black/30 px-1 text-[9px] tabular-nums">#{o.number}</span>
                            <span>{o.emoji}</span>
                            <span>{o.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'infusion' && (
            <div className="space-y-1">
              {recentInfusions.length === 0 && (
                <p className="text-center text-sm text-forest-400 py-6">Keine Aufgüsse der letzten Tage.</p>
              )}
              {recentInfusions.map((i) => {
                const active = activeInfusion === i.id;
                return (
                  <button
                    key={i.id}
                    onClick={() => applyInfusion(active ? null : i.id)}
                    className={`w-full text-left rounded-lg px-3 py-2 ring-1 transition ${
                      active
                        ? 'bg-amber-500/20 ring-amber-500/40 text-amber-100'
                        : 'bg-forest-900/50 ring-forest-800/40 text-forest-100 hover:bg-forest-900'
                    }`}
                  >
                    <div className="text-sm font-medium truncate">{i.title}</div>
                    <div className="text-[10px] text-forest-400 tabular-nums">
                      {format(new Date(i.start_time), 'EEE dd.MM. · HH:mm')}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'oil' && activeOil && OIL_BY_ID[activeOil] && (
            <div className="mt-4 rounded-lg bg-emerald-900/30 px-3 py-2 ring-1 ring-emerald-700/40 text-xs text-emerald-200">
              Aktiv: #{OIL_BY_ID[activeOil].number} {OIL_BY_ID[activeOil].emoji} {OIL_BY_ID[activeOil].name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
