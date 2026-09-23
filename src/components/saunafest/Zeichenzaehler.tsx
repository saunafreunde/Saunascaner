// Sichtbarer Zeichenzähler, der RUNTERzählt (Vorgabe Christoph 24.09.2026:
// „max 300 Zeichen, mit sichtbarem Zeichenzähler, der runterzählt").
// Gemeinsam für Hinweis/Wünsche im Saunafest-Zeitraum und die Freitextfelder
// der Aufguss-Angaben. Das Feld selbst begrenzt per maxLength; der Zähler
// zeigt nur, wie viel noch geht — ab 10 % Rest in Bernstein, bei 0 in Rosé.

// Gezählt wird wie maxLength (UTF-16-Einheiten) — so zeigt der Zähler nie
// „noch 2", während das Feld schon blockiert. Die DB zählt Zeichen und ist
// damit nie strenger.
export function Zeichenzaehler({ wert, max, className = '' }: { wert: string; max: number; className?: string }) {
  const rest = Math.max(0, max - wert.length);
  const farbe = rest === 0 ? 'text-rose-300' : rest <= Math.ceil(max * 0.1) ? 'text-amber-300' : 'text-forest-400';
  return (
    <span className={`text-[11px] tabular-nums ${farbe} ${className}`} aria-live="polite">
      noch {rest} Zeichen
    </span>
  );
}
