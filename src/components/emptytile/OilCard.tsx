import { CATEGORY_LABELS, OILS, type Oil } from '@/lib/oils';
import { OIL_INFO } from '@/lib/oilInfo';
import { useDisabledOils, useInfusions, useSaunas } from '@/lib/api';
import { fmtClock, dayLabel } from '@/lib/time';

/** Öl des Slots — eine Karte im Slot-Karussell leerer Tafel-Kacheln.
 *
 *  Zeigt eines der 64 Regal-Öle: Nummer, Name, Duftbeschreibung, Herkunft,
 *  Kategorie und Duftnote. Und — das ist der eigentliche Mehrwert für den
 *  Gast — einen blinkenden Hinweis, WANN und WO dieses Öl demnächst
 *  tatsächlich aufgegossen wird. Aus „schönes Bild" wird damit
 *  „da geh ich hin".
 *
 *  Datenquellen sind alle bereits anonym lesbar: der Öl-Katalog liegt rein
 *  clientseitig (lib/oils.ts + lib/oilInfo.ts), die geplanten Aufgüsse kommen
 *  aus useInfusions(), das die Tafel ohnehin schon lädt.
 */

/** Jedes Öl hat sein EIGENES Motiv: public/oele/<slug>.webp.
 *  Vorher gab es nur sieben Kategorie-Bilder — bei 64 Ölen passte das oft
 *  nicht (unter „Hölzer & Nadeln" lief für Zirbe, Wacholder und Cedernholz
 *  dasselbe Fichtenbild). Erzeugt mit Desktop\\sauna_oelbilder.py
 *  (fal-ai/nano-banana-2), pro Öl der tatsächliche Pflanzenteil. */
function oilImage(slug: string): string {
  return `/oele/${slug}.webp`;
}

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

export function useSlotOil(seed: number, now: Date): Oil | null {
  const disabled = useDisabledOils();
  const infusions = useInfusions();
  const pool = OILS.filter((o) => !disabled.data?.[o.id]);
  if (pool.length === 0) return null;

  // Öle, die heute noch tatsächlich aufgegossen werden. Bei 64 Ölen im Regal
  // und einer Handvoll geplanter würde der "Im Aufguss"-Hinweis sonst fast
  // nie erscheinen — genau der ist aber der Mehrwert für den Gast. Deshalb
  // zeigt JEDE ZWEITE Öl-Karte gezielt ein eingeplantes Öl, die andere ein
  // beliebiges aus dem Regal.
  const geplant = pool.filter((o) =>
    (infusions.data ?? []).some((i) =>
      !i.is_personal_fallback
      && new Date(i.start_time).getTime() > now.getTime()
      && (i.oils ?? []).includes(o.id)));

  const src = (seed % 2 === 0 && geplant.length > 0) ? geplant : pool;
  // Deterministisch: alle Fernseher zeigen zur selben Zeit dasselbe Öl.
  return src[((seed % src.length) + src.length) % src.length];
}

/** Nächster geplanter Aufguss, in dem genau dieses Öl vorkommt. */
function useNextUse(oilId: string, now: Date) {
  const infusions = useInfusions();
  const saunas = useSaunas();
  const hit = (infusions.data ?? [])
    .filter((i) => !i.is_personal_fallback
      && new Date(i.start_time).getTime() > now.getTime()
      && (i.oils ?? []).includes(oilId))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];
  if (!hit) return null;
  const sauna = (saunas.data ?? []).find((s) => s.id === hit.sauna_id);
  return {
    when: `${dayLabel(hit.start_time, now)} ${fmtClock(hit.start_time)}`,
    sauna: sauna?.name ?? '',
    tempLabel: sauna?.temperature_label ?? '',
    accent: sauna?.accent_color ?? '#0f766e',
  };
}

export function OilCard({ oil, now }: { oil: Oil; now: Date }) {
  const color = CATEGORY_COLOR[oil.category] ?? '#4d7c0f';
  const image = oilImage(oil.id);
  const info = OIL_INFO[oil.id];
  const next = useNextUse(oil.id, now);

  return (
    <div
      className="absolute inset-0"
      aria-hidden
      style={{
        // Schleier-Rezept wie auf den Schnaps-Karten: oben fast weiß, damit
        // der Text trägt, in der Mitte offen fürs Motiv, unten wieder heller.
        // Ein gleichmäßiger Schleier macht die dunklen Motive milchig.
        backgroundImage: [
          `linear-gradient(200deg, ${color}00 0%, ${color}00 45%, ${color}2e 100%)`,
          'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.90) 34%, rgba(255,255,255,0.52) 62%, rgba(255,255,255,0.38) 84%, rgba(255,255,255,0.72) 100%)',
          `url(${JSON.stringify(image)})`,
        ].join(', '),
        backgroundSize: 'cover',
        backgroundPosition: 'center bottom',
      }}
    >
      <div
        className="absolute inset-0 flex flex-col justify-between"
        style={{
          // justify-between statt center: der Inhalt fuellt die Kachel jetzt
          // von oben bis unten aus, statt als Block in der Mitte zu schweben.
          padding: 'clamp(10px, 4cqh, 30px) clamp(14px, 4cqh, 34px) clamp(10px, 4cqh, 30px) clamp(16px, 4.5cqh, 38px)',
          gap: 'clamp(4px, 1.6cqh, 14px)',
        }}
      >
        {/* Kopfzeile: Regalnummer + Name + Duftnote */}
        <div className="flex items-center min-w-0" style={{ gap: 'clamp(7px, 2cqh, 16px)' }}>
          <div
            className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl"
            style={{
              padding: 'clamp(3px, 1.3cqh, 11px) clamp(7px, 2.4cqh, 20px)',
              background: 'rgba(255,255,255,0.92)',
              boxShadow: `inset 0 0 0 2px ${color}55, 0 2px 8px rgba(0,0,0,0.15)`,
            }}
          >
            <span
              className="font-bold uppercase leading-none"
              style={{ fontSize: 'clamp(7px, 2.2cqh, 15px)', letterSpacing: '0.12em', color: '#64748b' }}
            >
              Nr.
            </span>
            <span
              className="font-black tabular-nums leading-none"
              style={{ fontSize: 'clamp(20px, 7.4cqh, 52px)', color, marginTop: '0.06em' }}
            >
              {oil.number}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div
              className="font-black text-slate-900 leading-tight truncate"
              style={{ fontSize: 'clamp(21px, 7.6cqh, 54px)', textShadow: '0 1px 0 rgba(255,255,255,0.7)' }}
            >
              <span className="mr-1">{oil.emoji}</span>{oil.name}
            </div>
            <div
              className="flex items-center flex-wrap text-slate-700 font-semibold leading-tight"
              style={{ fontSize: 'clamp(10px, 3.2cqh, 22px)', gap: 'clamp(4px, 1.4cqh, 12px)', marginTop: 'clamp(2px, 0.9cqh, 7px)' }}
            >
              <span className="truncate">{CATEGORY_LABELS[oil.category]}</span>
              {info?.herkunft && (
                <>
                  <span className="opacity-50">·</span>
                  <span className="truncate">📍 {info.herkunft}</span>
                </>
              )}
              {oil.note && (
                <span
                  className="rounded-full font-bold text-white whitespace-nowrap"
                  style={{ background: color, padding: '0.1em 0.6em' }}
                >
                  {oil.note}note
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Duftbeschreibung — das, was den Gast wirklich interessiert */}
        {info?.text && (
          <p
            className="text-slate-800 font-semibold leading-snug line-clamp-3 flex-1 flex items-center"
            style={{
              // flex-1: die Beschreibung bekommt den Raum, der zwischen
              // Kopfzeile und Einsatz-Hinweis uebrig bleibt — dadurch fuellt
              // die Karte sich selbst aus, egal wie hoch die Kachel ist.
              fontSize: 'clamp(13px, 4.4cqh, 31px)',
              textShadow: '0 1px 0 rgba(255,255,255,0.6)',
            }}
          >
            {info.text}
          </p>
        )}

        {/* Der Mehrwert: dieses Öl ist tatsächlich eingeplant. Blinkt dezent,
            damit es im Vorbeigehen auffällt — Pure-CSS (.tafel-blink), wie
            der LIVE-Punkt auf den Aufguss-Karten. */}
        {next && (
          <div className="flex items-center min-w-0" style={{ marginTop: 'clamp(1px, 0.8cqh, 6px)' }}>
            <span
              className="inline-flex items-center rounded-full font-black text-white whitespace-nowrap min-w-0"
              style={{
                fontSize: 'clamp(11px, 3.4cqh, 24px)',
                padding: 'clamp(3px, 1.1cqh, 9px) clamp(9px, 2.6cqh, 20px)',
                gap: 'clamp(4px, 1.2cqh, 9px)',
                background: `linear-gradient(135deg, ${next.accent}, ${next.accent}cc)`,
                boxShadow: `0 2px 10px ${next.accent}77, inset 0 1px 0 rgba(255,255,255,0.3)`,
                textShadow: '0 1px 2px rgba(0,0,0,0.4)',
              }}
            >
              <span
                className="tafel-blink flex-shrink-0 rounded-full bg-white"
                style={{ width: 'clamp(6px, 1.8cqh, 13px)', height: 'clamp(6px, 1.8cqh, 13px)' }}
              />
              <span className="truncate">
                Im Aufguss {next.when} · {next.sauna}{next.tempLabel ? ` ${next.tempLabel}` : ''}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
