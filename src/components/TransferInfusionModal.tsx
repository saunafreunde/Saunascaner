import { useEffect, useMemo, useState } from 'react';
import { useMeisterDirectory, useTransferInfusion } from '@/lib/api';
import type { Infusion } from '@/types/database';
import { dayLabel } from '@/lib/time';
import { fmtClock } from '@/lib/time';

// Aufguss an anderen Aufgießer übergeben.
// Server-Side: 60-Min-Lock für Aufgießer (Admin jederzeit), Ziel muss
// is_aufgieser=true sein.

export function TransferInfusionModal({
  infusion,
  onClose,
  onTransferred,
}: {
  infusion: Infusion;
  onClose: () => void;
  onTransferred?: () => void;
}) {
  const dir = useMeisterDirectory();
  const transfer = useTransferInfusion();
  const [search, setSearch] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Nur Aufgießer als Empfänger (eigener Aufgießer ausgeschlossen)
  const candidates = useMemo(() => {
    const all = dir.data ?? [];
    const lower = search.trim().toLowerCase();
    return all
      .filter((m) => m.id !== infusion.saunameister_id)
      .filter((m) => !lower || m.name.toLowerCase().includes(lower))
      .slice(0, 50);
  }, [dir.data, search, infusion.saunameister_id]);

  async function submit() {
    if (!pickedId) return;
    setErrorMsg(null);
    try {
      await transfer.mutateAsync({ id: infusion.id, toMemberId: pickedId });
      onTransferred?.();
      onClose();
    } catch (e) {
      setErrorMsg((e as Error).message);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-forest-950 ring-1 ring-forest-700/60 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-forest-950/95 backdrop-blur z-10 px-5 py-4 border-b border-forest-800/40 flex items-center justify-between">
          <h2 className="text-lg font-bold text-forest-100">↗️ Aufguss übergeben</h2>
          <button onClick={onClose} className="rounded-full h-9 w-9 flex items-center justify-center text-forest-300 hover:bg-forest-800/60">✕</button>
        </header>

        <div className="p-5 space-y-4">
          {/* Aufguss-Info */}
          <div className="rounded-lg bg-forest-900/60 ring-1 ring-forest-700/40 px-3 py-2">
            <div className="text-sm font-semibold text-forest-100">{infusion.title}</div>
            <div className="text-xs text-forest-400 mt-0.5">
              {dayLabel(infusion.start_time)} · {fmtClock(infusion.start_time)} Uhr
            </div>
          </div>

          {/* Suche */}
          <div>
            <label className="text-xs font-semibold text-forest-300 uppercase tracking-wider">Aufgießer suchen</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={'Name eingeben…'}
              className="mt-1 w-full rounded-lg bg-forest-900/60 ring-1 ring-forest-700/50 px-3 py-2 text-sm text-forest-100 placeholder-forest-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
              autoFocus
            />
          </div>

          {/* Kandidaten-Liste */}
          <div className="max-h-72 overflow-y-auto rounded-lg ring-1 ring-forest-800/40">
            {dir.isLoading ? (
              <div className="py-6 text-center text-sm text-forest-400">Lade…</div>
            ) : candidates.length === 0 ? (
              <div className="py-6 text-center text-sm text-forest-400">Keine Aufgießer gefunden.</div>
            ) : (
              <ul className="divide-y divide-forest-800/30">
                {candidates.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setPickedId(m.id)}
                      className={`w-full text-left px-3 py-2.5 transition flex items-center justify-between gap-2 ${
                        pickedId === m.id
                          ? 'bg-amber-500/20 ring-1 ring-amber-400/60'
                          : 'hover:bg-forest-900/60'
                      }`}
                    >
                      <span className="text-sm font-medium text-forest-100">{m.name}</span>
                      {pickedId === m.id && <span className="text-amber-300 text-lg">✓</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {errorMsg && (
            <div className="rounded-lg bg-rose-950/60 ring-1 ring-rose-800/40 px-3 py-2 text-sm text-rose-300">
              {errorMsg}
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 bg-forest-950/95 backdrop-blur z-10 px-5 py-4 border-t border-forest-800/40 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-forest-900/70 ring-1 ring-forest-700/50 px-4 py-2.5 text-sm text-forest-200 hover:bg-forest-800"
          >
            Abbrechen
          </button>
          <button
            onClick={submit}
            disabled={!pickedId || transfer.isPending}
            className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-400 active:scale-95 transition disabled:opacity-50"
          >
            {transfer.isPending ? 'Übergebe…' : '↗️ Übergeben'}
          </button>
        </footer>
      </div>
    </div>
  );
}
