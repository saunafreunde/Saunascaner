import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

// Registry aller One-Shot-Effekte. Wird vom EffectPlayer.tsx + AdminUI gelesen.
// durationMs: nach dieser Zeit unmounted EffectPlayer die Komponente.
// category: Gruppierung für die Klapp-Sektionen im Admin-Tab (StageAdminTab).

export type EffectCategory = 'feier' | 'episch' | 'fantasy' | 'natur' | 'saison';

// Reihenfolge = Reihenfolge der Klapp-Gruppen im Admin-UI.
export const EFFECT_CATEGORIES: { id: EffectCategory; label: string; emoji: string }[] = [
  { id: 'feier',   label: 'Feier & Party',        emoji: '🎉' },
  { id: 'episch',  label: 'Episch & Action',      emoji: '💥' },
  { id: 'fantasy', label: 'Fantasy & Fun',        emoji: '🦄' },
  { id: 'natur',   label: 'Natur & Himmel',       emoji: '🌈' },
  { id: 'saison',  label: 'Saisonal & Sonstiges', emoji: '🎃' },
];

export type EffectMeta = {
  id: string;
  label: string;
  emoji: string;
  durationMs: number;
  category: EffectCategory;
  component: LazyExoticComponent<ComponentType>;
};

export const EFFECT_REGISTRY: Record<string, EffectMeta> = {
  // ── Feier & Party ──
  'fireworks':        { id: 'fireworks',        label: 'Feuerwerk',          emoji: '🎆',   durationMs: 15_000, category: 'feier',   component: lazy(() => import('./FireworksEffect')) },
  'confetti':         { id: 'confetti',         label: 'Konfetti',           emoji: '🎊',   durationMs: 10_000, category: 'feier',   component: lazy(() => import('./ConfettiEffect')) },
  'balloons':         { id: 'balloons',         label: 'Luftballons',        emoji: '🎈',   durationMs: 10_000, category: 'feier',   component: lazy(() => import('./BalloonsEffect')) },
  'birthday':         { id: 'birthday',         label: 'Geburtstag',         emoji: '🎂',   durationMs: 8_000,  category: 'feier',   component: lazy(() => import('./BirthdayEffect')) },
  'music-notes':      { id: 'music-notes',      label: 'Musik-Noten',        emoji: '🎵',   durationMs: 9_000,  category: 'feier',   component: lazy(() => import('./MusicNotesEffect')) },
  'casino-jackpot':   { id: 'casino-jackpot',   label: 'Casino-Jackpot',     emoji: '🎰',   durationMs: 10_000, category: 'feier',   component: lazy(() => import('./CasinoJackpotEffect')) },
  'disco-ball':       { id: 'disco-ball',       label: 'Disco-Kugel',        emoji: '🪩',   durationMs: 12_000, category: 'feier',   component: lazy(() => import('./DiscoBallEffect')) },
  'beer-festival':    { id: 'beer-festival',    label: 'Oktoberfest',        emoji: '🍺',   durationMs: 12_000, category: 'feier',   component: lazy(() => import('./BeerFestivalEffect')) },

  // ── Episch & Action ──
  'explosion':        { id: 'explosion',        label: 'Explosion',          emoji: '💥',   durationMs: 5_000,  category: 'episch',  component: lazy(() => import('./ExplosionEffect')) },
  'dragon-fire':      { id: 'dragon-fire',      label: 'Drachenfeuer',       emoji: '🐉',   durationMs: 10_000, category: 'episch',  component: lazy(() => import('./DragonFireEffect')) },
  'volcano-eruption': { id: 'volcano-eruption', label: 'Vulkan-Ausbruch',    emoji: '🌋',   durationMs: 8_000,  category: 'episch',  component: lazy(() => import('./VolcanoEruptionEffect')) },
  'ninja-strike':     { id: 'ninja-strike',     label: 'Ninja-Angriff',      emoji: '🥷',   durationMs: 7_000,  category: 'episch',  component: lazy(() => import('./NinjaStrikeEffect')) },
  'pirate-ship':      { id: 'pirate-ship',      label: 'Piratenschiff',      emoji: '🏴‍☠️', durationMs: 12_000, category: 'episch',  component: lazy(() => import('./PirateShipEffect')) },
  'tornado':          { id: 'tornado',          label: 'Tornado',            emoji: '🌪️',  durationMs: 8_000,  category: 'episch',  component: lazy(() => import('./TornadoEffect')) },
  'meteor-shower':    { id: 'meteor-shower',    label: 'Meteor-Schauer',     emoji: '☄️',   durationMs: 9_000,  category: 'episch',  component: lazy(() => import('./MeteorShowerEffect')) },

  // ── Fantasy & Fun ──
  'unicorn':          { id: 'unicorn',          label: 'Einhorn',            emoji: '🦄',   durationMs: 9_000,  category: 'fantasy', component: lazy(() => import('./UnicornEffect')) },
  'magic-spell':      { id: 'magic-spell',      label: 'Magischer Zauber',   emoji: '🧙',   durationMs: 10_000, category: 'fantasy', component: lazy(() => import('./MagicSpellEffect')) },
  'ufo':              { id: 'ufo',              label: 'UFO',                emoji: '🛸',   durationMs: 8_000,  category: 'fantasy', component: lazy(() => import('./UfoEffect')) },
  'alien-invasion':   { id: 'alien-invasion',   label: 'Alien-Invasion',     emoji: '👽',   durationMs: 12_000, category: 'fantasy', component: lazy(() => import('./AlienInvasionEffect')) },
  'penguin-parade':   { id: 'penguin-parade',   label: 'Pinguin-Parade',     emoji: '🐧',   durationMs: 11_000, category: 'fantasy', component: lazy(() => import('./PenguinParadeEffect')) },
  'bubble-trouble':   { id: 'bubble-trouble',   label: 'Seifenblasen',       emoji: '🫧',   durationMs: 10_000, category: 'fantasy', component: lazy(() => import('./BubbleTroubleEffect')) },
  'rocket':           { id: 'rocket',           label: 'Rakete',             emoji: '🚀',   durationMs: 6_000,  category: 'fantasy', component: lazy(() => import('./RocketEffect')) },

  // ── Natur & Himmel ──
  'lightning':        { id: 'lightning',        label: 'Blitz',              emoji: '⚡',   durationMs: 2_500,  category: 'natur',   component: lazy(() => import('./LightningEffect')) },
  'rainbow':          { id: 'rainbow',          label: 'Regenbogen',         emoji: '🌈',   durationMs: 10_000, category: 'natur',   component: lazy(() => import('./RainbowEffect')) },
  'snowstorm':        { id: 'snowstorm',        label: 'Schneesturm',        emoji: '❄️',   durationMs: 7_000,  category: 'natur',   component: lazy(() => import('./SnowstormEffect')) },
  'shooting-star':    { id: 'shooting-star',    label: 'Sternschnuppe',      emoji: '🌠',   durationMs: 3_000,  category: 'natur',   component: lazy(() => import('./ShootingStarEffect')) },

  // ── Saisonal & Sonstiges ──
  'monster-scare':    { id: 'monster-scare',    label: 'Monster-Schreck',    emoji: '👹',   durationMs: 5_000,  category: 'saison',  component: lazy(() => import('./MonsterScareEffect')) },
  'bat-swarm':        { id: 'bat-swarm',        label: 'Fledermaus-Schwarm', emoji: '🦇',   durationMs: 8_000,  category: 'saison',  component: lazy(() => import('./BatSwarmEffect')) },
  'vfb-vs-bayern':    { id: 'vfb-vs-bayern',    label: 'VfB jagt FC Bayern', emoji: '🔱',   durationMs: 20_000, category: 'saison',  component: lazy(() => import('./VfBVsBayernEffect')) },
  'heart-swarm':      { id: 'heart-swarm',      label: 'Herz-Schwarm',       emoji: '💖',   durationMs: 8_000,  category: 'saison',  component: lazy(() => import('./HeartSwarmEffect')) },
};

export const EFFECT_IDS = Object.keys(EFFECT_REGISTRY);
