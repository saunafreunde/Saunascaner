import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { differenceInMinutes } from 'date-fns';
import type { Infusion, Sauna } from '@/types/database';
import { fmtClock, dayLabel } from '@/lib/time';
import { ATTR_BY_ID, type InfusionAttribute } from '@/lib/attributes';
import { OIL_BY_ID, MAX_OIL_SLOTS } from '@/lib/oils';
import { themeFromAttributes, stripThemeAttrs } from '@/lib/aufgussTheme';
import { useAttributeColors, useOilColors, useAllCustomOils, useAllCustomAttrs, parseCustomOilId, useMeisterDirectory, useBrandSettings, useSudKraeuter, useSudMixe, type CustomOil } from '@/lib/api';
import { sudFromAttributes } from '@/lib/sud';
import type { MemberCustomAttr } from '@/types/database';
import { resolveAvatarUrl, dicebearUrl } from '@/lib/avatar';
import { nameplateAus } from '@/lib/nameplates';
import { Nameplate } from '@/components/Nameplate';
import { AusschnittBild } from '@/components/AusschnittBild';
import { deck, FINISH_DEFAULT, type Ausschnitt, type TafelFinish } from '@/types/branding';
// BadgeChip-Import + BadgeDefinition bewusst entfernt — Auszeichnungen werden
// nicht mehr auf Aufguss-Karten gerendert. Prop meisterBadges ist raus.

// Helper: hex-Farbe + alpha-Suffix → rgba-Hintergrund.
// Z.B. tintBg('#f59e0b', 0.33) → "linear-gradient(135deg, #f59e0b55, rgba(8,18,12,0.55))"
// HELL-THEME: Pills auf cremig-hellem Untergrund statt forest-Dunkel.
function tintBg(hex: string, f = 1): string {
  return `linear-gradient(135deg, ${hex}33, rgba(255,255,255,${deck(0.7, f)}))`;
}
function tintRing(hex: string): string {
  return `inset 0 0 0 1px ${hex}66`;
}

/** Der weiße Schleier über Öl- und Schnaps-Motiven.
 *
 *  Bewusst ein Band und keine gleichmäßige Fläche:
 *    oben  (0–34 %)  ~0,92 → fast weiß, hier stehen Uhrzeit und Titel
 *    Mitte (60–84 %) ~0,30 → das Motiv kommt voll durch
 *    unten (100 %)   ~0,70 → Sauna-Badge und Aufgießer bleiben lesbar
 *  Ein gleichmäßiger Schleier macht die dunklen Fotos milchig und die Frucht
 *  unkenntlich — dieses Band hält beides. Der Faktor staucht oder streckt die
 *  ganze Staffelung, ohne sie einzuebnen.
 */
function schleierVerlauf(f: number, mitte = 0.42, tief = 0.30, fuss = 0.70): string {
  return 'linear-gradient(180deg, '
    + `rgba(255,255,255,${deck(0.95, f)}) 0%, `
    + `rgba(255,255,255,${deck(0.90, f)}) 34%, `
    + `rgba(255,255,255,${deck(mitte, f)}) 60%, `
    + `rgba(255,255,255,${deck(tief, f)}) 84%, `
    + `rgba(255,255,255,${deck(fuss, f)}) 100%)`;
}

const IMMINENT_MIN = 10;

/** Referenz-Pillengröße der Tafel: die Karte mit drei Ölen NEBEN drei
 *  Eigenschaften (13:00 Blockhaus im Screenshot vom 03.08.2026) — die hat der
 *  User als genau richtig benannt. Größer wird auf der Tafel keine Pille mehr,
 *  egal wie wenige es sind. Die Werte sind exakt das, was die Formel für
 *  diesen Fall ausrechnet (zwei Pillen pro Zeile, zwei Zeilen). */
const REF_HOEHE_CQH = 9;
const REF_BREITE_CQW = 2.2;

/** Vier Dringlichkeits-Stufen für Lauflicht + Progress-Ring (Migration 0100-Plan).
 *  null = mehr als 10 Min Vorlauf, keine Animation
 *  10   = 6–10 Min  → grün, ruhig
 *  5    = 3–5 Min   → gelb
 *  2    = 1–2 Min   → orange
 *  0    = ≤0 Min    → rot + Glow-Pulse ("startet jetzt") */
function imminentStage(minsToStart: number): 0 | 2 | 5 | 10 | null {
  if (minsToStart > IMMINENT_MIN) return null;
  if (minsToStart > 5) return 10;
  if (minsToStart > 2) return 5;
  if (minsToStart > 0) return 2;
  return 0;
}

/** Einheitliche Polsterung der Kopf-Badges (LIVE, Banja, Aufguss-Art).
 *  Als Konstante, damit die drei nicht auseinanderlaufen. */
const BADGE_PAD = 'clamp(calc(2px * var(--d)), 0.6cqh, 5px) clamp(calc(6px * var(--d)), 1.6cqh, 12px)';

/** Obergrenze der Besonderheiten-Pillen auf einer Kachel. Bewusst großzügig —
 *  reale Aufgüsse haben 2–5. Sie ist nur die harte Schranke nach oben: die
 *  Attributliste ist im Formular unbegrenzt (Standard-Chips + eigene Buttons),
 *  ohne Deckel könnte eine einzelne Karte die Spalte sprengen. Was wegfällt,
 *  wird als "+N" angezeigt — nichts verschwindet stillschweigend. */
const MAX_ATTR_PILLS = 8;

const STAGE_COLOR: Record<0 | 2 | 5 | 10, string> = {
  10: '#22c55e', // grün
  5:  '#eab308', // gelb
  2:  '#f97316', // orange
  0:  '#ef4444', // rot
};

export function InfusionCard({
  infusion,
  sauna,
  meisterName,
  meisterMeta,
  coNames,
  now,
  compact = false,
  className = '',
  backgroundImage = null,
  style: extraStyle,
}: {
  infusion: Infusion;
  sauna: Sauna;
  meisterName?: string;
  meisterMeta?: { isGuest: boolean; homeGroup: string | null };
  coNames?: string[];
  now: Date;
  compact?: boolean;
  className?: string;
  /** Kachel-Hintergrund aus dem Branding-Tab, samt gewähltem Ausschnitt.
   *  Greift nur, wenn die Karte weder ein Sonder-Thema noch Öl-Motive hat —
   *  die legen sich sonst darüber. */
  backgroundImage?: { url: string; ausschnitt: Ausschnitt } | null;
  /** Zusätzliches inline-style — wird auf das motion.div-Root gemergt.
   *  Hauptverwendung: gridRow span 2 für Banja-Ritual (90 Min, 2 Slots).
   *  Migration 30.05.2026. */
  style?: React.CSSProperties;
}) {
  // Color-Overrides (Admin-konfigurierbar via Migration 0088).
  // Fallback wenn nicht gesetzt: sauna.accent_color (Attribute) bzw.
  // amber-Default (Öle) — wie vorher.
  const attrColors = useAttributeColors();
  const oilColors = useOilColors();
  // Custom-Öle aller Aufgießer für Lookup bei 'custom:<uuid>' IDs
  const customOilsAll = useAllCustomOils();
  // Custom-Attrs aller Aufgießer — für Lookup wenn UUID in
  // infusion.attributes statt Standard-Slug steht (User-Bug:
  // selbst erstellte Buttons wurden nicht angezeigt).
  const customAttrsAll = useAllCustomAttrs();
  const sudKraeuterAll = useSudKraeuter();
  const sudMixeAll = useSudMixe();
  // Feinschliff der Deckkräfte (Admin → Branding → „Finish der Tafel").
  // Multiplikatoren, nicht absolute Werte: die Karte staffelt ihre Schleier
  // bewusst (oben deckend für die Uhrzeit, Mitte offen fürs Motiv, unten
  // wieder heller für den Fuß) — ein absoluter Regler machte das platt.
  // Bei 1 rechnet alles exakt wie zuvor, das Standard-Aussehen bleibt.
  const finish: TafelFinish = useBrandSettings().data?.tafel_finish ?? FINISH_DEFAULT;
  const colorForAttr = (id: string): string => attrColors.data?.[id] ?? sauna.accent_color;
  const colorForOil = (id: string): string => oilColors.data?.[id] ?? '#f59e0b';
  const start = new Date(infusion.start_time);
  const end = new Date(infusion.end_time);
  const minsToStart = differenceInMinutes(start, now);
  const running = now >= start && now < end;
  const past = now >= end;
  // Lauflicht-Stufe — null wenn mehr als 10 Min Vorlauf oder Aufguss
  // läuft/ist vorbei. Sonst grün → gelb → orange → rot. Wird unten in
  // der className gerendert (.imminent-runner + .imminent-{stage}).
  const stage = !running && !past ? imminentStage(minsToStart) : null;
  const imminent = stage !== null; // beibehalten für tafel-blink

  // Default-Mood: wenn Aufguss leere attrs/oils hat, fallback auf den
  // im Profil hinterlegten "Standard-Stil" des Aufgießers (Migration 0100).
  const meisterDir = useMeisterDirectory();
  const meisterDefaults = (meisterDir.data ?? []).find((x) => x.id === infusion.saunameister_id);
  // Namensschild des Aufgießers (Migration 0122). Jeder Einzelwert wird beim
  // Einlesen geprüft und notfalls durch die Vorgabe ersetzt — Alt-Daten und
  // halb gespeicherte Objekte dürfen die Tafel nicht kippen.
  const schild = nameplateAus(meisterDefaults?.nameplate_config);

  const label = dayLabel(infusion.start_time, now);
  const suffix = label === 'heute' ? 'Uhr' : label === 'morgen' ? 'morgen' : label;

  // Defensiv auf MAX_OIL_SLOTS kappen — alte DB-Datensätze können mehr Öle
  // enthalten (Limit wurde von 6 zurück auf 3 gestellt). UI darf nie mehr
  // anzeigen als aktuell erlaubt, sonst sieht's chaotisch aus.
  const oils = ((infusion.oils ?? []).filter(Boolean) as string[]).slice(0, MAX_OIL_SLOTS);

  // Hat dieser Aufguss einen eigenen Look? Schnaps (als 'schnaps:<slug>' bzw.
  // Alt-Chip kirschwasser/haferpflaume) oder Räuchern (Attribut 'raeuchern')
  // — siehe lib/aufgussTheme.ts. Färbt Karten-Hintergrund + eigene Pille und
  // lässt die Sauna-Identität (Akzentstreifen, Sauna-Badge) unangetastet.
  const theme = themeFromAttributes(infusion.attributes);
  // Was schon als Auszeichnung oben steht, darf unten nicht nochmal als
  // Besonderheiten-Pille erscheinen. Betrifft vor allem Alt-Aufgüsse:
  // 'kirschwasser'/'raeuchern' sind weiter in ATTR_BY_ID (damit Alt-Daten
  // beschriftbar bleiben) und würden sonst doppelt auftauchen.
  const pillAttributes = theme
    ? stripThemeAttrs(infusion.attributes ?? [])
    : (infusion.attributes ?? []);

  const isBanja = (infusion.attributes ?? []).includes('banja' as InfusionAttribute);

  // Aufguss-Karten ohne eigene Art (kein Schnaps, kein Räuchern) sahen neben
  // den neuen Bild-Karten der freien Kacheln blass aus. Sie bekommen jetzt
  // das Motiv ihres ERSTEN Öls als Hintergrund — die 64 Bilder liegen seit
  // dem Öl-Karussell ohnehin im Repo (public/oele/<slug>.webp).
  // Custom-Öle ('custom:<uuid>') haben kein Bild und werden übersprungen.
  // Bis zu DREI Öl-Motive als Hintergrund — nebeneinander, jedes ein Drittel
  // der Karte. Ein Aufguss mit Zitrone, Eukalyptus und Fichte zeigt damit
  // buchstäblich seine Mischung. Custom-Öle ('custom:<uuid>') haben kein
  // Motiv und fallen raus.
  const bgOils = theme
    ? []
    : (oils.map((o) => OIL_BY_ID[o]).filter(Boolean).slice(0, 3) as NonNullable<typeof OIL_BY_ID[string]>[]);
  const bgOil = bgOils[0] ?? null;

  // Was am Ende WIRKLICH als Pille erscheint — inkl. Default-Mood-Fallback
  // (Migration 0100) und ohne unbekannte IDs. Muss hier oben stehen, weil
  // daraus die Inhalts-Dichte abgeleitet wird: würde man mit den Roh-Arrays
  // rechnen, bekäme ein Aufguss mit lauter veralteten Custom-UUIDs die dichte
  // Stufe, obwohl gar nichts gerendert wird.
  const knownAttr = (a: string) =>
    !!(ATTR_BY_ID as Record<string, unknown>)[a] || (customAttrsAll.data ?? []).some((ca) => ca.id === a);
  const pillAttrs = (infusion.attributes?.length ? pillAttributes : (meisterDefaults?.default_mood_attributes ?? []))
    .filter(knownAttr);
  const pillOils = oils.length ? oils : (meisterDefaults?.default_mood_oils ?? []).slice(0, MAX_OIL_SLOTS);

  // Sud: 'sud:<uuid>' / 'sudmix:<uuid>' zu Namen aufloesen. Die Roh-Eintraege
  // fallen oben schon durch knownAttr() aus den Besonderheiten-Pillen — hier
  // kommen sie als das zurueck, was sie sind: Zutaten neben den Oelen.
  // Mischungen zuerst, sie sind die groessere Aussage.
  const sudRoh = sudFromAttributes(infusion.attributes);
  const sudPillen = [
    ...sudRoh.mixe.map((id) => (sudMixeAll.data ?? []).find((m) => m.id === id)),
    ...sudRoh.kraeuter.map((id) => (sudKraeuterAll.data ?? []).find((k) => k.id === id)),
  ].filter(Boolean).map((x) => ({ id: x!.id, emoji: x!.emoji, name: x!.name, color: x!.color }));

  // Inhalts-Achse des Dichte-Faktors: sind BEIDE Sektionen gefüllt (der vom
  // User genannte Normalfall), wird es eng → 1. Sonst darf alles 25 % größer
  // werden — das ist die bisherige onlyOne-Regel aus PillsBlock, nur als Zahl
  // und damit auch für Kopf und Fuß nutzbar.
  const dContent = pillAttrs.length > 0 && (pillOils.length > 0 || sudPillen.length > 0) ? 1 : 1.25;

  // Countdown-Text bis Start (oder Status falls läuft/vorbei).
  // Wird sekündlich/minütlich aktualisiert via Parent-`now`-Prop (alle 5s im Dashboard).
  function countdownText(): string {
    if (past) return 'Beendet';
    if (running) {
      const minsLeft = differenceInMinutes(end, now);
      return minsLeft > 0 ? `läuft · noch ${minsLeft} Min` : 'läuft';
    }
    if (minsToStart <= 0) return 'startet jetzt';
    if (minsToStart < 60) return `in ${minsToStart} Min`;
    const h = Math.floor(minsToStart / 60);
    const m = minsToStart % 60;
    return m > 0 ? `in ${h}h ${m} Min` : `in ${h}h`;
  }

  // useTextFit entfernt (gab dynamische font-size die fixe TV-Größen überschrieb).
  // Compact-Mode nutzt jetzt fixe Tailwind-Klassen für robuste 1080p/4K-Skalierung.

  return (
    <motion.div
      // KEIN layout-Prop im Tafel/compact-Modus: framer-motions Layout-Projektion
      // driftete beim Stundenwechsel (Slot-Reflow) im Zusammenspiel mit dem
      // Dauer-Transform rotateX/scale + perspective → Boxen blieben verschoben
      // bis zum Reload. Ohne layout regelt CSS-Grid die Positionen instant.
      layout={!compact}
      initial={{ opacity: 0, y: 30, scale: 0.98, rotateX: 1.5 }}
      animate={{
        opacity: 1, y: 0, scale: 1, rotateX: 1.5,
        // boxShadow ist jetzt statisch (kein imminent-Pulse mehr — das macht
        // ab sofort das CSS-Lauflicht .imminent-runner via Pure-CSS, das
        // ist GPU-freundlicher und reicht visuell vollkommen).
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.4), 0 4px 10px rgba(0,0,0,0.32), 0 16px 40px rgba(0,0,0,0.4), 0 0 28px ${sauna.accent_color}22`,
      }}
      exit={{ opacity: 0, y: -30, scale: 0.96 }}
      transition={{
        layout: { duration: 0.55, ease: [0.25, 1, 0.5, 1] },
        opacity: { duration: 0.35 },
      }}
      className={`relative flex flex-col overflow-hidden rounded-2xl ring-1 before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/[0.5] before:to-transparent before:pointer-events-none before:content-[''] ${compact ? 'p-3' : 'p-5'} backdrop-blur-xl ${
        running
          ? 'ring-emerald-500/60'
          : imminent
            ? 'ring-transparent'
            : 'ring-slate-300/60'
      }${stage !== null ? ` imminent-runner imminent-${stage}` : ''}${running ? ' running-glow' : ''} ${className}`}
      style={{
        // User-Wunsch 30.05.2026: Aufguss-Cards stehen ÜBER den Riff-Tieren
        // der Nachbar-EmptyTile (z-index der reef-creatures ist 0). So
        // schwimmen Fische unter den Cards durch statt visuell darüber.
        zIndex: 2,
        isolation: 'isolate',
        transformOrigin: '50% 100%',
        // Optionales extra-style (z.B. gridRow: span 2 für Banja) am Ende
        // gemergt damit Caller wins
        ...(extraStyle ?? {}),
        // Container-Query auf jede Tile: alle Schriftgrößen darunter skalieren
        // proportional zur Tile-Höhe via clamp(min, Ncqh, max). Wirkt sowohl
        // bei 3 als auch 4 Tiles, sowohl 1080p als auch 4K.
        containerType: 'size',
        ...(imminent ? { borderColor: sauna.accent_color } : {}),
        ...(theme ? {
          // Schnaps-Karte: Fruchtbild als Plakat-Hintergrund. Bewusst ein
          // HELLER Schleier statt des dunklen im Zweig darunter — die Karte
          // ist Hell-Theme (Titel text-slate-900), auf einem abgedunkelten
          // Fruchtfoto wäre davon nichts mehr zu lesen.
          //
          // Der Schleier ist bewusst NICHT gleichmäßig, sondern ein Band:
          //   oben  (0–34 %)  ~0.92 → fast weiß, hier stehen Uhrzeit + Titel
          //   Mitte (60–84 %) ~0.30 → das Fruchtbild kommt voll durch
          //   unten (100 %)   ~0.70 → Sauna-Badge und Aufgießer bleiben lesbar
          // Ein gleichmäßiger Schleier über die ganze Karte macht die dunklen
          // Fotos milchig und die Frucht unkenntlich — dieses Band hält beides.
          // background-position bottom, weil die Frucht in allen Motiven unten
          // im Bild sitzt (siehe Prompt-Vorgabe in Desktop\sauna_gen.py).
          backgroundImage: [
            `linear-gradient(200deg, ${theme.color}00 0%, ${theme.color}00 45%, ${theme.color}30 100%)`,
            schleierVerlauf(finish.schleier),
            `url(${JSON.stringify(theme.image)})`,
          ].join(', '),
          backgroundSize: 'cover',
          backgroundPosition: 'center bottom',
        } : bgOil ? {
          // Die Motive selbst liegen als eigene Ebene darunter (siehe
          // OilStripes weiter unten) — mehrere Bilder nebeneinander gehen mit
          // background-image nicht sauber, weil sich jede Lage nur skalieren,
          // aber nicht auf ihr Drittel zuschneiden ließe. Hier bleibt nur die
          // Grundfarbe, damit die Karte auch beim Laden nicht weiß aufblitzt.
          background: `linear-gradient(135deg, ${colorForOil(bgOil.id)}18, rgba(254,247,237,${deck(0.9, finish.karte)}))`,
        } : backgroundImage ? {
          // Das Bild liegt als eigene Ebene weiter unten (siehe Kachel-Foto),
          // NICHT als background-image: nur so lässt sich der im Admin
          // gewählte Ausschnitt anwenden. Hier bleibt die Grundfarbe, damit
          // die Karte beim Laden nicht weiß aufblitzt.
          background: 'rgba(2,6,12,0.62)',
        } : {
          // Plakat-Hintergrund (statt klinischem bg-white/80): stark
          // sauna-getönt in den Ecken (40% alpha), Mitte warm-crème statt
          // fast-weiß damit der Farbeindruck nicht "blass" wird.
          // 1. Iteration war zu dezent (14%/8%) → User: "noch immer weiß".
          // Wood-Maserung kommt zusätzlich via .card-wood-grain ::after.
          background: `linear-gradient(135deg, ${sauna.accent_color}55 0%, ${sauna.accent_color}1c 38%, rgba(254,247,237,${deck(0.88, finish.karte)}) 60%, ${sauna.accent_color}28 100%)`,
        }),
      } as CSSProperties}
    >
      {/* Sauna-Badge wurde aus der absoluten Position in den Footer-Bereich
          unten verschoben — Teil der einheitlichen 3-Spalten-Footer-Zeile
          (siehe ganz unten in der compact-Sektion: Sauna | Aufgießer | Uhrzeit). */}

      {/* Kachel-Foto aus dem Branding-Tab, mit dem dort gewählten Ausschnitt.
          Als eigene Ebene statt als background-image: `background-size: cover`
          kennt keinen Zoom-Faktor, `object-fit` + `object-position` schon.
          Darüber derselbe dunkle Schleier wie vorher, damit der helle Text
          der Karte lesbar bleibt. */}
      {backgroundImage && !theme && !bgOil && bgOils.length === 0 && (
        <div aria-hidden className="absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          <AusschnittBild url={backgroundImage.url} ausschnitt={backgroundImage.ausschnitt} />
          <div className="absolute inset-0" style={{ background: 'rgba(2,6,12,0.62)' }} />
        </div>
      )}

      {/* Akzent-Stripe links */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: sauna.accent_color }}
      />

      {/* Schwarzwald-Holz-Maserung als echtes Inline-SVG (Pattern A wie
          die Bühne). Liegt absolut über der Card aber unter dem Content
          (z-index 0, pointer-events: none). Nicht bei imminent oder
          backgroundImage anzeigen (würde dort doppelt/überflüssig wirken). */}
      {/* Öl-Motive als Streifen: bei drei Ölen bekommt jedes ein Drittel der
          Karte, von links nach rechts in der Reihenfolge der Runden. Darüber
          derselbe Schleier wie auf den Schnaps-Karten (oben fast weiß für
          Uhrzeit und Titel, in der Mitte offen fürs Motiv, unten wieder
          heller für Sauna-Badge und Aufgießer). */}
      {bgOils.length > 0 && (
        <>
          <div aria-hidden className="absolute inset-0 flex" style={{ zIndex: 0 }}>
            {bgOils.map((o, i) => (
              <div
                key={`${o.id}-${i}`}
                className="flex-1 min-w-0"
                style={{
                  backgroundImage: `url(${JSON.stringify(`/oele/${o.id}.webp`)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center bottom',
                  // Feine helle Trennlinie zwischen den Dritteln. Eine weiche
                  // Ausblendung ginge nicht: die Streifen liegen nebeneinander
                  // und ueberlappen sich nicht, jede Maske haette an der Naht
                  // ein Loch hinterlassen. Die Linie liest sich als Triptychon.
                  boxShadow: i === 0 ? undefined : 'inset 1px 0 0 rgba(255,255,255,0.55)',
                }}
              />
            ))}
          </div>
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              zIndex: 0,
              backgroundImage: [
                `linear-gradient(200deg, ${colorForOil(bgOils[0].id)}00 0%, ${colorForOil(bgOils[0].id)}00 45%, ${colorForOil(bgOils[0].id)}2b 100%)`,
                // Minimal offener als bei den Schnaps-Motiven: hier liegen bis
                // zu drei Bilder nebeneinander, die sonst zu unruhig wirken.
                schleierVerlauf(finish.schleier, 0.46, 0.34, 0.72),
              ].join(', '),
            }}
          />
        </>
      )}

      {!imminent && !backgroundImage && !theme && !bgOil && <WoodGrainOverlay />}

      {compact ? (
        /* relative z-10 — damit der Card-Content GARANTIERT über der
           Holz-Maserung (WoodGrainOverlay, z-index 1) liegt und nicht
           davon überdeckt wird */
        <div
          className="tile-body relative z-10 flex flex-col flex-1 min-h-0 pl-3"
          style={{ '--d-c': dContent, gap: 'clamp(calc(4px * var(--d)), 1.5cqh, 12px)' } as CSSProperties}
        >
          {/* Header: Uhrzeit + Titel + Auszeichnungen. Schriftgrößen skalieren
              via cqh proportional zur Tile-Höhe; die clamp-MINIMA zusätzlich
              über --d (siehe index.css .tile-body) — sonst greift auf kleinen
              Kacheln nur noch der starre Pixel-Boden und der Inhalt läuft über. */}
          <div className="flex items-stretch flex-shrink-0" style={{ gap: 'clamp(calc(6px * var(--d)), 1.5cqh, 12px)' }}>
            <div
              className="relative rounded-xl flex items-center justify-center backdrop-blur-md flex-shrink-0"
              style={{
                padding: 'clamp(calc(4px * var(--d)), 1.2cqh, 10px) clamp(calc(8px * var(--d)), 2cqh, 16px)',
                background: `linear-gradient(135deg, ${sauna.accent_color}22, rgba(8,18,12,0.55))`,
                boxShadow: `inset 0 0 0 1px ${sauna.accent_color}33, 0 0 16px ${sauna.accent_color}1f`,
              }}
            >
              {/* Progress-Ring um die Uhrzeit-Box — füllt sich von 10 Min runter.
                  Stufen-Farbe synchron zum Lauflicht (grün → gelb → orange → rot).
                  Nur sichtbar wenn imminent (≤10 Min Vorlauf). */}
              {stage !== null && (
                <svg
                  className="absolute inset-0 pointer-events-none"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <circle
                    cx="50" cy="50" r="46"
                    fill="none"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx="50" cy="50" r="46"
                    fill="none"
                    stroke={STAGE_COLOR[stage]}
                    strokeWidth="3"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray={2 * Math.PI * 46}
                    strokeDashoffset={2 * Math.PI * 46 * (1 - Math.max(0, minsToStart) / IMMINENT_MIN)}
                    transform="rotate(-90 50 50)"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s ease-out' }}
                  />
                </svg>
              )}
              <span
                className="relative font-bold tabular-nums leading-none whitespace-nowrap"
                style={{
                  color: sauna.accent_color,
                  fontSize: 'clamp(calc(16px * var(--dh)), 5cqh, 30px)',
                }}
              >
                {fmtClock(infusion.start_time)}
              </span>
            </div>
            <div
              className="relative flex-1 rounded-xl flex flex-row items-center backdrop-blur-md min-w-0 overflow-hidden"
              style={{
                padding: 'clamp(calc(6px * var(--d)), 1.6cqh, 14px) clamp(calc(11px * var(--d)), 2.7cqh, 22px)',
                gap: 'clamp(calc(5px * var(--d)), 1.2cqh, 10px)',
                // Auf Bild-Karten (Schnaps/Räuchern) ist der Karten-Schleier oben
                // fast weiß — die sonst dunkle Titel-Box säße dort als Fremdkörper
                // und drückte den slate-900-Titel auf ~3,5:1. Helle Box statt
                // dessen: ~13:1, und das Motiv bleibt unten ungestört.
                background: (theme || bgOil)
                  ? `linear-gradient(135deg, ${sauna.accent_color}26 0%, rgba(255,255,255,0.86) 55%)`
                  : `linear-gradient(135deg, ${sauna.accent_color}22 0%, rgba(8,18,12,0.55) 60%)`,
                boxShadow: `inset 0 0 0 1px ${sauna.accent_color}33, 0 0 24px ${sauna.accent_color}1f`,
              }}
            >
              <h3
                className="font-black text-slate-900 leading-tight tracking-tight flex-1 min-w-0 line-clamp-2"
                style={{
                  fontSize: 'clamp(calc(21px * var(--dh)), 5.9cqh, 36px)',
                  textShadow: `0 1px 0 ${sauna.accent_color}25`,
                }}
              >
                {infusion.title}
                {infusion.team_infusion && <span className="ml-2 text-amber-600">👥</span>}
              </h3>

              {/* Auszeichnungen (Aufguss-Art, Banja, LIVE) — im FLUSS rechts neben
                  dem Titel, nicht mehr absolut positioniert. Zwei Gründe: die
                  beiden alten absolute-Badges lagen über der ersten Titelzeile und
                  kollidierten bei Banja+LIVE miteinander; und die Aufguss-Art
                  brauchte vorher eine eigene Zeile unter der Kopfzeile — die hat
                  bei 4 Kacheln auf 1080p rund 25 px gekostet und war der
                  Hauptgrund für den Überlauf. Hier kostet sie nichts, solange die
                  Badge-Höhe unter der Titelzeile bleibt (per Konstruktion). */}
              {/* Nur noch LIVE. Schnaps, Raeuchern und Banja standen bis
                  03.08.2026 ebenfalls hier oben rechts und gingen dort neben
                  dem Titel unter (User). Sie sitzen jetzt gross in der
                  Fusszeile, wo Platz ist — LIVE bleibt am Titel, weil es den
                  ZUSTAND meldet und im Vorbeigehen sofort auffallen soll. */}
              {running && (
                <div
                  className="flex flex-col items-end flex-shrink-0 max-w-[45%]"
                  style={{
                    gap: 'clamp(calc(3px * var(--d)), 0.8cqh, 7px)',
                    fontSize: 'clamp(calc(9px * var(--d)), 2.2cqh, 14px)',
                  }}
                >
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500 font-black tracking-wider text-white whitespace-nowrap"
                    style={{ padding: BADGE_PAD, boxShadow: '0 0 10px rgba(34,197,94,0.7)' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white tafel-blink" />
                    LIVE
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Aufgießer-Strip wurde nach UNTEN MITTIG verschoben — siehe
              direkt nach dem PillsBlock, eigene zentrierte Zeile vor dem
              Footer. So bleibt oben mehr Platz für Titel + Pills, und der
              Aufgießer wird als zentrales Plakat-Element prominent gezeigt. */}

          {/* Description (kursiv, max 1 Zeile) — nur wenn vorhanden.
              tile-desc: wird erst auf sehr kleinen Kacheln (<175px) ausgeblendet,
              siehe index.css — dort ist sie das erste, was verzichtbar ist. */}
          {infusion.description && (
            <p
              className="tile-desc text-slate-600 italic line-clamp-1 flex-shrink-0"
              style={{ fontSize: 'clamp(calc(12px * var(--d)), 3cqh, 17px)', color: schild.textSlogan }}
            >
              {infusion.description}
            </p>
          )}

          {/* Pills-Block: Besonderheiten + Öle als Card-Style mit Header-Bar.
              Default-Mood-Fallback (Migration 0100): wenn der Aufguss leere
              attrs oder oils hat und der Aufgießer einen "Standard-Stil"
              im Profil hinterlegt hat, zeigen wir die Default-Pills mit
              dezentem "🪶 Sein Stil"-Header an Stelle der leeren Sektion.
              flex 0 1 auto + min-h-0: der PillsBlock ist als EINZIGES Kind
              nachgiebig — damit ist der Fuß (Sauna-Badge, Aufgießer, Countdown)
              rechnerisch garantiert sichtbar, egal wie viel oben steht. */}
          <PillsBlock
            attributes={pillAttrs}
            oils={pillOils}
            attributesAreDefault={!infusion.attributes?.length && (meisterDefaults?.default_mood_attributes?.length ?? 0) > 0}
            oilsAreDefault={!oils.length && (meisterDefaults?.default_mood_oils?.length ?? 0) > 0}
            colorForAttr={colorForAttr}
            colorForOil={colorForOil}
            customOils={customOilsAll.data ?? []}
            customAttrs={customAttrsAll.data ?? []}
            finish={finish}
            sud={sudPillen}
          />

          {/* Footer-Zeile: drei Spalten ALLE UNTEN AUSGERICHTET damit es
              "gleichmäßig" aussieht (User-Wunsch).
              Links: Sauna-Badge (war vorher absolute, jetzt im Flow)
              Mitte: Aufgießer-Block (Avatar + Name + Motto)
              Rechts: Aktuelle Uhrzeit + Countdown-Pille
              mt-auto drückt die ganze Zeile nach unten, items-end macht
              alle drei Elemente bündig auf gleicher unterer Kante.
              flex-wrap fängt sehr enge Karten ab — bei zu wenig Platz
              wickeln die Spalten ohne Crash. */}
          {/* Alle VIER Spalten exakt gleich hoch (User-Wunsch 03.08.2026).
              Statt `items-end` (jede Spalte so hoch wie ihr Inhalt) gibt es
              jetzt EIN gemeinsames Hoehenmass --fussH, an dem sich alle
              ausrichten. Das ist bewusst eine feste Variable und kein
              `items-stretch` mit Prozentwerten: Prozent-Hoehen gegen einen
              gestretchten Flex-Container sind je nach Browser zirkulaer, und
              der Avatar braucht unten einen VERLAESSLICHEN Bezug, um genau
              5 % groesser zu sein.
              overflow bleibt sichtbar — die Jahreszeiten-Grafik am Schild
              darf ueber die Zeile hinausragen. */}
          <div
            className="mt-auto pt-2 flex items-center justify-between gap-2 flex-shrink-0 min-w-0"
            style={{ ['--fussH' as string]: 'clamp(calc(46px * var(--d)), 13cqh, 88px)' }}
          >
            {/* SPALTE 1 — Sauna-Badge */}
            <span
              className="inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap text-white flex-shrink-0"
              style={{
                height: 'var(--fussH)',
                fontSize: 'clamp(calc(16px * var(--dh)), 3.7cqh, 22px)',
                padding:  'clamp(calc(5px * var(--d)), 1.2cqh, 8px) clamp(calc(11px * var(--d)), 2.9cqh, 19px)',
                background: sauna.accent_color,
                boxShadow: `0 2px 10px ${sauna.accent_color}99, inset 0 1px 0 rgba(255,255,255,0.3)`,
                textShadow: '0 1px 2px rgba(0,0,0,0.45)',
              }}
            >
              {sauna.name}
              {/* Immer sauna.temperature_label nutzen — infusion.temperature_c
                  ist in der DB teilweise inkonsistent (z.B. Blockhaus mit
                  temperature_c=80 obwohl Blockhaus = 100°C). Die Sauna-
                  Konfiguration ist die zuverlässige Quelle. */}
              {sauna.temperature_label && (
                <span className="opacity-90">
                  · {sauna.temperature_label}
                </span>
              )}
            </span>

            {/* SPALTE 2 — Aufgießer-Block mittig */}
            {meisterDefaults && (meisterName || meisterDefaults.motto) ? (
              <div className="flex items-center gap-2 min-w-0 flex-shrink" style={{ height: 'var(--fussH)' }}>
                {(() => {
                  const avatarUrl = resolveAvatarUrl(meisterDefaults.avatar_path, 128)
                    ?? dicebearUrl('fun-emoji', meisterDefaults.id, 128);
                  const accent = meisterDefaults.star_accent_color;
                  return (
                    <span
                      aria-hidden
                      className="flex-shrink-0 rounded-full overflow-hidden"
                      style={{
                        /* 5 % groesser als die anderen drei Spalten, und zwar
                           je 2,5 % nach oben und nach unten darueber hinaus —
                           deshalb der negative Rand auf beiden Seiten. */
                        width:  'calc(var(--fussH) * 1.05)',
                        height: 'calc(var(--fussH) * 1.05)',
                        marginTop:    'calc(var(--fussH) * -0.025)',
                        marginBottom: 'calc(var(--fussH) * -0.025)',
                        boxShadow: accent
                          ? `0 0 0 2px ${accent}, 0 0 14px ${accent}66`
                          : '0 0 0 2px rgba(148,163,184,0.4)',
                        background: 'rgba(255,255,255,0.7)',
                      }}
                    >
                      <img
                        src={avatarUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    </span>
                  );
                })()}
                {/* Heller Textschatten auf Name UND Motto: die Zeile steht ohne
                    eigenen Untergrund direkt auf dem Karten-Foto. Auf hellen
                    Motiven ging das gut, auf dem Holzbild der Blockhaus-Karten
                    verschwand vor allem das Motto (Schiefergrau, kein Schatten)
                    praktisch im Untergrund. Der weiße Schein hebt die dunkle
                    Schrift ab, ohne die Optik zu verändern — nur Schrift, keine
                    zusätzliche Fläche. */}
                {/* Namensschild (Migration 0121). Der blosse Textschatten
                    reichte auf Holz- und Frucht-Motiven nicht — der Name war
                    weiterhin schwer zu lesen. Farbe, Transparenz und Form
                    waehlt der Aufgiesser selbst in seinem Profil; unbekannte
                    oder leere Werte fallen auf „Klarglas" zurueck. */}
                {/* Namensschild — dieselbe Komponente wie in der Vorschau im
                    Profil. Vorher gab es zwei Fassungen, die prompt
                    auseinanderliefen: die Tafel rechnete in cqh/--d, der
                    Editor nahm feste Pixel. */}
                <Nameplate
                  config={schild}
                  name={meisterName ?? meisterDefaults.name}
                  motto={meisterDefaults.motto || null}
                  nameZusatz={
                    <>
                      {meisterMeta?.isGuest && (
                        <span className="ml-1 text-emerald-700">🌍{meisterMeta.homeGroup ? ` ${meisterMeta.homeGroup}` : ''}</span>
                      )}
                      {coNames && coNames.length > 0 && (
                        <span className="ml-1 text-amber-700">+ {coNames.join(' + ')}</span>
                      )}
                    </>
                  }
                />
              </div>
            ) : (
              /* Personal-Aufguss: Mittel-Spalte leer aber als Spacer, damit
                 Sauna-Badge links und Uhrzeit rechts ausbalanciert bleiben */
              <div className="flex-1" />
            )}

            {/* SPALTE 3 — Art des Aufgusses. Stand bis 03.08.2026 oben rechts
                neben dem Titel und ging dort unter; hier unten ist Platz, und
                die Zeile liest sich jetzt als Vierer: Sauna · Aufgiesser ·
                Art · Uhrzeit. Nur gerendert wenn es etwas zu melden gibt. */}
            {(theme || isBanja) && (
              <span
                className="inline-flex flex-col items-center justify-center font-black uppercase text-white whitespace-nowrap flex-shrink-0"
                style={{
                  height: 'var(--fussH)',
                  fontSize: 'clamp(calc(11px * var(--d)), 2.7cqh, 17px)',
                  lineHeight: 1.06,
                  borderRadius: '0.7em',
                  padding: 'clamp(calc(3px * var(--d)), 0.9cqh, 7px) clamp(calc(9px * var(--d)), 2.4cqh, 16px)',
                  background: theme
                    ? `linear-gradient(135deg, ${theme.color}, ${theme.color}cc)`
                    : 'linear-gradient(135deg, #e11d48, #f43f5e)',
                  boxShadow: theme
                    ? `0 2px 14px ${theme.color}99, inset 0 1px 0 rgba(255,255,255,0.35)`
                    : '0 2px 14px rgba(244,63,94,0.6), inset 0 1px 0 rgba(255,255,255,0.35)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                }}
              >
                <span style={{ fontSize: '0.78em', letterSpacing: '0.15em', opacity: 0.95 }}>
                  {theme ? theme.kategorie : 'Banja-Ritual'}
                </span>
                <span style={{ fontSize: '1.22em', letterSpacing: '0.01em' }}>
                  {theme ? theme.badge : '♨️ 90 Min'}
                </span>
              </span>
            )}

            {/* SPALTE 4 — Aktuelle Uhrzeit + Countdown-Pille rechts */}
            <div
              className="flex flex-col items-end justify-center gap-1 leading-none whitespace-nowrap flex-shrink-0"
              style={{ height: 'var(--fussH)' }}
            >
              <span
                className="tabular-nums font-bold text-black"
                style={{ fontSize: 'clamp(calc(19px * var(--dh)), 5.2cqh, 31px)' }}
              >
                {fmtClock(now)}
              </span>
              <span
                className={`inline-flex items-center tabular-nums font-black text-white rounded-full ${imminent ? 'tafel-blink' : ''}`}
                style={{
                  fontSize: 'clamp(calc(13px * var(--d)), 3.4cqh, 20px)',
                  padding: 'clamp(calc(2px * var(--d)), 0.85cqh, 6px) clamp(calc(8px * var(--d)), 2.2cqh, 14px)',
                  background: running ? '#16a34a' : '#dc2626',
                  boxShadow: running
                    ? '0 1px 4px rgba(34,197,94,0.5), inset 0 1px 0 rgba(255,255,255,0.25)'
                    : '0 1px 4px rgba(220,38,38,0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
                  textShadow: '0 1px 1px rgba(0,0,0,0.35)',
                }}
              >
                {running && <span className="mr-1">●</span>}
                {countdownText()}
              </span>
            </div>
          </div>

          {/* Auszeichnungen (BadgeChips) bewusst entfernt — User-Wunsch:
              Aufguss-Karten zeigen nur Titel + Aufgießer-Name + Pills. */}
        </div>
      ) : (
        <>
          {/* Glass-Halo-Header: Time · Title (mit Akzent-Glow) — non-compact bleibt wie vorher */}
          <div
            className="relative flex-shrink-0 rounded-xl backdrop-blur-md px-3 py-1.5"
            style={{
              background: `linear-gradient(135deg, ${sauna.accent_color}22 0%, rgba(8,18,12,0.55) 60%, rgba(8,18,12,0.4) 100%)`,
              boxShadow: `inset 0 0 0 1px ${sauna.accent_color}33, 0 0 24px ${sauna.accent_color}1f, inset 0 1px 0 rgba(255,255,255,0.07)`,
            }}
          >
            <span
              aria-hidden
              className="absolute pointer-events-none rounded-full"
              style={{
                left: -6,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 50,
                height: 50,
                background: `radial-gradient(circle, ${sauna.accent_color}55 0%, transparent 65%)`,
                filter: 'blur(4px)',
              }}
            />

            <div className="relative flex items-baseline gap-2">
              <span
                className="font-semibold tracking-tight tabular-nums leading-none text-4xl"
                style={{ color: sauna.accent_color, textShadow: `0 0 10px ${sauna.accent_color}55` }}
              >
                {fmtClock(infusion.start_time)}
              </span>
              <span className="text-forest-400/50 text-xs leading-none">·</span>
              <h3 className="font-semibold text-slate-100 truncate flex-1 leading-none text-2xl">
                {infusion.title}
              </h3>
              {suffix !== 'Uhr' && (
                <span className="ml-1 text-[9px] text-forest-300/60 leading-none whitespace-nowrap">{suffix}</span>
              )}
            </div>
          </div>

          {infusion.description && (
            <p className="relative mt-1 pl-2 text-slate-300/75 italic line-clamp-1 text-base">
              {infusion.description}
            </p>
          )}

          {(infusion.attributes.length > 0 || oils.length > 0) && (
            <div className="relative flex flex-wrap pl-2 mt-2 gap-1.5">
              {infusion.attributes.map((a) => {
                const meta = ATTR_BY_ID[a];
                if (!meta) return null;
                return (
                  <span
                    key={`a-${a}`}
                    title={meta.label}
                    className="inline-flex items-center gap-1 rounded-full backdrop-blur px-2.5 py-1 text-xs"
                    style={{
                      background: `linear-gradient(135deg, ${sauna.accent_color}1a, rgba(8,18,12,0.55))`,
                      boxShadow: `inset 0 0 0 1px ${sauna.accent_color}33`,
                    }}
                  >
                    <span aria-hidden>{meta.emoji}</span>
                    <span className="text-forest-100/90">{meta.label}</span>
                  </span>
                );
              })}
              {oils.map((oilId, i) => {
                const o = OIL_BY_ID[oilId];
                if (!o) return null;
                return (
                  <span
                    key={`o-${i}-${oilId}`}
                    title={o.name}
                    className="inline-flex items-center gap-1 rounded-full backdrop-blur px-2.5 py-1 text-xs"
                    style={{
                      background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(120,75,20,0.45))',
                      boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.4)',
                    }}
                  >
                    <span aria-hidden>{o.emoji}</span>
                    <span className="text-amber-100/95">{o.name}</span>
                  </span>
                );
              })}
            </div>
          )}

          <div className="relative mt-auto pt-1.5 pl-2 flex items-baseline justify-between gap-2 text-sm text-forest-300/70">
            <span className="truncate">
              {meisterName ?? '—'}
              {meisterMeta?.isGuest && (
                <span className="text-emerald-300/90"> 🌍{meisterMeta.homeGroup ? ` ${meisterMeta.homeGroup}` : ''}</span>
              )}
              {coNames && coNames.length > 0 && (
                <span className="text-amber-300/80"> + {coNames.join(' + ')}</span>
              )}
              {infusion.team_infusion && (!coNames || coNames.length === 0) && (
                <span className="ml-1 text-amber-400/60">👥</span>
              )}
            </span>
            <span className="tabular-nums whitespace-nowrap text-forest-200/85 font-medium">{infusion.duration_minutes} Min</span>
          </div>

          {/* Auszeichnungen bewusst entfernt (s.o. im compact-Pfad). */}
        </>
      )}
    </motion.div>
  );
}

// ─── PillsBlock: Card-Style mit Header-Bar ──────────────────────────────
// Zwei rounded Container, jeweils mit farbigem Header-Streifen oben +
// Pills-Bereich darunter. Header für Eigenschaften: „⚡ Besonderheiten" auf
// slate-Ton; Header für Öle: „🌿 Öle" auf amber-Ton.

type PillsBlockProps = {
  attributes: string[];
  oils: string[];
  /** true = attrs sind aus dem Default-Mood des Aufgießers (kein
   *  aufgussspezifischer Pick) — wird mit "🪶 Sein Stil" gelabelt. */
  attributesAreDefault?: boolean;
  /** true = oils sind aus dem Default-Mood des Aufgießers. */
  oilsAreDefault?: boolean;
  colorForAttr: (id: string) => string;
  colorForOil: (id: string) => string;
  customOils: CustomOil[];
  /** ALLE Custom-Attrs aller Aufgießer für Lookup wenn ein attribute-ID
   *  eine UUID statt eines Standard-Slugs ist (selbst erstellte Buttons). */
  customAttrs: MemberCustomAttr[];
  /** Kraeuter und Mischungen des Sudaufgusses — stehen im selben Block wie
   *  die Oele, weil sie dasselbe sind: Zutaten, die ins Wasser kommen. */
  sud: { id: string; emoji: string; name: string; color: string }[];
  /** Deckkraft-Feinschliff. Als Prop und NICHT über einen eigenen Hook:
   *  dieser Block steigt gleich in der ersten Zeile aus, wenn es nichts
   *  anzuzeigen gibt — ein Hook davor wäre ein Regelbruch, einer danach
   *  würde bei jedem zweiten Rendern übersprungen. */
  finish: TafelFinish;
};

function PillsBlock({
  attributes, oils,
  attributesAreDefault = false,
  oilsAreDefault = false,
  colorForAttr, colorForOil, customOils, customAttrs, finish, sud,
}: PillsBlockProps) {
  if (attributes.length === 0 && oils.length === 0 && sud.length === 0) return null;

  // User-Wunsch (Mai 2026): wenn nur EINE der beiden Sektionen aktiv ist
  // (NUR Besonderheiten ODER NUR Öle), wird sie um 50% größer dargestellt
  // damit sie den verfügbaren Platz besser nutzt — Karte wirkt weniger leer.
  const hasAttrs = attributes.length > 0;
  const hasOils  = oils.length > 0 || sud.length > 0;
  const onlyOne  = hasAttrs !== hasOils; // XOR

  // Alle Minima zusätzlich über --d (Raum × Inhalt, siehe index.css .tile-body).
  // Der cqh-Mittelterm und die Maxima bleiben unangetastet — auf 4K ändert sich
  // dadurch nichts, geschrumpft wird nur dort, wo bisher der starre Pixel-Boden
  // band und der Inhalt deshalb überlief.
  const subHeaderStyle: CSSProperties = {
    fontSize: onlyOne ? 'clamp(calc(12px * var(--d)), 3cqh, 17px)' : 'clamp(calc(8px * var(--d)), 2cqh, 11px)',
    letterSpacing: '0.12em',
  };
  const headerPadding = onlyOne
    ? 'clamp(calc(3px * var(--d)), 0.9cqh, 6px) clamp(calc(9px * var(--d)), 2.2cqh, 18px)'
    : 'clamp(calc(2px * var(--d)), 0.6cqh, 4px) clamp(calc(6px * var(--d)), 1.5cqh, 12px)';

  /** Pillengröße aus der tatsächlichen Belegung.
   *
   *  Vorher stand hier clamp(10px, 2.8cqh, 16px). Der cqh-Term liefert auf
   *  einer 291-px-Kachel nur 8,1 px, also band immer der 10-px-Boden — die
   *  Pillen waren winzig und klebten oben links in der Ecke, egal wie viel
   *  Platz daneben frei war.
   *
   *  Jetzt wird gerechnet: wie viele Pillen passen nebeneinander, wie viele
   *  Zeilen ergibt das, und wie groß darf eine Pille dann sein, damit die
   *  Zeilen in die Sektion passen. Zwei Bremsen über min(): die Höhe
   *  (Zeilenzahl) und die Breite (Pillen pro Zeile) — es bremst die, die
   *  zuerst greift. Eine einzelne Pille wird dadurch groß, sechs bleiben
   *  lesbar. */
  function pillSizing(count: number) {
    const proZeile = onlyOne
      ? Math.min(count, count <= 3 ? count : 3)
      : Math.min(count, count <= 2 ? count : 2);
    const zeilen = Math.max(1, Math.ceil(count / Math.max(1, proZeile)));
    // Höhenbudget des Pillen-Bereichs ≈ 20 cqh, Breitenbudget ≈ 10 cqw
    // (volle Kartenbreite) bzw. 5 cqw (zwei Sektionen nebeneinander).
    //
    // OBERGRENZE (User-Wunsch 03.08.2026, mit Screenshot): keine Pille darf
    // größer werden als in der Referenz-Karte — drei Öle NEBEN drei
    // Eigenschaften (13:00 Blockhaus). Ohne diesen Deckel blies die Formel
    // eine einzelne Pille auf das Maximum: „Musik" allein stand mit 34 px
    // neben „Orange bitter · Elemi" mit 26 px, auf derselben Tafel daneben
    // die Referenz mit 20 px. Genau dieses Ungleichgewicht war gemeint.
    // Nach unten bleibt alles wie bisher — volle Sektionen dürfen weiter
    // kleiner werden, damit sie hineinpassen.
    const hoehe = Math.min(REF_HOEHE_CQH, 18 / zeilen).toFixed(2);
    const breite = Math.min(REF_BREITE_CQW, (onlyOne ? 8.8 : 4.4) / Math.max(1, proZeile)).toFixed(2);
    return `clamp(11px, min(${hoehe}cqh, ${breite}cqw), 34px)`;
  }

  // Besonderheiten deckeln — was übrig bleibt, kommt als "+N"-Chip dazu,
  // damit nichts stillschweigend verschwindet.
  const shownAttrs = attributes.slice(0, MAX_ATTR_PILLS);
  const hiddenAttrCount = attributes.length - shownAttrs.length;

  // EINE Größe für ALLE Pillen einer Karte. Vorher rechnete jede Sektion für
  // sich — und weil die Größe mit der Anzahl fällt, standen auf derselben
  // Karte eine einzelne große Öl-Pille neben drei kleinen Eigenschaften
  // (15:00 Kelo im Screenshot: „Zirbelkiefer" riesig, „Ohne Musik /
  // Salzpeeling / Versucherle" klein). Maßgeblich ist jetzt die VOLLERE
  // Sektion: was dort hineinpasst, gilt für beide. Damit sind die zwei
  // Blöcke einer Karte immer auf gleicher Höhe — genau die gewünschte
  // saubere Ausrichtung zueinander.
  const pillAnzahlAttr = shownAttrs.length + (hiddenAttrCount > 0 ? 1 : 0);
  const pillFont = pillSizing(Math.max(pillAnzahlAttr, oils.length));
  const pillFontAttr = pillFont;
  const pillFontOil = pillFont;

  return (
    /* Der entscheidende Hebel gegen den Überlauf: sind BEIDE Sektionen gefüllt
       (Besonderheiten UND Öle — laut User der Normalfall), standen sie bisher
       untereinander und kosteten die doppelte Höhe. Ab einer Kartenbreite von
       420px stehen sie per @container-Regel (.pills-both in index.css) NEBEN-
       einander; die Höhe ist dann max(a,b) statt a+b+gap. Auf schmalen Karten
       bleibt es beim Untereinander.

       flex 0 1 auto + min-h-0: der Block ist das einzige nachgiebige Element
       der Karte, damit der Fuß garantiert stehen bleibt.

       Und er nimmt sich NUR, was er braucht. Zwischenzeitlich stand hier
       `1 1 auto` — damals wuchsen die Pillen mit, der Kasten war also immer
       gefüllt. Seit die Pillengröße gedeckelt ist (siehe pillSizing), stimmte
       das nicht mehr: zwei Pillen schwammen in einem Kasten mit 24 % Füllgrad,
       die Karte wirkte leer. Jetzt umschließt der Block seinen Inhalt, und die
       übrige Höhe sammelt sich als normaler Abstand über dem Fuß statt als
       Loch innerhalb eines gerahmten Kastens. Schrumpfen darf er weiterhin
       (`0 1 auto`), damit der Fuß auf engen Kacheln nicht verdrängt wird. */
    <div
      className={`pills-block flex flex-col w-full ${hasAttrs && hasOils ? 'pills-both' : ''}`}
      style={{ flex: '0 1 auto', minHeight: 0, overflow: 'hidden', gap: 'clamp(calc(8px * var(--d)), 2cqh, 18px)' }}
    >
      {attributes.length > 0 && (
        /* "übereinander" → Card mit eigenem Background + stärkerem Ring,
           damit sie als ein klar abgegrenzter Block wirkt (nicht mehr
           "verklebt" mit der Öle-Card darunter). bg-white/70 statt
           zwei separater Inner-Backgrounds. */
        <div
          className={`flex-1 min-w-0 rounded-xl ring-2 overflow-hidden shadow-sm ${
            attributesAreDefault ? 'ring-violet-400/40 opacity-95' : 'ring-slate-400/40'
          }`}
          style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <div
            className={`font-bold uppercase ${attributesAreDefault ? 'text-violet-800' : 'text-slate-800'}`}
            style={{
              ...subHeaderStyle,
              padding: headerPadding,
              background: attributesAreDefault
                ? `linear-gradient(180deg, rgba(255,255,255,${deck(0.82, finish.pillen)}), rgba(237,233,254,${deck(0.72, finish.pillen)}))`
                : `linear-gradient(180deg, rgba(255,255,255,${deck(0.82, finish.pillen)}), rgba(226,232,240,${deck(0.72, finish.pillen)}))`,
            }}
          >
            {attributesAreDefault ? '🪶 Sein Stil' : '⚡ Besonderheiten'}
          </div>
          <div
            className="flex flex-1 flex-wrap items-center content-center justify-center min-h-0"
            style={{
              fontSize: pillFontAttr, gap: '0.45em', padding: '0.5em 0.6em',
              // Nur hier, wo die Pillen stehen, liegt noch ein Hauch Weiß —
              // 20 % statt der früheren 65 %. Genug, damit die Pillen sich
              // absetzen, wenig genug, dass die Öl-Motive durchkommen.
              background: `rgba(255,255,255,${deck(0.20, finish.pillen)})`,
            }}
          >
            {shownAttrs.map((a) => {
              // 1) Standard-Attribut? → aus ATTR_BY_ID auflösen
              const standardMeta = ATTR_BY_ID[a as InfusionAttribute];
              if (standardMeta) {
                const c = colorForAttr(a);
                return (
                  <span
                    key={`a-${a}`}
                    title={standardMeta.label}
                    className="inline-flex items-center rounded-full backdrop-blur font-medium text-slate-800 whitespace-nowrap"
                    style={{
                      padding: '0.34em 0.85em',
                      gap: '0.4em',
                      background: tintBg(c, finish.oele),
                      boxShadow: tintRing(c),
                    }}
                  >
                    <span aria-hidden>{standardMeta.emoji}</span>
                    <span>{standardMeta.label}</span>
                  </span>
                );
              }
              // 2) Custom-Attr? → ID ist eine UUID, in customAttrs lookup
              const customMeta = customAttrs.find((ca) => ca.id === a);
              if (customMeta) {
                const c = customMeta.color ?? '#a855f7';
                return (
                  <span
                    key={`a-${a}`}
                    title={customMeta.label}
                    className="inline-flex items-center rounded-full backdrop-blur font-medium text-slate-800 whitespace-nowrap"
                    style={{
                      padding: '0.34em 0.85em',
                      gap: '0.4em',
                      background: tintBg(c, finish.oele),
                      boxShadow: tintRing(c),
                    }}
                  >
                    <span aria-hidden>{customMeta.emoji}</span>
                    <span>{customMeta.label}</span>
                  </span>
                );
              }
              // 3) Unbekannte ID → skip (kein crash bei DB-Inkonsistenz)
              return null;
            })}
            {hiddenAttrCount > 0 && (
              <span
                title={`${hiddenAttrCount} weitere Besonderheiten`}
                className="inline-flex items-center rounded-full backdrop-blur font-bold text-slate-700 whitespace-nowrap"
                style={{
                  padding: '0.34em 0.85em',
                  background: tintBg('#64748b', finish.oele),
                  boxShadow: tintRing('#64748b'),
                }}
              >
                +{hiddenAttrCount}
              </span>
            )}
          </div>
        </div>
      )}
      {(oils.length > 0 || sud.length > 0) && (
        /* Öle-Card analog mit eigenem Background + amber-Tönung. Steht je nach
           Kartenbreite unter oder neben der Besonderheiten-Card (.pills-both).
           Nimmt auch den Sud auf: Kräuter und Öle sind dasselbe — Zutaten, die
           ins Wasser kommen. Ein eigener dritter Kasten hätte die Karte auf
           einer 301-px-Kachel gesprengt. */
        <div
          className={`flex-1 min-w-0 rounded-xl ring-2 overflow-hidden shadow-sm ${
            oilsAreDefault ? 'ring-violet-400/40 opacity-95' : 'ring-amber-500/45'
          }`}
          style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <div
            className={`font-bold uppercase ${oilsAreDefault ? 'text-violet-800' : 'text-amber-900'}`}
            style={{
              ...subHeaderStyle,
              padding: headerPadding,
              background: oilsAreDefault
                ? `linear-gradient(180deg, rgba(255,255,255,${deck(0.82, finish.pillen)}), rgba(237,233,254,${deck(0.72, finish.pillen)}))`
                : `linear-gradient(180deg, rgba(255,251,235,${deck(0.84, finish.pillen)}), rgba(253,230,138,${deck(0.70, finish.pillen)}))`,
            }}
          >
            {oilsAreDefault ? '🪶 Seine Lieblings-Öle' : (oils.length > 0 && sud.length > 0 ? '🌿 Öle & Sud' : sud.length > 0 && oils.length === 0 ? '🧪 Sud' : '🌿 Öle')}
          </div>
          <div
            className="flex flex-1 flex-wrap items-center content-center justify-center min-h-0"
            style={{
              fontSize: pillFontOil, gap: '0.45em', padding: '0.5em 0.6em',
              background: `rgba(255,251,235,${deck(0.20, finish.pillen)})`,
            }}
          >
            {oils.map((oilId, i) => {
              // Custom-Öl (Format: 'custom:<uuid>') → Lookup im All-Custom-Oils
              const customUuid = parseCustomOilId(oilId);
              const customOil = customUuid ? customOils.find((co) => co.id === customUuid) : null;
              const stdOil = !customUuid ? OIL_BY_ID[oilId] : null;
              if (!customOil && !stdOil) return null;
              const display = stdOil
                ? { emoji: stdOil.emoji, name: stdOil.name }
                : { emoji: customOil!.emoji, name: customOil!.name };
              // Custom-Öle haben ihre eigene Farbe (Migration 0101) —
              // damit der Aufgießer auf der Tafel sieht welches Öl es
              // ist. Standard-Öle nutzen weiter colorForOil (Admin-Override).
              const c = customOil?.color ?? colorForOil(oilId);
              return (
                <span
                  key={`o-${i}-${oilId}`}
                  title={display.name}
                  className="inline-flex items-center rounded-full backdrop-blur font-semibold text-amber-800 whitespace-nowrap"
                  style={{
                    padding: '0.34em 0.85em',
                    gap: '0.4em',
                    background: tintBg(c),
                    boxShadow: tintRing(c),
                  }}
                >
                  <span aria-hidden>{display.emoji}</span>
                  <span>{display.name}</span>
                </span>
              );
            })}
            {sud.map((sp) => (
              <span
                key={`s-${sp.id}`}
                title={sp.name}
                className="inline-flex items-center rounded-full backdrop-blur font-semibold whitespace-nowrap"
                style={{
                  padding: '0.34em 0.85em',
                  gap: '0.4em',
                  color: '#3f3f1a',
                  background: tintBg(sp.color, finish.oele),
                  boxShadow: tintRing(sp.color),
                }}
              >
                <span aria-hidden>{sp.emoji}</span>
                <span>{sp.name}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WoodGrainOverlay ─────────────────────────────────────────────────────
// Schwarzwald-Holz-Maserung als direktes Inline-SVG (NICHT als <pattern>
// + <use> — das hat in der ersten Iteration nicht gerendert, vermutlich
// wegen viewBox/sizing-Issues mit width="100%"-SVGs ohne viewBox).
//
// Diesmal: explizites viewBox + preserveAspectRatio="none" + Pfade direkt
// im viewBox-Koordinatensystem. SVG wird auf Card-Größe gestaucht.
// vectorEffect="non-scaling-stroke" hält die Linienbreite konstant
// unabhängig vom Skalierungsfaktor.
//
// z-index: 1 stellt sicher dass die Maserung ÜBER dem Tailwind ::before
// (weißer Inner-Gradient, z-index auto) liegt. Der Card-Content (compact
// div) bekommt z-index 10 damit er über der Maserung bleibt.
function WoodGrainOverlay() {
  return (
    <svg
      aria-hidden
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 400 300"
      preserveAspectRatio="none"
      style={{ zIndex: 1 }}
    >
      {/* Haupt-Adern — dunkles Brown, kräftig sichtbar */}
      <g stroke="#5d3414" strokeWidth="1.6" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke">
        <path d="M0,18 Q100,10 200,20 T400,14" opacity="0.55" />
        <path d="M0,48 Q120,40 240,52 T400,44" opacity="0.55" />
        <path d="M0,78 Q90,70 180,82 T400,76" opacity="0.50" />
        <path d="M0,108 Q140,100 280,112 T400,104" opacity="0.55" />
        <path d="M0,138 Q100,130 200,142 T400,134" opacity="0.50" />
        <path d="M0,168 Q120,160 240,172 T400,164" opacity="0.55" />
        <path d="M0,198 Q90,190 180,202 T400,194" opacity="0.45" />
        <path d="M0,228 Q140,220 280,232 T400,224" opacity="0.55" />
        <path d="M0,258 Q100,250 200,262 T400,254" opacity="0.50" />
        <path d="M0,288 Q120,280 240,292 T400,284" opacity="0.55" />
      </g>
      {/* Zwischen-Adern — helleres Brown, etwas dünner */}
      <g stroke="#8b5a2b" strokeWidth="1.1" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke">
        <path d="M0,32 Q110,26 220,36 T400,30" opacity="0.45" />
        <path d="M0,62 Q90,56 180,66 T400,60" opacity="0.40" />
        <path d="M0,92 Q140,86 280,96 T400,90" opacity="0.45" />
        <path d="M0,122 Q100,116 200,126 T400,120" opacity="0.40" />
        <path d="M0,152 Q120,146 240,156 T400,150" opacity="0.45" />
        <path d="M0,182 Q90,176 180,186 T400,180" opacity="0.40" />
        <path d="M0,212 Q140,206 280,216 T400,210" opacity="0.45" />
        <path d="M0,242 Q100,236 200,246 T400,240" opacity="0.40" />
        <path d="M0,272 Q120,266 240,276 T400,270" opacity="0.45" />
      </g>
      {/* Astlöcher / Knoten — kleine dunkle Ellipsen für organischen Look */}
      <g fill="#4a2a10" stroke="#3a1f08" strokeWidth="0.8" vectorEffect="non-scaling-stroke">
        <ellipse cx="78"  cy="58"  rx="6" ry="4" opacity="0.35" />
        <ellipse cx="252" cy="148" rx="8" ry="5" opacity="0.40" />
        <ellipse cx="340" cy="76"  rx="5" ry="3" opacity="0.30" />
        <ellipse cx="124" cy="226" rx="7" ry="4" opacity="0.38" />
        <ellipse cx="296" cy="262" rx="5" ry="3" opacity="0.32" />
      </g>
    </svg>
  );
}
