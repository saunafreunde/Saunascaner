import { Link } from 'react-router-dom';
import { useCurrentMember, useBrandSettings, brandAssetUrl } from '@/lib/api';
import { isAufgieser } from '@/lib/roles';
import { MemberQuickNav } from '@/components/MemberQuickNav';
import { LogoutButton } from '@/components/LogoutButton';
import { PageBackground } from '@/components/PageBackground';
import { MyPresenceToggle } from '@/components/MyPresenceToggle';
import { PreviewBanner } from '@/components/PreviewBanner';
import { MiniDashboardTimeline } from '@/components/MiniDashboardTimeline';
import { AvailabilityCalendar } from '@/components/staff/AvailabilityCalendar';
import { WeeklyPlanDownload } from '@/components/staff/WeeklyPlanDownload';

// /mitarbeiter — Personal-Bereich (role='staff').
// Bewusst auf das Nötigste reduziert (User-Wunsch): NUR
//   1. Heute auf der Tafel · 2. Anwesenheit („Ich bin da") · 3. Wochenplan-PDF · 4. Meine Verfügbarkeit
// Kein Check-in-PIN (Anwesenheit nur per Button), keine Schicht-Tausch-/Notification-/Push-/Quick-Link-Module.
// Doppelrolle: wer zusätzlich Aufgießer ist, kann oben in den Aufgießer-Bereich wechseln.
export default function Mitarbeiter() {
  const me = useCurrentMember();
  const brand = useBrandSettings();

  const orgName = brand.data?.org?.name ?? 'Saunafreunde Schwarzwald e.V.';
  const logoUrl = brand.data?.logo?.icon ? brandAssetUrl(brand.data.logo.icon) : '/icons/icon-512.png';
  const alsoAufgieser = isAufgieser(me.data);

  return (
    <PageBackground page="planner" variant="soft" className="min-h-screen">
      <PreviewBanner />
      <header className="sticky top-0 z-30 mx-auto w-full max-w-[1200px] flex items-center gap-3 bg-forest-950/85 backdrop-blur-xl px-4 py-3 ring-1 ring-forest-800/40">
        <img src={logoUrl ?? '/icons/icon-512.png'} alt={orgName} className="h-10 w-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-forest-100 truncate">
            Hallo {me.data?.name ?? 'Mitarbeiter'} 👨‍🍳
          </h1>
          <p className="text-[11px] text-forest-400 truncate">Personal-Bereich</p>
        </div>
        <MemberQuickNav myMemberId={me.data?.id ?? null} />
        <LogoutButton />
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 space-y-6">
        {/* Doppelrolle: Umschalter in den Aufgießer-Bereich */}
        {alsoAufgieser && (
          <Link
            to="/planner"
            className="flex items-center justify-between gap-3 rounded-2xl bg-amber-500/15 ring-1 ring-amber-500/40 px-4 py-3 hover:bg-amber-500/25 transition"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold text-amber-100">🧖 Zum Aufgießer-Bereich</div>
              <div className="text-[11px] text-amber-200/70 truncate">Du bist auch Aufgießer — hier geht’s zu deinem eigenen Bereich.</div>
            </div>
            <span className="text-amber-200 text-lg flex-shrink-0">→</span>
          </Link>
        )}

        {/* 1. Heute auf der Tafel */}
        <MiniDashboardTimeline />

        {/* 2. Anwesenheit — „Ich bin da" ist die einzige Präsenz-Meldung fürs Personal */}
        <MyPresenceToggle />

        {/* 3. Wochenplan als PDF */}
        <WeeklyPlanDownload />

        {/* 4. Meine Verfügbarkeit (Monatsansicht, Stunden-Slots) */}
        <AvailabilityCalendar />
      </main>
    </PageBackground>
  );
}
