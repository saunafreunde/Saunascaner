import { CATEGORY_LABELS, OILS, type Oil } from '@/lib/oils';
import { OIL_INFO } from '@/lib/oilInfo';
import { useDisabledOils, useInfusions, useSaunas } from '@/lib/api';
import { fmtClock, dayLabel } from '@/lib/time';

/** „Ätherische Öle bei uns im Regal" — eine Karte im Slot-Karussell leerer
 *  Tafel-Kacheln.
 *
 *  Bewusst als ZENTRIERTE Regal-Tafel gebaut und nicht als weitere Zeile im
 *  Kartenstapel: die vorherige Fassung (Nummer links, Titel daneben, Text
 *  darunter) reihte sich optisch nahtlos in die Aufguss-Karten ein und war
 *  auf den ersten Blick nicht davon zu unterscheiden. Diese hier hat eine
 *  eigene Handschrift — Überschrift, Medaillon, Name als Held, Duft als Zitat,
 *  alles um die Mitte gebaut. Zusammen mit dem gestrichelten Rahmen und dem
 *  „frei"-Chip der Kachel ist klar: hier findet kein Aufguss statt.
 *
 *  Datenquellen sind alle bereits anonym lesbar: der Öl-Katalog liegt rein
 *  clientseitig (lib/oils.ts + lib/oilInfo.ts), die geplanten Aufgüsse kommen
 *  aus useInfusions(), das die Tafel ohnehin schon lädt.
 */

/** Jedes Öl hat sein EIGENES Motiv: public/oele/<slug>.webp.
 *  Erzeugt mit Desktop\\sauna_oelbilder.py (fal-ai/nano-banana-2), pro Öl der
 *  tatsächliche Pflanzenteil aus dem das Öl gewonnen wird. */
function oilImage(slug: string): string {
  return `/oele/${slug}.webp`;
}

/** Akzentfarbe je Kategorie — färbt Medaillon, Zierlinien und Notenschild. */
const CATEGORY_COLOR: Record<string, string> = {
  zitrus:   '#b45309',
  holz:     '#3f6212',
  gewuerz:  '#9a3412',
  kraut:    '#4d7c0f',
  minze:    '#0f766e',
  sonstige: '#a21caf',
  saison:   '#b91c1c',
};

/** Basis-Maßeinheit der Karte.
 *
 *  Das ist der Kern der Auto-Anpassung: `min()` nimmt den KLEINEREN der beiden
 *  Werte, also bremst immer die Kante, die zuerst erreicht wird. Ist die Kachel
 *  flach, begrenzt die Höhe; ist sie schmal — etwa bei vier aktiven Saunen —
 *  begrenzt die Breite, und dann wächst der Rest eben nicht weiter.
 *
 *  Die Koeffizienten sind so gewählt, dass die Komposition rund 90 % der
 *  Kachel füllt: die Summe aller Bausteine ist ~52 Einheiten hoch, bei
 *  1080p und drei Kacheln ergibt 1.58cqh eine Einheit von ~4,8 px
 *  → ~247 px von 273 px verfügbarer Höhe. Der Breiten-Koeffizient (0.70cqw)
 *  ist am längsten Öl-Namen ausgerichtet („Eukalyptus citriadora"), damit
 *  auch der nicht abgeschnitten wird.
 *
 *  Alle Größen der Karte sind Vielfache davon — dadurch skaliert die
 *  Komposition als Ganzes statt in Einzelteilen auseinanderzulaufen. */
const U = 'min(1.58cqh, 0.70cqw)';
const u = (n: number) => `calc(${n} * ${U})`;

export function useSlotOil(seed: number, now: Date): Oil | null {
  const disabled = useDisabledOils();
  const infusions = useInfusions();
  // Öle, die der Admin aus dem Bestand genommen hat, tauchen gar nicht erst
  // auf — es wäre ärgerlich, ein Öl zu bewerben das nicht mehr im Regal steht.
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
  const info = OIL_INFO[oil.id];
  const next = useNextUse(oil.id, now);

  return (
    <div
      className="absolute inset-0"
      aria-hidden
      style={{
        // Radialer statt waagerechter Schleier: hell in der Mitte, wo die
        // Schrift steht, offen zu den Rändern, wo das Motiv atmen darf. Das
        // rahmt die zentrierte Komposition und sieht schon aus zehn Metern
        // anders aus als das Band der Aufguss-Karten.
        backgroundImage: [
          `radial-gradient(115% 105% at 50% 50%, rgba(255,255,255,0.93) 0%, rgba(255,255,255,0.86) 38%, rgba(255,255,255,0.50) 68%, rgba(255,255,255,0.24) 100%)`,
          `linear-gradient(180deg, ${color}14 0%, ${color}00 40%, ${color}22 100%)`,
          `url(${JSON.stringify(oilImage(oil.id))})`,
        ].join(', '),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* inset 5 % = die Komposition darf sich bis auf 90 % der Kachel
          aufziehen, danach ist Schluss. */}
      <div
        className="absolute flex flex-col items-center justify-center text-center"
        style={{ inset: '5%', gap: u(1.1) }}
      >
        {/* Überschrift mit Zierlinien — sagt sofort, worum es auf dieser
            Kachel geht, und trennt sie vom Aufguss-Programm. */}
        <div className="flex items-center w-full" style={{ gap: u(1.6) }}>
          <span className="flex-1" style={{ height: 1, background: `${color}55` }} />
          <span
            className="font-bold uppercase whitespace-nowrap"
            style={{ fontSize: u(2.6), letterSpacing: '0.2em', color }}
          >
            Ätherische Öle bei uns im Regal
          </span>
          <span className="flex-1" style={{ height: 1, background: `${color}55` }} />
        </div>

        {/* Medaillon mit der Regalnummer — die praktischste Information,
            und optisch das Gegenstück zur Uhrzeit-Box der Aufguss-Karten. */}
        <div
          className="flex-shrink-0 flex flex-col items-center justify-center rounded-full"
          style={{
            width: u(11.5),
            height: u(11.5),
            background: 'rgba(255,255,255,0.94)',
            boxShadow: `inset 0 0 0 ${u(0.35)} ${color}, 0 ${u(0.5)} ${u(1.6)} rgba(0,0,0,0.18)`,
          }}
        >
          <span
            className="font-bold uppercase leading-none"
            style={{ fontSize: u(2), letterSpacing: '0.14em', color: '#64748b' }}
          >
            Nr.
          </span>
          <span
            className="font-black tabular-nums leading-none"
            style={{ fontSize: u(5.6), color, marginTop: u(0.3) }}
          >
            {oil.number}
          </span>
        </div>

        {/* Der Name als Held */}
        <div
          className="font-black text-slate-900 leading-none max-w-full truncate"
          style={{ fontSize: u(9.5), textShadow: '0 1px 0 rgba(255,255,255,0.8)' }}
        >
          <span className="mr-2">{oil.emoji}</span>{oil.name}
        </div>

        {/* Kategorie · Herkunft · Duftnote */}
        <div
          className="flex items-center justify-center flex-wrap text-slate-700 font-semibold leading-none max-w-full"
          style={{ fontSize: u(2.9), gap: u(1.1) }}
        >
          <span className="truncate">{CATEGORY_LABELS[oil.category]}</span>
          {info?.herkunft && (
            <>
              <span style={{ color: `${color}99` }}>◆</span>
              <span className="truncate">{info.herkunft}</span>
            </>
          )}
          {oil.note && (
            <span
              className="rounded-full font-bold text-white whitespace-nowrap"
              style={{ background: color, padding: `${u(0.5)} ${u(1.4)}` }}
            >
              {oil.note}note
            </span>
          )}
        </div>

        {/* Der Duft als Zitat — bewusst anderer Duktus als die nüchternen
            Pillen der Aufguss-Karten. */}
        {info?.text && (
          <p
            className="italic text-slate-800 leading-snug line-clamp-2 max-w-full"
            style={{ fontSize: u(4.8), textShadow: '0 1px 0 rgba(255,255,255,0.7)' }}
          >
            „{info.text.replace(/\.$/, '')}"
          </p>
        )}

        {/* Und wenn das Öl heute wirklich auf die Steine kommt: der Hinweis,
            der aus „schönes Bild" ein „da geh ich hin" macht. */}
        {next && (
          <span
            className="inline-flex items-center rounded-full font-black text-white whitespace-nowrap max-w-full"
            style={{
              fontSize: u(3.1),
              padding: `${u(0.9)} ${u(2.4)}`,
              gap: u(1.1),
              marginTop: u(0.4),
              background: `linear-gradient(135deg, ${next.accent}, ${next.accent}cc)`,
              boxShadow: `0 ${u(0.6)} ${u(3)} ${next.accent}66, inset 0 1px 0 rgba(255,255,255,0.3)`,
              textShadow: '0 1px 2px rgba(0,0,0,0.4)',
            }}
          >
            <span
              className="tafel-blink flex-shrink-0 rounded-full bg-white"
              style={{ width: u(1.5), height: u(1.5) }}
            />
            <span className="truncate">
              Im Aufguss {next.when} · {next.sauna}{next.tempLabel ? ` ${next.tempLabel}` : ''}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
