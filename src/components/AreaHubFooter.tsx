import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useCurrentMember, useMyEmailAccount } from '@/lib/api';
import { areaHubItemsForRole } from '@/lib/areaHub';

// Sitemap-artiger Bereich-Hub am Ende jeder Mitglieder-Seite.
// Hilft nicht-affinen Mitgliedern, alle ihre Bereiche auf einen Blick zu finden.
// Wird vom AreaHubGate konditional gerendert (nicht auf TV/Kiosk/Auth-Routes).

export function AreaHubFooter() {
  const me = useCurrentMember();
  const emailQ = useMyEmailAccount();
  const { pathname } = useLocation();

  const items = useMemo(
    () => areaHubItemsForRole(me.data, !!emailQ.data?.active),
    [me.data, emailQ.data],
  );

  // Auf Profil-Seiten matched currentPath gegen alle /profile/* — nur „eigenes" Profil markieren
  function isCurrent(itemPath: string): boolean {
    if (itemPath.startsWith('/profile/')) {
      return pathname.startsWith('/profile/');
    }
    if (itemPath === '/dm') return pathname === '/dm' || pathname.startsWith('/dm/');
    if (itemPath === '/spiele') return pathname === '/spiele' || pathname.startsWith('/spiele/');
    return pathname === itemPath;
  }

  if (items.length === 0) return null;

  return (
    <section
      className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-8 pb-8 backdrop-blur-md"
      aria-label="Alle deine Bereiche"
    >
      <header className="mb-3 flex items-center gap-2">
        <span className="text-xl" aria-hidden>🧭</span>
        <h2 className="text-sm font-bold text-forest-100 uppercase tracking-wider">
          Alle deine Bereiche
        </h2>
        <span className="text-[10px] text-forest-500 ml-auto">
          {items.length} Schnellzugriffe
        </span>
      </header>

      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((it) => {
          const here = isCurrent(it.path);
          return (
            <li key={it.path}>
              <Link
                to={it.path}
                aria-current={here ? 'page' : undefined}
                aria-label={here ? `${it.title} (Du bist hier)` : it.title}
                className={`relative flex h-full flex-col rounded-2xl p-4 min-h-[96px] ring-1 transition ${
                  here
                    ? 'bg-amber-500/10 ring-amber-400/60 shadow-lg shadow-amber-900/20'
                    : 'bg-forest-900/60 ring-forest-800/50 hover:bg-forest-900/80 hover:ring-amber-500/40 hover:shadow-md hover:shadow-black/30'
                }`}
              >
                {here && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 rounded-full bg-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-100 ring-1 ring-amber-400/50">
                    📍 Hier
                  </span>
                )}
                <span className="text-3xl leading-none mb-2" aria-hidden>{it.emoji}</span>
                <span className={`text-sm font-semibold ${here ? 'text-amber-100' : 'text-forest-100'}`}>
                  {it.title}
                </span>
                <span className="text-[11px] text-forest-400 mt-1 leading-snug">
                  {it.blurb}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
