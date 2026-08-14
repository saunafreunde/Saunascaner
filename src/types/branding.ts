import { AUSSCHNITT_DEFAULT, ausschnittAus, type Ausschnitt } from '@/types/ausschnitt';
import { infoKartenAus, type InfoKarte } from '@/types/infokarten';

// Zentrale Vereins-Identität — wird aus system_config.brand_settings gelesen.
// Single source of truth für Logo-Set, Vereinsdaten, Mail-Footer-Texte und
// alle visuellen Assets (Seiten-Hintergründe, Tile-Backgrounds, Badge, Ads).

export type OrgInfo = {
  name: string;
  short_name: string;
  location: string;
  website: string | null;
  contact_email: string | null;
  mail_footer: string | null;
};

/** Nur zwei Varianten. `favicon` und `dark` gab es hier bis 08.08.2026 auch —
 *  beide wurden von keiner Stelle der App je gelesen (das Favicon kommt
 *  statisch aus index.html und dem PWA-Manifest). Die Felder sind aus dem Typ
 *  entfernt, nicht aus der Datenbank: brand_settings ist ein jsonb-Blob, alte
 *  Werte werden von mergeBrandDefaults einfach ignoriert. */
export type LogoSet = {
  icon: string | null;
  banner: string | null;
};

export type PageBackgrounds = {
  dashboard: string | null;
  guest: string | null;
  planner: string | null;
  login: string | null;
};

export type BadgeAssets = {
  front_bg: string | null;
  back_bg: string | null;
};

/* AdSlot (Werbeplätze der TV-Sidebar) ist am 08.08.2026 entfallen — die
   Sidebar selbst gibt es seit dem Tafel-Umbau nicht mehr, siehe BrandingTab. */

// Ausschnitt liegt in einer eigenen Datei — siehe dort, warum: sonst
// entsteht ein Import-Zyklus über infokarten.ts, der das Bundle sprengt.
// Import UND Re-Export: ein blosses `export … from` brächte die Namen nicht in
// den lokalen Scope, gebraucht werden sie hier unten aber auch.
export { AUSSCHNITT_DEFAULT, ausschnittAus };
export type { Ausschnitt };

/** Vereins-Foto für die leeren Kacheln der TV-Tafel (Slot-Karussell).
 *  Liegt bewusst hier statt in einer eigenen Tabelle: brand_settings ist ein
 *  jsonb-Blob in system_config und über die Policy config_read_public bereits
 *  anon lesbar — ein neues Feld kostet damit keine Migration. */
export type GalleryPhoto = {
  image_path: string;
  caption: string | null;
  ausschnitt: Ausschnitt;
};

/** Hintergrundbild einer einzelnen Aufguss-Kachel.
 *  Bis 08.08.2026 stand hier nur der nackte Pfad als String; mergeBrandDefaults
 *  hebt Altbestände beim Lesen auf diese Form an, deshalb ohne Migration. */
export type TileBg = {
  path: string;
  ausschnitt: Ausschnitt;
};

/** Feinschliff der Tafel-Optik: Multiplikatoren auf die eingebauten
 *  Deckkräfte, in vier Gruppen. 1 = unverändert wie gebaut, kleiner = das
 *  Motiv kommt kräftiger durch, größer = ruhiger und lesbarer.
 *
 *  Bewusst Multiplikatoren statt absoluter Werte: die Karte arbeitet nicht mit
 *  EINER Deckkraft, sondern mit abgestuften Verläufen (oben fast deckend für
 *  die Uhrzeit, in der Mitte offen fürs Motiv, unten wieder heller für den
 *  Fuß). Ein absoluter Regler würde diese Staffelung plattmachen. */
export type TafelFinish = {
  /** Weißer Schleier über Öl- und Schnaps-Motiven. Der stärkste Hebel. */
  schleier: number;
  /** Flächen der Blöcke „Besonderheiten" und „Öle". */
  pillen: number;
  /** Die einzelnen Öl- und Attribut-Pillen darin. */
  oele: number;
  /** Grundfläche der Karte, wenn kein Motiv dahinterliegt. */
  karte: number;
};

export const FINISH_DEFAULT: TafelFinish = { schleier: 1, pillen: 1, oele: 1, karte: 1 };

export function finishAus(v: unknown): TafelFinish {
  const o = (v ?? {}) as Partial<TafelFinish>;
  const f = (n: unknown, fallback: number) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.min(1.6, Math.max(0.2, n)) : fallback;
  return {
    schleier: f(o.schleier, 1), pillen: f(o.pillen, 1),
    oele: f(o.oele, 1), karte: f(o.karte, 1),
  };
}

/** Deckkraft mit Faktor — bleibt garantiert im gültigen Bereich. */
export function deck(basis: number, faktor: number): number {
  return Math.min(1, Math.max(0, basis * faktor));
}

/** Welche Deko-Karten im Karussell leerer Tafel-Kacheln mitlaufen.
 *  Öl-Tafel und Vereins-Galerie sind IMMER dabei (die Galerie blendet sich
 *  ohne Fotos ohnehin selbst aus) — schaltbar sind nur die beiden reinen
 *  Deko-Szenen. Beide stehen per Default auf aus: sie passten nicht mehr zum
 *  Rest der Tafel, sollten aber abrufbar bleiben statt gelöscht zu werden.
 *  Liegt wie slot_gallery im jsonb-Blob, kostet daher keine Migration. */
export type SlotCards = {
  reef: boolean;
  forest: boolean;
};

/** Das Tablet im Öl-Raum. Nur der Admin stellt das ein — vom Handy aus, über
 *  den Branding-Tab. Liegt wie slot_gallery im jsonb-Blob und kostet deshalb
 *  keine Migration und keine neue Policy (config_read_public zählt die
 *  erlaubten Keys einzeln auf, `brand_settings` ist schon dabei).
 *
 *  Bewusst NICHT unter `backgrounds` eingehängt: dort baut die Sammelaktion
 *  „Dashboard → überall übernehmen" das Objekt mit vier festen Schlüsseln neu
 *  und würde einen fünften stillschweigend verschlucken. */
export type OelraumSettings = {
  /** Hintergrund für Ruhe- und Vorbereitungsansicht. Null = schlichtes Dunkel. */
  hintergrund: string | null;
  ausschnitt: Ausschnitt;
  /** Wie weit voraus das Tablet Aufgüsse zeigt. Darunter: nur das Logo. */
  vorlauf_stunden: number;
  /** Ab wie vielen Minuten vor Start fehlende Zutaten ROT PULSIEREND
   *  angemahnt werden — vorher steht der Hinweis ruhig da. Vorgabe Christoph
   *  (14.08.2026): 30 Minuten. */
  mahnung_ab_minuten: number;
};

export const OELRAUM_DEFAULT: OelraumSettings = {
  hintergrund: null,
  ausschnitt: { ...AUSSCHNITT_DEFAULT },
  vorlauf_stunden: 3,
  mahnung_ab_minuten: 30,
};

export function oelraumAus(v: unknown): OelraumSettings {
  const o = (v ?? {}) as Partial<OelraumSettings>;
  const zahl = (n: unknown, min: number, max: number, fallback: number) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  return {
    hintergrund: typeof o.hintergrund === 'string' && o.hintergrund ? o.hintergrund : null,
    ausschnitt: ausschnittAus(o.ausschnitt),
    vorlauf_stunden: zahl(o.vorlauf_stunden, 1, 12, OELRAUM_DEFAULT.vorlauf_stunden),
    mahnung_ab_minuten: zahl(o.mahnung_ab_minuten, 15, 480, OELRAUM_DEFAULT.mahnung_ab_minuten),
  };
}

export type BrandSettings = {
  org: OrgInfo;
  logo: LogoSet;
  backgrounds: PageBackgrounds;
  tile_bgs: { [saunaId: string]: (TileBg | null)[] };
  badge: BadgeAssets;
  slot_gallery: GalleryPhoto[];
  slot_cards: SlotCards;
  tafel_finish: TafelFinish;
  oelraum: OelraumSettings;
  /** Frei gestaltete Info-Karten für die Tafel (siehe types/infokarten.ts).
   *  Liegen hier und nicht unter einem eigenen system_config-Key, weil die
   *  Lese-Policy die erlaubten Keys einzeln aufzählt — ein neuer Key wäre für
   *  die anonyme Tafel unsichtbar. */
  info_karten: InfoKarte[];
};

export function defaultBrandSettings(): BrandSettings {
  return {
    org: {
      name: 'Saunafreunde Schwarzwald e.V.',
      short_name: 'Saunafreunde',
      location: 'Freudenstadt',
      website: null,
      contact_email: 'info@sauna-fds.de',
      mail_footer: null,
    },
    logo: { icon: null, banner: null },
    backgrounds: { dashboard: null, guest: null, planner: null, login: null },
    tile_bgs: {},
    badge: { front_bg: null, back_bg: null },
    slot_gallery: [],
    slot_cards: { reef: false, forest: false },
    tafel_finish: { ...FINISH_DEFAULT },
    oelraum: { ...OELRAUM_DEFAULT, ausschnitt: { ...AUSSCHNITT_DEFAULT } },
    info_karten: [],
  };
}

/** Merge partial Brand-Settings into full default-Struktur. Resilient gegen fehlende Felder. */
export function mergeBrandDefaults(partial: Partial<BrandSettings> | null | undefined): BrandSettings {
  const def = defaultBrandSettings();
  if (!partial) return def;
  return {
    org: { ...def.org, ...(partial.org ?? {}) },
    // logo bewusst FELDWEISE statt per Spread: der Blob in der Datenbank trägt
    // noch die abgeschafften Keys `favicon` und `dark`. Ein Spread schleppte
    // sie bei jedem Speichern wieder mit.
    logo: { icon: partial.logo?.icon ?? def.logo.icon, banner: partial.logo?.banner ?? def.logo.banner },
    backgrounds: { ...def.backgrounds, ...(partial.backgrounds ?? {}) },
    // Altbestand anheben: bis 08.08.2026 stand pro Kachel nur der nackte Pfad.
    // Beide Formen kommen aus derselben jsonb-Spalte, das Anheben passiert
    // deshalb hier beim Lesen — eine Migration braucht es dafür nicht.
    tile_bgs: tileBgsAus(partial.tile_bgs),
    badge: { ...def.badge, ...(partial.badge ?? {}) },
    slot_gallery: Array.isArray(partial.slot_gallery)
      ? partial.slot_gallery
          .filter((g) => !!g?.image_path)
          .map((g) => ({
            image_path: g.image_path,
            caption: g.caption ?? null,
            ausschnitt: ausschnittAus(g.ausschnitt),
          }))
      : def.slot_gallery,
    slot_cards: { ...def.slot_cards, ...(partial.slot_cards ?? {}) },
    tafel_finish: finishAus(partial.tafel_finish),
    oelraum: oelraumAus(partial.oelraum),
    info_karten: infoKartenAus(partial.info_karten),
  };
}

/** Normalisiert die Kachel-Hintergründe: alte Einträge sind Strings, neue
 *  Objekte mit Ausschnitt. Nach dieser Funktion ist beides dasselbe. */
function tileBgsAus(roh: unknown): BrandSettings['tile_bgs'] {
  if (!roh || typeof roh !== 'object') return {};
  const aus: BrandSettings['tile_bgs'] = {};
  for (const [saunaId, liste] of Object.entries(roh as Record<string, unknown>)) {
    if (!Array.isArray(liste)) continue;
    aus[saunaId] = liste.map((e): TileBg | null => {
      if (typeof e === 'string' && e) return { path: e, ausschnitt: { ...AUSSCHNITT_DEFAULT } };
      const o = e as Partial<TileBg> | null;
      if (o && typeof o.path === 'string' && o.path) {
        return { path: o.path, ausschnitt: ausschnittAus(o.ausschnitt) };
      }
      return null;
    });
  }
  return aus;
}
