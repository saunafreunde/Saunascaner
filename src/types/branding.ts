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

export type LogoSet = {
  icon: string | null;
  banner: string | null;
  favicon: string | null;
  dark: string | null;
};

export type PageBackgrounds = {
  dashboard: string | null;
  guest: string | null;
  planner: string | null;
  wm: string | null;
  login: string | null;
};

export type BadgeAssets = {
  front_bg: string | null;
  back_bg: string | null;
};

export type AdSlot = {
  image_path: string;
  href: string | null;
  alt: string | null;
};

export type BrandSettings = {
  org: OrgInfo;
  logo: LogoSet;
  backgrounds: PageBackgrounds;
  tile_bgs: { [saunaId: string]: (string | null)[] };
  badge: BadgeAssets;
  ads: AdSlot[];
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
    logo: { icon: null, banner: null, favicon: null, dark: null },
    backgrounds: { dashboard: null, guest: null, planner: null, wm: null, login: null },
    tile_bgs: {},
    badge: { front_bg: null, back_bg: null },
    ads: [],
  };
}

/** Merge partial Brand-Settings into full default-Struktur. Resilient gegen fehlende Felder. */
export function mergeBrandDefaults(partial: Partial<BrandSettings> | null | undefined): BrandSettings {
  const def = defaultBrandSettings();
  if (!partial) return def;
  return {
    org: { ...def.org, ...(partial.org ?? {}) },
    logo: { ...def.logo, ...(partial.logo ?? {}) },
    backgrounds: { ...def.backgrounds, ...(partial.backgrounds ?? {}) },
    tile_bgs: partial.tile_bgs ?? def.tile_bgs,
    badge: { ...def.badge, ...(partial.badge ?? {}) },
    ads: Array.isArray(partial.ads)
      ? partial.ads.map((a) => ({
          image_path: a.image_path,
          href: a.href ?? null,
          alt: a.alt ?? null,
        }))
      : def.ads,
  };
}
