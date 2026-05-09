import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Tafel',     icon: '📺' },
  { path: '/planner',   label: 'Mitglied',  icon: '🧖' },
  { path: '/members',   label: 'Galerie',   icon: '👥' },
  { path: '/admin',     label: 'Admin',     icon: '⚙️' },
  { path: '/wm',        label: 'WM',        icon: '🏆' },
  { path: '/scanner',   label: 'Scanner',   icon: '📷' },
  { path: '/oil-room',  label: 'Aromen',    icon: '🌿' },
] as const;

interface AdminQuickNavProps {
  /** Compact pill-style for inline header use */
  variant?: 'pills' | 'icons';
}

export function AdminQuickNav({ variant = 'pills' }: AdminQuickNavProps) {
  const { pathname } = useLocation();

  if (variant === 'icons') {
    return (
      <div className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
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

  return (
    <nav className="flex flex-wrap items-center gap-1.5">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              active
                ? 'bg-forest-500 text-forest-950 ring-1 ring-forest-400 shadow-sm'
                : 'bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800 hover:text-forest-100'
            }`}
          >
            <span className="text-sm">{item.icon}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
