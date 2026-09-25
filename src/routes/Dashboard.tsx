import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNow } from '@/hooks/useNow';
import { useWakeLock } from '@/hooks/useWakeLock';
import { ConnectionIndicator } from '@/components/ConnectionIndicator';
// PageBackground bewusst nicht mehr genutzt — Tafel hat eigenes Hell-Theme
// statt der dunklen forest-Hintergründe.
import { EvacuationOverlay } from '@/components/EvacuationOverlay';
import { InfoEinblendung } from '@/components/infokarte/InfoEinblendung';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  useSaunas,
  useInfusions,
  useInfusionsRange,
  useMeisterDirectory,
  useActiveEvacuation,
  useBrandSettings,
  publicAssetUrl,
  useCoAufgieser,
  useScheduleSettings,
  useHolidaySet,
  useSaunafestTage, saunafestAm,
  useSaunafestKarten, useSaunafestVideoEinstellungen,
  useKioskGesperrtMitlesen, TAFEL_FALLBACK_TAGE,
  type SaunafestTag,
} from '@/lib/api';
import { Stage } from '@/components/stage/Stage';
// ALL_BADGES / BadgeDefinition entfernt — Tafel rendert keine
// Saunameister-Auszeichnungen mehr (User-Wunsch).
import { lookupMemberName } from '@/lib/memberDisplay';
// Browser blockiert Audio bis zur ersten Bedienung — wir versuchen es deshalb
// bei jeder Interaktion zu entsperren; solange es gesperrt ist, steht unten
// links ein kleiner Hinweis.
import { useTonEntsperren } from '@/hooks/useTonEntsperren';
import { ParticleCanvas } from '@/components/ParticleCanvas';
import {
  SaunaTileColumn, festAbschluss, festZeitpunkt, type FestKartenVideo,
} from '@/components/SaunaTileColumn';
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

// ─── Saunafest: Videos der Aufguss-Karten (Migrationen 0164/0165) ────────
// Steht nur am Festtag im Baum — dadurch laufen die beiden Abfragen (Karten
// jede Minute, Admin-Schalter alle 5 min) auch NUR am Festtag und nicht an
// den übrigen 360 Tagen auf dem Fernseher mit. Die Daten gehen per
// Render-Funktion an die Spalten.
function FestVideoDaten({
  datum,
  children,
}: {
  datum: string;
  children: (d: { videos: ReadonlyMap<string, FestKartenVideo>; abspielen: boolean }) => ReactNode;
}) {
  const karten = useSaunafestKarten(datum);
  const einstellungen = useSaunafestVideoEinstellungen();
  const videos = useMemo(() => {
    const m = new Map<string, FestKartenVideo>();
    for (const k of karten.data ?? []) {
      const posterUrl = publicAssetUrl(k.poster_pfad);
      // Nur ein fertiges Video passt sicher zum Standbild. Während einer Neu-
      // Erzeugung (bild/video) und nach einem Fehler zeigt poster_pfad schon
      // bzw. noch auf ein anderes Bild als video_pfad (api/saunafest-video.ts:
      // videoSetzen setzt poster_pfad beim Bildschritt). Dann nur das Standbild.
      const videoUrl = k.video_status === 'fertig' ? publicAssetUrl(k.video_pfad) : null;
      if (posterUrl || videoUrl) m.set(k.infusion_id, { posterUrl, videoUrl });
    }
    return m;
  }, [karten.data]);
  // Bis der Schalter geladen ist (oder wenn er nicht lädt): nur Standbilder.
  // Lieber ein ruhiges Bild als ein TV-Stick, der sich an Videos verschluckt.
  const abspielen = einstellungen.data?.tafel_aktiv ?? false;
  return <>{children({ videos, abspielen })}</>;
}

const TON_HINWEIS = '🔈 Ton: OK auf der Fernbedienung drücken';

/** Hatte dieser Festtag echte Aufgüsse? (Voraussetzung für den Abschluss.) */
function festHatteAufguesse(fest: SaunafestTag, infusions: Infusion[]): boolean {
  const beginn = festZeitpunkt(fest, '00:00');
  const ende = new Date(beginn); ende.setDate(ende.getDate() + 1);
  return infusions.some((i) => {
    if (i.is_personal_fallback) return false;
    const s = new Date(i.start_time);
    return s >= beginn && s < ende;
  });
}

export default function Dashboard() {
  useWakeLock(true);
  const evac = useActiveEvacuation();
  // Liegt der Joker über der Tafel (Sauna zu)? Dann ist #root display:none —
  // das hält aber weder requestAnimationFrame noch Timer an. Also selbst
  // bremsen: Partikel aus, Uhr nur noch minütlich (vorher rechnete die ganze
  // Tafel nachts jede Sekunde neu, Audit 25.09.2026). Wie im KioskSperreRunner
  // weicht der Joker einer Evakuierung.
  const gesperrt = useKioskGesperrtMitlesen() && !evac.data;
  // 1s-Tick auf der Tafel, damit der nächste Aufguss ZÜGIG nachrutscht wenn
  // ein laufender endet (vorher 5s → spürbarer "klebt"-Effekt).
  const now = useNow(gesperrt ? 60_000 : 1_000);
  const saunas = useSaunas();
  // Personal-Fallbacks nur so weit, wie die Kacheln reichen (OilCard nutzt
  // denselben Wert — sonst liefen zwei Polls nebeneinander).
  const infusions = useInfusions({ fallbackTage: TAFEL_FALLBACK_TAGE });
  // poll: die Tafel bleibt wochenlang gemountet — Namen/Avatare, Branding
  // (auch „wichtige" Info-Karten) und Kachel-Raster müssen ohne Neuladen ankommen.
  const members = useMeisterDirectory({ poll: true });
  const brand = useBrandSettings({ poll: true });
  const scheduleQ = useScheduleSettings({ poll: true });
  const holidaySet = useHolidaySet();
  const tilesPerColumn = scheduleQ.data?.tiles_per_column ?? 3;
  const mondayOpen = !!scheduleQ.data?.monday_open;

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

  // Saunafest (0150/0152): am Festtag kommt die dritte Sauna als Spalte dazu —
  // aber erst eine Stunde vor ab_alle (Standard 17:30 → Spalte ab 16:30).
  // Vorher gäbe es dort nur leere Kacheln, und die zwei laufenden Saunen
  // müssten sich den Platz grundlos mit ihr teilen. Nach dem Tageswechsel
  // des Fests (festAbschluss().ende) verschwindet sie wieder.
  const festTage = useSaunafestTage();
  const festHeute = saunafestAm(now, festTage.data);
  const gestern = new Date(now); gestern.setDate(gestern.getDate() - 1);
  const festGestern = saunafestAm(gestern, festTage.data);

  // Fest-Tagesabschluss: beim Standard-Raster (letzter Slot 23:30) läuft er am
  // Folgetag 00:00–01:00. useInfusions kennt dann nur noch Aufgüsse, die HEUTE
  // enden — die des Fests fehlen. Deshalb für das Fest, dessen Abschluss gerade
  // läuft (bzw. in FEST_VORLAUF_MS beginnt), den ganzen Festtag eigens laden.
  // Der Schlüssel hängt nur am Datum und bleibt über Mitternacht gleich (um
  // 23:50 geladen, um 00:00 aus dem Cache). Bewusst NICHT den ganzen Festtag
  // aktiv: useInfusionsRange pollt nicht, und Realtime invalidiert nur
  // ['infusions'] — sonst zeigte der Abschluss den Stand vom Morgen.
  const FEST_VORLAUF_MS = 10 * 60_000;
  const festImAbschluss = (vorlaufMs: number): SaunafestTag | null => [festHeute, festGestern].find((f) => {
    if (!f) return false;
    const { start, ende } = festAbschluss(f);
    return now.getTime() >= start.getTime() - vorlaufMs && now.getTime() < ende.getTime();
  }) ?? null;
  const abschlussFest = festImAbschluss(FEST_VORLAUF_MS);   // steuert nur die Abfrage
  const abschlussVon = abschlussFest ? festZeitpunkt(abschlussFest, '00:00') : new Date(0);
  const abschlussBis = new Date(abschlussVon); abschlussBis.setDate(abschlussBis.getDate() + 1);
  const festAbschlussQ = useInfusionsRange(abschlussVon, abschlussBis, abschlussFest != null);
  const festJetzt = festImAbschluss(0);                     // Abschluss läuft jetzt
  const dritteSaunaId = festHeute?.dritte_sauna_id != null
    && now.getTime() >= festZeitpunkt(festHeute, festHeute.ab_alle).getTime() - 60 * 60_000
    && now.getTime() < festAbschluss(festHeute).ende.getTime()
    ? festHeute.dritte_sauna_id
    : null;
  const activeSaunas = useMemo(
    () => (saunas.data ?? [])
      .filter((s) => s.is_active || (dritteSaunaId != null && s.id === dritteSaunaId))
      .sort((a, b) => a.sort_order - b.sort_order),
    [saunas.data, dritteSaunaId]
  );

  const meisterName = (id: string | null) =>
    lookupMemberName(members.data, id, 'Saunameister:in');

  const meisterMeta = (id: string | null) => {
    const m = id ? members.data?.find((x) => x.id === id) : undefined;
    if (!m) return undefined;
    return { isGuest: m.role === 'guest_aufgieser', homeGroup: m.home_group };
  };

  // Audio (Evakuierungs-Sirene) bei der ersten echten Bedienung entsperren —
  // ohne 'Ton aktivieren'-Button. Zählt auch ein Tastendruck: viele
  // Fernbedienungen senden nur Tasten (keydown), keinen Zeiger (Audit 25.09.2026).
  // Die Sirene hängt NICHT mehr an diesem Zustand: Bis zur Audit-Runde 2 blieb
  // ein Alarm nach jedem Neuladen (Deploy-Signal!) stumm, bis jemand drückte —
  // ohne jeden Hinweis. Jetzt läuft sie immer an (notfalls stumm, hörbar ab
  // der nächsten Taste), und solange der Ton gesperrt ist, zeigt die Tafel
  // unten links „🔈 Ton: OK auf der Fernbedienung drücken".
  const tonGesperrt = useTonEntsperren();

  // TV-Vollbild: beim ersten User-Klick bzw. Tastendruck (OK-Taste der
  // TV-Fernbedienung) Fullscreen-API triggern. Browser-Sicherheits-Constraint:
  // nur mit User-Gesture möglich, nicht spontan beim Page-Load.
  // Plus: fullscreenchange-Listener für den Hint-Overlay.
  const HINT_STORAGE_KEY = 'dashboard_fullscreen_hint_dismissed';
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(HINT_STORAGE_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    const tryFullscreen = async (e: Event) => {
      // Esc ist keine Bedienung im Sinne des Browsers (und heißt „raus aus dem Vollbild").
      if (e instanceof KeyboardEvent && e.key === 'Escape') return;
      // Wertet der Browser das Ereignis nicht als Bedienung (z. B. die
      // Zurück-Taste mancher Fernbedienungen), würde requestFullscreen
      // abgelehnt — dann NICHT abmelden, sonst klappte das Vollbild auch beim
      // späteren OK/Klick nie mehr (wie beim Ton-Entsperren oben).
      const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
      if (ua && !ua.isActive) return;
      // Nur einmal: der erste Klick ODER Tastendruck zählt.
      document.removeEventListener('pointerdown', tryFullscreen);
      document.removeEventListener('keydown', tryFullscreen);
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        }
      } catch { /* TV-Browser unterstützt kein Fullscreen — ignoriert */ }
    };
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('pointerdown', tryFullscreen);
    document.addEventListener('keydown', tryFullscreen);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('pointerdown', tryFullscreen);
      document.removeEventListener('keydown', tryFullscreen);
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
  // Aufgüsse des Festtags, dessen Abschluss läuft (Rückfall: die normale Liste).
  const festTagInfs = festAbschlussQ.data ?? allInfusions;

  // ── End-of-Day-Check ────────────────────────────────────────────────
  // Tagesabschluss-Screen läuft im festen Zeitfenster 20:15–21:15
  // (User-Wunsch). Vorher wird der normale Plan gezeigt (auch wenn
  // alle heutigen Aufgüsse schon durch sind), danach (ab 21:15)
  // wechselt SaunaTileColumn auf den nächsten Tag (siehe
  // NEXT_DAY_SWITCH_TOTAL_MINUTES dort).
  //
  // Saunafest: NICHT um 20:15 — das Fest läuft bis letzter_slot (23:30).
  // Der Abschluss kommt 30 min nach dem letzten Slot und steht 60 min
  // (festAbschluss in SaunaTileColumn, dort hängt auch der Tageswechsel
  // dran). Beim Standard-Raster liegt er schon am Folgetag (00:00–01:00),
  // deshalb wird auch das Fest von GESTERN geprüft (festJetzt) — mit den
  // eigens geladenen Aufgüssen des Festtags (festTagInfs, s. o.).
  const showEndOfDay = useMemo(() => {
    if (festJetzt) return festHatteAufguesse(festJetzt, festTagInfs);
    // Am Festtag selbst gibt es kein 20:15-Fenster.
    if (festHeute) return false;
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
  }, [allInfusions, now, festHeute, festJetzt, festTagInfs]);

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
          infusions={festJetzt ? festTagInfs : allInfusions}
          meisterDir={members.data ?? []}
          /* Fest-Abschluss nach Mitternacht: gezählt wird der Festtag, nicht der Sonntag. */
          stichtag={festJetzt ? festZeitpunkt(festJetzt, '12:00') : undefined}
        />
      );
    }

    const column = (
      idx: number,
      fest?: { videos: ReadonlyMap<string, FestKartenVideo>; abspielen: boolean },
    ) => {
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
          /* tile_bgs stehen als Storage-PFADE in den Brand-Settings, nicht als
             URLs. Ohne publicAssetUrl() landete "tile-bgs/<id>/<id>.jpg" roh
             im CSS und wurde relativ zu /dashboard aufgelöst → 404, die
             Admin-Tile-Hintergründe waren wirkungslos.
             Der Ausschnitt (Fokus + Zoom) reist mit: eine Kachel ist je nach
             Aufteilung 2:1 bis 4:1, jedes Foto wird also beschnitten — wo,
             bestimmt der Admin im Branding-Tab. */
          tileBgs={(brand.data?.tile_bgs?.[saunaId] ?? []).map((t) => {
            const url = publicAssetUrl(t?.path ?? null);
            return url && t ? { url, ausschnitt: t.ausschnitt } : null;
          })}
          tilesPerColumn={tilesPerColumn}
          /* DICHTER, 0-basierter Spaltenindex. Bewusst NICHT sauna.sort_order:
             das ist 1/2/3 und hat Luecken, sobald eine Sauna inaktiv ist
             (Kelo 1, Finnische 2 = aus, Blockhaus 3). Daraus abgeleitete
             Kachel-Nummern faengen bei 3 an und ueberspringen Bereiche --
             die vorderen Listenplaetze, auf denen die geplanten Oele liegen,
             wuerden dann nie gelesen. */
          columnIndex={idx}
          mondayOpen={mondayOpen}
          holidaySet={holidaySet}
          /* Für die Riff-Animation im EmptyTile: pro leerem Slot wird
             geprüft, ob die andere Sauna zur gleichen Zeit einen
             Aufguss hat. Wenn ja → Fische schwimmen dort hin + Leit-Text. */
          otherSaunaInfo={(slot) => findOtherSaunaActivityAt(saunaId, slot, activeSaunas, allInfusions)}
          /* Saunafest: an einem Festtag kommen die Kachel-Zeiten aus dem
             Festraster (halbe Stunden, je Sauna) und der Tageswechsel erst
             nach dem Fest-Abschluss. An allen anderen Tagen ändert das nichts. */
          festTage={festTage.data}
          alleSaunen={saunas.data}
          festVideos={fest?.videos}
          videosAbspielen={fest?.abspielen ?? false}
        />
      );
    };

    // Alle Saunen-Spalten ohne Werbung — Tiles nutzen den ganzen TV-Platz,
    // gleichmäßig verteilt via flex-1 (auch bei 1, 2, 3+ Saunen).
    // Am Festtag zusätzlich die Fest-Videos der Aufguss-Karten.
    if (festHeute) {
      return (
        <FestVideoDaten datum={festHeute.datum}>
          {(fest) => activeSaunas.map((_, i) => column(i, fest))}
        </FestVideoDaten>
      );
    }
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
      {/* Am Festtag aus: der Partikel-Canvas zeichnet per requestAnimationFrame
          über die ganze Fläche — neben bis zu drei laufenden Karten-Videos
          wäre das die Last, an der sich der TV-Stick verschluckt.
          Unter dem Joker (Sauna zu) pausiert er ganz. */}
      {!festHeute && <ParticleCanvas activeSaunaCount={activeSaunas.length} pausiert={gesperrt} />}
      <AnimatePresence>
        {evac.data && (
          <EvacuationOverlay
            triggeredBy={members.data?.find((m) => m.id === evac.data!.triggered_by)?.name ?? null}
            tonHinweis={TON_HINWEIS}
          />
        )}
      </AnimatePresence>

      <main className="flex-1 min-h-0 w-full px-4 py-4 flex gap-4">
        {renderMain()}
      </main>

      {/* Als „wichtig" markierte Info-Karten, periodisch groß über der Tafel.
          Muss sein, weil eine Info-Karte im Karussell nur in LEEREN Kacheln
          erscheint — an vollen Tagen gäbe es keine. Am Festtag ohne Karten
          mit Video: die Aufguss-Karten spielen dann schon je Spalte eines
          (wie im Karussell und beim ausgeschalteten ParticleCanvas). */}
      <InfoEinblendung now={now} ohneVideo={!!festHeute} />

      {/* Ton gesperrt (nach jedem Neuladen, bis jemand drückt): kleiner Hinweis,
          damit ein Alarm nicht stumm bleibt. Nicht unter dem Joker — dort
          meldet jeder Tastendruck die Neugier an alle Admins. */}
      {tonGesperrt && !gesperrt && (
        <div className="fixed bottom-2 left-3 z-40 pointer-events-none rounded-full bg-slate-900/55 px-3 py-1 text-sm font-medium text-white/85">
          {TON_HINWEIS}
        </div>
      )}

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
