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
  useHolidaySet,
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
import type { Sauna, Infusion } from '@/types/database';
// Stage komplett eingebunden — User-Wunsch: Scenes/Themes UND Effekte
// sollen auf der Tafel sichtbar sein.

// AdSidebar (Werbe-Spalten) entfernt — Sauna-Tiles bekommen jetzt die
// volle Breite, damit Attribute-Badges + Aufgieser-Info sichtbar sind.

// ─── Helper: Cross-Sauna-Aktivität zu einer Slot-Zeit ────────────────────
// Wird im EmptyTile-Riff gebraucht: Fische schwimmen in Richtung der
// Sauna die zur gleichen Slot-Zeit aktiv ist + Leit-Text "→ Jetzt bei …".
// Direction: links (sort_order kleiner) → other ist rechts, sonst links.
function findOtherSaunaActivityAt(
  ownSaunaId: string,
  slotTime: Date,
  saunas: Sauna[],
  infusions: Infusion[],
): { saunaName: string; tempLabel: string; direction: 'left' | 'right' } | null {
  const ownSauna = saunas.find((s) => s.id === ownSaunaId);
  if (!ownSauna) return null;
  // Suche eine andere Sauna mit Aufguss innerhalb von [-5 min, +60 min]
  // um den Slot-Start. Personal-Fallbacks zählen mit — auch sie laufen.
  const slotMs = slotTime.getTime();
  const matches = infusions.filter((i) => {
    if (i.sauna_id === ownSaunaId) return false;
    const start = new Date(i.start_time).getTime();
    return start >= slotMs - 5 * 60_000 && start <= slotMs + 60 * 60_000;
  });
  if (matches.length === 0) return null;
  // Direkt-benachbarte aktive Sauna nehmen (sort_order Differenz minimal)
  matches.sort((a, b) => {
    const sa = saunas.find((s) => s.id === a.sauna_id)?.sort_order ?? 0;
    const sb = saunas.find((s) => s.id === b.sauna_id)?.sort_order ?? 0;
    return Math.abs(sa - ownSauna.sort_order) - Math.abs(sb - ownSauna.sort_order);
  });
  const target = saunas.find((s) => s.id === matches[0].sauna_id);
  if (!target) return null;
  const direction: 'left' | 'right' =
    ownSauna.sort_order < target.sort_order ? 'right' : 'left';
  return {
    saunaName: target.name,
    tempLabel: target.temperature_label,
    direction,
  };
}

export default function Dashboard() {
  useWakeLock(true);
  // 1s-Tick auf der Tafel, damit der nächste Aufguss ZÜGIG nachrutscht wenn
  // ein laufender endet (vorher 5s → spürbarer "klebt"-Effekt).
  const now = useNow(1_000);
  const saunas = useSaunas();
  const infusions = useInfusions();
  const members = useMeisterDirectory();
  const evac = useActiveEvacuation();
  const brand = useBrandSettings();
  const scheduleQ = useScheduleSettings();
  const holidaySet = useHolidaySet();
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
  // Tagesabschluss-Screen läuft im festen Zeitfenster 20:15–21:15
  // (User-Wunsch). Vorher wird der normale Plan gezeigt (auch wenn
  // alle heutigen Aufgüsse schon durch sind), danach (ab 21:15)
  // wechselt SaunaTileColumn auf den nächsten Tag (siehe
  // NEXT_DAY_SWITCH_TOTAL_MINUTES dort).
  const showEndOfDay = useMemo(() => {
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const START = 20 * 60 + 15; // 20:15
    const END   = 21 * 60 + 15; // 21:15
    if (totalMinutes < START || totalMinutes >= END) return false;
    // Zusätzlich: nur zeigen wenn heute echte Aufgüsse waren — sonst
    // wäre die Verabschiedung ohne Statistik-Inhalt sinnlos.
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const todayInfs = allInfusions.filter((i) => {
      if (i.is_personal_fallback) return false;
      const s = new Date(i.start_time);
      return s >= today && s < tomorrow;
    });
    return todayInfs.length > 0;
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
          holidaySet={holidaySet}
          /* Für die Riff-Animation im EmptyTile: pro leerem Slot wird
             geprüft, ob die andere Sauna zur gleichen Zeit einen
             Aufguss hat. Wenn ja → Fische schwimmen dort hin + Leit-Text. */
          otherSaunaInfo={(slot) => findOtherSaunaActivityAt(saunaId, slot, activeSaunas, allInfusions)}
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
