import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useCurrentMember, useMembersDirectory } from '@/lib/api';
import {
  useActiveMatchesForMe, useOpenMatches, useJoinOpenMatch, useChallenge,
  useGameLeaderboard, type GameKind,
} from '@/lib/games';
import { GAME_LABELS, GAME_REGISTRY } from './registry';
import { Avatar } from '@/components/Avatar';
import { LeaderboardSection } from './LeaderboardSection';

const PHASE1_KINDS: GameKind[] = ['tetris', 'connect4', 'chess'];

type HubTab = 'play' | 'leaderboard';

export function GameHub() {
  const me = useCurrentMember();
  const myId = me.data?.id ?? null;
  const activeQ = useActiveMatchesForMe();
  const open = useOpenMatches();
  const join = useJoinOpenMatch();
  const [tab, setTab] = useState<HubTab>('play');

  const active = activeQ.data ?? [];
  const yourTurnCount = active.filter((m) => m.my_turn).length;

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-6">
      <header className="rounded-2xl bg-gradient-to-br from-forest-900/80 to-forest-950/90 p-6 ring-1 ring-forest-700/50 shadow-2xl shadow-black/40">
        <h1 className="text-2xl font-bold text-forest-100">🎮 Spiele</h1>
        <p className="mt-1 text-sm text-forest-300">
          Spiel allein um Highscores oder fordere andere heraus. Phase 1: Tetris, Vier Gewinnt, Schach.
        </p>
        {yourTurnCount > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-500/20 px-3 py-1.5 ring-1 ring-amber-500/40 text-amber-200 text-sm">
            🔔 Du bist in {yourTurnCount} Match{yourTurnCount > 1 ? 'es' : ''} dran
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-forest-950/60 p-1 ring-1 ring-forest-800/40">
        <button
          onClick={() => setTab('play')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === 'play' ? 'bg-forest-700/80 text-forest-100' : 'text-forest-400 hover:text-forest-200'
          }`}
        >
          🎮 Spielen
        </button>
        <button
          onClick={() => setTab('leaderboard')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === 'leaderboard' ? 'bg-forest-700/80 text-forest-100' : 'text-forest-400 hover:text-forest-200'
          }`}
        >
          🏆 Bestenliste
        </button>
      </div>

      {tab === 'leaderboard' ? (
        <LeaderboardSection />
      ) : (
        <>
          {/* Aktive Matches */}
          {active.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-forest-300 uppercase tracking-wider">Deine Matches</h2>
              <ul className="space-y-2">
                {active.map((m) => {
                  const meta = GAME_LABELS[m.kind];
                  const isPending = m.status === 'pending';
                  return (
                    <li key={m.match_id}>
                      <Link to={`/spiele/match/${m.match_id}`}
                        className={`flex items-center gap-3 rounded-xl p-3 ring-1 transition ${
                          m.my_turn ? 'bg-amber-500/15 ring-amber-500/40 hover:bg-amber-500/25' :
                          isPending ? 'bg-blue-500/10 ring-blue-500/30 hover:bg-blue-500/20' :
                          'bg-forest-900/50 ring-forest-800/50 hover:bg-forest-900/70'
                        }`}>
                        <div className="text-2xl">{meta.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-forest-100 truncate">{meta.label}</div>
                          <div className="text-xs text-forest-400 truncate">
                            {isPending ? 'Warte auf Gegner' : `vs. ${m.opponent_name ?? '?'}`}
                          </div>
                        </div>
                        {m.my_turn && <span className="text-xs font-bold text-amber-300">Du bist dran →</span>}
                        {isPending && <span className="text-xs text-blue-300">Offen</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Solo-Spiele */}
          <section>
            <h2 className="mb-2 text-sm font-semibold text-forest-300 uppercase tracking-wider">Solo</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PHASE1_KINDS.filter((k) => GAME_REGISTRY[k]?.mode === 'solo').map((k) => (
                <SoloCard key={k} kind={k} />
              ))}
            </div>
          </section>

          {/* Live PvP + Async */}
          <section>
            <h2 className="mb-2 text-sm font-semibold text-forest-300 uppercase tracking-wider">Gegeneinander</h2>
            <div className="grid grid-cols-1 gap-3">
              {PHASE1_KINDS.filter((k) => GAME_REGISTRY[k]?.mode !== 'solo').map((k) => {
                const meta = GAME_REGISTRY[k]!;
                return <PvPLauncher key={k} kind={k} label={meta.label} emoji={meta.emoji} short={meta.short} myId={myId} />;
              })}
            </div>
          </section>

          {/* Offene Lobby */}
          {open.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-forest-300 uppercase tracking-wider">Offene Tische</h2>
              <ul className="space-y-2">
                {open.map((o) => {
                  if (o.challenger_id === myId) return null;
                  return (
                    <li key={o.match_id}
                      className="flex items-center gap-3 rounded-xl bg-forest-900/50 p-3 ring-1 ring-forest-800/50">
                      <div className="text-2xl">{GAME_LABELS[o.kind].emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-forest-100">{GAME_LABELS[o.kind].label}</div>
                        <div className="text-xs text-forest-400 truncate">{o.challenger_name} wartet</div>
                      </div>
                      <button
                        onClick={async () => {
                          await join.mutateAsync(o.match_id);
                          window.location.href = `/spiele/match/${o.match_id}`;
                        }}
                        disabled={join.isPending}
                        className="rounded-lg bg-emerald-500/80 px-3 py-1.5 text-xs font-bold text-forest-950 hover:bg-emerald-400 disabled:opacity-50"
                      >
                        Beitreten
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// Solo-Karte mit Mini-Leaderboard-Top-1 ("👑 Stefan · 14.230")
function SoloCard({ kind }: { kind: GameKind }) {
  const meta = GAME_REGISTRY[kind]!;
  const top = useGameLeaderboard(kind, 'all');
  const t = top.data?.[0];
  return (
    <Link to={`/spiele/solo/${kind}`}
      className="block rounded-2xl bg-forest-900/60 p-4 ring-1 ring-forest-800/50 hover:bg-forest-900/80 transition">
      <div className="flex items-start gap-3">
        <div className="text-3xl">{meta.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="text-forest-100 font-semibold">{meta.label}</div>
          <div className="text-xs text-forest-400 mt-0.5">{meta.short}</div>
        </div>
      </div>
      {t && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-2 py-1.5 ring-1 ring-amber-500/30">
          <span className="text-base">👑</span>
          <span className="text-xs text-amber-200 truncate flex-1">{t.name}</span>
          <span className="text-sm font-bold text-amber-300 tabular-nums">{t.score}</span>
        </div>
      )}
    </Link>
  );
}

function PvPLauncher({ kind, label, emoji, short, myId }:
  { kind: GameKind; label: string; emoji: string; short: string; myId: string | null }
) {
  const [showOpponent, setShowOpponent] = useState(false);
  const challenge = useChallenge();
  const members = useMembersDirectory();
  const candidates = (members.data ?? []).filter((m) => m.id !== myId);

  async function startOpenLobby() {
    const { supabase } = await import('@/lib/supabase');
    if (!supabase) return;
    const { data, error } = await supabase.rpc('games_create_match', { p_kind: kind, p_opponent: null });
    if (error) { alert(error.message); return; }
    window.location.href = `/spiele/match/${data}`;
  }

  async function startChallenge(opponentId: string) {
    try {
      const matchId = await challenge.mutateAsync({ opponent: opponentId, kind });
      window.location.href = `/spiele/match/${matchId}`;
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="rounded-2xl bg-forest-900/60 p-4 ring-1 ring-forest-800/50">
      <div className="flex items-start gap-3">
        <div className="text-3xl">{emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="text-forest-100 font-semibold">{label}</div>
          <div className="text-xs text-forest-400 mt-0.5">{short}</div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={startOpenLobby}
          className="flex-1 rounded-xl bg-forest-800/80 px-3 py-2 text-sm text-forest-100 hover:bg-forest-700 ring-1 ring-forest-700/50"
        >
          🪑 Offen warten
        </button>
        <button
          onClick={() => setShowOpponent((v) => !v)}
          className="flex-1 rounded-xl bg-amber-500/80 px-3 py-2 text-sm font-bold text-forest-950 hover:bg-amber-400"
        >
          ⚔ Herausfordern
        </button>
      </div>
      {showOpponent && (
        <div className="mt-3 max-h-48 overflow-y-auto rounded-xl bg-forest-950/60 p-2 ring-1 ring-forest-800/40">
          {candidates.length === 0 && <div className="text-xs text-forest-400 p-2">Keine Gegner verfügbar.</div>}
          {candidates.map((m) => (
            <button
              key={m.id}
              onClick={() => startChallenge(m.id)}
              disabled={challenge.isPending}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-forest-200 hover:bg-forest-900/70 disabled:opacity-50"
            >
              <Avatar avatarPath={m.avatar_path} name={m.name} size="xs" />
              <span className="truncate">{m.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
