import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PageBackground } from '@/components/PageBackground';
import { WmMatchCard } from '@/components/WmMatchCard';
import { WmLeaderboard } from '@/components/WmLeaderboard';
import { WmPreTournament } from '@/components/WmPreTournament';
import { AdminQuickNav } from '@/components/AdminQuickNav';
import { MemberQuickNav } from '@/components/MemberQuickNav';
import { ThemeToggle } from '@/components/ThemeToggle';
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
            <ThemeToggle compact />
            {isAdmin ? (
              <AdminQuickNav variant="icons" />
            ) : (
              <MemberQuickNav myMemberId={m?.id} />
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
        {/* ── RANGLISTE & PUNKTE-SYSTEM oben ─────────────────────────── */}
        <section>
          <h2 className="text-lg font-bold text-amber-100 mb-3 flex items-center gap-2">
            <span className="text-2xl">🏅</span>
            <span>Rangliste</span>
          </h2>
          <WmLeaderboard myMemberId={m?.id} />
        </section>

        <PunkteSystemBox />

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

      </div>
    </PageBackground>
  );
}

// ── Punkte-System: eigenständige, designte Box ────────────────────────────
function PunkteSystemBox() {
  const phasen: { label: string; short: string; points: number }[] = [
    { label: 'Vorrunde',   short: 'Vorr.',   points: 3 },
    { label: '32-tel-Finale', short: '32-tel', points: 4 },
    { label: 'Achtelfinale',  short: 'Achtel', points: 5 },
    { label: 'Viertelfinale', short: 'Viert.', points: 6 },
    { label: 'Halbfinale',    short: 'Halb',   points: 7 },
    { label: 'Bronze',     short: 'Bronze', points: 7 },
    { label: 'Finale',     short: 'Final',  points: 8 },
  ];
  const boni: { icon: string; label: string; points: string; desc: string }[] = [
    { icon: '➕', label: 'Tordifferenz richtig',    points: '+1', desc: 'wenn z. B. dein 2:1 zu einem 3:2 wird' },
    { icon: '🎯', label: 'Exaktes Ergebnis',        points: '+2', desc: 'on top auf die Tordifferenz' },
  ];
  const specials: { icon: string; title: string; points: string; desc: string; color: string }[] = [
    { icon: '🎴', title: 'Joker',           points: '×2',   desc: '1× pro Phase einsetzen — verdoppelt deine Punkte für DIESES Spiel.',          color: 'violet' },
    { icon: '🏆', title: 'Weltmeister-Tipp', points: '+15 P', desc: 'Korrekt vor Turnier-Start → einmaliger Massenbonus.',                          color: 'amber' },
    { icon: '🎯', title: 'Gruppen-Quali',   points: '+5 P',  desc: 'Pro Team aus deinem Vorrunden-Tipp, das es in die K.-o.-Runde schafft.',        color: 'emerald' },
    { icon: '🔥', title: 'Streak-Bonus',    points: '+2 / +5', desc: '3 in Folge richtig → +2 Bonus · 5 in Folge → +5 Bonus (kumulativ).',          color: 'rose' },
  ];
  const ringColor: Record<string, string> = {
    violet:  'ring-violet-500/40 bg-violet-500/10  text-violet-200',
    amber:   'ring-amber-500/40  bg-amber-500/10   text-amber-100',
    emerald: 'ring-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    rose:    'ring-rose-500/40   bg-rose-500/10    text-rose-200',
  };
  const pointBadge: Record<string, string> = {
    violet:  'bg-violet-500/30 text-violet-100',
    amber:   'bg-amber-500/30  text-amber-100',
    emerald: 'bg-emerald-500/30 text-emerald-100',
    rose:    'bg-rose-500/30   text-rose-100',
  };

  return (
    <section
      className="relative overflow-hidden rounded-2xl ring-1 ring-amber-500/30 shadow-lg shadow-amber-900/20"
      style={{
        background:
          'linear-gradient(140deg, rgba(252,211,77,0.10) 0%, rgba(15,23,42,0.85) 40%, rgba(15,23,42,0.95) 100%)',
      }}
    >
      {/* Dekorative Goldfäden im Hintergrund */}
      <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-amber-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-amber-700/10 blur-3xl" />

      {/* Header */}
      <header className="relative flex items-center gap-3 px-5 py-4 border-b border-amber-500/20">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 text-xl shadow-md shadow-amber-900/40">
          🎯
        </div>
        <div>
          <h2 className="text-lg font-bold text-amber-100 leading-tight">Punkte-System</h2>
          <p className="text-[11px] text-amber-300/70">So sammelst du Punkte beim Tippspiel</p>
        </div>
      </header>

      <div className="relative px-5 py-4 space-y-5">

        {/* ── Phasen-Punkte ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-[0.15em] text-amber-300/70 font-semibold">Grund-Punkte</span>
            <span className="text-[10px] text-forest-400">je richtiger Sieger-Tipp</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {phasen.map((p) => (
              <div
                key={p.label}
                className="flex items-center gap-1.5 rounded-lg bg-forest-900/70 ring-1 ring-amber-500/20 px-2.5 py-1.5"
                title={p.label}
              >
                <span className="text-[11px] font-medium text-forest-200">{p.short}</span>
                <span className="rounded-md bg-amber-500/25 px-1.5 py-0.5 text-[11px] font-bold text-amber-100 tabular-nums">
                  {p.points}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Ergebnis-Boni ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-[0.15em] text-amber-300/70 font-semibold">Ergebnis-Boni</span>
            <span className="text-[10px] text-forest-400">zusätzlich zu den Grund-Punkten</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {boni.map((b) => (
              <div
                key={b.label}
                className="flex items-center gap-2.5 rounded-lg bg-forest-900/50 ring-1 ring-forest-700/40 px-3 py-2"
              >
                <span className="text-lg">{b.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-forest-100">{b.label}</div>
                  <div className="text-[10px] text-forest-400 mt-0.5">{b.desc}</div>
                </div>
                <span className="rounded-md bg-emerald-500/25 px-1.5 py-0.5 text-[11px] font-bold text-emerald-100 tabular-nums whitespace-nowrap">
                  {b.points}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Spezial-Tipps ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-[0.15em] text-amber-300/70 font-semibold">Spezial-Tipps & Boni</span>
            <span className="text-[10px] text-forest-400">die großen Punkte-Booster</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {specials.map((s) => (
              <div
                key={s.title}
                className={`flex items-start gap-2.5 rounded-lg ring-1 px-3 py-2.5 ${ringColor[s.color]}`}
              >
                <span className="text-xl shrink-0">{s.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold">{s.title}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${pointBadge[s.color]}`}>
                      {s.points}
                    </span>
                  </div>
                  <div className="text-[10px] mt-1 opacity-80 leading-snug">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Beispielrechnung */}
        <div className="rounded-lg bg-amber-950/30 ring-1 ring-amber-500/20 px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">💡</span>
            <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-amber-200/90">Beispiel</span>
          </div>
          <p className="text-[11px] text-amber-100/85 leading-relaxed">
            Du tippst <strong className="text-amber-200">2:1</strong> für Spanien gegen Frankreich im Viertelfinale —
            es steht <strong className="text-amber-200">3:2</strong> für Spanien.
            <br />
            <span className="text-amber-300/80">
              6 (Sieger) + 1 (Tordifferenz richtig) = <strong className="text-amber-100">7 Punkte</strong>
              {' · '}
              mit 🎴 Joker = <strong className="text-amber-100">14 Punkte</strong>
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
