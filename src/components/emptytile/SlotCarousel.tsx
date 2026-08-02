import { AnimatePresence, motion } from 'framer-motion';
import type { Sauna } from '@/types/database';
import { useBrandSettings } from '@/lib/api';
import { ReefScene } from '@/components/ReefScene';
import { OilCard, useSlotOil } from '@/components/emptytile/OilCard';
import { GalleryCard } from '@/components/emptytile/GalleryCard';

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
  // Das Riff ist der garantierte Fallback — der Pool ist nie leer.
  const pool: ('reef' | 'oil' | 'gallery')[] = ['reef'];
  if (oil) pool.push('oil');
  if (photo) pool.push('gallery');

  const card = pool[(((tick + offset) % pool.length) + pool.length) % pool.length];

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={card}
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      >
        {card === 'reef' && <ReefScene direction={direction} />}
        {card === 'oil' && oil && <OilCard oil={oil} now={now} />}
        {card === 'gallery' && photo && <GalleryCard photo={photo} />}
      </motion.div>
    </AnimatePresence>
  );
}
