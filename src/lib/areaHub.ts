import type { Member } from '@/lib/api';
import { isAdmin, isAufgieser, isFan, isGast, isPersonalPlaner, isStaff, isVereinsMitglied, isWmAdmin } from '@/lib/roles';

// Sitemap-artiger Bereich-Hub am Ende jeder Mitglieder-Seite.
// Zentraler Catalog aller Routen + Predicates pro Rolle.
// Wird gerendert von AreaHubFooter, gefiltert via areaHubItemsForRole(member).

export type AreaItem = {
  path: string;
  emoji: string;
  title: string;
  blurb: string;
  /** „Mein Bereich" für diese Rolle → kommt zuerst */
  isHome?: boolean;
};

// Routen auf denen der Hub-Footer NICHT erscheinen soll (Spezial-Modi / Auth-Flows).
// Synchron mit NO_BOTTOM_NAV_PATHS in App.tsx — wenn dort eine neue Route ausgeschlossen
// werden soll, hier auch nachziehen.
export const NO_AREA_HUB_PATHS = [
  '/dashboard',
  '/scanner',
  '/oil-room',
  '/willkommen',
  '/checkin',
  '/checkin/signup',
  '/checkin/rate',
  '/gast-signup',
  '/login',
  '/forgot',
  '/reset-password',
  '/tour',
  '/datenschutz',
  '/m/',
];

export function shouldShowAreaHub(pathname: string): boolean {
  return !NO_AREA_HUB_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/') || (p.endsWith('/') && pathname.startsWith(p)),
  );
}

// ─── Einzelne Item-Builder (helfen, das Catalog kompakt zu halten) ─────────

const ITEM_PLANNER: AreaItem = {
  path: '/planner', emoji: '🧖', title: 'Aufguss-Planner',
  blurb: '6-Tage-Vorschau, Aufgüsse planen und übernehmen',
};
const ITEM_BEWERTEN: AreaItem = {
  path: '/bewerten', emoji: '📝', title: 'Bewerten',
  blurb: 'Letzte Aufgüsse mit Sternen und Kommentar bewerten',
};
const ITEM_AUFGIESER: AreaItem = {
  path: '/aufgieser', emoji: '🌟', title: 'Aufgießer',
  blurb: 'Trading-Cards aller Aufgießer, Favoriten setzen',
};
const ITEM_FEED: AreaItem = {
  path: '/feed', emoji: '📸', title: 'Feed',
  blurb: 'Mini-Insta mit Beiträgen, Kommentaren und Personen',
};
const ITEM_SPIELE: AreaItem = {
  path: '/spiele', emoji: '🎮', title: 'Spiele',
  blurb: 'Tetris, Vier Gewinnt, Schach — solo oder gegeneinander',
};
const ITEM_DM: AreaItem = {
  path: '/dm', emoji: '✉️', title: 'Nachrichten',
  blurb: '1:1-Chat mit anderen Mitgliedern',
};
const ITEM_MEMBERS: AreaItem = {
  path: '/members', emoji: '👥', title: 'Mitglieder',
  blurb: 'Galerie mit Avatar, Foto-Karussell und Filter',
};
const ITEM_WM: AreaItem = {
  path: '/wm', emoji: '🏆', title: 'WM-Tipspiel',
  blurb: '104 Spiele tippen, Joker und Final-Tipp setzen',
};
const ITEM_POSTFACH: AreaItem = {
  path: '/postfach', emoji: '📬', title: 'Postfach',
  blurb: 'Persönliches Webmail und Vereins-Tickets',
};
const ITEM_DASHBOARD: AreaItem = {
  path: '/dashboard', emoji: '📺', title: 'TV-Tafel',
  blurb: 'Aufguss-Tafel-Vollbild für TV oder Tablet',
};
const ITEM_HILFE: AreaItem = {
  path: '/hilfe', emoji: '📖', title: 'Handbuch',
  blurb: 'Komplette Anleitung mit Inhaltsverzeichnis',
};
const ITEM_ADMIN: AreaItem = {
  path: '/admin', emoji: '⚙️', title: 'Admin',
  blurb: 'Admin-Bereich mit 17 Tabs in 5 Gruppen',
};
const ITEM_GAST: AreaItem = {
  path: '/gast', emoji: '👋', title: 'Mein Bereich',
  blurb: 'Persönlicher Gast-Hub mit Stats und PIN', isHome: true,
};
const ITEM_FAN: AreaItem = {
  path: '/fan', emoji: '🤝', title: 'Fan-Bereich',
  blurb: 'News, Aroma-Rezepte und Fan-Ausweis', isHome: true,
};
const ITEM_UNTERSTUETZER: AreaItem = {
  path: '/unterstuetzer', emoji: '🤝', title: 'Helfer-Aufgaben',
  blurb: 'Offene Vereins-Aufgaben übernehmen', isHome: true,
};
const ITEM_MITARBEITER: AreaItem = {
  path: '/mitarbeiter', emoji: '👨‍🍳', title: 'Mitarbeiter',
  blurb: 'Anwesenheit, Personal-Slots und Notfall-Alarm', isHome: true,
};
const ITEM_CP: AreaItem = {
  path: '/cp', emoji: '🛠️', title: 'CP-Verantwortung',
  blurb: 'Schichtplan, Anwesenheits-Export und Ratings', isHome: true,
};
const ITEM_TOUR: AreaItem = {
  path: '/tour', emoji: '🎉', title: 'Welcome-Tour',
  blurb: 'Kurze App-Vorstellung in 8 Bildschirmen',
};

// ─── Profil-Item (dynamisch wegen myMemberId) ──────────────────────────────

function profileItem(myId: string): AreaItem {
  return {
    path: `/profile/${myId}`,
    emoji: '🪪',
    title: 'Mein Profil',
    blurb: 'Avatar, Stats, Erfolge, PIN und Einstellungen',
  };
}

// ─── Catalog-Filter pro Rolle ──────────────────────────────────────────────

/**
 * Gibt die für die Rolle des Members sichtbaren Hub-Items in
 * empfohlener Sortier-Reihenfolge zurück.
 * @param member Aktuelles Mitglied (oder null)
 * @param hasEmailAccount true wenn useMyEmailAccount().data existiert
 */
export function areaHubItemsForRole(
  member: Member | null | undefined,
  hasEmailAccount: boolean,
): AreaItem[] {
  if (!member) return [];
  const myId = member.id;
  const myProfile = profileItem(myId);

  // Admin (oder WM-Admin als reduzierte Variante)
  if (isAdmin(member)) {
    return [
      ITEM_PLANNER, ITEM_BEWERTEN, ITEM_AUFGIESER, ITEM_FEED,
      ITEM_SPIELE, ITEM_DM, ITEM_MEMBERS, ITEM_WM,
      ...(hasEmailAccount ? [ITEM_POSTFACH] : []),
      ITEM_DASHBOARD, myProfile, ITEM_HILFE, ITEM_ADMIN,
    ];
  }
  if (isWmAdmin(member)) {
    return [
      ITEM_WM, ITEM_FEED, ITEM_AUFGIESER, ITEM_SPIELE, ITEM_DM,
      ITEM_BEWERTEN, ITEM_MEMBERS,
      ...(hasEmailAccount ? [ITEM_POSTFACH] : []),
      ITEM_DASHBOARD, myProfile, ITEM_HILFE, ITEM_ADMIN,
    ];
  }

  // CP-Verantwortlicher (staff + is_personal_planer)
  if (isStaff(member) && isPersonalPlaner(member)) {
    return [
      ITEM_CP, ITEM_MITARBEITER, ITEM_AUFGIESER, ITEM_FEED,
      ITEM_SPIELE, ITEM_DM, ITEM_BEWERTEN, ITEM_WM,
      ...(hasEmailAccount ? [ITEM_POSTFACH] : []),
      ITEM_DASHBOARD, myProfile, ITEM_HILFE,
    ];
  }
  // Mitarbeiter (staff, kein CP)
  if (isStaff(member)) {
    return [
      ITEM_MITARBEITER, ITEM_AUFGIESER, ITEM_FEED, ITEM_SPIELE,
      ITEM_DM, ITEM_BEWERTEN, ITEM_WM,
      ...(hasEmailAccount ? [ITEM_POSTFACH] : []),
      ITEM_DASHBOARD, myProfile, ITEM_HILFE,
    ];
  }

  // Gast
  if (isGast(member)) {
    return [
      ITEM_GAST, ITEM_AUFGIESER, ITEM_FEED, ITEM_SPIELE, ITEM_DM,
      ITEM_WM, ITEM_DASHBOARD, ITEM_TOUR, myProfile, ITEM_HILFE,
    ];
  }
  // Fan
  if (isFan(member)) {
    return [
      ITEM_FAN, ITEM_AUFGIESER, ITEM_FEED, ITEM_SPIELE, ITEM_DM,
      ITEM_WM, ITEM_DASHBOARD, myProfile, ITEM_HILFE,
    ];
  }

  // Aufgießer (member + is_aufgieser oder guest_aufgieser)
  if (isAufgieser(member)) {
    return [
      ITEM_PLANNER, ITEM_BEWERTEN, ITEM_AUFGIESER, ITEM_FEED,
      ITEM_SPIELE, ITEM_DM, ITEM_MEMBERS, ITEM_WM,
      ...(hasEmailAccount ? [ITEM_POSTFACH] : []),
      ITEM_DASHBOARD, myProfile, ITEM_HILFE,
    ];
  }

  // Mitglied ohne is_aufgieser (Helfer / Unterstützer)
  if (isVereinsMitglied(member)) {
    return [
      ITEM_UNTERSTUETZER, ITEM_AUFGIESER, ITEM_FEED, ITEM_SPIELE,
      ITEM_DM, ITEM_BEWERTEN, ITEM_MEMBERS, ITEM_WM,
      ...(hasEmailAccount ? [ITEM_POSTFACH] : []),
      ITEM_DASHBOARD, myProfile, ITEM_HILFE,
    ];
  }

  // Fallback (z.B. pending approval) — minimaler Set
  return [
    ITEM_AUFGIESER, ITEM_FEED, ITEM_DASHBOARD, myProfile, ITEM_HILFE,
  ];
}
