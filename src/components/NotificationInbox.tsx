import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  useMyNotifications, useMarkNotificationRead, useMarkAllNotificationsRead,
  type InboxNotification,
} from '@/lib/api';

// Drawer-Inhalt mit den letzten 30 Notifications. Ungelesen highlightet.
// Klick → mark_notification_read + Navigation falls payload Ziel hat.

const KIND_EMOJI: Record<string, string> = {
  new_follower:           '🌟',
  game_your_turn:         '♟️',
  game_challenge:         '🎮',
  post_commented:         '💬',
  dm_received:            '✉️',
  aufguss_announced:      '🧖',
  shift_cancelled_broadcast: '⚠️',
  shared_email_inbound:   '📧',
  rating_reminder:        '⭐',
};

export function NotificationInbox({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const listQ = useMyNotifications(30);
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = listQ.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  function targetFor(n: InboxNotification): string | null {
    const p = n.payload as Record<string, unknown>;
    if (n.kind === 'new_follower' && typeof p.follower_id === 'string') return `/profile/${p.follower_id}`;
    if (n.kind === 'game_your_turn' && typeof p.match_id === 'string') return `/spiele/match/${p.match_id}`;
    if (n.kind === 'game_challenge' && typeof p.match_id === 'string') return `/spiele/match/${p.match_id}`;
    if (n.kind === 'post_commented' && typeof p.post_id === 'string') return `/feed`;
    if (n.kind === 'dm_received' && typeof p.conversation_id === 'string') return `/dm/${p.conversation_id}`;
    if (n.kind === 'shared_email_inbound') return `/postfach?view=shared`;
    if (n.kind === 'rating_reminder') return `/bewerten`;
    return null;
  }

  async function handleClick(n: InboxNotification) {
    if (!n.read_at) {
      try { await markOne.mutateAsync(n.id); } catch { /* nicht kritisch */ }
    }
    const t = targetFor(n);
    onClose();
    if (t) nav(t);
  }

  return (
    <div className="rounded-2xl bg-forest-950/95 ring-1 ring-forest-700/60 shadow-2xl shadow-black/60 backdrop-blur-xl overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-forest-800/50">
        <h2 className="text-sm font-bold text-forest-100">🔔 Benachrichtigungen</h2>
        {unread > 0 && (
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="text-[11px] text-amber-300 hover:text-amber-200 underline disabled:opacity-50"
          >
            Alle gelesen
          </button>
        )}
      </header>

      <div className="max-h-[60vh] overflow-y-auto">
        {listQ.isLoading ? (
          <div className="py-8 text-center text-forest-400 text-sm">Lade…</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-3xl mb-2">📭</div>
            <p className="text-sm text-forest-400">Noch keine Benachrichtigungen.</p>
          </div>
        ) : (
          <ul className="divide-y divide-forest-800/50">
            {items.map((n) => {
              const p = n.payload as { title?: string; body?: string };
              const isUnread = !n.read_at;
              const emoji = KIND_EMOJI[n.kind] ?? '•';
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-forest-900/60 transition flex items-start gap-3 ${
                      isUnread ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <span className="text-xl leading-none flex-shrink-0 mt-0.5">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-sm truncate ${isUnread ? 'text-forest-100 font-semibold' : 'text-forest-300'}`}>
                          {p.title ?? n.kind}
                        </span>
                        {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
                      </div>
                      {p.body && (
                        <div className="text-xs text-forest-400 mt-0.5 line-clamp-2">{p.body}</div>
                      )}
                      <div className="text-[10px] text-forest-500 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: de })}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
