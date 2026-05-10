import { getTeamMeta, flagUrl } from '@/lib/teamMeta';
import { FIFA_RANK } from '@/lib/fifaRanks';

type Size = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<Size, number> = { sm: 28, md: 44, lg: 56 };
const RING_PX: Record<Size, number> = { sm: 1.5, md: 2, lg: 2.5 };

interface Props {
  code: string | null | undefined;
  fallbackEmoji?: string | null;
  size?: Size;
  showRankStar?: boolean;
  className?: string;
}

export function TeamFlag({ code, fallbackEmoji, size = 'md', showRankStar = true, className = '' }: Props) {
  const meta = getTeamMeta(code);
  const px = SIZE_PX[size];
  const ring = RING_PX[size];
  const rank = code ? FIFA_RANK[code.toUpperCase()] : undefined;
  const isTop10 = rank !== undefined && rank <= 10;

  if (!meta) {
    return (
      <span
        className={`inline-grid place-items-center rounded-full bg-forest-900/60 ring-1 ring-forest-700/40 ${className}`}
        style={{ width: px, height: px, fontSize: px * 0.55 }}
      >
        {fallbackEmoji ?? '⬜'}
      </span>
    );
  }

  return (
    <span
      className={`relative inline-block rounded-full ${className}`}
      style={{
        width: px,
        height: px,
        boxShadow: `0 0 0 ${ring}px ${meta.accent}66, 0 0 ${px * 0.3}px ${meta.accent}33, inset 0 0 0 1px rgba(255,255,255,0.08)`,
      }}
    >
      <img
        src={flagUrl(meta.iso)}
        alt={code ?? 'flag'}
        loading="lazy"
        className="absolute inset-0 h-full w-full rounded-full object-cover"
        draggable={false}
      />
      {/* Subtle inner highlight for medallion-feel */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.22) 0%, transparent 45%)',
        }}
      />
      {showRankStar && isTop10 && (
        <span
          aria-hidden
          title={`FIFA-Top-10 (Rang ${rank})`}
          className="absolute -top-1 -right-1 grid place-items-center rounded-full bg-amber-400 text-amber-950 ring-2 ring-forest-950 shadow-md"
          style={{ width: px * 0.4, height: px * 0.4, fontSize: px * 0.22 }}
        >
          ★
        </span>
      )}
    </span>
  );
}
