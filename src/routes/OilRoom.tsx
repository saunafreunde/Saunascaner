import { useEffect, useMemo, useState } from 'react';
import { addDays, format, setHours, setMinutes, isBefore } from 'date-fns';
import { Link } from 'react-router-dom';
import { fmtClock, dayLabel } from '@/lib/time';
import { ATTRIBUTES, ATTR_BY_ID, type InfusionAttribute } from '@/lib/attributes';
import {
  useSaunas, useInfusions, useAddInfusion, useDeleteInfusion,
  useCurrentMember,
} from '@/lib/api';

const HOURLY_SLOTS: string[] = Array.from({ length: 15 }, (_, i) =>
  `${String(8 + i).padStart(2, '0')}:00`
);
const DURATIONS = [10, 15, 20, 25, 30] as const;

function slotToDate(day: 'today' | 'tomorrow', hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const base = day === 'tomorrow' ? addDays(new Date(), 1) : new Date();
  return setMinutes(setHours(base, h), m);
}

export default function OilRoom() {
  const member = useCurrentMember();
  const saunasQ = useSaunas();
  const infusionsQ = useInfusions();
  const addInf = useAddInfusion();
  const delInf = useDeleteInfusion();

  const saunas = saunasQ.data ?? [];
  const infusions = infusionsQ.data ?? [];

  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [saunaId, setSaunaId] = useState<string>('');
  const [slot, setSlot] = useState<string>('15:00');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState<number>(15);
  const [attrs, setAttrs] = useState<InfusionAttribute[]>([]);
  const [teamInfusion, setTeamInfusion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!saunaId && saunas[0]) setSaunaId(saunas[0].id);
  }, [saunaId, saunas]);

  const occupiedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const i of infusions) {
      keys.add(`${i.sauna_id}|${format(new Date(i.start_time), 'yyyy-MM-dd HH:mm')}`);
    }
    return keys;
  }, [infusions]);

  function isSlotTaken(hhmm: string) {
    const start = slotToDate(day, hhmm);
    return occupiedKeys.has(`${saunaId}|${format(start, 'yyyy-MM-dd HH:mm')}`);
  }

  function toggleAttr(a: InfusionAttribute) {
    setAttrs((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  function clearForm() {
    setTitle('');
    setAttrs([]);
    setDuration(15);
    setTeamInfusion(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!member.data) return setError('Bitte zuerst anmelden.');
    if (!saunaId) return setError('Bitte eine Sauna wählen.');
    if (!title.trim()) return setError('Titel fehlt.');

    const start = slotToDate(day, slot);
    if (day === 'today' && isBefore(start, new Date())) {
      return setError('Slot liegt in der Vergangenheit.');
    }
    if (isSlotTaken(slot)) return setError('Slot bereits belegt.');

    try {
      await addInf.mutateAsync({
        sauna_id: saunaId,
        template_id: null,
        saunameister_id: member.data.id,
        title: title.trim(),
        description: null,
        attributes: attrs,
        start_time: start.toISOString(),
        duration_minutes: duration,
        team_infusion: teamInfusion,
      });
      clearForm();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) { setError((e as Error).message); }
  }

  const myInfusions = useMemo(
    () =>
      infusions
        .filter((i) => i.saunameister_id === member.data?.id)
        .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time)),
    [infusions, member.data?.id]
  );

  const saunaName = (id: string) => saunas.find((s) => s.id === id)?.name ?? '';
  const saunaColor = (id: string) => saunas.find((s) => s.id === id)?.accent_color ?? '#22c55e';

  return (
    <div className="bg-schwarzwald-soft min-h-screen text-slate-100">
      <header className="border-b border-forest-800/40 bg-forest-950/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-forest-100">Öl-Raum · Aufguss planen</h1>
          <p className="text-xs text-forest-300/70">
            {member.data ? member.data.name : '—'}
          </p>
        </div>
        <Link to="/me" className="rounded-lg bg-forest-900/80 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900">
          Mein Bereich
        </Link>
      </header>

      <div className="mx-auto max-w-2xl p-4 space-y-4">
        {/* Eingabe-Formular */}
        <form onSubmit={submit} className="rounded-2xl bg-forest-950/70 p-5 ring-1 ring-forest-800/50 backdrop-blur space-y-4">
          <h2 className="text-base font-semibold text-forest-100">Neuen Aufguss eintragen</h2>

          {/* Heute / Morgen */}
          <div className="grid grid-cols-2 gap-2">
            {(['today', 'tomorrow'] as const).map((d) => (
              <button key={d} type="button" onClick={() => setDay(d)}
                className={`rounded-xl px-4 py-3 text-base font-medium ring-1 transition ${
                  day === d ? 'bg-forest-600 text-white ring-forest-500'
                            : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                }`}>
                {d === 'today' ? 'Heute' : 'Morgen'}
              </button>
            ))}
          </div>

          {/* Sauna */}
          <div>
            <label className="text-sm text-forest-300">Sauna</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {saunas.map((s) => (
                <button key={s.id} type="button" onClick={() => setSaunaId(s.id)}
                  className="rounded-xl px-2 py-4 text-sm ring-1 transition"
                  style={
                    saunaId === s.id
                      ? { background: s.accent_color, color: '#0b1f10', boxShadow: `0 0 0 2px ${s.accent_color}66` }
                      : { background: 'rgba(20, 83, 45, 0.55)' }
                  }>
                  <div className="font-semibold truncate">{s.name}</div>
                  <div className="text-xs opacity-80">{s.temperature_label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Uhrzeit */}
          <div>
            <label className="text-sm text-forest-300">Uhrzeit</label>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {HOURLY_SLOTS.map((s) => {
                const taken = isSlotTaken(s);
                const past = day === 'today' && isBefore(slotToDate('today', s), new Date());
                const disabled = taken || past;
                return (
                  <button key={s} type="button" disabled={disabled} onClick={() => setSlot(s)}
                    className={`rounded-md px-1 py-3 text-sm font-mono tabular-nums ring-1 transition ${
                      slot === s && !disabled
                        ? 'bg-forest-500 text-forest-950 ring-forest-400 font-bold'
                        : disabled
                          ? 'bg-forest-950/40 text-forest-300/30 ring-forest-900/40 cursor-not-allowed line-through'
                          : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                    }`}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Titel + Dauer */}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div>
              <label className="text-sm text-forest-300">Titel</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Eukalyptus klassisch"
                className="mt-2 w-full rounded-lg bg-forest-900/80 px-3 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400" />
            </div>
            <div>
              <label className="text-sm text-forest-300">Dauer</label>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-2 rounded-lg bg-forest-900/80 px-3 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400">
                {DURATIONS.map((d) => <option key={d} value={d}>{d} Min</option>)}
              </select>
            </div>
          </div>

          {/* Eigenschaften */}
          <div>
            <label className="text-sm text-forest-300">Eigenschaften</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ATTRIBUTES.map((a) => {
                const active = attrs.includes(a.id);
                return (
                  <button key={a.id} type="button" onClick={() => toggleAttr(a.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm ring-1 transition ${
                      active ? 'bg-forest-500 text-forest-950 ring-forest-400'
                             : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                    }`}>
                    <span aria-hidden>{a.emoji}</span><span>{a.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Team-Toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => setTeamInfusion((v) => !v)}
              className={`relative w-10 h-6 rounded-full transition ${teamInfusion ? 'bg-amber-500' : 'bg-forest-800'}`}>
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${teamInfusion ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-sm text-forest-200">
              Team-Aufguss <span className="text-xs text-forest-300/60">— andere Aufgieser können mitmachen</span>
            </span>
          </label>

          {error && <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/30">{error}</div>}
          {success && <div className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-500/30">✅ Aufguss eingetragen!</div>}

          <button type="submit" disabled={addInf.isPending}
            className="w-full rounded-xl bg-forest-500 px-5 py-4 text-base font-semibold text-forest-950 hover:bg-forest-400 transition disabled:opacity-60">
            {addInf.isPending ? 'Speichere…' : 'Aufguss eintragen'}
          </button>
        </form>

        {/* Meine Aufgüsse */}
        <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
          <h2 className="text-base font-semibold text-forest-100 mb-3">Meine Aufgüsse</h2>
          {myInfusions.length === 0 ? (
            <p className="text-sm text-forest-300/60">Noch keine geplant.</p>
          ) : (
            <ul className="space-y-2">
              {myInfusions.map((i) => (
                <li key={i.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-forest-900/60 px-3 py-2 ring-1 ring-forest-800/40"
                  style={{ borderLeft: `3px solid ${saunaColor(i.sauna_id)}` }}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {i.title}
                      {i.team_infusion && <span className="ml-1.5 text-xs text-amber-300">👥</span>}
                    </div>
                    <div className="text-xs text-forest-300/70 mt-0.5">
                      {dayLabel(i.start_time)} · {fmtClock(i.start_time)} · {saunaName(i.sauna_id)} · {i.duration_minutes} Min
                      {(i.attributes as InfusionAttribute[]).map((a) => (
                        <span key={a} className="ml-1" aria-hidden>{ATTR_BY_ID[a]?.emoji}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => delInf.mutate(i.id)}
                    className="rounded-md px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10">
                    Löschen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
