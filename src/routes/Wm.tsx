import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PageBackground } from '@/components/PageBackground';
import { WmMatchCard } from '@/components/WmMatchCard';
import { WmLeaderboard } from '@/components/WmLeaderboard';
import { WmPreTournament } from '@/components/WmPreTournament';
import { AdminQuickNav } from '@/components/AdminQuickNav';
import {
  useWmTeams, useWmMatches, useMyWmTips, useWmLeaderboard,
  useCurrentMember, useWmSettings,
  type WmPhase, type WmMatch, type WmTeam,
} from '@/lib/api';

const PHASES: { key: WmPhase | 'pre'; label: string }[] = [
  { key: 'pre',   label: '⭐ Vor-Tipps' },
  { key: 'group', label: '🌍 Vorrunde' },
  { key: 'r32',   label: '32-tel' },
  { key: 'r16',   label: 'Achtel' },
  { key: 'qf',    label: 'Viertel' },
  { key: 'sf',    label: 'Halb' },
  { key: 'third', label: 'Bronze' },
  { key: 'final', label: '🏆 Finale' },
];

export default function Wm() {
  const { signOut } = useAuth();
  const member = useCurrentMember();
  const teamsQ = useWmTeams();
  const matchesQ = useWmMatches();
  const myTipsQ = useMyWmTips(member.data?.id);
  const lbQ = useWmLeaderboard();
  const settingsQ = useWmSettings();

  const m = member.data;
  const isAdmin = m?.role === 'admin';

  const [phase, setPhase] = useState<WmPhase | 'pre'>('group');

  const teamsById = useMemo(() => {
    const map = new Map<string, WmTeam>();
    for (const t of teamsQ.data ?? []) map.set(t.id, t);
    return map;
  }, [teamsQ.data]);

  const myTipsByMatchId = useMemo(() => {
    const map = new Map<string, typeof myTipsQ.data extends (infer U)[] | null | undefined ? U : never>();
    for (const t of myTipsQ.data ?? []) map.set(t.match_id, t);
    return map;
  }, [myTipsQ.data]);

  const matchesByPhase = useMemo(() => {
    const groups: Record<string, WmMatch[]> = {};
    for (const match of matchesQ.data ?? []) {
      if (!groups[match.phase]) groups[match.phase] = [];
      groups[match.phase].push(match);
    }
    for (const k of Object.keys(groups)) {
      groups[k].sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));
    }
    return groups;
  }, [matchesQ.data]);

  const jokersUsedPerPhase = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const tip of myTipsQ.data ?? []) {
      if (!tip.joker) continue;
      const match = (matchesQ.data ?? []).find((m) => m.id === tip.match_id);
      if (match) map.set(match.phase, true);
    }
    return map;
  }, [myTipsQ.data, matchesQ.data]);

  const myEntry = (lbQ.data ?? []).find((e) => e.member_id === m?.id);
  const myRank = m?.id ? (lbQ.data ?? []).findIndex((e) => e.member_id === m.id) + 1 : 0;

  const tournamentName = (settingsQ.data?.tournament_name as string) ?? 'WM-Tipspiel';
  const visibleMatches = phase === 'pre' ? [] : (matchesByPhase[phase] ?? []);

  return (
    <PageBackground page="planner" variant="strong" className="min-h-screen">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b border-forest-800/40 bg-forest-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 text-base shadow-lg shadow-amber-900/40">
              🏆
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold text-amber-100 leading-tight truncate">
                {tournamentName}
              </h1>
              {myEntry ? (
                <p className="text-[10px] sm:text-xs text-amber-300/80">
                  Platz <strong className="text-amber-200">{myRank}</strong> · {myEntry.total_points} Punkte
                  {myEntry.streak_bonus > 0 && <span className="ml-1.5 text-amber-400">🔥 Streak</span>}
                </p>
              ) : (
                <p className="text-[10px] sm:text-xs text-forest-400">Tippe los und sammle Punkte!</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin ? (
              <AdminQuickNav variant="icons" />
            ) : (
              <Link to="/planner" className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg text-base bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800 transition" title="Mitgliederbereich">
                🧖
              </Link>
            )}
            <button
              onClick={() => signOut()}
              className="rounded-lg bg-forest-900/80 px-2.5 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900 transition"
            >
              Abmelden
            </button>
          </div>
        </div>

        {/* Phase tabs */}
        <div className="mx-auto max-w-6xl px-4 pb-2">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {PHASES.map((p) => {
              const count = p.key === 'pre' ? 0 : (matchesByPhase[p.key]?.length ?? 0);
              const active = phase === p.key;
              const hasContent = p.key === 'pre' || count > 0;
              return (
                <button
                  key={p.key}
                  onClick={() => setPhase(p.key)}
                  disabled={!hasContent && p.key !== 'pre'}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                    active
                      ? 'bg-amber-500 text-amber-950 shadow-md ring-1 ring-amber-300'
                      : hasContent
                        ? 'text-forest-200 hover:bg-forest-900/60'
                        : 'text-forest-600 cursor-not-allowed'
                  }`}
                >
                  <span>{p.label}</span>
                  {count > 0 && (
                    <span className={`rounded-full px-1.5 text-[10px] font-bold ${active ? 'bg-amber-700/60 text-amber-100' : 'bg-forest-800/60 text-forest-400'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
        {/* Phase content */}
        {phase === 'pre' ? (
          m ? <WmPreTournament memberId={m.id} /> : null
        ) : visibleMatches.length === 0 ? (
          <div className="text-center py-16 text-forest-400">
            <div className="text-5xl mb-3">⚽</div>
            <p className="text-sm">Noch keine Spiele für diese Phase angelegt.</p>
            {isAdmin && (
              <Link to="/admin" className="mt-3 inline-block text-amber-400 underline text-sm">
                Im Admin-Bereich anlegen
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibleMatches.map((match) => (
              <WmMatchCard
                key={match.id}
                match={match}
                teamsById={teamsById}
                myTip={myTipsByMatchId.get(match.id) as never}
                jokerUsedInPhase={jokersUsedPerPhase.get(match.phase) ?? false}
              />
            ))}
          </div>
        )}

        {/* Leaderboard */}
        <section className="pt-6 border-t border-forest-800/40">
          <h2 className="text-lg font-bold text-forest-100 mb-4 flex items-center gap-2">
            <span className="text-2xl">🏅</span>
            <span>Rangliste</span>
          </h2>
          <WmLeaderboard myMemberId={m?.id} />
        </section>

        {/* Punkte-Erklärung */}
        <details className="rounded-xl bg-forest-950/40 ring-1 ring-forest-800/40 p-3">
          <summary className="cursor-pointer text-xs text-forest-400 hover:text-forest-200">
            Wie funktioniert das Punkte-System?
          </summary>
          <div className="mt-3 text-xs text-forest-300 space-y-1.5">
            <p><strong>Phasen-Punkte:</strong> Vorrunde 3 · 32-tel 4 · Achtel 5 · Viertel 6 · Halb 7 · Bronze 7 · Finale 8</p>
            <p><strong>Boni:</strong> Tordifferenz richtig +1 · Exaktes Ergebnis +2 (zusätzlich)</p>
            <p><strong>🎴 Joker:</strong> 1× pro Phase, verdoppelt deine Punkte für ein Spiel</p>
            <p><strong>🏆 Final-Tipp:</strong> +15 P wenn der Weltmeister richtig getippt wurde</p>
            <p><strong>🎯 Gruppen-Quali:</strong> +5 P für jedes weiterkommende Team aus deiner Auswahl</p>
            <p><strong>🔥 Streak-Bonus:</strong> 3 in Folge richtig +2 · 5 in Folge +5</p>
          </div>
        </details>
      </div>
    </PageBackground>
  );
}
