// /koppeln#<token> — koppelt dieses Gerät als Kiosk (Migration 0177).
//
// Der Link kommt aus Admin → Displays → „Kiosk-Geräte". Das Token steht im
// Hash (#), damit es in keinem Server- oder Analytics-Log landet. Die Seite
// prüft es beim Server, speichert es im localStorage und bietet den Sprung auf
// die passende Kiosk-Seite an. Ohne gültiges Token passiert nichts.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { KIOSK_GERAET_ARTEN, kioskGeraetSpeichern, type KioskGeraetArt } from '@/lib/kioskGeraet';

type Zustand =
  | { phase: 'pruefe' }
  | { phase: 'ok'; art: KioskGeraetArt; name: string }
  | { phase: 'fehler'; text: string };

export default function Koppeln() {
  const nav = useNavigate();
  const [zustand, setZustand] = useState<Zustand>({ phase: 'pruefe' });

  useEffect(() => {
    const token = window.location.hash.replace(/^#/, '').trim();
    // Token sofort aus der Adresszeile nehmen (Verlauf, Screenshots).
    window.history.replaceState(null, '', window.location.pathname);
    if (!/^[0-9a-f]{64}$/.test(token)) {
      setZustand({ phase: 'fehler', text: 'Der Kopplungs-Link ist unvollständig. Bitte den Link aus dem Admin-Bereich komplett öffnen.' });
      return;
    }
    (async () => {
      try {
        if (!supabase) throw new Error('Keine Verbindung zum Server.');
        const { data, error } = await supabase.rpc('kiosk_geraet_pruefen', { p_token: token });
        if (error) throw error;
        const d = (data ?? {}) as { ok?: boolean; art?: KioskGeraetArt; name?: string };
        if (!d.ok || !d.art) {
          setZustand({ phase: 'fehler', text: 'Dieser Link ist ungültig oder wurde widerrufen. Bitte im Admin-Bereich einen neuen erzeugen.' });
          return;
        }
        kioskGeraetSpeichern(token);
        setZustand({ phase: 'ok', art: d.art, name: d.name ?? '' });
      } catch (e) {
        setZustand({ phase: 'fehler', text: `Prüfung fehlgeschlagen: ${(e as Error).message}` });
      }
    })();
  }, []);

  const ziel = zustand.phase === 'ok' ? KIOSK_GERAET_ARTEN.find((a) => a.art === zustand.art) : undefined;

  return (
    <div className="min-h-screen bg-schwarzwald-soft grid place-items-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-forest-950/85 p-7 text-center ring-1 ring-forest-700/50 backdrop-blur">
        {zustand.phase === 'pruefe' && (
          <p className="text-forest-200">Gerät wird gekoppelt …</p>
        )}
        {zustand.phase === 'fehler' && (
          <>
            <div className="text-5xl">⚠️</div>
            <h1 className="mt-3 text-xl font-semibold text-forest-100">Kopplung nicht möglich</h1>
            <p className="mt-2 text-sm text-forest-300">{zustand.text}</p>
          </>
        )}
        {zustand.phase === 'ok' && (
          <>
            <div className="text-5xl">✅</div>
            <h1 className="mt-3 text-xl font-semibold text-forest-100">Gerät gekoppelt</h1>
            <p className="mt-2 text-sm text-forest-300">
              „{zustand.name}" ist jetzt als <strong className="text-amber-300">{ziel?.label ?? zustand.art}</strong> freigeschaltet.
              Die Kopplung bleibt in diesem Browser gespeichert.
            </p>
            {ziel && (
              <button
                onClick={() => nav(ziel.ziel, { replace: true })}
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500"
              >
                Weiter zu {ziel.label}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
