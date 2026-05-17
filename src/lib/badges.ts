export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'special';

export type BadgeCategory =
  | 'infusion'    // Aufgießer-Badges (eigene Aufgüsse)
  | 'team'        // Co-Aufgießer
  | 'attendance'  // Anwesenheit (Sauna-Tage + Streaks)
  | 'rating'      // Bewertungen abgegeben
  | 'discovery'   // Aufgießer-/Sauna-Vielfalt
  | 'community'   // Follows, Pioneer
  | 'season'      // Saison + Geburtstag + Adlerauge
  | 'support'     // Helfer-Einsätze (Unterstützer)
  | 'games'       // Mini-Game-Hub /spiele
  | 'special';    // sonstige (Pioneer-Aufgießer, WM, etc.)

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
    category: 'attendance',
    threshold: 4,
  },
  {
    id: 'streak_12w',
    emoji: '🔥🔥',
    label: 'Sauna-Pflanze',
    description: '12 Wochen in Folge anwesend — du wurzelst hier tief.',
    tier: 'silver',
    category: 'attendance',
    threshold: 12,
  },
  {
    id: 'streak_24w',
    emoji: '🔥🔥🔥',
    label: 'Halbjahres-Marathon',
    description: '24 Wochen in Folge anwesend — unermüdlich, unverwüstlich, unverzichtbar.',
    tier: 'gold',
    category: 'attendance',
    threshold: 24,
  },
];

// ─── Gäste-Badges (Migration 0045) ───────────────────────────────────────
// Diese Badges gelten für ALLE Rollen (Gast, Mitglied, Aufgießer-as-Gast).
// Vergabe automatisch via DB-Trigger.

export const GAST_BADGES: BadgeDefinition[] = [
  // Anwesenheit (Sauna-Tage)
  {
    id: 'first_sauna_day',
    emoji: '🔥',
    label: 'Erster Sauna-Tag',
    description: 'Dein erster Tag in der Sauna — willkommen in der Wärme!',
    tier: 'bronze',
    category: 'attendance',
    threshold: 1,
  },
  {
    id: 'regular_5',
    emoji: '🌡️',
    label: 'Stamm-Gast',
    description: '5 Sauna-Tage gesammelt — du wirst zum Gewohnheitstier.',
    tier: 'bronze',
    category: 'attendance',
    threshold: 5,
  },
  {
    id: 'regular_15',
    emoji: '🌡️',
    label: 'Treuer Gast',
    description: '15 Sauna-Tage — die Sauna hat dich fest im Griff.',
    tier: 'silver',
    category: 'attendance',
    threshold: 15,
  },
  {
    id: 'regular_30',
    emoji: '🌡️',
    label: 'Sauna-Veteran',
    description: '30 Sauna-Tage — die Schwarzwald-Schwitze ist deine zweite Heimat.',
    tier: 'gold',
    category: 'attendance',
    threshold: 30,
  },
  {
    id: 'regular_60',
    emoji: '🏆',
    label: 'Sauna-Legende',
    description: '60 Sauna-Tage — du bist Teil des Inventars.',
    tier: 'platinum',
    category: 'attendance',
    threshold: 60,
  },

  // Bewertungen
  {
    id: 'first_rating',
    emoji: '⭐',
    label: 'Erster Eindruck',
    description: 'Erste Aufguss-Bewertung abgegeben — deine Stimme zählt.',
    tier: 'bronze',
    category: 'rating',
    threshold: 1,
  },
  {
    id: 'feedback_giver',
    emoji: '📝',
    label: 'Feedback-Geber',
    description: '10 Aufgüsse bewertet — du hilfst Aufgießern besser zu werden.',
    tier: 'silver',
    category: 'rating',
    threshold: 10,
  },
  {
    id: 'feedback_pro',
    emoji: '📋',
    label: 'Bewertungs-Profi',
    description: '50 Aufgüsse bewertet — du kennst die feinen Unterschiede.',
    tier: 'gold',
    category: 'rating',
    threshold: 50,
  },
  {
    id: 'feedback_top',
    emoji: '🏆',
    label: 'Top-Bewerter',
    description: '100 Aufgüsse bewertet — eine echte Instanz.',
    tier: 'platinum',
    category: 'rating',
    threshold: 100,
  },

  // Entdeckung
  {
    id: 'curious',
    emoji: '🔍',
    label: 'Neugier',
    description: 'Aufgüsse von 3 verschiedenen Aufgießern bewertet.',
    tier: 'bronze',
    category: 'discovery',
    threshold: 3,
  },
  {
    id: 'vielsauner',
    emoji: '🌍',
    label: 'Vielsauner',
    description: '10 verschiedene Aufgießer entdeckt — du suchst die Vielfalt.',
    tier: 'silver',
    category: 'discovery',
    threshold: 10,
  },
  {
    id: 'connaisseur',
    emoji: '👑',
    label: 'Connaisseur',
    description: '25 verschiedene Aufgießer kennengelernt — Kenner par excellence.',
    tier: 'gold',
    category: 'discovery',
    threshold: 25,
  },
  {
    id: 'sauna_allrounder',
    emoji: '🌐',
    label: 'Sauna-Allrounder',
    description: 'Bewertungen in allen 3 Saunen abgegeben — kein Schweiß-Grad zu heiß.',
    tier: 'silver',
    category: 'discovery',
  },

  // Community
  {
    id: 'first_fan',
    emoji: '❤️',
    label: 'Erster Fan',
    description: 'Du folgst deinem ersten Aufgießer — der Anfang einer Freundschaft.',
    tier: 'bronze',
    category: 'community',
    threshold: 1,
  },
  {
    id: 'collector_5',
    emoji: '🌟',
    label: 'Sammler',
    description: '5 Aufgießern gefolgt — dein Lieblings-Team wird größer.',
    tier: 'bronze',
    category: 'community',
    threshold: 5,
  },
  {
    id: 'collector_15',
    emoji: '🌟',
    label: 'Großer Sammler',
    description: '15 Aufgießern gefolgt — du hast einen feinen Geschmack.',
    tier: 'silver',
    category: 'community',
    threshold: 15,
  },
  {
    id: 'collector_30',
    emoji: '💖',
    label: 'Mega-Fan',
    description: '30 Aufgießern gefolgt — du liebst sie wirklich alle.',
    tier: 'gold',
    category: 'community',
    threshold: 30,
  },
  {
    id: 'pioneer_gast',
    emoji: '🎖️',
    label: 'Pioneer-Gast',
    description: 'Unter den ersten 10 registrierten Gästen — du warst von Anfang an dabei.',
    tier: 'special',
    category: 'community',
  },

  // Saison + Besondere
  {
    id: 'birthday_visitor',
    emoji: '🎂',
    label: 'Geburtstags-Gast',
    description: 'An deinem Geburtstag in der Sauna gewesen — beste Art zu feiern.',
    tier: 'special',
    category: 'season',
  },
  {
    id: 'winter_guest',
    emoji: '❄️',
    label: 'Wintergast',
    description: '10× im Winter (Dez–Feb) in der Sauna — du hasst die Kälte.',
    tier: 'silver',
    category: 'season',
    threshold: 10,
  },
  {
    id: 'summer_guest',
    emoji: '☀️',
    label: 'Sommergast',
    description: '10× im Sommer (Jun–Aug) in der Sauna — Hitze ist Hitze.',
    tier: 'silver',
    category: 'season',
    threshold: 10,
  },
  {
    id: 'eagle_eye',
    emoji: '🦅',
    label: 'Adlerauge',
    description: '10 Aufgüsse noch am selben Tag bewertet — du vergisst nichts.',
    tier: 'gold',
    category: 'season',
    threshold: 10,
  },
];

// ─── Unterstützer-Badges (Migration 0049) ────────────────────────────────
// Helfer-Einsätze: Aufgaben-Anmeldungen → Badges automatisch via DB-Trigger.

export const SUPPORT_BADGES: BadgeDefinition[] = [
  // Volunteer (Anzahl Einsätze gesamt)
  { id: 'volunteer_first', emoji: '🤝', label: 'Erste Hilfe',
    description: 'Erste Helfer-Anmeldung — willkommen im Unterstützer-Kreis!',
    tier: 'bronze', category: 'support', threshold: 1 },
  { id: 'volunteer_5', emoji: '🤝', label: 'Helfer',
    description: '5 Helfer-Einsätze — du bist verlässlich.',
    tier: 'bronze', category: 'support', threshold: 5 },
  { id: 'volunteer_25', emoji: '🛠️', label: 'Aktivposten',
    description: '25 Helfer-Einsätze — ohne dich läuft hier nichts.',
    tier: 'silver', category: 'support', threshold: 25 },
  { id: 'volunteer_50', emoji: '🏅', label: 'Vereins-Stütze',
    description: '50 Helfer-Einsätze — eine tragende Säule.',
    tier: 'gold', category: 'support', threshold: 50 },
  { id: 'volunteer_100', emoji: '💎', label: 'Säulen-Heilige',
    description: '100 Helfer-Einsätze — Legenden-Status für Helfer.',
    tier: 'platinum', category: 'support', threshold: 100 },

  // Event-Helfer
  { id: 'event_helper_first', emoji: '🎪', label: 'Event-Premiere',
    description: 'Bei einem Vereins-Event mitgemacht.',
    tier: 'bronze', category: 'support', threshold: 1 },
  { id: 'event_helper_5', emoji: '🎭', label: 'Event-Profi',
    description: '5 Events mitgestaltet — du machst Stimmung.',
    tier: 'silver', category: 'support', threshold: 5 },
  { id: 'event_helper_10', emoji: '🏆', label: 'Event-Held',
    description: '10 Events mitorganisiert — Mister/Mrs. Saunafest!',
    tier: 'gold', category: 'support', threshold: 10 },

  // Pflege-Held
  { id: 'care_hero_first', emoji: '🌱', label: 'Erste Pflege',
    description: 'Erste Pflege-Aufgabe übernommen.',
    tier: 'bronze', category: 'support', threshold: 1 },
  { id: 'care_hero_5', emoji: '🌿', label: 'Pflege-Held',
    description: '5 Pflege-Einsätze — du hältst alles am Laufen.',
    tier: 'silver', category: 'support', threshold: 5 },
  { id: 'care_hero_15', emoji: '🌳', label: 'Pflege-Meister',
    description: '15 Pflege-Einsätze — der Verein dankt!',
    tier: 'gold', category: 'support', threshold: 15 },

  // Erste-Stunde
  { id: 'early_bird_helper_3', emoji: '⚡', label: 'Schnell-Helfer',
    description: '3× innerhalb 1 Stunde nach Veröffentlichung angemeldet.',
    tier: 'silver', category: 'support', threshold: 3 },
  { id: 'early_bird_helper_10', emoji: '🌅', label: 'Sofort-Reagierer',
    description: '10× innerhalb 1 Stunde nach Veröffentlichung angemeldet — du bist immer da.',
    tier: 'gold', category: 'support', threshold: 10 },
];

// Mini-Game-Hub /spiele (Migrationen 0073+0074)
export const GAME_BADGES: BadgeDefinition[] = [
  { id: 'games_first_win', emoji: '🥇', label: 'Erster Sieg',
    description: 'Dein erster Sieg gegen einen anderen Mitspieler.',
    tier: 'bronze', category: 'games' },
  { id: 'tetris_king', emoji: '🧱', label: 'Tetris-König',
    description: 'Tetris-Highscore von mindestens 10 000 erreicht.',
    tier: 'gold', category: 'games', threshold: 10000 },
  { id: 'tetris_legend', emoji: '👑', label: 'Tetris-Legende',
    description: 'Tetris-Highscore von mindestens 50 000 — beeindruckend.',
    tier: 'platinum', category: 'games', threshold: 50000 },
  { id: 'chess_master', emoji: '♟️', label: 'Schach-Meister',
    description: '10 Schach-Siege — kühlster Kopf am Brett.',
    tier: 'silver', category: 'games', threshold: 10 },
  { id: 'chess_grandmaster', emoji: '♛', label: 'Schach-Großmeister',
    description: '50 Schach-Siege — Verein zittert vor dir.',
    tier: 'gold', category: 'games', threshold: 50 },
  { id: 'g2048_solver', emoji: '2️⃣', label: '2048-Knacker',
    description: 'Die 2048-Kachel im Spiel 2048 erreicht.',
    tier: 'silver', category: 'games' },
];

export const ALL_BADGES: BadgeDefinition[] = [...MILESTONE_BADGES, ...SPECIAL_BADGES, ...GAST_BADGES, ...SUPPORT_BADGES, ...GAME_BADGES];

// Labels für Galerie-Gruppen
export const CATEGORY_LABEL: Record<BadgeCategory, { emoji: string; label: string }> = {
  infusion:   { emoji: '🧖', label: 'Aufgießer' },
  team:       { emoji: '👥', label: 'Team' },
  attendance: { emoji: '🔥', label: 'Anwesenheit' },
  rating:     { emoji: '⭐', label: 'Bewertungen' },
  discovery:  { emoji: '🔍', label: 'Entdeckung' },
  community:  { emoji: '❤️', label: 'Community' },
  season:     { emoji: '🌟', label: 'Saison' },
  support:    { emoji: '🤝', label: 'Helfer' },
  games:      { emoji: '🎮', label: 'Spiele' },
  special:    { emoji: '🏅', label: 'Spezial' },
};

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
