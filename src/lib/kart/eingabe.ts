// Sauna-Kart: Eingabe fürs Handy (und die Tastatur).
//
// Drei Lenk-Arten, wählbar im Menü:
//   * wischen (Standard): Daumen irgendwo auf die Lenkfläche, seitlich
//     ziehen = stufenlos lenken. Der Ankerpunkt wandert mit, wenn man weiter
//     als die volle Auslenkung zieht — Richtungswechsel greifen sofort.
//   * neigen: das Handy wie ein Lenkrad kippen (Lagesensor). Nullpunkt wird
//     beim Start genommen; iOS fragt dafür einmal um Erlaubnis. Solange kein
//     Sensorwert kam (iOS ohne Erlaubnis, Gerät ohne Lagesensor), wirkt der
//     Daumen wie beim Wischen — sonst führe der Schlitten ungelenkt geradeaus.
//   * tippen: linke Hälfte = links, rechte Hälfte = rechts (die alte Art).
// Drift- und Item-Knopf liegen unten rechts; Gas gibt es automatisch.

import type { Eingabe } from './engine/typen';

export type LenkArt = 'wischen' | 'neigen' | 'tippen';

const VOLL_PX = 60;      // Wischweg für vollen Einschlag (CSS-Pixel) — 46 war zu nervös
const TOT_PX = 5;
const NEIGE_GRAD = 22;   // Neigung für vollen Einschlag

export class KartEingabe {
  art: LenkArt = 'wischen';
  private lenk = 0;
  private digital = false;
  private drift = false;
  private itemFlanke = false;
  private tasten = new Set<string>();
  private lenkZeiger: number | null = null;
  private anker = 0;
  private tippZeiger = new Map<number, -1 | 1>();
  private neigeNull: number | null = null;
  private neigung: number | null = null;
  private weg: (() => void)[] = [];
  /** Für die Anzeige des Lenk-Knaufs: Ankerpunkt und Auslenkung (CSS-px). */
  knauf: { x: number; y: number; dx: number } | null = null;
  onPause: (() => void) | null = null;

  verbinde(flaeche: HTMLElement, driftKnopf: HTMLElement, itemKnopf: HTMLElement) {
    this.trenne();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const an = (el: EventTarget, typ: string, fn: (e: any) => void, opt?: AddEventListenerOptions) => {
      el.addEventListener(typ, fn as EventListener, opt);
      this.weg.push(() => el.removeEventListener(typ, fn as EventListener, opt));
    };

    // ── Lenkfläche ───────────────────────────────────────────────────────
    an(flaeche, 'pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      if (this.art === 'tippen') {
        const r = flaeche.getBoundingClientRect();
        this.tippZeiger.set(e.pointerId, e.clientX - r.left < r.width / 2 ? -1 : 1);
        this.tippNeu();
      } else if (this.wischAktiv() && this.lenkZeiger === null) {
        this.lenkZeiger = e.pointerId;
        this.anker = e.clientX;
        this.lenk = 0;
        this.digital = false;
        const r = flaeche.getBoundingClientRect();
        this.knauf = { x: e.clientX - r.left, y: e.clientY - r.top, dx: 0 };
      }
      flaeche.setPointerCapture?.(e.pointerId);
    }, { passive: false });
    an(flaeche, 'pointermove', (e: PointerEvent) => {
      if (!this.wischAktiv() || e.pointerId !== this.lenkZeiger) return;
      let dx = e.clientX - this.anker;
      if (dx > VOLL_PX) { this.anker = e.clientX - VOLL_PX; dx = VOLL_PX; }
      if (dx < -VOLL_PX) { this.anker = e.clientX + VOLL_PX; dx = -VOLL_PX; }
      const wirk = Math.abs(dx) < TOT_PX ? 0 : (dx - Math.sign(dx) * TOT_PX) / (VOLL_PX - TOT_PX);
      // leichte Kurve: feines Lenken um die Mitte, voller Einschlag am Rand
      this.lenk = Math.sign(wirk) * Math.pow(Math.abs(wirk), 1.35);
      if (this.knauf) {
        const r = flaeche.getBoundingClientRect();
        this.knauf = { x: this.anker - r.left, y: this.knauf.y, dx };
      }
    });
    const ende = (e: PointerEvent) => {
      if (this.art === 'tippen') {
        this.tippZeiger.delete(e.pointerId);
        this.tippNeu();
      } else if (e.pointerId === this.lenkZeiger) {
        this.lenkZeiger = null;
        this.lenk = 0;
        this.knauf = null;
      }
    };
    an(flaeche, 'pointerup', ende);
    an(flaeche, 'pointercancel', ende);
    an(flaeche, 'lostpointercapture', ende);

    // ── Knöpfe ───────────────────────────────────────────────────────────
    an(driftKnopf, 'pointerdown', (e: PointerEvent) => { e.preventDefault(); e.stopPropagation(); this.drift = true; driftKnopf.setPointerCapture?.(e.pointerId); }, { passive: false });
    const driftAus = () => { this.drift = false; };
    an(driftKnopf, 'pointerup', driftAus);
    an(driftKnopf, 'pointercancel', driftAus);
    an(driftKnopf, 'lostpointercapture', driftAus);
    an(itemKnopf, 'pointerdown', (e: PointerEvent) => { e.preventDefault(); e.stopPropagation(); this.itemFlanke = true; }, { passive: false });

    // ── Tastatur ─────────────────────────────────────────────────────────
    an(window, 'keydown', (e: KeyboardEvent) => {
      const k = e.key;
      if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(k)) { this.tasten.add(k.toLowerCase()); e.preventDefault(); }
      else if ([' ', 'Shift', 'ArrowDown', 's', 'S'].includes(k)) { this.drift = true; e.preventDefault(); }
      else if (['ArrowUp', 'w', 'W', 'x', 'X', 'Enter'].includes(k)) { if (!e.repeat) this.itemFlanke = true; e.preventDefault(); }
      else if (k === 'Escape' || k === 'p' || k === 'P') this.onPause?.();
    });
    an(window, 'keyup', (e: KeyboardEvent) => {
      const k = e.key;
      this.tasten.delete(k.toLowerCase());
      if ([' ', 'Shift', 'ArrowDown', 's', 'S'].includes(k)) this.drift = false;
    });
    an(window, 'blur', () => { this.tasten.clear(); this.drift = false; this.lenk = 0; this.lenkZeiger = null; this.knauf = null; });

    // ── Lagesensor ───────────────────────────────────────────────────────
    an(window, 'deviceorientation', (ev: DeviceOrientationEvent) => {
      if (ev.gamma === null || ev.beta === null) return;
      const winkel = (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0);
      // Hochkant: gamma (links/rechts kippen). Quer: beta, Vorzeichen je Seite.
      const wert = winkel === 90 ? ev.beta : winkel === 270 || winkel === -90 ? -ev.beta : ev.gamma;
      this.neigung = wert;
      if (this.neigeNull === null) this.neigeNull = wert;
    });
  }

  trenne() {
    for (const f of this.weg) f();
    this.weg = [];
    this.lenkZeiger = null;
    this.tippZeiger.clear();
    this.knauf = null;
    this.drift = false;
  }

  /** Nullpunkt für die Neige-Steuerung neu setzen (beim Rennstart). */
  kalibriere() { this.neigeNull = this.neigung; }

  /** Kam schon mindestens ein Wert vom Lagesensor? */
  get neigtAktiv(): boolean { return this.neigung !== null; }

  /** Wischen wirkt — gewählt, oder als Ersatz, solange „Neigen" keine Sensorwerte bekommt. */
  private wischAktiv(): boolean {
    return this.art === 'wischen' || (this.art === 'neigen' && this.neigung === null);
  }

  /** iOS verlangt eine Erlaubnis für den Lagesensor — nur aus einer Geste heraus. */
  static async neigenErlauben(): Promise<boolean> {
    const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (!D) return false;
    if (typeof D.requestPermission === 'function') {
      try { return (await D.requestPermission()) === 'granted'; } catch { return false; }
    }
    return true;
  }

  private tippNeu() {
    let l = 0;
    this.tippZeiger.forEach((s) => { l += s; });
    this.lenk = Math.max(-1, Math.min(1, l));
    this.digital = true;
  }

  /** Aktuelle Eingabe für den nächsten Physik-Schritt; die Item-Flanke wird verbraucht. */
  lies(): Eingabe {
    let lenk = this.lenk;
    let digital = this.digital && this.art === 'tippen';
    const links = this.tasten.has('arrowleft') || this.tasten.has('a');
    const rechts = this.tasten.has('arrowright') || this.tasten.has('d');
    if (links || rechts) { lenk = (rechts ? 1 : 0) - (links ? 1 : 0); digital = true; }
    else if (this.art === 'neigen' && this.neigung !== null && this.neigeNull !== null) {
      const d = this.neigung - this.neigeNull;
      lenk = Math.max(-1, Math.min(1, Math.abs(d) < 1.5 ? 0 : d / NEIGE_GRAD));
      digital = false;
    }
    const item = this.itemFlanke;
    this.itemFlanke = false;
    return { lenk, digital, drift: this.drift, item };
  }
}
