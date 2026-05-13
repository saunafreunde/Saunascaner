import { useReactToFeedPost, type FeedReactionType } from '@/lib/api';

type Props = {
  postId: string;
  counts: Partial<Record<FeedReactionType, number>>;
  myReactions: FeedReactionType[];
  compact?: boolean;
};

const REACTIONS: { kind: FeedReactionType; emoji: string; label: string; anim: string }[] = [
  { kind: 'fire',    emoji: '🔥', label: 'Heiß',        anim: 'feed-react-flicker' },
  { kind: 'water',   emoji: '💧', label: 'Erfrischend', anim: 'feed-react-drip' },
  { kind: 'leaf',    emoji: '🌿', label: 'Wohltuend',   anim: 'feed-react-sway' },
  { kind: 'crown',   emoji: '👑', label: 'Königlich',   anim: 'feed-react-shine' },
  { kind: 'theater', emoji: '🎭', label: 'Show!',       anim: 'feed-react-spin' },
];

export function PostReactionBar({ postId, counts, myReactions, compact = false }: Props) {
  const react = useReactToFeedPost();

  const toggle = (kind: FeedReactionType) => {
    if (react.isPending) return;
    react.mutate({ postId, reaction: kind });
  };

  return (
    <div className={`flex items-center flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`}>
      {REACTIONS.map((r) => {
        const cnt = counts[r.kind] ?? 0;
        const isMine = myReactions.includes(r.kind);
        return (
          <button
            key={r.kind}
            type="button"
            onClick={() => toggle(r.kind)}
            title={r.label + (cnt > 0 ? ` (${cnt})` : '')}
            className={`group inline-flex items-center gap-1 rounded-full transition ${
              compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-3 py-2 text-sm min-h-[40px]'
            } ring-1 ${
              isMine
                ? 'bg-amber-500/20 ring-amber-500/50 text-amber-200 scale-105 shadow-sm shadow-amber-500/20'
                : 'bg-forest-900/60 ring-forest-800/40 text-forest-300 hover:bg-forest-800/70 hover:scale-105'
            }`}
          >
            <span className={isMine ? r.anim : 'opacity-80 group-hover:opacity-100 transition'}>{r.emoji}</span>
            {cnt > 0 && <span className="tabular-nums font-medium">{cnt}</span>}
          </button>
        );
      })}
    </div>
  );
}
