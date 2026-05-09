import type { ReactNode } from 'react';

interface HubZoneProps {
  icon: string;
  title: string;
  subtitle?: string;
  accent: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Zone wrapper with accent color, animated header glow, and seamless container.
 * Used to thematically group related cards in the Planner Hub.
 */
export function HubZone({ icon, title, subtitle, accent, badge, children, className = '' }: HubZoneProps) {
  return (
    <section
      className={`relative rounded-3xl bg-gradient-to-br from-forest-950/60 via-forest-950/40 to-transparent ring-1 ring-forest-800/30 backdrop-blur-sm overflow-hidden ${className}`}
      style={{
        boxShadow: `inset 4px 0 0 ${accent}, 0 4px 32px rgba(0,0,0,0.15), 0 0 0 1px ${accent}10`,
      }}
    >
      {/* Glowing accent corner */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -left-12 h-32 w-32 rounded-full opacity-40 blur-3xl"
        style={{ backgroundColor: accent }}
      />

      <header className="relative px-5 sm:px-6 pt-5 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl shadow-lg ring-1 ring-white/10"
            style={{
              backgroundColor: `${accent}20`,
              boxShadow: `0 0 20px ${accent}40, inset 0 1px 0 ${accent}30`,
            }}
          >
            {icon}
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-forest-100 leading-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[10px] sm:text-xs text-forest-400 uppercase tracking-[0.15em] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </header>

      <div className="relative px-5 sm:px-6 pb-5">
        {children}
      </div>
    </section>
  );
}
