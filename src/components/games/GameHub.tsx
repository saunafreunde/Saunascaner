import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useCurrentMember, useMembersDirectory } from '@/lib/api';
import {
  useActiveMatchesForMe, useOpenMatches, useJoinOpenMatch, useChallenge,
  useAcceptChallenge, useDeclineChallenge, useCancelPending,
  useGameLeaderboard, type GameKind,
} from '@/lib/games';
import { GAME_LABELS, GAME_REGISTRY, GAME_IDS } from './registry';
import { Avatar } from '@/components/Avatar';
import { LeaderboardSection } from './LeaderboardSection';
import { PushPermission } from '@/components/PushPermission';

// Der Spiele-Hub nach der Neubewertung vom 16.08.2026: EIN Screen ohne
// Scrollen — sechs Kacheln mit ehrlicher Dauer-Angabe, darüber genau eine
// Kontext-Zeile. Vorher: 14 Breitkarten in einer Spalte, ein „Phase 1"-Text
// aus der Entwicklungszeit und window.location.href-Navigation, die die PWA
// jedes Mal komplett neu lud.

type HubTab = 'play' | 'leaderboard';

export function GameHub() {
  const me = useCurrentMember();
  const myId = me.data?.id ?? null;
  const activeQ = useActiveMatchesForMe();
  const openQ = useOpenMatches();
  const join = useJoinOpenMatch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<HubTab>('play');
  // Welche PvP-Kachel gerade ihr Start-Panel zeigt (Duell-Spiele starten
  // nicht sofort — erst Gegner wählen oder offen warten).
  const [pvpOffen, setPvpOffen] = useState<GameKind | null>(null);
  const [joinFehler, setJoinFehler] = useState<string | null>(null);

  const active = activeQ.data ?? [];
  const open = openQ.data ?? [];
  const dran = active.filter((m) => m.my_turn);

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-4">
      {/* Genau EINE Kontext-Zeile — das Wichtigste zuerst, keine Prosa. */}
      {dran.length > 0 ? (
        <Link
          to={`/spiele/match/${dran[0].match_id}`}
          className="flex items-center gap-2 rounded-xl bg-amber-500/20 px-3 py-2.5 ring-1 ring-amber-500/40 text-amber-200 text-sm font-semibold"
        >
          🔔 Du bist dran{dran[0].opponent_name ? ` gegen ${dran[0].opponent_name}` : ''}
          {dran.length > 1 && ` (+${dran.length - 1} weitere)`}
          <span className="ml-auto" aria-hidden>→</span>
        </Link>
      ) : (
        <WochenKrone />
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-forest-950/60 p-1 ring-1 ring-forest-800/40">
        {([['play', '🎮 Spielen'], ['leaderboard', '🏆 Bestenliste']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === id ? 'bg-forest-700/80 text-forest-100' : 'text-forest-400'
            }`}
            style={{ touchAction: 'manipulation' }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'leaderboard' ? (
        <LeaderboardSection />
      ) : (
        <>
          {/* Laufende Matches + Einladungen — kompakt, nur wenn vorhanden */}
          {active.length > 0 && (
            <ul className="space-y-1.5">
              {active.map((m) => <MatchZeile key={m.match_id} m={m} />)}
            </ul>
          )}

          {/* Die sechs Kacheln — das Herz des Hubs */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {GAME_IDS.map((k) => (
              <SpielKachel
                key={k}
                kind={k}
                aktiv={pvpOffen === k}
                onOeffnen={() => {
                  const meta = GAME_REGISTRY[k]!;
                  if (meta.mode === 'solo') navigate(`/spiele/solo/${k}`);
                  else setPvpOffen((v) => (v === k ? null : k));
                }}
              />
            ))}
          </div>

          {/* Start-Panel für das gewählte Duell-Spiel */}
          {pvpOffen && (
            <PvPStart
              kind={pvpOffen}
              myId={myId}
              onZu={() => setPvpOffen(null)}
            />
          )}

          {/* Ohne Push kommt keine Herausforderung an — Stand 16.08.2026
              hatten 2 von 43 Mitgliedern ein Push-Abo. Der Hinweis steht
              deshalb genau dort, wo man ihn braucht: beim Duell-Start. */}
          {pvpOffen && myId && <PushPermission memberId={myId} />}

          {/* Offene Tische anderer */}
          {open.some((o) => o.challenger_id !== myId) && (
            <section>
              <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-forest-400">
                Offene Tische
              </h2>
              {joinFehler && (
                <p className="mb-2 rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-500/30">
                  {joinFehler}
                </p>
              )}
              <ul className="space-y-1.5">
                {open.filter((o) => o.challenger_id !== myId).map((o) => (
                  <li key={o.match_id}
                    className="flex items-center gap-2.5 rounded-xl bg-forest-900/50 px-3 py-2 ring-1 ring-forest-800/50">
                    <span className="text-lg" aria-hidden>{GAME_LABELS[o.kind].emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-forest-100">
                      {GAME_LABELS[o.kind].label}
                      <span className="text-forest-400"> — {o.challenger_name} wartet</span>
                    </span>
                    <button
                      onClick={async () => {
                        setJoinFehler(null);
                        try {
                          await join.mutateAsync(o.match_id);
                          navigate(`/spiele/match/${o.match_id}`);
                        } catch (e) { setJoinFehler((e as Error).message); }
                      }}
                      disabled={join.isPending}
                      className="rounded-lg bg-emerald-500/80 px-3 py-1.5 text-xs font-bold text-forest-950 disabled:opacity-50"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Beitreten
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** Eine Zeile der Match-Liste. Einladungen (Migration 0145) werden direkt
 *  hier beantwortet — Annehmen/Ablehnen ohne Umweg über die Match-Seite. */
function MatchZeile({ m }: { m: import('@/lib/games').ActiveMatchSummary }) {
  const meta = GAME_LABELS[m.kind];
  const accept = useAcceptChallenge();
  const decline = useDeclineChallenge();
  const cancel = useCancelPending();
  const navigate = useNavigate();
  const [fehler, setFehler] = useState<string | null>(null);
  const busy = accept.isPending || decline.isPending || cancel.isPending;

  if (m.pending_role === 'eingeladen') {
    return (
      <li className="rounded-xl bg-amber-500/15 px-3 py-2 ring-1 ring-amber-500/40">
        <div className="flex items-center gap-2.5">
          <span className="text-lg" aria-hidden>{meta.emoji}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-forest-100">
            <span className="font-semibold">{m.opponent_name ?? '?'}</span> fordert dich heraus
            <span className="text-forest-400"> — {meta.label}</span>
          </span>
          <button
            onClick={async () => {
              setFehler(null);
              try { await accept.mutateAsync(m.match_id); navigate(`/spiele/match/${m.match_id}`); }
              catch (e) { setFehler((e as Error).message); }
            }}
            disabled={busy}
            className="rounded-lg bg-emerald-500/80 px-3 py-1.5 text-xs font-bold text-forest-950 disabled:opacity-50"
            style={{ touchAction: 'manipulation' }}
          >
            Annehmen
          </button>
          <button
            onClick={() => { setFehler(null); decline.mutate(m.match_id, { onError: (e) => setFehler((e as Error).message) }); }}
            disabled={busy}
            className="rounded-lg bg-forest-900/70 px-3 py-1.5 text-xs text-forest-300 ring-1 ring-forest-700/50 disabled:opacity-50"
            style={{ touchAction: 'manipulation' }}
          >
            Ablehnen
          </button>
        </div>
        {fehler && <p className="mt-1.5 text-xs text-rose-300">{fehler}</p>}
      </li>
    );
  }

  if (m.pending_role === 'wartet' || m.pending_role === 'offen') {
    return (
      <li className="flex items-center gap-2.5 rounded-xl bg-forest-900/40 px-3 py-2 ring-1 ring-forest-800/40">
        <span className="text-lg" aria-hidden>{meta.emoji}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-forest-300">
          {meta.label} — {m.pending_role === 'offen'
            ? 'offener Tisch, wartet auf Mitspieler'
            : `Einladung an ${m.opponent_name ?? '?'} — noch keine Antwort`}
        </span>
        <button
          onClick={() => cancel.mutate(m.match_id, { onError: (e) => setFehler((e as Error).message) })}
          disabled={busy}
          className="rounded-lg px-2.5 py-1.5 text-xs text-forest-400 ring-1 ring-forest-800/50 disabled:opacity-50"
          style={{ touchAction: 'manipulation' }}
          title="Zurückziehen"
        >
          ✕ zurückziehen
        </button>
        {fehler && <span className="text-xs text-rose-300">{fehler}</span>}
      </li>
    );
  }

  return (
    <li>
      <Link to={`/spiele/match/${m.match_id}`}
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ring-1 transition ${
          m.my_turn ? 'bg-amber-500/15 ring-amber-500/40' : 'bg-forest-900/50 ring-forest-800/50'
        }`}>
        <span className="text-lg" aria-hidden>{meta.emoji}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-forest-100">
          {meta.label}
          <span className="text-forest-400"> — vs. {m.opponent_name ?? '?'}</span>
        </span>
        {m.my_turn && <span className="text-xs font-bold text-amber-300">dran →</span>}
      </Link>
    </li>
  );
}

/** Kontext-Zeile, wenn kein Match wartet: der aktuelle König des
 *  meistgespielten Spiels. Ab Stufe 2 wird daraus die Wochen-Krone. */
function WochenKrone() {
  const top = useGameLeaderboard('snake', 'all');
  const t = top.data?.[0];
  if (!t) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl bg-forest-900/50 px-3 py-2.5 ring-1 ring-forest-800/50 text-sm text-forest-200">
      <span aria-hidden>👑</span>
      <span className="min-w-0 truncate">
        Snake-König: <span className="font-semibold text-forest-100">{t.name}</span>
      </span>
      <span className="ml-auto font-bold tabular-nums text-amber-300">{t.score}</span>
    </div>
  );
}

/** Eine Spiel-Kachel: Emoji, Name, ehrliche Dauer, Bestwert-Kronenzeile. */
function SpielKachel({ kind, aktiv, onOeffnen }: {
  kind: GameKind; aktiv: boolean; onOeffnen: () => void;
}) {
  const meta = GAME_REGISTRY[kind]!;
  const top = useGameLeaderboard(kind, 'all');
  const t = top.data?.[0];
  const istSolo = meta.mode === 'solo';
  return (
    <button
      onClick={onOeffnen}
      className={`rounded-2xl p-3.5 text-left ring-1 transition active:scale-[0.98] ${
        aktiv ? 'bg-forest-800/80 ring-amber-500/50'
          : 'bg-forest-900/60 ring-forest-800/50 hover:bg-forest-900/80'
      }`}
      style={{ touchAction: 'manipulation' }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-3xl" aria-hidden>{meta.emoji}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          istSolo ? 'bg-forest-950/60 text-forest-400' : 'bg-amber-500/15 text-amber-300'
        }`}>
          {istSolo ? 'Solo' : meta.mode === 'live' ? 'Duell' : 'Fernduell'}
        </span>
      </div>
      <div className="mt-1.5 font-semibold text-forest-100">{meta.label}</div>
      <div className="text-[11px] text-forest-400">⏱ {meta.dauer}</div>
      {t ? (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-200/90">
          <span aria-hidden>👑</span>
          <span className="min-w-0 truncate">{t.name}</span>
          <span className="ml-auto font-bold tabular-nums">{t.score}</span>
        </div>
      ) : (
        <div className="mt-1.5 text-[11px] text-forest-500">Noch keine Bestzeit — sei du es.</div>
      )}
    </button>
  );
}

/** Start-Panel eines Duell-Spiels: offen warten oder gezielt herausfordern.
 *  Fehler erscheinen als Text im Panel — alert() unterbrach die PWA modal
 *  und wirkte wie ein Absturz. */
function PvPStart({ kind, myId, onZu }: {
  kind: GameKind; myId: string | null; onZu: () => void;
}) {
  const meta = GAME_REGISTRY[kind]!;
  const navigate = useNavigate();
  const challenge = useChallenge();
  const members = useMembersDirectory();
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const kandidaten = (members.data ?? []).filter((m) => m.id !== myId);

  async function offenWarten() {
    setFehler(null); setBusy(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      if (!supabase) throw new Error('Keine Verbindung.');
      const { data, error } = await supabase.rpc('games_create_match', { p_kind: kind, p_opponent: null });
      if (error) throw error;
      navigate(`/spiele/match/${data}`);
    } catch (e) { setFehler((e as Error).message); }
    finally { setBusy(false); }
  }

  async function herausfordern(gegnerId: string) {
    setFehler(null);
    try {
      const matchId = await challenge.mutateAsync({ opponent: gegnerId, kind });
      navigate(`/spiele/match/${matchId}`);
    } catch (e) { setFehler((e as Error).message); }
  }

  return (
    <section className="rounded-2xl bg-forest-900/70 p-4 ring-1 ring-amber-500/30">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-forest-100">
          <span aria-hidden className="mr-1">{meta.emoji}</span>{meta.label} starten
        </h2>
        <button onClick={onZu} className="rounded-lg px-2 py-1 text-xs text-forest-400"
          style={{ touchAction: 'manipulation' }}>
          schließen
        </button>
      </div>

      <button
        onClick={offenWarten}
        disabled={busy}
        className="mt-3 w-full rounded-xl bg-forest-800/80 px-3 py-2.5 text-sm text-forest-100 ring-1 ring-forest-700/50 disabled:opacity-50"
        style={{ touchAction: 'manipulation' }}
      >
        🪑 Offen warten — wer zuerst beitritt, spielt
      </button>

      <p className="mt-3 mb-1.5 text-xs font-semibold uppercase tracking-wider text-forest-400">
        Oder direkt herausfordern
      </p>
      <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-xl bg-forest-950/60 p-1.5 ring-1 ring-forest-800/40">
        {kandidaten.length === 0 && <p className="p-2 text-xs text-forest-400">Keine Gegner verfügbar.</p>}
        {kandidaten.map((m) => (
          <button
            key={m.id}
            onClick={() => herausfordern(m.id)}
            disabled={challenge.isPending}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-forest-200 active:bg-forest-900/70 disabled:opacity-50"
            style={{ touchAction: 'manipulation' }}
          >
            <Avatar avatarPath={m.avatar_path} name={m.name} size="xs" />
            <span className="truncate">{m.name}</span>
          </button>
        ))}
      </div>

      {fehler && (
        <p className="mt-2 rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-500/30">
          {fehler}
        </p>
      )}
    </section>
  );
}
