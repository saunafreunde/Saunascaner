import { Link } from 'react-router-dom';
import { usePreviewMode } from '@/hooks/usePreviewMode';

/**
 * Admin-Preview-Banner: erscheint oben wenn ?preview=<rolle> aktiv ist.
 * Erklärt klar dass die Sicht eine Vorschau ist + Link zurück zum Admin.
 */
export function PreviewBanner() {
  const { previewRole, previewMeta } = usePreviewMode();
  if (!previewRole || !previewMeta) return null;

  return (
    <div className="sticky top-0 z-40 bg-violet-700 text-white text-center text-xs font-semibold py-1.5 ring-1 ring-violet-400 flex items-center justify-center gap-3 flex-wrap px-3">
      <span>🔍 Admin-Vorschau</span>
      <span className="opacity-80">·</span>
      <span>So sieht ein <strong>{previewMeta.emoji} {previewMeta.label}</strong> diesen Bereich</span>
      <span className="opacity-80">·</span>
      <Link to="/admin" className="underline hover:text-violet-200">zurück zum Admin</Link>
    </div>
  );
}
