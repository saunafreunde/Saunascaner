import { useBrandSettings } from '@/lib/api';
import { InfoKarteView } from '@/components/infokarte/InfoKarteView';
import { karteLaeuft, LEINWAND_V } from '@/types/infokarten';

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
 */
const ZYKLUS_S = 300;
const DAUER_S = 20;

export function InfoEinblendung({ now }: { now: Date }) {
  const brand = useBrandSettings();
  const wichtige = (brand.data?.info_karten ?? []).filter((k) => k.wichtig && karteLaeuft(k, now));
  if (wichtige.length === 0) return null;

  const sek = Math.floor(now.getTime() / 1000);
  const imZyklus = sek % ZYKLUS_S;
  if (imZyklus >= DAUER_S) return null;

  // Mehrere wichtige Karten wechseln sich über die Zyklen ab, statt sich zu
  // überlagern oder eine davon nie zu zeigen.
  const karte = wichtige[Math.floor(sek / ZYKLUS_S) % wichtige.length];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center pointer-events-none info-einblendung"
      style={{ zIndex: 45, background: 'rgba(2,6,12,0.72)' }}
    >
      <div
        className="rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/15"
        style={{ width: '78vw', aspectRatio: `${LEINWAND_V}`, maxHeight: '80vh' }}
      >
        <InfoKarteView karte={karte} now={now} />
      </div>
    </div>
  );
}
