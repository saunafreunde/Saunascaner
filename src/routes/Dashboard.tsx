import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNow } from '@/hooks/useNow';
import { useWakeLock } from '@/hooks/useWakeLock';
import { ConnectionIndicator } from '@/components/ConnectionIndicator';
// PageBackground bewusst nicht mehr genutzt — Tafel hat eigenes Hell-Theme
// statt der dunklen forest-Hintergründe.
import { EvacuationOverlay } from '@/components/EvacuationOverlay';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  useSaunas,
  useInfusions,
  useMeisterDirectory,
  useActiveEvacuation,
  useBrandSettings,
  publicAssetUrl,
  useCoAufgieser,
  useScheduleSettings,
} from '@/lib/api';
import { Stage } from '@/components/stage/Stage';
// ALL_BADGES / BadgeDefinition entfernt — Tafel rendert keine
// Saunameister-Auszeichnungen mehr (User-Wunsch).
import { lookupMemberName } from '@/lib/memberDisplay';
import { unlockAudio } from '@/lib/evacuation';
// Browser blockiert Audio bis zum ersten Klick — wir versuchen es deshalb
// stillschweigend bei jeder Interaktion zu entsperren, ohne sichtbaren Button.
import { ParticleCanvas } from '@/components/ParticleCanvas';
import { SaunaTileColumn } from '@/components/SaunaTileColumn';
import { EndOfDayScreen } from '@/components/EndOfDayScreen';
// Stage komplett eingebunden — User-Wunsch: Scenes/Themes UND Effekte
// sollen auf der Tafel sichtbar sein.

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
      .map((c) => {
        // c.member_name kommt aus dem PostgREST-Embedded-Join members(name).
        // Auf der ANONYMEN Tafel scheitert der Join oft (RLS auf members) →
        // member_name ist null/undefined. Fallback: über das Meister-Directory
        // (useMeisterDirectory läuft über RPC list_meister_names und ist
        // explizit anon-callable). Falls auch dort nicht gefunden (z.B. Co
        // ist Helfer ohne is_aufgieser), neutraler Fallback "Mitstreiter"
        // statt unschönem "?".
        if (c.member_name) return c.member_name;
        const fromDir = lookupMemberName(members.data, c.member_id, '');
        return fromDir || 'Mitstreiter';
      });

  const activeSaunas = useMemo(
    () => (saunas.data ?? []).filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [saunas.data]
  );

  const meisterName = (id: string | null) =>
    lookupMemberName(members.data, id, 'Saunameister:in');

  const meisterMeta = (id: string | null) => {
    const m = id ? members.data?.find((x) => x.id === id) : undefined;
    if (!m) return undefined;
    return { isGuest: m.role === 'guest_aufgieser', homeGroup: m.home_group };
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

  // ── End-of-Day-Check ────────────────────────────────────────────────
  // Tagesabschluss-Screen NUR ab 21:00 Uhr zeigen — und auch nur dann
  // wenn heute überhaupt Aufgüsse waren UND alle durch sind.
  // Vor 21:00 IMMER den normalen Plan zeigen (auch wenn aktuell leer),
  // damit der TV nicht den ganzen Nachmittag schon „Feierabend" anzeigt
  // nur weil ein früher Morgen-Aufguss vorbei ist.
  // Vorher war die Bedingung versehentlich `< 21` (zu aggressiv).
  const showEndOfDay = useMemo(() => {
    if (now.getHours() < 21) return false; // vor 21 Uhr nie EndOfDay
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const todayInfs = allInfusions.filter((i) => {
      if (i.is_personal_fallback) return false;
      const s = new Date(i.start_time);
      return s >= today && s < tomorrow;
    });
    if (todayInfs.length === 0) return false;
    const hasUpcoming = todayInfs.some((i) => new Date(i.end_time) > now);
    return !hasUpcoming;
  }, [allInfusions, now]);

  // ── Layout je nach Sauna-Anzahl ──────────────────────────────────────
  const renderMain = () => {
    if (activeSaunas.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center text-3xl text-slate-500">
          Heute keine Saunen aktiv.
        </div>
      );
    }

    // Tagesabschluss-Screen statt Sauna-Spalten wenn alle Aufgüsse durch sind
    if (showEndOfDay) {
      return (
        <EndOfDayScreen
          infusions={allInfusions}
          meisterDir={members.data ?? []}
        />
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

  // Branding-Hintergrundbild für /dashboard (admin-konfigurierbar im
  // BrandingTab). Wird zwischen den Sauna-Spalten + an den Rändern sichtbar.
  // Heller Overlay (25% weiß) damit die Glaspanels darüber lesbar bleiben.
  const dashboardBgUrl = publicAssetUrl(brand.data?.backgrounds?.dashboard ?? null);
  const tafelBg = dashboardBgUrl
    ? `linear-gradient(rgba(255,255,255,0.25), rgba(255,255,255,0.25)), url(${JSON.stringify(dashboardBgUrl)})`
    : 'linear-gradient(135deg, #fef9e7 0%, #fdf4d3 40%, #f9ecb5 100%)';

  return (
    // HELL-THEME für Tafel mit optionalem Branding-Bild als Hintergrund.
    // Stage (dunkle atmosphärische Layer) bleibt entfernt — wirkt auf hellem
    // Untergrund störend. ParticleCanvas + Connection-Indicator + Evak-Overlay
    // bleiben drin, sind in beiden Themes stimmig.
    <div
      className="h-screen overflow-hidden flex flex-col cursor-none select-none"
      style={{
        background: tafelBg,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <ParticleCanvas activeSaunaCount={activeSaunas.length} />
      <AnimatePresence>
        {evac.data && (
          <EvacuationOverlay
            triggeredBy={members.data?.find((m) => m.id === evac.data!.triggered_by)?.name ?? null}
            withSiren={audioReady}
          />
        )}
      </AnimatePresence>

      <main className="flex-1 min-h-0 w-full px-4 py-4 flex gap-4">
        {renderMain()}
      </main>

      {/* Connection-Indicator als Floating-Pixel rechts unten */}
      <div className="fixed bottom-2 right-3 z-40 pointer-events-none">
        <ConnectionIndicator online={isSupabaseConfigured && !saunas.isError && !infusions.isError} />
      </div>

      {/* TV-Vollbild-Trigger: klickbarer Button unten rechts. */}
      {!isFullscreen && !hintDismissed && (
        <button
          type="button"
          onClick={dismissHintAndTryFullscreen}
          className="fixed bottom-4 right-4 z-50 rounded-2xl bg-amber-500 px-6 py-4 text-base font-bold text-amber-950 ring-2 ring-amber-300 shadow-2xl shadow-black/30 animate-pulse cursor-pointer active:scale-95 transition"
        >
          🔳 Tippen für Vollbild · ✕ Ausblenden
        </button>
      )}

      {/* Komplette Bühne: saisonale + manuell aktivierte Scenes
          (Schnee/Holzfäller/Reh/Themes etc.) + One-Shot-Effekte
          (Feuerwerk/Konfetti/Sternschnuppe etc.). Alle self-contained
          mit fixed inset-0 und sinnvollen z-Indices.
          Admin steuert per Tab 🎭 Bühne. */}
      <Stage />
    </div>
  );
}
