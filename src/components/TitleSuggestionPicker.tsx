// Picker für 5 AI-generierte Aufguss-Titel-Vorschläge.
//
// User-Wunsch 29.05.2026: vorher EIN AI-Titel der direkt ins Input
// geschrieben wurde — Vorschläge waren sich oft sehr ähnlich, User wollte
// auswählen können. Jetzt: 5 Vorschläge in 5 verschiedenen Stilen
// (poetisch, kurz, mystisch, sinnlich, augenzwinkernd), Click setzt
// den Titel + schließt Picker. "🎲 Neu" generiert nochmal.
//
// Verwendung:
//   const [open, setOpen] = useState(false);
//   ...
//   <button onClick={() => setOpen(true)}>✨ Vorschlagen</button>
//   {open && (
//     <TitleSuggestionPicker
//       attributes={attrs}
//       oils={oils}
//       onPick={(title) => { setTitle(title); setOpen(false); }}
//       onClose={() => setOpen(false)}
//     />
//   )}

import { useEffect, useState } from 'react';
import { useSuggestInfusionTitle } from '@/lib/api';
import { generateInfusionTitle } from '@/lib/titleGenerator';

interface Props {
  attributes: string[];
  oils: string[];
  onPick: (title: string) => void;
  onClose: () => void;
}

const STYLE_LABELS = ['🌿 Poetisch', '⚡ Kurz', '🔮 Mystisch', '🌹 Sinnlich', '😉 Frech'];

export function TitleSuggestionPicker({ attributes, oils, onPick, onClose }: Props) {
  const suggest = useSuggestInfusionTitle();
  const [titles, setTitles] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function fetchTitles() {
    setErr(null);
    try {
      const list = await suggest.mutateAsync({ attributes, oils });
      if (list.length > 0) {
        setTitles(list);
        return;
      }
      // Leere Liste → regelbasiert als 5 Varianten
      setTitles(Array.from({ length: 5 }, () => generateInfusionTitle(attributes, oils)));
    } catch (e) {
      setErr((e as Error).message);
      // Bei API-Outage: 5 regelbasierte Varianten
      setTitles(Array.from({ length: 5 }, () => generateInfusionTitle(attributes, oils)));
    }
  }

  // Initial laden beim Open
  useEffect(() => {
    fetchTitles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ESC zum Schließen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Titel-Vorschläge"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-forest-950/95 ring-1 ring-forest-700/60 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-forest-100">✨ Titel-Vorschläge</h3>
            <p className="text-[11px] text-forest-400 mt-0.5">5 Stile zur Auswahl — Tap zum Übernehmen</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-lg bg-forest-900/80 px-2.5 py-1.5 text-xs text-forest-300 ring-1 ring-forest-700/50 hover:bg-forest-800"
          >
            ✕
          </button>
        </div>

        {suggest.isPending && titles.length === 0 ? (
          <div className="py-12 text-center text-forest-400">
            <div className="text-3xl mb-2">✨</div>
            <p className="text-sm">Vorschläge werden erstellt …</p>
          </div>
        ) : (
          <div className="space-y-2">
            {titles.map((t, i) => (
              <button
                key={`${i}-${t}`}
                type="button"
                onClick={() => onPick(t)}
                className="group w-full rounded-xl bg-forest-900/60 ring-1 ring-forest-800/50 px-3 py-2.5 text-left hover:bg-forest-800/80 hover:ring-amber-500/60 transition active:scale-[0.98]"
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-[10px] uppercase tracking-wider text-forest-500 group-hover:text-amber-400/80 mt-1 flex-shrink-0 w-16">
                    {STYLE_LABELS[i] ?? `Stil ${i + 1}`}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-forest-100 group-hover:text-amber-100 leading-snug">
                    {t}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {err && (
          <p className="mt-3 text-xs text-rose-300/80 text-center">
            {err} — Vorschläge sind regelbasiert.
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={fetchTitles}
            disabled={suggest.isPending}
            className="rounded-lg bg-forest-900/80 px-3 py-1.5 text-xs font-medium text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-800 disabled:opacity-40 transition"
          >
            {suggest.isPending ? '🎲 …' : '🎲 Neu würfeln'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs text-forest-400 hover:text-forest-200 transition"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
