import { useMemo, useState } from 'react';
import { addDays, format, setHours, setMinutes, isBefore } from 'date-fns';
import { Link } from 'react-router-dom';
import { fmtClock, dayLabel } from '@/lib/time';
import { ATTRIBUTES, ATTR_BY_ID, type InfusionAttribute } from '@/lib/attributes';
import { broadcastEvac } from '@/lib/evacuation';
import { sendEvacuationList } from '@/lib/telegram';
import { PageBackground } from '@/components/PageBackground';
import { useAuth } from '@/hooks/useAuth';
import {
  useSaunas, useInfusions, useTemplates,
  useAddInfusion, useDeleteInfusion,
  useAddTemplate, useDeleteTemplate,
  useCurrentMember, usePresentMembers,
  useActiveEvacuation, useTriggerEvacuation, useEndEvacuation,
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

export default function Planner() {
  const { signOut } = useAuth();
  const member = useCurrentMember();
  const saunasQ = useSaunas();
  const infusionsQ = useInfusions();
  const presentQ = usePresentMembers();
  const evacQ = useActiveEvacuation();
  const templatesQ = useTemplates(member.data?.id ?? null);

  const addInf = useAddInfusion();
  const delInf = useDeleteInfusion();
  const addTpl = useAddTemplate();
  const delTpl = useDeleteTemplate();
  const trigEvac = useTriggerEvacuation();
  const endEvac = useEndEvacuation();

  const saunas = saunasQ.data ?? [];
  const infusions = infusionsQ.data ?? [];
  const myTemplates = (templatesQ.data ?? []).filter((t) => t.member_id === member.data?.id);

  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [saunaId, setSaunaId] = useState<string>('');
  const [slot, setSlot] = useState<string>('15:00');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState<number>(15);
  const [attrs, setAttrs] = useState<InfusionAttribute[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [evacToast, setEvacToast] = useState<string | null>(null);

  // Default sauna once loaded
  if (!saunaId && saunas[0]) setSaunaId(saunas[0].id);

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

  function applyTemplate(t: { title: string; description: string | null; duration_minutes: number; attributes: string[] }) {
    setTitle(t.title);
    setDescription(t.description ?? '');
    setDuration(t.duration_minutes);
    setAttrs(t.attributes as InfusionAttribute[]);
  }

  async function saveAsTemplate() {
    setError(null);
    if (!member.data) return setError('Bitte zuerst anmelden.');
    if (!title.trim()) return setError('Titel fehlt für die Vorlage.');
    try {
      await addTpl.mutateAsync({
        member_id: member.data.id,
        title: title.trim(),
        description: description.trim() || null,
        duration_minutes: duration,
        attributes: attrs,
      });
    } catch (e) { setError((e as Error).message); }
  }

  function clearForm() {
    setTitle('');
    setDescription('');
    setAttrs([]);
    setDuration(15);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!member.data) return setError('Bitte zuerst anmelden.');
    if (!saunaId)      return setError('Bitte eine Sauna wählen.');
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
        description: description.trim() || null,
        attributes: attrs,
        start_time: start.toISOString(),
        duration_minutes: duration,
      });
      clearForm();
    } catch (e) { setError((e as Error).message); }
  }

  async function triggerEvacuation() {
    if (!member.data) return;
    if (!confirm('Evakuierungsalarm WIRKLICH auslösen? Tafel schaltet auf Alarm und Liste geht an Telegram.')) return;
    setEvacToast(null);
    const presentNames = (presentQ.data ?? []).map((p) => p.name);

    try {
      const ev = await trigEvac.mutateAsync({
        triggered_by: member.data.id,
        present_names: presentNames,
      });
      broadcastEvac({ type: 'start', triggeredBy: member.data.name, triggeredAt: Date.parse(ev.triggered_at) });

      const r = await sendEvacuationList({
        triggeredBy: member.data.name,
        triggeredAt: new Date(ev.triggered_at),
        presentNames,
      });
      setEvacToast(
        r.ok
          ? r.via === 'stub'
            ? `Demo: Liste mit ${presentNames.length} Personen würde an Telegram gehen (Token nicht konfiguriert).`
            : `Liste an Telegram gesendet (${presentNames.length} Personen).`
          : `Telegram-Versand fehlgeschlagen: ${r.detail ?? 'unbekannt'}`
      );
    } catch (e) { setEvacToast(`Fehler: ${(e as Error).message}`); }
  }

  async function cancelEvacuation() {
    if (!evacQ.data) return;
    try {
      await endEvac.mutateAsync(evacQ.data.id);
      broadcastEvac({ type: 'stop' });
    } catch (e) { setEvacToast(`Fehler: ${(e as Error).message}`); }
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
  const evacuation = evacQ.data;

  return (
    <PageBackground page="planner">
      <header className="border-b border-forest-800/40 bg-forest-950/85 backdrop-blur px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-semibold text-forest-100 truncate">Aufguss-Planung</h1>
          <p className="text-xs sm:text-sm text-forest-300/80 truncate">
            {member.data ? `Angemeldet als ${member.data.name}` : 'Saunameister-Bereich'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/dashboard" className="hidden sm:inline text-xs sm:text-sm text-forest-300 hover:text-forest-100 underline">
            Tafel
          </Link>
          <button
            onClick={() => signOut()}
            className="rounded-lg bg-forest-900/80 px-3 py-1.5 text-xs sm:text-sm text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900"
          >
            Abmelden
          </button>
        </div>
      </header>

      {evacuation && (
        <div className="border-b border-rose-500/40 bg-rose-700/30 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            🚨 <span className="font-bold uppercase tracking-wider">Evakuierung aktiv</span>
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
        <div className="border-b border-forest-800/40 bg-forest-950/70 px-4 sm:px-6 py-2 text-xs text-forest-200">
          {evacToast}
        </div>
      )}

      <div className="mx-auto grid max-w-7xl gap-4 p-3 sm:p-6 lg:grid-cols-[1fr_2fr]">
        {/* Linke Spalte: Notfall, Vorlagen, Meine Aufgüsse */}
        <section className="space-y-4">
          {member.data && (
            <div className="rounded-2xl border-2 border-rose-600/60 bg-rose-950/40 p-4 ring-1 ring-rose-500/30 backdrop-blur">
              <h2 className="text-base font-bold uppercase tracking-wider text-rose-200">🚨 Notfall</h2>
              <p className="mt-1 text-xs text-rose-200/80">
                Löst Vollbild-Alarm auf der Tafel aus und schickt die Anwesenden-Liste an Telegram.
              </p>
              <button
                type="button"
                disabled={trigEvac.isPending || !!evacuation}
                onClick={triggerEvacuation}
                className="mt-3 w-full rounded-xl bg-rose-600 px-5 py-4 text-base font-bold uppercase tracking-wider text-white hover:bg-rose-500 transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {evacuation ? 'Alarm läuft …' : trigEvac.isPending ? 'Wird gesendet …' : 'Evakuierung auslösen'}
              </button>
              <p className="mt-2 text-[11px] text-rose-200/60">
                Aktuell anwesend: {presentQ.data?.length ?? 0} Personen
              </p>
            </div>
          )}

          {member.data && (
            <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-forest-100">Meine Vorlagen</h2>
                <span className="text-xs text-forest-300/60">{myTemplates.length}</span>
              </div>
              <ul className="mt-2 space-y-2">
                {myTemplates.length === 0 && (
                  <li className="text-xs text-forest-300/60">
                    Keine. „Als Vorlage" speichert die aktuelle Eingabe.
                  </li>
                )}
                {myTemplates.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-forest-900/60 px-3 py-2 ring-1 ring-forest-800/40">
                    <button type="button" onClick={() => applyTemplate(t)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-sm font-medium">{t.title}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-forest-300/70">
                        <span>{t.duration_minutes} Min</span>
                        {(t.attributes as InfusionAttribute[]).map((a) => (
                          <span key={a} title={ATTR_BY_ID[a]?.label} aria-hidden>{ATTR_BY_ID[a]?.emoji}</span>
                        ))}
                      </div>
                    </button>
                    <button
                      onClick={() => delTpl.mutate(t.id)}
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

          <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
            <h2 className="text-base font-semibold text-forest-100">Meine Aufgüsse</h2>
            <ul className="mt-2 space-y-2">
              {myInfusions.length === 0 && <li className="text-xs text-forest-300/60">Noch keine geplant.</li>}
              {myInfusions.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-forest-900/60 px-3 py-2 ring-1 ring-forest-800/40"
                  style={{ borderLeft: `3px solid ${saunaColor(i.sauna_id)}` }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{i.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-forest-300/70">
                      <span>{dayLabel(i.start_time)} · {fmtClock(i.start_time)}</span>
                      <span>·</span>
                      <span style={{ color: saunaColor(i.sauna_id) }} className="font-semibold">{saunaName(i.sauna_id)}</span>
                      <span>· {i.duration_minutes} Min</span>
                      {(i.attributes as InfusionAttribute[]).map((a) => (
                        <span key={a} aria-hidden>{ATTR_BY_ID[a]?.emoji}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => delInf.mutate(i.id)}
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
        <form onSubmit={submit} className="rounded-2xl bg-forest-950/70 p-4 sm:p-6 ring-1 ring-forest-800/50 backdrop-blur space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-forest-100">Neuen Aufguss eintragen</h2>

          <div className="grid grid-cols-2 gap-2">
            {(['today', 'tomorrow'] as const).map((d) => (
              <button
                key={d} type="button" onClick={() => setDay(d)}
                className={`rounded-xl px-4 py-3 text-base font-medium ring-1 transition ${
                  day === d ? 'bg-forest-600 text-white ring-forest-500'
                            : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                }`}
              >
                {d === 'today' ? 'Heute' : 'Morgen'}
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs sm:text-sm text-forest-300">Sauna</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {saunas.map((s) => (
                <button
                  key={s.id} type="button" onClick={() => setSaunaId(s.id)}
                  className="rounded-xl px-2 py-3 text-sm ring-1 transition"
                  style={
                    saunaId === s.id
                      ? { background: s.accent_color, color: '#0b1f10', boxShadow: `0 0 0 2px ${s.accent_color}66` }
                      : { background: 'rgba(20, 83, 45, 0.55)' }
                  }
                >
                  <div className="font-semibold truncate">{s.name}</div>
                  <div className="text-xs opacity-80">{s.temperature_label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm text-forest-300">Uhrzeit (volle Stunde)</label>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {HOURLY_SLOTS.map((s) => {
                const taken = isSlotTaken(s);
                const past = day === 'today' && isBefore(slotToDate('today', s), new Date());
                const disabled = taken || past;
                return (
                  <button
                    key={s} type="button" disabled={disabled} onClick={() => setSlot(s)}
                    className={`rounded-md px-1 py-3 text-sm font-mono tabular-nums ring-1 transition ${
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

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div>
              <label className="text-xs sm:text-sm text-forest-300">Titel</label>
              <input
                value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Eukalyptus klassisch"
                className="mt-2 w-full rounded-lg bg-forest-900/80 px-3 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
              />
            </div>
            <div>
              <label className="text-xs sm:text-sm text-forest-300">Dauer</label>
              <select
                value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-2 rounded-lg bg-forest-900/80 px-3 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
              >
                {DURATIONS.map((d) => <option key={d} value={d}>{d} Min</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm text-forest-300">Beschreibung (optional)</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              rows={2} placeholder="z.B. Klärend & frisch"
              className="mt-2 w-full rounded-lg bg-forest-900/80 px-3 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
            />
          </div>

          <div>
            <label className="text-xs sm:text-sm text-forest-300">Eigenschaften</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ATTRIBUTES.map((a) => {
                const active = attrs.includes(a.id);
                return (
                  <button
                    key={a.id} type="button" onClick={() => toggleAttr(a.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 transition ${
                      active ? 'bg-forest-500 text-forest-950 ring-forest-400'
                             : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                    }`}
                  >
                    <span aria-hidden>{a.emoji}</span><span>{a.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/30">{error}</div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <button
              type="submit" disabled={addInf.isPending}
              className="flex-1 rounded-xl bg-forest-500 px-5 py-4 text-base font-semibold text-forest-950 hover:bg-forest-400 transition shadow-lg shadow-forest-900/40 disabled:opacity-60"
            >
              {addInf.isPending ? 'Speichere …' : 'Aufguss eintragen'}
            </button>
            <button
              type="button" onClick={saveAsTemplate} disabled={addTpl.isPending}
              className="rounded-xl bg-forest-900/70 px-4 py-3 text-sm font-medium text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-900 transition disabled:opacity-60"
              title="Aktuelle Eingaben als persönliche Vorlage speichern"
            >
              Als Vorlage
            </button>
          </div>
        </form>
      </div>
    </PageBackground>
  );
}
