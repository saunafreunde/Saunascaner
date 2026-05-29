// /panel — Desktop-Anwesenheits-Panel (Migration 0110, 29.05.2026).
//
// PW-geschützter anonymer Hub für den Innenraum-PC: alle Mitglieder als
// Kacheln, Tap-Toggle (grün=anwesend, rot=abwesend). Für Member ohne Handy.
//
// Architektur:
//   - Route ist anonym zugänglich (kein Login nötig)
//   - PW-Gate vorne: User tippt 'SaunaPano!' → sessionStorage gecached
//   - Backend prüft PW bei JEDEM RPC-Call → wer Frontend-Gate umgeht, kommt
//     auch nicht weiter
//   - Realtime-Sync via useRealtime invalidiert members → live-update wenn
//     jemand woanders ein-/austippt
//   - Bottom-Nav ausgeblendet (siehe App.tsx NO_BOTTOM_NAV_PATHS)

import { useMemo, useState, useEffect } from 'react';
import {
  useVerifyPanelPassword,
  usePanelMembers,
  usePanelSetPresence,
  type PanelMember,
} from '@/lib/api';
import { Avatar } from '@/components/Avatar';

const PANEL_PW_STORAGE_KEY = 'sauna-panel-pw-v1';

export default function AnwesenheitsPanel() {
  const [password, setPassword] = useState<string | null>(() => {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(PANEL_PW_STORAGE_KEY);
  });

  if (!password) {
    return <PasswordGate onUnlock={(pw) => {
      sessionStorage.setItem(PANEL_PW_STORAGE_KEY, pw);
      setPassword(pw);
    }} />;
  }

  return <PanelGrid password={password} onLock={() => {
    sessionStorage.removeItem(PANEL_PW_STORAGE_KEY);
    setPassword(null);
  }} />;
}

// ─── PW-Gate ────────────────────────────────────────────────────────────
function PasswordGate({ onUnlock }: { onUnlock: (pw: string) => void }) {
  const [input, setInput] = useState('');
  const verify = useVerifyPanelPassword();
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const ok = await verify.mutateAsync(input);
      if (!ok) { setErr('Falsches Passwort'); return; }
      onUnlock(input);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-950 via-slate-950 to-forest-900 grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-forest-900/80 ring-1 ring-forest-700/40 p-8 backdrop-blur-xl space-y-5">
        <div className="text-center space-y-2">
          <div className="text-5xl">🚪</div>
          <h1 className="text-2xl font-bold text-forest-100">Anwesenheits-Panel</h1>
          <p className="text-sm text-forest-300/80">
            Für den Sauna-Innenraum-PC.<br />Bitte Passwort eingeben.
          </p>
        </div>
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          autoComplete="current-password"
          placeholder={'Panel-Passwort'}
          className="w-full rounded-xl bg-forest-950/80 px-4 py-3 text-base text-forest-100 ring-1 ring-forest-700/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
        />
        {err && <p className="text-sm text-rose-300 text-center">{err}</p>}
        <button
          type="submit"
          disabled={verify.isPending || !input}
          className="w-full rounded-xl bg-amber-500 px-4 py-3 text-base font-bold text-forest-950 hover:bg-amber-400 disabled:opacity-50 transition"
        >
          {verify.isPending ? 'Prüfe…' : 'Freischalten'}
        </button>
      </form>
    </div>
  );
}

// ─── Kachel-Grid ────────────────────────────────────────────────────────
function PanelGrid({ password, onLock }: { password: string; onLock: () => void }) {
  const membersQ = usePanelMembers(password);
  const setPresence = usePanelSetPresence();
  const [search, setSearch] = useState('');
  // Optimistic-Update: lokal merken welche Member gerade getoggelt werden
  // (verhindert Flash bei langsamer Verbindung)
  const [pendingMap, setPendingMap] = useState<Record<string, boolean>>({});

  // PW invalid (z.B. nachträglich geändert) → unlock + zurück zum Gate
  useEffect(() => {
    if (membersQ.error && /invalid_password/i.test((membersQ.error as Error).message)) {
      sessionStorage.removeItem(PANEL_PW_STORAGE_KEY);
      onLock();
    }
  }, [membersQ.error, onLock]);

  const list = membersQ.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) =>
      m.name.toLowerCase().includes(q)
      || (m.sauna_name ?? '').toLowerCase().includes(q)
      || String(m.member_number ?? '').includes(q)
    );
  }, [list, search]);

  const presentCount = list.filter((m) => m.is_present).length;
  const totalCount = list.length;

  async function toggle(m: PanelMember) {
    const next = !m.is_present;
    setPendingMap((p) => ({ ...p, [m.id]: next }));
    try {
      await setPresence.mutateAsync({ memberId: m.id, present: next, password });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setPendingMap((p) => {
        const cp = { ...p };
        delete cp[m.id];
        return cp;
      });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-950 via-slate-950 to-forest-900 text-forest-100">
      {/* Header sticky */}
      <header className="sticky top-0 z-30 border-b border-forest-800/40 bg-forest-950/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-base shadow-lg">
              🚪
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold leading-tight">Anwesenheits-Panel</h1>
              <p className="text-[11px] sm:text-xs text-forest-400">
                <span className="text-emerald-300 font-semibold">{presentCount} anwesend</span>
                {' / '}
                <span>{totalCount} Mitglieder</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={'🔍 Suchen…'}
              className="hidden sm:block w-64 rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
            />
            <button
              onClick={onLock}
              className="rounded-lg bg-forest-900/80 px-3 py-2 text-xs ring-1 ring-forest-700/40 hover:bg-forest-900 transition"
              title="Panel sperren"
            >
              🔒 Sperren
            </button>
          </div>
        </div>
        {/* Suche auf Mobile unter Header */}
        <div className="sm:hidden px-4 pb-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={'🔍 Suchen…'}
            className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
          />
        </div>
      </header>

      {/* Grid */}
      <main className="mx-auto max-w-7xl p-4">
        {membersQ.isLoading ? (
          <div className="grid place-items-center py-20 text-forest-400">Lade Mitglieder…</div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center py-20 text-forest-400 text-center">
            {search ? `Niemand gefunden für „${search}"` : 'Noch keine Mitglieder'}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map((m) => {
              const pending = pendingMap[m.id];
              // Optimistische Anzeige: bei pending zeigen wir den Ziel-Status
              const showPresent = pending ?? m.is_present;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m)}
                  disabled={!!pending}
                  className={`relative aspect-square rounded-2xl p-3 sm:p-4 ring-2 transition-all active:scale-95 select-none ${
                    showPresent
                      ? 'bg-emerald-500/20 ring-emerald-400 hover:bg-emerald-500/30'
                      : 'bg-rose-950/40 ring-rose-700/60 hover:bg-rose-950/60'
                  } ${pending ? 'opacity-70' : ''}`}
                  aria-pressed={showPresent}
                  aria-label={`${m.name} ist ${showPresent ? 'anwesend' : 'abwesend'}, tippen zum Umschalten`}
                >
                  {/* Status-Punkt oben rechts */}
                  <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${showPresent ? 'bg-emerald-400 shadow-emerald-300/60 shadow-lg' : 'bg-rose-500/70'}`} />
                  {/* Avatar zentriert */}
                  <div className="flex flex-col items-center gap-2 h-full justify-center">
                    <Avatar name={m.sauna_name || m.name} avatarPath={m.avatar_path} size="lg" />
                    <div className="min-w-0 text-center w-full">
                      <div className="text-xs sm:text-sm font-bold truncate" title={m.name}>
                        {m.sauna_name || m.name}
                      </div>
                      {m.member_number && (
                        <div className="text-[10px] text-forest-400 mt-0.5">
                          FDS-{String(m.member_number).padStart(3, '0')}
                        </div>
                      )}
                    </div>
                    {/* Status-Text */}
                    <div className={`text-[10px] uppercase tracking-wider font-bold ${showPresent ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {pending ? '…' : showPresent ? '✓ Anwesend' : '✕ Abwesend'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer-Hinweis */}
      <footer className="mx-auto max-w-7xl px-4 pb-6 pt-2 text-[11px] text-forest-500 text-center">
        Tippen zum Wechseln · Live-Synchronisation alle 10 Sek
      </footer>
    </div>
  );
}
