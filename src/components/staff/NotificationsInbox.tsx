import { useMyPendingNotifications, useMarkNotificationSeen } from '@/lib/api';

// App-Inbox für ungelesene Notifications.
// Wird oben im /mitarbeiter und /cp eingeblendet, wenn pending Items da sind.
export function NotificationsInbox() {
  const list = useMyPendingNotifications();
  const mark = useMarkNotificationSeen();

  // Nur ungelesene zeigen (created_at < 7 Tage ist Filter im RPC, aber wir zeigen
  // nur die mit kind, die für Mitarbeiter relevant sind)
  const pending = (list.data ?? []).filter(
    (n) => n.kind && (n.payload?.title || n.payload?.body)
  );

  if (pending.length === 0) return null;

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-amber-500/40 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-400/90">
          🔔 Neu für dich
        </h2>
        <span className="text-[10px] text-forest-400">{pending.length}</span>
      </div>

      <ul className="space-y-1.5">
        {pending.slice(0, 5).map((n) => (
          <li
            key={n.id}
            className="rounded-lg bg-forest-900/60 ring-1 ring-amber-500/20 px-3 py-2 flex items-start gap-2"
          >
            <div className="flex-1 min-w-0">
              {n.payload?.title && (
                <div className="text-xs font-semibold text-amber-100">{String(n.payload.title)}</div>
              )}
              {n.payload?.body && (
                <div className="text-[11px] text-forest-300 leading-snug mt-0.5">
                  {String(n.payload.body)}
                </div>
              )}
              <div className="text-[10px] text-forest-500 mt-0.5">
                {new Date(n.created_at).toLocaleString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            <button
              onClick={() => mark.mutate(n.id)}
              className="rounded text-[10px] text-forest-400 hover:text-amber-300 px-1.5 py-0.5"
              title="Als gelesen markieren"
            >
              ✓
            </button>
          </li>
        ))}
      </ul>
      {pending.length > 5 && (
        <div className="text-[10px] text-forest-500 text-center mt-2">
          + {pending.length - 5} weitere — älteste werden nach 7 Tagen automatisch entfernt
        </div>
      )}
    </section>
  );
}
