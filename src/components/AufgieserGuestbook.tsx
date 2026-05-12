import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  useAufgieserComments, usePostAufgieserComment, useDeleteAufgieserComment,
  useToggleCommentLike, useCurrentMember,
  type AufgieserComment,
} from '@/lib/api';
import { Avatar } from '@/components/Avatar';

interface Props {
  aufgieserId: string;
}

// Gästebuch — öffentliche Kommentare unter Aufgießer-Profilen.
// Threading 1 Ebene tief (Aufgießer kann antworten).
export function AufgieserGuestbook({ aufgieserId }: Props) {
  const comments = useAufgieserComments(aufgieserId);
  const post = usePostAufgieserComment();
  const me = useCurrentMember();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isMyOwnProfile = me.data?.id === aufgieserId;
  const list = comments.data ?? [];

  // Threading: Top-Level + Replies
  const { topLevel, repliesByParent } = useMemo(() => {
    const tops: AufgieserComment[] = [];
    const replies: Record<string, AufgieserComment[]> = {};
    for (const c of list) {
      if (c.parent_id) {
        (replies[c.parent_id] ||= []).push(c);
      } else {
        tops.push(c);
      }
    }
    // Replies aufsteigend (älteste zuerst)
    for (const k of Object.keys(replies)) {
      replies[k].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    }
    return { topLevel: tops, repliesByParent: replies };
  }, [list]);

  async function submit(parentId?: string | null) {
    setError(null);
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    if (trimmed.length > 1000) {
      setError('Maximal 1000 Zeichen.');
      return;
    }
    try {
      await post.mutateAsync({ aufgieserId, content: trimmed, parentId: parentId ?? null });
      setText('');
      setReplyTo(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4">
      <div className="flex items-end justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400/90">
          💬 Gästebuch
        </h3>
        <span className="text-[10px] text-forest-400 tabular-nums">
          {topLevel.length} Eintrag{topLevel.length === 1 ? '' : 'e'}
        </span>
      </div>

      {/* Composer (nur eigene Profil-Top: Aufgießer kann nicht selbst auf sich kommentieren) */}
      {!isMyOwnProfile && me.data && replyTo === null && (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(null); }}
          className="mb-4 flex gap-2"
        >
          <Avatar name={me.data.name} avatarPath={me.data.avatar_path} size="sm" />
          <div className="flex-1 flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Hinterlasse einen Eintrag…"
              rows={2}
              maxLength={1000}
              className="flex-1 rounded-xl bg-forest-900/70 ring-1 ring-forest-700/60 px-3 py-2 text-sm text-forest-100 placeholder-forest-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/60"
            />
            <button
              type="submit"
              disabled={post.isPending || text.trim().length === 0}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
            >
              {post.isPending ? '…' : 'Senden'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="mb-3 rounded-lg bg-red-900/40 ring-1 ring-red-700/50 px-3 py-2 text-xs text-red-200">{error}</div>
      )}

      {topLevel.length === 0 ? (
        <p className="text-center text-sm text-forest-400/80 py-6">
          Noch keine Einträge. {!isMyOwnProfile && 'Sei der Erste!'}
        </p>
      ) : (
        <ul className="space-y-3">
          {topLevel.map((c) => (
            <li key={c.id}>
              <CommentItem
                comment={c}
                aufgieserId={aufgieserId}
                canReply={isMyOwnProfile || me.data?.id === c.author_id}
                onReplyClick={() => setReplyTo(c.id)}
              />
              {/* Replies */}
              {repliesByParent[c.id]?.length > 0 && (
                <ul className="mt-2 ml-10 space-y-2 pl-3 border-l-2 border-forest-800/40">
                  {repliesByParent[c.id].map((r) => (
                    <li key={r.id}>
                      <CommentItem comment={r} aufgieserId={aufgieserId} canReply={false} />
                    </li>
                  ))}
                </ul>
              )}
              {/* Reply-Composer */}
              {replyTo === c.id && me.data && (
                <form
                  onSubmit={(e) => { e.preventDefault(); submit(c.id); }}
                  className="mt-2 ml-10 flex gap-2"
                >
                  <Avatar name={me.data.name} avatarPath={me.data.avatar_path} size="sm" />
                  <div className="flex-1 flex gap-2">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={`Antwort auf ${c.author_name}…`}
                      rows={2}
                      maxLength={1000}
                      autoFocus
                      className="flex-1 rounded-xl bg-forest-900/70 ring-1 ring-forest-700/60 px-3 py-2 text-sm text-forest-100 placeholder-forest-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                    />
                    <div className="flex flex-col gap-1">
                      <button
                        type="submit"
                        disabled={post.isPending || text.trim().length === 0}
                        className="rounded-xl bg-amber-500 px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-50"
                      >
                        Senden
                      </button>
                      <button
                        type="button"
                        onClick={() => { setReplyTo(null); setText(''); }}
                        className="rounded-xl bg-forest-900 px-3 py-1 text-xs text-forest-300 ring-1 ring-forest-700/50"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CommentItem({ comment, aufgieserId, canReply, onReplyClick }: {
  comment: AufgieserComment;
  aufgieserId: string;
  canReply?: boolean;
  onReplyClick?: () => void;
}) {
  const del = useDeleteAufgieserComment();
  const like = useToggleCommentLike();

  return (
    <div className="flex gap-2.5">
      <Avatar
        name={comment.author_name}
        avatarPath={comment.author_avatar}
        size="sm"
        isAufgieser={comment.author_is_aufgieser}
      />
      <div className="flex-1 min-w-0">
        <div className="rounded-xl bg-forest-900/60 ring-1 ring-forest-800/40 px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-semibold text-forest-100">{comment.author_name}</span>
            {comment.author_is_aufgieser && <span className="text-[10px] text-amber-400">🧖 Aufgießer</span>}
            <span className="text-[10px] text-forest-500">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: de })}
            </span>
            {comment.edited_at && <span className="text-[10px] text-forest-500 italic">bearbeitet</span>}
          </div>
          <p className="text-sm text-forest-200/95 whitespace-pre-wrap break-words">{comment.content}</p>
        </div>
        <div className="mt-1 flex items-center gap-3 ml-3">
          <button
            onClick={() => like.mutate({ commentId: comment.id, aufgieserId, currentlyLiked: comment.liked_by_me })}
            disabled={like.isPending}
            className={`text-[11px] flex items-center gap-1 transition ${
              comment.liked_by_me ? 'text-red-300' : 'text-forest-400 hover:text-red-300'
            }`}
            title={comment.liked_by_me ? 'Like zurücknehmen' : 'Like'}
          >
            <span>{comment.liked_by_me ? '❤️' : '🤍'}</span>
            {comment.like_count > 0 && <span className="tabular-nums">{comment.like_count}</span>}
          </button>
          {canReply && onReplyClick && (
            <button
              onClick={onReplyClick}
              className="text-[11px] text-forest-400 hover:text-amber-300 transition"
            >
              Antworten
            </button>
          )}
          {comment.can_delete && (
            <button
              onClick={async () => {
                if (!window.confirm('Eintrag löschen?')) return;
                await del.mutateAsync({ id: comment.id, aufgieserId });
              }}
              className="text-[11px] text-forest-500 hover:text-red-300 transition"
            >
              Löschen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
