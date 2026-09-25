import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useMemo } from 'react';
import { useRealtimeSync } from '@/hooks/useRealtime';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentMember, wartetAufMitglied, useActiveEvacuation, useEndEvacuation, useKioskSperreStatus, useKioskGeraetStatus, type KioskDisplay } from '@/lib/api';
import { isSupabaseConfigured } from '@/lib/supabase';
import { kioskGeraetToken } from '@/lib/kioskGeraet';
import { useApplyStoredTheme } from '@/components/ThemeToggle';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { EvacuationOverlay } from '@/components/EvacuationOverlay';
import { AreaHubGate } from '@/components/AreaHubGate';
import { AppReloadWatcher } from '@/components/AppReloadWatcher';
import { ErrorBoundary, TafelErrorFallback } from '@/components/ErrorBoundary';
import { useAutoCheckin } from '@/hooks/useAutoCheckin';
import { useFullscreenLock } from '@/hooks/useFullscreenLock';
import { JokerSchoner, KioskBlende } from '@/components/kiosk/JokerSchoner';

// Routen ohne Bottom-Nav: TV/Tablet-Layouts + Auth-Flows
const NO_BOTTOM_NAV_PATHS = [
  '/dashboard', '/scanner', '/oil-room',
  '/willkommen',
  '/checkin', '/checkin/signup', '/checkin/rate',
  '/gast-signup', '/login', '/forgot', '/reset-password',
  '/panel', '/koppeln',
  '/datenschutz',
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

// Eingangs-/Gäste-Tablet: /willkommen ⇄ /checkin ⇄ /checkin/signup sind EIN
// durchgehender Kiosk-Bildschirm. useFullscreenLock() muss darum hier leben
// statt in den einzelnen Routen-Komponenten — sonst verlässt der Hook beim
// Unmount jeder Einzelseite das Vollbild und der nächste Tap muss es erst
// wieder neu erzwingen (Vorbild für das Muster: OilRoom.tsx). Solange der
// Pfad in der Liste bleibt, bleibt dieselbe Runner-Instanz gemountet.
const KIOSK_FULLSCREEN_PATHS = ['/willkommen', '/checkin', '/checkin/signup'];

function KioskFullscreenRunner() {
  useFullscreenLock();
  return null;
}

function KioskFullscreenGate() {
  const { pathname } = useLocation();
  if (!KIOSK_FULLSCREEN_PATHS.includes(pathname)) return null;
  return <KioskFullscreenRunner />;
}

// Joker-Sperre aller Displays (Migrationen 0153–0155): ist die Sauna zu, liegt
// der Joker über TV-Tafel, Eingangs-Tablet, Öl-Raum-Tablet und Scanner. Ob
// gesperrt ist, entscheidet der Server (60 min vor dem ersten bis 30 min nach dem
// letzten Aufguss-Slot); freigeben kann
// nur ein Admin über die App. Die Abfrage läuft NUR auf den Display-Pfaden
// (eigener Runner, damit der Hook woanders gar nicht erst pollt).
//  • Status lädt noch      → dunkle Blende (nach einem Neuladen ist nichts kurz bedienbar)
//  • Abfrage scheitert ganz → offen lassen: ein Serverfehler darf die Displays am
//    Tag nicht aussperren. Ein späterer Aussetzer ändert nichts — react-query
//    behält den letzten bekannten Stand.
const DISPLAY_SPERRE_PFADE: Record<string, KioskDisplay> = {
  '/willkommen': 'eingang',
  '/checkin': 'eingang',
  '/checkin/signup': 'eingang',
  '/dashboard': 'tafel',
  '/oil-room': 'oelraum',
  '/scanner': 'scanner',
};

function KioskSperreRunner({ display }: { display: KioskDisplay }) {
  const status = useKioskSperreStatus();
  const evac = useActiveEvacuation();
  // Evakuierung geht vor: der Schoner blendet #root aus, und der Alarm lebt
  // darin — also weicht der Joker, solange ein Alarm läuft.
  if (evac.data) return null;
  if (status.data?.gesperrt) {
    return (
      <JokerSchoner
        display={display}
        oeffnetUm={status.data.oeffnet_um}
        beruehrungen={status.data.beruehrungen}
        letztesDisplay={status.data.letztes_display}
        uhrVersatzMs={typeof status.data.jetzt_ms === 'number' ? status.data.jetzt_ms - status.dataUpdatedAt : 0}
      />
    );
  }
  if (!status.data && status.isLoading) return <KioskBlende />;
  return null;
}

function KioskSperreGate() {
  const { pathname } = useLocation();
  const display = DISPLAY_SPERRE_PFADE[pathname];
  if (!isSupabaseConfigured || !display) return null;
  return <KioskSperreRunner display={display} />;
}

// Eager-loaded routes (für sofortige Verfügbarkeit)
// src/routes/Guest.tsx (öffentlicher Aufgussplan als Startseite) hat seit
// 16.08.2026 keinen Aufrufer mehr — die Wurzel führt jetzt zur Anmeldung.
// Die Datei bleibt vorerst stehen, falls die öffentliche Ansicht zurück soll.
import Login from '@/routes/Login';
import PendingApproval from '@/routes/PendingApproval';
import KontoGesperrt from '@/routes/KontoGesperrt';

// Lazy-loaded routes (nach Bedarf)
const Dashboard       = lazy(() => import('@/routes/Dashboard'));
const Scanner         = lazy(() => import('@/routes/Scanner'));
const Planner         = lazy(() => import('@/routes/Planner'));
const Admin           = lazy(() => import('@/routes/Admin'));
const OilRoom         = lazy(() => import('@/routes/OilRoom'));
const Profile         = lazy(() => import('@/routes/Profile'));
const Members         = lazy(() => import('@/routes/Members'));
const Postfach        = lazy(() => import('@/routes/Postfach'));
const Help            = lazy(() => import('@/routes/Help'));
const ForgotPassword  = lazy(() => import('@/routes/ForgotPassword'));
const ResetPassword   = lazy(() => import('@/routes/ResetPassword'));
const MagicEntry      = lazy(() => import('@/routes/MagicEntry'));
const GastSignup      = lazy(() => import('@/routes/GastSignup'));
const Datenschutz     = lazy(() => import('@/routes/Datenschutz'));
const GastHome        = lazy(() => import('@/routes/Gast'));
const CheckinPin      = lazy(() => import('@/routes/CheckinPin'));
const CheckinSignup   = lazy(() => import('@/routes/CheckinSignup'));
const Willkommen      = lazy(() => import('@/routes/Willkommen'));
const Unterstuetzer   = lazy(() => import('@/routes/Unterstuetzer'));
const Mitarbeiter     = lazy(() => import('@/routes/Mitarbeiter'));
const Cp              = lazy(() => import('@/routes/Cp'));
const AufgieserStars  = lazy(() => import('@/routes/AufgieserStars'));
const StarProfile     = lazy(() => import('@/routes/StarProfile'));
const Feed            = lazy(() => import('@/routes/Feed'));
const Bewerten        = lazy(() => import('@/routes/Bewerten'));
const Games           = lazy(() => import('@/routes/Games'));
const GameSolo        = lazy(() => import('@/routes/GameSolo'));
const GameMatch       = lazy(() => import('@/routes/GameMatch'));
const GameKart        = lazy(() => import('@/routes/GameKart'));
const Dm              = lazy(() => import('@/routes/Dm'));
const DmConversation  = lazy(() => import('@/routes/DmConversation'));
const AnwesenheitsPanel = lazy(() => import('@/routes/AnwesenheitsPanel'));
const Koppeln         = lazy(() => import('@/routes/Koppeln'));

export default function App() {
  useRealtimeSync();
  useApplyStoredTheme();
  useAutoCheckin();   // Migration 0108+0109: opt-in Auto-Check-in via WLAN-Subnet
  return (
    <>
    {/* Evakuierungs-Alarm und Neuladen-Signal liegen AUSSERHALB der
        App-Root-Grenze (Audit 25.09.2026): Stürzt eine Seite ab (z. B. ein
        fehlender Programmteil nach einem Deploy), hängte die Grenze bisher
        beide mit aus — kein Alarm-Overlay, kein app_force_reload_at mehr.
        Jeder bekommt eine eigene kleine Grenze, damit sein eigener Absturz
        nicht die ganze App weiß macht; sie versucht es nach kurzer Zeit neu. */}
    <ErrorBoundary label="Evakuierung" autoResetMs={15_000} fallback={() => null}>
      <GlobalEvacuationOverlay />
    </ErrorBoundary>
    <ErrorBoundary label="Neuladen-Signal" autoResetMs={60_000} fallback={() => null}>
      <AppReloadWatcher />
    </ErrorBoundary>
    {/* FIX 0107 (Audit Phase 4 CRITICAL): outer ErrorBoundary verhindert
        weiße Seite wenn irgendein Route-Subtree crasht. Dashboard hat extra
        eine spezielle Tafel-Boundary (siehe Route /dashboard). */}
    <ErrorBoundary label="App-Root" autoResetMs={0}>
    <Suspense fallback={<Splash />}>
      <div className="pb-[calc(env(safe-area-inset-bottom)+72px)] lg:pb-0 min-h-full">
        <Routes>
          <Route path="/" element={<RootEntry />} />
        {/* FIX 0107 (Audit Phase 4 CRITICAL): Dashboard hat eigene ErrorBoundary,
            damit ein Render-Crash in Stage/SaunaTileColumn nicht den 85"-TV weiß macht.
            Nach 60 s geht es weiter — das steuert TafelErrorFallback (zurücksetzen
            oder, bei fehlendem Programmteil / Dauerabsturz, neu laden). Deshalb
            hier autoResetMs={0}: ein eigener 60-s-Reset käme dem Neuladen zuvor. */}
        <Route path="/dashboard" element={
          <ErrorBoundary label="Dashboard" autoResetMs={0} fallback={(err, reset) => <TafelErrorFallback error={err} reset={reset} />}>
            <Dashboard />
          </ErrorBoundary>
        } />
        {/* Kiosk-Geräte (Scanner, Öl-Raum, Panel, Eingangs-Tablet) stehen ohne
            Aufsicht: eigene Grenze, die sich nach 60 s selbst zurücksetzt, statt
            bis zum nächsten Antippen die Fehlerkarte zu zeigen (Audit 25.09.2026).
            Der Absturz wird gemeldet (lib/fehlerbericht). */}
        <Route path="/scanner"   element={<ErrorBoundary label="Scanner" autoResetMs={60_000}><Scanner /></ErrorBoundary>} />
        <Route path="/planner"   element={<RequireAuth><Planner /></RequireAuth>} />
        <Route path="/admin"     element={<RequireAdmin><Admin /></RequireAdmin>} />
        <Route path="/oil-room"  element={<ErrorBoundary label="Öl-Raum" autoResetMs={60_000}><OilRoom /></ErrorBoundary>} />
        <Route path="/profile/:memberId" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/members"           element={<RequireAuth><Members /></RequireAuth>} />
        <Route path="/postfach"          element={<RequireAuth><Postfach /></RequireAuth>} />
        <Route path="/hilfe"             element={<RequireAuth><Help /></RequireAuth>} />
        <Route path="/gast"                  element={<RequireAuth><GastHome /></RequireAuth>} />
        {/* /fan gibt es seit 0132 nicht mehr — alte Lesezeichen und Mail-Links
            sollen trotzdem irgendwo landen statt im 404. */}
        <Route path="/fan"                   element={<Navigate to="/gast" replace />} />
        <Route path="/unterstuetzer"         element={<RequireAuth><Unterstuetzer /></RequireAuth>} />
        <Route path="/mitarbeiter"           element={<RequireAuth><Mitarbeiter /></RequireAuth>} />
        <Route path="/cp"                    element={<RequireAuth><Cp /></RequireAuth>} />
        <Route path="/aufgieser"             element={<RequireAuth><AufgieserStars /></RequireAuth>} />
        <Route path="/aufgieser/:memberId"   element={<RequireAuth><StarProfile /></RequireAuth>} />
        <Route path="/feed"                  element={<RequireAuth><Feed /></RequireAuth>} />
        <Route path="/bewerten"              element={<RequireAuth><Bewerten /></RequireAuth>} />
        <Route path="/spiele"                element={<RequireAuth><Games /></RequireAuth>} />
        <Route path="/spiele/solo/:kind"     element={<RequireAuth><GameSolo /></RequireAuth>} />
        <Route path="/spiele/match/:matchId" element={<RequireAuth><GameMatch /></RequireAuth>} />
        <Route path="/spiele/kart"           element={<RequireAuth><GameKart /></RequireAuth>} />
        <Route path="/dm"                    element={<RequireAuth><Dm /></RequireAuth>} />
        <Route path="/dm/:conversationId"    element={<RequireAuth><DmConversation /></RequireAuth>} />
        {/* /panel — anonymer Desktop-Hub für Anwesenheit, nur auf einem gekoppelten Gerät (0177) */}
        <Route path="/panel"                 element={<ErrorBoundary label="Panel" autoResetMs={60_000}><AnwesenheitsPanel /></ErrorBoundary>} />
        {/* /koppeln#<code> — Kiosk-Gerät koppeln (Einmal-Link aus Admin → Displays → Kiosk-Geräte, 0191) */}
        <Route path="/koppeln"               element={<Koppeln />} />
        <Route path="/login"          element={<Login />} />
        <Route path="/forgot"         element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/gast-signup"    element={<GastSignup />} />
        {/* Öffentliche Datenschutzerklärung — muss VOR dem Signup lesbar sein (DSGVO) */}
        <Route path="/datenschutz"    element={<Datenschutz />} />
        <Route path="/willkommen"     element={<ErrorBoundary label="Eingang" autoResetMs={60_000}><Willkommen /></ErrorBoundary>} />
        <Route path="/checkin"        element={<ErrorBoundary label="Eingang" autoResetMs={60_000}><CheckinPin /></ErrorBoundary>} />
        <Route path="/checkin/signup" element={<ErrorBoundary label="Eingang" autoResetMs={60_000}><CheckinSignup /></ErrorBoundary>} />
        {/* /checkin/rate ist mit 0137 entfallen — das Tablet bewertet jetzt
            direkt unter /checkin, ohne Anmeldung. Alte Lesezeichen und der
            Tablet-Browser sollen trotzdem irgendwo landen. */}
        <Route path="/checkin/rate"   element={<Navigate to="/checkin" replace />} />
        <Route path="/me"             element={<Navigate to="/planner" replace />} />
        <Route path="/m/:code"        element={<MagicEntry />} />
        <Route path="/dev"       element={<RequireAdmin><DevIndex /></RequireAdmin>} />
        <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
        <AreaHubGate />
      </div>
      <BottomNavGate />
      <KioskFullscreenGate />
      <KioskSperreGate />
    </Suspense>
    </ErrorBoundary>
    </>
  );
}

// Root-Eintrag bei "/": leitet jede Rolle in ihren Bereich weiter.
//
// Wer NICHT angemeldet ist, landet seit dem 16.08.2026 direkt auf der
// Anmeldung (Vorgabe). Vorher stand hier der öffentliche Aufgussplan — der
// war damit die Startseite der App, obwohl er das 85"-Display im
// Vereinsraum ist. Die Tafel selbst bleibt unter /dashboard öffentlich
// erreichbar, sie muss ohne Anmeldung laufen.
//
// Im PWA-Standalone-Modus (Home-Bildschirm-Icon) geht es für Aufgießer
// direkt in den Planner; iOS ignoriert `start_url` aus dem Manifest
// weitgehend, diese Runtime-Erkennung schließt die Lücke.
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
  // Auch direkt nach dem Login warten, bis die Mitgliederzeile da ist (Audit 25.09.2026).
  if (user && wartetAufMitglied(member)) return <Splash />;
  // Gesperrte Konten (Admin → „Sperren") sehen nur den Sperrhinweis (0192).
  if (user && member.data?.revoked_at) return <KontoGesperrt />;

  // Eingeloggte Gäste → eigener Bereich /gast.
  // Die Rolle 'fan' wird seit 0132 nicht mehr vergeben; sollte doch noch ein
  // Altbestand auftauchen, landet er hier ebenfalls richtig.
  if (user && (member.data?.role === 'gast' || member.data?.role === 'fan')) {
    return <Navigate to="/gast" replace />;
  }

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

  // Eingeloggte Aufgießer/Admins im Browser → Planner
  if (user && member.data) return <Navigate to="/planner" replace />;

  // Nicht angemeldet → Anmeldung. Der öffentliche Aufgussplan war hier bis
  // 16.08.2026 die Startseite; er lebt weiter unter /dashboard (Vereins-TV).
  return <Navigate to="/login" replace />;
}

// Pfade die Gäste nicht erreichen dürfen (Aktiv-Mitglieder-only)
const GAST_BLOCKED_PATHS = ['/planner', '/members', '/postfach'];

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  const member = useCurrentMember();
  const loc = useLocation();
  if (!isSupabaseConfigured) return <NotConfigured />;
  if (!ready || (user && wartetAufMitglied(member))) return <Splash />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname.startsWith('/') ? loc.pathname : '/')}`} replace />;
  // Seit 25.09.2026 ist „kein Mitglied" null statt eines NULL-Objekts: eine
  // Anmeldung ohne Mitgliederzeile landet wie bisher bei „wartet auf Freigabe".
  // Bei einem Netzfehler ohne Daten die Seite dagegen normal zeigen.
  // Gesperrte Konten zuerst: Der Server lehnt für sie jedes Schreiben ab (0192).
  if (member.data?.revoked_at) return <KontoGesperrt />;
  if ((member.data && !member.data.approved) || (member.isSuccess && !member.data)) return <PendingApproval />;
  // Gäste haben keinen Zugriff auf interne Mitglieder-Routen — Redirect zum Gäste-Bereich.
  // 'fan' wird seit 0132 nicht mehr vergeben, wird hier aber wie 'gast' behandelt,
  // damit ein etwaiger Altbestand nicht in einer Sackgasse landet.
  if ((member.data?.role === 'gast' || member.data?.role === 'fan')
      && GAST_BLOCKED_PATHS.some((p) => loc.pathname.startsWith(p))) {
    return <Navigate to="/gast" replace />;
  }
  // Nicht-Aufgießer-Mitglieder gehören in den Unterstützer-Bereich, nicht in /planner.
  // Der Hash wandert mit: Push/Posteingang verlinken /planner#saunafest, und die
  // Saunafest-Zone gibt es auch in /unterstuetzer, /mitarbeiter und /cp.
  if (
    member.data?.role === 'member' && !member.data.is_aufgieser
    && loc.pathname === '/planner'
  ) {
    return <Navigate to={`/unterstuetzer${loc.hash}`} replace />;
  }
  // Staff (Mitarbeiter) gehört in /mitarbeiter, nicht in /planner —
  // AUSSER Doppelrolle: Personal, das auch Aufgießer ist, darf den Aufgießer-Bereich nutzen.
  if (member.data?.role === 'staff' && !member.data?.is_aufgieser && loc.pathname === '/planner') {
    return <Navigate to={`/mitarbeiter${loc.hash}`} replace />;
  }
  // /cp-Bereich nur für CP-Verantwortliche (staff + is_personal_planer) + Admin (Preview)
  if (loc.pathname.startsWith('/cp')
      && member.data?.role !== 'admin'
      && !member.data?.is_personal_planer) {
    return <Navigate to={member.data?.role === 'staff' ? '/mitarbeiter' : '/'} replace />;
  }
  // /mitarbeiter-Bereich nur für Staff + Admin (Preview) — Defense-in-Depth analog /cp.
  // Backend-RPCs blocken zwar Schreibzugriffe, aber Nicht-Staff sollen Personal-interne
  // Infos (offene Schichten o.ä.) gar nicht erst zu sehen bekommen.
  if (loc.pathname.startsWith('/mitarbeiter')
      && member.data?.role !== 'staff'
      && member.data?.role !== 'admin') {
    return <Navigate to="/" replace />;
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
// (NICHT für Gast/Fan/anon) und für gekoppelte Kiosk-Geräte (0177) — sonst
// könnte ein Gast den Notfall stoppen. Der Server prüft dasselbe
// (evakuierung_beenden).
// Wichtig: auf Mobile blockt der Vollbild-Overlay alle anderen Beenden-Buttons,
// daher MUSS der Button im Overlay selbst sein.
function GlobalEvacuationOverlay() {
  const evac = useActiveEvacuation();
  const loc = useLocation();
  const me = useCurrentMember();
  const end = useEndEvacuation();
  const geraet = useKioskGeraetStatus();

  if (loc.pathname.startsWith('/dashboard')) return null;
  if (!evac.data) return null;

  const role = me.data?.role;
  // Alle Vereinsmitglieder dürfen beenden: Admin, Personal, ALLE Mitglieder
  // (Helfer + Aufgießer), Gast-Aufgießer, gekoppelte Geräte.
  // Ausgeschlossen: anon ohne Kopplung, gast, fan.
  // Scheiterte die Geräteprüfung (Netz kurz weg), aber ein Token liegt vor:
  // Knopf trotzdem zeigen — evakuierung_beenden prüft das Token ohnehin, und
  // ein gekoppeltes Tablet darf nicht eine Stunde lang ohne Beenden dastehen.
  const canEnd = role === 'admin' || role === 'staff'
    || role === 'member' || role === 'guest_aufgieser'
    || geraet.data?.status === 'ok'
    || (!geraet.data && geraet.isError && !!kioskGeraetToken());

  return (
    <EvacuationOverlay
      triggeredBy={null}
      withSiren
      onEnd={canEnd ? async () => { await end.mutateAsync(evac.data!.id); } : undefined}
      // Versandstand (Push + Telegram) nur für die, die handeln können.
      versand={canEnd ? { status: evac.data.telegram_status, seit: evac.data.triggered_at } : undefined}
    />
  );
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  const member = useCurrentMember();
  const loc = useLocation();
  if (!isSupabaseConfigured) return <NotConfigured />;
  if (!ready || (user && wartetAufMitglied(member))) return <Splash />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname.startsWith('/') ? loc.pathname : '/')}`} replace />;
  if (member.data?.revoked_at) return <KontoGesperrt />;
  if (!member.data?.approved) return <PendingApproval />;
  if (member.data?.role !== 'admin') return <NoAccess />;
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
