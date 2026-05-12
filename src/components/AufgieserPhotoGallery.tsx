import { useRef, useState } from 'react';
import {
  useAufgieserPhotos, useAddAufgieserPhoto, useDeleteAufgieserPhoto,
  publicAssetUrl,
} from '@/lib/api';

interface Props {
  memberId: string;
  editable?: boolean;
}

// Foto-Galerie eines Aufgießers — max 8 Bilder, Karussell-/Grid-Mix.
// Im edit-Modus: Upload-Button + Delete pro Foto.
export function AufgieserPhotoGallery({ memberId, editable = false }: Props) {
  const photos = useAufgieserPhotos(memberId);
  const add = useAddAufgieserPhoto();
  const del = useDeleteAufgieserPhoto();
  const inputRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = photos.data ?? [];
  const canAddMore = editable && list.length < 8;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setError(null);
    try {
      await add.mutateAsync({ memberId, file });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!editable && list.length === 0) return null;

  return (
    <section className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4">
      <div className="flex items-end justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400/90">📷 Foto-Galerie</h3>
        {editable && (
          <span className="text-[10px] text-forest-400 tabular-nums">{list.length} / 8</span>
        )}
      </div>

      {list.length === 0 && editable ? (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={add.isPending}
          className="w-full aspect-video rounded-xl border-2 border-dashed border-forest-700/60 bg-forest-900/40 text-forest-400 hover:border-amber-500/60 hover:text-amber-300 transition flex flex-col items-center justify-center gap-2 disabled:opacity-50"
        >
          <span className="text-3xl">+</span>
          <span className="text-sm">{add.isPending ? 'Lädt hoch…' : 'Erstes Foto hinzufügen'}</span>
        </button>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {list.map((p, idx) => {
            const url = publicAssetUrl(p.photo_path);
            if (!url) return null;
            return (
              <div key={p.id} className="group relative aspect-square rounded-xl overflow-hidden ring-1 ring-forest-800/40 bg-forest-900">
                <img
                  src={url}
                  alt={p.caption ?? ''}
                  className="w-full h-full object-cover cursor-pointer transition hover:scale-105"
                  loading="lazy"
                  onClick={() => setLightbox(idx)}
                />
                {editable && (
                  <button
                    onClick={async () => {
                      if (!window.confirm('Foto wirklich löschen?')) return;
                      await del.mutateAsync({ id: p.id, memberId });
                    }}
                    className="absolute top-1 right-1 h-7 w-7 rounded-full bg-black/60 text-red-300 ring-1 ring-red-500/30 opacity-0 group-hover:opacity-100 hover:bg-red-900/80 transition flex items-center justify-center text-sm"
                    title="Foto löschen"
                  >
                    🗑
                  </button>
                )}
              </div>
            );
          })}
          {canAddMore && (
            <button
              onClick={() => inputRef.current?.click()}
              disabled={add.isPending}
              className="aspect-square rounded-xl border-2 border-dashed border-forest-700/60 bg-forest-900/40 text-forest-400 hover:border-amber-500/60 hover:text-amber-300 transition flex flex-col items-center justify-center disabled:opacity-50"
            >
              <span className="text-3xl">+</span>
              <span className="text-[10px] mt-1">{add.isPending ? 'Lädt…' : 'Foto'}</span>
            </button>
          )}
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

      {error && (
        <div className="mt-3 rounded-lg bg-red-900/40 ring-1 ring-red-700/50 px-3 py-2 text-xs text-red-200">{error}</div>
      )}

      {/* Lightbox */}
      {lightbox !== null && list[lightbox] && (
        <Lightbox
          photo={list[lightbox]}
          hasPrev={lightbox > 0}
          hasNext={lightbox < list.length - 1}
          onPrev={() => setLightbox((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setLightbox((i) => (i !== null && i < list.length - 1 ? i + 1 : i))}
          onClose={() => setLightbox(null)}
        />
      )}
    </section>
  );
}

function Lightbox({ photo, hasPrev, hasNext, onPrev, onNext, onClose }: {
  photo: { photo_path: string; caption: string | null };
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const url = publicAssetUrl(photo.photo_path);
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur"
      onClick={onClose}
    >
      <button onClick={onClose} className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/60 text-white text-2xl hover:bg-black/80">×</button>
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 h-12 w-12 rounded-full bg-black/60 text-white text-2xl hover:bg-black/80"
        >
          ‹
        </button>
      )}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 h-12 w-12 rounded-full bg-black/60 text-white text-2xl hover:bg-black/80"
        >
          ›
        </button>
      )}
      <div className="max-w-4xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        {url && <img src={url} alt={photo.caption ?? ''} className="max-h-[85vh] w-auto rounded-2xl shadow-2xl" />}
        {photo.caption && <p className="mt-3 text-sm text-white/90 text-center">{photo.caption}</p>}
      </div>
    </div>
  );
}
