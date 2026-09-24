// Joker-Auftritte als One-Shot-Effekte der Bühne (Admin → 🎭 Bühne → 🃏 Joker).
// Vorgabe Christoph 24.09.2026: „den Joker auch unter Bühne anklicken können,
// um ihn zu testen und bei Bedarf auch mal einzuspielen".
//
// Dieselben Bilder und Lachen wie der Bildschirmschoner (kiosk/JokerSchoner),
// aber OHNE dessen Sprüche übers Geschlossen-Sein — eingespielt wird ja auch
// mitten im Betrieb, dann sollen Gäste nicht „Wir haben geschlossen" lesen.
//
// Der Auftritt hängt per Portal am <body> (z 9991). So erscheint er auch auf
// einer gesperrten Tafel: dort blendet der Schoner (z 9990) #root aus, in dem
// der EffectPlayer sitzt. Die Evakuierung (z 9999) bleibt immer darüber.
//
// Ton: siehe lib/jokerTon. Sperrt der Browser das Lachen, zeigt der Auftritt
// klein denselben Hinweis wie der Schoner.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TON, NACHBAR, LACHER, GLOECKCHEN } from '@/components/kiosk/JokerSchoner';
import { jokerTonSpielen, jokerTonStoppen } from '@/lib/jokerTon';

type Variante = 'lacht' | 'ausraster' | 'raucher' | 'kuckuck' | 'rueber';
type Wahl = { ton: keyof typeof TON; ruf: string; bild?: string };

function zufall<T>(liste: readonly T[]): T {
  return liste[Math.floor(Math.random() * liste.length)];
}

function waehlen(variante: Variante): Wahl {
  switch (variante) {
    case 'lacht':     return { ton: 'a', ruf: 'HA HA HA!' };
    case 'ausraster': return { ton: 'irre', ruf: 'HA HA HA HA HA!' };
    case 'raucher':   return { ton: 'raucher', ruf: 'HA HA HA HA HA!' };
    case 'kuckuck':   return { ton: 'kuckuck', ruf: 'KUCKUCK!' };
    case 'rueber': {
      const motiv = zufall(NACHBAR);
      return { ton: zufall(LACHER), ruf: motiv.ruf, bild: motiv.bild };
    }
  }
}

function JokerAuftritt({ variante }: { variante: Variante }) {
  // Motiv und Lachen einmal beim Einblenden würfeln — ein Re-Render wechselt nichts.
  const [wahl] = useState(() => waehlen(variante));
  const [tonGesperrt, setTonGesperrt] = useState(false);
  const [vorbei, setVorbei] = useState(false);

  useEffect(() => {
    jokerTonSpielen(TON[wahl.ton].src).then(
      () => setTonGesperrt(false),
      (e: unknown) => { if (e instanceof DOMException && e.name === 'NotAllowedError') setTonGesperrt(true); },
    );
    // Das Bild endet mit dem Lachen. Der EffectPlayer hält den Baustein noch
    // nachlaufMs länger — erst sein Abbau hält den Ton an (der dann schon aus ist).
    const t = window.setTimeout(() => setVorbei(true), TON[wahl.ton].ms);
    return () => { window.clearTimeout(t); jokerTonStoppen(); };
  }, [wahl]);

  if (vorbei) return null;
  const gross = variante === 'ausraster' || variante === 'raucher';

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[9991] overflow-hidden select-none" aria-hidden>
      <div className="joker-effekt-grund" />

      <div className="joker-regen">
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

      {variante === 'rueber' && wahl.bild ? (
        <div className="joker-auftritt absolute inset-0">
          <div className="joker-nachbar">
            <div className="joker-nachbar-figur">
              <img src={wahl.bild} alt="" draggable={false} />
            </div>
            <div className="joker-nachbar-text">
              <div className="joker-haha joker-haha--nachbar">{wahl.ruf}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="joker-auftritt absolute inset-0">
          <div className={`flex h-full flex-col items-center justify-center px-6 text-center ${gross ? 'joker-wackler' : ''}`}>
            {variante === 'kuckuck' ? (
              <div className="joker-uhr">
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
            <div className={`joker-haha ${gross ? 'joker-haha--gross' : ''}`}>{wahl.ruf}</div>
          </div>
        </div>
      )}

      {tonGesperrt && (
        <div className="joker-ton-hinweis">
          {window.location.pathname.startsWith('/dashboard')
            ? '🔇 Ton gesperrt — einmal OK auf der Fernbedienung drücken'
            : '🔇 Ton vom Browser gesperrt — einmal auf die Seite tippen und noch mal abspielen'}
        </div>
      )}
    </div>,
    document.body,
  );
}

export function JokerLacht() { return <JokerAuftritt variante="lacht" />; }
export function JokerRastetAus() { return <JokerAuftritt variante="ausraster" />; }
export function JokerRaucherlache() { return <JokerAuftritt variante="raucher" />; }
export function JokerKuckuck() { return <JokerAuftritt variante="kuckuck" />; }
export function JokerSchautRueber() { return <JokerAuftritt variante="rueber" />; }
