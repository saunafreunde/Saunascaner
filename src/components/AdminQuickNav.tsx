import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCurrentMember, useMyEmailAccount } from '@/lib/api';

// Direkte Buttons im Admin-Header — alle wichtigen Bereiche die ein Admin
// täglich braucht. Vorschau-Dropdown enthält NUR die User-Sichten die man
// sonst nicht direkt aufrufen würde (Gast, Unterstützer, Tablets, Hilfe).

type NavItem = { path: string; label: string; icon: string; hint?: string };

const DIRECT_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Tafel',     icon: '📺' },
  { path: '/planner',   label: 'Planner',   icon: '🧖' },
  { path: '/aufgieser', label: 'Aufgießer', icon: '🌟' },
  { path: '/members',   label: 'Galerie',   icon: '👥' },
  { path: '/wm',        label: 'WM',        icon: '🏆' },
  { path: '/admin',     label: 'Admin',     icon: '⚙️' },
];

// Spezial-Sichten die man sonst nicht direkt sieht
const VORSCHAU_ITEMS: NavItem[] = [
  { path: '/unterstuetzer',   label: 'Unterstützer-Sicht',  icon: '🤝',   hint: 'Helfer-Aufgaben für Nicht-Aufgießer' },
  { path: '/mitarbeiter',     label: 'Mitarbeiter-Sicht',   icon: '👨‍🍳', hint: 'Staff: Personal-Slots + Alarm' },
  { path: '/planner',         label: 'Gast-Aufgießer-Sicht', icon: '🌍',  hint: 'Planner ohne Stamm-Slot/Urlaub' },
  { path: '/gast?preview=1',  label: 'Gast-Bereich',        icon: '👋',   hint: 'mit Preview-Banner' },
  { path: '/checkin',         label: 'Tablet-PIN',          icon: '🔢',   hint: 'Sauna-Tablet-Einstieg (öffnet neuer Tab)' },
  { path: '/scanner',         label: 'Eingang-Scanner',     icon: '📷',   hint: 'QR-Code-Einlass (öffnet neuer Tab)' },
  { path: '/oil-room',        label: 'Aromen-Tablet',       icon: '🌿',   hint: 'Öl-Raum-Bildschirm (öffnet neuer Tab)' },
  { path: '/hilfe',           label: 'Hilfe / Handbuch',    icon: '📖',   hint: 'Mitglieder-Handbuch' },
];

const TARGET_BLANK_PATHS = new Set(['/checkin', '/scanner', '/oil-room']);

interface AdminQuickNavProps {
  variant?: 'pills' | 'icons';
}

export function AdminQuickNav({ variant = 'pills' }: AdminQuickNavProps) {
  const { pathname } = useLocation();
  const me = useCurrentMember();
  const emailAccount = useMyEmailAccount();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Direkte Items: optional Postfach einfügen wenn Account
  const directItems: NavItem[] = [...DIRECT_ITEMS];
  if (emailAccount.data) {
    directItems.splice(5, 0, { path: '/postfach', label: 'Postfach', icon: '📬' });
  }

  // Vorschau-Items: eigenes Profil hinten anhängen
  const vorschauItems: NavItem[] = [...VORSCHAU_ITEMS];
  if (me.data?.id) {
    vorschauItems.push({ path: `/profile/${me.data.id}`, label: 'Mein Profil', icon: '🪪', hint: 'eigene Profilseite' });
  }

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (variant === 'icons') {
    return (
      <div className="flex items-center gap-1 relative" ref={dropdownRef}>
        {directItems.map((item) => {
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
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Spezial-Vorschauen (Gast, Tablets, Hilfe)"
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-base transition ${
            open
              ? 'bg-amber-500/30 text-amber-200 ring-1 ring-amber-500/50'
              : 'bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800 hover:text-forest-100'
          }`}
        >
          🔍
        </button>
        {open && <VorschauDropdown items={vorschauItems} onClose={() => setOpen(false)} />}
      </div>
    );
  }

  return (
    <nav className="flex flex-wrap items-center gap-1.5 relative" ref={dropdownRef}>
      {directItems.map((item) => {
        const active = pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Spezial-Vorschauen"
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
          open
            ? 'bg-amber-500/30 text-amber-200 ring-1 ring-amber-500/50'
            : 'bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800 hover:text-forest-100'
        }`}
      >
        <span className="text-sm">🔍</span>
        <span className="hidden sm:inline">Vorschau</span>
        <span className="text-[10px] opacity-60">▾</span>
      </button>
      {open && <VorschauDropdown items={vorschauItems} onClose={() => setOpen(false)} />}
    </nav>
  );
}

function VorschauDropdown({ items, onClose }: { items: NavItem[]; onClose: () => void }) {
  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl bg-forest-950 ring-1 ring-amber-500/40 shadow-2xl shadow-amber-900/30 backdrop-blur p-2">
      <div className="px-3 py-2 border-b border-forest-800/50">
        <div className="text-[10px] uppercase tracking-widest text-amber-400/80 font-semibold">
          Spezial-Sichten
        </div>
        <div className="text-[10px] text-forest-400 mt-0.5">
          User-Bereiche die du sonst nicht direkt siehst.
        </div>
      </div>
      <ul className="mt-1 space-y-0.5 max-h-[400px] overflow-y-auto">
        {items.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              onClick={onClose}
              target={TARGET_BLANK_PATHS.has(item.path) ? '_blank' : undefined}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-forest-200 hover:bg-forest-900/80 hover:text-forest-100 transition"
            >
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium leading-tight">{item.label}</div>
                {item.hint && <div className="text-[10px] text-forest-500 mt-0.5">{item.hint}</div>}
              </div>
              {TARGET_BLANK_PATHS.has(item.path) && (
                <span className="text-[10px] text-forest-500">↗</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
