import { Link } from 'react-router-dom';
import {
  useCurrentMember, useBrandSettings, brandAssetUrl,
} from '@/lib/api';
import { MemberQuickNav } from '@/components/MemberQuickNav';
import { PageBackground } from '@/components/PageBackground';
import { MyPresenceToggle } from '@/components/MyPresenceToggle';
import { MyCheckinPinCard } from '@/components/MyCheckinPinCard';
import { EvacuationAlarmButton } from '@/components/EvacuationAlarmButton';
import { PushPermission } from '@/components/PushPermission';
import { PreviewBanner } from '@/components/PreviewBanner';
import { MiniDashboardTimeline } from '@/components/MiniDashboardTimeline';
import { NotificationsInbox } from '@/components/staff/NotificationsInbox';
import { PersonalShiftPlanner } from '@/components/cp/PersonalShiftPlanner';
import { AttendanceExportSection } from '@/components/cp/AttendanceExportSection';
import { RatingsAnonymousOverview } from '@/components/cp/RatingsAnonymousOverview';
import { MonthlyHoursOverview } from '@/components/cp/MonthlyHoursOverview';
import { AvailabilityOverview } from '@/components/cp/AvailabilityOverview';

// /cp — Bereich für role='staff' + is_personal_planer=true (CP-Verantwortlicher).
// Hat alles vom Mitarbeiter (PIN, Anwesenheit, Notfall, Mini-Tafel) PLUS:
// - Personal-Schicht-Planung
// - Anwesenheits-Export (CSV)
// - Anonymisierte Bewertungs-Übersicht (ohne Aufgießer-Namen)
//
// Notfall-Button steht ganz oben — kritischer Trigger muss sofort erreichbar sein.
export default function Cp() {
  const me = useCurrentMember();
  const brand = useBrandSettings();

  const orgName = brand.data?.org?.name ?? 'Saunafreunde Schwarzwald e.V.';
  const logoUrl = brand.data?.logo?.icon ? brandAssetUrl(brand.data.logo.icon) : '/icons/icon-512.png';

  return (
    <PageBackground page="planner" variant="soft" className="min-h-screen">
      <PreviewBanner />
      <header className="sticky top-0 z-30 mx-auto w-full max-w-[1200px] flex items-center gap-3 bg-forest-950/85 backdrop-blur-xl px-4 py-3 ring-1 ring-forest-800/40">
        <img src={logoUrl ?? '/icons/icon-512.png'} alt={orgName} className="h-10 w-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-forest-100 truncate">
            Hallo {me.data?.name ?? 'CP-Verantwortlicher'} 🛠️
          </h1>
          <p className="text-[11px] text-forest-400 truncate">CP-Verantwortlicher · Personal-Planung & Auswertung</p>
        </div>
        <MemberQuickNav myMemberId={me.data?.id ?? null} />
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 space-y-6">
        {/* Notfall-Button — ganz oben, sofort erreichbar */}
        <EvacuationAlarmButton />

        {/* Notifications-Inbox (Tausch-Vorgänge, Absagen, Übernahmen) */}
        <NotificationsInbox />

        {/* Mini-Tafel: ganzer Tag im Überblick */}
        <MiniDashboardTimeline />

        {/* Anwesenheits-Toggle + PIN */}
        <div className="grid sm:grid-cols-2 gap-4">
          <MyPresenceToggle />
          <MyCheckinPinCard />
        </div>

        {/* Monats-Stunden + Euro-Verteilung pro Mitarbeiter */}
        <MonthlyHoursOverview />

        {/* Verfügbarkeits-Übersicht aller Mitarbeiter (14 Tage) */}
        <AvailabilityOverview />

        {/* Personal-Schicht-Planung */}
        <PersonalShiftPlanner />

        {/* Anwesenheits-Export */}
        <AttendanceExportSection />

        {/* Anonymisierte Bewertungs-Übersicht */}
        <RatingsAnonymousOverview />

        {/* Push-Aktivierung */}
        {me.data && (
          <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
              🔔 Benachrichtigungen
            </h2>
            <p className="text-xs text-forest-300/80 mb-4 leading-relaxed">
              Bei Notfall-Alarm und neuen Personal-Slots sofort informiert werden.
            </p>
            <PushPermission memberId={me.data.id} />
          </section>
        )}

        {/* Quick-Links — Tafel-Link bewusst entfernt, da auf Mobile unleserlich.
            Die Mini-Tafel oben ersetzt diese Verlinkung. */}
        <section className="grid grid-cols-3 gap-3">
          <Link to="/mitarbeiter" className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4 text-center hover:ring-amber-500/40 transition">
            <div className="text-2xl">👨‍🍳</div>
            <div className="mt-1 text-xs font-semibold text-forest-100">Mitarbeiter</div>
          </Link>
          <Link to="/wm" className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4 text-center hover:ring-amber-500/40 transition">
            <div className="text-2xl">🏆</div>
            <div className="mt-1 text-xs font-semibold text-forest-100">WM</div>
          </Link>
          <Link to="/hilfe" className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4 text-center hover:ring-amber-500/40 transition">
            <div className="text-2xl">📖</div>
            <div className="mt-1 text-xs font-semibold text-forest-100">Hilfe</div>
          </Link>
        </section>
      </main>
    </PageBackground>
  );
}
