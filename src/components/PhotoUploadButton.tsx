import { useEffect, useState } from 'react';
import { useUploadMemberPhoto } from '@/lib/api';

interface Props {
  uploaderId: string;
}

/**
 * Button + Modal: Mitglied lädt ein Event-Foto mit optionaler Caption hoch.
 * Bilder werden vor dem Upload automatisch komprimiert (siehe uploadAsset).
 */
export function PhotoUploadButton({ uploaderId }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const upload = useUploadMemberPhoto();

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const u = URL.createObjectURL(file);
    setPreviewUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  function reset() {
    setFile(null);
    setCaption('');
    setError(null);
    setPreviewUrl(null);
  }

  function close() {
    if (upload.isPending) return;
    reset();
    setOpen(false);
  }

  async function submit() {
    setError(null);
    if (!file) { setError('Bitte ein Bild auswählen.'); return; }
    try {
      await upload.mutateAsync({ uploaderId, file, caption: caption.trim() || null });
      close();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-amber-900/40 px-3 py-2 text-sm font-medium text-amber-200 ring-1 ring-amber-700/40 hover:bg-amber-900/70 transition"
      >
        📸 Foto hochladen
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/70"
          onClick={close}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-slate-900 ring-1 ring-forest-700/50 p-4 max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-forest-200">Event- oder Sauna-Foto</h3>
              <button onClick={close} className="text-forest-400 hover:text-forest-200 text-lg leading-none" aria-label="Schließen">✕</button>
            </div>

            <label className="block">
              <span className="text-xs text-forest-300">Bild auswählen — wird automatisch verkleinert.</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (!f.type.startsWith('image/')) {
                      setError('Bitte ein Bild auswählen.');
                      return;
                    }
                    setFile(f);
                    setError(null);
                  }
                }}
                className="mt-2 block w-full text-sm text-forest-200 file:mr-3 file:rounded-lg file:border-0 file:bg-forest-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-forest-100 hover:file:bg-forest-600"
              />
            </label>

            {previewUrl && (
              <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-forest-700/40">
                <img src={previewUrl} alt="Vorschau" className="block w-full max-h-72 object-contain bg-black" />
              </div>
            )}

            <div className="mt-3">
              <label className="text-xs text-forest-300">Beschreibung (optional, max. 280 Zeichen)</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 280))}
                rows={2}
                placeholder="z.B. Aufguss-Abend mit Eukalyptus, Juni-Sauna"
                className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
              />
              <span className="text-[10px] text-forest-500 tabular-nums">{caption.length}/280</span>
            </div>

            {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={upload.isPending}
                className="rounded-lg bg-forest-900/70 px-3 py-2 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!file || upload.isPending}
                className="rounded-lg bg-forest-500 px-4 py-2 text-xs font-semibold text-forest-950 hover:bg-forest-400 transition disabled:opacity-60"
              >
                {upload.isPending ? 'Lädt hoch …' : 'Hochladen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default PhotoUploadButton;
