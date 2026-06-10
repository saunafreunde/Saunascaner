import { useEffect, useState, type ReactNode } from 'react';

interface HubZoneProps {
  icon: string;
  title: string;
  subtitle?: string;
  accent: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Anchor-ID für die Bereichs-Sprungleiste im Planner-Header. */
  id?: string;
  /** Zone per Klick auf den Header ein-/ausklappbar; Zustand wird in localStorage gemerkt. */
  collapsible?: boolean;
  /** Startzustand beim allerersten Besuch (default: aufgeklappt). */
  defaultCollapsed?: boolean;
}

/**
 * Zone wrapper with accent color, animated header glow, and seamless container.
 * Used to thematically group related cards in the Planner Hub.
 * Collapsible-Zonen verkürzen die lange Planner-Seite drastisch — der
 * Auf/Zu-Zustand bleibt pro Gerät erhalten. Die Sprungleiste öffnet
 * zugeklappte Zonen via CustomEvent 'hubzone:open'.
 */
export function HubZone({
  icon, title, subtitle, accent, badge, children, className = '',
  id, collapsible = false, defaultCollapsed = false,
}: HubZoneProps) {
  const storageKey = id ? `hubzone-collapsed-${id}` : null;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (!collapsible) return false;
    if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored !== null) return stored === '1';
      } catch { /* private mode o.ä. */ }
    }
    return defaultCollapsed;
  });

  // Sprungleiste öffnet zugeklappte Zonen vor dem Scrollen
  useEffect(() => {
    if (!id) return;
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<{ id: string }>).detail?.id !== id) return;
      setCollapsed(false);
      if (storageKey) { try { localStorage.setItem(storageKey, '0'); } catch { /* ignore */ } }
    };
    window.addEventListener('hubzone:open', onOpen);
    return () => window.removeEventListener('hubzone:open', onOpen);
  }, [id, storageKey]);

  function toggle() {
    if (!collapsible) return;
    setCollapsed((c) => {
      const next = !c;
      if (storageKey) { try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* ignore */ } }
      return next;
    });
  }

  const headerInner = (
    <>
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl shadow-lg ring-1 ring-white/10"
          style={{
            backgroundColor: `${accent}20`,
            boxShadow: `0 0 20px ${accent}40, inset 0 1px 0 ${accent}30`,
          }}
        >
          {icon}
        </div>
        <div className="min-w-0 text-left">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-forest-100 leading-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[10px] sm:text-xs text-forest-400 uppercase tracking-[0.15em] mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        {collapsible && (
          <span
            aria-hidden
            className={`text-forest-400 text-sm transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`}
          >
            ▶
          </span>
        )}
      </div>
    </>
  );

  return (
    <section
      id={id}
      className={`relative rounded-3xl bg-gradient-to-br from-forest-950/60 via-forest-950/40 to-transparent ring-1 ring-forest-800/30 backdrop-blur-sm overflow-hidden scroll-mt-28 ${className}`}
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

      {/* Header bleibt semantisches <header> mit echtem <h2> (Screenreader-
          Heading-Navigation). Klickfläche fürs Auf/Zuklappen ist ein
          gestreckter Overlay-Button — kein <h2> innerhalb von <button>. */}
      <header className={`relative px-5 sm:px-6 pt-5 ${collapsed ? 'pb-5' : 'pb-3'} flex items-center justify-between gap-3`}>
        {headerInner}
        {collapsible && (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            className="absolute inset-0 cursor-pointer rounded-t-3xl hover:bg-forest-900/20 transition"
          >
            <span className="sr-only">{title} {collapsed ? 'aufklappen' : 'zuklappen'}</span>
          </button>
        )}
      </header>

      {!collapsed && (
        <div className="relative px-5 sm:px-6 pb-5">
          {children}
        </div>
      )}
    </section>
  );
}
