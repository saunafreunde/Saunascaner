/** Schwarzwald-Fenster — eine Karte im Slot-Karussell leerer Tafel-Kacheln.
 *
 *  Der Blick aus der warmen Sauna nach draußen: Dämmerungshimmel, Mond,
 *  drei Ebenen Tannen-Silhouetten die unterschiedlich schnell ziehen
 *  (Parallaxe), Nebelbänke, langsam fallender Schnee — und am Rand der warme
 *  Schein des Innenraums, damit man merkt, dass man drinnen sitzt.
 *
 *  Bewusst sparsam gebaut: die alte Riff-Szene hatte ~94 Endlos-Animationen
 *  pro Kachel, hier sind es 18. Alles Pure-CSS und ausschließlich transform
 *  bzw. opacity — die Tafel läuft 24/7 auf einem Fernseher.
 *
 *  Die Silhouetten sind deterministisch aus einer Formel erzeugt (kein
 *  Math.random), damit jede Kachel identisch rendert und nichts bei einem
 *  Re-Render springt.
 */

/** Ein Tannen-Band als SVG-Pfad. `seed` verschiebt die Baumhöhen, damit die
 *  drei Ebenen unterschiedlich aussehen, ohne Zufall zu brauchen. */
function firBand(seed: number, count: number): string {
  const W = 1200;
  const step = W / count;
  let d = `M0,300 `;
  for (let i = 0; i < count; i++) {
    const x = i * step;
    // deterministische Pseudo-Variation
    const h = 120 + ((i * 37 + seed * 53) % 90);
    const w = step * 0.62;
    d += `L${x + step * 0.19},300 L${x + step * 0.5},${300 - h} L${x + step * 0.19 + w},300 `;
  }
  return d + `L${W},300 L${W},320 L0,320 Z`;
}

const SNOW = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: (i * 7.3) % 100,
  delay: (i * 1.7) % 12,
  dur: 14 + ((i * 3) % 9),
  size: 2 + (i % 3),
}));

export function ForestWindow() {
  return (
    <div className="fw" aria-hidden>
      {/* Himmel + Mond */}
      <div className="fw-sky" />
      <div className="fw-moon" />

      {/* Nebelbänke — zwei, gegenläufig, sehr langsam */}
      <div className="fw-fog fw-fog-1" />
      <div className="fw-fog fw-fog-2" />

      {/* Drei Tannen-Ebenen. Hinten hell und langsam, vorne dunkel und
          schneller — das erzeugt die Tiefe. */}
      <svg className="fw-trees fw-trees-3" viewBox="0 0 1200 320" preserveAspectRatio="none">
        <path d={firBand(2, 16)} />
      </svg>
      <svg className="fw-trees fw-trees-2" viewBox="0 0 1200 320" preserveAspectRatio="none">
        <path d={firBand(5, 12)} />
      </svg>
      <svg className="fw-trees fw-trees-1" viewBox="0 0 1200 320" preserveAspectRatio="none">
        <path d={firBand(9, 8)} />
      </svg>

      {/* Schnee */}
      {SNOW.map((s) => (
        <span
          key={s.id}
          className="fw-snow"
          style={{
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animationDuration: `${s.dur}s`,
            animationDelay: `-${s.delay}s`,
          }}
        />
      ))}

      {/* Fensterkreuz + Rahmen: wir schauen aus dem Warmen hinaus */}
      <div className="fw-mullion-v" />
      <div className="fw-mullion-h" />
      <div className="fw-frame" />
      {/* Warmer Innenschein am Rand */}
      <div className="fw-glow" />
    </div>
  );
}
