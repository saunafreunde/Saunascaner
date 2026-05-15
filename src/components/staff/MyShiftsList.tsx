import { useMemo, useState } from 'react';
import {
  useListPersonalShifts,
  useCurrentMember,
  useStaffMembers,
  useCancelMyShift,
  useRequestShiftSwap,
} from '@/lib/api';

// Eigene Schichten (nur staff) für nächste 60 Tage.
// Pro Schicht: anzeigen + Cancel-Button + Tausch-Button.

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function MyShiftsList() {
  const me = useCurrentMember();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const horizon = useMemo(() => addDays(today, 60), [today]);
  const shifts = useListPersonalShifts(isoDate(today), isoDate(horizon));
  const staff = useStaffMembers();
  const cancel = useCancelMyShift();
  const requestSwap = useRequestShiftSwap();

  const [cancelDialogShiftId, setCancelDialogShiftId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [swapDialogShiftId, setSwapDialogShiftId] = useState<string | null>(null);
  const [swapTarget, setSwapTarget] = useState<string>('');
  const [swapMessage, setSwapMessage] = useState('');

  const myShifts = useMemo(
    () => (shifts.data ?? []).filter((s) => s.staff_member_id === me.data?.id),
    [shifts.data, me.data?.id]
  );

  const submitCancel = async () => {
    if (!cancelDialogShiftId) return;
    await cancel.mutateAsync({
      shift_id: cancelDialogShiftId,
      reason: cancelReason || null,
    });
    setCancelDialogShiftId(null);
    setCancelReason('');
  };

  const submitSwap = async () => {
    if (!swapDialogShiftId || !swapTarget) return;
    await requestSwap.mutateAsync({
      shift_id: swapDialogShiftId,
      to_member_id: swapTarget,
      message: swapMessage || null,
    });
    setSwapDialogShiftId(null);
    setSwapTarget('');
    setSwapMessage('');
  };

  if (myShifts.length === 0) return null;

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
        📋 Meine Schichten
      </h2>

      <ul className="space-y-2">
        {myShifts.map((s) => (
          <li
            key={s.id}
            className="rounded-xl bg-forest-900/60 ring-1 ring-forest-800/40 px-4 py-3"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-forest-100">
                  {new Date(s.shift_date).toLocaleDateString('de-DE', {
                    weekday: 'short',
                    day: '2-digit',
                    month: '2-digit',
                  })}{' '}
                  · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                </div>
                {s.notes && <div className="text-[11px] text-forest-400 truncate">{s.notes}</div>}
              </div>
              <button
                onClick={() => setSwapDialogShiftId(s.id)}
                className="rounded-lg bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40 px-2.5 py-1 text-[11px] font-semibold hover:bg-amber-500/30"
              >
                🔄 Tauschen
              </button>
              <button
                onClick={() => setCancelDialogShiftId(s.id)}
                className="rounded-lg bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/40 px-2.5 py-1 text-[11px] font-semibold hover:bg-rose-500/30"
              >
                ✗ Absagen
              </button>
            </div>
          </li>
        ))}
      </ul>

      {cancelDialogShiftId && (
        <div className="mt-4 rounded-2xl bg-forest-900/60 ring-1 ring-rose-500/40 p-4 space-y-3">
          <div className="text-xs font-semibold text-rose-200">Schicht absagen</div>
          <p className="text-[11px] text-forest-400">
            Alle anderen Mitarbeiter werden benachrichtigt und können übernehmen.
          </p>
          <input
            type="text"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={'Grund (optional)'}
            className="w-full rounded-lg bg-forest-950/80 ring-1 ring-forest-800/40 px-2 py-1.5 text-sm text-forest-100"
          />
          <div className="flex gap-2">
            <button
              onClick={submitCancel}
              disabled={cancel.isPending}
              className="flex-1 rounded-lg bg-rose-500/30 text-rose-100 ring-1 ring-rose-500/50 px-3 py-2 text-sm font-semibold hover:bg-rose-500/40 disabled:opacity-40"
            >
              {cancel.isPending ? 'Absage…' : 'Absagen'}
            </button>
            <button
              onClick={() => setCancelDialogShiftId(null)}
              className="rounded-lg bg-forest-900/60 ring-1 ring-forest-800/40 px-3 py-2 text-sm text-forest-200"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {swapDialogShiftId && (
        <div className="mt-4 rounded-2xl bg-forest-900/60 ring-1 ring-amber-500/40 p-4 space-y-3">
          <div className="text-xs font-semibold text-amber-200">Tausch anfragen</div>
          <label className="block text-xs text-forest-300">
            Mit wem tauschen?
            <select
              value={swapTarget}
              onChange={(e) => setSwapTarget(e.target.value)}
              className="mt-1 w-full rounded-lg bg-forest-950/80 ring-1 ring-forest-800/40 px-2 py-1.5 text-sm text-forest-100"
            >
              <option value="">— Mitarbeiter wählen —</option>
              {(staff.data ?? [])
                .filter((s) => s.id !== me.data?.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <input
            type="text"
            value={swapMessage}
            onChange={(e) => setSwapMessage(e.target.value)}
            placeholder={'Nachricht (optional)'}
            className="w-full rounded-lg bg-forest-950/80 ring-1 ring-forest-800/40 px-2 py-1.5 text-sm text-forest-100"
          />
          <div className="flex gap-2">
            <button
              onClick={submitSwap}
              disabled={!swapTarget || requestSwap.isPending}
              className="flex-1 rounded-lg bg-amber-500/30 text-amber-100 ring-1 ring-amber-500/50 px-3 py-2 text-sm font-semibold hover:bg-amber-500/40 disabled:opacity-40"
            >
              {requestSwap.isPending ? 'Sende…' : 'Anfrage senden'}
            </button>
            <button
              onClick={() => setSwapDialogShiftId(null)}
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
