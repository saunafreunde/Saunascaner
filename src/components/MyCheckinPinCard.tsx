import { useState } from 'react';
import { useMyCheckinPin, useRotateMyCheckinPin } from '@/lib/api';

// Zeigt den eigenen 4-stelligen Checkin-PIN für das Sauna-Tablet.
// Standardmäßig versteckt — Tap auf "Anzeigen" macht ihn sichtbar.
// "Neu generieren"-Button wenn man vermutet er ist abhanden gekommen.
export function MyCheckinPinCard() {
  const pinQ = useMyCheckinPin();
  const rotate = useRotateMyCheckinPin();
  const [visible, setVisible] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);

  const pin = pinQ.data;
  if (!pin) return null; // Aufgießer/Mitglieder ohne PIN sehen die Karte nicht

  return (
    <section className="rounded-2xl bg-gradient-to-br from-amber-900/15 via-forest-950/85 to-forest-950/85 ring-1 ring-amber-500/30 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
          🔢 Dein Sauna-PIN
        </h3>
        <button
          onClick={() => setVisible((v) => !v)}
          className="text-[11px] text-amber-300 hover:text-amber-200 underline"
        >
          {visible ? 'Verstecken' : 'Anzeigen'}
        </button>
      </div>

      <div className="flex justify-center gap-2">
        {pin.split('').map((d, i) => (
          <div
            key={i}
            className="h-16 w-12 rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-700/30 ring-2 ring-amber-500/40 flex items-center justify-center text-4xl font-black tabular-nums text-amber-200"
          >
            {visible ? d : '●'}
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-forest-300/80 leading-relaxed text-center">
        Diesen PIN tippst du am Sauna-Tablet ein, um Aufgüsse bewerten zu können.
      </p>

      {!showRotateConfirm ? (
        <button
          onClick={() => setShowRotateConfirm(true)}
          className="mt-3 w-full text-[11px] text-forest-400 hover:text-amber-300 underline"
        >
          PIN ist mir abhanden — neuen generieren
        </button>
      ) : (
        <div className="mt-3 rounded-lg bg-forest-900/60 ring-1 ring-amber-500/30 p-3 text-center">
          <p className="text-xs text-forest-200">
            Sicher? Dein bisheriger PIN wird ungültig.
          </p>
          <div className="mt-2 flex gap-2 justify-center">
            <button
              onClick={async () => {
                await rotate.mutateAsync();
                setShowRotateConfirm(false);
                setVisible(true);
              }}
              disabled={rotate.isPending}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {rotate.isPending ? 'Generiere…' : 'Ja, neuen PIN'}
            </button>
            <button
              onClick={() => setShowRotateConfirm(false)}
              className="rounded-lg bg-forest-900 px-3 py-1.5 text-xs text-forest-300 ring-1 ring-forest-700/50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
