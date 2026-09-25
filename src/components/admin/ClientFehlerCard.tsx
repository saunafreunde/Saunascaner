import { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useClientFehler } from '@/lib/api';

// Technische Fehler aus Tafel, Kiosk-Tablets und App (Migration 0188).
// Bewusst schlicht: aufklappen, letzte 7 Tage, gleiche Fehler sind schon
// zusammengefasst (Anzahl). Geladen wird erst beim Aufklappen.
export function ClientFehlerCard() {
  const [offen, setOffen] = useState(false);
  const [details, setDetails] = useState<number | null>(null);
  const liste = useClientFehler(7, offen);
  const eintraege = liste.data ?? [];

  return (
    <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur space-y-3">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="w-full flex items-baseline justify-between gap-2 text-left"
        aria-expanded={offen}
      >
        <div>
          <h2 className="text-base font-semibold text-forest-100">🛠️ Technische Fehler (Geräte)</h2>
          <p className="text-xs text-forest-300/70">
            Abstürze und Fehler aus Tafel, Tablets und App der letzten 7 Tage — für die Fehlersuche.
          </p>
        </div>
        <span className="text-xs text-forest-400">{offen ? '▲' : '▼'}</span>
      </button>

      {offen && (
        <div className="space-y-2">
          {liste.isLoading && <p className="text-xs text-forest-300/70">Lädt…</p>}
          {liste.error && (
            <p className="text-xs text-rose-300">Konnte nicht geladen werden: {(liste.error as Error).message}</p>
          )}
          {!liste.isLoading && !liste.error && eintraege.length === 0 && (
            <p className="text-xs text-forest-300/70">Keine Fehler gemeldet. 🎉</p>
          )}
          {eintraege.map((f) => (
            <div key={f.id} className="rounded-lg bg-forest-900/60 ring-1 ring-forest-800/50 px-3 py-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] text-forest-400">
                <span className="tabular-nums">{format(new Date(f.zuletzt_am), 'dd.MM. HH:mm', { locale: de })}</span>
                <span className="font-mono text-forest-300">{f.route}</span>
                <span>{f.quelle}</span>
                {f.anzahl > 1 && <span className="text-amber-300">{f.anzahl}×</span>}
                <span>{f.angemeldet ? 'angemeldet' : 'ohne Anmeldung'}</span>
              </div>
              <p className="mt-1 text-xs text-rose-200 break-words">{f.meldung}</p>
              {(f.stack || f.geraet) && (
                <button
                  type="button"
                  onClick={() => setDetails(details === f.id ? null : f.id)}
                  className="mt-1 text-[11px] text-forest-400 underline"
                >
                  {details === f.id ? 'Details ausblenden' : 'Details'}
                </button>
              )}
              {details === f.id && (
                <div className="mt-1 space-y-1">
                  {f.geraet && <p className="text-[10px] text-forest-400 break-words">Gerät: {f.geraet}</p>}
                  {f.stack && (
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-black/30 p-2 text-[10px] text-forest-300">
                      {f.stack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
