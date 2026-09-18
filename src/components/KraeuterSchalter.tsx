// Schalter „Reiner Kräuteraufguss" — sitzt im Öle-Reiter aller drei Formulare
// (Planer, Bearbeiten-Dialog, Öl-Raum-Tablet), genau dort, wo die Pflicht
// „3 Öle" meldet.
//
// Eingeführt 18.09.2026 (Vorgabe Christoph): für reine Kräuteraufgüsse legten
// Aufgießer Platzhalter-Öle an, um die Öl-Pflicht zu erfüllen. Der Schalter
// setzt das Attribut 'kraeuteraufguss' (lib/aufgussTheme.ts): die Öl-Pflicht
// entfällt, die Öl-Plätze werden geleert, und die Tafel zeigt die Kachel mit
// Kräuter-Motiv und „🌿 Kräuter"-Badge. Die Logik steckt in
// kraeuterUmschalten() (lib/aufgussRegeln.ts) — hier nur die Optik, gleich
// gebaut wie der Räuchern-Schalter.

import { KRAEUTER_THEME } from '@/lib/aufgussTheme';

export function KraeuterSchalter({ an, onToggle }: { an: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={an}
      className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left ring-1 transition"
      style={an
        ? { background: `${KRAEUTER_THEME.color}55`, boxShadow: `inset 0 0 0 2px ${KRAEUTER_THEME.color}` }
        : { background: 'rgba(20,83,45,0.35)', boxShadow: 'inset 0 0 0 1px rgba(20,83,45,0.7)' }}
    >
      <span className={`relative h-6 w-10 flex-shrink-0 rounded-full transition ${an ? 'bg-slate-200' : 'bg-forest-800'}`}>
        <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${an ? 'translate-x-4' : ''}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-forest-100">🌿 Reiner Kräuteraufguss</span>
        <span className="block text-[11px] text-forest-300/70">
          {an
            ? 'ohne Öl — erscheint mit Kräuter-Bild auf der Tafel'
            : 'frische oder getrocknete Kräuter statt Öl — die Öl-Pflicht entfällt'}
        </span>
      </span>
    </button>
  );
}
