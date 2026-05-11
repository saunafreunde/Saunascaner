import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
} from '@/lib/api';
import { ALL_BADGES } from '@/lib/badges';
import type { BadgeDefinition } from '@/lib/badges';
import { unlockAudio } from '@/lib/evacuation';
// Browser blockiert Audio bis zum ersten Klick — wir versuchen es deshalb
// stillschweigend bei jeder Interaktion zu entsperren, ohne sichtbaren Button.
import { ParticleCanvas } from '@/components/ParticleCanvas';
import { SaunaTileColumn } from '@/components/SaunaTileColumn';
import { CuckooDoor } from '@/components/CuckooDoor';
import { BlockhausScene } from '@/components/BlockhausScene';
import { Holzfaeller } from '@/components/Holzfaeller';
import { Reh } from '@/components/Reh';
import { GapBridge } from '@/components/GapBridge';
import { Gliders } from '@/components/Gliders';
import { BackdropMountains } from '@/components/BackdropMountains';
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
  const now = useNow(5_000);
  const saunas = useSaunas();
  const infusions = useInfusions();
  const members = useMeisterDirectory();
  const evac = useActiveEvacuation();
  const tv = useTvSettings();
  const allBadgesQ = useAllMembersBadges();

  const [audioReady, setAudioReady] = useState(false);

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

  const meisterMeta = (id: string | null) => {
    const m = id ? members.data?.find((x) => x.id === id) : undefined;
    if (!m) return undefined;
    return { isGuest: m.role === 'guest_aufgieser', homeGroup: m.home_group };
  };

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

  // ── Demo-Channel Listener — Tür/Zwerg-Funktion entfernt, nur noch Konfetti
  useEffect(() => {
    return onDemo(async (e) => {
      if (e.type === 'confetti') {
        const { fireBadgeUnlock } = await import('@/lib/confetti');
        fireBadgeUnlock();
      }
    });
  }, []);

  // Audio still beim ersten User-Klick irgendwo im Dokument entsperren —
  // ohne den nervenden 'Ton aktivieren'-Button.
  useEffect(() => {
    const tryUnlock = () => {
      if (unlockAudio()) setAudioReady(true);
      document.removeEventListener('pointerdown', tryUnlock);
    };
    document.addEventListener('pointerdown', tryUnlock, { once: false });
    return () => document.removeEventListener('pointerdown', tryUnlock);
  }, []);

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

    const column = (idx: number) => {
      const saunaId = activeSaunas[idx].id;
      return (
        <SaunaTileColumn
          key={saunaId}
          sauna={activeSaunas[idx]}
          infusions={allInfusions}
          meisterName={meisterName}
          meisterBadges={meisterBadges}
          meisterMeta={meisterMeta}
          coNames={coNamesForInfusion}
          now={now}
          tileBgs={tv.data?.tile_bgs?.[saunaId] ?? []}
        />
      );
    };

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

      {/* Header — Uhr links (+ 2. Uhr 10min vor Aufguss), Logo mittig, Wetter rechts */}
      <header className="flex-shrink-0 mx-auto w-full max-w-[1920px] grid grid-cols-3 items-center px-8 pt-8 pb-3">
        <div className="justify-self-start flex items-center gap-3">
          <span className="rounded-xl bg-forest-950/70 px-4 py-2 text-2xl font-semibold tabular-nums ring-1 ring-forest-800/60">
            {fmtClock(now)}
          </span>
          <AnimatePresence>
            {minutesUntilNext > 0 && minutesUntilNext <= 10 && nextInfusion && (
              <motion.div
                initial={{ width: 0, opacity: 0, scale: 0.85 }}
                animate={{ width: 'auto', opacity: 1, scale: 1 }}
                exit={{ width: 0, opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <div
                  className="rounded-xl px-4 py-2 ring-1 backdrop-blur whitespace-nowrap"
                  style={{
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(8,18,12,0.65))',
                    boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.4), 0 0 22px rgba(245,158,11,0.18)',
                  }}
                >
                  <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300/80 leading-none">
                    Nächster Aufguss
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold tabular-nums text-amber-200 leading-none">
                      {fmtClock(nextInfusion.start_time)}
                    </span>
                    <motion.span
                      animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="text-xs font-semibold text-amber-300 leading-none"
                    >
                      in {minutesUntilNext} Min
                    </motion.span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="justify-self-center">
          <img
            src={tv.data?.logo_path ? (publicAssetUrl(tv.data.logo_path) ?? '/icons/icon-512.png') : '/icons/icon-512.png'}
            alt="Saunafreunde Schwarzwald"
            className="h-24 w-auto rounded-2xl drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]"
          />
        </div>

        <div className="flex items-center gap-4 justify-self-end">
          <WeatherWidget />
        </div>
      </header>

      <BirthdayBanner />

      <main className="flex-1 min-h-0 mx-auto w-full max-w-[1920px] px-6 pb-32 flex gap-4">
        {renderMain()}
      </main>

      {/* Schwarzwald-Bühne unten: Holzfäller · Wald-Pfad · Kuckuckhaus · Spielplatz · Reh */}
      <div className="fixed inset-x-0 bottom-2 z-30 pointer-events-none">
        {/* Durchgängige Bergkette + Wald-Saum als globaler Backdrop hinter allen Szenen */}
        <BackdropMountains />
        {/* Zwei Segelflieger ziehen leise über den ganzen Schwarzwald */}
        <Gliders />
        <div className="relative mx-auto w-full max-w-[1920px] px-8 flex items-end justify-center gap-0">
          {/* Holzfäller links */}
          <div className="flex-shrink-0">
            <Holzfaeller scale={1.0} />
          </div>

          {/* Wald-Pfad zwischen Holzfäller und Sauna */}
          <GapBridge variant="forest" />

          {/* Blockhaus-Szene mittig: Hütte + Teich + Bank + Angler + Bäume */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <ConnectionIndicator online={isSupabaseConfigured && !saunas.isError && !infusions.isError} />
            <BlockhausScene>
              <CuckooDoor scale={0.72} />
            </BlockhausScene>
          </div>

          {/* Kinderspielplatz zwischen Sauna und Reh */}
          <GapBridge variant="playground" />

          {/* Reh rechts */}
          <div className="flex-shrink-0">
            <Reh scale={1.0} />
          </div>
        </div>
      </div>
    </PageBackground>
  );
}
