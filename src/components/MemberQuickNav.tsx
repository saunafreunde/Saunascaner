import { Link, useLocation } from 'react-router-dom';
import { useCurrentMember, useMyEmailAccount } from '@/lib/api';
import { isGast } from '@/lib/roles';

interface Props {
  /** Mitglieder-ID für den Profil-Link (eigenes Profil) */
  myMemberId?: string | null;
}

/**
 * Kompakte Icon-Navigation für eingeloggte Mitglieder (ohne Admin-Rechte).
 * Spiegelt das Pattern von AdminQuickNav, zeigt aber nur die für normale
 * Mitglieder relevanten Bereiche. Gäste sehen ein reduziertes Set.
 */
export function MemberQuickNav({ myMemberId }: Props) {
  const { pathname } = useLocation();
  const me = useCurrentMember();
  const emailAccount = useMyEmailAccount();
  const gast = isGast(me.data);

  const items: { path: string; label: string; icon: string }[] = [];
  if (gast) {
    items.push({ path: '/gast', label: 'Mein Bereich', icon: '🏡' });
  }
  items.push({ path: '/dashboard', label: 'Tafel', icon: '📺' });
  if (!gast) {
    items.push({ path: '/planner', label: 'Mitglied', icon: '🧖' });
    items.push({ path: '/members', label: 'Galerie', icon: '👥' });
  }
  items.push({ path: '/aufgieser', label: 'Aufgießer', icon: '🌟' });
  if (!gast) {
    items.push({ path: '/wm', label: 'WM', icon: '🏆' });
  }
  if (emailAccount.data && !gast) {
    items.push({ path: '/postfach', label: 'Postfach', icon: '📬' });
  }
  items.push({ path: '/hilfe', label: 'Hilfe', icon: '📖' });
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
