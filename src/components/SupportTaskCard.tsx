import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  useTaskHelpers, useLeaveSupportTask,
  SUPPORT_CATEGORY_META, type SupportTask,
} from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import { SupportTaskJoinModal } from './SupportTaskJoinModal';

interface Props {
  task: SupportTask;
}

// Eine einzelne Aufgaben-Karte. Zeigt Termin (falls), Kategorie, Helfer-Stand,
// Helfer-Avatare, Join/Leave-Button.
export function SupportTaskCard({ task }: Props) {
  const helpers = useTaskHelpers(task.id);
  const leave = useLeaveSupportTask();
  const [showJoinModal, setShowJoinModal] = useState(false);

  const cat = SUPPORT_CATEGORY_META[task.category];
  const isEvent = !!task.start_time;
  // Nur zugewiesene Helfer in der Avatare-Reihe zeigen
  const approvedHelpers = (helpers.data ?? []).filter((h) => !h.left_at && !h.rejected_at && h.approved_at);
  const visibleHelpers = approvedHelpers.slice(0, 5);
  const extraCount = Math.max(0, approvedHelpers.length - visibleHelpers.length);

  return (
    <article className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4 transition hover:ring-amber-500/30">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="text-3xl flex-shrink-0">{cat.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-forest-100">{task.title}</h3>
            <span className="rounded-full bg-forest-900/70 ring-1 ring-forest-800/40 px-2 py-0.5 text-[10px] text-forest-300">
              {cat.label}
            </span>
            {isEvent && (
              <span className="rounded-full bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40 px-2 py-0.5 text-[10px] font-semibold">
                🗓️ Termin
              </span>
            )}
          </div>
          {task.description && (
            <p className="mt-1.5 text-sm text-forest-200/90 whitespace-pre-wrap leading-relaxed">
              {task.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3 flex-wrap text-[11px] text-forest-400">
            {isEvent && task.start_time && (
              <span>
                📅 {new Date(task.start_time).toLocaleString('de-DE', {
                  weekday: 'short', day: '2-digit', month: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            )}
            {task.location && <span>📍 {task.location}</span>}
            <span>· vor {formatDistanceToNow(new Date(task.created_at), { locale: de })}</span>
          </div>
        </div>
      </div>

      {task.requires_approval && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40 px-2 py-0.5 text-[10px] font-semibold">
          🛡️ Freigabe durch Admin
        </div>
      )}

      {/* Helfer-Stand */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {visibleHelpers.map((h) => (
              <div key={h.member_id} className="ring-2 ring-forest-950 rounded-full" title={h.name}>
                <Avatar name={h.name} avatarPath={h.avatar_path} size="sm" isAufgieser={h.is_aufgieser} />
              </div>
            ))}
            {extraCount > 0 && (
              <div className="ring-2 ring-forest-950 rounded-full h-10 w-10 bg-forest-800 text-forest-200 text-xs flex items-center justify-center font-semibold">
                +{extraCount}
              </div>
            )}
          </div>
          <div className="text-xs text-forest-300">
            <span className="font-semibold text-forest-100 tabular-nums">{task.helper_count}</span>
            {task.max_helpers ? <span> von <span className="tabular-nums">{task.max_helpers}</span> Helfer</span> : <span> Helfer</span>}
            {task.pending_count > 0 && (
              <span className="ml-1 text-amber-400">· {task.pending_count} ⏳</span>
            )}
          </div>
        </div>

        {/* Join/Leave/Pending-Button */}
        {task.my_status === 'pending' ? (
          <button
            onClick={() => {
              if (window.confirm('Anfrage zurückziehen?')) leave.mutate(task.id);
            }}
            disabled={leave.isPending}
            className="rounded-xl bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-amber-500/30 disabled:opacity-50"
          >
            ⏳ Wartet auf Freigabe
          </button>
        ) : task.my_status === 'rejected' ? (
          <span className="rounded-xl bg-red-900/30 text-red-300 ring-1 ring-red-700/40 px-3 py-1.5 text-xs font-semibold">
            ✗ Abgelehnt
          </span>
        ) : task.is_helping_me ? (
          <button
            onClick={() => {
              if (window.confirm('Wirklich abmelden?')) leave.mutate(task.id);
            }}
            disabled={leave.isPending}
            className="rounded-xl bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/30 disabled:opacity-50"
          >
            ✓ Du hilfst
          </button>
        ) : task.is_full ? (
          <span className="rounded-xl bg-forest-900/70 text-forest-500 ring-1 ring-forest-700/40 px-3 py-1.5 text-xs font-semibold">
            🚫 Voll
          </span>
        ) : (
          <button
            onClick={() => setShowJoinModal(true)}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-amber-950 px-3 py-1.5 text-xs font-semibold hover:from-amber-400 hover:to-amber-500"
          >
            {task.requires_approval ? '🙋 Bewerben' : '🙋 Ich helfe mit!'}
          </button>
        )}
      </div>

      {showJoinModal && (
        <SupportTaskJoinModal
          task={task}
          onClose={() => setShowJoinModal(false)}
        />
      )}
    </article>
  );
}
