// Gemeinsames Audio-Element für die Joker-Effekte der Bühne (stage/effects/JokerEffect).
//
// Browser — allen voran iOS-Safari — lassen play() nur zu, wenn es in einer
// Klick-Behandlung aufgerufen wird. Der Effekt startet aber erst später (lazy
// geladener Baustein im EffectPlayer). Darum schaltet der Klick im Admin-Tab
// (Lokal-Test) EIN Element frei, indem er es einmal stumm anspielt; jeder
// Joker-Effekt lacht danach über genau dieses Element.
//
// Auf der TV-Tafel gibt es keinen Klick: dort gilt wie beim Bildschirmschoner
// die Freigabe durch einen Tastendruck der Fernbedienung seit dem letzten Laden.

const FREISCHALT_TON = '/kiosk/joker-lachen.mp3';

let el: HTMLAudioElement | null = null;
/** true, sobald ein Effekt das Element übernommen hat — die Freischaltung pausiert dann nicht mehr. */
let uebernommen = false;

function element(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.preload = 'auto';
  }
  return el;
}

/** Direkt im Klick-Handler aufrufen. Spielt das Element stumm an und hält es sofort wieder an. */
export function jokerTonFreischalten(): void {
  if (typeof window === 'undefined') return;
  const a = element();
  // Ein Element, das gerade lacht, ist längst freigeschaltet — nie stumm schalten oder anhalten.
  if (!a.paused) return;
  uebernommen = false;
  a.muted = true;
  if (!a.src) a.src = FREISCHALT_TON;
  let p: Promise<void> | undefined;
  try { p = a.play(); } catch { a.muted = false; return; }
  void p?.then(
    () => { if (!uebernommen) a.pause(); a.muted = false; },
    () => { a.muted = false; },
  );
}

/** Spielt `src` von vorn. Lehnt mit NotAllowedError ab, wenn der Browser den Ton sperrt. */
export function jokerTonSpielen(src: string): Promise<void> {
  const a = element();
  uebernommen = true;
  a.muted = false;
  // a.src ist nach dem Setzen eine absolute URL, `src` ein Pfad wie /kiosk/….
  if (!a.src.endsWith(src)) a.src = src;
  try { a.currentTime = 0; } catch { /* Metadaten noch nicht geladen — startet ohnehin vorn */ }
  return a.play();
}

/** Hält das Lachen an (Effekt vorbei oder abgelöst). */
export function jokerTonStoppen(): void {
  el?.pause();
}
