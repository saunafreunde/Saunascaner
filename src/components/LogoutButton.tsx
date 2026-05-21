import { useAuth } from '@/hooks/useAuth';

/**
 * Einheitlicher Logout-Button für die Member-Bereiche (Unterstützer, Gast,
 * Mitarbeiter, Fan, Profile). Vorher war Logout nur in Profile.tsx sichtbar —
 * mobile User in /unterstuetzer & Co konnten sich nicht abmelden.
 *
 * Default: kompaktes Pill mit ⏻-Icon, links davon optional „Abmelden"-Label
 * (nur auf >sm sichtbar damit's auf engen Mobile-Headers nicht überquillt).
 */
export function LogoutButton({ className = '' }: { className?: string }) {
  const { signOut } = useAuth();
  return (
    <button
      type="button"
      onClick={() => signOut()}
      title="Abmelden"
      aria-label="Abmelden"
      className={`flex h-11 items-center gap-1.5 rounded-lg bg-forest-900/80 px-2.5 sm:px-3 text-forest-200 ring-1 ring-forest-700/50 hover:bg-rose-900/60 hover:text-rose-100 hover:ring-rose-500/40 active:scale-95 transition ${className}`}
    >
      <span aria-hidden className="text-base leading-none">⏻</span>
      <span className="hidden sm:inline text-xs font-medium">Abmelden</span>
    </button>
  );
}
