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
};

export const EFFECT_IDS = Object.keys(EFFECT_REGISTRY);
