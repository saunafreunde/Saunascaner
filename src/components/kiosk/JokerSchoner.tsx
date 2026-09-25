// Bildschirmschoner aller Displays (Migrationen 0153–0160): TV-Tafel,
// Eingangs-Tablet, Öl-Raum-Tablet, Scanner.
//
// Ist die Sauna zu, jagt ein lachender Joker das Vereinslogo über den
// Bildschirm. Tippt jemand darauf, lacht der Joker ihn aus — und der Server
// meldet die Berührung allen Admins. Freigeben kann nur ein Admin über die App
// (Admin → „Displays"); bis dahin liegt dieser Schirm über allem, was das
// Display sonst zeigt.
//
// Bewegung im Ruhezustand: reine CSS-Transforms (GPU), KEIN JS-Timer — die
// Displays laufen die ganze Nacht (Lehre von der TV-Tafel). Logo und Joker
// fahren DIESELBE Bahn (Lissajous), der Joker 2,3 s später. Alle 80 s läuft
// als eigene CSS-Schleife der Kübel-Gag: der Joker springt nach dem Logo, ein
// Holzkübel kippt ihm Wasser über den Kopf — „Aufguss für den Joker". Er ist
// stumm (ohne Berührung darf ein Browser keinen Ton spielen).
//
// Beim Antippen (Vorgabe Christoph 18.09.2026 — „länger, dreckiger, witziger"):
//   1. Tipp     langes Lachen A
//   2. Tipp     Eskalation — größer, der Schirm wackelt, „Schon wieder du?!",
//               Zähler „Heute schon N Neugierige erwischt" (Server, 0160)
//   3. Tipp     Kuckucksuhr — der Joker schießt aus dem Türchen: „Kuckuck!"
//   4. Tipp     Eskalation mit der Raucherlache, danach geht es bei 2 weiter
// Wer zwei Minuten Ruhe gibt, fängt wieder bei 1 an. Sprüche wechseln zufällig,
// bei jedem Auftritt regnet es Glöckchen. Die Keyframes stehen in index.css
// (Abschnitt „Joker-Bildschirmschoner").
//
// Die TV-Tafel hängt direkt RECHTS neben dem Eingangs-Tablet und hat keinen
// Touch (Vorgabe Christoph 18.09.2026: „lass dort auch eine Grafik laufen,
// immer eine andere wie am Pad"). Das Tablet funkt jeden Tipp (lib/jokerFunk),
// die Tafel zeigt sofort ein EIGENES Motiv, das nach links zum Tablet schaut —
// Zeigefinger, Fernrohr, Popcorn, reihum — und lacht mit einem ANDEREN Lachen
// als das Tablet („am Bildschirm soll auch ein Sound kommen"). Ton ohne
// Berührung erlaubt der Browser nur, wenn seit dem Laden der Seite schon einmal
// jemand eine Taste der TV-Fernbedienung gedrückt hat (oder der Kiosk-Browser
// Autoplay freigibt) — sonst bleibt die Tafel stumm und zeigt klein einen
// Hinweis. Fällt der Funk aus, merkt es die Tafel am Berührungszähler der Status-Abfrage
// (bis 10 s später). Auch der Kübel-Gag wechselt sich ab: beide Displays takten
// ihn nach der SERVERuhr (Status-Feld jetzt_ms, 0161 — Geräteuhren gehen gern
// eine Minute falsch), die Tafel eine halbe Runde versetzt.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useBrandSettings, brandAssetUrl, kioskSperreBeruehrt, type KioskDisplay } from '@/lib/api';
import { jokerFunkVerbinden } from '@/lib/jokerFunk';

type AuftrittArt = 'lachen' | 'eskalation' | 'kuckuck';
/** 'nachbar' = die Tafel lacht mit, weil am Tablet nebenan getippt wurde (mit `bild`). */
type Auftritt = { art: AuftrittArt | 'nachbar'; bild?: string; ruf: string; zeile1: string; zeile2: string };

/** Ton + Dauer je Auftritt. Die Dauer folgt der Länge der Tondatei.
 *  Auch von den Joker-Effekten der Bühne genutzt (stage/effects/JokerEffect). */
export const TON: Record<'a' | 'irre' | 'raucher' | 'kuckuck', { src: string; ms: number }> = {
  a:       { src: '/kiosk/joker-lachen.mp3',   ms: 8200 },   // keuchend, schnaubend — das Hauptlachen
  irre:    { src: '/kiosk/joker-lachen-2.mp3', ms: 6700 },   // irres Kichern, kippt ins Brüllen
  raucher: { src: '/kiosk/joker-lachen-3.mp3', ms: 8200 },   // raue Raucherlache
  kuckuck: { src: '/kiosk/joker-kuckuck.mp3',  ms: 5200 },
};

/** Reihenfolge ab dem ZWEITEN Tipp (der erste ist immer das Lachen A). */
const FOLGE: { art: AuftrittArt; ton: keyof typeof TON }[] = [
  { art: 'eskalation', ton: 'irre' },
  { art: 'kuckuck',    ton: 'kuckuck' },
  { art: 'eskalation', ton: 'raucher' },
];

/** Nach so viel Ruhe beginnt die Eskalation wieder von vorn. */
const RUHE_MS = 120_000;

const SPRUECHE: Record<AuftrittArt, { zeile1: string; zeile2: string }[]> = {
  lachen: [
    { zeile1: 'Wir haben geschlossen.', zeile2: 'Der Admin wurde benachrichtigt — nur er kann diesen Bildschirm freigeben.' },
    { zeile1: 'Nix da — Feierabend!', zeile2: 'Der Admin weiß Bescheid. Nur er kann diesen Bildschirm freigeben.' },
    { zeile1: 'Zu isch zu.', zeile2: 'Dr Admin hot’s scho g’sehe — nur er macht hier wieder auf.' },
    { zeile1: 'Heute wird hier nix mehr heiß.', zeile2: 'Der Admin wurde benachrichtigt — nur er kann diesen Bildschirm freigeben.' },
  ],
  eskalation: [
    { zeile1: 'Schon wieder du?!', zeile2: 'Zu ist zu, du Saunakäfer — der Admin lacht schon mit.' },
    { zeile1: 'Du gibsch au koi Ruh!', zeile2: 'Komm morgen wieder, du Schwitzkopf. Der Admin weiß längst Bescheid.' },
    { zeile1: 'Drücken hilft nix!', zeile2: 'Hier macht nur der Admin auf — und der lacht gerade.' },
    { zeile1: 'Noch einer, der’s nicht glaubt!', zeile2: 'Geschlossen bleibt geschlossen. Der Admin ist informiert.' },
  ],
  kuckuck: [
    { zeile1: 'Geschlossen!', zeile2: 'Komm wieder, wenn’s dampft. Der Admin weiß Bescheid.' },
    { zeile1: 'Zu isch!', zeile2: 'Im Schwarzwald schlägt’s Feierabend — nur der Admin macht auf.' },
    { zeile1: 'Feierabend!', zeile2: 'Die Uhr hat’s gesagt. Freigeben kann nur der Admin.' },
  ],
};

/** Motive der TV-Tafel, wenn am Tablet links daneben getippt wird — bewusst
 *  andere Bilder als am Tablet, alle schauen nach links hinüber. */
export const NACHBAR: { bild: string; ruf: string; sprueche: { zeile1: string; zeile2: string }[] }[] = [
  {
    bild: '/kiosk/joker-zeigt.webp', ruf: 'HA HA — DER DA!',
    sprueche: [
      { zeile1: 'Da drüben drückt einer!', zeile2: 'Am Tablet nebenan wird getippt — hilft nur nix. Zu ist zu.' },
      { zeile1: 'Guck mal, der am Tablet!', zeile2: 'Drückt und drückt … aufmachen kann trotzdem nur der Admin.' },
      { zeile1: 'Do hanna druckt oiner!', zeile2: 'S’hilft älles nix — zu isch zu. Dr Admin woiß B’scheid.' },
    ],
  },
  {
    bild: '/kiosk/joker-fernglas.webp', ruf: 'ICH SEH DICH!',
    sprueche: [
      { zeile1: 'Ja, genau du — links am Tablet.', zeile2: 'Der Admin sieht’s übrigens auch. Er wurde benachrichtigt.' },
      { zeile1: 'Erwischt!', zeile2: 'Von hier aus sieht man alles. Der Admin weiß schon Bescheid.' },
    ],
  },
  {
    bild: '/kiosk/joker-popcorn.webp', ruf: 'WEITER SO!',
    sprueche: [
      { zeile1: 'Ich hab Popcorn.', zeile2: 'Drück ruhig noch mal. Aufmachen kann trotzdem nur der Admin.' },
      { zeile1: 'Beste Vorstellung heute!', zeile2: 'Eintritt frei, Sauna zu. Komm wieder, wenn’s dampft.' },
    ],
  },
];

/** Die drei Lachen — die Tafel nimmt reihum eines, das am Tablet gerade NICHT läuft. */
export const LACHER: (keyof typeof TON)[] = ['raucher', 'irre', 'a'];

/** Länge der Kübel-Gag-Schleife — MUSS den 80 s in index.css entsprechen. */
const GAG_MS = 80_000;

/** So heißt das Eingangs-Tablet in kiosk_sperre.letztes_display (Migration 0155). */
const EINGANG_NAME = 'Eingangs-Tablet';

/** Glöckchen-Regen: feste Pseudo-Zufallswerte je Glöckchen — ohne Math.random im
 *  Render, damit ein Re-Render die fallenden Glöckchen nicht umsortiert. */
export const GLOECKCHEN = Array.from({ length: 16 }, (_, i) => ({
  links: (i * 61 + 7) % 100,                       // vw
  groesse: 3.2 + ((i * 37) % 30) / 10,             // vmin
  dauer: 2.6 + ((i * 53) % 22) / 10,               // s
  verzug: -(((i * 29) % 40) / 10),                 // s, negativ = mitten im Fall starten
}));

function zufall<T>(liste: readonly T[]): T {
  return liste[Math.floor(Math.random() * liste.length)];
}

export function JokerSchoner({ display, oeffnetUm, beruehrungen, letztesDisplay, uhrVersatzMs = 0 }: {
  display: KioskDisplay;
  oeffnetUm: string | null;
  /** Serveruhr minus Geräteuhr in ms — nur beim Start gelesen (Takt des Kübel-Gags). */
  uhrVersatzMs?: number;
  /** Aus der Status-Abfrage — Ersatzweg der Tafel, falls der Funk ausfällt. */
  beruehrungen?: number;
  letztesDisplay?: string | null;
}) {
  const brand = useBrandSettings();
  // Erst zeigen, wenn die Branding-Einstellungen da sind — sonst blitzt kurz das Ersatz-Icon auf.
  const logoUrl = brand.isLoading ? null
    : (brand.data?.logo?.icon && brandAssetUrl(brand.data.logo.icon)) || '/icons/icon-512.png';

  const [auftritt, setAuftritt] = useState<Auftritt | null>(null);
  const [erwischt, setErwischt] = useState<number | null>(null);
  const [tonGesperrt, setTonGesperrt] = useState(false);
  const toeneRef = useRef<Partial<Record<keyof typeof TON, HTMLAudioElement>>>({});
  const timerRef = useRef<number | null>(null);
  const tippsRef = useRef(0);
  const letzterTippRef = useRef(0);
  const funkRef = useRef<ReturnType<typeof jokerFunkVerbinden> | null>(null);
  const nachbarNrRef = useRef(Math.floor(Math.random() * NACHBAR.length));
  const letzterNachbarRef = useRef(0);
  const gesehenRef = useRef<number | null>(null);

  // Kübel-Gag nach der Serveruhr takten — einmal beim Start gerechnet, kein Timer.
  // Alle Displays teilen dieselbe 80-s-Zeitachse, die Tafel läuft eine halbe
  // Runde versetzt: der Kübel kippt abwechselnd am Tablet und auf der Tafel.
  const [versatzMs] = useState(() =>
    -(Math.round(Date.now() + uhrVersatzMs + (display === 'tafel' ? GAG_MS / 2 : 0)) % GAG_MS));

  // Alles unter dem Schoner stilllegen: keine Klicks, kein Fokus, keine
  // Tastatur — „ohne Freigabe geht nix". Der Schoner selbst hängt per Portal
  // am <body> und bleibt bedienbar.
  // display:none obendrauf: spart Layout, Paint und CSS-Animationen darunter.
  // requestAnimationFrame-Schleifen und JS-Timer hält es NICHT an — die Tafel
  // bremst sich deshalb selbst (Dashboard.tsx: Partikel pausiert, Uhr minütlich).
  // Der React-Baum bleibt gemountet — Realtime und Daten laufen weiter, nach
  // der Freigabe steht sofort der aktuelle Stand da.
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    const vorher = root.style.display;
    root.setAttribute('inert', '');
    root.style.display = 'none';
    return () => { root.removeAttribute('inert'); root.style.display = vorher; };
  }, []);

  useEffect(() => {
    const toene = toeneRef.current;
    for (const [name, t] of Object.entries(TON) as [keyof typeof TON, { src: string }][]) {
      const a = new Audio(t.src);
      a.preload = 'auto';
      toene[name] = a;
    }
    return () => {
      for (const a of Object.values(toene)) a?.pause();
      toeneRef.current = {};
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  /** Tafel: am Tablet nebenan wurde getippt — nächstes Motiv der Reihe, dazu ein
   *  anderes Lachen als das, das am Tablet läuft (`padTon`). */
  const nachbarLacht = useCallback((padTon?: string) => {
    nachbarNrRef.current += 1;
    const nr = nachbarNrRef.current;
    const motiv = NACHBAR[nr % NACHBAR.length];
    const auswahl = LACHER.filter((t) => t !== padTon);
    const ton = auswahl[nr % auswahl.length];
    letzterNachbarRef.current = Date.now();
    setAuftritt({ art: 'nachbar', bild: motiv.bild, ruf: motiv.ruf, ...zufall(motiv.sprueche) });

    for (const alt of Object.values(toeneRef.current)) alt?.pause();
    const a = toeneRef.current[ton];
    if (a) {
      a.currentTime = 0;
      a.play().then(
        () => setTonGesperrt(false),
        (e: unknown) => { if (e instanceof DOMException && e.name === 'NotAllowedError') setTonGesperrt(true); },
      );
    }

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setAuftritt(null), TON[ton].ms);
  }, []);

  // Funk: das Eingangs-Tablet sendet, die Tafel daneben hört zu. Öl-Raum und
  // Scanner stehen woanders — sie bleiben draußen.
  useEffect(() => {
    if (display !== 'eingang' && display !== 'tafel') return;
    const funk = jokerFunkVerbinden(display === 'tafel'
      ? (tipp) => { if (tipp.von === 'eingang') nachbarLacht(tipp.ton); }
      : undefined);
    funkRef.current = funk;
    return () => { funkRef.current = null; funk.trennen(); };
  }, [display, nachbarLacht]);

  // Tafel: Motive vorladen, damit der Auftritt ohne Ladepause kommt.
  useEffect(() => {
    if (display !== 'tafel') return;
    for (const m of NACHBAR) new Image().src = m.bild;
  }, [display]);

  // Ersatzweg ohne Funk: die Status-Abfrage (alle 10 s) zählt die Berührungen
  // mit. Steigt der Zähler wegen des Eingangs-Tablets und der Funk hat nichts
  // gebracht, lacht die Tafel eben nachträglich.
  useEffect(() => {
    if (display !== 'tafel' || typeof beruehrungen !== 'number') return;
    const vorher = gesehenRef.current;
    gesehenRef.current = beruehrungen;
    if (vorher === null || beruehrungen <= vorher) return;
    if (letztesDisplay !== EINGANG_NAME) return;
    if (Date.now() - letzterNachbarRef.current < 20_000) return;
    nachbarLacht();
  }, [display, beruehrungen, letztesDisplay, nachbarLacht]);

  function angetippt() {
    if (auftritt) return;

    const jetzt = Date.now();
    if (jetzt - letzterTippRef.current > RUHE_MS) tippsRef.current = 0;
    letzterTippRef.current = jetzt;
    tippsRef.current += 1;

    const schritt = tippsRef.current === 1
      ? { art: 'lachen' as const, ton: 'a' as const }
      : FOLGE[(tippsRef.current - 2) % FOLGE.length];
    const spruch = zufall(SPRUECHE[schritt.art]);
    setAuftritt({
      art: schritt.art,
      ruf: schritt.art === 'kuckuck' ? 'KUCKUCK!' : schritt.art === 'eskalation' ? 'HA HA HA HA HA!' : 'HA HA HA!',
      ...spruch,
    });

    funkRef.current?.senden({ von: display, ton: schritt.ton });

    const a = toeneRef.current[schritt.ton];
    if (a) {
      a.currentTime = 0;
      void a.play().catch(() => { /* Ton gesperrt — der Joker lacht dann stumm */ });
    }
    // Der Server drosselt die Meldung selbst (eine je 5 Minuten) und zählt mit.
    void kioskSperreBeruehrt(display)
      .then((r) => { if (typeof r.heute === 'number') setErwischt(r.heute); })
      .catch(() => { /* offline: Anzeige bleibt trotzdem gesperrt */ });

    timerRef.current = window.setTimeout(() => setAuftritt(null), TON[schritt.ton].ms);
  }

  const gross = auftritt?.art === 'eskalation';

  return createPortal(
    <div
      className="joker-schoner fixed inset-0 z-[9990] overflow-hidden select-none"
      role="button"
      aria-label="Bildschirm gesperrt — die Sauna ist geschlossen"
      onPointerDown={angetippt}
      onContextMenu={(e) => e.preventDefault()}
      style={{ '--joker-versatz': `${versatzMs}ms` } as CSSProperties}
    >
      {/* Jagd und Kübel-Gag laufen unsichtbar weiter, während der Joker auftritt. */}
      <div className={`joker-buehne ${auftritt ? 'joker-buehne--blass' : ''}`} aria-hidden>
        <div className="joker-jagd">
          <div className="joker-x">
            <div className="joker-y">
              <div className="joker-wende">
                <img src="/kiosk/joker-lauf.webp" alt="" className="joker-laeufer" draggable={false} />
              </div>
            </div>
          </div>
          {/* Logo NACH dem Joker: liegt obenauf und verschwindet an den Wendepunkten nie ganz hinter ihm. */}
          <div className="joker-x joker-vor">
            <div className="joker-y joker-vor-y">
              {logoUrl && <img src={logoUrl} alt="" className="joker-logo" draggable={false} />}
            </div>
          </div>
        </div>

        {/* Kübel-Gag — eigene 80-s-Schleife, siehe index.css. */}
        <div className="joker-gag">
          {logoUrl && <img src={logoUrl} alt="" className="joker-gag-logo" draggable={false} />}
          <img src="/kiosk/kuebel.webp" alt="" className="joker-gag-kuebel" draggable={false} />
          <img src="/kiosk/joker-lauf.webp" alt="" className="joker-gag-springer" draggable={false} />
          <img src="/kiosk/joker-nass.webp" alt="" className="joker-gag-nass" draggable={false} />
          <span className="joker-gag-dampf joker-gag-dampf--1" />
          <span className="joker-gag-dampf joker-gag-dampf--2" />
          <span className="joker-gag-dampf joker-gag-dampf--3" />
          <div className="joker-gag-text">💦 Aufguss für den Joker!</div>
        </div>
      </div>

      {auftritt && (
        <>
          <div className="joker-regen" aria-hidden>
            {GLOECKCHEN.map((g, i) => (
              <img
                key={i}
                src="/kiosk/gloeckchen.webp"
                alt=""
                className="joker-glocke"
                draggable={false}
                style={{
                  left: `${g.links}vw`,
                  width: `${g.groesse}vmin`,
                  animationDuration: `${g.dauer}s`,
                  animationDelay: `${g.verzug}s`,
                }}
              />
            ))}
          </div>

          {auftritt.art === 'nachbar' ? (
            <div className="joker-auftritt absolute inset-0">
              <div className="joker-nachbar">
                <div className="joker-nachbar-figur">
                  <img src={auftritt.bild} alt="" draggable={false} />
                </div>
                <div className="joker-nachbar-text">
                  <div className="joker-haha joker-haha--nachbar" aria-hidden>{auftritt.ruf}</div>
                  <p className="mt-[2vmin] font-bold text-[clamp(26px,5.4vmin,64px)] leading-tight text-amber-200">
                    <span className="joker-nachbar-pfeil" aria-hidden>👈</span> {auftritt.zeile1}
                  </p>
                  <p className="mt-[1.4vmin] text-[clamp(18px,3.3vmin,38px)] leading-snug text-forest-100/90">
                    {auftritt.zeile2}
                  </p>
                </div>
              </div>
              {tonGesperrt && (
                <div className="joker-ton-hinweis">🔇 Ton gesperrt — einmal OK auf der Fernbedienung drücken</div>
              )}
            </div>
          ) : (
          <div className="joker-auftritt absolute inset-0">
            <div className={`flex h-full flex-col items-center justify-center px-6 text-center ${gross ? 'joker-wackler' : ''}`}>
              {auftritt.art !== 'lachen' && erwischt !== null && erwischt > 1 && (
                <div className="joker-zaehler">🃏 Heute schon {erwischt} Neugierige erwischt</div>
              )}

              {auftritt.art === 'kuckuck' ? (
                <div className="joker-uhr" aria-hidden>
                  <img src="/kiosk/kuckuck-zu.webp" alt="" className="joker-uhr-bild" draggable={false} />
                  <img src="/kiosk/kuckuck-joker.webp" alt="" className="joker-uhr-bild joker-uhr-bild--auf" draggable={false} />
                </div>
              ) : (
                <img
                  src="/kiosk/joker-lacht.webp"
                  alt=""
                  className={`joker-lacher ${gross ? 'joker-lacher--gross' : ''}`}
                  draggable={false}
                />
              )}

              <div className={`joker-haha ${gross ? 'joker-haha--gross' : ''}`} aria-hidden>{auftritt.ruf}</div>
              <p className={`mt-2 font-bold ${gross
                ? 'text-[clamp(28px,5.6vmin,62px)] text-rose-300'
                : 'text-[clamp(24px,4.6vmin,52px)] text-amber-200'}`}
              >
                {auftritt.zeile1}
              </p>
              <p className="mt-2 max-w-[30ch] text-[clamp(18px,3.1vmin,34px)] leading-snug text-forest-200/90">
                {auftritt.zeile2}
              </p>
            </div>
          </div>
          )}
        </>
      )}

      {!auftritt && (
        <div className="joker-fusszeile absolute inset-x-0 bottom-[5vh] text-center">
          <div className="text-[clamp(20px,3.6vmin,40px)] font-semibold tracking-wide text-forest-100/80">
            Die Sauna ist geschlossen
          </div>
          {oeffnetUm && (
            <div className="mt-1 text-[clamp(15px,2.6vmin,28px)] text-forest-300/70">
              Heute geöffnet ab {oeffnetUm} Uhr
            </div>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

/** Dunkle Blende, solange der Sperr-Status noch lädt — damit nach einem Neuladen nichts kurz bedienbar ist. */
export function KioskBlende() {
  return createPortal(<div className="fixed inset-0 z-[9990] bg-[#04100d]" aria-hidden />, document.body);
}
