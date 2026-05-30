// Picker für 5 Aufguss-Titel-Vorschläge in unterschiedlichen Stilen.
//
// User-Wunsch 30.05.2026: vorher Anthropic-API-Call (Claude Haiku),
// jetzt 100 % regelbasiert via generateInfusionTitles().
// Vorteile gegenüber AI:
//   - 0 API-Kosten, kein Vercel-Env nötig
//   - Instant (kein Network-Call → ~0 ms)
//   - Funktioniert offline (Auch auf der Sauna-Tafel oder im Vereinsraum
//     wenn das WLAN gerade muckt)
//   - Keine Rate-Limits
//   - 100 % vorhersagbar (für Tests)
//
// Stile: 🌿 Poetisch · ⚡ Kurz · 🔮 Mystisch · 🌹 Sinnlich · 😉 Frech

import { useEffect, useState } from 'react';
import { generateInfusionTitles, type StyledTitle } from '@/lib/titleGenerator';

interface Props {
  attributes: string[];
  oils: string[];
  onPick: (title: string) => void;
  onClose: () => void;
}

const STYLE_LABEL: Record<StyledTitle['style'], string> = {
  poetisch: '🌿 Poetisch',
  kurz:     '⚡ Kurz',
  mystisch: '🔮 Mystisch',
  sinnlich: '🌹 Sinnlich',
  frech:    '😉 Frech',
};

export function TitleSuggestionPicker({ attributes, oils, onPick, onClose }: Props) {
  const [seed, setSeed] = useState(() => Date.now());
  // Re-Generate bei seed-Wechsel (auch initial)
  const titles = generateInfusionTitles(attributes, oils, seed);

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

        <div className="space-y-2">
          {titles.map(({ style, title }) => (
            <button
              key={style}
              type="button"
              onClick={() => onPick(title)}
              className="group w-full rounded-xl bg-forest-900/60 ring-1 ring-forest-800/50 px-3 py-2.5 text-left hover:bg-forest-800/80 hover:ring-amber-500/60 transition active:scale-[0.98]"
            >
              <div className="flex items-start gap-2.5">
                <span className="text-[10px] uppercase tracking-wider text-forest-500 group-hover:text-amber-400/80 mt-1 flex-shrink-0 w-16">
                  {STYLE_LABEL[style]}
                </span>
                <span className="flex-1 text-sm font-semibold text-forest-100 group-hover:text-amber-100 leading-snug">
                  {title}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSeed(Date.now() + Math.floor(Math.random() * 99999))}
            className="rounded-lg bg-forest-900/80 px-3 py-1.5 text-xs font-medium text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-800 transition"
          >
            🎲 Neu würfeln
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
