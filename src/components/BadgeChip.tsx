import { TIER_STYLES, type BadgeDefinition } from '@/lib/badges';

type Props = {
  badge: BadgeDefinition;
  size?: 'sm' | 'md';
  earnedAt?: string;
};

export default function BadgeChip({ badge, size = 'md', earnedAt }: Props) {
  const s = TIER_STYLES[badge.tier];
  const tooltip = earnedAt
    ? `${badge.label} · ${badge.description} · ${new Date(earnedAt).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}`
    : `${badge.label} · ${badge.description}`;

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap select-none ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      }`}
      style={{
        background: s.bg,
        color: s.text,
        border: `1px solid ${s.ring}`,
        boxShadow: s.shadow,
      }}
    >
      <span aria-hidden>{badge.emoji}</span>
      {size === 'md' && <span>{badge.label}</span>}
    </span>
  );
}
