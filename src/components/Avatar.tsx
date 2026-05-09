import { useState } from 'react';
import { resolveAvatarUrl } from '@/lib/avatar';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name: string;
  avatarPath?: string | null;
  size?: Size;
  isAufgieser?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<Size, string> = {
  xs: 'h-7 w-7 text-[11px] rounded-lg',
  sm: 'h-10 w-10 text-base rounded-xl',
  md: 'h-14 w-14 text-2xl rounded-2xl',
  lg: 'h-20 w-20 text-3xl rounded-3xl',
  xl: 'h-24 w-24 text-4xl rounded-3xl',
};

const SIZE_PX: Record<Size, number> = {
  xs: 32, sm: 64, md: 128, lg: 192, xl: 256,
};

/**
 * Vereinheitlichte Avatar-Anzeige: Foto (Storage) > DiceBear > Initial-Gradient.
 * Fallback wird automatisch verwendet, wenn das Bild fehlschlägt.
 */
export function Avatar({ name, avatarPath, size = 'md', isAufgieser = false, className = '' }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const url = errored ? null : resolveAvatarUrl(avatarPath ?? null, SIZE_PX[size]);
  const initial = (name?.charAt(0) ?? '?').toUpperCase();

  const baseClass = `${SIZE_CLASSES[size]} shrink-0 inline-flex items-center justify-center font-black shadow-lg ring-2 overflow-hidden`;

  if (url) {
    return (
      <div
        className={`${baseClass} bg-forest-900/60 ring-forest-700/30 ${className}`}
      >
        <img
          src={url}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  // Initial-Gradient — Aufgieser bekommen Gold, alle anderen Wald
  const gradient = isAufgieser
    ? 'bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 text-amber-950 ring-amber-400/30 shadow-amber-900/30'
    : 'bg-gradient-to-br from-forest-300 via-forest-500 to-forest-800 text-forest-950 ring-forest-400/30 shadow-forest-900/30';

  return (
    <div className={`${baseClass} ${gradient} ${className}`}>
      <span aria-hidden>{initial}</span>
      <span className="sr-only">{name}</span>
    </div>
  );
}

export default Avatar;
