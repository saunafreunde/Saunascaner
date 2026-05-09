import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  publicAssetUrl, useMemberPhotos, useDeleteMemberPhoto, type MemberPhoto,
} from '@/lib/api';
import { Avatar } from './Avatar';

interface Props {
  /** Aktuelle Member-ID (für Lösch-Recht). Null = nicht eingeloggt. */
  currentMemberId?: string | null;
  isAdmin?: boolean;
}

const TILE_WIDTH_PX = 280;     // Breite einer Karussell-Kachel
const SPEED_PX_PER_SEC = 30;   // Marquee-Geschwindigkeit
const REFRESH_MS = 60_000;     // Auto-Refetch alle 60s

/**
 * Auto-laufendes Foto-Karussell. Tap auf Foto öffnet Lightbox.
 * Pausiert bei Hover/Touch, läuft endlos durch (Marquee mit doppeltem Track).
 */
export function PhotoCarousel({ currentMemberId, isAdmin }: Props) {
  const photosQ = useMemberPhotos(30);
  const photos = useMemo(
    () => (photosQ.data ?? []).filter((p) => p.approved),
    [photosQ.data],
  );

  const [paused, setPaused] = useState(false);
  const [active, setActive] = useState<MemberPhoto | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // Periodisches Refetch — neue Uploads erscheinen automatisch
  useEffect(() => {
    const t = setInterval(() => photosQ.refetch(), REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marquee-Loop via requestAnimationFrame
  useEffect(() => {
    const track = trackRef.current;
    if (!track || photos.length === 0) return;

    function tick(ts: number) {
      const last = lastTsRef.current;
      lastTsRef.current = ts;
      if (last && !paused && track) {
        const dt = (ts - last) / 1000;
        offsetRef.current += SPEED_PX_PER_SEC * dt;
        // Halbe Track-Breite ist die Wiederholungsperiode (doppelt gerenderte Kacheln)
        const half = track.scrollWidth / 2;
        if (half > 0 && offsetRef.current >= half) {
          offsetRef.current -= half;
        }
        track.style.transform = `translateX(-${offsetRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [photos.length, paused]);

  if (photosQ.isLoading) {
    return (
      <div className="rounded-2xl bg-forest-950/60 ring-1 ring-forest-800/40 p-6 text-center text-sm text-forest-400/70">
        Lade Galerie…
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="rounded-2xl bg-forest-950/60 ring-1 ring-forest-800/40 p-6 text-center text-sm text-forest-400/70">
        Noch keine Fotos. Tippe oben auf <span className="text-amber-300">📸 Foto hochladen</span>, um den Anfang zu machen.
      </div>
    );
  }

  // Doppelter Track für endloses Marquee
  const items = [...photos, ...photos];

  return (
    <>
      <div
        className="relative overflow-hidden rounded-2xl bg-forest-950/60 ring-1 ring-forest-800/40"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {/* Soft-Gradient links/rechts für nicht-abrupten Rand */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-forest-950/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-forest-950/80 to-transparent" />

        <div ref={trackRef} className="flex gap-3 py-3 pl-3 will-change-transform">
          {items.map((p, idx) => (
            <button
              key={`${p.id}-${idx}`}
              type="button"
              onClick={() => setActive(p)}
              className="group relative shrink-0 overflow-hidden rounded-xl ring-1 ring-forest-700/40 hover:ring-amber-400/60 transition"
              style={{ width: TILE_WIDTH_PX }}
            >
              <div className="aspect-[16/10] w-full bg-forest-900">
                <img
                  src={publicAssetUrl(p.photo_path) ?? ''}
                  alt={p.caption ?? 'Foto'}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </div>
              {p.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-2.5 text-left">
                  <p className="line-clamp-2 text-[11px] text-forest-100">{p.caption}</p>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {active && (
        <PhotoLightbox
          photo={active}
          currentMemberId={currentMemberId}
          isAdmin={!!isAdmin}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}

function PhotoLightbox({
  photo, onClose, currentMemberId, isAdmin,
}: {
  photo: MemberPhoto;
  onClose: () => void;
  currentMemberId?: string | null;
  isAdmin: boolean;
}) {
  const del = useDeleteMemberPhoto();
  const canDelete = isAdmin || photo.uploader_id === currentMemberId;
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return; }
    try {
      await del.mutateAsync({ id: photo.id, photo_path: photo.photo_path });
      onClose();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const url = publicAssetUrl(photo.photo_path);
  const created = new Date(photo.created_at);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-forest-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-black/50 text-white ring-1 ring-white/20 hover:bg-black/70"
          aria-label="Schließen"
        >
          ✕
        </button>
        {url && (
          <div className="bg-black">
            <img
              src={url}
              alt={photo.caption ?? 'Foto'}
              className="mx-auto block max-h-[70vh] w-auto object-contain"
            />
          </div>
        )}
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-3">
            <Avatar
              name={photo.uploader_name}
              avatarPath={photo.uploader_avatar_path}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-forest-100 truncate">
                {photo.uploader_sauna_name ? `„${photo.uploader_sauna_name}"` : photo.uploader_name}
              </p>
              <p className="text-[11px] text-forest-400">
                {format(created, 'd. MMMM yyyy · HH:mm', { locale: de })}
              </p>
            </div>
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={del.isPending}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition disabled:opacity-50 ${
                  confirming
                    ? 'bg-rose-600 text-white ring-rose-500 hover:bg-rose-500'
                    : 'bg-rose-900/40 text-rose-200 ring-rose-800/50 hover:bg-rose-900/60'
                }`}
              >
                {confirming ? '✓ Wirklich löschen?' : del.isPending ? '…' : '🗑️ Löschen'}
              </button>
            )}
          </div>
          {photo.caption && (
            <p className="text-sm text-forest-200/90 leading-relaxed">{photo.caption}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default PhotoCarousel;
