import { Link, useLocation } from 'react-router-dom';
import { useMyEmailAccount } from '@/lib/api';

interface Props {
  /** Mitglieder-ID für den Profil-Link (eigenes Profil) */
  myMemberId?: string | null;
}

/**
 * Kompakte Icon-Navigation für eingeloggte Mitglieder (ohne Admin-Rechte).
 * Spiegelt das Pattern von AdminQuickNav, zeigt aber nur die für normale
 * Mitglieder relevanten Bereiche.
 */
export function MemberQuickNav({ myMemberId }: Props) {
  const { pathname } = useLocation();
  const emailAccount = useMyEmailAccount();

  const items: { path: string; label: string; icon: string }[] = [
    { path: '/dashboard', label: 'Tafel',     icon: '📺' },
    { path: '/planner',   label: 'Mitglied',  icon: '🧖' },
    { path: '/members',   label: 'Galerie',   icon: '👥' },
    { path: '/wm',        label: 'WM',        icon: '🏆' },
  ];
  if (emailAccount.data) {
    items.push({ path: '/postfach', label: 'Postfach', icon: '📬' });
  }
  if (myMemberId) {
    items.push({ path: `/profile/${myMemberId}`, label: 'Profil', icon: '🪪' });
  }

  return (
    <div className="flex items-center gap-1">
      {items.map((item) => {
        const active = pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            title={item.label}
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-base transition ${
              active
                ? 'bg-forest-500 text-forest-950 ring-1 ring-forest-400 shadow-sm'
                : 'bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800 hover:text-forest-100'
            }`}
          >
            {item.icon}
          </Link>
        );
      })}
    </div>
  );
}
