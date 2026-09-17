// Bildschirmschoner des Eingangs-Tablets (Migration 0153).
//
// Ist die Sauna zu, jagt ein lachender Joker das Vereinslogo über den
// Bildschirm. Tippt jemand darauf, bleibt der Joker stehen und lacht ihn aus —
// und der Server meldet die Berührung allen Admins. Freigeben kann nur ein
// Admin über die App (Admin → „Eingangs-Tablet"); bis dahin liegt dieser
// Schirm über allem, was das Tablet sonst zeigt.
//
// Bewegung: reine CSS-Transforms (GPU), keine JS-Timer im Ruhezustand — das
// Tablet läuft die ganze Nacht (Lehre von der TV-Tafel). Logo und Joker
// fahren DIESELBE Bahn (X- und Y-Schwingung mit verschiedenen Perioden =
// Lissajous-Figur), der Joker nur 1,4 s später: er läuft dem Logo exakt
// hinterher, holt an den Wendepunkten fast auf und verpasst es dann doch.
// Die Keyframes stehen in index.css (Abschnitt „Joker-Bildschirmschoner").

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBrandSettings, brandAssetUrl, kioskSperreBeruehrt } from '@/lib/api';

const LACH_DAUER_MS = 4600;

export function JokerSchoner({ oeffnetUm }: { oeffnetUm: string | null }) {
  const brand = useBrandSettings();
  // Erst zeigen, wenn die Branding-Einstellungen da sind — sonst blitzt kurz das Ersatz-Icon auf.
  const logoUrl = brand.isLoading ? null
    : (brand.data?.logo?.icon && brandAssetUrl(brand.data.logo.icon)) || '/icons/icon-512.png';
  const [lacht, setLacht] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);

  // Alles unter dem Schoner stilllegen: keine Klicks, kein Fokus, keine
  // Tastatur — „ohne Freigabe geht nix". Der Schoner selbst hängt per Portal
  // am <body> und bleibt bedienbar.
  useEffect(() => {
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    return () => { root?.removeAttribute('inert'); };
  }, []);

  useEffect(() => {
    const a = new Audio('/kiosk/joker-lachen.mp3');
    a.preload = 'auto';
    audioRef.current = a;
    return () => {
      a.pause();
      audioRef.current = null;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  function angetippt() {
    if (lacht) return;
    setLacht(true);
    const a = audioRef.current;
    if (a) {
      a.currentTime = 0;
      void a.play().catch(() => { /* Ton gesperrt — der Joker lacht dann stumm */ });
    }
    // Der Server drosselt selbst (eine Meldung je 5 Minuten).
    void kioskSperreBeruehrt().catch(() => { /* offline: Anzeige bleibt trotzdem gesperrt */ });
    timerRef.current = window.setTimeout(() => setLacht(false), LACH_DAUER_MS);
  }

  return createPortal(
    <div
      className="joker-schoner fixed inset-0 z-[9990] overflow-hidden select-none"
      role="button"
      aria-label="Bildschirm gesperrt — die Sauna ist geschlossen"
      onPointerDown={angetippt}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Die Jagd läuft unsichtbar weiter, während gelacht wird — danach geht sie nahtlos weiter. */}
      <div className={`joker-buehne ${lacht ? 'joker-buehne--blass' : ''}`} aria-hidden>
        <div className="joker-x joker-vor">
          <div className="joker-y joker-vor-y">
            {logoUrl && <img src={logoUrl} alt="" className="joker-logo" draggable={false} />}
          </div>
        </div>
        <div className="joker-x">
          <div className="joker-y">
            <div className="joker-wende">
              <img src="/kiosk/joker-lauf.webp" alt="" className="joker-laeufer" draggable={false} />
            </div>
          </div>
        </div>
      </div>

      {lacht && (
        <div className="joker-auftritt absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <img src="/kiosk/joker-lacht.webp" alt="" className="joker-lacher" draggable={false} />
          <div className="joker-haha" aria-hidden>HA HA HA!</div>
          <p className="mt-2 text-[clamp(24px,4.6vmin,52px)] font-bold text-amber-200">
            Wir haben geschlossen.
          </p>
          <p className="mt-2 max-w-[30ch] text-[clamp(18px,3.1vmin,34px)] leading-snug text-forest-200/90">
            Der Admin wurde benachrichtigt — nur er kann diesen Bildschirm freigeben.
          </p>
        </div>
      )}

      {!lacht && (
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
