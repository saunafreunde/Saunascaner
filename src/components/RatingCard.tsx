import { RATING_CATEGORIES } from '@/lib/ratingCategories';
import type { InfusionRating } from '@/lib/api';
import { RatingStars } from './RatingStars';

interface RatingCardProps {
  rating: InfusionRating;
  showName?: boolean;
  memberName?: string;
}

export function RatingCard({ rating, showName = false, memberName }: RatingCardProps) {
  return (
    <div className="rounded-xl bg-forest-900/40 border border-forest-800/30 px-4 py-3 space-y-2">
      {showName && memberName && (
        <div className="text-xs text-forest-400">{memberName}</div>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {RATING_CATEGORIES.map((cat) => {
          const val = rating[cat.id as keyof InfusionRating] as number | null;
          return (
            <div key={cat.id} className="flex items-center justify-between gap-1">
              <span className="text-xs text-forest-400 flex items-center gap-1">
                <span>{cat.emoji}</span>
                <span className="truncate">{cat.label}</span>
              </span>
              {val !== null ? (
                <RatingStars value={val} readOnly size="sm" />
              ) : (
                <span className="text-xs text-forest-600">—</span>
              )}
            </div>
          );
        })}
      </div>

      {rating.comment && (
        <p className="text-xs text-forest-300 border-t border-forest-800/30 pt-2 italic">
          „{rating.comment}"
        </p>
      )}
    </div>
  );
}
