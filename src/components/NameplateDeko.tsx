// Animierte Jahreszeiten-Grafiken fuer das Namensschild (siehe lib/nameplates.ts).
//
// Liegt als absolut positionierte Ebene UEBER dem Schild und darf bewusst
// ueber dessen Kanten hinausragen — der User wollte ausdruecklich, dass die
// Animation die Zeilenhoehe verlassen darf. pointer-events sind aus, die
// Tafel ist ohnehin nicht bedienbar.
//
// Alles Pure-CSS (@keyframes, nur transform/opacity), kein JS-Timer: die
// Tafel laeuft 24/7. Das zugehoerige CSS steht in src/index.css unter den
// np-*-Prefixen, inklusive prefers-reduced-motion-Abschaltung.
//
// WICHTIG: Diese Ebene liegt AUSSERHALB des Wrappers, der bei den geclippten
// Rahmenformen den drop-shadow-Filter traegt. Ein Filter rastert seinen
// Inhalt bei jedem Frame neu — animierte Kinder darin waeren auf einem
// Dauerlaeufer-Geraet genau die Art Last, die hier vermieden werden soll.

export type DekoId =
  | 'weihnachten'
  | 'winter-schnee'
  | 'herbst-blaetter'
  | 'fruehling-blueten-zweig'
  | 'sommer-sonnenrad';

export function NameplateDeko({ deko }: { deko: DekoId | null }) {
  if (!deko) return null;
  return (
    <span aria-hidden className="np-deko" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
      {deko === 'weihnachten' && (
        <>
          <div className="np-weihnachten-wrap" aria-hidden="true">
            {/* Figur sitzt AUF der oberen Kante (bottom:100% + negativer Rand) und darf
                nach oben herausragen. Nur EIN bewegtes Teil: das ganze Wrapper-Div wippt. */}
            <div className="np-weihnachten-mann">
              <svg className="np-weihnachten-mann-svg" viewBox="0 0 44 52" focusable="false">
                {/* Beine + Stiefel — baumeln ueber die Schildkante */}
                <rect x="14" y="31" width="6.4" height="12" rx="3" fill="#c62828" />
                <rect x="23.6" y="31" width="6.4" height="12" rx="3" fill="#c62828" />
                <rect x="12.6" y="41.4" width="9" height="6.2" rx="2.6" fill="#332f2c" />
                <rect x="22.4" y="41.4" width="9" height="6.2" rx="2.6" fill="#332f2c" />
                {/* Mantel */}
                <path d="M13.2 21.5c5.6-3.4 12-3.4 17.6 0l1.8 12.2c-7 2.6-14.2 2.6-21.2 0z" fill="#c62828" />
                {/* Arme: links stuetzt er sich ab, rechts hat er gerade geworfen */}
                <path d="M14.2 22.6c-3.4 1.6-5.2 4.2-5.4 7.2" stroke="#c62828" strokeWidth="4.6" strokeLinecap="round" fill="none" />
                <path d="M29.8 22.6c4 .2 6.4-2.4 6.6-6" stroke="#c62828" strokeWidth="4.6" strokeLinecap="round" fill="none" />
                <circle cx="8.4" cy="30.4" r="2.6" fill="#f4f6f8" />
                <circle cx="36.4" cy="15.2" r="2.6" fill="#f4f6f8" />
                {/* Guertel, Schnalle, Fellsaum */}
                <rect x="10.8" y="27.6" width="22.4" height="4" rx="1.2" fill="#332f2c" />
                <rect x="19.4" y="26.8" width="5.2" height="5.6" rx="1.4" fill="#ffd76a" />
                <rect x="10.6" y="31.6" width="22.8" height="3.6" rx="1.8" fill="#f4f6f8" />
                {/* Kopf */}
                <circle cx="22" cy="13.4" r="6.8" fill="#f0c49c" />
                <circle cx="19.4" cy="12.4" r=".9" fill="#332f2c" />
                <circle cx="24.6" cy="12.4" r=".9" fill="#332f2c" />
                {/* Bart, Schnauzer, Nase */}
                <path d="M15.4 13.6c.2 7.4 3 10.8 6.6 10.8s6.4-3.4 6.6-10.8c-1.6 3.4-4 4.6-6.6 4.6s-5-1.2-6.6-4.6z" fill="#f4f6f8" />
                <path d="M18 15.4c1.4.6 2.6.9 4 .9s2.6-.3 4-.9c-.4 2-1.8 3-4 3s-3.6-1-4-3z" fill="#e6eaee" />
                <circle cx="22" cy="15.4" r="1.5" fill="#e2a07a" />
                {/* Zipfelmuetze mit Bommel */}
                <path d="M15.8 7.2C16.6 1.6 24.4-.6 29.6 3.2l1.2 4z" fill="#c62828" />
                <rect x="14.6" y="6.6" width="14.8" height="3.6" rx="1.8" fill="#f4f6f8" />
                <circle cx="31.4" cy="4.4" r="2.4" fill="#f4f6f8" />
              </svg>
            </div>
          
            {/* Fuenf Fallbahnen. Jede Bahn ist so hoch wie das Schild — deshalb ist der
                Fallweg in % (skaliert mit der Schildhoehe), die Paketgroesse in em
                (skaliert mit der Schrift). Die Bahnen liegen bewusst an den Raendern,
                die Mitte (38–66 %) bleibt frei fuer Name und Spruch. */}
            <span className="np-weihnachten-bahn np-weihnachten-b1">
              <svg className="np-weihnachten-paket" viewBox="0 0 12 12" focusable="false">
                <rect x="1" y="4.6" width="10" height="6.8" rx=".8" fill="currentColor" />
                <rect x=".6" y="3.6" width="10.8" height="2" rx=".6" fill="#ffffff" opacity=".22" />
                <rect x="5.1" y="3.6" width="1.8" height="7.8" fill="#ffd76a" />
                <path d="M6 4C4.7 2.1 2.5 1.9 2.7 3.3 2.9 4.3 4.8 4.2 6 4z" fill="#ffd76a" />
                <path d="M6 4c1.3-1.9 3.5-2.1 3.3-.7-.2 1-2.1.9-3.3.7z" fill="#ffd76a" />
              </svg>
            </span>
            <span className="np-weihnachten-bahn np-weihnachten-b2">
              <svg className="np-weihnachten-paket" viewBox="0 0 12 12" focusable="false">
                <rect x="1" y="4.6" width="10" height="6.8" rx=".8" fill="currentColor" />
                <rect x=".6" y="3.6" width="10.8" height="2" rx=".6" fill="#ffffff" opacity=".22" />
                <rect x="5.1" y="3.6" width="1.8" height="7.8" fill="#ffd76a" />
                <path d="M6 4C4.7 2.1 2.5 1.9 2.7 3.3 2.9 4.3 4.8 4.2 6 4z" fill="#ffd76a" />
                <path d="M6 4c1.3-1.9 3.5-2.1 3.3-.7-.2 1-2.1.9-3.3.7z" fill="#ffd76a" />
              </svg>
            </span>
            <span className="np-weihnachten-bahn np-weihnachten-b3">
              <svg className="np-weihnachten-paket" viewBox="0 0 12 12" focusable="false">
                <rect x="1" y="4.6" width="10" height="6.8" rx=".8" fill="currentColor" />
                <rect x=".6" y="3.6" width="10.8" height="2" rx=".6" fill="#ffffff" opacity=".22" />
                <rect x="5.1" y="3.6" width="1.8" height="7.8" fill="#ffd76a" />
                <path d="M6 4C4.7 2.1 2.5 1.9 2.7 3.3 2.9 4.3 4.8 4.2 6 4z" fill="#ffd76a" />
                <path d="M6 4c1.3-1.9 3.5-2.1 3.3-.7-.2 1-2.1.9-3.3.7z" fill="#ffd76a" />
              </svg>
            </span>
            <span className="np-weihnachten-bahn np-weihnachten-b4">
              <svg className="np-weihnachten-paket" viewBox="0 0 12 12" focusable="false">
                <rect x="1" y="4.6" width="10" height="6.8" rx=".8" fill="currentColor" />
                <rect x=".6" y="3.6" width="10.8" height="2" rx=".6" fill="#ffffff" opacity=".22" />
                <rect x="5.1" y="3.6" width="1.8" height="7.8" fill="#ffd76a" />
                <path d="M6 4C4.7 2.1 2.5 1.9 2.7 3.3 2.9 4.3 4.8 4.2 6 4z" fill="#ffd76a" />
                <path d="M6 4c1.3-1.9 3.5-2.1 3.3-.7-.2 1-2.1.9-3.3.7z" fill="#ffd76a" />
              </svg>
            </span>
            <span className="np-weihnachten-bahn np-weihnachten-b5">
              <svg className="np-weihnachten-paket" viewBox="0 0 12 12" focusable="false">
                <rect x="1" y="4.6" width="10" height="6.8" rx=".8" fill="currentColor" />
                <rect x=".6" y="3.6" width="10.8" height="2" rx=".6" fill="#ffffff" opacity=".22" />
                <rect x="5.1" y="3.6" width="1.8" height="7.8" fill="#ffd76a" />
                <path d="M6 4C4.7 2.1 2.5 1.9 2.7 3.3 2.9 4.3 4.8 4.2 6 4z" fill="#ffd76a" />
                <path d="M6 4c1.3-1.9 3.5-2.1 3.3-.7-.2 1-2.1.9-3.3.7z" fill="#ffd76a" />
              </svg>
            </span>
          </div>
        </>
      )}
      {deko === 'winter-schnee' && (
        <>
          <div className="np-schnee-wrap" aria-hidden="true">
            {/* Schneekante auf der Oberkante — statisch, keine Animation, kein Repaint */}
            <svg className="np-schnee-kante" viewBox="0 0 200 26" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path
                className="np-schnee-kante-schatten"
                transform="translate(0 1.6)"
                d="M0,18 L0,13.4 C 8,7.6 18,8.4 28,11.2 C 40,14.6 48,6.8 60,7.4 C 72,8 80,13.4 92,12.4 C 106,11.2 114,5.4 128,6.6 C 140,7.7 148,12.4 160,11.4 C 172,10.4 180,7.4 190,9.2 C 195,10.1 198,11.4 200,12.8 L200,18 C 193,18 191,25 185,25 C 179,25 177,18 171,18 L 118,18 C 112,18 110,26 104,26 C 98,26 96,18 90,18 L 44,18 C 38,18 36,23.5 31,23.5 C 26,23.5 24,18 18,18 Z"
              />
              <path
                className="np-schnee-kante-weiss"
                d="M0,18 L0,13.4 C 8,7.6 18,8.4 28,11.2 C 40,14.6 48,6.8 60,7.4 C 72,8 80,13.4 92,12.4 C 106,11.2 114,5.4 128,6.6 C 140,7.7 148,12.4 160,11.4 C 172,10.4 180,7.4 190,9.2 C 195,10.1 198,11.4 200,12.8 L200,18 C 193,18 191,25 185,25 C 179,25 177,18 171,18 L 118,18 C 112,18 110,26 104,26 C 98,26 96,18 90,18 L 44,18 C 38,18 36,23.5 31,23.5 C 26,23.5 24,18 18,18 Z"
              />
            </svg>
          
            {/* zwei Eisfunkeln auf der Kante — nur opacity/transform */}
            <span className="np-schnee-funke np-schnee-funke--1" />
            <span className="np-schnee-funke np-schnee-funke--2" />
          
            {/* fuenf fallende Flocken, jede in ihrer eigenen Bahn (nur die Bahn bewegt sich) */}
            <span className="np-schnee-bahn np-schnee-bahn--1">
              <span className="np-schnee-flocke np-schnee-flocke--k1">
                <svg className="np-schnee-kristall" viewBox="-10 -10 20 20" aria-hidden="true" focusable="false">
                  <path d="M0,-9V9M0,-5.6l-2.3,-2.1M0,-5.6l2.3,-2.1M0,5.6l-2.3,2.1M0,5.6l2.3,2.1" />
                  <path transform="rotate(60)" d="M0,-9V9M0,-5.6l-2.3,-2.1M0,-5.6l2.3,-2.1M0,5.6l-2.3,2.1M0,5.6l2.3,2.1" />
                  <path transform="rotate(120)" d="M0,-9V9M0,-5.6l-2.3,-2.1M0,-5.6l2.3,-2.1M0,5.6l-2.3,2.1M0,5.6l2.3,2.1" />
                </svg>
              </span>
            </span>
          
            <span className="np-schnee-bahn np-schnee-bahn--2">
              <span className="np-schnee-flocke np-schnee-flocke--punkt1" />
            </span>
          
            <span className="np-schnee-bahn np-schnee-bahn--3">
              <span className="np-schnee-flocke np-schnee-flocke--k2">
                <svg className="np-schnee-kristall" viewBox="-10 -10 20 20" aria-hidden="true" focusable="false">
                  <path d="M0,-9V9M0,-5.6l-2.3,-2.1M0,-5.6l2.3,-2.1M0,5.6l-2.3,2.1M0,5.6l2.3,2.1" />
                  <path transform="rotate(60)" d="M0,-9V9M0,-5.6l-2.3,-2.1M0,-5.6l2.3,-2.1M0,5.6l-2.3,2.1M0,5.6l2.3,2.1" />
                  <path transform="rotate(120)" d="M0,-9V9M0,-5.6l-2.3,-2.1M0,-5.6l2.3,-2.1M0,5.6l-2.3,2.1M0,5.6l2.3,2.1" />
                </svg>
              </span>
            </span>
          
            <span className="np-schnee-bahn np-schnee-bahn--4">
              <span className="np-schnee-flocke np-schnee-flocke--punkt2" />
            </span>
          
            <span className="np-schnee-bahn np-schnee-bahn--5">
              <span className="np-schnee-flocke np-schnee-flocke--k3">
                <svg className="np-schnee-kristall" viewBox="-10 -10 20 20" aria-hidden="true" focusable="false">
                  <path d="M0,-9V9M0,-5.6l-2.3,-2.1M0,-5.6l2.3,-2.1M0,5.6l-2.3,2.1M0,5.6l2.3,2.1" />
                  <path transform="rotate(60)" d="M0,-9V9M0,-5.6l-2.3,-2.1M0,-5.6l2.3,-2.1M0,5.6l-2.3,2.1M0,5.6l2.3,2.1" />
                  <path transform="rotate(120)" d="M0,-9V9M0,-5.6l-2.3,-2.1M0,-5.6l2.3,-2.1M0,5.6l-2.3,2.1M0,5.6l2.3,2.1" />
                </svg>
              </span>
            </span>
          </div>
        </>
      )}
      {deko === 'herbst-blaetter' && (
        <>
          <div className="np-herbst-wrap" aria-hidden="true">
            <span className="np-herbst-wash" />
          
            {/* fallende Blaetter — bewusst in den aeusseren Dritteln, nie ueber der Textmitte */}
            <span className="np-herbst-blatt np-herbst-b1">
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M50 4 L58 26 L71 17 L68 37 L88 31 L77 47 L95 54 L74 59 L84 76 L64 71 L66 86 L53 75 L53 97 L47 97 L47 75 L34 86 L36 71 L16 76 L26 59 L5 54 L23 47 L12 31 L32 37 L29 17 L42 26 Z" />
              </svg>
            </span>
          
            <span className="np-herbst-blatt np-herbst-b2">
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M50 5 C56 11 57 17 55 22 C61 18 68 20 69 27 C64 32 58 31 55 28 C58 34 58 41 56 46 C63 43 70 47 70 54 C64 59 58 57 55 53 C57 60 56 67 53 73 C60 72 66 77 65 84 C58 87 52 83 50 77 C48 83 42 87 35 84 C34 77 40 72 47 73 C44 67 43 60 45 53 C42 57 36 59 30 54 C30 47 37 43 44 46 C42 41 42 34 45 28 C42 31 36 32 31 27 C32 20 39 18 45 22 C43 17 44 11 50 5 Z" />
                <path fill="currentColor" d="M48.8 72 L51.2 72 L50.6 99 L49.4 99 Z" />
              </svg>
            </span>
          
            <span className="np-herbst-blatt np-herbst-b3">
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M50 4 L58 26 L71 17 L68 37 L88 31 L77 47 L95 54 L74 59 L84 76 L64 71 L66 86 L53 75 L53 97 L47 97 L47 75 L34 86 L36 71 L16 76 L26 59 L5 54 L23 47 L12 31 L32 37 L29 17 L42 26 Z" />
              </svg>
            </span>
          
            <span className="np-herbst-blatt np-herbst-b4">
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M50 5 C56 11 57 17 55 22 C61 18 68 20 69 27 C64 32 58 31 55 28 C58 34 58 41 56 46 C63 43 70 47 70 54 C64 59 58 57 55 53 C57 60 56 67 53 73 C60 72 66 77 65 84 C58 87 52 83 50 77 C48 83 42 87 35 84 C34 77 40 72 47 73 C44 67 43 60 45 53 C42 57 36 59 30 54 C30 47 37 43 44 46 C42 41 42 34 45 28 C42 31 36 32 31 27 C32 20 39 18 45 22 C43 17 44 11 50 5 Z" />
                <path fill="currentColor" d="M48.8 72 L51.2 72 L50.6 99 L49.4 99 Z" />
              </svg>
            </span>
          
            {/* zwei liegengebliebene Blaetter an den Ecken, wippen nur leicht */}
            <span className="np-herbst-ruhe np-herbst-r1">
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M50 5 C56 11 57 17 55 22 C61 18 68 20 69 27 C64 32 58 31 55 28 C58 34 58 41 56 46 C63 43 70 47 70 54 C64 59 58 57 55 53 C57 60 56 67 53 73 C60 72 66 77 65 84 C58 87 52 83 50 77 C48 83 42 87 35 84 C34 77 40 72 47 73 C44 67 43 60 45 53 C42 57 36 59 30 54 C30 47 37 43 44 46 C42 41 42 34 45 28 C42 31 36 32 31 27 C32 20 39 18 45 22 C43 17 44 11 50 5 Z" />
                <path fill="currentColor" d="M48.8 72 L51.2 72 L50.6 99 L49.4 99 Z" />
              </svg>
            </span>
          
            <span className="np-herbst-ruhe np-herbst-r2">
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M50 4 L58 26 L71 17 L68 37 L88 31 L77 47 L95 54 L74 59 L84 76 L64 71 L66 86 L53 75 L53 97 L47 97 L47 75 L34 86 L36 71 L16 76 L26 59 L5 54 L23 47 L12 31 L32 37 L29 17 L42 26 Z" />
              </svg>
            </span>
          </div>
        </>
      )}
      {deko === 'fruehling-blueten-zweig' && (
        <>
          <div className="np-fruehling-layer" aria-hidden="true">
            <div className="np-fruehling-zweig">
              <svg className="np-fruehling-zweig-svg" viewBox="0 0 120 70" fill="none" focusable="false" aria-hidden="true">
                <path
                  d="M1 5 C 24 13, 50 11, 74 24 C 90 33, 102 39, 118 41"
                  stroke="#b08d72"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <path d="M28 11 C 32 4, 39 1, 45 2" stroke="#b08d72" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M60 17 C 64 25, 69 29, 75 31" stroke="#b08d72" strokeWidth="1.5" strokeLinecap="round" />
                <ellipse cx="15" cy="12" rx="5.2" ry="2.6" fill="#cfe3c8" opacity="0.7" transform="rotate(-22 15 12)" />
                <ellipse cx="52" cy="18" rx="4.6" ry="2.3" fill="#cfe3c8" opacity="0.6" transform="rotate(16 52 18)" />
                <circle cx="45" cy="2" r="3.1" fill="#f7c6da" opacity="0.9" className="np-fruehling-knospe np-fruehling-knospe--a" />
                <circle cx="75" cy="31" r="2.6" fill="#fbd8e4" opacity="0.85" />
                <circle cx="118" cy="41" r="3.4" fill="#f7c6da" opacity="0.9" className="np-fruehling-knospe np-fruehling-knospe--b" />
                <circle cx="34" cy="10" r="1.7" fill="#fbe2ec" opacity="0.8" />
                <circle cx="97" cy="36" r="1.9" fill="#fbe2ec" opacity="0.75" />
              </svg>
            </div>
          
            <span className="np-fruehling-blatt np-fruehling-blatt--p1" />
            <span className="np-fruehling-blatt np-fruehling-blatt--p2" />
            <span className="np-fruehling-blatt np-fruehling-blatt--p3" />
            <span className="np-fruehling-blatt np-fruehling-blatt--p4" />
          </div>
        </>
      )}
      {deko === 'sommer-sonnenrad' && (
        <>
          <div className="np-sommer-wrap" aria-hidden="true">
            <svg className="np-sommer-sonne" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" focusable="false">
              <circle cx="50" cy="50" r="44" fill="#ffb347" opacity="0.05" />
              <circle cx="50" cy="50" r="30" fill="#ffc266" opacity="0.08" />
              <circle cx="50" cy="50" r="21" fill="#ffd08a" opacity="0.12" />
              <g className="np-sommer-strahlen" stroke="#ffcb70" strokeWidth="2.6" strokeLinecap="round" opacity="0.5">
                <line x1="50" y1="5" x2="50" y2="17" />
                <line x1="50" y1="83" x2="50" y2="95" />
                <line x1="5" y1="50" x2="17" y2="50" />
                <line x1="83" y1="50" x2="95" y2="50" />
                <line x1="18.5" y1="18.5" x2="27" y2="27" />
                <line x1="73" y1="73" x2="81.5" y2="81.5" />
                <line x1="81.5" y1="18.5" x2="73" y2="27" />
                <line x1="27" y1="73" x2="18.5" y2="81.5" />
              </g>
              <circle className="np-sommer-kern" cx="50" cy="50" r="13.5" fill="#ffc76b" />
            </svg>
            <span className="np-sommer-flimmer np-sommer-flimmer--a" />
            <span className="np-sommer-flimmer np-sommer-flimmer--b" />
            <span className="np-sommer-flimmer np-sommer-flimmer--c" />
          </div>
        </>
      )}
    </span>
  );
}
