import { useMemo, useState } from 'react';
import { useSetMyFavoriteOils } from '@/lib/api';
import { OILS, OILS_BY_CATEGORY, type OilCategory } from '@/lib/oils';

interface DisplayProps {
  oilIds: string[];
  accent?: string;
}

const CATEGORY_LABEL: Record<OilCategory, string> = {
  zitrus:   'Zitrus',
  holz:     'Holz',
  gewuerz:  'Gewürz',
  kraut:    'Kraut',
  minze:    'Minze',
  sonstige: 'Sonstige',
};

// Aroma-Wolke — read-only Anzeige der Lieblings-Öle eines Aufgießers.
export function FavoriteOilsDisplay({ oilIds, accent = '#f59e0b' }: DisplayProps) {
  if (!oilIds || oilIds.length === 0) return null;
  const oils = oilIds
    .map((id) => OILS.find((o) => o.id === id))
    .filter((o): o is NonNullable<typeof o> => !!o);
  if (oils.length === 0) return null;

  return (
    <section className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4">
      <div className="flex items-end justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400/90">🌿 Lieblings-Aromen</h3>
      </div>
      <p className="text-xs text-forest-300/80 mb-3">
        Diese Düfte gehören zum Stil-Repertoire:
      </p>
      <div className="flex flex-wrap gap-2">
        {oils.map((o) => (
          <span
            key={o.id}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1"
            style={{
              background: `${accent}1f`,
              color: '#f5deb3',
              borderColor: `${accent}66`,
              boxShadow: `inset 0 0 0 1px ${accent}55`,
            }}
          >
            <span>{o.emoji}</span>
            <span>{o.name}</span>
            <span className="text-[10px] text-forest-400 tabular-nums">#{o.number}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

interface PickerProps {
  current: string[];
  onClose: () => void;
}

// Editor — max 5 Öle auswählbar, gruppiert nach Kategorie.
export function FavoriteOilsPicker({ current, onClose }: PickerProps) {
  const [selected, setSelected] = useState<string[]>(current.slice(0, 5));
  const [error, setError] = useState<string | null>(null);
  const save = useSetMyFavoriteOils();

  const categories = useMemo(() => Object.keys(OILS_BY_CATEGORY) as OilCategory[], []);

  const toggle = (id: string) => {
    setError(null);
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 5) {
        setError('Maximal 5 Lieblings-Öle.');
        return cur;
      }
      return [...cur, id];
    });
  };

  async function handleSave() {
    try {
      await save.mutateAsync(selected);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="max-w-2xl w-full max-h-[85dvh] flex flex-col rounded-3xl bg-forest-950 ring-1 ring-forest-700/60 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-5 border-b border-forest-800/40">
          <div>
            <h2 className="text-lg font-semibold text-forest-100">Lieblings-Aromen</h2>
            <p className="text-xs text-forest-400">Wähle bis zu 5 — werden auf deinem Profil als Aroma-Wolke gezeigt.</p>
          </div>
          <span className="text-sm tabular-nums text-amber-300 font-semibold">{selected.length} / 5</span>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {categories.map((cat) => {
            const oils = OILS_BY_CATEGORY[cat];
            if (!oils || oils.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-forest-400 mb-2">{CATEGORY_LABEL[cat]}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {oils.map((o) => {
                    const isSelected = selected.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        onClick={() => toggle(o.id)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs ring-1 transition ${
                          isSelected
                            ? 'bg-amber-500/20 text-amber-200 ring-amber-500/50'
                            : 'bg-forest-900/60 text-forest-300 ring-forest-800/50 hover:bg-forest-800/70'
                        }`}
                      >
                        <span>{o.emoji}</span>
                        <span>{o.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mx-5 mb-3 rounded-lg bg-red-900/40 ring-1 ring-red-700/50 px-3 py-2 text-xs text-red-200">{error}</div>
        )}

        <footer className="p-5 border-t border-forest-800/40 flex gap-3">
          <button
            onClick={handleSave}
            disabled={save.isPending}
            className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
          >
            {save.isPending ? 'Speichert…' : 'Speichern'}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-forest-900/70 px-4 py-2.5 text-sm text-forest-300 ring-1 ring-forest-700/50 hover:bg-forest-800/70"
          >
            Abbrechen
          </button>
        </footer>
      </div>
    </div>
  );
}
