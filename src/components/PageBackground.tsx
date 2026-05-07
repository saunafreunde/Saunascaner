import { useTvSettings, publicAssetUrl } from '@/lib/api';

type Page = 'dashboard' | 'guest' | 'planner';

const FALLBACK = 'bg-schwarzwald-soft';
const STRONG_FALLBACK = 'bg-schwarzwald';

export function PageBackground({
  page,
  variant = 'soft',
  className = '',
  children,
}: {
  page: Page;
  variant?: 'soft' | 'strong';
  className?: string;
  children: React.ReactNode;
}) {
  const tv = useTvSettings();
  const path = tv.data?.backgrounds?.[page] ?? null;
  const url = publicAssetUrl(path);

  const overlay = variant === 'strong'
    ? 'linear-gradient(180deg, rgba(2,6,23,0.88) 0%, rgba(5,46,22,0.78) 55%, rgba(2,6,23,0.92) 100%)'
    : 'linear-gradient(180deg, rgba(2,6,23,0.92) 0%, rgba(5,46,22,0.85) 100%)';

  if (url) {
    return (
      <div
        className={`min-h-full text-slate-100 ${className}`}
        style={{
          backgroundColor: '#052e16',
          backgroundImage: `${overlay}, url(${JSON.stringify(url)})`,
          backgroundSize: 'cover, cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div className={`${variant === 'strong' ? STRONG_FALLBACK : FALLBACK} min-h-full text-slate-100 ${className}`}>
      {children}
    </div>
  );
}
