import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAdminFeed, useAdminDeleteFeedPost, publicAssetUrl } from '@/lib/api';
import { OIL_BY_ID } from '@/lib/oils';

export function FeedModerationTab() {
  const [showDeleted, setShowDeleted] = useState(false);
  const q = useAdminFeed(showDeleted);
  const del = useAdminDeleteFeedPost();

  async function onDelete(postId: string) {
    if (!confirm('Beitrag entfernen? (Soft-Delete, kann bei Bedarf wieder sichtbar gemacht werden)')) return;
    await del.mutateAsync({ postId });
  }

  const posts = q.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-forest-100 flex items-center gap-2">
          📸 Feed-Moderation
          <span className="text-xs font-normal text-forest-400">({posts.length})</span>
        </h2>
        <label className="flex items-center gap-2 text-xs text-forest-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
            className="rounded"
          />
          Gelöschte zeigen
        </label>
      </div>

      {q.isLoading && <div className="text-sm text-forest-400 text-center py-6">Lade …</div>}

      {posts.length === 0 && !q.isLoading && (
        <div className="rounded-lg bg-forest-900/40 ring-1 ring-forest-800/40 p-6 text-center text-forest-400 text-sm">
          Keine Beiträge.
        </div>
      )}

      <ul className="space-y-2">
        {posts.map((p) => {
          const url = publicAssetUrl(p.image_path);
          const isDeleted = !!p.deleted_at;
          return (
            <li
              key={p.id}
              className={`rounded-xl ring-1 p-3 flex gap-3 ${
                isDeleted
                  ? 'bg-rose-950/30 ring-rose-800/40 opacity-60'
                  : 'bg-forest-950/50 ring-forest-800/40'
              }`}
            >
              {url && (
                <img src={url} alt="" className="h-20 w-20 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <Link to={`/profile/${p.author_id}`} className="text-sm font-semibold text-forest-100 hover:underline truncate">
                    {p.author_name}
                  </Link>
                  <span className="text-[10px] text-forest-500 tabular-nums flex-shrink-0">
                    {formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: de })}
                  </span>
                </div>
                {p.caption && (
                  <p className="text-xs text-forest-300 line-clamp-2 mb-1">{p.caption}</p>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.reaction_total > 0 && (
                    <span className="text-[10px] text-amber-300/70">{p.reaction_total} Reactions</span>
                  )}
                  {p.oils.slice(0, 3).map((oilId) => {
                    const o = OIL_BY_ID[oilId];
                    if (!o) return null;
                    return (
                      <span key={oilId} className="text-[10px] text-emerald-300/80">
                        {o.emoji} {o.name}
                      </span>
                    );
                  })}
                  {p.infusion_id && (
                    <span className="text-[10px] text-amber-200/80">🧖 Aufguss</span>
                  )}
                  {isDeleted && (
                    <span className="text-[10px] text-rose-400 font-semibold">GELÖSCHT</span>
                  )}
                </div>
              </div>
              {!isDeleted && (
                <button
                  onClick={() => onDelete(p.id)}
                  disabled={del.isPending}
                  className="self-start rounded-lg bg-rose-900/40 ring-1 ring-rose-700/50 px-2 py-1 text-xs text-rose-200 hover:bg-rose-900/60 transition disabled:opacity-50"
                  title="Beitrag entfernen"
                >🗑️</button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
