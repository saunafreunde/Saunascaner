// /panel — Desktop-Anwesenheits-Panel (Migration 0110, 29.05.2026).
//
// Anonymer Hub für den Innenraum-PC: alle Mitglieder als Kacheln,
// Tap-Toggle (grün=anwesend, rot=abwesend). Für Member ohne Handy.
//
// Zugang seit 25.09.2026 (Migration 0177): NUR auf einem gekoppelten Gerät der
// Art „panel". Das frühere Passwort stand im öffentlichen GitHub-Repo — damit
// konnte jeder im Internet die Mitgliederliste lesen und Anwesenheiten setzen.
// Ein Admin koppelt den PC einmal unter Admin → Displays → Kiosk-Geräte; das
// Geräte-Token geht im bisherigen Parameter p_panel_password an den Server.
//   - Realtime-Sync via useRealtime invalidiert members → live-update wenn
//     jemand woanders ein-/austippt
//   - Bottom-Nav ausgeblendet (siehe App.tsx NO_BOTTOM_NAV_PATHS)

import { useMemo, useState } from 'react';
import {
  usePanelMembers,
  usePanelSetPresence,
  useKioskGeraetStatus,
  type PanelMember,
} from '@/lib/api';
import { kioskGeraetToken } from '@/lib/kioskGeraet';
import { Avatar } from '@/components/Avatar';

export default function AnwesenheitsPanel() {
  const status = useKioskGeraetStatus();
  const token = kioskGeraetToken();

  if (status.isLoading) {
    return <div className="min-h-screen bg-forest-950 grid place-items-center text-forest-300">Gerät wird geprüft …</div>;
  }
  if (status.data?.status === 'ok' && status.data.art === 'panel' && token) {
    return <PanelGrid password={token} />;
  }
  return <NichtGekoppelt falscheArt={status.data?.status === 'ok' ? status.data.art : null} />;
}

function NichtGekoppelt({ falscheArt }: { falscheArt: string | null }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-950 via-slate-950 to-forest-900 grid place-items-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-forest-900/80 ring-1 ring-forest-700/40 p-8 text-center backdrop-blur-xl">
        <div className="text-5xl">🚪</div>
        <h1 className="mt-3 text-2xl font-bold text-forest-100">Anwesenheits-Panel</h1>
        <p className="mt-3 text-sm leading-relaxed text-forest-300/90">
          {falscheArt
            ? `Dieses Gerät ist als „${falscheArt}" gekoppelt, nicht als Panel.`
            : 'Dieses Gerät ist noch nicht freigeschaltet.'}
          {' '}Ein Admin öffnet dafür einmal <strong className="text-amber-300">Admin → Displays → Kiosk-Geräte</strong>,
          wählt „Anwesenheits-Panel" und öffnet den angezeigten Link auf diesem PC.
        </p>
      </div>
    </div>
  );
}

// ─── Kachel-Grid ────────────────────────────────────────────────────────
function PanelGrid({ password }: { password: string }) {
  const membersQ = usePanelMembers(password);
  const setPresence = usePanelSetPresence();
  const [search, setSearch] = useState('');
  // Optimistic-Update: lokal merken welche Member gerade getoggelt werden
  // (verhindert Flash bei langsamer Verbindung)
  const [pendingMap, setPendingMap] = useState<Record<string, boolean>>({});

  // Gerät widerrufen → der Server lehnt ab; die Liste bleibt leer und der
  // Hinweis unten erklärt es.
  const widerrufen = !!membersQ.error && /invalid_password/i.test((membersQ.error as Error).message);

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
        {widerrufen ? (
          <div className="grid place-items-center py-20 text-center text-rose-200">
            Die Kopplung dieses Geräts wurde widerrufen. Ein Admin kann es unter Admin → Displays → Kiosk-Geräte neu koppeln.
          </div>
        ) : membersQ.isLoading ? (
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
