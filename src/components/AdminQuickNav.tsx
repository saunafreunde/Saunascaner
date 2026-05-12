import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCurrentMember, useMyEmailAccount } from '@/lib/api';

// Tafel bleibt als Top-Level-Button immer sichtbar (Haupt-Sicht des Vereins).
// Alle anderen "Sicht"-Routen kommen in das 🔍 Vorschau-Dropdown — schlanker Header.
const TAFEL_ITEM = { path: '/dashboard', label: 'Tafel', icon: '📺' };

type NavItem = { path: string; label: string; icon: string; hint?: string };

const VORSCHAU_ITEMS: NavItem[] = [
  { path: '/planner',         label: 'Mitglied-Sicht',   icon: '🧖', hint: 'wie Aufgießer sie sehen' },
  { path: '/members',         label: 'Mitglieder-Galerie', icon: '👥', hint: 'Member-Directory' },
  { path: '/aufgieser',       label: 'Aufgießer-Stars',   icon: '🌟', hint: 'Trading-Card-Übersicht' },
  { path: '/wm',              label: 'WM-Tipspiel',       icon: '🏆', hint: 'Tipp-Übersicht' },
  { path: '/gast?preview=1',  label: 'Gast-Bereich',      icon: '👋', hint: 'mit Preview-Banner' },
  { path: '/checkin',         label: 'Tablet-PIN',        icon: '🔢', hint: 'Sauna-Tablet-Einstieg' },
  { path: '/scanner',         label: 'Eingang-Scanner',   icon: '📷', hint: 'QR-Code-Einlass' },
  { path: '/oil-room',        label: 'Aromen-Tablet',     icon: '🌿', hint: 'Öl-Raum-Bildschirm' },
  { path: '/hilfe',           label: 'Hilfe / Handbuch',  icon: '📖', hint: 'Mitglieder-Handbuch' },
];

interface AdminQuickNavProps {
  /** Compact icon-style (rounded square) für Inline-Header */
  variant?: 'pills' | 'icons';
}

export function AdminQuickNav({ variant = 'pills' }: AdminQuickNavProps) {
  const { pathname } = useLocation();
  const me = useCurrentMember();
  const emailAccount = useMyEmailAccount();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Postfach optional — wenn Account vorhanden zur Vorschau-Liste oben einfügen
  const vorschauItems: NavItem[] = [...VORSCHAU_ITEMS];
  if (emailAccount.data) {
    vorschauItems.splice(4, 0, { path: '/postfach', label: 'Postfach', icon: '📬', hint: 'eigene Mails' });
  }
  // Eigenes Profil
  if (me.data?.id) {
    vorschauItems.push({ path: `/profile/${me.data.id}`, label: 'Mein Profil', icon: '🪪', hint: 'eigene Profilseite' });
  }

  // Click-outside zum Schließen
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const tafelActive = pathname === TAFEL_ITEM.path;

  if (variant === 'icons') {
    return (
      <div className="flex items-center gap-1 relative" ref={dropdownRef}>
        <Link
          to={TAFEL_ITEM.path}
          title={TAFEL_ITEM.label}
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-base transition ${
            tafelActive
              ? 'bg-forest-500 text-forest-950 ring-1 ring-forest-400 shadow-sm'
              : 'bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800 hover:text-forest-100'
          }`}
        >
          {TAFEL_ITEM.icon}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Vorschau aller User-Sichten"
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
      <Link
        to={TAFEL_ITEM.path}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
          tafelActive
            ? 'bg-forest-500 text-forest-950 ring-1 ring-forest-400 shadow-sm'
            : 'bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800 hover:text-forest-100'
        }`}
      >
        <span className="text-sm">{TAFEL_ITEM.icon}</span>
        <span className="hidden sm:inline">{TAFEL_ITEM.label}</span>
      </Link>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
          User-Sichten / Vorschauen
        </div>
        <div className="text-[10px] text-forest-400 mt-0.5">
          Öffnet die Seite wie ein normaler User sie sieht.
        </div>
      </div>
      <ul className="mt-1 space-y-0.5 max-h-[400px] overflow-y-auto">
        {items.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              onClick={onClose}
              target={item.path === '/checkin' || item.path === '/oil-room' || item.path === '/scanner' ? '_blank' : undefined}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-forest-200 hover:bg-forest-900/80 hover:text-forest-100 transition"
            >
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium leading-tight">{item.label}</div>
                {item.hint && <div className="text-[10px] text-forest-500 mt-0.5">{item.hint}</div>}
              </div>
              {(item.path === '/checkin' || item.path === '/oil-room' || item.path === '/scanner') && (
                <span className="text-[10px] text-forest-500">↗</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
