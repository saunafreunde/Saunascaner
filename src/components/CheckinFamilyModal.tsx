import { useState } from 'react';
import { useSetMyPresentFamily } from '@/lib/api';

// Wird gezeigt nach erfolgreichem Check-in (PIN- oder Self-Toggle), wenn das
// Mitglied family_has_partner ODER family_children_count > 0 hat. Überspringen
// = niemand mit dabei (Defaults sind bereits 0/false). „Bestätigen" speichert
// die Auswahl in members.present_with_partner / present_children_count.

export function CheckinFamilyModal({
  open,
  memberName,
  familyHasPartner,
  familyChildrenCount,
  onClose,
}: {
  open: boolean;
  memberName: string;
  familyHasPartner: boolean;
  familyChildrenCount: number;
  onClose: () => void;
}) {
  const [withPartner, setWithPartner] = useState(false);
  const [childrenCount, setChildrenCount] = useState(0);
  const save = useSetMyPresentFamily();
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  async function confirm() {
    setErr(null);
    try {
      await save.mutateAsync({ with_partner: withPartner, children_count: childrenCount });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function skipAlone() {
    setErr(null);
    try {
      // Explizit auf 0 setzen (Defaults sollten schon stimmen, aber sicher ist sicher)
      await save.mutateAsync({ with_partner: false, children_count: 0 });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-forest-950/95 ring-1 ring-forest-700/60 shadow-2xl shadow-black/60 p-5">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">👨‍👩‍👧</div>
          <h2 className="text-lg font-bold text-forest-100">Willkommen, {memberName}!</h2>
          <p className="mt-1 text-sm text-forest-300">Wer ist heute mit dabei?</p>
        </div>

        <div className="space-y-3">
          {familyHasPartner && (
            <label className="flex items-center gap-3 rounded-xl bg-forest-900/70 p-3 ring-1 ring-forest-800/50 cursor-pointer hover:bg-forest-900">
              <input
                type="checkbox"
                checked={withPartner}
                onChange={(e) => setWithPartner(e.target.checked)}
                className="h-5 w-5 accent-amber-500"
              />
              <div className="flex-1">
                <div className="text-sm font-semibold text-forest-100">Partner / Partnerin dabei</div>
              </div>
              <span className="text-2xl">👫</span>
            </label>
          )}

          {familyChildrenCount > 0 && (
            <div className="rounded-xl bg-forest-900/70 p-3 ring-1 ring-forest-800/50">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">👶</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-forest-100">Kinder dabei</div>
                  <div className="text-[11px] text-forest-400">angemeldet: {familyChildrenCount}</div>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {Array.from({ length: familyChildrenCount + 1 }).map((_, n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setChildrenCount(n)}
                    className={`rounded-lg py-2 text-sm font-bold transition ${
                      childrenCount === n
                        ? 'bg-amber-500 text-forest-950'
                        : 'bg-forest-800/80 text-forest-200 hover:bg-forest-700'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {err && <div className="text-xs text-rose-300 text-center">{err}</div>}

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={skipAlone}
              disabled={save.isPending}
              className="flex-1 rounded-xl bg-forest-900/70 px-3 py-3 text-sm font-semibold text-forest-300 ring-1 ring-forest-700/50 hover:bg-forest-900 disabled:opacity-50"
            >
              Allein da
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={save.isPending}
              className="flex-1 rounded-xl bg-amber-500/90 px-3 py-3 text-sm font-bold text-forest-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {save.isPending ? 'Speichere…' : '✓ Bestätigen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
