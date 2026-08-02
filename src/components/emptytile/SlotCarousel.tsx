import type { Sauna } from '@/types/database';
import { useBrandSettings } from '@/lib/api';
import { ReefScene } from '@/components/ReefScene';
import { OilCard, useSlotOil } from '@/components/emptytile/OilCard';
import { GalleryCard } from '@/components/emptytile/GalleryCard';
import { ForestWindow } from '@/components/emptytile/ForestWindow';

/** Karussell für leere Tafel-Kacheln.
 *
 *  Bis Aug 2026 zeigte jeder leere Slot dieselbe Riff-Szene — hartcodiert,
 *  ohne Zufall, in jeder Kachel identisch. Drei leere Slots nebeneinander
 *  hießen dreimal dasselbe Aquarium, im Januar wie im Juli. Deshalb jetzt
 *  ein kleiner Karten-Pool, durch den die Kachel wandert.
 *
 *  KEIN eigener Timer: das Dashboard tickt ohnehin sekündlich (useNow) und
 *  reicht `now` bis hierher durch — der Index wird daraus abgeleitet. Damit
 *  bleibt die Projektregel „keine JS-Timer" unangetastet (das hier ist ein
 *  Datentick, kein Animations-Loop), und alle Fernseher zeigen synchron
 *  dasselbe.
 *
 *  VERSETZT statt synchron: `offset` verschiebt jede Kachel im Pool, damit
 *  nebeneinanderliegende Slots nie dieselbe Karte zeigen. Genau das war der
 *  Grund für den langweiligen Gesamteindruck.
 */

/** Anzeigedauer einer Karte. 20 s: lang genug zum Lesen, kurz genug dass es
 *  beim Vorbeigehen auffällt. Bei drei Kacheln versetzt ändert sich dadurch
 *  etwa alle 7 s irgendwo auf der Tafel etwas. */
const CARD_MS = 20_000;

export type SlotCardId = 'reef' | 'forest' | 'oil' | 'gallery';

type Props = {
  sauna: Sauna;
  now: Date;
  /** Position der Kachel in ihrer Spalte — sorgt zusammen mit sort_order
   *  dafür, dass Nachbarkacheln versetzt laufen. */
  slotIndex: number;
  /** Schwimmrichtung der Riff-Tiere (zeigt zur aktiven Nachbarsauna). */
  direction: 'left' | 'right' | null;
};

export function SlotCarousel({ sauna, now, slotIndex, direction }: Props) {
  const brand = useBrandSettings();
  const gallery = brand.data?.slot_gallery ?? [];
  const cards = brand.data?.slot_cards;

  const tick = Math.floor(now.getTime() / CARD_MS);
  const offset = slotIndex + (sauna.sort_order ?? 0);

  // Hooks IMMER unbedingt aufrufen (Rules of Hooks) — erst danach entscheiden,
  // welche Karte dran ist. Öl und Foto wandern mit jedem Durchlauf weiter,
  // sonst zeigte eine Kachel immer dasselbe Öl.
  const oil = useSlotOil(tick + offset * 7, now);
  const photo = gallery.length > 0
    ? gallery[(((tick + offset) % gallery.length) + gallery.length) % gallery.length]
    : null;

  // Nur Karten in den Pool, die auch wirklich etwas anzeigen können:
  // ohne Fotos keine Galerie, ohne freigeschaltete Öle keine Öl-Karte.
  // Riff und Schwarzwald-Fenster sind reine Deko und stehen per Default AUS —
  // sie passten nicht mehr zum Rest der Tafel. Im Admin unter „🎭 Bühne"
  // lassen sie sich jederzeit wieder dazuschalten.
  const pool: SlotCardId[] = [];
  if (oil) pool.push('oil');
  if (photo) pool.push('gallery');
  if (cards?.reef) pool.push('reef');
  if (cards?.forest) pool.push('forest');
  // Sicherheitsnetz: wären alle Öle deaktiviert UND keine Fotos hinterlegt UND
  // beide Deko-Karten aus, bliebe die Kachel schwarz. Dann lieber das Riff.
  if (pool.length === 0) pool.push('reef');

  const card = pool[(((tick + offset) % pool.length) + pool.length) % pool.length];

  // Bewusst OHNE AnimatePresence. Der vorherige Stand nutzte mode="wait": die
  // alte Karte musste ihre Exit-Animation abschliessen, bevor die neue gemountet
  // wurde. Solange framer-motion diese Animation nicht zu Ende meldet — und das
  // tut es u. a. dann nicht, wenn der Frameloop steht (Tab im Hintergrund) —
  // wird die neue Karte NIE gemountet: die Kachel bleibt dauerhaft inhaltsleer,
  // man sieht nur noch den gestrichelten Rahmen und die "frei"-Pille.
  //
  // Jetzt haengt die Sichtbarkeit an nichts mehr, was scheitern kann: die
  // aktuelle Karte wird direkt gerendert und ist ab dem ersten Frame da. Das
  // `key` setzt beim Kartenwechsel die CSS-Animation `.slot-karte` neu auf,
  // die das Ankommen weich macht — Pure-CSS, nur opacity/transform, und mit
  // einem Startwert von 0.4 statt 0, damit selbst eine nie laufende Animation
  // die Karte nur blasser macht statt unsichtbar (siehe index.css).
  return (
    <div key={card} className="slot-karte absolute inset-0">
      {card === 'reef' && <ReefScene direction={direction} />}
      {card === 'forest' && <ForestWindow />}
      {card === 'oil' && oil && <OilCard oil={oil} now={now} />}
      {card === 'gallery' && photo && <GalleryCard photo={photo} />}
    </div>
  );
}
