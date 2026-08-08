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
  | 'versucherle'     // es gibt etwas zum Probieren
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
  | 'party_schlager'  // Schlager
  | 'malle_schlager'  // Malle-Schlager (ausgemustert → party_schlager)
  | 'klassik_musik'   // Klassik-Musik
  | 'acoustic'        // Acoustic / Unplugged
  | 'oldies'          // Oldies 60er/70er
  | 'country'         // Country
  | 'acdc'            // AC/DC
  | 'tote_hosen'      // Die Toten Hosen
  | 'entspannt'       // ruhig, entspannt
  | 'kontrovers'      // Kontrovers (Inhaltswarnung)
  // ─── Ritual & Format ──────────────────────────────────────────────────
  | 'silent_strict'   // psssst → sonst raus (strenge Stille-Regel)
  | 'three_x_three'   // 3×3 Runden (3 Runden à 3 Wedeleinheiten)
  | 'nachguss';       // Nachguss — der kurze Guss nach dem Aufguss

// ── Zwei Arten, eine Besonderheit aus dem Weg zu räumen ──
//
// `hidden`  = UMGEZOGEN. Erscheint im Planer und im Bearbeiten-Fenster nicht
//             mehr als Chip, weil es dort einen eigenen Reiter dafür gibt
//             (Kirschwasser/Haferpflaume → Schnaps-Reiter, Räuchern → eigener
//             Reiter). Im Öl-Raum-Kiosk bleibt es wählbar: dort gibt es die
//             Reiter nicht, ein Filter würde die Funktion ersatzlos streichen.
//
// `retired` = AUSGEMUSTERT. Wird NIRGENDS mehr angeboten, bleibt aber in der
//             Liste, damit ATTR_BY_ID Alt-Aufgüsse weiter beschriften kann.
//             Löschen würde bestehende Karten auf nackte IDs zurückwerfen.
//
// Ausgemustert am 08.08.2026 nach Auswertung von 1000 Aufgüssen
// (29.05.–03.10.2026, 393 davon mit Besonderheiten):
//   thymian        0×  — nie benutzt
//   honig_klee     1×
//   berg_minze     2×
//   stein_klee     3×  — die drei Sud-Zutaten deckt „Kräuter-Sud" (9×) ab
//   malle_schlager 2×  — geht in „Schlager" auf (vorher Party-Schlager, 3×)
export const ATTRIBUTES: {
  id: InfusionAttribute; emoji: string; label: string;
  hidden?: true; retired?: true;
}[] = [
  // Aufguss-Stil
  { id: 'flame',          emoji: '🔥', label: 'Extra heiß' },
  { id: 'sud',            emoji: '💧', label: 'Intensiver Sud' },
  { id: 'nature',         emoji: '🌿', label: 'Natur / Kräuter' },
  { id: 'menthol',        emoji: '❄️', label: 'Menthol-Kristalle' },
  { id: 'raeuchern',      emoji: '💨', label: 'Räuchern', hidden: true },
  { id: 'kaffee',         emoji: '☕', label: 'Kaffee' },
  { id: 'kirschwasser',   emoji: '🍒', label: 'Kirschwasser', hidden: true },
  { id: 'haferpflaume',   emoji: '🟣', label: 'Haferpflaume', hidden: true },
  { id: 'banja',          emoji: '🇷🇺', label: 'Banja' },
  { id: 'wenik',          emoji: '🍃', label: 'Wenikaufguss' },
  { id: 'vulkan',         emoji: '🌋', label: 'Vulkanaufguss' },
  { id: 'versucherle',    emoji: '🥃', label: 'Versucherle' },
  // Sud-Zutaten
  { id: 'kraeuter_sud',   emoji: '🧪', label: 'Kräuter-Sud' },
  { id: 'stein_klee',     emoji: '🪨', label: 'Stein-Klee',  retired: true },
  { id: 'honig_klee',     emoji: '🍯', label: 'Honig-Klee',  retired: true },
  { id: 'berg_minze',     emoji: '⛰️', label: 'Berg-Minze',  retired: true },
  { id: 'thymian',        emoji: '🌱', label: 'Thymian',     retired: true },
  { id: 'salzpeeling',    emoji: '🧂', label: 'Salzpeeling' },
  // Musik-Ambiente
  { id: 'music',          emoji: '🎵', label: 'Musik' },
  { id: 'loud_music',     emoji: '🔊', label: 'Sehr laut' },
  { id: 'no_music',       emoji: '🔇', label: 'Ohne Musik' },
  { id: 'rock',           emoji: '🎸', label: 'Rock' },
  { id: 'deutsch_rock',   emoji: '🤘', label: 'Deutsch-Rock' },
  { id: 'boese_onkels',   emoji: '🖤', label: 'Böhse Onkelz' },
  { id: 'party_schlager', emoji: '🎉', label: 'Schlager' },
  { id: 'malle_schlager', emoji: '🏖️', label: 'Malle-Schlager', retired: true },
  { id: 'klassik_musik',  emoji: '🎻', label: 'Klassik' },
  // Neu am 08.08.2026. Nicht geraten: genau diese drei hatten sich Aufgießer
  // als EIGENE Buttons gebaut, weil sie in der gemeinsamen Liste fehlten —
  // Acoustic (2×), 60's/60-70s (2×), Country (1×).
  { id: 'acoustic',       emoji: '🪕', label: 'Acoustic' },
  { id: 'oldies',         emoji: '📻', label: 'Oldies 60/70er' },
  { id: 'country',        emoji: '🤠', label: 'Country' },
  { id: 'acdc',           emoji: '⚡', label: 'AC/DC' },
  { id: 'tote_hosen',     emoji: '🎤', label: 'Tote Hosen' },
  { id: 'entspannt',      emoji: '😌', label: 'Entspannt' },
  { id: 'kontrovers',     emoji: '⚠️', label: 'Kontrovers' },
  // Ritual & Format
  { id: 'silent_strict',  emoji: '🤫', label: 'Psssst → sonst raus' },
  { id: 'three_x_three',  emoji: '3️⃣', label: '3×3 Runden' },
  // Ebenfalls aus den selbstgebauten Buttons übernommen („Nachguss" und
  // „Nachtguss", zweimal am selben Tag angelegt).
  { id: 'nachguss',       emoji: '🔁', label: 'Nachguss' },
];

/** Was im Formular angeboten wird: alles außer ausgemustert.
 *  Der Planer blendet zusätzlich `hidden` aus (dort gibt es Reiter dafür) —
 *  der Öl-Raum-Kiosk nicht, weil er die Reiter nicht hat. */
export const ATTRIBUTES_WAEHLBAR = ATTRIBUTES.filter((a) => !a.retired);

export const ATTR_BY_ID: Record<InfusionAttribute, { emoji: string; label: string }> =
  Object.fromEntries(ATTRIBUTES.map((a) => [a.id, { emoji: a.emoji, label: a.label }])) as never;
