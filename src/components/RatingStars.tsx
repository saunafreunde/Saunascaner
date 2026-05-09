import { useState } from 'react';

interface RatingStarsProps {
  value: number | null;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function RatingStars({ value, onChange, readOnly = false, size = 'md' }: RatingStarsProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const sizeClass = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-xl';

  const display = hovered ?? value;

  if (readOnly && value !== null) {
    // half-star rendering for averages
    const full = Math.floor(value);
    const half = value - full >= 0.25 && value - full < 0.75;
    const stars = Array.from({ length: 5 }, (_, i) => {
      if (i < full) return 'full';
      if (i === full && half) return 'half';
      return 'empty';
    });
    return (
      <span className={`inline-flex gap-0.5 ${sizeClass}`} aria-label={`${value} von 5`}>
        {stars.map((type, i) => (
          <span key={i} className={type === 'empty' ? 'opacity-25' : ''}>
            {type === 'half' ? '⯨' : '★'}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex gap-0.5 ${sizeClass} ${!readOnly ? 'cursor-pointer select-none' : ''}`}
      onMouseLeave={() => !readOnly && setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`transition-colors ${
            display !== null && star <= display
              ? 'text-amber-400'
              : 'text-forest-700/50'
          }`}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onClick={() => !readOnly && onChange?.(star)}
        >
          ★
        </span>
      ))}
    </span>
  );
}
