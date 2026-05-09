import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { WmMatch, WmTeam, WmTip } from '@/lib/api';
import { useSubmitWmTip, useAllWmTips } from '@/lib/api';
import { computeOdds } from '@/lib/fifaRanks';

interface Props {
  match: WmMatch;
  teamsById: Map<string, WmTeam>;
  myTip: WmTip | undefined;
  jokerUsedInPhase: boolean;
}

const PHASE_POINTS: Record<string, number> = {
  group: 3, r32: 4, r16: 5, qf: 6, sf: 7, third: 7, final: 8,
};
const PHASE_LABEL: Record<string, string> = {
  group: 'Vorrunde', r32: 'R32', r16: 'Achtelfinale', qf: 'Viertelfinale', sf: 'Halbfinale', third: 'Spiel um Platz 3', final: 'Finale',
};

export function WmMatchCard({ match, teamsById, myTip, jokerUsedInPhase }: Props) {
  const home = match.home_team_id ? teamsById.get(match.home_team_id) : null;
  const away = match.away_team_id ? teamsById.get(match.away_team_id) : null;
  const submitTip = useSubmitWmTip();
  const allTips = useAllWmTips();

  const kickoff = useMemo(() => new Date(match.kickoff), [match.kickoff]);
  const tippingClosed = match.locked || new Date() >= kickoff;
  const finished = match.score_home !== null && match.score_away !== null;
  const teamsKnown = !!home && !!away;

  const [outcome, setOutcome] = useState<'home' | 'draw' | 'away' | null>(myTip?.tip_outcome ?? null);
  const [scoreHome, setScoreHome] = useState<string>(myTip?.score_home_guess?.toString() ?? '');
  const [scoreAway, setScoreAway] = useState<string>(myTip?.score_away_guess?.toString() ?? '');
  const [joker, setJoker] = useState<boolean>(myTip?.joker ?? false);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Reset state when myTip changes externally
  useEffect(() => {
    if (myTip) {
      setOutcome(myTip.tip_outcome);
      setScoreHome(myTip.score_home_guess?.toString() ?? '');
      setScoreAway(myTip.score_away_guess?.toString() ?? '');
      setJoker(myTip.joker);
    }
  }, [myTip]);

  // Heat-Map: % of all tips per outcome for this match
  const heat = useMemo(() => {
    const tips = (allTips.data ?? []).filter((t) => t.match_id === match.id);
    if (tips.length === 0) return null;
    let h = 0, d = 0, a = 0;
    for (const t of tips) {
      if (t.tip_outcome === 'home') h++;
      else if (t.tip_outcome === 'draw') d++;
      else a++;
    }
    const total = tips.length;
    return {
      home: Math.round((h / total) * 100),
      draw: Math.round((d / total) * 100),
      away: Math.round((a / total) * 100),
      total,
    };
  }, [allTips.data, match.id]);

  async function pick(o: 'home' | 'draw' | 'away') {
    if (tippingClosed || !teamsKnown) return;
    setOutcome(o);
    setBusy(true);
    setErrMsg(null);
    const result = await submitTip.mutateAsync({
      match_id: match.id,
      outcome: o,
      score_home: scoreHome === '' ? null : Number(scoreHome),
      score_away: scoreAway === '' ? null : Number(scoreAway),
      joker,
    });
    setBusy(false);
    if (result === 'ok') {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } else {
      setErrMsg(translateError(result));
    }
  }

  async function saveExtras() {
    if (tippingClosed || !teamsKnown) return;
    const sH = scoreHome === '' ? null : Number(scoreHome);
    const sA = scoreAway === '' ? null : Number(scoreAway);
    let o = outcome;
    if (!o && sH != null && sA != null && !Number.isNaN(sH) && !Number.isNaN(sA)) {
      o = sH > sA ? 'home' : sH < sA ? 'away' : 'draw';
      setOutcome(o);
    }
    if (!o) return;
    setBusy(true);
    setErrMsg(null);
    const result = await submitTip.mutateAsync({
      match_id: match.id,
      outcome: o,
      score_home: sH,
      score_away: sA,
      joker,
    });
    setBusy(false);
    if (result === 'ok') {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } else {
      setErrMsg(translateError(result));
    }
  }

  // Result evaluation for UI
  const myResult = useMemo(() => {
    if (!finished || !myTip) return null;
    const actual = match.score_home! > match.score_away! ? 'home' : match.score_home! < match.score_away! ? 'away' : 'draw';
    return {
      correct: myTip.tip_outcome === actual,
      points: myTip.points_earned,
    };
  }, [finished, myTip, match.score_home, match.score_away]);

  // Card border color
  const borderClass = finished
    ? myResult?.correct ? 'ring-emerald-500/50' : 'ring-rose-700/40'
    : tippingClosed ? 'ring-forest-700/30' : 'ring-forest-800/40';

  return (
    <div className={`rounded-2xl bg-gradient-to-b from-forest-950/85 to-forest-950/65 ring-1 ${borderClass} backdrop-blur shadow-lg shadow-black/20 overflow-hidden`}>
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between text-xs text-forest-400">
        <span>{format(kickoff, 'EE dd.MM. HH:mm', { locale: de })}</span>
        <span className="flex items-center gap-1.5">
          <span className="text-forest-300">{PHASE_LABEL[match.phase]}</span>
          <span className="rounded-full bg-forest-800/60 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
            {PHASE_POINTS[match.phase]}P
          </span>
        </span>
      </div>

      {/* Teams */}
      <div className="px-4 pb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-2xl">{home?.flag ?? '⬜'}</span>
          <span className="font-semibold text-sm truncate">{home?.name ?? match.home_label ?? '?'}</span>
        </div>
        {finished ? (
          <div className="text-2xl font-black tabular-nums">
            {match.score_home}<span className="text-forest-500 mx-1">:</span>{match.score_away}
          </div>
        ) : (
          <span className="text-xs text-forest-500">vs</span>
        )}
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          <span className="font-semibold text-sm truncate text-right">{away?.name ?? match.away_label ?? '?'}</span>
          <span className="text-2xl">{away?.flag ?? '⬜'}</span>
        </div>
      </div>

      {/* FIFA-Quoten-Streifen */}
      {teamsKnown && (() => {
        const odds = computeOdds(home!.code, away!.code);
        return (
          <div className="px-4 pb-2">
            <div className="text-[10px] text-forest-500 uppercase tracking-wider mb-1">
              Chancen <span className="text-forest-600 normal-case">(FIFA-Rang)</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded-lg bg-blue-950/40 ring-1 ring-blue-700/30 py-1">
                <div className="text-[9px] text-blue-300/70 truncate px-1">Sieg {home!.name}</div>
                <div className="font-bold text-blue-200 tabular-nums text-sm">{odds.home}%</div>
              </div>
              <div className="rounded-lg bg-slate-900/50 ring-1 ring-slate-600/30 py-1">
                <div className="text-[9px] text-slate-400">Remis</div>
                <div className="font-bold text-slate-200 tabular-nums text-sm">{odds.draw}%</div>
              </div>
              <div className="rounded-lg bg-rose-950/40 ring-1 ring-rose-700/30 py-1">
                <div className="text-[9px] text-rose-300/70 truncate px-1">Sieg {away!.name}</div>
                <div className="font-bold text-rose-200 tabular-nums text-sm">{odds.away}%</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tipp-Buttons */}
      {teamsKnown && (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-3 gap-1.5">
            {(['home', 'draw', 'away'] as const).map((opt) => {
              const active = outcome === opt;
              const label =
                opt === 'home' ? (home!.name || match.home_label || home!.code)
                : opt === 'draw' ? 'Remis'
                : (away!.name || match.away_label || away!.code);
              const flag = opt === 'home' ? home!.flag : opt === 'away' ? away!.flag : '🤝';
              return (
                <button
                  key={opt}
                  disabled={tippingClosed || busy}
                  onClick={() => pick(opt)}
                  className={`relative rounded-xl px-1.5 py-2.5 font-bold transition ${
                    active
                      ? 'bg-amber-500 text-amber-950 shadow-md ring-2 ring-amber-300'
                      : tippingClosed
                        ? 'bg-forest-900/40 text-forest-500 cursor-not-allowed'
                        : 'bg-forest-900/70 text-forest-200 hover:bg-forest-800 ring-1 ring-forest-700/40'
                  }`}
                >
                  <span className="block text-lg">{flag}</span>
                  <span className="block text-[11px] mt-0.5 truncate px-1">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Mitglieder-Tipps Heat-Map */}
          {heat && heat.total > 0 && (
            <>
              <div className="mt-2 text-[9px] text-forest-500 uppercase tracking-wider">
                Mitglieder-Tipps ({heat.total})
              </div>
              <div className="mt-1 flex h-1 rounded-full overflow-hidden bg-forest-900/40">
                <div className="bg-blue-500/60" style={{ width: `${heat.home}%` }} />
                <div className="bg-slate-500/60" style={{ width: `${heat.draw}%` }} />
                <div className="bg-rose-500/60" style={{ width: `${heat.away}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-forest-500 tabular-nums">
                <span>{heat.home}%</span>
                <span>{heat.draw}%</span>
                <span>{heat.away}%</span>
              </div>
            </>
          )}

          {/* Exakt-Tipp + Joker — immer sichtbar wenn Teams + nicht gesperrt */}
          {!tippingClosed && (
            <div className="mt-3 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-forest-400">Exakt:</span>
                <input
                  type="number" min={0} max={20}
                  value={scoreHome}
                  onChange={(e) => setScoreHome(e.target.value)}
                  onBlur={saveExtras}
                  className="w-10 rounded bg-forest-900/80 px-2 py-1 text-center ring-1 ring-forest-700/40 focus:ring-amber-500/60 focus:outline-none"
                />
                <span className="text-forest-500">:</span>
                <input
                  type="number" min={0} max={20}
                  value={scoreAway}
                  onChange={(e) => setScoreAway(e.target.value)}
                  onBlur={saveExtras}
                  className="w-10 rounded bg-forest-900/80 px-2 py-1 text-center ring-1 ring-forest-700/40 focus:ring-amber-500/60 focus:outline-none"
                />
              </div>
              <button
                onClick={() => { setJoker(!joker); setTimeout(saveExtras, 50); }}
                disabled={!joker && jokerUsedInPhase}
                className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
                  joker
                    ? 'bg-amber-500 text-amber-950 ring-1 ring-amber-300'
                    : jokerUsedInPhase
                      ? 'bg-forest-900/40 text-forest-600 cursor-not-allowed'
                      : 'bg-forest-900/70 text-forest-300 ring-1 ring-forest-700/40 hover:bg-forest-800'
                }`}
                title={jokerUsedInPhase && !joker ? 'Joker bereits verwendet in dieser Phase' : 'Joker verdoppelt deine Punkte'}
              >
                🎴 Joker {joker ? '×2' : ''}
              </button>
            </div>
          )}

          {/* Status */}
          {savedFlash && (
            <p className="mt-2 text-xs text-emerald-400 text-center">✓ Gespeichert</p>
          )}
          {errMsg && (
            <p className="mt-2 text-xs text-rose-400 text-center">{errMsg}</p>
          )}
        </div>
      )}

      {!teamsKnown && (
        <div className="px-4 pb-3 text-xs text-forest-500 italic">
          Teams werden nach der Vorrunde festgelegt.
        </div>
      )}

      {/* Result feedback */}
      {finished && myTip && (
        <div className={`px-4 py-2 ${myResult?.correct ? 'bg-emerald-950/40' : 'bg-rose-950/30'} border-t border-forest-800/40 flex items-center justify-between text-xs`}>
          <span className={myResult?.correct ? 'text-emerald-300' : 'text-rose-300'}>
            {myResult?.correct ? '✓ Richtig getippt!' : '✗ Daneben'}
          </span>
          <span className="font-semibold tabular-nums">+{myResult?.points ?? 0} Punkte</span>
        </div>
      )}
    </div>
  );
}

function translateError(code: string): string {
  switch (code) {
    case 'tipping_closed': return 'Tipps sind geschlossen.';
    case 'joker_already_used_in_phase': return 'Joker für diese Phase schon verwendet.';
    case 'not_authorized': return 'Nicht angemeldet.';
    case 'match_not_found': return 'Spiel nicht gefunden.';
    default: return code;
  }
}
