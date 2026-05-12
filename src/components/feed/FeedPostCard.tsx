import { Link } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  type FeedPost,
  publicAssetUrl,
  useCurrentMember,
  useDeleteMyFeedPost,
} from '@/lib/api';
// publicAssetUrl wird über post.image_path benötigt
import { OIL_BY_ID } from '@/lib/oils';
import { isAdmin } from '@/lib/roles';
import { Avatar } from '@/components/Avatar';
import { PostReactionBar } from './PostReactionBar';

type Props = {
  post: FeedPost;
  onPickOil?: (oilId: string) => void;
  onPickInfusion?: (infusionId: string) => void;
  onAdminDelete?: (postId: string) => void;
};

const ROLE_BADGE: Record<string, { emoji: string; label: string }> = {
  admin:           { emoji: '⚙️',   label: 'Admin' },
  staff:           { emoji: '👨‍🍳', label: 'Personal' },
  aufgieser:       { emoji: '🧖',   label: 'Aufgießer' },
  guest_aufgieser: { emoji: '🌍',   label: 'Gast-Aufgießer' },
  member:          { emoji: '🤝',   label: 'Mitglied' },
  gast:            { emoji: '👋',   label: 'Gast' },
};

export function FeedPostCard({ post, onPickOil, onPickInfusion, onAdminDelete }: Props) {
  const me = useCurrentMember();
  const delMine = useDeleteMyFeedPost();

  const imageUrl = publicAssetUrl(post.image_path);
  const isMine = me.data?.id === post.author_id;
  const meIsAdmin = isAdmin(me.data);
  const roleMeta = ROLE_BADGE[post.author_role] ?? { emoji: '·', label: post.author_role };

  async function onDelete() {
    if (!confirm('Beitrag wirklich löschen?')) return;
    await delMine.mutateAsync({ postId: post.id });
  }

  return (
    <article className="rounded-2xl bg-forest-950/70 ring-1 ring-forest-800/50 overflow-hidden backdrop-blur shadow-lg shadow-black/20">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Link to={`/profile/${post.author_id}`} className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition">
          <Avatar name={post.author_name} avatarPath={post.author_avatar} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-semibold text-forest-100 truncate">{post.author_name}</span>
              <span title={roleMeta.label} className="text-[11px] flex-shrink-0">{roleMeta.emoji}</span>
            </div>
            <div className="text-[10px] text-forest-400">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: de })}
            </div>
          </div>
        </Link>
        {(isMine || meIsAdmin) && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {isMine && (
              <button
                onClick={onDelete}
                disabled={delMine.isPending}
                title="Eigenen Beitrag löschen"
                className="text-rose-300/80 hover:text-rose-200 px-1.5 py-1 rounded text-sm transition disabled:opacity-50"
              >🗑️</button>
            )}
            {meIsAdmin && !isMine && onAdminDelete && (
              <button
                onClick={() => onAdminDelete(post.id)}
                title="Moderieren — Beitrag entfernen"
                className="text-amber-300/80 hover:text-amber-200 px-1.5 py-1 rounded text-sm transition"
              >🛡️</button>
            )}
          </div>
        )}
      </div>

      {/* Bild */}
      {imageUrl && (
        <div className="aspect-square bg-black/40">
          <img src={imageUrl} alt={post.caption ?? ''} className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}

      {/* Aufguss-Anker + Aroma-Chips */}
      {(post.infusion_id || post.oils.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2.5">
          {post.infusion_id && post.infusion_start_time && (
            <button
              type="button"
              onClick={() => onPickInfusion?.(post.infusion_id!)}
              className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 ring-1 ring-amber-500/40 px-2 py-0.5 text-[10px] text-amber-200 hover:bg-amber-500/25 transition"
              title="Nach diesem Aufguss filtern"
            >
              🧖 {format(new Date(post.infusion_start_time), 'HH:mm')}
              {post.infusion_aufgieser_name && ` · ${post.infusion_aufgieser_name}`}
              {post.infusion_title && ` · ${post.infusion_title}`}
            </button>
          )}
          {post.oils.map((oilId) => {
            const oil = OIL_BY_ID[oilId];
            if (!oil) return null;
            return (
              <button
                key={oilId}
                type="button"
                onClick={() => onPickOil?.(oilId)}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-900/50 ring-1 ring-emerald-700/40 px-2 py-0.5 text-[10px] text-emerald-200 hover:bg-emerald-800/70 transition"
                title={`Nach ${oil.name} filtern`}
              >
                <span className="rounded bg-emerald-950/70 px-1 text-[9px] tabular-nums">#{oil.number}</span>
                <span>{oil.emoji}</span>
                <span>{oil.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <p className="px-3 pt-2 text-sm text-forest-100 whitespace-pre-wrap break-words">{post.caption}</p>
      )}

      {/* Reactions */}
      <div className="px-3 pt-3 pb-3">
        <PostReactionBar
          postId={post.id}
          counts={post.reaction_counts}
          myReactions={post.my_reactions}
        />
      </div>
    </article>
  );
}
