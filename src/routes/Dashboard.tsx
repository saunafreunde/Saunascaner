import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
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
import { ParticleCanvas } from '@/components/ParticleCanvas';
import { SaunaTileColumn } from '@/components/SaunaTileColumn';
import { onDemo } from '@/lib/demoChannel';

export default function Dashboard() {
  useWakeLock(true);
  const now = useNow(20_000);
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

  // ── Demo-Channel Listener (nur Confetti aktiv, Rest no-op) ─────────────
  useEffect(() => {
    return onDemo(async (e) => {
      if (e.type === 'confetti') {
        const { fireBadgeUnlock } = await import('@/lib/confetti');
        fireBadgeUnlock();
      }
    });
  }, []);

  useEffect(() => { if (audioReady) unlockAudio(); }, [audioReady]);

  const adImageUrls = (tv.data?.ads ?? [])
    .map((a) => publicAssetUrl(a.image_path))
    .filter((u): u is string => Boolean(u));

  const allInfusions = infusions.data ?? [];

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
          className="fixed bottom-4 right-4 z-50 rounded-full bg-forest-900/80 px-4 py-2 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900"
          title="Einmal klicken um Sirene-Sound zu aktivieren (Browser-Schutz)"
        >
          🔊 Ton aktivieren
        </button>
      )}

      <header className="flex-shrink-0 mx-auto w-full max-w-[1920px] flex items-center justify-between px-8 pt-5 pb-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-forest-100 drop-shadow">
            Saunafreunde Schwarzwald
          </h1>
          <ConnectionIndicator online={isSupabaseConfigured && !saunas.isError && !infusions.isError} />
        </div>
        <div className="flex items-center gap-4">
          <WeatherWidget />
          <span className="rounded-xl bg-forest-950/70 px-4 py-2 text-2xl font-semibold tabular-nums ring-1 ring-forest-800/60">
            {fmtClock(now)}
          </span>
        </div>
      </header>

      <BirthdayBanner />

      <main className="flex-1 min-h-0 mx-auto w-full max-w-[1920px] px-6 pb-6 flex gap-4">
        {activeSaunas.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-3xl text-forest-300/70">
            Heute keine Saunen aktiv.
          </div>
        ) : (
          <>
            {activeSaunas.map((sauna) => (
              <SaunaTileColumn
                key={sauna.id}
                sauna={sauna}
                infusions={allInfusions}
                meisterName={meisterName}
                meisterBadges={meisterBadges}
                coNames={coNamesForInfusion}
                now={now}
              />
            ))}
            {adImageUrls.length > 0 && (
              <aside className="w-44 flex-shrink-0 flex flex-col gap-3">
                {adImageUrls.slice(0, 2).map((url, i) => (
                  <div
                    key={i}
                    className="flex-1 min-h-0 rounded-2xl overflow-hidden bg-forest-950/60 ring-1 ring-forest-800/40"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </aside>
            )}
          </>
        )}
      </main>
    </PageBackground>
  );
}
