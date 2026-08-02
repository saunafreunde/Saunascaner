import { CATEGORY_LABELS, OILS, type Oil } from '@/lib/oils';
import { useDisabledOils } from '@/lib/api';

/** Öl des Slots — eine Karte im Slot-Karussell leerer Tafel-Kacheln.
 *
 *  Zeigt eines der 64 Regal-Öle mit Nummer, Name, Kategorie und Duftnote.
 *  Der Gast erfährt nebenbei, was da eigentlich verdampft, und findet über
 *  die Nummer das Fläschchen im Regal wieder.
 *
 *  Datenquelle ist rein clientseitig (lib/oils.ts) — kein Backend, kein
 *  Ladezustand. Nur die vom Admin deaktivierten Öle werden ausgefiltert
 *  (Migration 0093), damit nie ein Öl beworben wird, das nicht im Regal steht.
 */

/** Ein Motiv PRO KATEGORIE statt pro Öl — 7 statt 64 Bilder.
 *  Erzeugt mit Desktop\\sauna_gen.py (fal.ai flux/dev), gleicher dunkel-edler
 *  Stil wie die Schnaps-Motive der Aufguss-Karten. */
const CATEGORY_IMAGE: Record<string, string> = {
  zitrus:   '/oele/zitrus.webp',
  holz:     '/oele/holz.webp',
  gewuerz:  '/oele/gewuerz.webp',
  kraut:    '/oele/kraut.webp',
  minze:    '/oele/minze.webp',
  sonstige: '/oele/sonstige.webp',
  saison:   '/oele/saison.webp',
};

/** Akzentfarbe je Kategorie — färbt Nummer-Kachel und Notenschild. */
const CATEGORY_COLOR: Record<string, string> = {
  zitrus:   '#d97706',
  holz:     '#3f6212',
  gewuerz:  '#9a3412',
  kraut:    '#4d7c0f',
  minze:    '#0f766e',
  sonstige: '#a21caf',
  saison:   '#b91c1c',
};

export function useSlotOil(seed: number): Oil | null {
  const disabled = useDisabledOils();
  const pool = OILS.filter((o) => !disabled.data?.[o.id]);
  if (pool.length === 0) return null;
  // Deterministisch: alle Fernseher zeigen zur selben Zeit dasselbe Öl.
  return pool[((seed % pool.length) + pool.length) % pool.length];
}

export function OilCard({ oil }: { oil: Oil }) {
  const color = CATEGORY_COLOR[oil.category] ?? '#4d7c0f';
  const image = CATEGORY_IMAGE[oil.category];

  return (
    <div
      className="absolute inset-0"
      aria-hidden
      style={{
        // Schleier-Rezept wie auf den Schnaps-Karten: oben fast weiß, damit
        // der Text trägt, in der Mitte offen fürs Motiv, unten wieder heller
        // für die Sauna-Pille. Ein gleichmäßiger Schleier macht die dunklen
        // Motive milchig.
        backgroundImage: [
          `linear-gradient(200deg, ${color}00 0%, ${color}00 45%, ${color}2e 100%)`,
          'linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.88) 32%, rgba(255,255,255,0.44) 58%, rgba(255,255,255,0.30) 84%, rgba(255,255,255,0.68) 100%)',
          `url(${JSON.stringify(image)})`,
        ].join(', '),
        backgroundSize: 'cover',
        backgroundPosition: 'center bottom',
      }}
    >
      <div
        className="absolute inset-0 flex items-center"
        style={{
          // Links Platz lassen für Akzent-Stripe und Uhrzeit-Pille der Kachel.
          padding: 'clamp(28px, 9cqh, 62px) clamp(12px, 3cqh, 26px) clamp(22px, 7cqh, 48px) clamp(16px, 4cqh, 34px)',
          gap: 'clamp(8px, 2.4cqh, 20px)',
        }}
      >
        {/* Regalnummer — das ist die praktisch nützlichste Information */}
        <div
          className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl"
          style={{
            padding: 'clamp(3px, 1cqh, 8px) clamp(6px, 1.8cqh, 14px)',
            background: 'rgba(255,255,255,0.92)',
            boxShadow: `inset 0 0 0 2px ${color}55, 0 2px 8px rgba(0,0,0,0.18)`,
          }}
        >
          <span
            className="font-bold uppercase leading-none"
            style={{ fontSize: 'clamp(6px, 1.7cqh, 11px)', letterSpacing: '0.12em', color: '#64748b' }}
          >
            Nr.
          </span>
          <span
            className="font-black tabular-nums leading-none"
            style={{ fontSize: 'clamp(15px, 5cqh, 34px)', color, marginTop: '0.12em' }}
          >
            {oil.number}
          </span>
        </div>

        <div className="min-w-0">
          <div
            className="font-black text-slate-900 leading-tight truncate"
            style={{ fontSize: 'clamp(15px, 5cqh, 34px)', textShadow: '0 1px 0 rgba(255,255,255,0.6)' }}
          >
            <span aria-hidden className="mr-1">{oil.emoji}</span>
            {oil.name}
          </div>
          <div
            className="flex items-center flex-wrap text-slate-700 font-semibold leading-tight"
            style={{ fontSize: 'clamp(8px, 2.4cqh, 16px)', gap: 'clamp(3px, 1cqh, 8px)', marginTop: 'clamp(2px, 0.8cqh, 6px)' }}
          >
            <span className="truncate">{CATEGORY_LABELS[oil.category]}</span>
            {oil.note && (
              <>
                <span aria-hidden className="opacity-50">·</span>
                <span
                  className="rounded-full font-bold text-white whitespace-nowrap"
                  style={{ background: color, padding: '0.1em 0.6em' }}
                >
                  {oil.note}note
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
