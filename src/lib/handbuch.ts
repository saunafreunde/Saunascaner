import type { Member } from '@/lib/api';

// Rollen-Handbücher (16.08.2026).
//
// Vorher gab es EIN Handbuch mit 33 Kapiteln für alle — ein Gast las darin die
// Admin-Tabs, die Planner-Regeln und den Aufbau der TV-Tafel mit. Jetzt bekommt
// jede Rolle ihre eigene Fassung.
//
// Aufbau bewusst so: jedes Kapitel existiert GENAU EINMAL als Datei, und die
// Rolle bestimmt nur, welche Kapitel in welcher Reihenfolge zusammengesetzt
// werden. Sechs Vollkopien wären der sichere Weg in dieselbe Divergenz, die
// docs/MITGLIEDER-HANDBUCH.md und src/content/handbook.md schon hatten —
// zeilenverschoben auseinandergelaufen, weil niemand beide pflegt.

import anmelden from '@/content/handbuch/anmelden.md?raw';
import benachrichtigungen from '@/content/handbuch/benachrichtigungen.md?raw';
import bereichsFooter from '@/content/handbuch/bereichs-footer.md?raw';
import bewerten from '@/content/handbuch/bewerten.md?raw';
import familie from '@/content/handbuch/familie.md?raw';
import fanEinesAufgiessers from '@/content/handbuch/fan-eines-aufgiessers.md?raw';
import faq from '@/content/handbuch/faq.md?raw';
import faqAufgiesser from '@/content/handbuch/faq-aufgiesser.md?raw';
import feed from '@/content/handbuch/feed.md?raw';
import galerieUndProfile from '@/content/handbuch/galerie-und-profile.md?raw';
import kalenderAbo from '@/content/handbuch/kalender-abo.md?raw';
import kontakt from '@/content/handbuch/kontakt.md?raw';
import mitgliedsArten from '@/content/handbuch/mitglieds-arten.md?raw';
import nachrichten from '@/content/handbuch/nachrichten.md?raw';
import notfall from '@/content/handbuch/notfall.md?raw';
import pinUndEinlass from '@/content/handbuch/pin-und-einlass.md?raw';
import postfach from '@/content/handbuch/postfach.md?raw';
import profilUndErfolge from '@/content/handbuch/profil-und-erfolge.md?raw';
import push from '@/content/handbuch/push.md?raw';
import pwa from '@/content/handbuch/pwa.md?raw';
import rolleAdmin from '@/content/handbuch/rolle-admin.md?raw';
import rolleAufgiesser from '@/content/handbuch/rolle-aufgiesser.md?raw';
import rolleCp from '@/content/handbuch/rolle-cp.md?raw';
import rolleGast from '@/content/handbuch/rolle-gast.md?raw';
import rolleHelfer from '@/content/handbuch/rolle-helfer.md?raw';
import rollePersonal from '@/content/handbuch/rolle-personal.md?raw';
import seitenUndZugaenge from '@/content/handbuch/seiten-und-zugaenge.md?raw';
import spiele from '@/content/handbuch/spiele.md?raw';
import tabletWorkflows from '@/content/handbuch/tablet-workflows.md?raw';
import telegram from '@/content/handbuch/telegram.md?raw';
import tvTafel from '@/content/handbuch/tv-tafel.md?raw';
import vereinsPostfach from '@/content/handbuch/vereins-postfach.md?raw';
import willkommen from '@/content/handbuch/willkommen.md?raw';

const KAPITEL = {
  anmelden, benachrichtigungen, bereichsFooter, bewerten, familie,
  fanEinesAufgiessers, faq, faqAufgiesser, feed, galerieUndProfile, kalenderAbo, kontakt,
  mitgliedsArten, nachrichten, notfall, pinUndEinlass, postfach,
  profilUndErfolge, push, pwa, rolleAdmin, rolleAufgiesser, rolleCp, rolleGast,
  rolleHelfer, rollePersonal, seitenUndZugaenge, spiele, tabletWorkflows,
  telegram, tvTafel, vereinsPostfach, willkommen,
} as const;

type KapitelId = keyof typeof KAPITEL;

export type HandbuchRolle = 'gast' | 'helfer' | 'aufgieser' | 'personal' | 'cp' | 'admin';

// Bausteine, die fast jede Rolle braucht — einmal benannt statt sechsmal getippt.
const GRUNDLAGEN: KapitelId[] = ['willkommen', 'anmelden'];
const MITMACHEN: KapitelId[] = ['feed', 'spiele', 'nachrichten', 'benachrichtigungen'];
const ABSCHLUSS: KapitelId[] = ['pwa', 'push', 'notfall', 'bereichsFooter', 'faq', 'kontakt'];

const KAPITEL_JE_ROLLE: Record<HandbuchRolle, KapitelId[]> = {
  // Gäste bekommen bewusst die schmalste Fassung: kein Planner, keine
  // Mitglieder-Galerie, kein Postfach, keine TV-Tafel, kein Admin-Kram —
  // alles Dinge, die sie ohnehin nicht erreichen (siehe GAST_BLOCKED_PATHS
  // in App.tsx). Ein Handbuch, das Türen zeigt, die verschlossen sind,
  // frustriert nur.
  gast: [
    ...GRUNDLAGEN,
    'rolleGast', 'pinUndEinlass', 'bewerten', 'fanEinesAufgiessers',
    ...MITMACHEN,
    'profilUndErfolge',
    ...ABSCHLUSS,
  ],
  helfer: [
    ...GRUNDLAGEN, 'mitgliedsArten', 'seitenUndZugaenge',
    'rolleHelfer', 'pinUndEinlass', 'bewerten', 'tabletWorkflows',
    ...MITMACHEN,
    'galerieUndProfile', 'profilUndErfolge', 'familie',
    'tvTafel', 'telegram', 'postfach',
    ...ABSCHLUSS,
  ],
  aufgieser: [
    ...GRUNDLAGEN, 'mitgliedsArten', 'seitenUndZugaenge',
    'rolleAufgiesser', 'pinUndEinlass', 'bewerten', 'tabletWorkflows',
    'fanEinesAufgiessers',
    ...MITMACHEN,
    'galerieUndProfile', 'profilUndErfolge', 'familie',
    'tvTafel', 'telegram', 'kalenderAbo', 'postfach',
    'faqAufgiesser',
    ...ABSCHLUSS,
  ],
  personal: [
    ...GRUNDLAGEN, 'mitgliedsArten', 'seitenUndZugaenge',
    'rollePersonal', 'pinUndEinlass', 'tabletWorkflows',
    ...MITMACHEN,
    'galerieUndProfile', 'profilUndErfolge',
    'tvTafel',
    ...ABSCHLUSS,
  ],
  cp: [
    ...GRUNDLAGEN, 'mitgliedsArten', 'seitenUndZugaenge',
    'rolleCp', 'rollePersonal', 'pinUndEinlass', 'tabletWorkflows',
    ...MITMACHEN,
    'galerieUndProfile', 'profilUndErfolge', 'familie',
    'tvTafel', 'telegram',
    ...ABSCHLUSS,
  ],
  // Admin sieht alles — inklusive der Kapitel der anderen Rollen, weil er
  // genau die Fragen beantworten muss, die daraus entstehen.
  admin: [
    ...GRUNDLAGEN, 'mitgliedsArten', 'seitenUndZugaenge',
    'rolleAdmin', 'vereinsPostfach',
    'rolleAufgiesser', 'rolleHelfer', 'rollePersonal', 'rolleCp', 'rolleGast',
    'pinUndEinlass', 'bewerten', 'tabletWorkflows', 'fanEinesAufgiessers',
    ...MITMACHEN,
    'galerieUndProfile', 'profilUndErfolge', 'familie',
    'tvTafel', 'telegram', 'kalenderAbo', 'postfach',
    'faqAufgiesser',
    ...ABSCHLUSS,
  ],
};

const KOPF: Record<HandbuchRolle, { titel: string; lead: string; sprung: string[][] }> = {
  gast: {
    titel: '👋 Handbuch für Gäste',
    lead: 'Alles, was du als Gast der Saunafreunde brauchst — in fünf Minuten gelesen.',
    sprung: [
      ['🏡 Mein Bereich', 'Dein Überblick: was läuft, was du bewerten kannst', '/gast'],
      ['⭐ Bewerten', 'Aufgüsse bewerten, bis zum Folgetag 12 Uhr', '/bewerten'],
      ['🌟 Aufgießer', 'Aufgießer kennenlernen und Fan werden', '/aufgieser'],
      ['📸 Feed', 'Bilder und Beiträge aus dem Verein', '/feed'],
      ['✉️ Nachrichten', 'Deinen Aufgießern schreiben', '/dm'],
      ['🎮 Spiele', '14 Spiele für die Ruhephase', '/spiele'],
    ],
  },
  helfer: {
    titel: '🤝 Handbuch für Helfer',
    lead: 'Dein Handbuch als Aktiv-Mitglied ohne Aufgieß-Dienst.',
    sprung: [
      ['🤝 Helfen', 'Offene Vereins-Aufgaben übernehmen', '/unterstuetzer'],
      ['⭐ Bewerten', 'Offene Aufguss-Bewertungen', '/bewerten'],
      ['👥 Galerie', 'Alle Mitglieder', '/members'],
      ['🌟 Aufgießer', 'Star-Karten der Aufgießer', '/aufgieser'],
      ['📺 Tafel', 'Der Live-Aufgussplan', '/dashboard'],
    ],
  },
  aufgieser: {
    titel: '🧖 Handbuch für Aufgießer',
    lead: 'Planen, gießen, bewerten — und alles drumherum.',
    sprung: [
      ['🧖 Planner', 'Aufgüsse planen, Stamm-Slots, Urlaub', '/planner'],
      ['⭐ Bewerten', 'Offene Aufguss-Bewertungen', '/bewerten'],
      ['🌟 Dein Star-Profil', 'Deine Karte, deine Fans, Duft-Wünsche', '/aufgieser'],
      ['📺 Tafel', 'Der Live-Aufgussplan', '/dashboard'],
      ['👥 Galerie', 'Alle Mitglieder', '/members'],
    ],
  },
  personal: {
    titel: '👨‍🍳 Handbuch für Personal',
    lead: 'Dein Bereich, Anwesenheit, Schichten und der Notfall.',
    sprung: [
      ['👨‍🍳 Mein Bereich', 'Mini-Tafel, „Ich bin da", Wochenplan', '/mitarbeiter'],
      ['📺 Tafel', 'Der Live-Aufgussplan', '/dashboard'],
      ['👥 Galerie', 'Alle Mitglieder', '/members'],
    ],
  },
  cp: {
    titel: '🛠️ Handbuch für CP-Verantwortliche',
    lead: 'Dienstplanung, Verfügbarkeiten und der Personal-Bereich.',
    sprung: [
      ['🛠️ Dienstplan', 'Verfügbarkeiten bestätigen, Schichten setzen', '/cp'],
      ['👨‍🍳 Mitarbeiter-Bereich', 'Mini-Tafel und Anwesenheit', '/mitarbeiter'],
      ['📺 Tafel', 'Der Live-Aufgussplan', '/dashboard'],
    ],
  },
  admin: {
    titel: '⚙️ Handbuch für Admins',
    lead: 'Die vollständige Fassung — alle Rollen, alle Bereiche.',
    sprung: [
      ['⚙️ Admin', 'Alle Verwaltungs-Tabs', '/admin'],
      ['🧖 Planner', 'Aufguss-Planung', '/planner'],
      ['📺 Tafel', 'Der Live-Aufgussplan', '/dashboard'],
      ['📬 Postfach', 'Vereins-Postfach als Ticket-System', '/postfach'],
      ['👥 Galerie', 'Alle Mitglieder', '/members'],
    ],
  },
};

/** Welche Handbuch-Fassung gehört zu diesem Mitglied? */
export function handbuchRolleFuer(m?: Member | null): HandbuchRolle {
  if (!m) return 'gast';
  if (m.role === 'admin') return 'admin';
  if (m.role === 'staff') return m.is_personal_planer ? 'cp' : 'personal';
  // 'fan' wird seit 0132 nicht mehr vergeben, ein Altbestand liest die Gast-Fassung.
  if (m.role === 'gast' || m.role === 'fan') return 'gast';
  if (m.role === 'guest_aufgieser' || m.is_aufgieser) return 'aufgieser';
  return 'helfer';
}

export const ROLLEN_LABEL: Record<HandbuchRolle, string> = {
  gast: 'Gast', helfer: 'Helfer', aufgieser: 'Aufgießer',
  personal: 'Personal', cp: 'CP-Verantwortliche', admin: 'Admin',
};

/** Setzt das Handbuch für eine Rolle zusammen. */
export function handbuchFuer(rolle: HandbuchRolle): string {
  const kopf = KOPF[rolle];
  const tabelle = [
    '| Wohin | Wofür | Direkt |',
    '|---|---|---|',
    ...kopf.sprung.map(([was, wofuer, pfad]) => `| ${was} | ${wofuer} | [öffnen](${pfad}) |`),
  ].join('\n');

  const einstieg = [
    `# ${kopf.titel}`,
    '',
    `> ${kopf.lead}`,
    '>',
    '> Dieses Handbuch zeigt nur, was für dich gilt. Wenn sich deine Rolle im',
    '> Verein ändert, ändert sich auch diese Seite.',
    '',
    '## Direkt-Sprung',
    '',
    tabelle,
  ].join('\n');

  return [einstieg, ...KAPITEL_JE_ROLLE[rolle].map((id) => KAPITEL[id].trim())].join('\n\n---\n\n');
}

/** Extrahiert die Überschriften (## / ###) für das Inhaltsverzeichnis. */
export function extractToc(md: string): { id: string; title: string; level: number }[] {
  const toc: { id: string; title: string; level: number }[] = [];
  let inCodeBlock = false;
  for (const line of md.split('\n')) {
    // Zeilen in ``` -Blöcken sind ASCII-Mockups, keine Überschriften — die
    // Rauten darin haben früher Phantom-Einträge im Verzeichnis erzeugt.
    if (line.trimStart().startsWith('```')) { inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) continue;
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (!m) continue;
    const level = m[1].length;
    const title = m[2]
      .replace(/^[\d.]+\.\s*/, '')
      .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, '')
      .trim();
    const id = title
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => ({ ä: 'a', ö: 'o', ü: 'u', ß: 'ss' }[c]!))
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    toc.push({ id, title, level });
  }
  return toc;
}
