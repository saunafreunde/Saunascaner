import { useMemo } from 'react';
import { OILS_BY_CATEGORY, CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/oils';
import { useDisabledOils, useSetOilDisabled } from '@/lib/api';

// Admin-Tab: Öle deaktivieren die physisch nicht im Regal sind.
// Deaktivierte Öle erscheinen nicht mehr im OilPicker (neue Aufgüsse).
// Alte Aufgüsse mit deaktivierten Ölen bleiben sichtbar — Historie
// unverändert (siehe Migration 0093 + InfusionCard.tsx).

export function OilsAdminTab() {
  const disabled = useDisabledOils();
  const setDisabled = useSetOilDisabled();

  const totalCount = useMemo(
    () => CATEGORY_ORDER.reduce((acc, cat) => acc + (OILS_BY_CATEGORY[cat]?.length ?? 0), 0),
    [],
  );
  const enabledCount = useMemo(() => {
    const dis = disabled.data ?? {};
    let count = 0;
    for (const cat of CATEGORY_ORDER) {
      for (const o of OILS_BY_CATEGORY[cat] ?? []) {
        if (!dis[o.id]) count++;
      }
    }
    return count;
  }, [disabled.data]);

  async function bulkSet(catOils: { id: string }[], makeDisabled: boolean) {
    // Reihenfolge egal — sequenziell damit der Backend-State sauber updated
    for (const o of catOils) {
      const isCurrentlyDisabled = !!disabled.data?.[o.id];
      if (isCurrentlyDisabled !== makeDisabled) {
        try {
          await setDisabled.mutateAsync({ oil: o.id, disabled: makeDisabled });
        } catch (e) {
          console.error('bulkSet error', o.id, e);
        }
      }
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-forest-100">🌿 Öle im Regal</h2>
          <span className="text-xs font-medium text-amber-300 tabular-nums">
            {enabledCount} / {totalCount} verfügbar
          </span>
        </div>
        <p className="mt-1 text-xs text-forest-300/70">
          Öle die physisch nicht im Regal stehen, deaktivieren — sie verschwinden
          dann im Aufguss-Anlegen-Picker. Alte Aufgüsse mit deaktivierten Ölen
          bleiben sichtbar (Historie unverändert).
        </p>
      </section>

      {CATEGORY_ORDER.map((cat) => {
        const oils = OILS_BY_CATEGORY[cat] ?? [];
        if (oils.length === 0) return null;
        const catDisabledCount = oils.filter((o) => disabled.data?.[o.id]).length;
        const catEnabledCount = oils.length - catDisabledCount;
        const allEnabled = catDisabledCount === 0;
        const allDisabled = catEnabledCount === 0;

        return (
          <section key={cat} className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-bold text-forest-200 uppercase tracking-wider">
                {CATEGORY_LABELS[cat]}
                <span className="ml-2 text-[10px] text-forest-400 normal-case tracking-normal">
                  ({catEnabledCount}/{oils.length})
                </span>
              </h3>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => bulkSet(oils, false)}
                  disabled={allEnabled || setDisabled.isPending}
                  className="rounded-md bg-emerald-500/15 px-2 py-1 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Alle an
                </button>
                <button
                  type="button"
                  onClick={() => bulkSet(oils, true)}
                  disabled={allDisabled || setDisabled.isPending}
                  className="rounded-md bg-rose-500/15 px-2 py-1 text-[10px] font-medium text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/25 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Alle aus
                </button>
              </div>
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {oils.map((o) => {
                const isDisabled = !!disabled.data?.[o.id];
                return (
                  <li
                    key={o.id}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 ring-1 transition ${
                      isDisabled
                        ? 'bg-rose-950/30 ring-rose-900/40 text-forest-400'
                        : 'bg-forest-900/50 ring-forest-800/40 text-forest-100'
                    }`}
                  >
                    <span className="text-base flex-shrink-0">{o.emoji}</span>
                    <span className="inline-flex w-7 justify-center rounded bg-forest-950/80 px-1 py-0.5 text-[10px] tabular-nums ring-1 ring-forest-700/40 shrink-0">
                      {o.number}
                    </span>
                    <span className={`flex-1 min-w-0 text-sm truncate ${isDisabled ? 'line-through text-forest-500' : ''}`}>
                      {o.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDisabled.mutate({ oil: o.id, disabled: !isDisabled })}
                      disabled={setDisabled.isPending}
                      title={isDisabled ? 'Aktivieren — im Regal vorhanden' : 'Deaktivieren — nicht im Regal'}
                      className={`flex-shrink-0 rounded-md px-2.5 py-1 text-[10px] font-semibold ring-1 transition disabled:opacity-50 ${
                        isDisabled
                          ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-forest-900/60 text-forest-300 ring-forest-700/40 hover:bg-rose-900/40 hover:text-rose-200 hover:ring-rose-500/40'
                      }`}
                    >
                      {isDisabled ? '+ Aktivieren' : 'Deaktivieren'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
