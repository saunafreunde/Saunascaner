import type { OelraumSettings, OelraumTageszeit } from '@/types/branding';

/** Hintergrund des Öl-Raum-Tablets nach Tageszeit (Vorgabe Christoph
 *  03.09.2026: „mache den Hintergrund nach Tageszeit").
 *
 *  Vier feste Phasen. Die Grenzen folgen dem Saunabetrieb, nicht der Uhr:
 *  vormittags Nebel und Wald, über den Nachmittag Grün, abends Glut, nachts
 *  der See — und die Nacht reicht bis zum Morgen, damit das Gerät nicht um
 *  Mitternacht auf ein helles Motiv springt. Ortszeit des Geräts, wie auch
 *  die Uhrzeiten auf den Karten (`uhr()` in OelraumAnzeige). */
export type Tagesphase = keyof Omit<OelraumTageszeit, 'aktiv'>;

export const TAGESPHASEN: readonly { id: Tagesphase; label: string; hinweis: string }[] = [
  { id: 'morgen', label: 'Morgen', hinweis: '6–11 Uhr' },
  { id: 'mittag', label: 'Mittag', hinweis: '11–17 Uhr' },
  { id: 'abend', label: 'Abend', hinweis: '17–22 Uhr' },
  { id: 'nacht', label: 'Nacht', hinweis: '22–6 Uhr' },
];

export function tagesphase(d: Date): Tagesphase {
  const h = d.getHours();
  if (h >= 6 && h < 11) return 'morgen';
  if (h >= 11 && h < 17) return 'mittag';
  if (h >= 17 && h < 22) return 'abend';
  return 'nacht';
}

/** Welches Bild das Tablet JETZT zeigt. Tageszeit aus, oder für die Phase
 *  nichts gewählt → der Standard-Hintergrund. Liefert den Pfad, nicht die
 *  URL — aufgelöst wird wie bisher über brandAssetUrl. */
export function oelraumHintergrundPfad(o: OelraumSettings, now: Date): string | null {
  if (!o.tageszeit.aktiv) return o.hintergrund;
  return o.tageszeit[tagesphase(now)] ?? o.hintergrund;
}

/** Vorbelegung beim Einschalten, wenn noch keine Phase ein Bild hat — aus den
 *  mitgelieferten Vorlagen (src/lib/oelraumVorlagen.ts). */
export const TAGESZEIT_VORSCHLAG: Record<Tagesphase, string> = {
  morgen: '/bg/oelraum/nebeltannen.webp',
  mittag: '/bg/oelraum/birkenzweige.webp',
  abend: '/bg/oelraum/glut.webp',
  nacht: '/bg/oelraum/bergsee.webp',
};
