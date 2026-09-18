// Joker-Funk: die TV-Tafel hängt direkt rechts neben dem Eingangs-Tablet, hat
// aber keinen Touch. Tippt jemand am gesperrten Tablet, funkt es das über einen
// Supabase-Realtime-Broadcast — die Tafel lacht sofort mit (mit einem ANDEREN
// Motiv, siehe JokerSchoner). Broadcast braucht weder Tabelle noch RLS und geht
// anonym (gemessen ~40 ms).
//
// Der Kanal ist öffentlich: wer den Anon-Key kennt, kann „tipp" senden. Mehr als
// ein paar Sekunden stummes Joker-Bild auf einem ohnehin gesperrten Schirm löst
// das nicht aus — keine Meldung, kein Zähler (die laufen über die RPC
// kiosk_sperre_beruehrt). Aus der Nutzlast wird nichts angezeigt.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { KioskDisplay } from '@/lib/api';

const KANAL = 'kiosk-joker';
const EREIGNIS = 'tipp';

export type JokerTipp = { von: KioskDisplay; ms: number };

/** Hängt ein gesperrtes Display an den Funk. `onTipp` nur für Empfänger. */
export function jokerFunkVerbinden(onTipp?: (tipp: JokerTipp) => void): {
  senden: (tipp: JokerTipp) => void;
  trennen: () => void;
} {
  let getrennt = false;
  let kanal: RealtimeChannel | null = null;
  let neuTimer: ReturnType<typeof setTimeout> | null = null;
  let versuche = 0;

  const entfernen = (ch: RealtimeChannel) => {
    try { void supabase?.removeChannel(ch).catch(() => { /* egal */ }); } catch { /* egal */ }
  };

  const verbinden = () => {
    if (getrennt || !supabase) return;
    const ch = supabase.channel(KANAL, { config: { broadcast: { self: false } } });
    if (onTipp) {
      ch.on('broadcast', { event: EREIGNIS }, (m) => {
        const p = m.payload as Partial<JokerTipp> | undefined;
        if (!p || typeof p.von !== 'string' || typeof p.ms !== 'number') return;
        onTipp({ von: p.von as KioskDisplay, ms: p.ms });
      });
    }
    ch.subscribe((status) => {
      if (getrennt || kanal !== ch) return;
      if (status === 'SUBSCRIBED') { versuche = 0; return; }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // Wie useRealtimeSync: Kanal wegwerfen und mit Abstand neu aufbauen.
        kanal = null;
        entfernen(ch);
        const pause = [2000, 5000, 10000, 30000, 60000][Math.min(versuche, 4)];
        versuche += 1;
        if (neuTimer) clearTimeout(neuTimer);
        neuTimer = setTimeout(verbinden, pause);
      }
    });
    kanal = ch;
  };

  verbinden();

  return {
    senden: (tipp) => {
      // Nicht verbunden → supabase-js schickt den Broadcast selbst per HTTP.
      try { void kanal?.send({ type: 'broadcast', event: EREIGNIS, payload: tipp }).catch(() => { /* egal */ }); } catch { /* egal */ }
    },
    trennen: () => {
      getrennt = true;
      if (neuTimer) clearTimeout(neuTimer);
      if (kanal) { const ch = kanal; kanal = null; entfernen(ch); }
    },
  };
}
