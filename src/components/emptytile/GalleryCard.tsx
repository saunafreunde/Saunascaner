import { publicAssetUrl } from '@/lib/api';
import { AusschnittBild } from '@/components/AusschnittBild';
import type { GalleryPhoto } from '@/types/branding';

/** Vereins-Fotogalerie — eine Karte im Slot-Karussell leerer Tafel-Kacheln.
 *
 *  Zeigt ein vom Admin hochgeladenes Foto formatfüllend mit langsamem
 *  Ken-Burns-Zoom und optionaler Bildunterschrift. Kein eigener Speicher:
 *  die Pfade stehen in brand_settings.slot_gallery (jsonb in system_config,
 *  anon lesbar über die Policy config_read_public) — daher ohne Migration.
 *
 *  WICHTIG: die Pfade sind Storage-PFADE, keine URLs. Ohne publicAssetUrl()
 *  landet "slot-gallery/<uuid>.jpg" roh im CSS und wird relativ zu /dashboard
 *  aufgelöst — genau daran sind die Tile-Hintergründe schon einmal gescheitert.
 */
export function GalleryCard({ photo }: { photo: GalleryPhoto }) {
  const url = publicAssetUrl(photo.image_path);
  if (!url) return null;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* Zwei Ebenen mit klarer Aufgabenteilung:
          außen der langsame Ken-Burns-Zoom (Pure-CSS, nur transform),
          innen der vom Admin gewählte Ausschnitt. Getrennt, weil sich sonst
          zwei transform-Werte auf demselben Element überschrieben — die
          Animation hätte den Ausschnitt-Zoom einfach ersetzt.
          Die Bildunterschrift liegt außerhalb und steht dadurch ruhig. */}
      <div className="slot-kenburns absolute inset-0">
        <AusschnittBild url={url} ausschnitt={photo.ausschnitt} />
      </div>
      {/* Verlauf von links: trägt Uhrzeit-Pille, Sauna-Pin und die
          Bildunterschrift, ohne das Foto rechts zuzudecken. */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.30) 38%, rgba(0,0,0,0) 62%)' }}
      />
      {photo.caption && (
        <div
          className="absolute text-white font-bold leading-tight"
          style={{
            left: 'clamp(10px, 2.2cqh, 18px)',
            bottom: 'clamp(26px, 7cqh, 48px)',
            right: 'clamp(12px, 3cqh, 26px)',
            fontSize: 'clamp(11px, 3.2cqh, 22px)',
            textShadow: '0 2px 6px rgba(0,0,0,0.7)',
          }}
        >
          {photo.caption}
        </div>
      )}
    </div>
  );
}
