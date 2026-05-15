import { useMySwapRequests, useAcceptShiftSwap, useRejectShiftSwap } from '@/lib/api';

// Tausch-Anfragen-Liste — eingehende + ausgehende
// Status: pending | accepted | rejected | cancelled

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Offen', color: 'bg-amber-500/20 text-amber-200 ring-amber-500/40' },
  accepted: { label: 'Angenommen ✓', color: 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/40' },
  rejected: { label: 'Abgelehnt', color: 'bg-rose-500/20 text-rose-200 ring-rose-500/40' },
  cancelled: { label: 'Zurückgezogen', color: 'bg-forest-700/40 text-forest-300 ring-forest-700/40' },
};

export function SwapRequestsList() {
  const list = useMySwapRequests();
  const accept = useAcceptShiftSwap();
  const reject = useRejectShiftSwap();

  if ((list.data?.length ?? 0) === 0) return null;

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
        🔄 Tausch-Anfragen
      </h2>

      <ul className="space-y-2">
        {(list.data ?? []).map((r) => {
          const status = STATUS_LABEL[r.status] ?? STATUS_LABEL.pending;
          const isIncoming = r.direction === 'incoming';
          const canAct = r.status === 'pending';
          return (
            <li
              key={r.id}
              className="rounded-xl bg-forest-900/60 ring-1 ring-forest-800/40 px-4 py-3 space-y-2"
            >
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-forest-400">
                    {isIncoming ? 'Von' : 'An'}{' '}
                    <span className="text-forest-100 font-semibold">{r.other_member_name}</span>
                  </div>
                  <div className="text-sm font-semibold text-forest-100 mt-0.5">
                    {new Date(r.shift_date).toLocaleDateString('de-DE', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                    })}{' '}
                    · {r.shift_start.slice(0, 5)}–{r.shift_end.slice(0, 5)}
                  </div>
                  {r.offered_shift_id && r.offered_date && r.offered_start && r.offered_end && (
                    <div className="text-[11px] text-amber-300 mt-0.5">
                      Tausch gegen: {new Date(r.offered_date).toLocaleDateString('de-DE', {
                        weekday: 'short', day: '2-digit', month: '2-digit',
                      })}{' '}
                      · {r.offered_start.slice(0, 5)}–{r.offered_end.slice(0, 5)}
                    </div>
                  )}
                  {r.message && (
                    <div className="text-[11px] text-forest-400 mt-0.5 italic">„{r.message}"</div>
                  )}
                </div>
                <span
                  className={`rounded-full ring-1 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${status.color}`}
                >
                  {status.label}
                </span>
              </div>

              {canAct && isIncoming && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => accept.mutate(r.id)}
                    disabled={accept.isPending}
                    className="rounded-lg bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/30 disabled:opacity-40"
                  >
                    ✓ Annehmen
                  </button>
                  <button
                    onClick={() => reject.mutate(r.id)}
                    disabled={reject.isPending}
                    className="rounded-lg bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-rose-500/30 disabled:opacity-40"
                  >
                    ✗ Ablehnen
                  </button>
                </div>
              )}
              {canAct && !isIncoming && (
                <button
                  onClick={() => reject.mutate(r.id)}
                  disabled={reject.isPending}
                  className="rounded-lg bg-forest-700/40 text-forest-200 ring-1 ring-forest-700/40 px-3 py-1.5 text-xs font-semibold hover:bg-forest-700/60 disabled:opacity-40"
                >
                  Zurückziehen
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
