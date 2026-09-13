// Rotes Vollbild bei einem Banja-Umgehungsversuch.
//
// Warum so laut: das Banja ist ein Privileg mit eigener Dauer, Ruhestunde und
// zwei Kacheln auf der Tafel. Wer es sich an der Freigabe vorbei nimmt, tut
// das nicht aus Versehen — ein grauer Fehlertext daneben wäre die falsche
// Antwort. Der Bildschirm steht 20 Sekunden und lässt sich nicht wegklicken:
// genau lange genug, dass es unangenehm ist und sich niemand ein zweites Mal
// dranmacht.
//
// Die Glocke ist bewusst NICHT der Evakuierungston aus lib/evacuation.ts.
// Der bedeutet „alle raus" und darf nie für etwas anderes stehen — hier
// klingt es nach Schulglocke, nicht nach Feueralarm.

import { useEffect, useRef, useState } from 'react';
import { Portal } from '@/components/Portal';

const DAUER_S = 20;

/** Zwei Glockenschläge aus dem Nichts — kein Sample, keine Datei.
 *  Läuft nur, wenn der Browser Ton erlaubt; der Aufruf kommt aus dem Klick
 *  auf „Speichern", die Geste ist also da. Bleibt es still, steht das rote
 *  Fenster trotzdem — der Ton ist die Zugabe, nicht die Botschaft. */
function laeuteGlocke() {
  try {
    const Ctx = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const schlag = (start: number) => {
      // Grundton + zwei unharmonische Obertöne: so klingt Metall, ein
      // einzelner Sinus klingt nach Telefon.
      [784, 1174, 1568].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        const spitze = 0.32 / (i + 1);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        g.gain.exponentialRampToValueAtTime(spitze, ctx.currentTime + start + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 1.6);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + start);
        o.stop(ctx.currentTime + start + 1.7);
      });
    };
    schlag(0);
    schlag(0.6);
    window.setTimeout(() => { void ctx.close(); }, 3000);
  } catch { /* Ton ist Kür, nie Pflicht */ }
}

export function BanjaAlarm({ grund, onClose }: { grund: string; onClose: () => void }) {
  const [rest, setRest] = useState(DAUER_S);
  const geschlossen = useRef(false);

  useEffect(() => {
    laeuteGlocke();
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([400, 200, 400]);
    }
    const t = window.setInterval(() => {
      setRest((r) => {
        if (r <= 1) {
          window.clearInterval(t);
          if (!geschlossen.current) { geschlossen.current = true; onClose(); }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [onClose]);

  return (
    <Portal>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Betrugsversuch"
        className="fixed inset-0 z-[9999] flex flex-col overflow-y-auto p-6 banja-alarm-blitz"
        style={{ background: 'rgba(70,0,0,0.94)' }}
      >
        {/* m-auto statt items-center: zentriert, solange Platz ist, und gibt ihn
            kampflos ab, wenn nicht. items-center schiebt bei zu wenig Hoehe den
            Kopf des Inhalts aus dem scrollbaren Bereich — quer auf dem Handy
            waere die Glocke dann unerreichbar. */}
        <div className="m-auto w-full max-w-2xl text-center">
          <div
            className="banja-alarm-glocke leading-none"
            style={{ fontSize: 'clamp(48px,min(16vw,17vh),140px)' }}
          >
            🔔
          </div>
          <h1
            className="font-black uppercase text-red-100 leading-none"
            style={{ marginTop: 'clamp(8px,2vh,16px)', fontSize: 'clamp(30px,min(9vw,11vh),66px)', letterSpacing: '0.04em' }}
          >
            {/* Weiches Trennzeichen (U+00AD): am Desktop unsichtbar, auf dem
                Handy bricht das Wort sauber in BETRUGS- / VERSUCH. Ohne das
                lief es dort 66-127px ueber den Rand — ein Wort umbricht nicht.
                Bewusst als Escape und nicht als unsichtbares Zeichen. */}
            Betrugs{'\u00AD'}versuch
          </h1>
          <p className="text-red-100" style={{ marginTop: 'clamp(10px,2.5vh,20px)', fontSize: 'clamp(16px,min(3.4vw,4.4vh),30px)' }}>
            {grund}
          </p>
          <p className="font-bold text-red-50" style={{ marginTop: 'clamp(12px,3vh,24px)', fontSize: 'clamp(18px,min(3.8vw,4.8vh),34px)' }}>
            Der Admin wurde informiert.
          </p>
          <p className="mt-2 font-black text-amber-300" style={{ fontSize: 'clamp(20px,min(4.2vw,5.2vh),38px)' }}>
            Christoph wird sich freuen!!!
          </p>
          <div style={{ marginTop: 'clamp(14px,4vh,32px)' }}>
            <div className="text-red-200/80 text-sm uppercase tracking-[0.2em]">Dieses Fenster schließt in</div>
            <div className="font-black tabular-nums text-red-50" style={{ fontSize: 'clamp(40px,min(12vw,13vh),96px)' }}>
              {rest}
            </div>
            {/* Ablaufbalken — läuft in 20 s leer. Reines CSS, kein zweiter Timer. */}
            <div className="mx-auto mt-2 h-2 w-64 overflow-hidden rounded-full bg-red-950/70">
              <div
                className="h-full rounded-full bg-red-300"
                style={{ width: `${(rest / DAUER_S) * 100}%`, transition: 'width 1s linear' }}
              />
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/** Hat die Datenbank den Versuch abgewiesen? Erkannt wird das am Präfix
 *  BANJA_SPERRE (Migration 0149) — NICHT am deutschen Wortlaut, der sich mit
 *  dem nächsten Tippfehler-Fix ändern würde. */
export function istBanjaSperre(fehler: unknown): boolean {
  const text = (fehler as { message?: string })?.message ?? String(fehler ?? '');
  return text.includes('BANJA_SPERRE');
}

/** Der Grund ohne technisches Präfix, für die Anzeige. */
export function banjaGrund(fehler: unknown): string {
  const text = (fehler as { message?: string })?.message ?? String(fehler ?? '');
  const i = text.indexOf('BANJA_SPERRE:');
  return i >= 0 ? text.slice(i + 'BANJA_SPERRE:'.length).trim() : text;
}
