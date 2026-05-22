export type InfusionAttribute =
  // ─── Aufguss-Stil ──────────────────────────────────────────────────────
  | 'flame'           // extra heiß
  | 'sud'             // intensiver Sud
  | 'nature'          // Natur / Kräuter
  | 'menthol'         // Menthol-Kristalle
  | 'raeuchern'       // Räuchern
  | 'kaffee'          // Kaffee-Aufguss
  | 'kirschwasser'    // Kirschwasser
  | 'haferpflaume'    // Haferpflaume
  | 'banja'           // russische Banja
  | 'wenik'           // Wenikaufguss (Birkenzweig)
  | 'vulkan'          // Vulkanaufguss
  // ─── Sud-Zutaten ───────────────────────────────────────────────────────
  | 'kraeuter_sud'    // Kräuter-Sud
  | 'stein_klee'      // Stein-Klee
  | 'honig_klee'      // Honig-Klee
  | 'berg_minze'      // Berg-Minze
  | 'thymian'         // Thymian
  | 'salzpeeling'     // Salzpeeling-Aufguss
  // ─── Musik-Ambiente ────────────────────────────────────────────────────
  | 'music'           // Musik (allgemein)
  | 'loud_music'      // sehr laute Musik
  | 'no_music'        // ruhig, keine Musik
  | 'rock'            // Rock
  | 'deutsch_rock'    // Deutsch-Rock
  | 'boese_onkels'    // Böhse Onkelz
  | 'party_schlager'  // Party-Schlager
  | 'malle_schlager'  // Malle-Schlager
  | 'klassik_musik'   // Klassik-Musik
  | 'kontrovers';     // Kontrovers (Inhaltswarnung)

export const ATTRIBUTES: { id: InfusionAttribute; emoji: string; label: string }[] = [
  // Aufguss-Stil
  { id: 'flame',          emoji: '🔥', label: 'Extra heiß' },
  { id: 'sud',            emoji: '💧', label: 'Intensiver Sud' },
  { id: 'nature',         emoji: '🌿', label: 'Natur / Kräuter' },
  { id: 'menthol',        emoji: '❄️', label: 'Menthol-Kristalle' },
  { id: 'raeuchern',      emoji: '💨', label: 'Räuchern' },
  { id: 'kaffee',         emoji: '☕', label: 'Kaffee' },
  { id: 'kirschwasser',   emoji: '🍒', label: 'Kirschwasser' },
  { id: 'haferpflaume',   emoji: '🟣', label: 'Haferpflaume' },
  { id: 'banja',          emoji: '🇷🇺', label: 'Banja' },
  { id: 'wenik',          emoji: '🍃', label: 'Wenikaufguss' },
  { id: 'vulkan',         emoji: '🌋', label: 'Vulkanaufguss' },
  // Sud-Zutaten
  { id: 'kraeuter_sud',   emoji: '🧪', label: 'Kräuter-Sud' },
  { id: 'stein_klee',     emoji: '🪨', label: 'Stein-Klee' },
  { id: 'honig_klee',     emoji: '🍯', label: 'Honig-Klee' },
  { id: 'berg_minze',     emoji: '⛰️', label: 'Berg-Minze' },
  { id: 'thymian',        emoji: '🌱', label: 'Thymian' },
  // Musik-Ambiente
  { id: 'music',          emoji: '🎵', label: 'Musik' },
  { id: 'loud_music',     emoji: '🔊', label: 'Sehr laut' },
  { id: 'no_music',       emoji: '🔇', label: 'Ohne Musik' },
  { id: 'rock',           emoji: '🎸', label: 'Rock' },
  { id: 'deutsch_rock',   emoji: '🤘', label: 'Deutsch-Rock' },
  { id: 'boese_onkels',   emoji: '🖤', label: 'Böhse Onkelz' },
  { id: 'party_schlager', emoji: '🎉', label: 'Party-Schlager' },
  { id: 'malle_schlager', emoji: '🏖️', label: 'Malle-Schlager' },
  { id: 'klassik_musik',  emoji: '🎻', label: 'Klassik' },
  { id: 'kontrovers',     emoji: '⚠️', label: 'Kontrovers' },
];

export const ATTR_BY_ID: Record<InfusionAttribute, { emoji: string; label: string }> =
  Object.fromEntries(ATTRIBUTES.map((a) => [a.id, { emoji: a.emoji, label: a.label }])) as never;
