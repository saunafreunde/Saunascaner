import { useEffect, useMemo, useState } from 'react';
import { addDays, format, setHours, setMinutes, isBefore } from 'date-fns';
import { Link } from 'react-router-dom';
import { useMockStore, type MeisterTemplate } from '@/mocks/store';
import { fmtClock, dayLabel } from '@/lib/time';
import { ATTRIBUTES, ATTR_BY_ID, type InfusionAttribute } from '@/lib/attributes';
import { broadcastEvac, subscribeEvac } from '@/lib/evacuation';
import { sendEvacuationList } from '@/lib/telegram';

const HOURLY_SLOTS: string[] = Array.from({ length: 15 }, (_, i) =>
  `${String(8 + i).padStart(2, '0')}:00`
);
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
  const templatesByMeister = useMockStore((s) => s.templatesByMeister);
  const currentMeisterId = useMockStore((s) => s.currentMeisterId);
  const loginMeister = useMockStore((s) => s.loginMeister);
  const logoutMeister = useMockStore((s) => s.logoutMeister);
  const addInfusion = useMockStore((s) => s.addInfusion);
  const removeInfusion = useMockStore((s) => s.removeInfusion);
  const addTemplate = useMockStore((s) => s.addTemplate);
  const removeTemplate = useMockStore((s) => s.removeTemplate);
  const members = useMockStore((s) => s.members);
  const evacuation = useMockStore((s) => s.evacuation);
  const setEvacuation = useMockStore((s) => s.setEvacuation);

  const [evacBusy, setEvacBusy] = useState(false);
  const [evacToast, setEvacToast] = useState<string | null>(null);

  useEffect(() => {
    return subscribeEvac((msg) => {
      if (msg.type === 'start') {
        setEvacuation({ active: true, triggeredBy: msg.triggeredBy, triggeredAt: msg.triggeredAt });
      } else {
        setEvacuation({ active: false, triggeredBy: null, triggeredAt: null });
      }
    });
  }, [setEvacuation]);

  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [saunaId, setSaunaId] = useState<string>(saunas[0]?.id ?? '');
  const [slot, setSlot] = useState<string>('15:00');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState<number>(15);
  const [attrs, setAttrs] = useState<InfusionAttribute[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [loginId, setLoginId] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const currentMeister = meisters.find((m) => m.id === currentMeisterId) ?? null;
  const myTemplates = currentMeisterId ? templatesByMeister[currentMeisterId] ?? [] : [];

  async function triggerEvacuation() {
    if (!currentMeister) return;
    if (!confirm('Evakuierungsalarm WIRKLICH auslösen? Tafel schaltet auf Alarm und Liste geht an Telegram.')) return;
    setEvacBusy(true);
    setEvacToast(null);
    const presentNames = members.filter((m) => m.is_present).map((m) => m.name);
    const at = Date.now();
    setEvacuation({ active: true, triggeredBy: currentMeister.name, triggeredAt: at });
    broadcastEvac({ type: 'start', triggeredBy: currentMeister.name, triggeredAt: at });
    const r = await sendEvacuationList({
      triggeredBy: currentMeister.name,
      triggeredAt: new Date(at),
      presentNames,
    });
    setEvacToast(
      r.ok
        ? r.via === 'stub'
          ? `Demo: Liste mit ${presentNames.length} Personen würde an Telegram gehen (Token nicht konfiguriert).`
          : `Liste an Telegram gesendet (${presentNames.length} Personen).`
        : `Telegram-Versand fehlgeschlagen: ${r.detail ?? 'unbekannt'}`
    );
    setEvacBusy(false);
  }

  function cancelEvacuation() {
    setEvacuation({ active: false, triggeredBy: null, triggeredAt: null });
    broadcastEvac({ type: 'stop' });
  }

  function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    if (!loginId) return setLoginError('Bitte Namen wählen.');
    if (!/^\d{4}$/.test(pin)) return setLoginError('PIN ist 4-stellig.');
    if (!loginMeister(loginId, pin)) return setLoginError('PIN falsch.');
    setLoginId('');
    setPin('');
  }

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

  function toggleAttr(a: InfusionAttribute) {
    setAttrs((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  function applyTemplate(t: MeisterTemplate) {
    setTitle(t.title);
    setDescription(t.description ?? '');
    setDuration(t.duration_minutes);
    setAttrs(t.attributes);
  }

  function saveAsTemplate() {
    if (!currentMeisterId) return setError('Bitte zuerst anmelden.');
    if (!title.trim()) return setError('Titel fehlt für die Vorlage.');
    addTemplate(currentMeisterId, {
      title: title.trim(),
      description: description.trim() || null,
      duration_minutes: duration,
      attributes: attrs,
    });
    setError(null);
  }

  function clearForm() {
    setTitle('');
    setDescription('');
    setAttrs([]);
    setDuration(15);
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
      attributes: attrs,
      image_path: null,
      start_time: start.toISOString(),
      duration_minutes: duration,
    });
    clearForm();
  }

  const myInfusions = useMemo(
    () =>
      infusions
        .filter((i) => i.saunameister_id === currentMeisterId)
        .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time)),
    [infusions, currentMeisterId]
  );

  const saunaName = (id: string) => saunas.find((s) => s.id === id)?.name ?? '';
  const saunaColor = (id: string) => saunas.find((s) => s.id === id)?.accent_color ?? '#22c55e';

  return (
    <div className="bg-schwarzwald-soft min-h-full text-slate-100">
      <header className="border-b border-forest-800/40 bg-forest-950/85 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-forest-100">Aufguss-Planung</h1>
          <p className="text-sm text-forest-300/80">Saunameister-Bereich</p>
        </div>
        <Link to="/dashboard" className="text-sm text-forest-300 hover:text-forest-100 underline">
          → Tafel ansehen
        </Link>
      </header>

      {evacuation.active && (
        <div className="border-b border-rose-500/40 bg-rose-700/30 px-6 py-3 backdrop-blur flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            🚨 <span className="font-bold uppercase tracking-wider">Evakuierung aktiv</span>
            {evacuation.triggeredBy && <> · ausgelöst von {evacuation.triggeredBy}</>}
          </div>
          <button
            onClick={cancelEvacuation}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-500"
          >
            Alarm beenden
          </button>
        </div>
      )}

      {evacToast && (
        <div className="border-b border-forest-800/40 bg-forest-950/70 px-6 py-2 text-xs text-forest-200">
          {evacToast}
        </div>
      )}

      <div className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[1fr_2fr]">
        {/* Linke Spalte: Anmeldung, Vorlagen, meine Aufgüsse */}
        <section className="space-y-6">
          <div className="rounded-2xl bg-forest-950/70 p-5 ring-1 ring-forest-800/50 backdrop-blur">
            {currentMeister ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-forest-300/70">Angemeldet als</p>
                  <p className="text-xl font-semibold text-forest-100">{currentMeister.name}</p>
                </div>
                <button
                  type="button"
                  onClick={logoutMeister}
                  className="rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900"
                >
                  Abmelden
                </button>
              </div>
            ) : (
              <form onSubmit={submitLogin} className="space-y-3">
                <h2 className="text-lg font-semibold text-forest-100">Anmelden</h2>
                <select
                  value={loginId}
                  onChange={(e) => { setLoginId(e.target.value); setLoginError(null); }}
                  className="w-full rounded-lg bg-forest-900/80 px-4 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
                >
                  <option value="">— Saunameister wählen —</option>
                  {meisters.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setLoginError(null); }}
                  placeholder="PIN (4-stellig)"
                  className="w-full rounded-lg bg-forest-900/80 px-4 py-3 text-base font-mono tracking-[0.5em] tabular-nums ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
                />
                {loginError && (
                  <div className="rounded-md bg-rose-500/15 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-500/30">
                    {loginError}
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full rounded-lg bg-forest-500 px-4 py-3 text-base font-semibold text-forest-950 hover:bg-forest-400 transition"
                >
                  Anmelden
                </button>
                <p className="text-[11px] text-forest-300/60">
                  Demo-PINs: Anja 1111 · Tobias 2222 · Markus 3333. Phase 2 ersetzt durch Supabase Auth.
                </p>
              </form>
            )}
          </div>

          {currentMeister && (
            <div className="rounded-2xl border-2 border-rose-600/60 bg-rose-950/40 p-5 ring-1 ring-rose-500/30 backdrop-blur">
              <h2 className="text-base font-bold uppercase tracking-wider text-rose-200">
                🚨 Notfall
              </h2>
              <p className="mt-1 text-xs text-rose-200/80">
                Löst Vollbild-Alarm auf der Tafel aus und schickt die Anwesenden-Liste an Telegram.
              </p>
              <button
                type="button"
                disabled={evacBusy || evacuation.active}
                onClick={triggerEvacuation}
                className="mt-3 w-full rounded-xl bg-rose-600 px-5 py-4 text-base font-bold uppercase tracking-wider text-white hover:bg-rose-500 transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {evacuation.active
                  ? 'Alarm läuft …'
                  : evacBusy
                    ? 'Wird gesendet …'
                    : 'Evakuierung auslösen'}
              </button>
              <p className="mt-2 text-[11px] text-rose-200/60">
                Aktuell anwesend: {members.filter((m) => m.is_present).length} Personen
              </p>
            </div>
          )}

          {currentMeisterId && (
            <div className="rounded-2xl bg-forest-950/70 p-5 ring-1 ring-forest-800/50 backdrop-blur">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-forest-100">Meine Vorlagen</h2>
                <span className="text-xs text-forest-300/60">{myTemplates.length}</span>
              </div>
              <ul className="mt-3 space-y-2">
                {myTemplates.length === 0 && (
                  <li className="text-sm text-forest-300/60">
                    Noch keine. Erstelle einen Aufguss und klicke „Als Vorlage speichern".
                  </li>
                )}
                {myTemplates.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-forest-900/60 px-3 py-2 ring-1 ring-forest-800/40"
                  >
                    <button
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-sm font-medium">{t.title}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-forest-300/70">
                        <span>{t.duration_minutes} Min</span>
                        {t.attributes.map((a) => (
                          <span key={a} title={ATTR_BY_ID[a]?.label} aria-hidden>
                            {ATTR_BY_ID[a]?.emoji}
                          </span>
                        ))}
                      </div>
                    </button>
                    <button
                      onClick={() => removeTemplate(currentMeisterId, t.id)}
                      className="rounded-md px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                      title="Vorlage löschen"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
                  style={{ borderLeft: `3px solid ${saunaColor(i.sauna_id)}` }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{i.title}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-forest-300/70">
                      <span>{dayLabel(i.start_time)} · {fmtClock(i.start_time)}</span>
                      <span>·</span>
                      <span style={{ color: saunaColor(i.sauna_id) }} className="font-semibold">
                        {saunaName(i.sauna_id)}
                      </span>
                      <span>·</span>
                      <span>{i.duration_minutes} Min</span>
                      {i.attributes.map((a) => (
                        <span key={a} aria-hidden>{ATTR_BY_ID[a]?.emoji}</span>
                      ))}
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
          aria-disabled={!currentMeister}
          className={`rounded-2xl bg-forest-950/70 p-6 ring-1 ring-forest-800/50 backdrop-blur space-y-5 ${
            !currentMeister ? 'opacity-60 pointer-events-none select-none' : ''
          }`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-forest-100">Neuen Aufguss eintragen</h2>
            {currentMeister ? (
              <span className="text-xs text-forest-300/70">
                Aufgießer: <span className="font-semibold text-forest-100">{currentMeister.name}</span>
              </span>
            ) : (
              <span className="rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-rose-200 ring-1 ring-rose-400/30">
                Erst anmelden
              </span>
            )}
          </div>

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
                  className="rounded-xl px-3 py-3 text-sm ring-1 transition"
                  style={
                    saunaId === s.id
                      ? { background: s.accent_color, color: '#0b1f10', boxShadow: `0 0 0 2px ${s.accent_color}66` }
                      : { background: 'rgba(20, 83, 45, 0.55)' }
                  }
                >
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs opacity-80">{s.temperature_label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-forest-300">Uhrzeit (volle Stunde)</label>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {HOURLY_SLOTS.map((s) => {
                const taken = isSlotTaken(s);
                const past = day === 'today' && isBefore(slotToDate('today', s), new Date());
                const disabled = taken || past;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSlot(s)}
                    className={`rounded-md px-2 py-3 text-base font-mono tabular-nums ring-1 transition ${
                      slot === s && !disabled
                        ? 'bg-forest-500 text-forest-950 ring-forest-400 font-bold'
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

          <div>
            <label className="text-sm text-forest-300">Eigenschaften</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ATTRIBUTES.map((a) => {
                const active = attrs.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAttr(a.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 transition ${
                      active
                        ? 'bg-forest-500 text-forest-950 ring-forest-400'
                        : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                    }`}
                  >
                    <span aria-hidden>{a.emoji}</span>
                    <span>{a.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-rose-500/15 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-500/30">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 rounded-xl bg-forest-500 px-5 py-4 text-lg font-semibold text-forest-950 hover:bg-forest-400 transition shadow-lg shadow-forest-900/40"
            >
              Aufguss eintragen
            </button>
            <button
              type="button"
              onClick={saveAsTemplate}
              className="rounded-xl bg-forest-900/70 px-5 py-4 text-base font-medium text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-900 transition"
              title="Aktuelle Eingaben als persönliche Vorlage speichern"
            >
              Als Vorlage
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
