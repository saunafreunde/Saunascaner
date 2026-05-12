import { useState } from 'react';
import { format } from 'date-fns';
import { useDismissFeedEcho } from '@/lib/api';
import { FeedComposeModal } from './FeedComposeModal';

type Props = {
  infusionId: string;
  infusionTitle: string;
  infusionAufgieser: string | null;
  infusionStartTime: string;
  onClose: () => void;
};

// Erscheint einmalig nach erfolgreichem Aufguss-Rating und schlägt einen
// Feed-Post mit vorbefülltem Aufguss-Anker vor.
export function EchoPromptModal({
  infusionId, infusionTitle, infusionAufgieser, infusionStartTime, onClose,
}: Props) {
  const dismiss = useDismissFeedEcho();
  const [composeOpen, setComposeOpen] = useState(false);

  async function later() {
    try { await dismiss.mutateAsync({ infusionId }); } catch { /* egal */ }
    onClose();
  }

  if (composeOpen) {
    return (
      <FeedComposeModal
        defaultInfusionId={infusionId}
        onClose={() => { setComposeOpen(false); onClose(); }}
        onPosted={async () => {
          try { await dismiss.mutateAsync({ infusionId }); } catch { /* egal */ }
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-forest-950 ring-1 ring-amber-500/40 p-5 text-center shadow-2xl shadow-amber-900/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl mb-2">📸</div>
        <h2 className="text-base font-semibold text-forest-100 mb-1">Teile deinen Eindruck!</h2>
        <p className="text-xs text-forest-400 mb-4">
          Dein Foto erscheint im Feed und unter dem Aufguss
        </p>

        <div className="rounded-xl bg-amber-500/15 ring-1 ring-amber-500/30 px-3 py-2 text-left mb-4">
          <div className="text-sm font-semibold text-amber-100 truncate">🧖 {infusionTitle}</div>
          <div className="text-[10px] text-amber-200/70 tabular-nums">
            {format(new Date(infusionStartTime), 'EEE dd.MM. · HH:mm')}
            {infusionAufgieser && ` · ${infusionAufgieser}`}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={later}
            className="flex-1 rounded-xl bg-forest-900/70 px-4 py-2.5 text-sm font-medium text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900 transition"
          >Später</button>
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-400 transition"
          >📸 Foto teilen</button>
        </div>
      </div>
    </div>
  );
}
