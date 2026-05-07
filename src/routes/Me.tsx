import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  useCurrentMember, usePresentMembers, useInfusions, useSaunas,
  useActiveEvacuation, useMyPolls, useSubmitPollResponse,
  togglePresenceByCode, type MyPoll,
} from '@/lib/api';
import { fmtClock, dayLabel } from '@/lib/time';
import { PageBackground } from '@/components/PageBackground';

function fmtMemberNumber(n: number | null | undefined): string {
  if (!n) return '';
  return `FDS-${String(n).padStart(3, '0')}`;
}

export default function Me() {
  const { signOut } = useAuth();
  const member = useCurrentMember();
  const present = usePresentMembers();
  const infusions = useInfusions();
  const saunas = useSaunas();
  const evacQ = useActiveEvacuation();
  const pollsQ = useMyPolls();

  const [checkBusy, setCheckBusy] = useState(false);
  const [checkMsg, setCheckMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const m = member.data;
  const isPresent = !!present.data?.find((p) => p.id === m?.id);

  async function toggleCheckin() {
    if (!m) return;
    setCheckBusy(true);
    setCheckMsg(null);
    try {
      const r = await togglePresenceByCode(m.member_code);
      setCheckMsg({ ok: true, text: r.is_present ? '✅ Eingecheckt — willkommen!' : '👋 Ausgecheckt — bis zum nächsten Mal!' });
      await present.refetch();
    } catch (e) {
      setCheckMsg({ ok: false, text: (e as Error).message });
    } finally {
      setCheckBusy(false);
    }
  }

  const todayInfusions = (infusions.data ?? []).filter((i) => {
    const d = new Date(i.start_time);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const saunaName = (id: string) => saunas.data?.find((s) => s.id === id)?.name ?? '';
  const saunaColor = (id: string) => saunas.data?.find((s) => s.id === id)?.accent_color ?? '#22c55e';

  const openPolls = (pollsQ.data ?? []).filter((p) => !p.my_answer);
  const answeredPolls = (pollsQ.data ?? []).filter((p) => !!p.my_answer);

  const evacuation = evacQ.data;

  return (
    <PageBackground page="dashboard">
      {/* Evakuierungsalarm — Vollbild-Overlay */}
      {evacuation && (
        <div className="fixed inset-0 z-50 bg-rose-950/95 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-6xl mb-4">🚨</div>
          <h1 className="text-3xl font-black uppercase tracking-widest text-rose-100 mb-2">EVAKUIERUNG</h1>
          <p className="text-rose-200 mb-6">Bitte verlasse sofort das Gebäude und begib dich zum Sammelplatz.</p>
          <div className="rounded-2xl bg-rose-900/60 ring-1 ring-rose-500/40 p-4 max-w-sm w-full">
            <p className="text-sm font-semibold text-rose-100 mb-2">Anwesend ({evacuation.present_count} Personen):</p>
            <ul className="text-sm text-rose-200 space-y-1 max-h-48 overflow-y-auto">
              {evacuation.present_names.map((n) => <li key={n}>• {n}</li>)}
            </ul>
          </div>
          <p className="mt-4 text-xs text-rose-300/70">Alarm ausgelöst: {new Date(evacuation.triggered_at).toLocaleString('de-DE')}</p>
        </div>
      )}

      <header className="border-b border-forest-800/40 bg-forest-950/85 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-forest-100 truncate">
            {m ? `Hallo, ${m.name.split(' ')[0]}` : 'Mein Bereich'}
          </h1>
          {m && (
            <p className="text-xs text-forest-300/70">
              {fmtMemberNumber(m.member_number)} · {m.role === 'super_admin' ? 'Super-Admin' : m.role === 'manager' ? 'Manager' : 'Saunameister'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(m?.role === 'super_admin' || m?.role === 'manager') && (
            <Link to="/planner" className="text-xs text-forest-300 hover:text-forest-100 underline">Planner</Link>
          )}
          <button onClick={() => signOut()} className="rounded-lg bg-forest-900/80 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900">
            Abmelden
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-lg p-4 space-y-4">

        {/* Check-in / Check-out */}
        <section className="rounded-2xl bg-forest-950/80 p-5 ring-1 ring-forest-800/50 backdrop-blur text-center">
          <p className="text-sm text-forest-300/70 mb-1">Dein Status</p>
          <div className={`text-lg font-bold mb-4 ${isPresent ? 'text-emerald-300' : 'text-forest-300/60'}`}>
            {isPresent ? '✅ Anwesend' : '⬜ Nicht eingecheckt'}
          </div>
          <button
            onClick={toggleCheckin}
            disabled={checkBusy || !m}
            className={`w-full rounded-xl px-5 py-4 text-base font-bold transition disabled:opacity-60 ${
              isPresent
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-forest-500 hover:bg-forest-400 text-forest-950'
            }`}
          >
            {checkBusy ? 'Bitte warten…' : isPresent ? 'Auschecken' : 'Einchecken'}
          </button>
          {checkMsg && (
            <p className={`mt-3 text-sm font-medium ${checkMsg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
              {checkMsg.text}
            </p>
          )}
        </section>

        {/* Offene Abfragen — nach Check-in hervorgehoben */}
        {openPolls.length > 0 && (
          <section className="rounded-2xl bg-amber-950/40 ring-2 ring-amber-500/40 p-4 backdrop-blur">
            <h2 className="text-sm font-bold text-amber-200 mb-3">
              📋 {openPolls.length} offene Abfrage{openPolls.length > 1 ? 'n' : ''} — bitte antworten
            </h2>
            <div className="space-y-3">
              {openPolls.map((poll) => (
                <PollCard key={poll.id} poll={poll} memberId={m?.id ?? ''} onAnswered={() => pollsQ.refetch()} />
              ))}
            </div>
          </section>
        )}

        {/* Heutiger Aufgussplan */}
        <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
          <h2 className="text-base font-semibold text-forest-100 mb-3">Heutiger Aufgussplan</h2>
          {todayInfusions.length === 0 ? (
            <p className="text-sm text-forest-300/60">Heute noch keine Aufgüsse geplant.</p>
          ) : (
            <ul className="space-y-2">
              {todayInfusions.map((i) => (
                <li key={i.id} className="flex items-center gap-3 rounded-lg bg-forest-900/60 px-3 py-2 ring-1 ring-forest-800/40"
                  style={{ borderLeft: `3px solid ${saunaColor(i.sauna_id)}` }}>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{i.title}</div>
                    <div className="text-xs text-forest-300/70 mt-0.5">
                      {fmtClock(i.start_time)} · {saunaName(i.sauna_id)} · {i.duration_minutes} Min
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Anwesende Mitglieder */}
        <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
          <h2 className="text-base font-semibold text-forest-100 mb-3">
            Aktuell anwesend ({present.data?.length ?? 0})
          </h2>
          {(present.data ?? []).length === 0 ? (
            <p className="text-sm text-forest-300/60">Niemand eingecheckt.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {(present.data ?? []).map((p) => (
                <li key={p.id} className={`rounded-full px-3 py-1 text-sm ring-1 ${
                  p.id === m?.id ? 'bg-forest-500 text-forest-950 ring-forest-400 font-semibold' : 'bg-forest-900/60 text-forest-200 ring-forest-800/40'
                }`}>
                  {p.name}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Bereits beantwortete Abfragen */}
        {answeredPolls.length > 0 && (
          <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
            <h2 className="text-sm font-semibold text-forest-300/70 mb-2">Bereits beantwortet</h2>
            <ul className="space-y-2">
              {answeredPolls.map((poll) => (
                <li key={poll.id} className="rounded-lg bg-forest-900/50 px-3 py-2 ring-1 ring-forest-800/30">
                  <div className="text-sm font-medium text-forest-200">{poll.title}</div>
                  <div className="text-xs text-emerald-300 mt-0.5">✓ {poll.my_answer}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageBackground>
  );
}

function PollCard({ poll, memberId, onAnswered }: { poll: MyPoll; memberId: string; onAnswered: () => void }) {
  const submit = useSubmitPollResponse();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(answer: string) {
    if (!answer.trim() || !memberId) return;
    setBusy(true);
    try {
      await submit.mutateAsync({ pollId: poll.id, memberId, answer: answer.trim() });
      setDone(true);
      onAnswered();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) return (
    <div className="rounded-xl bg-forest-900/60 px-3 py-2 text-sm text-emerald-300">✓ Antwort gespeichert</div>
  );

  return (
    <div className="rounded-xl bg-forest-900/60 p-3 ring-1 ring-amber-500/20">
      <p className="text-sm font-semibold text-amber-100">{poll.title}</p>
      {poll.description && <p className="text-xs text-forest-300/70 mt-0.5">{poll.description}</p>}
      {poll.deadline && (
        <p className="text-xs text-amber-400/80 mt-1">Bis: {new Date(poll.deadline).toLocaleDateString('de-DE')}</p>
      )}

      <div className="mt-3">
        {poll.answer_type === 'yesno' && (
          <div className="flex gap-2">
            <button onClick={() => handleSubmit('Ja')} disabled={busy}
              className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">
              Ja
            </button>
            <button onClick={() => handleSubmit('Nein')} disabled={busy}
              className="flex-1 rounded-lg bg-rose-700 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-60">
              Nein
            </button>
          </div>
        )}

        {poll.answer_type === 'choice' && (
          <div className="flex flex-col gap-2">
            {(poll.choices ?? []).map((c) => (
              <button key={c} onClick={() => handleSubmit(c)} disabled={busy}
                className="w-full rounded-lg bg-forest-700/60 py-2 text-sm text-forest-100 hover:bg-forest-600 disabled:opacity-60 ring-1 ring-forest-600/40">
                {c}
              </button>
            ))}
          </div>
        )}

        {(poll.answer_type === 'text' || poll.answer_type === 'number') && (
          <div className="flex gap-2">
            <input
              type={poll.answer_type === 'number' ? 'number' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={poll.answer_type === 'number' ? 'Zahl eingeben…' : 'Antwort eingeben…'}
              className="flex-1 rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button onClick={() => handleSubmit(value)} disabled={busy || !value.trim()}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60">
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
