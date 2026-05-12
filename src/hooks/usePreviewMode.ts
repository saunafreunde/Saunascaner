import { useSearchParams } from 'react-router-dom';
import { useCurrentMember } from '@/lib/api';
import { isAdmin } from '@/lib/roles';

export type PreviewRole = 'gast' | 'member' | 'aufgieser' | 'guest_aufgieser' | 'staff';

const ROLE_META: Record<PreviewRole, { label: string; emoji: string }> = {
  gast:            { label: 'Gast',             emoji: '👋' },
  member:          { label: 'Unterstützer',     emoji: '🤝' },
  aufgieser:       { label: 'Aufgießer',        emoji: '🧖' },
  guest_aufgieser: { label: 'Gast-Aufgießer',   emoji: '🌍' },
  staff:           { label: 'Mitarbeiter',      emoji: '👨‍🍳' },
};

const VALID_ROLES = Object.keys(ROLE_META) as PreviewRole[];

/**
 * Admin-Preview-Modus: liest ?preview=<rolle> aus URL.
 * Aktiv NUR wenn der eingeloggte User Admin ist (sonst null).
 * So sieht der Admin die App genau wie ein User der entsprechenden Rolle —
 * Rollen-spezifische Bereiche werden ausgeblendet.
 */
export function usePreviewMode(): {
  previewRole: PreviewRole | null;
  previewMeta: { label: string; emoji: string } | null;
} {
  const [params] = useSearchParams();
  const me = useCurrentMember();
  const raw = params.get('preview');

  if (!raw || !isAdmin(me.data)) return { previewRole: null, previewMeta: null };
  if (!VALID_ROLES.includes(raw as PreviewRole)) return { previewRole: null, previewMeta: null };

  const previewRole = raw as PreviewRole;
  return { previewRole, previewMeta: ROLE_META[previewRole] };
}
