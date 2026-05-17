import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

// Registry aller Szenarien-Layer. Lazy-loaded → nicht-aktive Scenes haben
// 0 Bundle-Cost auf der Tafel. Reihenfolge hier = Reihenfolge im Admin-UI.

export type SceneMeta = {
  id: string;
  label: string;
  emoji: string;
  // Kurze Saison-Bezeichnung für den Admin-Hint (z.B. "auto im Winter")
  defaultSeason: string | null;
  component: LazyExoticComponent<ComponentType>;
};

export const SCENE_REGISTRY: Record<string, SceneMeta> = {
  // ── Winter / Weihnachten ──
  'snow':        { id: 'snow',        label: 'Schnee',             emoji: '❄️',  defaultSeason: 'Winter / Weihnachten', component: lazy(() => import('./SnowScene')) },
  'xmas-lights': { id: 'xmas-lights', label: 'Weihnachts-Lichter', emoji: '💡',  defaultSeason: 'Weihnachten',          component: lazy(() => import('./XmasLightsScene')) },
  'xmas-gifts':  { id: 'xmas-gifts',  label: 'Geschenke',          emoji: '🎁',  defaultSeason: 'Weihnachten',          component: lazy(() => import('./XmasGiftsScene')) },
  'xmas-tree':   { id: 'xmas-tree',   label: 'Tannenbaum',         emoji: '🎄',  defaultSeason: 'Weihnachten',          component: lazy(() => import('./XmasTreeScene')) },
  'sparkles':    { id: 'sparkles',    label: 'Funken',             emoji: '✨',  defaultSeason: 'Silvester / Fasching', component: lazy(() => import('./SparklesScene')) },

  // ── Halloween ──
  'pumpkins':    { id: 'pumpkins',    label: 'Kürbisse',           emoji: '🎃',  defaultSeason: 'Halloween',            component: lazy(() => import('./PumpkinsScene')) },
  'ghosts':      { id: 'ghosts',      label: 'Geister',            emoji: '👻',  defaultSeason: 'Halloween',            component: lazy(() => import('./GhostsScene')) },
  'bats':        { id: 'bats',        label: 'Fledermäuse',        emoji: '🦇',  defaultSeason: 'Halloween',            component: lazy(() => import('./BatsScene')) },
  'spiders':     { id: 'spiders',     label: 'Spinnen',            emoji: '🕷️', defaultSeason: 'Halloween',            component: lazy(() => import('./SpidersScene')) },

  // ── Ostern / Frühling ──
  'easter-eggs': { id: 'easter-eggs', label: 'Ostereier',          emoji: '🥚',  defaultSeason: 'Ostern',               component: lazy(() => import('./EasterEggsScene')) },
  'easter-bunny':{ id: 'easter-bunny',label: 'Osterhase',          emoji: '🐰',  defaultSeason: 'Ostern',               component: lazy(() => import('./EasterBunnyScene')) },
  'blossoms':    { id: 'blossoms',    label: 'Kirschblüten',       emoji: '🌸',  defaultSeason: 'Frühling',             component: lazy(() => import('./BlossomsScene')) },
  'butterflies': { id: 'butterflies', label: 'Schmetterlinge',     emoji: '🦋',  defaultSeason: 'Frühling',             component: lazy(() => import('./ButterfliesScene')) },

  // ── Sommer ──
  'parasols':    { id: 'parasols',    label: 'Sonnenschirme',      emoji: '⛱️',  defaultSeason: 'Sommer',               component: lazy(() => import('./ParasolsScene')) },
  'dragonflies': { id: 'dragonflies', label: 'Libellen',           emoji: '🦗',  defaultSeason: 'Sommer',               component: lazy(() => import('./DragonfliesScene')) },

  // ── Herbst / Atmosphäre ──
  'autumn-leaves':{ id: 'autumn-leaves', label: 'Herbstblätter',   emoji: '🍂',  defaultSeason: 'Herbst',               component: lazy(() => import('./AutumnLeavesScene')) },
  'rain':        { id: 'rain',        label: 'Regen',              emoji: '🌧️', defaultSeason: null,                   component: lazy(() => import('./RainScene')) },
  'fog':         { id: 'fog',         label: 'Nebel',              emoji: '🌫️', defaultSeason: null,                   component: lazy(() => import('./FogScene')) },
  'night':       { id: 'night',       label: 'Nacht-Modus',        emoji: '🌙',  defaultSeason: null,                   component: lazy(() => import('./NightScene')) },

  // ── Toggle-Wrapper für bestehende Schwarzwald-Komponenten ──
  // Default off; im Theme „Wald lebt" zusammen aktiviert.
  'schwarzwald-heim': { id: 'schwarzwald-heim', label: 'Schwarzwald-Heim', emoji: '🏡', defaultSeason: null, component: lazy(() => import('./SchwarzwaldHomeScene')) },
  'holzfaeller': { id: 'holzfaeller', label: 'Holzfäller',         emoji: '🪓',  defaultSeason: null,                   component: lazy(() => import('./HolzfaellerScene')) },
  'reh':         { id: 'reh',         label: 'Reh-Familie',        emoji: '🦌',  defaultSeason: null,                   component: lazy(() => import('./RehScene')) },
  'playground':  { id: 'playground',  label: 'Spielplatz',         emoji: '🛝',  defaultSeason: null,                   component: lazy(() => import('./PlaygroundScene')) },
};

export const SCENE_IDS = Object.keys(SCENE_REGISTRY);
