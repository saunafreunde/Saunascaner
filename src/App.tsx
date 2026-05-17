import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useMemo } from 'react';
import { useRealtimeSync } from '@/hooks/useRealtime';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentMember, useActiveEvacuation, useEndEvacuation } from '@/lib/api';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useApplyStoredTheme } from '@/components/ThemeToggle';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { EvacuationOverlay } from '@/components/EvacuationOverlay';

// Routen ohne Bottom-Nav: TV/Tablet-Layouts + Auth-Flows + Welcome-Tour
const NO_BOTTOM_NAV_PATHS = [
  '/dashboard', '/scanner', '/oil-room',
  '/checkin', '/checkin/signup', '/checkin/rate',
  '/gast-signup', '/login', '/forgot', '/reset-password',
  '/tour',
  '/m/',
];

function shouldShowBottomNav(pathname: string): boolean {
  return !NO_BOTTOM_NAV_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/') || (p.endsWith('/') && pathname.startsWith(p)));
}

function BottomNavGate() {
  const { pathname } = useLocation();
  if (!shouldShowBottomNav(pathname)) return null;
  return <MobileBottomNav />;
}

// Eager-loaded routes (für sofortige Verfügbarkeit)
import Guest from '@/routes/Guest';
import Login from '@/routes/Login';
import PendingApproval from '@/routes/PendingApproval';

// Lazy-loaded routes (nach Bedarf)
const Dashboard       = lazy(() => import('@/routes/Dashboard'));
const Scanner         = lazy(() => import('@/routes/Scanner'));
const Planner         = lazy(() => import('@/routes/Planner'));
const Admin           = lazy(() => import('@/routes/Admin'));
const OilRoom         = lazy(() => import('@/routes/OilRoom'));
const Wm              = lazy(() => import('@/routes/Wm'));
const Profile         = lazy(() => import('@/routes/Profile'));
const Members         = lazy(() => import('@/routes/Members'));
const Postfach        = lazy(() => import('@/routes/Postfach'));
const Help            = lazy(() => import('@/routes/Help'));
const ForgotPassword  = lazy(() => import('@/routes/ForgotPassword'));
const ResetPassword   = lazy(() => import('@/routes/ResetPassword'));
const MagicEntry      = lazy(() => import('@/routes/MagicEntry'));
const GastSignup      = lazy(() => import('@/routes/GastSignup'));
const GastHome        = lazy(() => import('@/routes/Gast'));
const FanHome         = lazy(() => import('@/routes/Fan'));
const CheckinPin      = lazy(() => import('@/routes/CheckinPin'));
const CheckinSignup   = lazy(() => import('@/routes/CheckinSignup'));
const CheckinRate     = lazy(() => import('@/routes/CheckinRate'));
const Unterstuetzer   = lazy(() => import('@/routes/Unterstuetzer'));
const Mitarbeiter     = lazy(() => import('@/routes/Mitarbeiter'));
const Cp              = lazy(() => import('@/routes/Cp'));
const AufgieserStars  = lazy(() => import('@/routes/AufgieserStars'));
const StarProfile     = lazy(() => import('@/routes/StarProfile'));
const Feed            = lazy(() => import('@/routes/Feed'));
const Bewerten        = lazy(() => import('@/routes/Bewerten'));
const Tour            = lazy(() => import('@/routes/Tour'));

export default function App() {
  useRealtimeSync();
  useApplyStoredTheme();
  return (
    <Suspense fallback={<Splash />}>
      <GlobalEvacuationOverlay />
      <div className="pb-[calc(env(safe-area-inset-bottom)+72px)] lg:pb-0 min-h-full">
        <Routes>
          <Route path="/" element={<RootEntry />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/scanner"   element={<Scanner />} />
        <Route path="/planner"   element={<RequireAuth><Planner /></RequireAuth>} />
        <Route path="/admin"     element={<RequireAdmin><Admin /></RequireAdmin>} />
        <Route path="/oil-room"  element={<OilRoom />} />
        <Route path="/wm"        element={<RequireAuth><Wm /></RequireAuth>} />
        <Route path="/profile/:memberId" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/members"           element={<RequireAuth><Members /></RequireAuth>} />
        <Route path="/postfach"          element={<RequireAuth><Postfach /></RequireAuth>} />
        <Route path="/hilfe"             element={<RequireAuth><Help /></RequireAuth>} />
        <Route path="/gast"                  element={<RequireAuth><GastHome /></RequireAuth>} />
        <Route path="/fan"                   element={<RequireAuth><FanHome /></RequireAuth>} />
        <Route path="/unterstuetzer"         element={<RequireAuth><Unterstuetzer /></RequireAuth>} />
        <Route path="/mitarbeiter"           element={<RequireAuth><Mitarbeiter /></RequireAuth>} />
        <Route path="/cp"                    element={<RequireAuth><Cp /></RequireAuth>} />
        <Route path="/aufgieser"             element={<RequireAuth><AufgieserStars /></RequireAuth>} />
        <Route path="/aufgieser/:memberId"   element={<RequireAuth><StarProfile /></RequireAuth>} />
        <Route path="/feed"                  element={<RequireAuth><Feed /></RequireAuth>} />
        <Route path="/bewerten"              element={<RequireAuth><Bewerten /></RequireAuth>} />
        <Route path="/tour"                  element={<Tour />} />
        <Route path="/login"          element={<Login />} />
        <Route path="/forgot"         element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/gast-signup"    element={<GastSignup />} />
        <Route path="/checkin"        element={<CheckinPin />} />
        <Route path="/checkin/signup" element={<CheckinSignup />} />
        <Route path="/checkin/rate"   element={<CheckinRate />} />
        <Route path="/me"             element={<Navigate to="/planner" replace />} />
        <Route path="/m/:code"        element={<MagicEntry />} />
        <Route path="/dev"       element={<RequireAdmin><DevIndex /></RequireAdmin>} />
        <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNavGate />
    </Suspense>
  );
}

// Root-Eintrag bei "/": wenn die App im PWA-Standalone-Modus läuft
// (Home-Bildschirm-Icon angetippt), direkt zum Planner weiterleiten.
// iOS ignoriert das `start_url` aus dem Manifest weitgehend — diese
// Runtime-Erkennung schließt die Lücke. Im normalen Browser bleibt
// der Gast-Auftritt aktiv.
function RootEntry() {
  const { ready, user } = useAuth();
  const member = useCurrentMember();
  const isStandalone = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const displayStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: minimal-ui)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches;
    return iosStandalone || displayStandalone;
  }, []);

  // Wenn User eingeloggt ist: warten bis member.data geladen — sonst Race auf Tafel
  if (user && !ready) return <Splash />;
  if (user && member.isLoading) return <Splash />;

  // Eingeloggte Gäste → eigener Bereich /gast
  if (user && member.data?.role === 'gast') return <Navigate to="/gast" replace />;

  // Eingeloggte Fans (Förderer) → eigener Bereich /fan
  if (user && member.data?.role === 'fan') return <Navigate to="/fan" replace />;

  // CP-Verantwortlicher (Staff + is_personal_planer) → /cp als Default
  if (user && member.data?.role === 'staff' && member.data.is_personal_planer) {
    return <Navigate to="/cp" replace />;
  }

  // Mitarbeiter (Staff) → eigener Bereich /mitarbeiter
  if (user && member.data?.role === 'staff') return <Navigate to="/mitarbeiter" replace />;

  // Nicht-Aufgießer-Mitglieder → Unterstützer-Bereich
  if (user && member.data?.role === 'member' && !member.data.is_aufgieser) {
    return <Navigate to="/unterstuetzer" replace />;
  }

  // Standalone-PWA: eingeloggte Aufgießer/Gast-Aufgießer/Admin → /planner
  if (isStandalone && user && member.data) return <Navigate to="/planner" replace />;

  // Sonst: öffentliche Aufguss-Tafel
  return <Guest />;
}

// Pfade die Gäste UND Fans nicht erreichen dürfen (Aktiv-Mitglieder-only)
const GAST_BLOCKED_PATHS = ['/planner', '/members', '/postfach'];

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  const member = useCurrentMember();
  const loc = useLocation();
  if (!isSupabaseConfigured) return <NotConfigured />;
  if (!ready || (user && member.isLoading)) return <Splash />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname.startsWith('/') ? loc.pathname : '/')}`} replace />;
  if (member.data && !member.data.approved) return <PendingApproval />;
  // Gäste haben keinen Zugriff auf interne Mitglieder-Routen — Redirect zum Gäste-Bereich
  if (member.data?.role === 'gast' && GAST_BLOCKED_PATHS.some((p) => loc.pathname.startsWith(p))) {
    return <Navigate to="/gast" replace />;
  }
  // Fans haben die gleichen Blockaden wie Gäste (kein Planner/Members/Postfach), aber eigenen Bereich
  if (member.data?.role === 'fan' && GAST_BLOCKED_PATHS.some((p) => loc.pathname.startsWith(p))) {
    return <Navigate to="/fan" replace />;
  }
  // Fan-Bereich nur für Fan+ — Gast darf nicht (Premium-Content). Member+ dürfen lesen (Read-Only Vorschau).
  if (loc.pathname.startsWith('/fan')
      && member.data?.role === 'gast') {
    return <Navigate to="/gast" replace />;
  }
  // Echte Gäste sollten nicht im Fan-Bereich landen, echte Fans nicht im Gast-Bereich
  if (loc.pathname.startsWith('/gast') && member.data?.role === 'fan') {
    return <Navigate to="/fan" replace />;
  }
  // Nicht-Aufgießer-Mitglieder gehören in den Unterstützer-Bereich, nicht in /planner
  if (
    member.data?.role === 'member' && !member.data.is_aufgieser
    && loc.pathname === '/planner'
  ) {
    return <Navigate to="/unterstuetzer" replace />;
  }
  // Staff (Mitarbeiter) gehört in /mitarbeiter, nicht in /planner
  if (member.data?.role === 'staff' && loc.pathname === '/planner') {
    return <Navigate to="/mitarbeiter" replace />;
  }
  // /cp-Bereich nur für CP-Verantwortliche (staff + is_personal_planer) + Admin (Preview)
  if (loc.pathname.startsWith('/cp')
      && member.data?.role !== 'admin'
      && !member.data?.is_personal_planer) {
    return <Navigate to={member.data?.role === 'staff' ? '/mitarbeiter' : '/'} replace />;
  }
  return <>{children}</>;
}

// Globaler Evakuierungs-Overlay: aktiv auf JEDER Route außer /dashboard
// (Dashboard hat seinen eigenen Audio-aware Overlay).
// Triggert sobald useActiveEvacuation einen Eintrag liefert (Realtime via
// useRealtimeSync → evacuation_events-Subscription). Der Overlay legt sich
// als Fullscreen z-9999 über ALLES — egal welcher User eingeloggt ist
// (auch nicht-eingeloggte Gäste auf öffentlichen Routen sehen den Alarm).
//
// "Alarm beenden"-Button im Overlay: nur für authentifizierte Vereinsmitglieder
// (NICHT für Gast/Fan/anon) — sonst könnte ein Gast den Notfall stoppen.
// Wichtig: auf Mobile blockt der Vollbild-Overlay alle anderen Beenden-Buttons,
// daher MUSS der Button im Overlay selbst sein.
function GlobalEvacuationOverlay() {
  const evac = useActiveEvacuation();
  const loc = useLocation();
  const me = useCurrentMember();
  const end = useEndEvacuation();

  if (loc.pathname.startsWith('/dashboard')) return null;
  if (!evac.data) return null;

  const role = me.data?.role;
  // Alle Vereinsmitglieder dürfen beenden: Admin, Personal, ALLE Mitglieder
  // (Helfer + Aufgießer), Gast-Aufgießer. Ausgeschlossen: anon, gast, fan.
  const canEnd = role === 'admin' || role === 'staff'
    || role === 'member' || role === 'guest_aufgieser';

  return (
    <EvacuationOverlay
      triggeredBy={null}
      withSiren
      onEnd={canEnd ? async () => { await end.mutateAsync(evac.data!.id); } : undefined}
    />
  );
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  const member = useCurrentMember();
  const loc = useLocation();
  if (!isSupabaseConfigured) return <NotConfigured />;
  if (!ready || member.isLoading) return <Splash />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname.startsWith('/') ? loc.pathname : '/')}`} replace />;
  if (!member.data?.approved) return <PendingApproval />;
  // Admin oder WM-Admin (eingeschränkter Zugang nur auf WM-Tab; Tab-Filter regelt Sichtbarkeit)
  if (member.data?.role !== 'admin' && !member.data?.is_wm_admin) return <NoAccess />;
  return <>{children}</>;
}


function Splash() {
  return (
    <div className="grid min-h-full place-items-center bg-slate-950 text-forest-300/70">
      Lädt…
    </div>
  );
}

function NoAccess() {
  return (
    <div className="grid min-h-full place-items-center bg-slate-950 p-8 text-center">
      <div className="rounded-2xl bg-forest-950/70 p-6 ring-1 ring-forest-800/50">
        <h1 className="text-xl font-semibold text-forest-100">Kein Zugriff</h1>
        <p className="mt-2 text-sm text-forest-300/80">
          Diese Seite ist nur für Aufgieser oder Admins.
        </p>
        <Link to="/me" className="mt-4 inline-block text-sm text-forest-300 underline">Zurück zu Mein Bereich</Link>
      </div>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="grid min-h-full place-items-center bg-slate-950 p-8 text-center">
      <div className="rounded-2xl bg-forest-950/70 p-6 ring-1 ring-forest-800/50 max-w-md">
        <h1 className="text-xl font-semibold text-forest-100">Backend nicht konfiguriert</h1>
        <p className="mt-2 text-sm text-forest-300/80">
          Setze <code className="text-forest-300">VITE_SUPABASE_URL</code> und{' '}
          <code className="text-forest-300">VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code>.
        </p>
      </div>
    </div>
  );
}

function DevIndex() {
  const links = [
    ['/', 'Gäste-App'],
    ['/dashboard', 'TV-Dashboard'],
    ['/me', 'Mein Bereich (Mitglieder)'],
    ['/planner', 'Aufguss-Planung (Aufgieser)'],
    ['/oil-room', 'Öl-Raum-Tablet (Aufgieser)'],
    ['/admin', 'Admin'],
    ['/scanner', 'Scanner (Eingang)'],
    ['/wm', 'WM-Tipspiel'],
    ['/login', 'Login'],
  ] as const;
  return (
    <div className="bg-schwarzwald-soft min-h-full p-8 text-slate-100">
      <h1 className="text-2xl font-semibold mb-4 text-forest-100">Saunafreunde — Dev Index</h1>
      <ul className="space-y-2">
        {links.map(([to, label]) => (
          <li key={to}>
            <Link to={to} className="text-forest-300 hover:text-forest-100 underline">
              {label} <span className="text-forest-500">({to})</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
