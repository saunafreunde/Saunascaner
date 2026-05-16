import {
  useApprovedAromaRecipes,
  usePendingAromaRecipes,
  useApproveAromaRecipe,
  useDeleteAromaRecipe,
} from '@/lib/api';

// Admin-Tab: Aroma-Rezepte moderieren.
// Aufgießer submitten Rezepte (über eigenes UI — Phase 2), Admin approved hier.
export function AromaRecipesAdminTab() {
  const pending = usePendingAromaRecipes();
  const approved = useApprovedAromaRecipes();
  const approve = useApproveAromaRecipe();
  const del = useDeleteAromaRecipe();

  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
        <h2 className="text-base font-semibold text-forest-100">🌿 Aroma-Rezepte</h2>
        <p className="text-xs text-forest-300/70 mt-1">
          Saunameister können Rezepte einreichen. Hier freigeben → sichtbar im /fan-Bereich.
        </p>
      </div>

      {/* Pending: wartet auf Freigabe */}
      <div className="rounded-2xl bg-amber-950/20 p-4 ring-1 ring-amber-500/30 backdrop-blur">
        <h3 className="text-sm font-semibold text-amber-100 mb-3">
          ⏳ Wartet auf Freigabe ({pending.data?.length ?? 0})
        </h3>
        {pending.isLoading ? (
          <p className="text-xs text-amber-200/70">Lade…</p>
        ) : (pending.data ?? []).length === 0 ? (
          <p className="text-xs text-amber-200/70">Keine offenen Einreichungen.</p>
        ) : (
          <ul className="space-y-3">
            {(pending.data ?? []).map((r) => (
              <li key={r.id} className="rounded-xl bg-forest-900/60 ring-1 ring-amber-500/20 p-3">
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <h4 className="text-sm font-semibold text-forest-100">
                    {r.title}
                    {r.sauna_type && (
                      <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">
                        {r.sauna_type}
                      </span>
                    )}
                    {r.temperature_c && (
                      <span className="ml-1 text-[10px] text-forest-400">🌡️ {r.temperature_c}°C</span>
                    )}
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => approve.mutate(r.id)}
                      disabled={approve.isPending}
                      className="rounded bg-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-400/50 hover:bg-emerald-500/40 disabled:opacity-50"
                    >
                      ✓ Freigeben
                    </button>
                    <button
                      onClick={() => {
                        if (!window.confirm(`Rezept "${r.title}" löschen?`)) return;
                        del.mutate(r.id);
                      }}
                      className="text-xs text-rose-300 hover:text-rose-200"
                    >
                      🗑
                    </button>
                  </div>
                </div>
                <ul className="text-xs text-forest-200/90 mb-2">
                  {r.ingredients.map((ing, i) => (
                    <li key={i}>• {ing.name}{ing.drops ? ` · ${ing.drops} Tropfen` : ''}</li>
                  ))}
                </ul>
                {r.description && (
                  <p className="text-[11px] text-forest-300 whitespace-pre-line leading-relaxed">{r.description}</p>
                )}
                {r.members?.name && (
                  <p className="text-[10px] text-forest-500 mt-2 italic">
                    Eingereicht von {r.members.name} · {new Date(r.created_at).toLocaleDateString('de-DE')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Approved: aktive Rezepte */}
      <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
        <h3 className="text-sm font-semibold text-forest-100 mb-3">
          ✓ Freigegeben ({approved.data?.length ?? 0})
        </h3>
        {(approved.data ?? []).length === 0 ? (
          <p className="text-xs text-forest-400/70">Noch keine freigegebenen Rezepte.</p>
        ) : (
          <ul className="space-y-2 divide-y divide-forest-800/40">
            {(approved.data ?? []).map((r) => (
              <li key={r.id} className="pt-2 first:pt-0 flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-forest-100">{r.title}</div>
                  <div className="text-[10px] text-forest-400">
                    {r.created_by_name} · {new Date(r.created_at).toLocaleDateString('de-DE')}
                    {r.sauna_type && ` · ${r.sauna_type}`}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!window.confirm(`Rezept "${r.title}" löschen?`)) return;
                    del.mutate(r.id);
                  }}
                  className="text-[10px] text-rose-300 hover:text-rose-200"
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
