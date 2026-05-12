import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  useAufgussWishes, useCreateWish, useDeleteWish, useToggleWishLike,
  useMarkWishFulfilled, useCurrentMember,
  SPECIALTY_LABELS, STAR_SPECIALTIES, type StarSpecialty,
} from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import { isAdmin } from '@/lib/roles';

interface Props {
  aufgieserId: string;
}

// Aufguss-Wunschliste auf Aufgießer-Profil.
// Gäste können Wünsche posten + liken; Aufgießer kann "erfüllt" markieren.
export function AufgussWishes({ aufgieserId }: Props) {
  const wishes = useAufgussWishes(aufgieserId);
  const create = useCreateWish();
  const me = useCurrentMember();
  const [text, setText] = useState('');
  const [specialty, setSpecialty] = useState<StarSpecialty | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMyProfile = me.data?.id === aufgieserId;
  const list = wishes.data ?? [];
  const openWishes = list.filter((w) => !w.fulfilled_at);
  const fulfilledWishes = list.filter((w) => w.fulfilled_at);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    if (trimmed.length > 500) {
      setError('Maximal 500 Zeichen.');
      return;
    }
    try {
      await create.mutateAsync({
        aufgieserId,
        wishText: trimmed,
        specialty: specialty || null,
      });
      setText('');
      setSpecialty('');
      setShowForm(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4">
      <div className="flex items-end justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400/90">
          🌟 Aufguss-Wünsche
        </h3>
        <span className="text-[10px] text-forest-400 tabular-nums">
          {openWishes.length} offen · {fulfilledWishes.length} erfüllt
        </span>
      </div>

      {!isMyProfile && me.data && (
        <>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full mb-3 rounded-xl border-2 border-dashed border-forest-700/60 bg-forest-900/40 text-forest-300 hover:border-amber-500/60 hover:text-amber-300 transition py-2 text-sm"
            >
              + Eigenen Wunsch posten
            </button>
          ) : (
            <form onSubmit={submit} className="mb-4 space-y-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Was wünschst du dir? z.B. „Wieder einen Honig-Aufguss mit langsamem Wedeln, das war so toll letzte Woche!""
                rows={3}
                maxLength={500}
                autoFocus
                className="w-full rounded-xl bg-forest-900/70 ring-1 ring-forest-700/60 px-3 py-2 text-sm text-forest-100 placeholder-forest-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/60"
              />
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] uppercase tracking-widest text-forest-400 self-center mr-1">Stil:</span>
                <button
                  type="button"
                  onClick={() => setSpecialty('')}
                  className={`rounded-full px-2 py-0.5 text-[11px] ring-1 transition ${
                    specialty === ''
                      ? 'bg-amber-500/20 text-amber-200 ring-amber-500/50'
                      : 'bg-forest-900/60 text-forest-400 ring-forest-800/50 hover:bg-forest-800/70'
                  }`}
                >
                  egal
                </button>
                {STAR_SPECIALTIES.map((sp) => {
                  const meta = SPECIALTY_LABELS[sp];
                  if (!meta) return null;
                  const active = specialty === sp;
                  return (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => setSpecialty(sp)}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 transition ${
                        active
                          ? 'bg-amber-500/20 text-amber-200 ring-amber-500/50'
                          : 'bg-forest-900/60 text-forest-300 ring-forest-800/50 hover:bg-forest-800/70'
                      }`}
                    >
                      <span>{meta.emoji}</span>
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={create.isPending || text.trim().length === 0}
                  className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
                >
                  {create.isPending ? 'Sendet…' : 'Wunsch posten'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setText(''); setSpecialty(''); }}
                  className="rounded-xl bg-forest-900/70 px-4 py-2 text-sm text-forest-300 ring-1 ring-forest-700/50"
                >
                  Abbrechen
                </button>
              </div>
              {error && <p className="text-xs text-red-300">{error}</p>}
            </form>
          )}
        </>
      )}

      {list.length === 0 ? (
        <p className="text-center text-sm text-forest-400/80 py-4">
          Noch keine Wünsche. {!isMyProfile && 'Sag was du dir wünschst!'}
        </p>
      ) : (
        <ul className="space-y-2">
          {[...openWishes, ...fulfilledWishes].map((w) => (
            <li key={w.id}>
              <WishItem
                wish={w}
                aufgieserId={aufgieserId}
                canMarkFulfilled={isMyProfile || isAdmin(me.data)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WishItem({ wish, aufgieserId, canMarkFulfilled }: {
  wish: import('@/lib/api').AufgussWish;
  aufgieserId: string;
  canMarkFulfilled: boolean;
}) {
  const like = useToggleWishLike();
  const del = useDeleteWish();
  const mark = useMarkWishFulfilled();

  const specialty = wish.wish_specialty as StarSpecialty | null;
  const specialtyMeta = specialty ? SPECIALTY_LABELS[specialty] : null;

  return (
    <article
      className={`rounded-xl ring-1 p-3 ${
        wish.fulfilled_at
          ? 'bg-emerald-950/30 ring-emerald-700/30'
          : 'bg-forest-900/50 ring-forest-800/40'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={wish.author_name} avatarPath={wish.author_avatar} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            <span className="font-semibold text-forest-100">{wish.author_name}</span>
            <span className="text-forest-500">
              {formatDistanceToNow(new Date(wish.created_at), { addSuffix: true, locale: de })}
            </span>
            {specialtyMeta && (
              <span className="inline-flex items-center gap-1 rounded-full bg-forest-950/70 ring-1 ring-forest-800/40 px-1.5 py-0.5 text-[10px]">
                {specialtyMeta.emoji} {specialtyMeta.label}
              </span>
            )}
            {wish.fulfilled_at && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40 px-1.5 py-0.5 text-[10px] font-semibold">
                ✓ Erfüllt
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-forest-200/95 whitespace-pre-wrap break-words">
            {wish.wish_text}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => like.mutate({ wishId: wish.id, aufgieserId, currentlyLiked: wish.liked_by_me })}
              disabled={like.isPending}
              className={`text-[11px] flex items-center gap-1 transition ${
                wish.liked_by_me ? 'text-amber-300' : 'text-forest-400 hover:text-amber-300'
              }`}
              title={wish.liked_by_me ? 'Like zurücknehmen' : 'Ich auch!'}
            >
              <span>{wish.liked_by_me ? '⭐' : '☆'}</span>
              <span className="tabular-nums">{wish.like_count}</span>
              <span className="text-forest-500">ich auch</span>
            </button>
            {canMarkFulfilled && (
              <button
                onClick={() => mark.mutate({ wishId: wish.id, aufgieserId, fulfilled: !wish.fulfilled_at })}
                disabled={mark.isPending}
                className={`text-[11px] hover:text-emerald-300 transition ${wish.fulfilled_at ? 'text-emerald-300' : 'text-forest-400'}`}
              >
                {wish.fulfilled_at ? 'Wieder als offen markieren' : 'Als erfüllt markieren'}
              </button>
            )}
            {wish.is_my_wish && (
              <button
                onClick={async () => {
                  if (!window.confirm('Wunsch löschen?')) return;
                  await del.mutateAsync({ wishId: wish.id, aufgieserId });
                }}
                className="text-[11px] text-forest-500 hover:text-red-300 transition"
              >
                Löschen
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
