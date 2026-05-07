export type InfusionAttribute =
  | 'flame'        // extra heiß
  | 'sud'          // intensiver Sud
  | 'nature'       // Natur / Kräuter
  | 'music'        // Musik
  | 'loud_music'   // sehr laute Musik
  | 'no_music';    // ruhig, keine Musik

export const ATTRIBUTES: { id: InfusionAttribute; emoji: string; label: string }[] = [
  { id: 'flame',      emoji: '🔥', label: 'Extra heiß' },
  { id: 'sud',        emoji: '💧', label: 'Intensiver Sud' },
  { id: 'nature',     emoji: '🌿', label: 'Natur / Kräuter' },
  { id: 'music',      emoji: '🎵', label: 'Musik' },
  { id: 'loud_music', emoji: '🔊', label: 'Sehr laut' },
  { id: 'no_music',   emoji: '🔇', label: 'Ohne Musik' },
];

export const ATTR_BY_ID: Record<InfusionAttribute, { emoji: string; label: string }> =
  Object.fromEntries(ATTRIBUTES.map((a) => [a.id, { emoji: a.emoji, label: a.label }])) as never;
