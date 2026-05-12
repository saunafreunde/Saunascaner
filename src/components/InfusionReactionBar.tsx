import {
  useInfusionReactions, useReactToInfusion, useUnreactToInfusion,
  REACTION_EMOJI, REACTION_KINDS, type ReactionKind,
} from '@/lib/api';

interface Props {
  infusionId: string;
  compact?: boolean;
}

// Reaction-Bar mit 5 Emojis. Member kann genau 1 Reaction setzen (überschreibt vorherige).
// Klick auf bereits gesetzte Reaction → entfernt.
export function InfusionReactionBar({ infusionId, compact = false }: Props) {
  const q = useInfusionReactions(infusionId);
  const react = useReactToInfusion();
  const unreact = useUnreactToInfusion();

  const data = q.data;
  const my = data?.my_reaction ?? null;
  const counts = data?.counts ?? {};
  const total = data?.total ?? 0;
  const busy = react.isPending || unreact.isPending;

  const toggle = (kind: ReactionKind) => {
    if (busy) return;
    if (my === kind) {
      unreact.mutate(infusionId);
    } else {
      react.mutate({ infusionId, reaction: kind });
    }
  };

  return (
    <div className={`flex items-center ${compact ? 'gap-1' : 'gap-1.5'}`}>
      {REACTION_KINDS.map((kind) => {
        const meta = REACTION_EMOJI[kind];
        const cnt = counts[kind] ?? 0;
        const isMine = my === kind;
        return (
          <button
            key={kind}
            onClick={() => toggle(kind)}
            disabled={busy}
            title={meta.label + (cnt > 0 ? ` (${cnt})` : '')}
            className={`group inline-flex items-center gap-1 rounded-full transition ${
              compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
            } ring-1 ${
              isMine
                ? 'bg-amber-500/20 ring-amber-500/50 text-amber-200 scale-105'
                : 'bg-forest-900/60 ring-forest-800/40 text-forest-300 hover:bg-forest-800/70 hover:scale-105'
            } ${busy ? 'opacity-60' : ''}`}
          >
            <span className={`${isMine ? '' : 'opacity-70 group-hover:opacity-100'} transition`}>{meta.emoji}</span>
            {cnt > 0 && <span className="tabular-nums font-medium">{cnt}</span>}
          </button>
        );
      })}
      {!compact && total > 0 && (
        <span className="ml-1 text-[10px] text-forest-500 tabular-nums">
          · {total} insgesamt
        </span>
      )}
    </div>
  );
}
