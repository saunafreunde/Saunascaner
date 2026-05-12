import { useState } from 'react';
import { useJoinSupportTask, type SupportTask } from '@/lib/api';

interface Props {
  task: SupportTask;
  onClose: () => void;
}

export function SupportTaskJoinModal({ task, onClose }: Props) {
  const join = useJoinSupportTask();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await join.mutateAsync({ taskId: task.id, note: note.trim() || undefined });
      onClose();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('task_full')) setError('Diese Aufgabe ist bereits voll besetzt.');
      else if (msg.includes('task_archived')) setError('Diese Aufgabe wurde bereits abgeschlossen.');
      else setError(msg);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="max-w-md w-full rounded-3xl bg-forest-950 ring-1 ring-amber-500/40 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-5 border-b border-forest-800/40">
          <h2 className="text-lg font-semibold text-forest-100">Ich helfe mit!</h2>
          <p className="mt-1 text-xs text-forest-400">{task.title}</p>
        </header>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-forest-300 mb-1">
              Nachricht <span className="text-forest-500 font-normal">(optional, max 300 Zeichen)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={'z.B. „Bringe Kuchen mit" oder „Komme später dazu"'}
              rows={3}
              maxLength={300}
              className="w-full rounded-xl bg-forest-900/70 ring-1 ring-forest-700/60 px-3 py-2 text-sm text-forest-100 placeholder-forest-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/60"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/40 ring-1 ring-red-700/50 px-3 py-2 text-sm text-red-200">{error}</div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={join.isPending}
              className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
            >
              {join.isPending ? 'Anmelden…' : '🙋 Anmelden'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-forest-900/70 px-4 py-2.5 text-sm text-forest-300 ring-1 ring-forest-700/50"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
