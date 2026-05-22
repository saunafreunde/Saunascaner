import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  useInfusions, useCreateFeedPost, uploadAsset,
} from '@/lib/api';
import { OIL_BY_ID, OIL_BY_NUMBER, OILS_BY_CATEGORY, CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/oils';
import { Portal } from '@/components/Portal';

type Props = {
  defaultInfusionId?: string | null;
  onClose: () => void;
  onPosted?: () => void;
};

const CAPTION_MAX = 280;
const MAX_OILS = 3;

export function FeedComposeModal({ defaultInfusionId = null, onClose, onPosted }: Props) {
  const create = useCreateFeedPost();
  const infusionsQ = useInfusions();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [infusionId, setInfusionId] = useState<string | null>(defaultInfusionId);
  const [oils, setOils] = useState<string[]>([]);
  const [showOilPicker, setShowOilPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Letzte 24h Aufgüsse (für Anker-Picker)
  const anchorOptions = useMemo(() => {
    const now = Date.now();
    const start = now - 24 * 3600_000;
    return (infusionsQ.data ?? [])
      .filter((i) => !i.is_personal_fallback && i.saunameister_id)
      .filter((i) => {
        const t = new Date(i.start_time).getTime();
        return t >= start && t <= now + 12 * 3600_000;
      })
      .sort((a, b) => +new Date(b.start_time) - +new Date(a.start_time))
      .slice(0, 20);
  }, [infusionsQ.data]);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Nur Bilder erlaubt.'); return; }
    if (f.size > 8 * 1024 * 1024) { setError('Bild zu groß (max 8 MB).'); return; }
    setError(null);
    setFile(f);
  }

  function toggleOil(oilId: string) {
    setOils((prev) => {
      if (prev.includes(oilId)) return prev.filter((x) => x !== oilId);
      if (prev.length >= MAX_OILS) return prev;
      return [...prev, oilId];
    });
  }

  async function submit() {
    setError(null);
    if (!file) { setError('Bitte Bild auswählen.'); return; }
    if (caption.length > CAPTION_MAX) { setError(`Caption zu lang (max ${CAPTION_MAX}).`); return; }
    setBusy(true);
    try {
      const path = await uploadAsset(file, 'feed-posts');
      await create.mutateAsync({
        imagePath: path,
        caption: caption.trim() || null,
        infusionId,
        oils,
      });
      onPosted?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:p-3" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-forest-950 ring-1 ring-forest-700/50 max-h-screen-dvh sm:max-h-[92vh] sm:rounded-2xl rounded-t-2xl overflow-y-auto pb-safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-forest-800/40">
          <h2 className="text-base font-semibold text-forest-100">📸 Neuer Beitrag</h2>
          <button onClick={onClose} className="text-forest-300 hover:text-forest-100 text-xl">×</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Bild */}
          <div>
            {previewUrl ? (
              <div className="relative aspect-square rounded-xl overflow-hidden ring-1 ring-forest-700/50">
                <img src={previewUrl} alt="Vorschau" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full px-2 py-1 text-xs hover:bg-black/80"
                >Anderes Bild</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-square rounded-xl bg-forest-900/40 ring-2 ring-dashed ring-forest-700/50 hover:bg-forest-900/60 transition flex flex-col items-center justify-center gap-2 text-forest-300"
              >
                <span className="text-4xl">📷</span>
                <span className="text-sm font-medium">Bild auswählen</span>
                <span className="text-[10px] text-forest-500">max 8 MB · wird automatisch komprimiert</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPickFile}
              className="hidden"
            />
          </div>

          {/* Caption */}
          <div>
            <label className="text-xs text-forest-300">Caption <span className="text-forest-500">(optional)</span></label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
              rows={3}
              placeholder={'z. B. Eukalyptus war heute krass'}
              className="mt-1.5 w-full rounded-lg bg-forest-900/60 ring-1 ring-forest-700/50 px-3 py-2 text-sm text-forest-100 placeholder-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-400"
            />
            <div className="mt-1 flex justify-end text-[10px] text-forest-500 tabular-nums">{caption.length}/{CAPTION_MAX}</div>
          </div>

          {/* Aufguss-Anker */}
          <div>
            <label className="text-xs text-forest-300">🧖 An Aufguss heften <span className="text-forest-500">(optional)</span></label>
            <select
              value={infusionId ?? ''}
              onChange={(e) => setInfusionId(e.target.value || null)}
              className="mt-1.5 w-full rounded-lg bg-forest-900/60 ring-1 ring-forest-700/50 px-3 py-2 text-sm text-forest-100 focus:outline-none focus:ring-2 focus:ring-forest-400"
            >
              <option value="">— kein Anker —</option>
              {anchorOptions.map((i) => (
                <option key={i.id} value={i.id}>
                  {format(new Date(i.start_time), 'EEE HH:mm')} · {i.title}
                </option>
              ))}
            </select>
          </div>

          {/* Aromen */}
          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-xs text-forest-300">🌿 Aromen <span className="text-forest-500">(max {MAX_OILS})</span></label>
              <button
                type="button"
                onClick={() => setShowOilPicker(true)}
                className="text-[11px] text-emerald-300 hover:text-emerald-200 underline"
              >+ Aroma wählen</button>
            </div>
            {oils.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {oils.map((oilId) => {
                  const o = OIL_BY_ID[oilId];
                  if (!o) return null;
                  return (
                    <button
                      key={oilId}
                      type="button"
                      onClick={() => toggleOil(oilId)}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-900/50 ring-1 ring-emerald-700/40 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-800/70"
                      title="Entfernen"
                    >
                      <span className="rounded bg-emerald-950/70 px-1 text-[10px] tabular-nums">#{o.number}</span>
                      <span>{o.emoji}</span>
                      <span>{o.name}</span>
                      <span className="text-emerald-400 ml-0.5">×</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/30">{error}</div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-xl bg-forest-900/70 px-4 py-3 text-sm font-medium text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900 transition disabled:opacity-50"
            >Abbrechen</button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !file}
              className="flex-1 rounded-xl bg-forest-500 px-4 py-3 text-sm font-semibold text-forest-950 hover:bg-forest-400 transition disabled:opacity-50"
            >{busy ? 'Lade hoch…' : 'Posten'}</button>
          </div>
        </div>

        {showOilPicker && (
          <FeedOilPicker
            selected={oils}
            onToggle={toggleOil}
            onClose={() => setShowOilPicker(false)}
            maxOils={MAX_OILS}
          />
        )}
      </div>
    </div>
    </Portal>
  );
}

// Einfacher Aroma-Picker für den Feed-Composer (max N freie Aromen statt 3-Runden-Slots)
function FeedOilPicker({
  selected, onToggle, onClose, maxOils,
}: { selected: string[]; onToggle: (id: string) => void; onClose: () => void; maxOils: number }) {
  const [num, setNum] = useState('');

  function pickByNumber() {
    const n = parseInt(num, 10);
    if (!Number.isFinite(n) || !OIL_BY_NUMBER[n]) return;
    onToggle(OIL_BY_NUMBER[n].id);
    setNum('');
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 sm:p-3" onClick={onClose}>
      <div className="w-full max-w-2xl bg-forest-950 ring-1 ring-emerald-700/40 p-4 max-h-screen-dvh sm:max-h-[85vh] sm:rounded-2xl rounded-t-2xl overflow-y-auto pb-safe-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-emerald-100">🌿 Aromen wählen ({selected.length}/{maxOils})</h3>
          <button onClick={onClose} className="text-emerald-200 hover:text-white text-xl">×</button>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            value={num}
            onChange={(e) => setNum(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') pickByNumber(); }}
            placeholder="Nummer eingeben"
            inputMode="numeric"
            className="flex-1 rounded-lg bg-forest-900/60 ring-1 ring-forest-700/50 px-3 py-2 text-sm text-forest-100"
          />
          <button onClick={pickByNumber} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-600">Hinzu</button>
        </div>

        {CATEGORY_ORDER.map((cat) => {
          const oils = OILS_BY_CATEGORY[cat] ?? [];
          if (!oils.length) return null;
          return (
            <div key={cat} className="mb-3">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300/70 font-bold mb-1.5">{CATEGORY_LABELS[cat]}</div>
              <div className="flex flex-wrap gap-1.5">
                {oils.map((o) => {
                  const active = selected.includes(o.id);
                  const full = !active && selected.length >= maxOils;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => onToggle(o.id)}
                      disabled={full}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ring-1 transition ${
                        active
                          ? 'bg-emerald-500 text-emerald-950 ring-emerald-400 font-semibold'
                          : full
                            ? 'bg-forest-900/30 text-forest-500 ring-forest-800/30 opacity-40 cursor-not-allowed'
                            : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                      }`}
                    >
                      <span className="rounded bg-black/30 px-1 text-[9px] tabular-nums">#{o.number}</span>
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
    </div>
    </Portal>
  );
}
