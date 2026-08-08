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

/** Vereins-Foto für die leeren Kacheln der TV-Tafel (Slot-Karussell).
 *  Liegt bewusst hier statt in einer eigenen Tabelle: brand_settings ist ein
 *  jsonb-Blob in system_config und über die Policy config_read_public bereits
 *  anon lesbar — ein neues Feld kostet damit keine Migration. */
export type GalleryPhoto = {
  image_path: string;
  caption: string | null;
};

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

export type BrandSettings = {
  org: OrgInfo;
  logo: LogoSet;
  backgrounds: PageBackgrounds;
  tile_bgs: { [saunaId: string]: (string | null)[] };
  badge: BadgeAssets;
  slot_gallery: GalleryPhoto[];
  slot_cards: SlotCards;
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
    tile_bgs: partial.tile_bgs ?? def.tile_bgs,
    badge: { ...def.badge, ...(partial.badge ?? {}) },
    slot_gallery: Array.isArray(partial.slot_gallery)
      ? partial.slot_gallery
          .filter((g) => !!g?.image_path)
          .map((g) => ({ image_path: g.image_path, caption: g.caption ?? null }))
      : def.slot_gallery,
    slot_cards: { ...def.slot_cards, ...(partial.slot_cards ?? {}) },
  };
}
