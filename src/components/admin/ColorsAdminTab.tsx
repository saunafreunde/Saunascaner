import { useEffect, useState } from 'react';
import { ATTRIBUTES } from '@/lib/attributes';
import { OILS_BY_CATEGORY, CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/oils';
import {
  useAttributeColors, useOilColors,
  useSetAttributeColor, useSetOilColor,
} from '@/lib/api';

// Admin: Farben pro Attribut + Öl anpassen.
// Default-Farbe: leer = Sauna-Akzent (Attribute) bzw. amber (Öle).
// Speichert in system_config('attribute_colors') / ('oil_colors') als jsonb { id: '#hex' }.

const PRESETS = [
  '#22c55e', // emerald
  '#10b981', // green
  '#3b82f6', // blue
  '#0ea5e9', // sky
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#f43f5e', // rose
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#64748b', // slate
];

export function ColorsAdminTab() {
  const attrColors = useAttributeColors();
  const oilColors = useOilColors();
  const setAttr = useSetAttributeColor();
  const setOil = useSetOilColor();
  const [tab, setTab] = useState<'attributes' | 'oils'>('attributes');

  // Pro-Row Feedback: welcher Eintrag wurde zuletzt gespeichert? Zeigt 1s grünes ✓
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Pro-Row Loading-State: nur die geklickte Row ist disabled, nicht alle
  const [pendingId, setPendingId] = useState<string | null>(null);

  function flashSaved(id: string) {
    setSavedId(id);
    setTimeout(() => setSavedId((cur) => (cur === id ? null : cur)), 1000);
  }

  async function saveAttr(attrId: string, color: string | null) {
    setErrorMsg(null);
    setPendingId(attrId);
    try {
      await setAttr.mutateAsync({ attr: attrId, color });
      flashSaved(attrId);
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      setErrorMsg(`${attrId}: ${msg}`);
      // eslint-disable-next-line no-console
      console.error('[set_attribute_color] error', attrId, color, e);
    } finally {
      setPendingId(null);
    }
  }

  async function saveOil(oilId: string, color: string | null) {
    setErrorMsg(null);
    setPendingId(oilId);
    try {
      await setOil.mutateAsync({ oil: oilId, color });
      flashSaved(oilId);
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      setErrorMsg(`${oilId}: ${msg}`);
      // eslint-disable-next-line no-console
      console.error('[set_oil_color] error', oilId, color, e);
    } finally {
      setPendingId(null);
    }
  }

  // Errors automatisch nach 5s wegblenden
  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(null), 5000);
    return () => clearTimeout(t);
  }, [errorMsg]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
        <h2 className="text-base font-semibold text-forest-100">🎨 Farben für Aufguss-Tags</h2>
        <p className="mt-1 text-xs text-forest-300/70">
          Stelle pro Eigenschaft (Attribut) und pro Öl eine eigene Farbe ein.
          Wirkt sofort auf der TV-Tafel + Planner. Leerlassen = Standard-Farbe der Sauna.
        </p>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setTab('attributes')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === 'attributes'
                ? 'bg-amber-500 text-amber-950'
                : 'bg-forest-900/60 text-forest-300 hover:bg-forest-900 ring-1 ring-forest-700/50'
            }`}
          >
            Eigenschaften ({ATTRIBUTES.length})
          </button>
          <button
            onClick={() => setTab('oils')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === 'oils'
                ? 'bg-amber-500 text-amber-950'
                : 'bg-forest-900/60 text-forest-300 hover:bg-forest-900 ring-1 ring-forest-700/50'
            }`}
          >
            Öle
          </button>
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-lg bg-rose-950/60 ring-1 ring-rose-800/40 px-3 py-2 text-sm text-rose-300">
          ⚠️ {errorMsg}
        </div>
      )}

      {tab === 'attributes' && (
        <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50">
          <ul className="space-y-2">
            {ATTRIBUTES.map((a) => {
              const cur = attrColors.data?.[a.id] ?? '';
              return (
                <ColorRow
                  key={a.id}
                  emoji={a.emoji}
                  label={a.label}
                  color={cur}
                  busy={pendingId === a.id}
                  saved={savedId === a.id}
                  onChange={(c) => saveAttr(a.id, c)}
                  onReset={() => saveAttr(a.id, null)}
                />
              );
            })}
          </ul>
        </section>
      )}

      {tab === 'oils' && (
        <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50">
          {CATEGORY_ORDER.map((cat) => {
            const oils = OILS_BY_CATEGORY[cat] ?? [];
            if (oils.length === 0) return null;
            return (
              <div key={cat} className="mb-5">
                <h3 className="text-xs font-semibold text-forest-300 uppercase tracking-wider mb-2">
                  {CATEGORY_LABELS[cat]}
                </h3>
                <ul className="space-y-2">
                  {oils.map((o) => {
                    const cur = oilColors.data?.[o.id] ?? '';
                    return (
                      <ColorRow
                        key={o.id}
                        emoji={o.emoji}
                        label={`${o.number}. ${o.name}`}
                        color={cur}
                        busy={pendingId === o.id}
                        saved={savedId === o.id}
                        onChange={(c) => saveOil(o.id, c)}
                        onReset={() => saveOil(o.id, null)}
                      />
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function ColorRow({
  emoji,
  label,
  color,
  busy,
  saved,
  onChange,
  onReset,
}: {
  emoji: string;
  label: string;
  color: string;
  busy: boolean;
  saved: boolean;
  onChange: (color: string) => void;
  onReset: () => void;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg px-3 py-2 ring-1 transition ${
        saved ? 'bg-emerald-900/40 ring-emerald-500/50' : 'bg-forest-900/40 ring-forest-800/30'
      }`}
      style={{ borderLeft: color ? `4px solid ${color}` : '4px solid transparent' }}
    >
      <span className="text-xl flex-shrink-0">{emoji}</span>
      <span className="flex-1 min-w-0 text-sm font-medium text-forest-100 truncate">
        {label}
        {saved && <span className="ml-2 text-emerald-300 text-xs">✅ gespeichert</span>}
        {busy && <span className="ml-2 text-amber-300 text-xs animate-pulse">…speichert</span>}
      </span>
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Preset-Buttons */}
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            disabled={busy}
            title={p}
            className={`h-6 w-6 rounded-full ring-1 transition disabled:opacity-40 ${
              color.toLowerCase() === p.toLowerCase()
                ? 'ring-2 ring-white scale-110'
                : 'ring-forest-700/50 hover:scale-110'
            }`}
            style={{ background: p }}
          />
        ))}
        {/* Native Color-Picker für Custom */}
        <input
          type="color"
          value={color || '#22c55e'}
          onChange={(e) => onChange(e.target.value)}
          disabled={busy}
          className="h-7 w-7 rounded-md bg-transparent border-none cursor-pointer disabled:opacity-40 ml-1"
          title="Eigene Farbe wählen"
        />
        {/* Reset */}
        <button
          type="button"
          onClick={onReset}
          disabled={busy || !color}
          className="ml-1 rounded-md bg-forest-900/70 ring-1 ring-forest-700/40 px-2 py-1 text-[10px] text-forest-300 hover:bg-forest-800 disabled:opacity-30"
          title="Zurück zur Standard-Farbe"
        >
          ↺
        </button>
      </div>
    </li>
  );
}
