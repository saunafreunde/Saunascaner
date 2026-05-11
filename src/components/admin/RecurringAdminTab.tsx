import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  useRecurringSlots, useApproveRecurringSlot, useRejectRecurringSlot, useRevokeMyRecurringSlot,
  useAbsences, useDeleteAbsence,
  useSaunas, useAllMembers, useMaterializeHorizon,
} from '@/lib/api';
import { WEEKDAY_LABEL_DE_SHORT } from '@/lib/garantie';

export function RecurringAdminTab() {
  const slotsQ = useRecurringSlots();
  const absencesQ = useAbsences(null);
  const saunasQ = useSaunas();
  const membersQ = useAllMembers();
  const approve = useApproveRecurringSlot();
  const reject = useRejectRecurringSlot();
  const revoke = useRevokeMyRecurringSlot();
  const deleteAbs = useDeleteAbsence();
  const materialize = useMaterializeHorizon();

  const memberName = (id: string) => membersQ.data?.find((m) => m.id === id)?.name ?? '?';
  const saunaName = (id: string) => saunasQ.data?.find((s) => s.id === id)?.name ?? '?';

  const pending = useMemo(() => (slotsQ.data ?? []).filter((s) => s.status === 'pending'), [slotsQ.data]);
  const active = useMemo(() => (slotsQ.data ?? []).filter((s) => s.status === 'active'), [slotsQ.data]);

  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleApprove(id: string) {
    setBusyId(id);
    try { await approve.mutateAsync(id); }
    catch (e) { window.alert((e as Error).message); }
    finally { setBusyId(null); }
  }

  async function handleReject(id: string) {
    setBusyId(id);
    try { await reject.mutateAsync(id); }
    catch (e) { window.alert((e as Error).message); }
    finally { setBusyId(null); }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Stamm-Slot wirklich kündigen? Zukunfts-Aufgüsse werden zu Personal-Fallback.')) return;
    setBusyId(id);
    try { await revoke.mutateAsync(id); }
    catch (e) { window.alert((e as Error).message); }
    finally { setBusyId(null); }
  }

  async function handleMaterialize() {
    try {
      const n = await materialize.mutateAsync(8);
      window.alert(`${n} neue Aufgüsse materialisiert.`);
    } catch (e) { window.alert((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-amber-700/30">
        <h2 className="flex items-center gap-2 text-base font-semibold text-amber-100">
          <span>📥</span>
          <span>Offene Stamm-Slot-Anträge ({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-xs text-forest-300/70">Keine offenen Anträge.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pending.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg bg-forest-900/60 px-3 py-2 ring-1 ring-forest-800/40">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-amber-100">
                    {memberName(s.member_id)} · {WEEKDAY_LABEL_DE_SHORT[s.weekday]} {String(s.slot_hour).padStart(2,'0')}:00 · {saunaName(s.sauna_id)}
                  </div>
                  <div className="text-[11px] text-forest-400 truncate">
                    Antrag: {format(new Date(s.created_at), 'dd.MM.yyyy HH:mm')}{s.note ? ` · "${s.note}"` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleApprove(s.id)} disabled={busyId === s.id}
                    className="rounded-md bg-emerald-500 hover:bg-emerald-400 px-3 py-1 text-xs font-bold text-emerald-950 disabled:opacity-50">
                    ✓ Freigeben
                  </button>
                  <button onClick={() => handleReject(s.id)} disabled={busyId === s.id}
                    className="rounded-md bg-rose-500/20 hover:bg-rose-500/30 px-3 py-1 text-xs text-rose-200 ring-1 ring-rose-500/30">
                    ✕ Ablehnen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50">
        <h2 className="flex items-center gap-2 text-base font-semibold text-forest-100">
          <span>🪵</span>
          <span>Aktive Stamm-Slots ({active.length})</span>
        </h2>
        {active.length === 0 ? (
          <p className="mt-2 text-xs text-forest-300/70">Noch keine aktiven Stamm-Slots.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {active.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg bg-forest-900/60 px-3 py-2 ring-1 ring-forest-800/40">
                <div className="min-w-0">
                  <div className="text-sm text-forest-100">
                    {WEEKDAY_LABEL_DE_SHORT[s.weekday]} {String(s.slot_hour).padStart(2,'0')}:00 · {saunaName(s.sauna_id)}
                  </div>
                  <div className="text-[11px] text-forest-400">{memberName(s.member_id)}</div>
                </div>
                <button onClick={() => handleRevoke(s.id)} disabled={busyId === s.id}
                  className="rounded-md px-2.5 py-1 text-[11px] text-rose-200 ring-1 ring-rose-500/30 hover:bg-rose-500/15">
                  Kündigen
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50">
        <h2 className="flex items-center gap-2 text-base font-semibold text-forest-100">
          <span>🏖️</span>
          <span>Urlaubskalender</span>
        </h2>
        {(absencesQ.data ?? []).length === 0 ? (
          <p className="mt-2 text-xs text-forest-300/70">Keine eingetragenen Abwesenheiten.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {(absencesQ.data ?? []).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg bg-forest-900/40 px-3 py-1.5 ring-1 ring-forest-800/40">
                <div className="text-sm text-forest-100">
                  {memberName(a.member_id)} · {format(new Date(a.start_date), 'dd.MM.yyyy')} – {format(new Date(a.end_date), 'dd.MM.yyyy')}
                  {a.note && <span className="ml-1.5 text-[11px] text-forest-400">„{a.note}"</span>}
                </div>
                <button onClick={() => { if (confirm('Urlaub löschen?')) deleteAbs.mutate(a.id); }}
                  className="rounded-md px-2 py-0.5 text-[10px] text-rose-200 ring-1 ring-rose-500/30 hover:bg-rose-500/15">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-violet-800/40">
        <h2 className="flex items-center gap-2 text-base font-semibold text-violet-100">
          <span>⚙️</span>
          <span>Materialisierung</span>
        </h2>
        <p className="mt-1 text-xs text-forest-300/70">
          Der nächtliche Cron (00:30 UTC) erzeugt rollend 8 Wochen Aufgüsse. Hier manuell auslösen, falls sofort gebraucht.
        </p>
        <button onClick={handleMaterialize} disabled={materialize.isPending}
          className="mt-3 rounded-lg bg-violet-500 hover:bg-violet-400 px-4 py-2 text-sm font-semibold text-violet-950 disabled:opacity-50">
          {materialize.isPending ? 'Materialisiere…' : 'Jetzt materialisieren'}
        </button>
      </section>
    </div>
  );
}
