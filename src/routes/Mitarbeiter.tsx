import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { differenceInMinutes } from 'date-fns';
import {
  useCurrentMember, useInfusions, useSaunas, useMeisterDirectory,
  useBrandSettings, brandAssetUrl,
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
import { AvailabilityCalendar } from '@/components/staff/AvailabilityCalendar';
import { MyShiftsList } from '@/components/staff/MyShiftsList';
import { OpenCancellationsList } from '@/components/staff/OpenCancellationsList';
import { SwapRequestsList } from '@/components/staff/SwapRequestsList';
import { fmtClock } from '@/lib/time';

// /mitarbeiter — Bereich für role='staff' Personal.
// Layout-Reihenfolge (Phase-2-Refactor):
//   1. Notfall-Button ganz oben (sofort erreichbar)
//   2. Mini-Tafel als Timeline (statt TV-Tafel-Link — auf Handy unleserlich)
//   3. Anwesenheit + PIN kompakt nebeneinander
//   4. Personal-Fallback-Slots (Personal muss durchführen, nicht „übernehmen")
//   5. Push-Aktivierung
//   6. Quick-Links (Aufgießer / WM / Hilfe — Tafel-Link entfernt)
//
// Personal bewertet KEINE Aufgüsse — kein PendingRatingsBlock im Bereich.
export default function Mitarbeiter() {
  const me = useCurrentMember();
  const infusions = useInfusions();
  const saunas = useSaunas();
  const meisterDir = useMeisterDirectory();
  const brand = useBrandSettings();

  const orgName = brand.data?.org?.name ?? 'Saunafreunde Schwarzwald e.V.';
  const logoUrl = brand.data?.logo?.icon ? brandAssetUrl(brand.data.logo.icon) : '/icons/icon-512.png';

  // Personal-Fallback-Slots heute + morgen (36h-Horizont)
  const fallbackSlots = useMemo(() => {
    const now = Date.now();
    const upper = now + 36 * 3600 * 1000;
    return (infusions.data ?? [])
      .filter((i) => i.is_personal_fallback)
      .filter((i) => {
        const t = new Date(i.start_time).getTime();
        return t > now && t < upper;
      })
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
  }, [infusions.data]);

  const meisterName = (id: string | null) =>
    (id && meisterDir.data?.find((mm) => mm.id === id)?.name) || 'unbesetzt';
  const saunaById = (id: string) => saunas.data?.find((s) => s.id === id);

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
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 space-y-6">
        {/* 1. Notfall-Button — ganz oben, sofort erreichbar */}
        <EvacuationAlarmButton />

        {/* 2. Notifications-Inbox (nur sichtbar bei pending Items) */}
        <NotificationsInbox />

        {/* 3. Offene Absagen — sofort sichtbar, damit andere übernehmen können */}
        <OpenCancellationsList />

        {/* 4. Mini-Tafel: kompakte Timeline statt TV-Tafel-Link */}
        <MiniDashboardTimeline />

        {/* 5. Anwesenheit + PIN kompakt */}
        <div className="grid sm:grid-cols-2 gap-4">
          <MyPresenceToggle />
          <MyCheckinPinCard />
        </div>

        {/* 6. Meine Schichten (eigene zukünftige + Cancel/Swap-Buttons) */}
        <MyShiftsList />

        {/* 7. Tausch-Anfragen (eingehende + ausgehende) */}
        <SwapRequestsList />

        {/* 8. Meine Verfügbarkeit (60 Tage voraus) */}
        <AvailabilityCalendar />

        {/* 4. Personal-Fallback-Slots — Pflicht-Durchführung */}
        <section className="rounded-3xl bg-forest-950/85 ring-1 ring-amber-500/30 p-5">
          <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
                🔥 Personal-Aufgüsse durchführen
              </h2>
              <p className="text-[11px] text-forest-400 mt-0.5">
                Garantie-Slots der nächsten 36 Stunden, für die kein Aufgießer eingetragen ist — du führst sie durch.
              </p>
            </div>
            <Link
              to="/planner"
              className="rounded-lg bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-amber-500/30"
            >
              Im Planner ansehen →
            </Link>
          </div>

          {fallbackSlots.length === 0 ? (
            <p className="text-center text-sm text-forest-400 py-4">
              Keine offenen Personal-Slots in den nächsten 36 Stunden. ✓
            </p>
          ) : (
            <ul className="space-y-2">
              {fallbackSlots.map((i) => {
                const sauna = saunaById(i.sauna_id);
                const minsTill = differenceInMinutes(new Date(i.start_time), new Date());
                return (
                  <li key={i.id}>
                    <Link
                      to="/planner"
                      className="flex items-center gap-3 rounded-xl bg-forest-900/60 ring-1 ring-forest-800/40 px-4 py-3 hover:ring-amber-500/50 transition"
                    >
                      <div
                        className="h-10 w-1.5 rounded-full flex-shrink-0"
                        style={{ background: sauna?.accent_color ?? '#22c55e' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-forest-100">
                          {sauna?.name ?? 'Sauna'} · {fmtClock(i.start_time)}–{fmtClock(i.end_time)}
                          {i.temperature_c && <span className="ml-2 text-amber-300">{i.temperature_c}°C</span>}
                        </div>
                        <div className="text-xs text-forest-400">
                          {new Date(i.start_time).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                          {' · '}
                          aktuell: {meisterName(i.saunameister_id)}
                        </div>
                      </div>
                      <span className="rounded-full bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap">
                        in {minsTill < 60 ? `${minsTill}m` : minsTill < 1440 ? `${Math.round(minsTill/60)}h` : `${Math.round(minsTill/1440)}d`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 5. Push-Aktivierung */}
        {me.data && (
          <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
              🔔 Benachrichtigungen
            </h2>
            <p className="text-xs text-forest-300/80 mb-4 leading-relaxed">
              Bei neuen Personal-Slots + Notfall-Alarm sofort informiert werden.
            </p>
            <PushPermission memberId={me.data.id} />
          </section>
        )}

        {/* 6. Quick-Links — Tafel-Link entfernt (Mini-Tafel oben ersetzt ihn) */}
        <section className="grid grid-cols-3 gap-3">
          <Link to="/aufgieser" className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4 text-center hover:ring-amber-500/40 transition">
            <div className="text-2xl">🌟</div>
            <div className="mt-1 text-xs font-semibold text-forest-100">Aufgießer</div>
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
