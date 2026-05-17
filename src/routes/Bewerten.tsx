import { useState } from 'react';
import { differenceInMinutes } from 'date-fns';
import {
  useRatableInfusions, useMeisterDirectory, useSaunas, useCurrentMember,
  type RatableInfusion,
} from '@/lib/api';
import { RatingForm } from '@/components/RatingForm';
import { fmtClock } from '@/lib/time';

// Mobile-Bottom-Nav-Ziel: alle besuchten Aufgüsse, die noch bewertet werden können.
// Bedient sich derselben useRatableInfusions/get_ratable_infusions-RPC wie der
// PendingRatingsBlock im /gast-Bereich — der Block dort returnt null bei
// pending.length===0; hier zeigen wir stattdessen einen Empty-State, damit die
// Route nie „weiß" ist.

export default function Bewerten() {
  const me = useCurrentMember();
  const list = useRatableInfusions(me.data?.id);
  const meisterDir = useMeisterDirectory();
  const saunas = useSaunas();
  const [active, setActive] = useState<RatableInfusion | null>(null);

  const meisterName = (id: string | null) =>
    (id && meisterDir.data?.find((m) => m.id === id)?.name) || 'Aufgießer:in';
  const saunaById = (id: string) => saunas.data?.find((s) => s.id === id);

  const pending = (list.data ?? []).filter((i) => !i.already_rated);

  return (
    <div className="bg-schwarzwald-soft min-h-screen text-slate-100 pb-24">
      <header className="border-b border-forest-800/40 bg-forest-950/95 backdrop-blur px-4 py-4">
        <h1 className="text-xl font-bold text-forest-100">⭐ Aufgüsse bewerten</h1>
        <p className="text-xs text-forest-300/70 mt-0.5">
          Deine besuchten Aufgüsse — möglich bis am Folgetag 12:00 Uhr.
        </p>
      </header>

      <div className="mx-auto max-w-2xl p-4">
        {list.isLoading ? (
          <p className="text-center text-sm text-forest-400 py-12">Lade…</p>
        ) : pending.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-base text-forest-200 font-semibold mb-1">
              Alles bewertet — danke!
            </p>
            <p className="text-sm text-forest-400 max-w-xs mx-auto">
              Sobald du wieder an einem Aufguss teilnimmst und einscannst,
              kannst du hier eine Bewertung abgeben.
            </p>
          </div>
        ) : (
          <section className="rounded-2xl bg-gradient-to-br from-amber-900/15 via-forest-950/85 to-forest-950/85 ring-1 ring-amber-500/30 p-5">
            <div className="flex items-end justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
                Noch offen
              </h2>
              <span className="text-xs text-forest-400 tabular-nums">
                {pending.length} offen
              </span>
            </div>

            <ul className="space-y-2">
              {pending.map((i) => {
                const sauna = saunaById(i.sauna_id);
                const minsAgo = differenceInMinutes(new Date(), new Date(i.end_time));
                return (
                  <li key={i.id}>
                    <button
                      onClick={() => setActive(i)}
                      className="w-full text-left rounded-xl bg-forest-950/70 ring-1 ring-forest-800/50 hover:ring-amber-500/50 hover:bg-forest-900/80 px-3 py-2.5 transition flex items-center gap-3"
                    >
                      <div
                        className="h-9 w-1.5 rounded-full flex-shrink-0"
                        style={{ background: sauna?.accent_color ?? '#22c55e' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-forest-100 truncate">
                          {i.title || 'Aufguss'} <span className="text-forest-400 font-normal">· {meisterName(i.saunameister_id)}</span>
                        </div>
                        <div className="text-[11px] text-forest-400">
                          {sauna?.name ?? 'Sauna'} · {fmtClock(i.start_time)} ·{' '}
                          {minsAgo < 60 ? `vor ${minsAgo}m` : minsAgo < 1440 ? `vor ${Math.round(minsAgo / 60)}h` : `vor ${Math.round(minsAgo / 1440)}d`}
                        </div>
                      </div>
                      <span className="rounded-full bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap">
                        ⭐ Bewerten
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {active && me.data && (
        <RatingForm
          infusion={active}
          meisterName={meisterName(active.saunameister_id)}
          memberId={me.data.id}
          onClose={() => setActive(null)}
          onSuccess={() => setActive(null)}
        />
      )}
    </div>
  );
}
