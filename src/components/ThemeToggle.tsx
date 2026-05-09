import { useEffect, useState } from 'react';

const STORAGE_KEY = 'saunafreunde-theme';
type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (saved === 'light' || saved === 'dark') return saved;
  return 'dark'; // Default für Saunafreunde-App
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'light') root.classList.add('light');
  else root.classList.remove('light');
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const next = theme === 'dark' ? 'light' : 'dark';
  const icon = theme === 'dark' ? '🌙' : '☀️';
  const label = theme === 'dark' ? 'Dunkel' : 'Hell';

  if (compact) {
    return (
      <button
        onClick={() => setTheme(next)}
        title={`Wechseln zu ${next === 'light' ? 'Hell' : 'Dunkel'}`}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-base bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800 transition"
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(next)}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800 transition"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/** Hook ohne UI: setzt das gespeicherte Theme beim App-Start. */
export function useApplyStoredTheme() {
  useEffect(() => {
    applyTheme(getInitialTheme());
  }, []);
}
