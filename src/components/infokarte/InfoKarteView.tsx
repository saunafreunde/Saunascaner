import { publicAssetUrl } from '@/lib/api';
import { AusschnittBild } from '@/components/AusschnittBild';
import type { InfoKarte, KartenElement } from '@/types/infokarten';

/** Zeigt eine Info-Karte — EINE Fassung für alle drei Orte:
 *  Kachel im Karussell, große Einblendung, Vorschau im Editor.
 *
 *  Der Aufrufer bestimmt die Größe, diese Komponente füllt sie vollständig.
 *  Alle Maße darin sind Prozent der Leinwand bzw. `cqh`/`cqw` — deshalb sieht
 *  die Komposition an allen drei Orten gleich aus und wird nur skaliert.
 *  Voraussetzung dafür ist der eigene `container-type: size` hier unten; ohne
 *  ihn bezögen sich die cq-Einheiten auf einen Container weiter oben und die
 *  Schrift bliebe beim Verkleinern riesig.
 *
 *  Bewusst ohne eigene Timer: der Countdown rechnet aus dem `now`, das die
 *  Tafel ohnehin sekündlich durchreicht. Ein zweiter Timer neben dem der
 *  Tafel wäre auf einem Gerät, das 24/7 läuft, verschenkte Rechenzeit.
 */
export function InfoKarteView({
  karte,
  now,
  className = '',
}: {
  karte: InfoKarte;
  now: Date;
  className?: string;
}) {
  const h = karte.hintergrund;
  const bgUrl = h.path ? publicAssetUrl(h.path) : null;

  return (
    <div
      className={`relative overflow-hidden w-full h-full ${className}`}
      style={{
        containerType: 'size',
        background: h.typ === 'farbe'
          ? h.farbe
          : h.typ === 'verlauf'
            ? `linear-gradient(135deg, ${h.farbe} 0%, ${h.farbe2} 100%)`
            : h.farbe,
      }}
    >
      {h.typ === 'bild' && bgUrl && (
        <AusschnittBild url={bgUrl} ausschnitt={h.ausschnitt} className="absolute inset-0" />
      )}
      {h.typ === 'video' && bgUrl && (
        <video
          src={bgUrl}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'cover' }}
          autoPlay muted loop playsInline
        />
      )}
      {(h.typ === 'bild' || h.typ === 'video') && h.schleier > 0 && (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: `rgba(2,6,12,${h.schleier})` }}
        />
      )}

      {karte.elemente.map((el) => (
        <ElementView key={el.id} el={el} now={now} />
      ))}
    </div>
  );
}

function ElementView({ el, now }: { el: KartenElement; now: Date }) {
  const rahmen: React.CSSProperties = {
    position: 'absolute',
    left: `${el.x}%`,
    top: `${el.y}%`,
    width: `${el.breite}%`,
    opacity: el.deckkraft,
  };

  if (el.typ === 'text') {
    return (
      <div
        style={{
          ...rahmen,
          fontSize: `${el.groesse}cqh`,
          color: el.farbe,
          fontWeight: el.fett ? 800 : 400,
          fontStyle: el.kursiv ? 'italic' : 'normal',
          textAlign: el.ausrichtung,
          lineHeight: 1.15,
          // Ohne Schatten verschwindet heller Text auf hellen Bildstellen.
          textShadow: el.schatten ? '0 0.08em 0.16em rgba(0,0,0,0.75)' : undefined,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {el.text}
      </div>
    );
  }

  if (el.typ === 'countdown') {
    return (
      <div
        style={{
          ...rahmen,
          color: el.farbe,
          textAlign: 'center',
          textShadow: el.schatten ? '0 0.08em 0.16em rgba(0,0,0,0.75)' : undefined,
        }}
      >
        {el.label && (
          <div style={{ fontSize: `${el.groesse * 0.34}cqh`, opacity: 0.85, letterSpacing: '0.08em' }}>
            {el.label}
          </div>
        )}
        <div style={{ fontSize: `${el.groesse}cqh`, fontWeight: 800, lineHeight: 1.05 }}>
          {restText(el.ziel, now, el.fertigText)}
        </div>
      </div>
    );
  }

  const url = publicAssetUrl(el.path);
  if (!url) return null;

  if (el.typ === 'bild') {
    return (
      <div style={{ ...rahmen, height: `${el.hoehe}%`, borderRadius: `${el.radius}cqh`, overflow: 'hidden' }}>
        <AusschnittBild url={url} ausschnitt={el.ausschnitt} />
      </div>
    );
  }

  return (
    <div style={{ ...rahmen, height: `${el.hoehe}%`, borderRadius: `${el.radius}cqh`, overflow: 'hidden' }}>
      <video
        src={url}
        className="w-full h-full"
        style={{ objectFit: 'cover' }}
        autoPlay muted loop playsInline
      />
    </div>
  );
}

/** Verbleibende Zeit in Worten. Ab einem Tag wird nur in Tagen gezählt —
 *  „noch 12 Tage" liest sich im Vorbeigehen, „11 Tage 23:14:07" nicht. */
function restText(zielIso: string, now: Date, fertig: string): string {
  const ziel = new Date(zielIso).getTime();
  if (!Number.isFinite(ziel)) return fertig;
  const ms = ziel - now.getTime();
  if (ms <= 0) return fertig;

  const min = Math.floor(ms / 60_000);
  const std = Math.floor(min / 60);
  const tage = Math.floor(std / 24);
  if (tage >= 1) return `noch ${tage} ${tage === 1 ? 'Tag' : 'Tage'}`;
  if (std >= 1) return `noch ${std} h ${min % 60} min`;
  if (min >= 1) return `noch ${min} min`;
  return 'gleich!';
}
