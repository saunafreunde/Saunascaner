import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { RATING_CATEGORIES, type RatingCategoryId } from '@/lib/ratingCategories';
import { useSubmitRating, useMyRatingForInfusion, type RatableInfusion } from '@/lib/api';
import { RatingStars } from './RatingStars';

interface RatingFormProps {
  infusion: RatableInfusion;
  meisterName: string;
  memberId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Ratings = Record<RatingCategoryId, number | null>;

const EMPTY_RATINGS: Ratings = {
  chemie: null,
  luftbewegung: null,
  wedeltechnik: null,
  hitzeniveau: null,
  musik: null,
  duftentwicklung: null,
};

const ERROR_MESSAGES: Record<string, string> = {
  not_present: 'Du musst eingecheckt sein, um zu bewerten.',
  rating_window_expired: 'Das Bewertungsfenster (3 Stunden) ist abgelaufen.',
  infusion_not_finished: 'Dieser Aufguss läuft noch.',
  self_rating_not_allowed: 'Du kannst deinen eigenen Aufguss nicht bewerten.',
};

export function RatingForm({ infusion, meisterName, memberId, onClose, onSuccess }: RatingFormProps) {
  const [ratings, setRatings] = useState<Ratings>(EMPTY_RATINGS);
  const [comment, setComment] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const myRatingQ = useMyRatingForInfusion(infusion.id, memberId);
  const submitRating = useSubmitRating();

  // Pre-fill if already rated
  useEffect(() => {
    if (myRatingQ.data) {
      const r = myRatingQ.data;
      setRatings({
        chemie:          r.chemie,
        luftbewegung:    r.luftbewegung,
        wedeltechnik:    r.wedeltechnik,
        hitzeniveau:     r.hitzeniveau,
        musik:           r.musik,
        duftentwicklung: r.duftentwicklung,
      });
      setComment(r.comment ?? '');
    }
  }, [myRatingQ.data]);

  const allFilled = Object.values(ratings).every((v) => v !== null);
  const isEditing = !!myRatingQ.data;

  // Countdown until window closes
  const windowClose = new Date(new Date(infusion.end_time).getTime() + 3 * 60 * 60 * 1000);
  const timeLeft = formatDistanceToNow(windowClose, { locale: de, addSuffix: false });

  async function handleSubmit() {
    if (!allFilled) return;
    setErrorMsg(null);

    const result = await submitRating.mutateAsync({
      infusion_id:    infusion.id,
      member_id:      memberId,
      chemie:         ratings.chemie!,
      luftbewegung:   ratings.luftbewegung!,
      wedeltechnik:   ratings.wedeltechnik!,
      hitzeniveau:    ratings.hitzeniveau!,
      musik:          ratings.musik!,
      duftentwicklung: ratings.duftentwicklung!,
      comment:        comment.trim() || null,
    });

    if (result === 'ok') {
      onSuccess();
    } else {
      setErrorMsg(ERROR_MESSAGES[result] ?? 'Unbekannter Fehler.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-forest-950 ring-1 ring-forest-700/50 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-forest-800/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                {isEditing ? 'Bewertung bearbeiten' : 'Aufguss bewerten'}
              </h2>
              <p className="text-sm text-forest-300 mt-0.5">
                {infusion.title} · {meisterName}
              </p>
              <p className="text-xs text-forest-400 mt-1">
                Noch {timeLeft} zum Bewerten
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-forest-400 hover:text-slate-200 text-xl leading-none shrink-0"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {RATING_CATEGORIES.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg shrink-0">{cat.emoji}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-200">{cat.label}</div>
                  <div className="text-xs text-forest-400 truncate">{cat.tip}</div>
                </div>
              </div>
              <RatingStars
                value={ratings[cat.id as RatingCategoryId]}
                onChange={(v) => setRatings((prev) => ({ ...prev, [cat.id]: v }))}
                size="lg"
              />
            </div>
          ))}

          {/* Comment */}
          <div>
            <label className="text-xs text-forest-400 block mb-1">Kommentar (optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 200))}
              placeholder="Was hat besonders gut gefallen?"
              rows={3}
              className="w-full rounded-xl bg-forest-900/60 border border-forest-700/40 px-3 py-2 text-sm text-slate-200 placeholder-forest-500 resize-none focus:outline-none focus:ring-1 focus:ring-forest-500"
            />
            <div className="text-right text-xs text-forest-500 mt-1">{comment.length}/200</div>
          </div>

          {errorMsg && (
            <div className="rounded-xl bg-red-950/60 border border-red-800/40 px-4 py-2 text-sm text-red-300">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-forest-800/40">
          {!allFilled && (
            <p className="text-xs text-forest-400 text-center mb-2">
              Bitte alle 6 Kategorien bewerten
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={!allFilled || submitRating.isPending}
            className="w-full rounded-xl bg-forest-600 hover:bg-forest-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            {submitRating.isPending
              ? 'Speichern...'
              : isEditing
              ? 'Bewertung aktualisieren'
              : 'Bewertung abgeben'}
          </button>
        </div>
      </div>
    </div>
  );
}
