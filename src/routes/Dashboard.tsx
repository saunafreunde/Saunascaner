import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNow } from '@/hooks/useNow';
import { useWakeLock } from '@/hooks/useWakeLock';
import { WeatherWidget } from '@/components/WeatherWidget';
import { ConnectionIndicator } from '@/components/ConnectionIndicator';
import { PageBackground } from '@/components/PageBackground';
import { EvacuationOverlay } from '@/components/EvacuationOverlay';
import { BirthdayBanner } from '@/components/BirthdayBanner';
import { fmtDateLongDe } from '@/lib/time';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  useSaunas,
  useInfusions,
  useMeisterDirectory,
  useActiveEvacuation,
  useBrandSettings,
  publicAssetUrl,
  useCoAufgieser,
  useAllMembersBadges,
  useScheduleSettings,
} from '@/lib/api';
import { ALL_BADGES } from '@/lib/badges';
import type { BadgeDefinition } from '@/lib/badges';
import { unlockAudio } from '@/lib/evacuation';
// Browser blockiert Audio bis zum ersten Klick — wir versuchen es deshalb
// stillschweigend bei jeder Interaktion zu entsperren, ohne sichtbaren Button.
import { ParticleCanvas } from '@/components/ParticleCanvas';
import { SaunaTileColumn } from '@/components/SaunaTileColumn';
import { Stage } from '@/components/stage/Stage';

// AdSidebar (Werbe-Spalten) entfernt — Sauna-Tiles bekommen jetzt die
// volle Breite, damit Attribute-Badges + Aufgieser-Info sichtbar sind.

export default function Dashboard() {
  useWakeLock(true);
  const now = useNow(5_000);
  const saunas = useSaunas();
  const infusions = useInfusions();
  const members = useMeisterDirectory();
  const evac = useActiveEvacuation();
  const brand = useBrandSettings();
  const allBadgesQ = useAllMembersBadges();
  const scheduleQ = useScheduleSettings();
  const tilesPerColumn = scheduleQ.data?.tiles_per_column ?? 3;
  const mondayOpen = !!scheduleQ.data?.monday_open;

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

  // TV-Vollbild: beim ersten User-Klick (OK-Taste der TV-Fernbedienung)
  // Fullscreen-API triggern. Browser-Sicherheits-Constraint: nur mit
  // User-Gesture möglich, nicht spontan beim Page-Load.
  // Plus: fullscreenchange-Listener für den Hint-Overlay.
  const HINT_STORAGE_KEY = 'dashboard_fullscreen_hint_dismissed';
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(HINT_STORAGE_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    const tryFullscreen = async () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        }
      } catch { /* TV-Browser unterstützt kein Fullscreen — ignoriert */ }
    };
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('pointerdown', tryFullscreen, { once: true });
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('pointerdown', tryFullscreen);
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, []);

  async function dismissHintAndTryFullscreen() {
    // Hint sofort ausblenden — egal ob die Browser-Fullscreen-API klappt.
    // Persistieren in localStorage damit nach Reload weg bleibt.
    setHintDismissed(true);
    try { localStorage.setItem(HINT_STORAGE_KEY, '1'); } catch { /* ignored */ }
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      }
    } catch { /* TV-Browser-App ignoriert Fullscreen-API */ }
  }

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
          tileBgs={brand.data?.tile_bgs?.[saunaId] ?? []}
          tilesPerColumn={tilesPerColumn}
          mondayOpen={mondayOpen}
        />
      );
    };

    // Alle Saunen-Spalten ohne Werbung — Tiles nutzen den ganzen TV-Platz,
    // gleichmäßig verteilt via flex-1 (auch bei 1, 2, 3+ Saunen).
    return <>{activeSaunas.map((_, i) => column(i))}</>;
  };

  return (
    <PageBackground page="dashboard" variant="strong" noImage className="h-screen overflow-hidden flex flex-col cursor-none select-none">
      <ParticleCanvas activeSaunaCount={activeSaunas.length} />
      <AnimatePresence>
        {evac.data && (
          <EvacuationOverlay
            triggeredBy={members.data?.find((m) => m.id === evac.data!.triggered_by)?.name ?? null}
            withSiren={audioReady}
          />
        )}
      </AnimatePresence>

      {/* Header — Datum links · Logo mittig · Wetter rechts.
          KEIN max-w mehr — Tafel nutzt komplette TV-Breite (auch auf 4K).
          Vorher max-w-[1920px] führte zu schwarzen Pillarbox-Rändern auf 4K-TVs. */}
      <header className="flex-shrink-0 w-full grid grid-cols-3 items-center px-8 pt-8 pb-3">
        <div className="justify-self-start">
          <div
            className="rounded-2xl bg-white/5 backdrop-blur-xl ring-1 ring-white/10 px-5 py-3"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.3)' }}
          >
            <span className="text-2xl font-semibold text-white/95 tracking-wide">
              {fmtDateLongDe(now)}
            </span>
          </div>
        </div>

        <div className="justify-self-center">
          <img
            src={(() => {
              // Banner-Variante bevorzugt für Dashboard-Header, sonst Icon
              const path = brand.data?.logo?.banner ?? brand.data?.logo?.icon;
              return path ? (publicAssetUrl(path) ?? '/icons/icon-512.png') : '/icons/icon-512.png';
            })()}
            alt="Saunafreunde Schwarzwald"
            className="h-24 w-auto rounded-2xl drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]"
          />
        </div>

        <div className="justify-self-end">
          <WeatherWidget />
        </div>
      </header>

      <BirthdayBanner />

      <main className="flex-1 min-h-0 w-full px-6 pb-4 flex gap-4">
        {renderMain()}
      </main>

      {/* Bühne: Basis (Backdrop, Sauna, Gliders) + saisonale Layer + One-Shot-Effekte.
          Steuerung im Admin-Tab „🎭 Bühne". (Migration 0071) */}
      <Stage />

      {/* Connection-Indicator als Floating-Pixel rechts unten */}
      <div className="fixed bottom-2 right-3 z-40 pointer-events-none">
        <ConnectionIndicator online={isSupabaseConfigured && !saunas.isError && !infusions.isError} />
      </div>

      {/* TV-Vollbild-Trigger: klickbarer Button unten rechts.
          Verschwindet wenn Browser-Fullscreen aktiv ODER User manuell weggeklickt
          (Klick versucht Fullscreen, blendet aber trotzdem aus — auch wenn die
          TV-Browser-App die Fullscreen-API ignoriert). Persistiert via localStorage. */}
      {!isFullscreen && !hintDismissed && (
        <button
          type="button"
          onClick={dismissHintAndTryFullscreen}
          className="fixed bottom-4 right-4 z-50 rounded-2xl bg-amber-500 px-6 py-4 text-base font-bold text-amber-950 ring-2 ring-amber-300 shadow-2xl shadow-black/60 animate-pulse cursor-pointer active:scale-95 transition"
        >
          🔳 Tippen für Vollbild · ✕ Ausblenden
        </button>
      )}
    </PageBackground>
  );
}
