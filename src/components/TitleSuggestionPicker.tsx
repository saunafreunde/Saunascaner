// Picker für 5 Aufguss-Titel-Vorschläge in unterschiedlichen Stilen.
//
// ── Zwei Wege, einer davon immer verfügbar ──
// 1. KI (api/ai.ts, Claude Haiku): bekommt ALLE Zutaten im Klartext plus
//    Sauna, Uhrzeit und Jahreszeit. Liefert Titel, die den Aufguss wirklich
//    treffen.
// 2. Regeln (lib/titleGenerator.ts): ohne Netz, ohne Schlüssel, ohne
//    Wartezeit. Greift, wenn der Aufruf scheitert — etwa weil
//    ANTHROPIC_API_KEY in Vercel fehlt oder das WLAN im Vereinsraum muckt.
//
// Der Fallback ist kein Notnagel, sondern der Normalfall, solange kein
// Schlüssel hinterlegt ist. Deshalb wird er sofort angezeigt und erst
// überschrieben, wenn die KI antwortet — niemand wartet auf einen leeren
// Dialog.

import { useEffect, useMemo, useState } from 'react';
import { generateInfusionTitles, type StyledTitle } from '@/lib/titleGenerator';
import { zutatenLeer, type TitelZutaten } from '@/lib/titelZutaten';

interface Props {
  zutaten: TitelZutaten;
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

export function TitleSuggestionPicker({ zutaten, onPick, onClose }: Props) {
  const [seed, setSeed] = useState(() => Date.now());
  const regelTitel = generateInfusionTitles(zutaten, seed);

  // Stabiler Schluessel statt der Objekt-Referenz: `zutaten` wird vom
  // Aufrufer bei JEDEM Render neu gebaut (zutatenAus(...)). Als
  // Effect-Abhaengigkeit haette das bei jedem Elternrender einen neuen
  // KI-Aufruf ausgeloest — der Planer rendert sekuendlich.
  const zutatenKey = useMemo(() => JSON.stringify(zutaten), [zutaten]);

  const [kiTitel, setKiTitel] = useState<string[] | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [kiFehler, setKiFehler] = useState<string | null>(null);

  // KI bei jedem Öffnen und jedem Würfeln anfragen. Abbruch über AbortController,
  // damit ein spätes Ergebnis nicht einen neueren Wurf überschreibt.
  useEffect(() => {
    if (zutatenLeer(zutaten)) { setKiTitel(null); return; }
    const ctrl = new AbortController();
    setLaedt(true);
    setKiFehler(null);
    fetch('/api/ai?action=suggest-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zutaten, variation: seed }),
      signal: ctrl.signal,
    })
      .then(async (r) => {
        const daten = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(daten?.error ?? `HTTP ${r.status}`);
        const t = Array.isArray(daten?.titles) ? daten.titles.filter((x: unknown) => typeof x === 'string') : [];
        if (t.length === 0) throw new Error('keine Vorschläge erhalten');
        setKiTitel(t);
      })
      .catch((e) => {
        if ((e as Error).name === 'AbortError') return;
        setKiTitel(null);
        setKiFehler((e as Error).message);
      })
      .finally(() => { if (!ctrl.signal.aborted) setLaedt(false); });
    return () => ctrl.abort();
    // zutaten bewusst NICHT in der Liste — der Schluessel vertritt es.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zutatenKey, seed]);

  // Anzeige: KI wenn da, sonst Regeln. Die Stil-Etiketten bleiben dieselben —
  // die KI liefert ihre fünf in derselben Reihenfolge.
  const anzeige: StyledTitle[] = kiTitel
    ? kiTitel.slice(0, 5).map((t, i) => ({ style: regelTitel[i]?.style ?? 'kurz', title: t }))
    : regelTitel;

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
            <p className="text-[11px] text-forest-400 mt-0.5">
              {laedt ? 'KI denkt nach…' : kiTitel ? '✨ von der KI · Tap zum Übernehmen' : '5 Stile zur Auswahl — Tap zum Übernehmen'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-lg bg-forest-900/80 px-2.5 py-1.5 text-xs text-forest-300 ring-1 ring-forest-700/50 hover:bg-forest-800"
          >
            ✕
          </button>
        </div>

        <div className={`space-y-2 transition-opacity ${laedt ? 'opacity-60' : ''}`}>
          {anzeige.map(({ style, title }, i) => (
            <button
              key={`${style}-${i}`}
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

        {/* Der Fehler wird genannt, aber nicht dramatisiert: die Liste oben ist
            trotzdem brauchbar. Nur wer wissen will, warum kein ✨ dasteht,
            liest hier weiter. */}
        {kiFehler && !laedt && (
          <p className="mt-2 text-[10px] text-forest-500 leading-snug">
            KI nicht erreichbar ({kiFehler}) — die Vorschläge oben kommen aus den Wortregeln.
          </p>
        )}

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
