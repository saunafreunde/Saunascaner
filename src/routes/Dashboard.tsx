import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { differenceInMinutes } from 'date-fns';
import { useNow } from '@/hooks/useNow';
import { useWakeLock } from '@/hooks/useWakeLock';
import { WeatherWidget } from '@/components/WeatherWidget';
import { ConnectionIndicator } from '@/components/ConnectionIndicator';
import { PageBackground } from '@/components/PageBackground';
import { EvacuationOverlay } from '@/components/EvacuationOverlay';
import { BirthdayBanner } from '@/components/BirthdayBanner';
import { fmtClock } from '@/lib/time';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  useSaunas,
  useInfusions,
  useMeisterDirectory,
  useActiveEvacuation,
  useTvSettings,
  publicAssetUrl,
  useCoAufgieser,
  useAllMembersBadges,
  useBirthdaysToday,
} from '@/lib/api';
import { ALL_BADGES } from '@/lib/badges';
import type { BadgeDefinition } from '@/lib/badges';
import { unlockAudio } from '@/lib/evacuation';
import { ParticleCanvas } from '@/components/ParticleCanvas';
import { SaunaTileColumn } from '@/components/SaunaTileColumn';
import { CuckooDoor, type ZwergMood } from '@/components/CuckooDoor';
import { onDemo } from '@/lib/demoChannel';

// ── Werbe-Sidebar: 3× 16:9 Tafeln ────────────────────────────────────────────
function AdSidebar({ urls }: { urls: string[] }) {
  const items = urls.length > 0 ? urls.slice(0, 3) : [null, null, null];
  return (
    <aside className="w-[300px] flex-shrink-0 flex flex-col gap-3 justify-start">
      {items.map((url, i) => (
        <div
          key={i}
          className="aspect-video w-full rounded-2xl overflow-hidden bg-forest-950/60 ring-1 ring-forest-800/40 flex items-center justify-center"
        >
          {url ? (
            <img src={url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-forest-500/40 text-xs uppercase tracking-widest">Werbefläche</span>
          )}
        </div>
      ))}
    </aside>
  );
}

export default function Dashboard() {
  useWakeLock(true);
  const now = useNow(20_000);
  const saunas = useSaunas();
  const infusions = useInfusions();
  const members = useMeisterDirectory();
  const evac = useActiveEvacuation();
  const tv = useTvSettings();
  const allBadgesQ = useAllMembersBadges();
  const birthdays = useBirthdaysToday();

  const [audioReady, setAudioReady] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [zwergMood, setZwergMood] = useState<ZwergMood>('idle');

  const teamInfusionIds = useMemo(
    () => (infusions.data ?? []).filter((i) => i.team_infusion).map((i) => i.id),
    [infusions.data]
  );
  const coAufgieserQ = useCoAufgieser(teamInfusionIds);

  const coNamesForInfusion = (infusionId: string): string[] =>
    (coAufgieserQ.data ?? [])
      .filter((c) => c.infusion_id === infusionId)
      .map((c) => c.member_name ?? '?');

  const activeSaunas = useMemo(
    () => (saunas.data ?? []).filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [saunas.data]
  );

  const meisterName = (id: string | null) =>
    (id && members.data?.find((m) => m.id === id)?.name) || 'Saunameister:in';

  const tierOrder: Record<string, number> = { platinum: 4, gold: 3, silver: 2, bronze: 1, special: 0 };

  const meisterBadges = (id: string | null): BadgeDefinition[] => {
    if (!id || !allBadgesQ.data) return [];
    const earned = new Set(
      allBadgesQ.data.filter((a) => a.member_id === id).map((a) => a.badge_id)
    );
    return ALL_BADGES
      .filter((b) => earned.has(b.id))
      .sort((a, b) => (tierOrder[b.tier] ?? 0) - (tierOrder[a.tier] ?? 0))
      .slice(0, 3);
  };

  // ── Kuckuckstür-Logik ──────────────────────────────────────────────────
  const nextInfusion = useMemo(() =>
    (infusions.data ?? [])
      .filter((i) => new Date(i.start_time) > now)
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))
      .at(0) ?? null,
    [infusions.data, now]
  );

  const minutesUntilNext = nextInfusion
    ? differenceInMinutes(new Date(nextInfusion.start_time), now)
    : 999;

  const isRunning = useMemo(() =>
    (infusions.data ?? []).some((i) => {
      const s = new Date(i.start_time);
      const e = new Date(i.end_time);
      return now >= s && now <= e;
    }),
    [infusions.data, now]
  );

  const hasBirthday = (birthdays.data ?? []).length > 0;

  useEffect(() => {
    if (evac.data) { setZwergMood('fleeing'); setDoorOpen(true); return; }
    setZwergMood(hasBirthday ? 'birthday' : 'waving');
    setDoorOpen(!isRunning && minutesUntilNext > 20);
  }, [isRunning, minutesUntilNext, evac.data, hasBirthday]);

  const handleDoorToggle = () => setDoorOpen((prev) => !prev);

  // ── Demo-Channel Listener ──────────────────────────────────────────────
  useEffect(() => {
    return onDemo(async (e) => {
      switch (e.type) {
        case 'door_open':  setDoorOpen(true);  break;
        case 'door_close': setDoorOpen(false); break;
        case 'mood':
          setZwergMood(e.mood);
          setDoorOpen(true);
          break;
        case 'confetti': {
          const { fireBadgeUnlock } = await import('@/lib/confetti');
          fireBadgeUnlock();
          break;
        }
        case 'reset':
          setZwergMood('waving');
          break;
      }
    });
  }, []);

  useEffect(() => { if (audioReady) unlockAudio(); }, [audioReady]);

  const adImageUrls = (tv.data?.ads ?? [])
    .map((a) => publicAssetUrl(a.image_path))
    .filter((u): u is string => Boolean(u));

  const allInfusions = infusions.data ?? [];

  // ── Layout je nach Sauna-Anzahl ──────────────────────────────────────
  const renderMain = () => {
    if (activeSaunas.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center text-3xl text-forest-300/70">
          Heute keine Saunen aktiv.
        </div>
      );
    }

    const column = (idx: number) => (
      <SaunaTileColumn
        key={activeSaunas[idx].id}
        sauna={activeSaunas[idx]}
        infusions={allInfusions}
        meisterName={meisterName}
        meisterBadges={meisterBadges}
        coNames={coNamesForInfusion}
        now={now}
      />
    );

    if (activeSaunas.length === 1) {
      // 1 Sauna: [Werbung] [Sauna mittig] [Werbung]
      return (
        <>
          <AdSidebar urls={adImageUrls} />
          {column(0)}
          <AdSidebar urls={adImageUrls} />
        </>
      );
    }

    if (activeSaunas.length === 2) {
      // 2 Saunen: [Sauna 1] [Werbung Mitte] [Sauna 2]
      return (
        <>
          {column(0)}
          <AdSidebar urls={adImageUrls} />
          {column(1)}
        </>
      );
    }

    // 3+ Saunen: alle Saunen + Werbung rechts
    return (
      <>
        {activeSaunas.map((_, i) => column(i))}
        <AdSidebar urls={adImageUrls} />
      </>
    );
  };

  return (
    <PageBackground page="dashboard" variant="strong" className="h-screen overflow-hidden flex flex-col">
      <ParticleCanvas activeSaunaCount={activeSaunas.length} />
      <AnimatePresence>
        {evac.data && (
          <EvacuationOverlay
            triggeredBy={members.data?.find((m) => m.id === evac.data!.triggered_by)?.name ?? null}
            withSiren={audioReady}
          />
        )}
      </AnimatePresence>

      {!audioReady && !evac.data && (
        <button
          onClick={() => { if (unlockAudio()) setAudioReady(true); }}
          className="fixed bottom-4 left-4 z-50 rounded-full bg-forest-900/80 px-4 py-2 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900"
          title="Einmal klicken um Sirene-Sound zu aktivieren (Browser-Schutz)"
        >
          🔊 Ton aktivieren
        </button>
      )}

      {/* Header — 3 Bereiche: links Schriftzug, mittig Logo, rechts Wetter + Uhr */}
      <header className="flex-shrink-0 mx-auto w-full max-w-[1920px] grid grid-cols-3 items-center px-8 pt-5 pb-3">
        <div className="flex items-baseline gap-3 justify-self-start">
          <h1 className="text-3xl font-semibold tracking-tight text-forest-100 drop-shadow">
            Saunafreunde Schwarzwald
          </h1>
          <ConnectionIndicator online={isSupabaseConfigured && !saunas.isError && !infusions.isError} />
        </div>

        <div className="justify-self-center">
          <img
            src="/icons/icon-512.png"
            alt="Saunafreunde Logo"
            className="h-14 w-14 rounded-xl ring-1 ring-forest-700/40 shadow-lg"
          />
        </div>

        <div className="flex items-center gap-4 justify-self-end">
          <WeatherWidget />
          <span className="rounded-xl bg-forest-950/70 px-4 py-2 text-2xl font-semibold tabular-nums ring-1 ring-forest-800/60">
            {fmtClock(now)}
          </span>
        </div>
      </header>

      <BirthdayBanner />

      <main className="flex-1 min-h-0 mx-auto w-full max-w-[1920px] px-6 pb-6 flex gap-4">
        {renderMain()}
      </main>

      {/* Sauna-Zwerg / Kuckuckstür — schwebt unten rechts */}
      <div className="fixed bottom-4 right-4 z-30 pointer-events-none">
        <div className="pointer-events-auto">
          <CuckooDoor
            isOpen={doorOpen}
            mood={zwergMood}
            minutesUntilNext={minutesUntilNext}
            nextTitle={nextInfusion?.title ?? ''}
            onClick={handleDoorToggle}
          />
        </div>
      </div>
    </PageBackground>
  );
}
