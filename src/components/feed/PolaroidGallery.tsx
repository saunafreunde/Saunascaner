import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useMemberFeedPosts, publicAssetUrl, type MemberFeedPost } from '@/lib/api';
import { OIL_BY_ID } from '@/lib/oils';

type Props = {
  memberId: string;
  limit?: number;
};

// Holz-Box-Polaroid-Galerie: bis 6 leicht rotierte Polaroids, Klick → Flip
export function PolaroidGallery({ memberId, limit = 6 }: Props) {
  const q = useMemberFeedPosts(memberId, limit);
  const [openId, setOpenId] = useState<string | null>(null);

  const posts = q.data ?? [];
  if (q.isLoading) {
    return (
      <div className="rounded-2xl bg-amber-950/30 ring-1 ring-amber-900/40 p-6 text-center text-amber-200/60 text-sm">
        Lade Polaroids …
      </div>
    );
  }
  if (posts.length === 0) {
    return (
      <div className="rounded-2xl bg-amber-950/20 ring-1 ring-amber-900/30 p-6 text-center text-amber-200/40 text-sm">
        📷 Noch keine Beiträge
      </div>
    );
  }

  // Vorab generierte leicht zufällige Rotation pro Index (deterministisch)
  const rotations = [-5, 3, -2, 6, -4, 2];

  const open = posts.find((p) => p.id === openId) ?? null;

  return (
    <>
      <div className="relative rounded-2xl bg-gradient-to-br from-amber-950/70 via-stone-900/60 to-amber-950/80 ring-1 ring-amber-900/40 p-6 shadow-inner shadow-black/40 overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(120,80,40,0.3) 0 2px, transparent 2px 28px)' }} />
        <div className="relative grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {posts.slice(0, limit).map((p, idx) => (
            <PolaroidThumb
              key={p.id}
              post={p}
              rotation={rotations[idx % rotations.length] ?? 0}
              onOpen={() => setOpenId(p.id)}
            />
          ))}
        </div>
        <div className="relative mt-4 text-center">
          <Link
            to={`/feed`}
            className="text-[11px] text-amber-200/80 hover:text-amber-100 underline"
          >Alle Beiträge im Feed →</Link>
        </div>
      </div>

      {open && (
        <PolaroidLightbox post={open} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}

function PolaroidThumb({ post, rotation, onOpen }: { post: MemberFeedPost; rotation: number; onOpen: () => void }) {
  const url = publicAssetUrl(post.image_path);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block bg-white p-1.5 pb-5 rounded-sm shadow-lg shadow-black/40 hover:scale-105 transition-transform"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <div className="aspect-square bg-stone-200 overflow-hidden">
        {url && <img src={url} alt={post.caption ?? ''} className="w-full h-full object-cover" loading="lazy" />}
      </div>
      <div className="px-1 pt-1.5 text-[8px] text-stone-600 font-mono truncate text-center">
        {format(new Date(post.created_at), 'dd.MM.yyyy')}
      </div>
    </button>
  );
}

function PolaroidLightbox({ post, onClose }: { post: MemberFeedPost; onClose: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const url = publicAssetUrl(post.image_path);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-md"
        style={{ perspective: '1200px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          onClick={() => setFlipped((f) => !f)}
          className="relative w-full transition-transform duration-700 cursor-pointer"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Vorderseite */}
          <div className="bg-white p-3 pb-8 rounded-sm shadow-2xl shadow-black/60" style={{ backfaceVisibility: 'hidden' }}>
            <div className="aspect-square bg-stone-200 overflow-hidden">
              {url && <img src={url} alt={post.caption ?? ''} className="w-full h-full object-cover" />}
            </div>
            <div className="px-2 pt-2 text-xs text-stone-600 font-mono text-center">
              {format(new Date(post.created_at), 'dd.MM.yyyy')}
              {post.reaction_total > 0 && <span className="ml-2 text-amber-700">· {post.reaction_total} Reactions</span>}
            </div>
          </div>
          {/* Rückseite */}
          <div
            className="absolute inset-0 bg-amber-50 p-4 rounded-sm shadow-2xl shadow-black/60 flex flex-col"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="text-[10px] uppercase tracking-wider text-stone-500 font-bold mb-2">{format(new Date(post.created_at), 'EEE dd.MM.yyyy')}</div>
            <p className="text-sm text-stone-800 whitespace-pre-wrap flex-1 overflow-auto">
              {post.caption || <span className="text-stone-400 italic">Keine Caption</span>}
            </p>
            {post.infusion_title && (
              <div className="mt-3 text-[11px] text-amber-700">🧖 {post.infusion_title}</div>
            )}
            {post.oils.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {post.oils.map((oilId) => {
                  const o = OIL_BY_ID[oilId];
                  if (!o) return null;
                  return (
                    <span key={oilId} className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 ring-1 ring-emerald-300 px-1.5 py-0.5 text-[10px] text-emerald-900">
                      {o.emoji} {o.name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/80 hover:text-white text-2xl"
        >×</button>
        <p className="mt-3 text-center text-[10px] text-white/60">Klick auf das Polaroid zum Umdrehen</p>
      </div>
    </div>
  );
}
