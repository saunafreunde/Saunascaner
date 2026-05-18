import { useState, useRef, useEffect } from 'react';
import { useUnreadNotificationsCount } from '@/lib/api';
import { NotificationInbox } from './NotificationInbox';

// Bell-Icon im Feed-Header. Zeigt Badge mit Unread-Count.
// Klick öffnet Popover/Drawer mit den letzten 30 Notifications.

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const unreadQ = useUnreadNotificationsCount();
  const unread = unreadQ.data ?? 0;
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Schließen bei Klick außerhalb
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Benachrichtigungen (${unread} neu)` : 'Benachrichtigungen'}
        className="relative h-9 w-9 flex items-center justify-center rounded-lg bg-forest-900/60 text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-800 transition"
      >
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-amber-500 text-forest-950 text-[10px] font-bold leading-[18px] px-1 ring-2 ring-forest-950 tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-1.5rem))] max-w-[360px]">
          <NotificationInbox onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
