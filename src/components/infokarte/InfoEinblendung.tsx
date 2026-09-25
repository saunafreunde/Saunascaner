import { useBrandSettings, useSaunafestTage } from '@/lib/api';
import { InfoKarteView } from '@/components/infokarte/InfoKarteView';
import { karteLaeuft, karteHatVideo, LEINWAND_V, type InfoKarte } from '@/types/infokarten';
import { SaunafestSchild } from '@/components/emptytile/SaunafestSchilder';
import { naechsterFestTag } from '@/lib/saunafestPlan';

/** Große Einblendung für als „wichtig" markierte Info-Karten.
 *
 *  Der Grund für ihre Existenz: eine Info-Karte im Karussell erscheint nur,
 *  WENN eine Kachel leer ist. An einem gut belegten Samstag mit Aufgüssen in
 *  jeder Zeile gibt es keine — die Ansage wäre ausgerechnet dann unsichtbar,
 *  wenn die meisten Gäste da sind. Diese Einblendung legt sich deshalb
 *  periodisch über die Tafel und ist unabhängig von der Belegung.
 *
 *  ── Timing ohne eigenen Timer ──
 *  Alles wird aus dem `now` abgeleitet, das die Tafel ohnehin sekündlich
 *  durchreicht: alle ZYKLUS_S Sekunden für DAUER_S Sekunden. Kein
 *  setInterval, kein zweiter Renderpfad — dieselbe Rechnung wie beim
 *  Karten-Karussell. Alle Bildschirme zeigen dadurch synchron dasselbe.
 *
 *  Bewusst NICHT dauerhaft: die Tafel ist in erster Linie der Aufgussplan,
 *  auf den Gäste zum Nachschauen kommen. Eine Einblendung, die den Plan zu
 *  oft verdeckt, macht die Tafel unbrauchbar — 20 s alle 5 Minuten sind rund
 *  7 % der Zeit.
 *
 *  ── ohneVideo (Saunafest) ──
 *  Am Festtag spielen schon bis zu drei Aufguss-Karten ihr Video (eines je
 *  Spalte). Die Einblendung pausiert sie nicht — eine Karte mit Video wäre
 *  der vierte Decoder, den der TV-Stick nicht schafft. Dieselbe Regel wie im
 *  Karussell (SlotCarousel); Karten ohne Video laufen weiter.
 */
const ZYKLUS_S = 300;
const DAUER_S = 20;

export function InfoEinblendung({ now, ohneVideo = false }: { now: Date; ohneVideo?: boolean }) {
  const brand = useBrandSettings();
  // Derselbe Cache wie im Dashboard — keine zusätzliche Abfrage.
  const festTage = useSaunafestTage();
  const wichtige = (brand.data?.info_karten ?? [])
    .filter((k) => k.wichtig && karteLaeuft(k, now) && !(ohneVideo && karteHatVideo(k)));
  // Saunafest-Schilder (25.09.2026) laufen wie eine wichtige Karte mit — sie
  // ersetzen das frühere „wichtige" Saunafest-Video. Kein Video, also auch am
  // Festtag erlaubt.
  const fest = brand.data?.slot_cards?.saunafest !== false ? naechsterFestTag(festTage.data, now) : null;
  const eintraege: (InfoKarte | 'fest')[] = [...wichtige, ...(fest ? ['fest' as const] : [])];
  if (eintraege.length === 0) return null;

  const sek = Math.floor(now.getTime() / 1000);
  const imZyklus = sek % ZYKLUS_S;
  if (imZyklus >= DAUER_S) return null;

  // Mehrere wichtige Karten wechseln sich über die Zyklen ab, statt sich zu
  // überlagern oder eine davon nie zu zeigen. Die Saunafest-Schilder wechseln
  // bei jedem ihrer Auftritte zwischen Termine und Tagesablauf.
  const zyklus = Math.floor(sek / ZYKLUS_S);
  const eintrag = eintraege[zyklus % eintraege.length];
  const festVariante = Math.floor(zyklus / eintraege.length) % 2 === 0 ? 'termine' : 'tag';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center pointer-events-none info-einblendung"
      style={{ zIndex: 45, background: 'rgba(2,6,12,0.72)' }}
    >
      <div
        className="rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/15"
        style={{ width: '78vw', aspectRatio: `${LEINWAND_V}`, maxHeight: '80vh' }}
      >
        {eintrag === 'fest'
          ? fest && (
            <div className="relative h-full w-full">
              <SaunafestSchild variante={festVariante} fest={fest} alle={festTage.data ?? []} now={now} />
            </div>
          )
          : <InfoKarteView karte={eintrag} now={now} />}
      </div>
    </div>
  );
}
