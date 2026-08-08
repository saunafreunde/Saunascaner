import type { Ausschnitt } from '@/types/branding';

/** Ein Bild, das seine Kachel füllt — mit wählbarem Ausschnitt.
 *
 *  Warum überhaupt: eine Tafel-Kachel ist je nach Aufteilung 2:1 bis 4:1
 *  (gemessen auf 1080p: 920×301 bei 2 Saunen × 3 Aufgüssen, 920×224 bei 2×4,
 *  603×301 bei 3×3, 603×224 bei 3×4). Jedes normale Foto wird davon
 *  beschnitten. Statt für jede Aufteilung ein eigenes Bild zu verlangen,
 *  bestimmt der Admin einmal den Punkt, der sichtbar bleiben muss.
 *
 *  Umgesetzt mit `object-fit: cover` + `object-position` statt mit einem
 *  background-image: nur so lässt sich der Ausschnitt verschieben UND darüber
 *  hinaus zoomen. `background-size: cover` kennt keinen Zoom-Faktor — man
 *  müsste auf Prozentwerte ausweichen, die dann nur eine Achse treffen.
 *
 *  Verlustfrei: skaliert wird ausschließlich bei der Anzeige, die Datei bleibt
 *  wie hochgeladen. `transform-origin` liegt auf demselben Punkt wie
 *  `object-position`, damit der gewählte Bildpunkt beim Zoomen stehen bleibt
 *  statt aus dem Bild zu wandern.
 */
export function AusschnittBild({
  url,
  ausschnitt,
  className = '',
  alt = '',
}: {
  url: string;
  ausschnitt: Ausschnitt;
  className?: string;
  alt?: string;
}) {
  const pos = `${ausschnitt.x}% ${ausschnitt.y}%`;
  return (
    <img
      src={url}
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
      draggable={false}
      className={`w-full h-full ${className}`}
      style={{
        objectFit: 'cover',
        objectPosition: pos,
        ...(ausschnitt.zoom > 1
          ? { transform: `scale(${ausschnitt.zoom})`, transformOrigin: pos }
          : {}),
      }}
    />
  );
}
