export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'special';

export type BadgeCategory = 'infusion' | 'team' | 'special';

export type BadgeDefinition = {
  id: string;
  emoji: string;
  label: string;
  description: string;
  tier: BadgeTier;
  category: BadgeCategory;
  threshold?: number;
};

export const TIER_STYLES: Record<BadgeTier, { ring: string; text: string; bg: string; shadow: string }> = {
  bronze:   { ring: '#cd7f32', text: '#f5c87a', bg: '#3d1f00', shadow: '0 0 14px #cd7f3255' },
  silver:   { ring: '#94a3b8', text: '#e2e8f0', bg: '#1e2a3a', shadow: '0 0 14px #94a3b840' },
  gold:     { ring: '#ffd700', text: '#ffe44d', bg: '#2d1f00', shadow: '0 0 18px #ffd70055' },
  platinum: { ring: '#a78bfa', text: '#ddd6fe', bg: '#1e1a2e', shadow: '0 0 22px #a78bfa60' },
  special:  { ring: '#22c55e', text: '#86efac', bg: '#0f2e1a', shadow: '0 0 14px #22c55e50' },
};

export const TIER_LABEL: Record<BadgeTier, string> = {
  bronze: 'Bronze',
  silver: 'Silber',
  gold: 'Gold',
  platinum: 'Platin',
  special: 'Special',
};

// Meilenstein-Badges (automatisch bei Schwelle)
export const MILESTONE_BADGES: BadgeDefinition[] = [
  {
    id: 'first_infusion',
    emoji: '🌱',
    label: 'Frischling',
    description: 'Dein erster Aufguss — der Anfang von etwas Großem.',
    tier: 'bronze',
    category: 'infusion',
    threshold: 1,
  },
  {
    id: 'infusion_5',
    emoji: '🔥',
    label: 'Heizer',
    description: '5 Aufgüsse — du weißt wie man einheitzt.',
    tier: 'bronze',
    category: 'infusion',
    threshold: 5,
  },
  {
    id: 'infusion_10',
    emoji: '💧',
    label: 'Wasserkünstler',
    description: '10 Aufgüsse — Dampf und Wasser gehorchen dir.',
    tier: 'silver',
    category: 'infusion',
    threshold: 10,
  },
  {
    id: 'infusion_20',
    emoji: '🌿',
    label: 'Kräutermeister',
    description: '20 Aufgüsse — die Aromen tanzen nach deiner Pfeife.',
    tier: 'silver',
    category: 'infusion',
    threshold: 20,
  },
  {
    id: 'infusion_35',
    emoji: '⚡',
    label: 'Energiebündel',
    description: '35 Aufgüsse — pure Energie, die die Hitze antreibt.',
    tier: 'gold',
    category: 'infusion',
    threshold: 35,
  },
  {
    id: 'infusion_50',
    emoji: '🌊',
    label: 'Wellenmeister',
    description: '50 Aufgüsse — deine Wellen tragen die Wärme durch den ganzen Raum.',
    tier: 'gold',
    category: 'infusion',
    threshold: 50,
  },
  {
    id: 'infusion_75',
    emoji: '👑',
    label: 'Sauna-König',
    description: '75 Aufgüsse — du trägst die Krone der Hitze.',
    tier: 'platinum',
    category: 'infusion',
    threshold: 75,
  },
  {
    id: 'infusion_100',
    emoji: '🏆',
    label: 'Legende',
    description: '100 Aufgüsse — unvergessen, unübertroffen, legendär.',
    tier: 'platinum',
    category: 'infusion',
    threshold: 100,
  },
  {
    id: 'team_3',
    emoji: '🤝',
    label: 'Teamplayer',
    description: '3 Team-Aufgüsse — gemeinsam ist man stärker.',
    tier: 'bronze',
    category: 'team',
    threshold: 3,
  },
  {
    id: 'team_10',
    emoji: '💫',
    label: 'Duo-Dynamo',
    description: '10 Team-Aufgüsse — ihr brennt zusammen.',
    tier: 'silver',
    category: 'team',
    threshold: 10,
  },
  {
    id: 'team_20',
    emoji: '🔗',
    label: 'Synergist',
    description: '20 Team-Aufgüsse — eine unschlagbare Einheit.',
    tier: 'gold',
    category: 'team',
    threshold: 20,
  },
];

// Spezial-Badges (werden manuell oder über besondere Checks vergeben)
export const SPECIAL_BADGES: BadgeDefinition[] = [
  {
    id: 'pioneer',
    emoji: '⭐',
    label: 'Pionier',
    description: 'Einer der ersten 3 Aufgieser des Vereins — du hast den Weg geebnet.',
    tier: 'special',
    category: 'special',
  },
  {
    id: 'early_bird',
    emoji: '🌅',
    label: 'Frühaufsteher',
    description: 'Ein Aufguss um 11:00 Uhr — der frühe Meister weckt die Sauna.',
    tier: 'special',
    category: 'special',
  },
  {
    id: 'night_owl',
    emoji: '🌙',
    label: 'Nachtschicht',
    description: 'Ein Aufguss um 20:00 Uhr — der letzte Glut des Abends.',
    tier: 'special',
    category: 'special',
  },
  {
    id: 'allrounder',
    emoji: '🎯',
    label: 'Allrounder',
    description: 'In jeder aktiven Sauna aufgegossen — kein Ofen zu heiß, kein Raum zu unbekannt.',
    tier: 'special',
    category: 'special',
  },
  {
    id: 'marathon',
    emoji: '🏃',
    label: 'Marathon',
    description: '3 Aufgüsse an einem Tag — ausnahmslose Hingabe.',
    tier: 'special',
    category: 'special',
  },
  {
    id: 'feedback_giver',
    emoji: '💬',
    label: 'Feedback-Geber',
    description: '10 Bewertungen abgegeben — du hilfst anderen besser zu werden.',
    tier: 'special',
    category: 'special',
  },
  {
    id: 'wm_champion_gold',
    emoji: '🥇',
    label: 'WM-Tipp-König 2026',
    description: 'Platz 1 im Saunafreunde-Tipspiel der WM 2026 — der absolute Tipp-Profi.',
    tier: 'gold',
    category: 'special',
  },
  {
    id: 'wm_champion_silver',
    emoji: '🥈',
    label: 'WM-Tipp-Vize 2026',
    description: 'Platz 2 im Saunafreunde-Tipspiel der WM 2026 — knapp am Thron vorbei.',
    tier: 'silver',
    category: 'special',
  },
  {
    id: 'wm_champion_bronze',
    emoji: '🥉',
    label: 'WM-Tipp-Bronze 2026',
    description: 'Platz 3 im Saunafreunde-Tipspiel der WM 2026 — auf das Podium geschafft.',
    tier: 'bronze',
    category: 'special',
  },
  {
    id: 'streak_4w',
    emoji: '🔥',
    label: 'Stammgast',
    description: '4 Wochen in Folge mindestens 1× anwesend — du hältst die Glut am Leben.',
    tier: 'bronze',
    category: 'special',
  },
  {
    id: 'streak_12w',
    emoji: '🔥🔥',
    label: 'Sauna-Pflanze',
    description: '12 Wochen in Folge anwesend — du wurzelst hier tief.',
    tier: 'silver',
    category: 'special',
  },
  {
    id: 'streak_24w',
    emoji: '🔥🔥🔥',
    label: 'Halbjahres-Marathon',
    description: '24 Wochen in Folge anwesend — unermüdlich, unverwüstlich, unverzichtbar.',
    tier: 'gold',
    category: 'special',
  },
];

export const ALL_BADGES: BadgeDefinition[] = [...MILESTONE_BADGES, ...SPECIAL_BADGES];

// Nächster Meilenstein-Badge für einen gegebenen Zähler
export function nextMilestone(
  count: number,
  category: 'infusion' | 'team'
): BadgeDefinition | null {
  const relevant = MILESTONE_BADGES.filter((b) => b.category === category && b.threshold !== undefined);
  return relevant.find((b) => (b.threshold ?? 0) > count) ?? null;
}

// Aktueller höchster erreichter Badge für einen Zähler
export function currentMilestone(
  count: number,
  category: 'infusion' | 'team'
): BadgeDefinition | null {
  const relevant = MILESTONE_BADGES.filter((b) => b.category === category && b.threshold !== undefined);
  const earned = relevant.filter((b) => (b.threshold ?? 0) <= count);
  return earned[earned.length - 1] ?? null;
}
