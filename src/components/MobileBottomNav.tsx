import { Link, useLocation } from 'react-router-dom';
import { useCurrentMember } from '@/lib/api';
import { isAdmin, isAufgieser, isGast, isStaff, isVereinsMitglied } from '@/lib/roles';

// Bottom-Nav fixed unten, nur auf Mobile (`lg:hidden`).
// Pro Rolle 5 Haupt-Routen. Mit Safe-Area-Padding (iOS-Notch, Android-Gesture-Bar).

type NavItem = { path: string; label: string; icon: string };

function navItemsForRole(opts: { admin: boolean; gast: boolean; staff: boolean; aufgieser: boolean; helfer: boolean; myMemberId: string | null }): NavItem[] {
  const { admin, gast, staff, aufgieser, helfer, myMemberId } = opts;
  const profile: NavItem = myMemberId
    ? { path: `/profile/${myMemberId}`, label: 'Profil', icon: '🪪' }
    : { path: '/login', label: 'Login', icon: '🔑' };

  if (admin) {
    return [
      { path: '/planner',   label: 'Planner', icon: '🧖' },
      { path: '/dashboard', label: 'Tafel',   icon: '📺' },
      { path: '/feed',      label: 'Feed',    icon: '📸' },
      { path: '/admin',     label: 'Admin',   icon: '⚙️' },
      profile,
    ];
  }
  if (gast) {
    return [
      { path: '/gast',      label: 'Bereich',   icon: '👋' },
      { path: '/dashboard', label: 'Tafel',     icon: '📺' },
      { path: '/aufgieser', label: 'Aufgießer', icon: '🌟' },
      { path: '/feed',      label: 'Feed',      icon: '📸' },
      profile,
    ];
  }
  if (staff) {
    return [
      { path: '/mitarbeiter', label: 'Personal',  icon: '👨‍🍳' },
      { path: '/dashboard',   label: 'Tafel',     icon: '📺' },
      { path: '/aufgieser',   label: 'Aufgießer', icon: '🌟' },
      { path: '/feed',        label: 'Feed',      icon: '📸' },
      profile,
    ];
  }
  if (aufgieser) {
    return [
      { path: '/planner',   label: 'Planner',   icon: '🧖' },
      { path: '/dashboard', label: 'Tafel',     icon: '📺' },
      { path: '/aufgieser', label: 'Aufgießer', icon: '🌟' },
      { path: '/feed',      label: 'Feed',      icon: '📸' },
      profile,
    ];
  }
  if (helfer) {
    return [
      { path: '/unterstuetzer', label: 'Helfen',    icon: '🤝' },
      { path: '/dashboard',     label: 'Tafel',     icon: '📺' },
      { path: '/aufgieser',     label: 'Aufgießer', icon: '🌟' },
      { path: '/feed',          label: 'Feed',      icon: '📸' },
      profile,
    ];
  }
  // Fallback (z. B. pending approval)
  return [
    { path: '/dashboard', label: 'Tafel',     icon: '📺' },
    { path: '/aufgieser', label: 'Aufgießer', icon: '🌟' },
    { path: '/feed',      label: 'Feed',      icon: '📸' },
    profile,
  ];
}

function isActive(currentPath: string, navPath: string): boolean {
  // /profile/:id matched alle /profile/* — egal welche Member-ID
  if (navPath.startsWith('/profile/')) return currentPath.startsWith('/profile/');
  if (navPath.startsWith('/aufgieser') && navPath.length === '/aufgieser'.length) {
    return currentPath === '/aufgieser';
  }
  return currentPath === navPath;
}

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const me = useCurrentMember();
  const m = me.data;

  if (!m) return null;

  const items = navItemsForRole({
    admin: isAdmin(m),
    gast: isGast(m),
    staff: isStaff(m),
    aufgieser: isAufgieser(m) && !isStaff(m),
    helfer: isVereinsMitglied(m) && !isAufgieser(m) && !isStaff(m),
    myMemberId: m.id ?? null,
  });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-forest-950/95 backdrop-blur-lg ring-1 ring-forest-800/50 pb-safe-bottom shadow-2xl shadow-black/40"
      aria-label="Hauptnavigation"
    >
      <ul className="flex items-stretch justify-around px-1 pt-1.5">
        {items.map((item) => {
          const active = isActive(pathname, item.path);
          return (
            <li key={item.path} className="flex-1 min-w-0">
              <Link
                to={item.path}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-1.5 px-1 rounded-xl transition ${
                  active
                    ? 'bg-forest-500/15 text-forest-200 scale-[1.03]'
                    : 'text-forest-400 active:bg-forest-900/60'
                }`}
              >
                <span className={`text-xl leading-none ${active ? 'drop-shadow' : ''}`}>
                  {item.icon}
                </span>
                <span className={`text-[10px] leading-none truncate w-full text-center ${active ? 'font-semibold text-forest-100' : ''}`}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
