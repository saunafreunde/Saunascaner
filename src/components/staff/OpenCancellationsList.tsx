import { useOpenCancellations, useTakeOpenShift } from '@/lib/api';

// Zeigt allen Mitarbeitern die kürzlich abgesagten Schichten —
// jeder kann mit einem Klick übernehmen („🙋 Ich übernehme").
export function OpenCancellationsList() {
  const list = useOpenCancellations();
  const take = useTakeOpenShift();

  if ((list.data?.length ?? 0) === 0) return null;

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-rose-500/30 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-rose-300 mb-1">
        🆘 Offene Absagen
      </h2>
      <p className="text-[11px] text-forest-400 mb-3">
        Schichten, die kürzlich abgesagt wurden und noch niemand übernommen hat. Wer hat Zeit?
      </p>

      <ul className="space-y-2">
        {(list.data ?? []).map((c) => (
          <li
            key={c.shift_id}
            className="rounded-xl bg-forest-900/60 ring-1 ring-rose-500/20 px-4 py-3 flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-forest-100">
                {new Date(c.shift_date).toLocaleDateString('de-DE', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                })}{' '}
                · {c.start_time.slice(0, 5)}–{c.end_time.slice(0, 5)}
              </div>
              <div className="text-[11px] text-forest-400 truncate">
                Abgesagt von <span className="text-rose-300">{c.original_member_name}</span>
                {c.cancellation_reason && <span> · „{c.cancellation_reason}"</span>}
              </div>
            </div>
            <button
              onClick={() => take.mutate(c.shift_id)}
              disabled={take.isPending}
              className="rounded-lg bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/30 disabled:opacity-40 whitespace-nowrap"
            >
              🙋 Ich übernehme
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
