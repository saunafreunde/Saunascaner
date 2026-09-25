import { useEffect, useState } from 'react';
import { audioZustand, beiAudioZustand, unlockAudio } from '@/lib/evacuation';

/**
 * Hält den Ton der Evakuierungs-Sirene entsperrbar und meldet, ob er gesperrt ist.
 *
 * Browser starten Ton erst nach einer Bedienung. Bis 25.09.2026 hing die Sirene
 * der Tafel an einem React-Zustand, der nur bei einem Tastendruck gesetzt wurde:
 * Nach jedem Neuladen (Deploy-Signal, Start-Prüfung, Fehlergrenze) zeigte die
 * Tafel einen Alarm, blieb aber stumm (Audit-Runde 2). Jetzt:
 * - einmal ohne Bedienung versuchen (klappt mit Autoplay-Freigabe des Kiosk-Browsers),
 * - sonst bei jeder Bedienung (Tipp, Klick, Taste der Fernbedienung) erneut,
 *   bis der AudioContext läuft — auch mitten in einem laufenden Alarm und
 *   erneut, wenn er später wieder pausiert (iOS nach Anruf/App-Wechsel),
 * - `true` zurückgeben, solange er gesperrt ist, damit ein Hinweis erscheint.
 * Kein Dauer-Timer: Zustandswechsel kommen als Ereignis, dazu eine einmalige
 * Prüfung kurz nach dem Start (ein frisch angelegter Kontext meldet sich sonst nie).
 */
export function useTonEntsperren(aktiv = true): boolean {
  const [gesperrt, setGesperrt] = useState(false);

  useEffect(() => {
    if (!aktiv) return;
    unlockAudio();
    // Gar kein Web Audio: nichts zu tun, kein Hinweis.
    if (audioZustand() === 'unmoeglich') { setGesperrt(false); return; }

    const EVENTE = ['pointerdown', 'pointerup', 'keydown', 'click'] as const;
    let horcht = false;
    function versuchen() {
      // Nur, wenn der Browser das gerade als Bedienung wertet (Esc oder ein
      // Touch-pointerdown zählen nicht — dann klappt es beim nächsten Ereignis).
      // Ältere TV-Browser ohne userActivation: einfach versuchen.
      const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
      if (ua && !ua.isActive) return;
      unlockAudio();
    }
    // Capture-Phase: greift auch, wenn #root unter dem Joker inert ist.
    const anmelden = () => {
      if (horcht) return;
      horcht = true;
      for (const e of EVENTE) document.addEventListener(e, versuchen, true);
    };
    const abmelden = () => {
      if (!horcht) return;
      horcht = false;
      for (const e of EVENTE) document.removeEventListener(e, versuchen, true);
    };
    const pruefen = () => {
      const z = audioZustand();
      setGesperrt(z === 'gesperrt');
      // Wieder gesperrt (iOS „interrupted" nach Anruf/App-Wechsel, Gerät
      // pausiert den Kontext): wieder auf Bedienung horchen — sonst stünde
      // der Hinweis da, und das Tippen bewirkte nichts (Prüfer Runde 2).
      if (z === 'gesperrt') anmelden(); else abmelden();
    };
    // Zustandswechsel immer mithören — auch wenn der Ton gerade läuft (z. B.
    // Tafel nur zurückgesetzt, nicht neu geladen) und später wieder pausiert.
    const hoererWeg = beiAudioZustand(pruefen);
    let einmal: number | undefined;
    if (audioZustand() === 'gesperrt') {
      anmelden();
      // Einmalige Prüfung: ein frisch angelegter Kontext meldet sich sonst nie.
      einmal = window.setTimeout(pruefen, 2000);
    } else {
      setGesperrt(false);
    }
    return () => {
      abmelden();
      hoererWeg();
      if (einmal !== undefined) window.clearTimeout(einmal);
    };
  }, [aktiv]);

  return aktiv && gesperrt;
}
