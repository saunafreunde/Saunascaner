import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { PageBackground } from '@/components/PageBackground';
import { useMyConversations } from '@/lib/api';
import { Avatar } from '@/components/Avatar';

// DM-Inbox: Liste aller Konversationen (sortiert nach last_message_at desc).
// Klick auf Eintrag öffnet /dm/:conversationId.
export default function Dm() {
  const convQ = useMyConversations();
  const list = convQ.data ?? [];

  return (
    <PageBackground page="planner" className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-forest-800/40 bg-forest-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center gap-3">
            <Link to="/feed" className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800">←</Link>
            <h1 className="text-sm sm:text-base font-semibold text-forest-100">✉️ Nachrichten</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-3 sm:px-6 py-4">
        {convQ.isLoading ? (
          <div className="text-center text-forest-400 text-sm py-12">Lade…</div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl bg-forest-950/60 ring-1 ring-forest-800/40 p-8 text-center">
            <div className="text-5xl mb-3">✉️</div>
            <h2 className="text-base font-semibold text-forest-100 mb-1">Noch keine Nachrichten</h2>
            <p className="text-sm text-forest-400">
              Schreib einem Mitglied vom Profil aus eine Nachricht (über das ✉️-Symbol).
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((c) => (
              <li key={c.conversation_id}>
                <Link to={`/dm/${c.conversation_id}`}
                  className={`flex items-center gap-3 rounded-2xl p-3 ring-1 transition ${
                    c.unread_count > 0
                      ? 'bg-amber-500/10 ring-amber-500/40 hover:bg-amber-500/20'
                      : 'bg-forest-900/60 ring-forest-800/50 hover:bg-forest-900/80'
                  }`}>
                  <Avatar name={c.other_name} avatarPath={c.other_avatar} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-semibold truncate ${c.unread_count > 0 ? 'text-amber-100' : 'text-forest-100'}`}>
                        {c.other_name}
                      </span>
                      {c.last_message_at && (
                        <span className="text-[10px] text-forest-500 whitespace-nowrap">
                          {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: de })}
                        </span>
                      )}
                    </div>
                    {c.last_body && (
                      <div className="text-xs text-forest-400 mt-0.5 truncate">{c.last_body}</div>
                    )}
                  </div>
                  {c.unread_count > 0 && (
                    <span className="min-w-[20px] h-5 rounded-full bg-amber-500 text-forest-950 text-[11px] font-bold leading-5 px-1.5 tabular-nums">
                      {c.unread_count > 9 ? '9+' : c.unread_count}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </PageBackground>
  );
}
