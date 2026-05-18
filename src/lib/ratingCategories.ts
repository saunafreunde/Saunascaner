export const RATING_CATEGORIES = [
  { id: 'chemie',          emoji: '✨', label: 'Stimmung im Raum',   tip: 'Wie war die Stimmung beim Aufguss?' },
  { id: 'luftbewegung',    emoji: '💨', label: 'Luftbewegung',       tip: 'War die Wedelbewegung spürbar?' },
  { id: 'wedeltechnik',    emoji: '🌊', label: 'Wedeltechnik',       tip: 'Gleichmäßigkeit und Rhythmus' },
  { id: 'hitzeniveau',     emoji: '🌡️', label: 'Hitzeniveau',        tip: 'War die Intensität angenehm?' },
  { id: 'musik',           emoji: '🎵', label: 'Musik / Atmosphäre', tip: 'Passte die Musik zur Stimmung?' },
  { id: 'duftentwicklung', emoji: '🌿', label: 'Duftentwicklung',    tip: 'Wie intensiv und angenehm war der Duft?' },
] as const;

export type RatingCategoryId = typeof RATING_CATEGORIES[number]['id'];
