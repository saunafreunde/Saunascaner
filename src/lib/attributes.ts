export type InfusionAttribute =
  | 'flame'        // extra heiß
  | 'sud'          // intensiver Sud
  | 'nature'       // Natur / Kräuter
  | 'music'        // Musik
  | 'loud_music'   // sehr laute Musik
  | 'no_music'     // ruhig, keine Musik
  | 'menthol'         // Menthol-Kristalle
  | 'raeuchern'       // Räuchern
  | 'kaffee'          // Kaffee-Aufguss
  | 'kirschwasser'    // Kirschwasser
  | 'haferpflaume'    // Haferpflaume
  | 'banja'           // russische Banja
  | 'wenik'           // Wenikaufguss (Birkenzweig)
  | 'vulkan';         // Vulkanaufguss

export const ATTRIBUTES: { id: InfusionAttribute; emoji: string; label: string }[] = [
  { id: 'flame',        emoji: '🔥', label: 'Extra heiß' },
  { id: 'sud',          emoji: '💧', label: 'Intensiver Sud' },
  { id: 'nature',       emoji: '🌿', label: 'Natur / Kräuter' },
  { id: 'music',        emoji: '🎵', label: 'Musik' },
  { id: 'loud_music',   emoji: '🔊', label: 'Sehr laut' },
  { id: 'no_music',     emoji: '🔇', label: 'Ohne Musik' },
  { id: 'menthol',      emoji: '❄️', label: 'Menthol-Kristalle' },
  { id: 'raeuchern',    emoji: '💨', label: 'Räuchern' },
  { id: 'kaffee',       emoji: '☕', label: 'Kaffee' },
  { id: 'kirschwasser', emoji: '🍒', label: 'Kirschwasser' },
  { id: 'haferpflaume', emoji: '🟣', label: 'Haferpflaume' },
  { id: 'banja',        emoji: '🇷🇺', label: 'Banja' },
  { id: 'wenik',        emoji: '🍃', label: 'Wenikaufguss' },
  { id: 'vulkan',       emoji: '🌋', label: 'Vulkanaufguss' },
];

export const ATTR_BY_ID: Record<InfusionAttribute, { emoji: string; label: string }> =
  Object.fromEntries(ATTRIBUTES.map((a) => [a.id, { emoji: a.emoji, label: a.label }])) as never;
