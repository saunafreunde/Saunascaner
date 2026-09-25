// Sauna-Kart: der Renn-Bildschirm (Grand-Prix-Fassung, 25.09.2026).
//
// Vollbild, Hochformat zuerst. Die Engine (lib/kart/engine) rechnet mit
// festem Takt, der Renderer malt jedes Bild, und die Anzeige (Platz, Runde,
// Item, Tropfen) wird DIREKT im DOM aktualisiert — kein React-Render pro Bild.
//
// Bedienung: Daumen links wischen = lenken (oder Handy neigen / tippen),
// DRIFT halten = driften, ITEM tippen = Item einsetzen. Gas automatisch.

import { useEffect, useRef, useState } from 'react';
import { ladeKartAssets } from '@/lib/kart/assets';
import { bauGeometrie, type KartStrecke } from '@/lib/kart/strecken';
import { bauTextur } from '@/lib/kart/textur';
import { KartRenderer } from '@/lib/kart/render';
import { KartEingabe } from '@/lib/kart/eingabe';
import { KartSound } from '@/lib/kart/sound';
import { Rennen } from '@/lib/kart/engine/rennen';
import {
  ITEM_INFO, PHYSIK_DT,
  type Ereignis, type FahrerSetup, type GeistDaten, type ItemTyp, type Klasse, type Modus, type RennErgebnis,
} from '@/lib/kart/engine/typen';
import type { KartEinstellungen } from '@/lib/kart/daten';

export interface RennAuftrag {
  schluessel: number;       // neuer Wert = neues Rennen (Neustart)
  strecke: KartStrecke;
  modus: Modus;
  klasse: Klasse;
  fahrer: FahrerSetup[];
  geister?: GeistDaten[];
  titel: string;
  saat: number;
}

const ROULETTE: ItemTyp[] = ['minze', 'seife', 'filzhut', 'eiskugel', 'glutstern', 'dampf', 'aufguss'];

export function fmtZeit(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const t = Math.floor(ms % 1000);
  return `${m}:${String(s).padStart(2, '0')},${String(t).padStart(3, '0')}`;
}

function vibriere(ms: number) {
  try { navigator.vibrate?.(ms); } catch { /* egal */ }
}

export default function KartRennen({ auftrag, einstellungen, onEinstellungen, onFertig, onNeustart, onAbbruch }: {
  auftrag: RennAuftrag;
  einstellungen: KartEinstellungen;
  onEinstellungen: (e: KartEinstellungen) => void;
  onFertig: (e: RennErgebnis) => void;
  onNeustart: () => void;
  onAbbruch: () => void;
}) {
  const huelleRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const miniRef = useRef<HTMLCanvasElement | null>(null);
  const flaecheRef = useRef<HTMLDivElement | null>(null);
  const driftRef = useRef<HTMLButtonElement | null>(null);
  const itemKnopfRef = useRef<HTMLButtonElement | null>(null);
  const knaufRef = useRef<HTMLDivElement | null>(null);
  const zeitRef = useRef<HTMLSpanElement | null>(null);
  const rundeRef = useRef<HTMLSpanElement | null>(null);
  const platzRef = useRef<HTMLSpanElement | null>(null);
  const itemIconRef = useRef<HTMLSpanElement | null>(null);
  const itemZahlRef = useRef<HTMLSpanElement | null>(null);
  const tropfenRef = useRef<HTMLSpanElement | null>(null);
  const countdownRef = useRef<HTMLDivElement | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const rennenRef = useRef<Rennen | null>(null);
  const soundRef = useRef<KartSound | null>(null);
  const eingabeRef = useRef<KartEingabe | null>(null);
  const pauseRef = useRef(false);
  const einstRef = useRef(einstellungen);
  einstRef.current = einstellungen;

  const [pause, setPause] = useState(false);
  const [geladen, setGeladen] = useState(false);
  const [ziel, setZiel] = useState<{ platz: number; zeit: number | null } | null>(null);
  const [, setRennEnde] = useState(false);
  const [anleitung, setAnleitung] = useState(!einstellungen.anleitungGesehen);
  const anleitungRef = useRef(anleitung);
  anleitungRef.current = anleitung;
  // „Neigen" gewählt, aber der Lagesensor liefert nichts (iOS ohne Erlaubnis,
  // Gerät ohne Sensor): Der Daumen lenkt dann wie beim Wischen (KartEingabe),
  // hier nur Hinweis und Anzeige unten links.
  const [neigenWeg, setNeigenWeg] = useState(false);
  const neigenWegRef = useRef(false);
  const neigenTimerRef = useRef(0);

  const runden = auftrag.strecke.runden;
  const vieleFahrer = auftrag.fahrer.length > 1;

  function pausieren(an: boolean) {
    pauseRef.current = an;
    setPause(an);
    const s = soundRef.current;
    if (!s) return;
    s.pause(an);
    if (!an && rennenRef.current && ['rennen', 'auslauf'].includes(rennenRef.current.phase)) s.musikStart();
  }

  function banner(text: string, art: 'gross' | 'klein' | 'warn' = 'klein') {
    const el = bannerRef.current;
    if (!el) return;
    el.textContent = text;
    el.dataset.art = art;
    el.classList.remove('kart-banner-an');
    void el.offsetWidth; // Animation neu starten
    el.classList.add('kart-banner-an');
  }

  /** Beim Anzählen (und nach einem Wechsel der Lenkart) 1,5 s warten: Kommt
   *  bei „Neigen" bis dahin kein Sensorwert, Hinweis zeigen — gelenkt wird
   *  dann per Wischen. Kommen die Werte später doch (Erlaubnis spät erteilt),
   *  übernimmt das Neigen wieder (siehe hud). */
  function neigenPruefen() {
    window.clearTimeout(neigenTimerRef.current);
    neigenWegRef.current = false;
    setNeigenWeg(false);
    if (eingabeRef.current?.art !== 'neigen') return;
    neigenTimerRef.current = window.setTimeout(() => {
      const e = eingabeRef.current;
      if (!e || e.art !== 'neigen' || e.neigtAktiv) return;
      neigenWegRef.current = true;
      setNeigenWeg(true);
      banner('📱 Neigen geht hier nicht — wische zum Lenken', 'warn');
    }, 1500);
  }

  useEffect(() => {
    let lebt = true;
    let raf = 0;
    let ro: ResizeObserver | null = null;
    let wake: { release: () => Promise<void> } | null = null;
    const eingabe = new KartEingabe();
    eingabe.art = einstRef.current.lenkArt;
    eingabeRef.current = eingabe;
    const sound = new KartSound();
    sound.tonAn = einstRef.current.ton;
    sound.musikAn = einstRef.current.musik;
    soundRef.current = sound;
    setZiel(null);
    setRennEnde(false);
    neigenWegRef.current = false;
    setNeigenWeg(false);
    pauseRef.current = anleitungRef.current;

    const huelle = huelleRef.current!;
    const ersteGeste = () => {
      sound.start();
      const r = rennenRef.current;
      if (r && ['rennen', 'auslauf'].includes(r.phase) && !pauseRef.current) sound.musikStart();
    };
    // Capture: auch der erste Druck auf DRIFT (Raketenstart) weckt den Ton.
    huelle.addEventListener('pointerdown', ersteGeste, { capture: true });
    const sichtbar = () => {
      if (document.hidden) { if (!pauseRef.current) pausieren(true); }
      else void holeWakeLock();
    };
    document.addEventListener('visibilitychange', sichtbar);
    async function holeWakeLock() {
      try {
        const nav = navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } };
        wake = (await nav.wakeLock?.request('screen')) ?? null;
      } catch { /* nicht unterstützt */ }
    }
    void holeWakeLock();

    (async () => {
      const assets = await ladeKartAssets();
      if (!lebt) return;
      const geo = bauGeometrie(auftrag.strecke);
      const textur = bauTextur(geo, auftrag.strecke.boden ? assets.boden[auftrag.strecke.boden] : null);
      const rennen = new Rennen({
        strecke: auftrag.strecke, geo, modus: auftrag.modus, klasse: auftrag.klasse,
        fahrer: auftrag.fahrer, saat: auftrag.saat,
        lenkhilfe: einstRef.current.lenkhilfe, autoDrift: einstRef.current.autoDrift,
        geister: auftrag.geister,
      });
      rennenRef.current = rennen;
      // Nur im Entwicklungs-Build: Tests können das Rennen von außen vorspulen.
      if (import.meta.env.DEV) (window as unknown as { __kartRennen?: Rennen }).__kartRennen = rennen;
      const canvas = canvasRef.current!;
      const renderer = new KartRenderer(canvas, geo, textur, assets);
      const passen = () => {
        const b = huelle.clientWidth, h = huelle.clientHeight;
        if (!b || !h) return;
        const hoch = h >= b;
        const W = hoch ? 360 : 560;
        const H = Math.round(Math.max(hoch ? 480 : 260, Math.min(hoch ? 820 : 420, W * h / b)));
        renderer.groesse(W, H);
      };
      passen();
      ro = new ResizeObserver(passen);
      ro.observe(huelle);
      eingabe.verbinde(flaecheRef.current!, driftRef.current!, itemKnopfRef.current!);
      eingabe.onPause = () => pausieren(!pauseRef.current);
      setGeladen(true);

      const letzt = { zeit: '', runde: '', platz: 0, item: '', zahl: -1, tropfen: -1, stufe: -1, cd: '', knauf: '' };
      let losBis = 0;
      let ueberholtSperre = 0;
      let vorher = performance.now();
      let akku = 0;

      const toene = (ev: Ereignis[]) => {
        const s = rennen.spieler;
        for (const e of ev) {
          if (e.art === 'countdown') {
            sound.countdown(e.wert ?? 1);
            if (e.wert === 3) { eingabe.kalibriere(); neigenPruefen(); }
            continue;
          }
          if (e.art === 'start') { sound.countdown(0); sound.musikStart(); losBis = performance.now() + 900; continue; }
          if (e.art === 'rennEnde') { setRennEnde(true); continue; }
          if (e.art === 'aufguss' && e.fahrer !== s.nr) {
            sound.aufguss(); vibriere(60);
            banner(`🧖 Aufguss von ${rennen.fahrer[e.fahrer].name}!`, 'warn');
            continue;
          }
          if (e.art === 'dampf' && e.fahrer !== s.nr && s.nebelRest > 0) {
            sound.dampf();
            banner(`💨 ${rennen.fahrer[e.fahrer].name} nebelt dich ein!`, 'warn');
            continue;
          }
          if (e.fahrer !== s.nr) continue;
          switch (e.art) {
            case 'kiste': sound.kiste(); vibriere(8); break;
            case 'item': sound.itemDa(); break;
            case 'minze': sound.minze(); vibriere(10); break;
            case 'turbo': sound.turbo(); vibriere(10); break;
            case 'miniturbo': sound.miniturbo(e.wert ?? 1); vibriere(12); break;
            case 'startBoost': sound.turbo(); vibriere(20); banner('🚀 Raketenstart!', 'gross'); break;
            case 'fehlstart': sound.fehlstart(); vibriere(60); banner('Fehlstart — zu früh gedrückt', 'warn'); break;
            case 'hop': sound.hop(); break;
            case 'sprung': sound.sprung(); break;
            case 'trick': sound.trick(); vibriere(10); banner('✨ Trick!', 'klein'); break;
            case 'landung': sound.landung(); vibriere(12); break;
            case 'bande': sound.bande(); if (e.wert === 1) vibriere(18); break;
            case 'rempler': sound.rempler(); vibriere(15); break;
            case 'treffer': sound.treffer(); vibriere(45); break;
            case 'stamm': sound.stamm(); vibriere(45); break;
            case 'tropfen': sound.tropfen(e.wert ?? 1); vibriere(4); break;
            case 'wurf': sound.wurf(); break;
            case 'seifeAb': sound.seife(); break;
            case 'stern': sound.stern(true); vibriere(20); break;
            case 'sternEnde': sound.stern(false); break;
            case 'glut': sound.glut(); break;
            case 'dampf': sound.dampf(); break;
            case 'aufguss': sound.aufguss(); banner('🧖 Aufguss! Alle anderen schwitzen.', 'gross'); break;
            case 'runde': sound.countdown(1); banner(`Runde ${e.wert}/${runden}`, 'klein'); break;
            case 'letzteRunde': sound.letzteRunde(); banner('LETZTE RUNDE!', 'gross'); break;
            case 'ziel':
              sound.ziel(s.platz); sound.musikStopp(); vibriere(40);
              setZiel({ platz: s.platz, zeit: s.zielZeitMs });
              break;
            case 'ueberholt':
              if (performance.now() > ueberholtSperre) { sound.ueberholt(); ueberholtSperre = performance.now() + 700; }
              break;
          }
        }
      };

      const hud = () => {
        const s = rennen.spieler;
        const imRennen = rennen.phase === 'rennen' || rennen.phase === 'auslauf' || rennen.phase === 'fertig';
        const zeit = fmtZeit(imRennen ? (s.zielZeitMs ?? rennen.zeitMs) : 0);
        if (zeit !== letzt.zeit && zeitRef.current) { zeitRef.current.textContent = zeit; letzt.zeit = zeit; }
        const runde = `${Math.min(s.runde, runden)}/${runden}`;
        if (runde !== letzt.runde && rundeRef.current) { rundeRef.current.textContent = runde; letzt.runde = runde; }
        if (s.platz !== letzt.platz && platzRef.current) {
          platzRef.current.textContent = `${s.platz}.`;
          platzRef.current.dataset.platz = String(Math.min(s.platz, 4));
          platzRef.current.classList.remove('kart-platz-puls');
          void platzRef.current.offsetWidth;
          platzRef.current.classList.add('kart-platz-puls');
          letzt.platz = s.platz;
        }
        const itemIcon = s.roulette > 0
          ? ITEM_INFO[ROULETTE[Math.floor(performance.now() / 70) % ROULETTE.length]].icon
          : s.item ? ITEM_INFO[s.item].icon : '';
        if (itemIcon !== letzt.item && itemIconRef.current) {
          itemIconRef.current.textContent = itemIcon;
          letzt.item = itemIcon;
          itemKnopfRef.current?.setAttribute('data-voll', s.item && s.roulette <= 0 ? '1' : '0');
          if (itemKnopfRef.current) {
            itemKnopfRef.current.textContent = itemIcon || 'Item';
            itemKnopfRef.current.style.fontSize = itemIcon ? '30px' : '';
          }
          itemKnopfRef.current?.setAttribute('aria-label', s.item ? `${ITEM_INFO[s.item].name} einsetzen` : 'Kein Item');
        }
        if (s.roulette > 0 && Math.floor(performance.now() / 70) !== Math.floor((performance.now() - 16) / 70)) sound.roulette();
        const zahl = s.item === 'minze3' && s.roulette <= 0 ? s.itemAnzahl : 0;
        if (zahl !== letzt.zahl && itemZahlRef.current) { itemZahlRef.current.textContent = zahl > 1 ? `×${zahl}` : ''; letzt.zahl = zahl; }
        if (s.muenzen !== letzt.tropfen && tropfenRef.current) { tropfenRef.current.textContent = String(s.muenzen); letzt.tropfen = s.muenzen; }
        const stufe = s.driftAktiv ? s.driftStufe : -1;
        if (stufe !== letzt.stufe && driftRef.current) { driftRef.current.dataset.stufe = String(stufe); letzt.stufe = stufe; }
        let cd = '';
        if (rennen.phase === 'countdown') cd = String(Math.max(1, Math.ceil(rennen.countdownMs / 1000)));
        else if (performance.now() < losBis) cd = 'LOS!';
        if (cd !== letzt.cd && countdownRef.current) {
          countdownRef.current.textContent = cd;
          countdownRef.current.classList.remove('kart-countdown-an');
          if (cd) { void countdownRef.current.offsetWidth; countdownRef.current.classList.add('kart-countdown-an'); }
          letzt.cd = cd;
        }
        if (neigenWegRef.current && eingabe.neigtAktiv) {
          neigenWegRef.current = false;
          setNeigenWeg(false);
          banner('📱 Neigen aktiv', 'klein');
        }
        const k = eingabe.knauf;
        const knauf = k ? `${Math.round(k.x)},${Math.round(k.y)},${Math.round(k.dx)}` : '';
        if (knauf !== letzt.knauf && knaufRef.current) {
          const el = knaufRef.current;
          if (k) {
            el.style.display = 'block';
            el.style.left = `${k.x}px`;
            el.style.top = `${k.y}px`;
            (el.firstElementChild as HTMLElement | null)?.style.setProperty('transform', `translateX(${Math.max(-44, Math.min(44, k.dx * 0.75))}px)`);
          } else el.style.display = 'none';
          letzt.knauf = knauf;
        }
      };

      const bild = (t: number) => {
        if (!lebt) return;
        raf = requestAnimationFrame(bild);
        let dt = (t - vorher) / 1000;
        vorher = t;
        if (dt > 0.1) dt = 0.1;
        if (pauseRef.current) return;
        akku += dt;
        let schritte = 0;
        while (akku >= PHYSIK_DT && schritte < 14) {
          rennen.schritt(PHYSIK_DT, eingabe.lies());
          akku -= PHYSIK_DT;
          schritte++;
        }
        if (schritte >= 14) akku = 0;
        const ev = rennen.holeEreignisse();
        renderer.ereignisse(ev, rennen);
        toene(ev);
        renderer.zeichne(rennen, dt);
        if (miniRef.current) renderer.zeichneMinikarte(miniRef.current, rennen);
        hud();
        const s = rennen.spieler;
        if (rennen.phase === 'rennen' || rennen.phase === 'auslauf') {
          sound.motor(Math.min(1, s.v / (rennen.vMax * 1.5)), s.boostRest > 0 || s.sternRest > 0);
          sound.drift(s.driftAktiv, s.driftStufe);
        } else {
          sound.motorAus();
          sound.drift(false, 0);
        }
      };
      raf = requestAnimationFrame(bild);
    })();

    return () => {
      lebt = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(neigenTimerRef.current);
      ro?.disconnect();
      eingabe.trenne();
      sound.stop();
      huelle.removeEventListener('pointerdown', ersteGeste, { capture: true });
      document.removeEventListener('visibilitychange', sichtbar);
      void wake?.release().catch(() => {});
      rennenRef.current = null;
    };
    // Ein neues Rennen entsteht nur mit einem neuen Auftrag (schluessel).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auftrag.schluessel]);

  // Einstellungen während des Rennens (Pause-Menü) sofort wirken lassen.
  useEffect(() => {
    soundRef.current?.setzeTon(einstellungen.ton);
    soundRef.current?.setzeMusik(einstellungen.musik);
  }, [einstellungen.ton, einstellungen.musik]);
  useEffect(() => {
    const e = eingabeRef.current;
    if (!e || e.art === einstellungen.lenkArt) return;
    e.art = einstellungen.lenkArt;
    neigenPruefen();
    // neigenPruefen nutzt nur Refs und stabile Setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [einstellungen.lenkArt]);

  function weiter() {
    const r = rennenRef.current;
    if (r) onFertig(r.ergebnis());
  }

  function anleitungFertig() {
    setAnleitung(false);
    onEinstellungen({ ...einstellungen, anleitungGesehen: true });
    pauseRef.current = false;
    soundRef.current?.start();
  }

  const s = einstellungen;
  return (
    <div
      ref={huelleRef}
      className="fixed inset-0 z-[60] select-none overflow-hidden bg-black text-white"
      style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
    >
      <style>{KART_CSS}</style>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ imageRendering: 'pixelated' }} aria-label={`Sauna-Kart: ${auftrag.titel}`} />
      <div ref={flaecheRef} className="absolute inset-0" />
      <div ref={knaufRef} className="kart-knauf pointer-events-none absolute" style={{ display: 'none' }}>
        <div className="kart-knauf-punkt" />
      </div>

      {!geladen && (
        <div className="absolute inset-0 grid place-items-center bg-forest-950 text-forest-100">
          <div className="text-center">
            <div className="text-5xl kart-wackeln" aria-hidden>🛷</div>
            <p className="mt-3 text-sm">{auftrag.titel}</p>
            <p className="mt-1 text-xs text-forest-400">Strecke wird gebaut …</p>
          </div>
        </div>
      )}

      {/* ── Anzeige oben ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-3" style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}>
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => pausieren(true)}
            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-xl bg-black/45 text-lg ring-1 ring-white/20 active:scale-95"
            aria-label="Pause"
          >
            ⏸
          </button>
          <div className="flex flex-col items-center gap-1">
            <div className="kart-itemslot relative grid h-14 w-14 place-items-center rounded-2xl bg-black/50 ring-2 ring-amber-300/60">
              <span ref={itemIconRef} className="text-3xl leading-none" />
              <span ref={itemZahlRef} className="absolute -bottom-1 -right-1 rounded-full bg-amber-400 px-1 text-[11px] font-black text-black empty:hidden" />
            </div>
            <div className="flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-xs font-bold tabular-nums">
              <span aria-hidden>💧</span><span ref={tropfenRef}>0</span>
            </div>
          </div>
        </div>
        <div className="mt-1 flex flex-col items-center rounded-xl bg-black/40 px-3 py-1 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Runde</span>
          <span ref={rundeRef} className="text-lg font-black leading-tight tabular-nums">1/{runden}</span>
          <span ref={zeitRef} className="font-mono text-xs tabular-nums text-white/85">0:00,000</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          {vieleFahrer ? (
            <div className="flex items-baseline rounded-xl bg-black/40 px-2">
              <span ref={platzRef} data-platz="4" className="kart-platz text-4xl font-black italic leading-none tabular-nums">8.</span>
              <span className="ml-0.5 text-xs font-bold text-white/70">/{auftrag.fahrer.length}</span>
            </div>
          ) : (
            <div className="rounded-xl bg-black/40 px-2 py-1 text-xs font-bold">⏱ Zeitfahren</div>
          )}
          <canvas ref={miniRef} width={96} height={96} className="h-20 w-20 rounded-lg bg-black/25" aria-hidden />
        </div>
      </div>

      {/* ── Countdown und Meldungen ── */}
      <div ref={countdownRef} className="kart-countdown pointer-events-none absolute inset-x-0 top-[26%] text-center font-black italic" />
      <div ref={bannerRef} className="kart-banner pointer-events-none absolute inset-x-4 top-[38%] text-center font-black" />

      {/* ── Knöpfe unten rechts ── */}
      <div className="pointer-events-none absolute bottom-0 right-0 flex items-end gap-3 p-4" style={{ paddingBottom: 'max(18px, env(safe-area-inset-bottom))' }}>
        <button
          ref={itemKnopfRef}
          type="button"
          data-voll="0"
          className="kart-item-knopf pointer-events-auto mb-16 grid h-16 w-16 place-items-center rounded-full text-xs font-black uppercase tracking-wide"
          aria-label="Kein Item"
        >
          Item
        </button>
        <button
          ref={driftRef}
          type="button"
          data-stufe="-1"
          className="kart-drift-knopf pointer-events-auto grid h-24 w-24 place-items-center rounded-full text-sm font-black uppercase tracking-wider"
          aria-label="Drift (halten)"
        >
          Drift
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 p-4 text-[11px] font-semibold text-white/55" style={{ paddingBottom: 'max(18px, env(safe-area-inset-bottom))' }}>
        {s.lenkArt === 'wischen' || (s.lenkArt === 'neigen' && neigenWeg) ? '👆 hier wischen = lenken' : s.lenkArt === 'neigen' ? '📱 Handy neigen = lenken' : '👆 links / rechts tippen'}
      </div>

      {/* ── Ziel ── */}
      {ziel && (
        <div className="pointer-events-none absolute inset-x-0 top-[18%] flex flex-col items-center kart-ziel">
          <div className="text-5xl font-black italic tracking-tight drop-shadow-[0_3px_0_rgba(0,0,0,0.6)]">ZIEL!</div>
          {vieleFahrer && (
            <div className={`mt-1 text-3xl font-black italic ${ziel.platz === 1 ? 'text-amber-300' : ziel.platz <= 3 ? 'text-sky-200' : 'text-white'}`}>
              {ziel.platz}. Platz {ziel.platz === 1 ? '🏆' : ziel.platz === 2 ? '🥈' : ziel.platz === 3 ? '🥉' : ''}
            </div>
          )}
          {ziel.zeit !== null && <div className="mt-1 font-mono text-lg tabular-nums">{fmtZeit(ziel.zeit)}</div>}
        </div>
      )}
      {ziel && (
        <div className="absolute inset-x-0 bottom-[22%] flex justify-center">
          <button
            type="button"
            onClick={weiter}
            className="rounded-2xl bg-amber-400 px-8 py-3 text-lg font-black text-forest-950 shadow-xl shadow-black/50 active:scale-95"
          >
            Weiter ›
          </button>
        </div>
      )}

      {/* ── Anleitung beim ersten Rennen ── */}
      {anleitung && geladen && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-5">
          <div className="w-full max-w-sm rounded-3xl bg-forest-950/95 p-5 ring-1 ring-amber-400/40">
            <h2 className="text-center text-xl font-black">So fährst du</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex gap-3"><span className="text-2xl" aria-hidden>👆</span><span><strong>Lenken:</strong> Daumen irgendwo aufs Bild legen und nach links oder rechts ziehen. Gas gibt's automatisch.</span></li>
              <li className="flex gap-3"><span className="text-2xl" aria-hidden>🌀</span><span><strong>Drift:</strong> In Kurven <strong>DRIFT halten</strong>. Die Funken werden blau, orange, lila — loslassen gibt Turbo.</span></li>
              <li className="flex gap-3"><span className="text-2xl" aria-hidden>❓</span><span><strong>Kisten</strong> geben Items, <strong>ITEM</strong> tippen setzt sie ein. <strong>Tropfen</strong> 💧 machen dich schneller.</span></li>
              <li className="flex gap-3"><span className="text-2xl" aria-hidden>🚀</span><span><strong>Raketenstart:</strong> DRIFT drücken, sobald die <strong>2</strong> erscheint, und halten.</span></li>
            </ul>
            <button type="button" onClick={anleitungFertig} className="mt-5 w-full rounded-2xl bg-amber-400 py-3 text-lg font-black text-forest-950 active:scale-95">
              Los geht's!
            </button>
          </div>
        </div>
      )}

      {/* ── Pause ── */}
      {pause && (
        <div className="absolute inset-0 grid place-items-center bg-black/75 p-5">
          <div className="w-full max-w-xs space-y-2 rounded-3xl bg-forest-950/95 p-5 ring-1 ring-forest-700/60">
            <h2 className="text-center text-2xl font-black italic">Pause</h2>
            <p className="text-center text-xs text-forest-300">{auftrag.titel}</p>
            <button type="button" onClick={() => pausieren(false)} className="w-full rounded-2xl bg-amber-400 py-3 text-base font-black text-forest-950 active:scale-95">▶ Weiter</button>
            <button type="button" onClick={() => { pausieren(false); onNeustart(); }} className="w-full rounded-xl bg-forest-800 py-2.5 text-sm font-bold active:scale-95">↺ Rennen neu starten</button>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button type="button" onClick={() => onEinstellungen({ ...s, ton: !s.ton })} className="rounded-xl bg-forest-900 py-2 text-sm ring-1 ring-forest-700/60">{s.ton ? '🔊 Ton an' : '🔇 Ton aus'}</button>
              <button type="button" onClick={() => onEinstellungen({ ...s, musik: !s.musik })} className="rounded-xl bg-forest-900 py-2 text-sm ring-1 ring-forest-700/60">{s.musik ? '🎵 Musik an' : '🎵 Musik aus'}</button>
            </div>
            <button
              type="button"
              onClick={() => {
                const reihe: KartEinstellungen['lenkArt'][] = ['wischen', 'neigen', 'tippen'];
                const neu = reihe[(reihe.indexOf(s.lenkArt) + 1) % reihe.length];
                const setzen = () => onEinstellungen({ ...s, lenkArt: neu });
                if (neu === 'neigen') void KartEingabe.neigenErlauben().then((ok) => { if (ok) { setzen(); eingabeRef.current?.kalibriere(); } else onEinstellungen({ ...s, lenkArt: 'tippen' }); });
                else setzen();
              }}
              className="w-full rounded-xl bg-forest-900 py-2 text-sm ring-1 ring-forest-700/60"
            >
              Lenken: {s.lenkArt === 'wischen' ? '👆 Wischen' : s.lenkArt === 'neigen' ? '📱 Neigen' : '👆 Tippen'}
            </button>
            <button type="button" onClick={onAbbruch} className="w-full rounded-xl py-2 text-sm text-rose-200 ring-1 ring-rose-400/30">✕ Beenden</button>
          </div>
        </div>
      )}
    </div>
  );
}

const KART_CSS = `
.kart-platz { color: #fff; text-shadow: 0 3px 0 rgba(0,0,0,.55); }
.kart-platz[data-platz="1"] { color: #ffd23f; }
.kart-platz[data-platz="2"] { color: #e4e9f0; }
.kart-platz[data-platz="3"] { color: #eda963; }
.kart-platz-puls { animation: kartPuls .35s ease-out; }
@keyframes kartPuls { 0% { transform: scale(1.45); } 100% { transform: scale(1); } }
.kart-countdown { font-size: 88px; color: #fff; text-shadow: 0 5px 0 rgba(0,0,0,.5), 0 0 30px rgba(255,200,80,.5); }
.kart-countdown-an { animation: kartCd .9s ease-out both; }
@keyframes kartCd { 0% { transform: scale(2.2); opacity: 0; } 25% { transform: scale(1); opacity: 1; } 80% { opacity: 1; } 100% { transform: scale(.9); opacity: 0; } }
.kart-banner { opacity: 0; font-size: 22px; text-shadow: 0 3px 0 rgba(0,0,0,.55); }
.kart-banner[data-art="gross"] { font-size: 30px; font-style: italic; color: #ffd23f; }
.kart-banner[data-art="warn"] { color: #ffe3e3; }
.kart-banner-an { animation: kartBanner 1.7s ease-out both; }
@keyframes kartBanner { 0% { transform: translateY(12px) scale(.9); opacity: 0; } 12% { transform: none; opacity: 1; } 78% { opacity: 1; } 100% { transform: translateY(-10px); opacity: 0; } }
.kart-ziel { animation: kartZiel .6s cubic-bezier(.2,1.4,.4,1) both; }
@keyframes kartZiel { 0% { transform: scale(.4); opacity: 0; } 100% { transform: none; opacity: 1; } }
.kart-drift-knopf { background: rgba(0,0,0,.42); border: 3px solid rgba(255,255,255,.55); color: #fff; box-shadow: 0 6px 20px rgba(0,0,0,.35); transition: transform .08s, border-color .1s, box-shadow .1s; }
.kart-drift-knopf:active { transform: scale(.94); background: rgba(255,255,255,.18); }
.kart-drift-knopf[data-stufe="0"] { border-color: #dfe7ee; }
.kart-drift-knopf[data-stufe="1"] { border-color: #4fb3ff; box-shadow: 0 0 22px #4fb3ff; }
.kart-drift-knopf[data-stufe="2"] { border-color: #ffa53a; box-shadow: 0 0 26px #ffa53a; }
.kart-drift-knopf[data-stufe="3"] { border-color: #c77dff; box-shadow: 0 0 30px #c77dff; }
.kart-item-knopf { background: rgba(0,0,0,.42); border: 3px solid rgba(255,255,255,.35); color: rgba(255,255,255,.6); }
.kart-item-knopf[data-voll="1"] { border-color: #ffd23f; color: #fff; box-shadow: 0 0 18px rgba(255,210,63,.7); animation: kartItemPuls 1s ease-in-out infinite; }
@keyframes kartItemPuls { 50% { transform: scale(1.07); } }
.kart-knauf { width: 72px; height: 72px; margin: -36px 0 0 -36px; border-radius: 9999px; border: 2px solid rgba(255,255,255,.35); background: rgba(255,255,255,.08); }
.kart-knauf-punkt { position: absolute; left: 22px; top: 22px; width: 28px; height: 28px; border-radius: 9999px; background: rgba(255,255,255,.55); }
.kart-wackeln { animation: kartWackeln 1s ease-in-out infinite; }
@keyframes kartWackeln { 50% { transform: translateY(-6px) rotate(-6deg); } }
@media (prefers-reduced-motion: reduce) {
  .kart-countdown-an, .kart-banner-an, .kart-ziel, .kart-platz-puls, .kart-item-knopf[data-voll="1"], .kart-wackeln { animation-duration: .01s; }
}
`;
