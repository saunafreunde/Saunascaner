import { useMemo, useState } from 'react';
import { addDays, format, setHours, setMinutes, isBefore } from 'date-fns';
import { useMockStore } from '@/mocks/store';
import { fmtClock, dayLabel } from '@/lib/time';
import { Link } from 'react-router-dom';

const SLOTS_HHMM: string[] = (() => {
  const out: string[] = [];
  for (let h = 8; h <= 22; h++) {
    for (const m of [0, 30]) out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return out;
})();

const DURATIONS = [10, 15, 20, 25, 30] as const;

function slotToDate(day: 'today' | 'tomorrow', hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const base = day === 'tomorrow' ? addDays(new Date(), 1) : new Date();
  return setMinutes(setHours(base, h), m);
}

export default function Planner() {
  const saunas = useMockStore((s) => s.saunas);
  const infusions = useMockStore((s) => s.infusions);
  const meisters = useMockStore((s) => s.meisters);
  const currentMeisterId = useMockStore((s) => s.currentMeisterId);
  const setMeister = useMockStore((s) => s.setMeister);
  const addInfusion = useMockStore((s) => s.addInfusion);
  const removeInfusion = useMockStore((s) => s.removeInfusion);

  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [saunaId, setSaunaId] = useState<string>(saunas[0]?.id ?? '');
  const [slot, setSlot] = useState<string>('15:00');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState<number>(15);
  const [error, setError] = useState<string | null>(null);

  const occupiedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const i of infusions) {
      const d = new Date(i.start_time);
      keys.add(`${i.sauna_id}|${format(d, 'yyyy-MM-dd HH:mm')}`);
    }
    return keys;
  }, [infusions]);

  function isSlotTaken(hhmm: string) {
    const start = slotToDate(day, hhmm);
    return occupiedKeys.has(`${saunaId}|${format(start, 'yyyy-MM-dd HH:mm')}`);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!currentMeisterId) return setError('Bitte zuerst als Saunameister anmelden.');
    if (!saunaId)          return setError('Bitte eine Sauna wählen.');
    if (!title.trim())     return setError('Titel fehlt.');

    const start = slotToDate(day, slot);
    if (day === 'today' && isBefore(start, new Date())) {
      return setError('Slot liegt in der Vergangenheit.');
    }
    if (isSlotTaken(slot)) return setError('Slot bereits belegt.');

    addInfusion({
      sauna_id: saunaId,
      template_id: null,
      saunameister_id: currentMeisterId,
      title: title.trim(),
      description: description.trim() || null,
      image_path: null,
      start_time: start.toISOString(),
      duration_minutes: duration,
    });
    setTitle('');
    setDescription('');
  }

  const myInfusions = useMemo(
    () =>
      infusions
        .filter((i) => i.saunameister_id === currentMeisterId)
        .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time)),
    [infusions, currentMeisterId]
  );

  const saunaName = (id: string) => saunas.find((s) => s.id === id)?.name ?? '';

  return (
    <div className="bg-schwarzwald-soft min-h-full text-slate-100">
      <header className="border-b border-forest-800/40 bg-forest-950/85 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-forest-100">Aufguss-Planung</h1>
          <p className="text-sm text-forest-300/80">Saunameister-Bereich</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-sm text-forest-300 hover:text-forest-100 underline">
            → Tafel ansehen
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[2fr_3fr]">
        {/* Linke Spalte: Anmeldung + meine Aufgüsse */}
        <section className="space-y-6">
          <div className="rounded-2xl bg-forest-950/70 p-5 ring-1 ring-forest-800/50 backdrop-blur">
            <h2 className="text-lg font-semibold text-forest-100">Angemeldet als</h2>
            <select
              value={currentMeisterId ?? ''}
              onChange={(e) => setMeister(e.target.value || null)}
              className="mt-3 w-full rounded-lg bg-forest-900/80 px-4 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
            >
              <option value="">— Saunameister wählen —</option>
              {meisters.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <p className="mt-2 text-xs text-forest-300/70">
              Demo-Modus: echte Anmeldung folgt in Phase 2 (Supabase Auth).
            </p>
          </div>

          <div className="rounded-2xl bg-forest-950/70 p-5 ring-1 ring-forest-800/50 backdrop-blur">
            <h2 className="text-lg font-semibold text-forest-100">Meine Aufgüsse</h2>
            <ul className="mt-3 space-y-2">
              {myInfusions.length === 0 && (
                <li className="text-sm text-forest-300/60">Noch keine geplant.</li>
              )}
              {myInfusions.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-forest-900/60 px-3 py-2 ring-1 ring-forest-800/40"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{i.title}</div>
                    <div className="text-xs text-forest-300/70">
                      {dayLabel(i.start_time)} · {fmtClock(i.start_time)} · {saunaName(i.sauna_id)} · {i.duration_minutes} Min
                    </div>
                  </div>
                  <button
                    onClick={() => removeInfusion(i.id)}
                    className="rounded-md px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                  >
                    Löschen
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Rechte Spalte: Eingabemaske */}
        <form
          onSubmit={submit}
          className="rounded-2xl bg-forest-950/70 p-6 ring-1 ring-forest-800/50 backdrop-blur space-y-5"
        >
          <h2 className="text-lg font-semibold text-forest-100">Neuen Aufguss eintragen</h2>

          <div className="grid grid-cols-2 gap-3">
            {(['today', 'tomorrow'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDay(d)}
                className={`rounded-xl px-4 py-3 text-base font-medium ring-1 transition ${
                  day === d
                    ? 'bg-forest-600 text-white ring-forest-500'
                    : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                }`}
              >
                {d === 'today' ? 'Heute' : 'Morgen'}
              </button>
            ))}
          </div>

          <div>
            <label className="text-sm text-forest-300">Sauna</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {saunas.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSaunaId(s.id)}
                  className={`rounded-xl px-3 py-3 text-sm ring-1 transition ${
                    saunaId === s.id
                      ? 'bg-forest-600 text-white ring-forest-500'
                      : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                  }`}
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs opacity-80">{s.temperature_label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-forest-300">Uhrzeit (30-Min-Slots)</label>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {SLOTS_HHMM.map((s) => {
                const taken = isSlotTaken(s);
                const past = day === 'today' && isBefore(slotToDate('today', s), new Date());
                const disabled = taken || past;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSlot(s)}
                    className={`rounded-md px-2 py-2 text-sm font-mono tabular-nums ring-1 transition ${
                      slot === s && !disabled
                        ? 'bg-forest-600 text-white ring-forest-500'
                        : disabled
                          ? 'bg-forest-950/40 text-forest-300/30 ring-forest-900/40 cursor-not-allowed line-through'
                          : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <label className="text-sm text-forest-300">Titel</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Eukalyptus klassisch"
                className="mt-2 w-full rounded-lg bg-forest-900/80 px-4 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
              />
            </div>
            <div>
              <label className="text-sm text-forest-300">Dauer</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-2 rounded-lg bg-forest-900/80 px-4 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>{d} Min</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-forest-300">Beschreibung (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="z.B. Klärend & frisch"
              className="mt-2 w-full rounded-lg bg-forest-900/80 px-4 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-rose-500/15 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-500/30">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-forest-500 px-5 py-4 text-lg font-semibold text-forest-950 hover:bg-forest-400 transition shadow-lg shadow-forest-900/40"
          >
            Aufguss eintragen
          </button>
        </form>
      </div>
    </div>
  );
}
