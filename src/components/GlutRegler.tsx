import { useState } from 'react';

// Der Glut-Regler — Bewertung mit einem Zug statt mit fünf Kästchen.
//
// Fünf gleich aussehende Zahlenknöpfe sagen nichts darüber, was zwischen
// einer 2 und einer 4 liegt: man liest Ziffern und tippt eine an. Ein Regler
// zeigt die Skala selbst — man sieht sofort, wo man landet, und kann sich
// mit dem Daumen herantasten, ohne loszulassen.
//
// Die Optik ist die Glut im Ofen: bei 1 kalte Asche, bei 5 helles Gold.
// Nicht rot bei 5 — auf dem Tablet läuft daneben der Fristbalken nach Rot,
// und rot heißt dort „Zeit vorbei". Statt der Farbe steigt die Leuchtkraft.
//
// Bedient wird ein echtes <input type="range">, unsichtbar über der Optik.
// Damit kommen Ziehen, Tippen, Pfeiltasten und Screenreader vom Browser.
// Das CSS dazu steht in index.css unter „Glut-Regler (glut-*)".

const STUFEN = [
  { wort: 'naja',          von: '#46403c', bis: '#6b625b', schein: 0 },
  { wort: 'ganz ok',       von: '#7a5715', bis: '#b3801f', schein: 0.2 },
  { wort: 'gut',           von: '#ad7a0d', bis: '#e0b125', schein: 0.4 },
  { wort: 'richtig stark', von: '#d76d0c', bis: '#f8b23c', schein: 0.65 },
  { wort: 'Weltklasse',    von: '#f2610a', bis: '#ffd873', schein: 1 },
] as const;

// Solange nichts gewählt ist, bleibt die Bahn kalt. Die Werte werden immer
// gesetzt und nie weggelassen: eine leere Custom-Property macht jede Regel
// ungültig, die sie benutzt — dann verschwindet die halbe Bahn.
const KALT = { von: '#3f3a37', bis: '#57514c', schein: 0 } as const;

function stufeZu(note: number) {
  return STUFEN[Math.min(4, Math.max(0, Math.round(note) - 1))];
}

/** Kurz spüren, dass die Stufe eingerastet ist. Auf iOS gibt es das nicht —
 *  dort passiert schlicht nichts, das ist kein Fehler. */
function tickern() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(6);
  }
}

export function GlutRegler({
  label,
  hinweis,
  emoji,
  wert,
  onChange,
  gross = false,
}: {
  label: string;
  hinweis?: string;
  emoji?: string;
  wert: number | null;
  onChange: (n: number) => void;
  gross?: boolean;
}) {
  // Neuer Schlüssel = der Puls-Ring startet neu. Ohne key liefe die
  // CSS-Animation nur ein einziges Mal, beim allerersten Wert.
  const [pulsKey, setPulsKey] = useState(0);

  const stufe = wert ? STUFEN[wert - 1] : null;
  const farbe = stufe ?? KALT;
  // Ohne Wert steht der Regler in der Mitte, der Daumen ist aber unsichtbar:
  // wer von hier aus zieht, hat es in beide Richtungen gleich weit.
  const pos = ((wert ?? 3) - 1) / 4;

  function setzen(n: number) {
    if (n === wert) return;
    setPulsKey((k) => k + 1);
    tickern();
    onChange(n);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 flex items-baseline gap-1.5">
          {emoji && <span className="shrink-0">{emoji}</span>}
          <span className={`font-semibold text-forest-100 ${gross ? 'text-base' : 'text-sm'}`}>
            {label}
          </span>
        </span>
        {/* Das Wort ist die eigentliche Rückmeldung — die Ziffer im Daumen
            allein sagt einem nicht, ob eine 4 gut oder mittelmäßig ist. */}
        <span
          className={`shrink-0 ${gross ? 'text-sm' : 'text-xs'} ${
            stufe ? 'font-semibold text-amber-300' : 'text-forest-500'
          }`}
        >
          {stufe ? stufe.wort : 'noch offen'}
        </span>
      </div>

      {/* Steht immer da, auch ohne Wert — sonst springen beim ersten Zug
          alle sechs Regler eine Zeile nach unten. */}
      {hinweis && (
        <p className={`text-forest-500 truncate ${gross ? 'text-xs' : 'text-[11px]'}`}>{hinweis}</p>
      )}

      <div
        className={`glut-bahn mt-2 ${gross ? 'glut-bahn-gross' : ''}`}
        style={{
          ['--glut-pos' as string]: String(pos),
          ['--glut-von' as string]: farbe.von,
          ['--glut-bis' as string]: farbe.bis,
          ['--glut-schein' as string]: String(farbe.schein),
        }}
      >
        {wert !== null && <div className="glut-fuellung" />}

        <div className="glut-spur">
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className={`glut-marke ${wert !== null && n <= wert ? 'glut-marke-erreicht' : ''}`}
              style={{ left: `${((n - 1) / 4) * 100}%` }}
            />
          ))}

          {wert !== null && (
            <div className={`glut-daumen ${gross ? 'text-xl' : 'text-lg'}`}>
              {wert}
              <span key={pulsKey} className="glut-puls" />
            </div>
          )}
        </div>

        {wert === null && <span className="glut-leer">ziehen oder antippen</span>}

        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={wert ?? 3}
          onChange={(e) => setzen(Number(e.target.value))}
          // Ohne Wert steht der Regler auf 3. Tippt jemand genau auf die 3,
          // ändert sich nichts und onChange bleibt stumm — der Regler wirkte
          // dann kaputt. Der Klick holt den Wert deshalb selbst ab.
          onClick={(e) => {
            if (wert === null) setzen(Number((e.target as HTMLInputElement).value));
          }}
          aria-label={label}
          aria-valuetext={stufe ? `${wert} von 5 — ${stufe.wort}` : 'noch nicht bewertet'}
          className="glut-input"
        />
      </div>
    </div>
  );
}

/** Zeigt, was unterm Strich herauskommt — erst wenn alle sechs Regler
 *  stehen. Ein Schnitt aus drei Angaben wäre eine Falschaussage. */
export function GlutFazit({ noten, gross = false }: { noten: number[]; gross?: boolean }) {
  if (noten.length === 0) return null;
  const schnitt = noten.reduce((a, b) => a + b, 0) / noten.length;
  const stufe = stufeZu(schnitt);

  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3 ring-1 ring-amber-500/25"
      style={{ background: `linear-gradient(90deg, ${stufe.von}33, ${stufe.bis}14)` }}
    >
      <span className={`text-forest-300 ${gross ? 'text-sm' : 'text-xs'}`}>Dein Schnitt</span>
      <span className="flex items-baseline gap-2">
        <span className={`font-bold text-amber-300 ${gross ? 'text-sm' : 'text-xs'}`}>
          {stufe.wort}
        </span>
        <span className={`font-black tabular-nums text-amber-200 ${gross ? 'text-2xl' : 'text-xl'}`}>
          {schnitt.toFixed(1).replace('.', ',')}
        </span>
      </span>
    </div>
  );
}
