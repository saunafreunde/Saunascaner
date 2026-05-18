import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useFeedComments, useCreateComment, useDeleteComment } from '@/lib/api';
import { Avatar } from '@/components/Avatar';

// Kommentar-Stack unter PostReactionBar. Default: kollabiert (zeigt nur Count
// + erste 2 Kommentare). „Alle anzeigen" expandiert.
// Input ist immer sichtbar wenn der User eingeloggt ist.

export function CommentThread({ postId }: { postId: string }) {
  const commentsQ = useFeedComments(postId);
  const create = useCreateComment();
  const del = useDeleteComment();
  const [body, setBody] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const comments = commentsQ.data ?? [];
  const visible = expanded || comments.length <= 2 ? comments : comments.slice(-2);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = body.trim();
    if (trimmed.length === 0) return;
    try {
      await create.mutateAsync({ postId, body: trimmed });
      setBody('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="border-t border-forest-800/40 px-3 pt-2 pb-3 space-y-2">
      {comments.length > 2 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-[11px] text-forest-400 hover:text-forest-200"
        >
          Alle {comments.length} Kommentare anzeigen
        </button>
      )}

      {visible.length > 0 && (
        <ul className="space-y-1.5">
          {visible.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-sm">
              <Link to={`/profile/${c.author_id}`} className="flex-shrink-0">
                <Avatar name={c.author_name} avatarPath={c.author_avatar} size="xs" />
              </Link>
              <div className="flex-1 min-w-0">
                <div className="leading-snug">
                  <Link to={`/profile/${c.author_id}`} className="text-forest-100 font-semibold hover:underline">
                    {c.author_name}
                  </Link>
                  <span className="ml-1.5 text-forest-200 break-words">{c.body}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-forest-500">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: de })}
                  </span>
                  {c.is_mine && (
                    <button
                      type="button"
                      onClick={() => del.mutate({ commentId: c.id, postId })}
                      disabled={del.isPending}
                      className="text-[10px] text-rose-300/70 hover:text-rose-200 disabled:opacity-40"
                    >
                      Löschen
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex gap-2 pt-1">
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 500))}
          placeholder="Kommentar schreiben…"
          className="flex-1 rounded-lg bg-forest-900/60 px-3 py-1.5 text-sm ring-1 ring-forest-800/50 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
          disabled={create.isPending}
        />
        <button
          type="submit"
          disabled={body.trim().length === 0 || create.isPending}
          className="rounded-lg bg-amber-500/80 px-3 py-1.5 text-sm font-bold text-forest-950 hover:bg-amber-400 disabled:opacity-40"
        >
          {create.isPending ? '…' : '➤'}
        </button>
      </form>
      {error && <div className="text-xs text-rose-300">{error}</div>}
    </div>
  );
}
