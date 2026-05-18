import { Link, useLocation } from 'react-router-dom';
import { useCurrentMember, useMyEmailAccount, useRatableInfusions, useUnreadDmsCount } from '@/lib/api';
import { useActiveMatchesForMe } from '@/lib/games';
import { isAdmin, isAufgieser, isFan, isGast, isPersonalPlaner, isStaff, isVereinsMitglied } from '@/lib/roles';

// Bottom-Nav fixed unten, nur auf Mobile (`lg:hidden`).
// Pro Rolle 5 Haupt-Routen. Mit Safe-Area-Padding (iOS-Notch, Android-Gesture-Bar).
//
// Tab 2 ist ein Smart-Slot, der je nach Daten-Lage wechselt:
//   1. Ungelesene DMs                           → ✉️ Nachrichten (höchste Prio)
//   2. „Du bist dran" in laufendem Spiel       → 🎮 Spiele (Badge mit Anzahl)
//   3. Bewertbare Aufgüsse offen UND Mail leer  → 📝 Bewerten (Badge)
//   4. Mail-Account vorhanden                   → 📬 Mail (Badge bei unread)
//   5. Bewertbare Aufgüsse offen                → 📝 Bewerten (Badge)
//   6. Fallback                                 → 👥 Mitglieder
// DMs haben oberste Priorität — sonst geht eine Nachricht unter.

type NavItem = { path: string; label: string; icon: string; badge?: number };

function useSmartSlot(memberId: string | null): NavItem {
  const mailQ = useMyEmailAccount();
  const ratableQ = useRatableInfusions(memberId);
  const activeGamesQ = useActiveMatchesForMe();
  const dmUnreadQ = useUnreadDmsCount();

  const mail = mailQ.data;
  const mailUnread = mail?.unread_count ?? 0;
  const pending = (ratableQ.data ?? []).filter((i) => !i.already_rated).length;
  const yourTurn = (activeGamesQ.data ?? []).filter((g) => g.my_turn).length;
  const dmUnread = dmUnreadQ.data ?? 0;

  // Ungelesene DMs → Vorrang
  if (dmUnread > 0) {
    return { path: '/dm', label: 'Nachrichten', icon: '✉️', badge: dmUnread };
  }
  // Du bist dran in laufendem Spiel
  if (yourTurn > 0) {
    return { path: '/spiele', label: 'Du bist dran', icon: '🎮', badge: yourTurn };
  }
  if (pending > 0 && mailUnread === 0) {
    return { path: '/bewerten', label: 'Bewerten', icon: '📝', badge: pending };
  }
  if (mail?.active) {
    return { path: '/postfach', label: 'Mail', icon: '📬', badge: mailUnread > 0 ? mailUnread : undefined };
  }
  if (pending > 0) {
    return { path: '/bewerten', label: 'Bewerten', icon: '📝', badge: pending };
  }
  return { path: '/members', label: 'Mitglieder', icon: '👥' };
}

function navItemsForRole(opts: {
  admin: boolean; gast: boolean; fan: boolean; staff: boolean; cp: boolean;
  aufgieser: boolean; helfer: boolean; myMemberId: string | null;
  smart: NavItem;
}): NavItem[] {
  const { admin, gast, fan, staff, cp, aufgieser, helfer, myMemberId, smart } = opts;
  const profile: NavItem = myMemberId
    ? { path: `/profile/${myMemberId}`, label: 'Profil', icon: '🪪' }
    : { path: '/login', label: 'Login', icon: '🔑' };

  if (admin) {
    return [
      { path: '/planner', label: 'Planner', icon: '🧖' },
      smart,
      { path: '/feed',    label: 'Feed',    icon: '📸' },
      { path: '/admin',   label: 'Admin',   icon: '⚙️' },
      profile,
    ];
  }
  if (gast) {
    return [
      { path: '/gast',      label: 'Bereich',   icon: '👋' },
      smart,
      { path: '/aufgieser', label: 'Aufgießer', icon: '🌟' },
      { path: '/feed',      label: 'Feed',      icon: '📸' },
      profile,
    ];
  }
  if (fan) {
    return [
      { path: '/fan',       label: 'Bereich',   icon: '🤝' },
      smart,
      { path: '/aufgieser', label: 'Aufgießer', icon: '🌟' },
      { path: '/feed',      label: 'Feed',      icon: '📸' },
      profile,
    ];
  }
  if (cp) {
    // CP hatte nie Tafel und hat einen sehr fokussierten Workflow — Personal
    // bleibt Tab 2, Smart-Slot wäre redundant zu /cp-internen Tabs.
    return [
      { path: '/cp',          label: 'CP',        icon: '🛠️' },
      { path: '/mitarbeiter', label: 'Personal',  icon: '👨‍🍳' },
      { path: '/aufgieser',   label: 'Aufgießer', icon: '🌟' },
      { path: '/feed',        label: 'Feed',      icon: '📸' },
      profile,
    ];
  }
  if (staff) {
    return [
      { path: '/mitarbeiter', label: 'Personal',  icon: '👨‍🍳' },
      smart,
      { path: '/aufgieser',   label: 'Aufgießer', icon: '🌟' },
      { path: '/feed',        label: 'Feed',      icon: '📸' },
      profile,
    ];
  }
  if (aufgieser) {
    return [
      { path: '/planner',   label: 'Planner',   icon: '🧖' },
      smart,
      { path: '/aufgieser', label: 'Aufgießer', icon: '🌟' },
      { path: '/feed',      label: 'Feed',      icon: '📸' },
      profile,
    ];
  }
  if (helfer) {
    return [
      { path: '/unterstuetzer', label: 'Helfen',    icon: '🤝' },
      smart,
      { path: '/aufgieser',     label: 'Aufgießer', icon: '🌟' },
      { path: '/feed',          label: 'Feed',      icon: '📸' },
      profile,
    ];
  }
  // Fallback (z. B. pending approval)
  return [
    smart,
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
  const smart = useSmartSlot(m?.id ?? null);

  if (!m) return null;

  const items = navItemsForRole({
    admin: isAdmin(m),
    gast: isGast(m),
    fan: isFan(m),
    cp: isStaff(m) && isPersonalPlaner(m),
    staff: isStaff(m) && !isPersonalPlaner(m),
    aufgieser: isAufgieser(m) && !isStaff(m),
    // Fan ist zwar Vereinsmitglied im Sinne von isVereinsMitglied(),
    // aber gehört in den Fan-Bereich, nicht zu den Helfern → explizit ausschließen.
    helfer: isVereinsMitglied(m) && !isFan(m) && !isAufgieser(m) && !isStaff(m),
    myMemberId: m.id ?? null,
    smart,
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
                aria-label={item.badge ? `${item.label} (${item.badge})` : item.label}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-1.5 px-1 rounded-xl transition ${
                  active
                    ? 'bg-forest-500/15 text-forest-200 scale-[1.03]'
                    : 'text-forest-400 active:bg-forest-900/60'
                }`}
              >
                <span className={`relative text-xl leading-none ${active ? 'drop-shadow' : ''}`}>
                  {item.icon}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] rounded-full bg-amber-500 text-forest-950 text-[10px] font-bold leading-[16px] px-1 ring-2 ring-forest-950 tabular-nums">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
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
