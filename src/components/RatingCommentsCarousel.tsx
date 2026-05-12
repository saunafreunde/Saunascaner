import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAufgieserRatingComments } from '@/lib/api';
import { Avatar } from '@/components/Avatar';

interface Props {
  aufgieserId: string;
}

// Karussell mit den letzten Bewertungs-Kommentaren — Social-Proof für den Aufgießer.
// Horizontaler Scroll mit Snap auf Mobile, Grid auf Desktop.
export function RatingCommentsCarousel({ aufgieserId }: Props) {
  const q = useAufgieserRatingComments(aufgieserId, 10);
  const list = q.data ?? [];

  if (list.length === 0) return null;

  return (
    <section className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4">
      <div className="flex items-end justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400/90">⭐ Was Gäste sagen</h3>
        <span className="text-[10px] text-forest-400 tabular-nums">{list.length} jüngste Stimmen</span>
      </div>

      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-2 px-2 scrollbar-thin">
        {list.map((c) => (
          <article
            key={c.rating_id}
            className="snap-start flex-shrink-0 w-[280px] rounded-xl bg-forest-900/60 ring-1 ring-forest-800/40 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Avatar name={c.author_name} avatarPath={c.author_avatar} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-forest-100 truncate">{c.author_name}</div>
                <div className="text-[10px] text-forest-400">
                  {formatDistanceToNow(new Date(c.rated_at), { addSuffix: true, locale: de })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-amber-300 text-base font-bold tabular-nums">
                  {c.avg_score.toFixed(1)}★
                </div>
              </div>
            </div>
            <p className="text-sm text-forest-200/95 italic leading-snug whitespace-pre-wrap break-words line-clamp-5">
              „{c.comment}"
            </p>
            <div className="mt-2 text-[10px] text-forest-500 truncate">
              → {c.infusion_title}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
