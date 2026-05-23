import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

// Registry aller One-Shot-Effekte. Wird vom EffectPlayer.tsx + AdminUI gelesen.
// durationMs: nach dieser Zeit unmounted EffectPlayer die Komponente.

export type EffectMeta = {
  id: string;
  label: string;
  emoji: string;
  durationMs: number;
  component: LazyExoticComponent<ComponentType>;
};

export const EFFECT_REGISTRY: Record<string, EffectMeta> = {
  'fireworks': {
    id: 'fireworks', label: 'Feuerwerk', emoji: '🎆',
    durationMs: 15_000,
    component: lazy(() => import('./FireworksEffect')),
  },
  'monster-scare': {
    id: 'monster-scare', label: 'Monster-Schreck', emoji: '👹',
    durationMs: 5_000,
    component: lazy(() => import('./MonsterScareEffect')),
  },
  'confetti': {
    id: 'confetti', label: 'Konfetti', emoji: '🎊',
    durationMs: 10_000,
    component: lazy(() => import('./ConfettiEffect')),
  },
  'balloons': {
    id: 'balloons', label: 'Luftballons', emoji: '🎈',
    durationMs: 10_000,
    component: lazy(() => import('./BalloonsEffect')),
  },
  'lightning': {
    id: 'lightning', label: 'Blitz', emoji: '⚡',
    durationMs: 2_500,
    component: lazy(() => import('./LightningEffect')),
  },
  'rocket': {
    id: 'rocket', label: 'Rakete', emoji: '🚀',
    durationMs: 6_000,
    component: lazy(() => import('./RocketEffect')),
  },
  'birthday': {
    id: 'birthday', label: 'Geburtstag', emoji: '🎂',
    durationMs: 8_000,
    component: lazy(() => import('./BirthdayEffect')),
  },
  'shooting-star': {
    id: 'shooting-star', label: 'Sternschnuppe', emoji: '🌠',
    durationMs: 3_000,
    component: lazy(() => import('./ShootingStarEffect')),
  },
  'bat-swarm': {
    id: 'bat-swarm', label: 'Fledermaus-Schwarm', emoji: '🦇',
    durationMs: 8_000,
    component: lazy(() => import('./BatSwarmEffect')),
  },
  'ufo': {
    id: 'ufo', label: 'UFO', emoji: '🛸',
    durationMs: 8_000,
    component: lazy(() => import('./UfoEffect')),
  },
  // ── Neue epische Effekte ──
  'tornado': {
    id: 'tornado', label: 'Tornado', emoji: '🌪️',
    durationMs: 8_000,
    component: lazy(() => import('./TornadoEffect')),
  },
  'rainbow': {
    id: 'rainbow', label: 'Regenbogen', emoji: '🌈',
    durationMs: 10_000,
    component: lazy(() => import('./RainbowEffect')),
  },
  'snowstorm': {
    id: 'snowstorm', label: 'Schneesturm', emoji: '❄️',
    durationMs: 7_000,
    component: lazy(() => import('./SnowstormEffect')),
  },
  'explosion': {
    id: 'explosion', label: 'Explosion', emoji: '💥',
    durationMs: 5_000,
    component: lazy(() => import('./ExplosionEffect')),
  },
  'unicorn': {
    id: 'unicorn', label: 'Einhorn', emoji: '🦄',
    durationMs: 9_000,
    component: lazy(() => import('./UnicornEffect')),
  },
  'music-notes': {
    id: 'music-notes', label: 'Musik-Noten', emoji: '🎵',
    durationMs: 9_000,
    component: lazy(() => import('./MusicNotesEffect')),
  },
  // ── Mai 2026: 11 neue komplexe Effekte (User-Wunsch) ──
  'vfb-vs-bayern': {
    id: 'vfb-vs-bayern', label: 'VfB jagt FC Bayern', emoji: '🔱',
    durationMs: 20_000,
    component: lazy(() => import('./VfBVsBayernEffect')),
  },
  'dragon-fire': {
    id: 'dragon-fire', label: 'Drachenfeuer', emoji: '🐉',
    durationMs: 10_000,
    component: lazy(() => import('./DragonFireEffect')),
  },
  'alien-invasion': {
    id: 'alien-invasion', label: 'Alien-Invasion', emoji: '👽',
    durationMs: 12_000,
    component: lazy(() => import('./AlienInvasionEffect')),
  },
  'volcano-eruption': {
    id: 'volcano-eruption', label: 'Vulkan-Ausbruch', emoji: '🌋',
    durationMs: 8_000,
    component: lazy(() => import('./VolcanoEruptionEffect')),
  },
  'casino-jackpot': {
    id: 'casino-jackpot', label: 'Casino-Jackpot', emoji: '🎰',
    durationMs: 10_000,
    component: lazy(() => import('./CasinoJackpotEffect')),
  },
  'beer-festival': {
    id: 'beer-festival', label: 'Oktoberfest', emoji: '🍺',
    durationMs: 12_000,
    component: lazy(() => import('./BeerFestivalEffect')),
  },
  'penguin-parade': {
    id: 'penguin-parade', label: 'Pinguin-Parade', emoji: '🐧',
    durationMs: 11_000,
    component: lazy(() => import('./PenguinParadeEffect')),
  },
  'ninja-strike': {
    id: 'ninja-strike', label: 'Ninja-Angriff', emoji: '🥷',
    durationMs: 7_000,
    component: lazy(() => import('./NinjaStrikeEffect')),
  },
  'disco-ball': {
    id: 'disco-ball', label: 'Disco-Kugel', emoji: '🪩',
    durationMs: 12_000,
    component: lazy(() => import('./DiscoBallEffect')),
  },
  'meteor-shower': {
    id: 'meteor-shower', label: 'Meteor-Schauer', emoji: '☄️',
    durationMs: 9_000,
    component: lazy(() => import('./MeteorShowerEffect')),
  },
  'pirate-ship': {
    id: 'pirate-ship', label: 'Piratenschiff', emoji: '🏴‍☠️',
    durationMs: 12_000,
    component: lazy(() => import('./PirateShipEffect')),
  },
  'heart-swarm': {
    id: 'heart-swarm', label: 'Herz-Schwarm', emoji: '💖',
    durationMs: 8_000,
    component: lazy(() => import('./HeartSwarmEffect')),
  },
  'bubble-trouble': {
    id: 'bubble-trouble', label: 'Seifenblasen', emoji: '🫧',
    durationMs: 10_000,
    component: lazy(() => import('./BubbleTroubleEffect')),
  },
  'magic-spell': {
    id: 'magic-spell', label: 'Magischer Zauber', emoji: '🧙',
    durationMs: 10_000,
    component: lazy(() => import('./MagicSpellEffect')),
  },
};

export const EFFECT_IDS = Object.keys(EFFECT_REGISTRY);
