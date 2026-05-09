// Avatar-System: Foto (Storage) ODER DiceBear (generierter SVG-Avatar).
// avatar_path-Format:
//   - "avatars/<uuid>.jpg"            → Storage-Pfad im public bucket "assets"
//   - "dicebear:<style>:<seed>"       → externer Avatar-Service
//   - null                             → Initial-Fallback (Avatar-Komponente rendert Initialen)

import { publicAssetUrl } from './api';

export interface DicebearStyle {
  id: string;
  label: string;
  /** kurzes Beschreibungswort für Hover/Tooltip */
  hint?: string;
}

export const DICEBEAR_STYLES: readonly DicebearStyle[] = [
  { id: 'fun-emoji',    label: 'Emoji',     hint: 'Bunte Emoji-Köpfe' },
  { id: 'lorelei',      label: 'Lorelei',   hint: 'Modern illustriert' },
  { id: 'pixel-art',    label: 'Pixel',     hint: 'Retro 8-bit' },
  { id: 'bottts',       label: 'Bot',       hint: 'Roboter-Köpfe' },
  { id: 'avataaars',    label: 'Avataaars', hint: 'Klassisch' },
  { id: 'big-smile',    label: 'Smile',     hint: 'Lachende Gesichter' },
  { id: 'micah',        label: 'Micah',     hint: 'Geometrisch' },
  { id: 'thumbs',       label: 'Daumen',    hint: 'Stilisiert' },
] as const;

const DICEBEAR_BASE = 'https://api.dicebear.com/9.x';

export function dicebearUrl(style: string, seed: string, size: number = 256): string {
  const params = new URLSearchParams({
    seed,
    size: String(size),
    radius: '50',
    backgroundType: 'gradientLinear',
  });
  return `${DICEBEAR_BASE}/${encodeURIComponent(style)}/svg?${params.toString()}`;
}

export function makeDicebearPath(style: string, seed: string): string {
  return `dicebear:${style}:${seed}`;
}

export function parseDicebearPath(path: string): { style: string; seed: string } | null {
  if (!path.startsWith('dicebear:')) return null;
  const parts = path.split(':');
  if (parts.length < 3) return null;
  // seed kann ":" enthalten? — wir joinen den Rest sicherheitshalber
  const style = parts[1];
  const seed = parts.slice(2).join(':');
  if (!style || !seed) return null;
  return { style, seed };
}

/**
 * Liefert die anzuzeigende Bild-URL für einen avatar_path.
 * Storage-Pfad → public URL; DiceBear-Marker → API-URL; sonst null.
 */
export function resolveAvatarUrl(avatarPath: string | null | undefined, size: number = 256): string | null {
  if (!avatarPath) return null;
  const dicebear = parseDicebearPath(avatarPath);
  if (dicebear) return dicebearUrl(dicebear.style, dicebear.seed, size);
  return publicAssetUrl(avatarPath);
}

/** Zufalls-Seed für DiceBear (alphanumerisch, 8 Zeichen). */
export function randomSeed(): string {
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(36)).join('').slice(0, 8);
}
