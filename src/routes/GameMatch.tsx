import { Suspense, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { PageBackground } from '@/components/PageBackground';
import {
  useGameMatch, useAcceptChallenge, useDeclineChallenge, useCancelPending, useJoinOpenMatch,
} from '@/lib/games';
import { GAME_REGISTRY, GAME_LABELS } from '@/components/games/registry';
import { useCurrentMember } from '@/lib/api';

export default function GameMatch() {
  const { matchId } = useParams<{ matchId: string }>();
  const matchQ = useGameMatch(matchId);
  const me = useCurrentMember();
  const m = matchQ.data;
  const meta = m ? GAME_REGISTRY[m.kind] : undefined;
  const label = m ? GAME_LABELS[m.kind] : null;

  // Einladungs-Zwischenzustand (Migration 0145): ein pending-Match ist noch
  // keine Partie. Der Eingeladene entscheidet, der Einladende wartet — die
  // Spiel-Komponente wird erst gemountet, wenn das Match wirklich läuft.
  const myId = me.data?.id ?? null;
  const istPending = !!m && m.status === 'pending';

  return (
    // overscroll-none: siehe GameSolo — keine Browser-Gesten über einer Partie.
    <PageBackground page="planner" className="min-h-screen overscroll-none">
      <header className="sticky top-0 z-30 border-b border-forest-800/40 bg-forest-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center gap-3">
            <Link to="/spiele" className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800">
              ←
            </Link>
            <h1 className="text-sm sm:text-base font-semibold text-forest-100">
              {label ? `${label.emoji} ${label.label}` : 'Match'}
            </h1>
          </div>
        </div>
      </header>

      {matchQ.isLoading && <div className="text-center text-forest-300 p-8">Lade Match…</div>}
      {!matchQ.isLoading && !m && <div className="text-center text-rose-300 p-8">Match nicht gefunden.</div>}
      {m && !meta && (
        <div className="text-center text-amber-300 p-8">
          Dieses Spiel wird nicht mehr angeboten — das Match bleibt gespeichert.
        </div>
      )}
      {m && meta && istPending && myId && (
        <PendingPanel
          matchId={m.id}
          spielName={`${label?.emoji ?? ''} ${label?.label ?? ''}`}
          rolle={m.player_b === myId ? 'eingeladen' : m.player_a === myId ? 'wartend' : 'offen'}
        />
      )}
      {m && meta && !istPending && (
        <Suspense fallback={<div className="text-center text-forest-300 p-8">Lade Spiel…</div>}>
          <meta.component matchId={matchId} />
        </Suspense>
      )}
    </PageBackground>
  );
}

function PendingPanel({ matchId, spielName, rolle }: {
  matchId: string;
  spielName: string;
  rolle: 'eingeladen' | 'wartend' | 'offen';
}) {
  const navigate = useNavigate();
  const accept = useAcceptChallenge();
  const decline = useDeclineChallenge();
  const cancel = useCancelPending();
  const join = useJoinOpenMatch();
  const [fehler, setFehler] = useState<string | null>(null);
  const busy = accept.isPending || decline.isPending || cancel.isPending || join.isPending;

  return (
    <div className="mx-auto max-w-sm p-6 text-center">
      <div className="rounded-2xl bg-forest-950/70 p-6 ring-1 ring-forest-800/50">
        <p className="text-3xl" aria-hidden>🎮</p>

        {rolle === 'eingeladen' && (
          <>
            <h2 className="mt-2 text-lg font-bold text-forest-100">Du wurdest herausgefordert</h2>
            <p className="mt-1 text-sm text-forest-300">{spielName} — nimmst du an?</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={async () => {
                  setFehler(null);
                  try { await accept.mutateAsync(matchId); } catch (e) { setFehler((e as Error).message); }
                }}
                disabled={busy}
                className="flex-1 rounded-xl bg-emerald-500/80 px-4 py-3 text-sm font-bold text-forest-950 disabled:opacity-50"
                style={{ touchAction: 'manipulation' }}
              >
                ✅ Annehmen
              </button>
              <button
                onClick={async () => {
                  setFehler(null);
                  try { await decline.mutateAsync(matchId); navigate('/spiele'); }
                  catch (e) { setFehler((e as Error).message); }
                }}
                disabled={busy}
                className="flex-1 rounded-xl bg-forest-900/70 px-4 py-3 text-sm text-forest-300 ring-1 ring-forest-700/50 disabled:opacity-50"
                style={{ touchAction: 'manipulation' }}
              >
                Ablehnen
              </button>
            </div>
          </>
        )}

        {rolle === 'wartend' && (
          <>
            <h2 className="mt-2 text-lg font-bold text-forest-100">Einladung verschickt</h2>
            <p className="mt-1 text-sm text-forest-300">
              {spielName} — sobald dein Gegner annimmt, geht es hier los.
            </p>
            <button
              onClick={async () => {
                setFehler(null);
                try { await cancel.mutateAsync(matchId); navigate('/spiele'); }
                catch (e) { setFehler((e as Error).message); }
              }}
              disabled={busy}
              className="mt-4 rounded-xl bg-forest-900/70 px-4 py-2.5 text-sm text-forest-300 ring-1 ring-forest-700/50 disabled:opacity-50"
              style={{ touchAction: 'manipulation' }}
            >
              ✕ Einladung zurückziehen
            </button>
          </>
        )}

        {rolle === 'offen' && (
          <>
            <h2 className="mt-2 text-lg font-bold text-forest-100">Offener Tisch</h2>
            <p className="mt-1 text-sm text-forest-300">{spielName} — Platz frei. Setz dich dazu.</p>
            <button
              onClick={async () => {
                setFehler(null);
                try { await join.mutateAsync(matchId); } catch (e) { setFehler((e as Error).message); }
              }}
              disabled={busy}
              className="mt-4 rounded-xl bg-emerald-500/80 px-5 py-3 text-sm font-bold text-forest-950 disabled:opacity-50"
              style={{ touchAction: 'manipulation' }}
            >
              Beitreten
            </button>
          </>
        )}

        {fehler && (
          <p className="mt-3 rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-500/30">
            {fehler}
          </p>
        )}
      </div>
    </div>
  );
}
