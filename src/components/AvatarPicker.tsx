import { useEffect, useMemo, useState } from 'react';
import { uploadAsset, useSetAvatar } from '@/lib/api';
import {
  DICEBEAR_STYLES, dicebearUrl, makeDicebearPath, randomSeed, resolveAvatarUrl,
} from '@/lib/avatar';
import { Avatar } from './Avatar';

type Tab = 'photo' | 'generate';

interface Props {
  member: { id: string; name: string; sauna_name: string | null; avatar_path: string | null; is_aufgieser?: boolean };
  onClose: () => void;
}

const AVATAR_SIZE = 512; // Quadrat-Output

/**
 * Modal mit zwei Tabs: Foto-Upload (Center-Crop) ODER DiceBear-Generator.
 * Speichert direkt via `set_my_avatar`-RPC.
 */
export default function AvatarPicker({ member, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('photo');
  const setAvatar = useSetAvatar();

  // Foto-Tab State
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Generator-Tab State
  const initialStyle = (() => {
    if (member.avatar_path?.startsWith('dicebear:')) {
      const parts = member.avatar_path.split(':');
      return parts[1] ?? DICEBEAR_STYLES[0].id;
    }
    return DICEBEAR_STYLES[0].id;
  })();
  const [style, setStyle] = useState<string>(initialStyle);
  const [seeds, setSeeds] = useState<string[]>(() => {
    // 8 Vorschläge initial
    const arr: string[] = [];
    for (let i = 0; i < 8; i++) arr.push(randomSeed());
    // wenn aktuelles Avatar schon ein dicebear ist und der Style match, ersten Seed übernehmen
    if (member.avatar_path?.startsWith(`dicebear:${initialStyle}:`)) {
      const parts = member.avatar_path.split(':');
      const seed = parts.slice(2).join(':');
      if (seed) arr[0] = seed;
    }
    return arr;
  });
  const [genBusy, setGenBusy] = useState(false);

  // Vorschau-URL für Foto-Datei
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const u = URL.createObjectURL(file);
    setPreviewUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhotoError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setPhotoError('Bitte ein Bild auswählen.');
      return;
    }
    setFile(f);
  }

  async function squareCrop(file: File, targetSize: number = AVATAR_SIZE): Promise<File> {
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) throw new Error('Bild konnte nicht geladen werden.');

    // Center-Crop auf Quadrat
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close?.(); throw new Error('Canvas nicht verfügbar.'); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, targetSize, targetSize);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (!blob) throw new Error('Bild konnte nicht erzeugt werden.');
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'avatar';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  }

  async function savePhoto() {
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const cropped = await squareCrop(file, AVATAR_SIZE);
      const path = await uploadAsset(cropped, 'avatars');
      await setAvatar.mutateAsync(path);
      onClose();
    } catch (e) {
      setPhotoError((e as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function chooseDicebear(seed: string) {
    setGenBusy(true);
    try {
      await setAvatar.mutateAsync(makeDicebearPath(style, seed));
      onClose();
    } catch (e) {
      setPhotoError((e as Error).message);
    } finally {
      setGenBusy(false);
    }
  }

  function rerollSeeds() {
    setSeeds(Array.from({ length: 8 }, () => randomSeed()));
  }

  async function removeAvatar() {
    setPhotoBusy(true);
    try {
      await setAvatar.mutateAsync(null);
      onClose();
    } catch (e) {
      setPhotoError((e as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }

  const currentUrl = useMemo(() => resolveAvatarUrl(member.avatar_path, 256), [member.avatar_path]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-slate-900 ring-1 ring-forest-700/50 p-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-forest-200">Avatar wählen</h3>
          <button onClick={onClose} className="text-forest-400 hover:text-forest-200 text-lg leading-none" aria-label="Schließen">✕</button>
        </div>

        {/* Aktueller Avatar + Entfernen */}
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-forest-950/60 p-3 ring-1 ring-forest-800/50">
          <Avatar name={member.name} avatarPath={member.avatar_path} size="lg" isAufgieser={member.is_aufgieser} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-forest-200">Aktueller Avatar</p>
            <p className="text-[11px] text-forest-400">
              {member.avatar_path?.startsWith('dicebear:') ? 'Generiert' : currentUrl ? 'Foto' : 'Initial-Kachel'}
            </p>
          </div>
          {member.avatar_path && (
            <button
              type="button"
              onClick={removeAvatar}
              disabled={photoBusy || setAvatar.isPending}
              className="rounded-lg bg-rose-900/40 px-3 py-1.5 text-xs text-rose-200 ring-1 ring-rose-800/50 hover:bg-rose-900/60 transition disabled:opacity-50"
            >
              Entfernen
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setTab('photo')}
            className={`rounded-xl px-3 py-2.5 text-sm font-medium ring-1 transition ${
              tab === 'photo'
                ? 'bg-forest-500 text-forest-950 ring-forest-400'
                : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
            }`}
          >
            📷 Foto hochladen
          </button>
          <button
            type="button"
            onClick={() => setTab('generate')}
            className={`rounded-xl px-3 py-2.5 text-sm font-medium ring-1 transition ${
              tab === 'generate'
                ? 'bg-forest-500 text-forest-950 ring-forest-400'
                : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
            }`}
          >
            ✨ Generieren
          </button>
        </div>

        {tab === 'photo' && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-forest-300">Bild auswählen — wird automatisch quadratisch zugeschnitten und auf 512×512 verkleinert.</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="mt-2 block w-full text-sm text-forest-200 file:mr-3 file:rounded-lg file:border-0 file:bg-forest-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-forest-100 hover:file:bg-forest-600"
              />
            </label>
            {previewUrl && (
              <div className="flex items-center gap-3 rounded-xl bg-forest-950/60 p-3 ring-1 ring-forest-800/50">
                <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl ring-2 ring-forest-700/40">
                  <img src={previewUrl} alt="Vorschau" className="h-full w-full object-cover" />
                </div>
                <div className="text-xs text-forest-300/80">
                  <p>Vorschau (Center-Crop wird angewendet).</p>
                  <p className="mt-1 text-forest-400">Quadrat-Ausschnitt aus der Mitte des Bildes.</p>
                </div>
              </div>
            )}
            {photoError && <p className="text-xs text-rose-300">{photoError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-forest-900/70 px-3 py-2 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={savePhoto}
                disabled={!file || photoBusy || setAvatar.isPending}
                className="rounded-lg bg-forest-500 px-4 py-2 text-xs font-semibold text-forest-950 hover:bg-forest-400 transition disabled:opacity-60"
              >
                {photoBusy || setAvatar.isPending ? 'Lädt hoch …' : 'Speichern'}
              </button>
            </div>
          </div>
        )}

        {tab === 'generate' && (
          <div className="space-y-3">
            {/* Stil-Auswahl */}
            <div>
              <p className="text-xs text-forest-300 mb-2">Stil wählen:</p>
              <div className="flex flex-wrap gap-1.5">
                {DICEBEAR_STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyle(s.id)}
                    title={s.hint}
                    className={`rounded-full px-3 py-1.5 text-xs ring-1 transition ${
                      style === s.id
                        ? 'bg-forest-500 text-forest-950 ring-forest-400 font-semibold'
                        : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vorschauen */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-forest-300">Tippe auf einen Avatar zum Speichern:</p>
                <button
                  type="button"
                  onClick={rerollSeeds}
                  className="rounded-lg bg-forest-900/70 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900 transition"
                >
                  🎲 Würfeln
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {seeds.map((seed) => (
                  <button
                    key={seed}
                    type="button"
                    onClick={() => chooseDicebear(seed)}
                    disabled={genBusy || setAvatar.isPending}
                    className="group relative aspect-square overflow-hidden rounded-2xl bg-forest-900/60 ring-1 ring-forest-700/40 hover:ring-forest-400 transition disabled:opacity-50"
                    title={`Stil ${style} · Seed ${seed}`}
                  >
                    <img
                      src={dicebearUrl(style, seed, 128)}
                      alt={`Avatar ${seed}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            {photoError && <p className="text-xs text-rose-300">{photoError}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-forest-900/70 px-3 py-2 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
