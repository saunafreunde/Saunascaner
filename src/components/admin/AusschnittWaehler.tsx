import { useState } from 'react';
import { AusschnittBild } from '@/components/AusschnittBild';
import { AUSSCHNITT_DEFAULT, type Ausschnitt } from '@/types/branding';

/** Die vier möglichen Kachel-Formate der TV-Tafel.
 *
 *  Nicht geschätzt, sondern am 08.08.2026 auf der laufenden Tafel gemessen
 *  (Viewport 1920×1080, Sauna-Kopf 103 px, Grid-Innenabstand 8 px, Zeilen-
 *  abstand 8 px). Auf einem 4K-Gerät verdoppeln sich die Pixel, die
 *  Verhältnisse bleiben — deshalb steht hier das Verhältnis im Vordergrund.
 */
export const KACHEL_FORMATE = [
  { id: '2x3', label: '2 Saunen · 3 Aufgüsse', px: '920×301', v: 920 / 301 },
  { id: '2x4', label: '2 Saunen · 4 Aufgüsse', px: '920×224', v: 920 / 224 },
  { id: '3x3', label: '3 Saunen · 3 Aufgüsse', px: '603×301', v: 603 / 301 },
  { id: '3x4', label: '3 Saunen · 4 Aufgüsse', px: '603×224', v: 603 / 224 },
  // Keine Tafel-Kachel, sondern der ganze Bildschirm des Öl-Raum-Tablets.
  // `aktivesFormat` liefert diese id nie — sie wird nur dort ausdrücklich
  // übergeben, wo ein Vollbild und keine Kachel gemeint ist.
  { id: 'tablet', label: 'Öl-Raum-Tablet (Vollbild)', px: '1280×800', v: 1280 / 800 },
] as const;

export function aktivesFormat(saunen: number, kacheln: number): string {
  return `${saunen >= 3 ? 3 : 2}x${kacheln >= 4 ? 4 : 3}`;
}

/** Welcher Teil des Bildes bleibt bei `object-fit: cover` sichtbar?
 *
 *  Rückgabe in Anteilen des Originalbildes (0–1), passend als CSS-Prozente
 *  für den Rahmen in der Ganzbild-Ansicht. Die Formel ist die Umkehrung
 *  dessen, was der Browser bei cover + object-position rechnet: die
 *  überstehende Länge wird im Verhältnis der Position verteilt.
 */
function sichtbar(bildV: number, boxV: number, a: Ausschnitt) {
  let fw = 1, fh = 1;
  if (bildV > boxV) fw = boxV / bildV;   // Bild breiter als die Kachel → Seiten fallen weg
  else fh = bildV / boxV;                 // Bild höher → oben und unten fällt weg
  fw = Math.min(1, fw / a.zoom);
  fh = Math.min(1, fh / a.zoom);
  return {
    breite: fw * 100,
    hoehe: fh * 100,
    links: (a.x / 100) * (1 - fw) * 100,
    oben: (a.y / 100) * (1 - fh) * 100,
  };
}

export function AusschnittWaehler({
  url,
  wert,
  onChange,
  aktiv,
}: {
  url: string;
  wert: Ausschnitt;
  onChange: (a: Ausschnitt) => void;
  /** id aus KACHEL_FORMATE — das Format, das die Tafel gerade zeigt. */
  aktiv: string;
}) {
  const [offen, setOffen] = useState(false);
  const [bildV, setBildV] = useState<number | null>(null);
  const format = KACHEL_FORMATE.find((f) => f.id === aktiv) ?? KACHEL_FORMATE[0];

  function klick(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 100);
    const y = Math.round(((e.clientY - r.top) / r.height) * 100);
    onChange({ ...wert, x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  }

  const zoomen = (d: number) =>
    onChange({ ...wert, zoom: Math.round(Math.min(3, Math.max(1, wert.zoom + d)) * 10) / 10 });

  const geaendert =
    wert.x !== AUSSCHNITT_DEFAULT.x || wert.y !== AUSSCHNITT_DEFAULT.y || wert.zoom !== AUSSCHNITT_DEFAULT.zoom;
  const rahmen = bildV ? sichtbar(bildV, format.v, wert) : null;

  return (
    <div className="rounded-lg bg-forest-950/40 ring-1 ring-forest-800/40 p-2">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-[11px] text-forest-200"
      >
        <span className="font-semibold">
          ✂️ Ausschnitt {geaendert
            ? <span className="text-amber-300">· angepasst</span>
            : <span className="text-forest-400/70">· Bildmitte</span>}
        </span>
        <span className="text-forest-400">{offen ? '▲' : '▼'}</span>
      </button>

      {offen && (
        <div className="mt-2 space-y-2">
          <p className="text-[10px] text-forest-400/80 leading-snug">
            Klick ins Bild bestimmt, was in der Kachel sichtbar bleibt. Der Rahmen zeigt
            den Ausschnitt für <strong>{format.label}</strong> ({format.px} px).
          </p>

          {/* Ganzbild mit Fokus-Marker. Das img bestimmt die Höhe, das Overlay
              liegt deckungsgleich darüber — dadurch sind Klick-Prozente und
              Bild-Prozente identisch, ohne Umrechnung. */}
          <div className="relative cursor-crosshair select-none" onClick={klick}>
            <img
              src={url}
              alt=""
              draggable={false}
              className="block w-full rounded"
              onLoad={(e) => {
                const el = e.currentTarget;
                if (el.naturalWidth && el.naturalHeight) setBildV(el.naturalWidth / el.naturalHeight);
              }}
            />
            <div aria-hidden className="absolute inset-0 bg-forest-950/45 rounded" />
            {rahmen && (
              <div
                aria-hidden
                className="absolute ring-2 ring-amber-400 rounded-sm"
                style={{
                  left: `${rahmen.links}%`, top: `${rahmen.oben}%`,
                  width: `${rahmen.breite}%`, height: `${rahmen.hoehe}%`,
                  // Das Bild liegt unter einem dunklen Schleier; dieser Rahmen
                  // hellt NUR seinen eigenen Bereich wieder auf. Dadurch ist
                  // ohne zweite Bildkopie zu sehen, was in der Kachel landet.
                  backdropFilter: 'brightness(1.9)',
                }}
              />
            )}
            <div
              aria-hidden
              className="absolute h-3 w-3 rounded-full bg-amber-400 ring-2 ring-forest-950 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${wert.x}%`, top: `${wert.y}%` }}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-forest-400">Größe</span>
            <button
              type="button" onClick={() => zoomen(-0.1)} disabled={wert.zoom <= 1}
              className="h-6 w-7 rounded bg-forest-900 text-forest-100 ring-1 ring-forest-700/60 disabled:opacity-40"
            >−</button>
            <span className="text-[11px] tabular-nums text-forest-200 w-10 text-center">
              {Math.round(wert.zoom * 100)}%
            </span>
            <button
              type="button" onClick={() => zoomen(0.1)} disabled={wert.zoom >= 3}
              className="h-6 w-7 rounded bg-forest-900 text-forest-100 ring-1 ring-forest-700/60 disabled:opacity-40"
            >+</button>
            {geaendert && (
              <button
                type="button"
                onClick={() => onChange({ ...AUSSCHNITT_DEFAULT })}
                className="ml-auto text-[10px] text-forest-300 underline hover:text-forest-100"
              >
                zurücksetzen
              </button>
            )}
          </div>

          {/* Ergebnis in allen vier Aufteilungen — so sieht man sofort, was
              beim Umstellen der Tafel passiert, ohne sie umzustellen. */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {KACHEL_FORMATE.map((f) => (
              <div key={f.id}>
                <div
                  className={`overflow-hidden rounded ring-1 ${
                    f.id === aktiv ? 'ring-amber-400' : 'ring-forest-800/60'
                  }`}
                  style={{ aspectRatio: `${f.v}` }}
                >
                  <AusschnittBild url={url} ausschnitt={wert} />
                </div>
                <p className={`mt-0.5 text-[9px] leading-tight ${
                  f.id === aktiv ? 'text-amber-300' : 'text-forest-400/70'
                }`}>
                  {f.label}{f.id === aktiv && ' · aktiv'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
