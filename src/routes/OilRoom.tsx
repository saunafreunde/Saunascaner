import { useEffect, useMemo, useState } from 'react';
import { addDays, format, setHours, setMinutes, isBefore } from 'date-fns';
import { fmtClock, dayLabel } from '@/lib/time';
import { ATTRIBUTES, ATTR_BY_ID, type InfusionAttribute } from '@/lib/attributes';
import { broadcastEvac } from '@/lib/evacuation';
import { sendEvacuationWithPhoto } from '@/lib/telegram';
import {
  useSaunas, useInfusions, useAddInfusion, useDeleteInfusion,
  usePresentMembers, useActiveEvacuation, useTriggerEvacuation, useEndEvacuation,
} from '@/lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAvailableSlots(forDate: Date): string[] {
  if (forDate.getDay() === 1) return []; // Montag
  return Array.from({ length: 10 }, (_, i) =>
    `${String(11 + i).padStart(2, '0')}:00`
  ); // 11:00–20:00
}

function slotToDate(day: 'today' | 'tomorrow', hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const base = day === 'tomorrow' ? addDays(new Date(), 1) : new Date();
  return setMinutes(setHours(base, h), m);
}

async function capturePhoto(): Promise<Blob | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
    });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    await new Promise((r) => setTimeout(r, 600)); // Kamera aufwärmen
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    stream.getTracks().forEach((t) => t.stop());
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
  } catch {
    return null;
  }
}

const DURATIONS = [10, 15, 20, 25, 30] as const;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OilRoom() {
  const saunasQ = useSaunas();
  const infusionsQ = useInfusions();
  const presentQ = usePresentMembers();
  const evacQ = useActiveEvacuation();
  const addInf = useAddInfusion();
  const delInf = useDeleteInfusion();
  const trigEvac = useTriggerEvacuation();
  const endEvac = useEndEvacuation();

  const saunas = saunasQ.data ?? [];
  const infusions = infusionsQ.data ?? [];

  // Nur anwesende Aufgieser zur Auswahl anbieten
  const presentAufgieser = useMemo(
    () => (presentQ.data ?? []).filter((p) => p.is_aufgieser),
    [presentQ.data]
  );

  // ─── Wer bist du? ────────────────────────────────────────────────────────
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);

  // Wenn nur ein Aufgieser anwesend, auto-auswählen
  useEffect(() => {
    if (presentAufgieser.length === 1 && !selectedMember) {
      setSelectedMember({ id: presentAufgieser[0].id, name: presentAufgieser[0].name });
    }
  }, [presentAufgieser, selectedMember]);

  // ─── Aufguss-Formular ───────────────────────────────────────────────────
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [saunaId, setSaunaId] = useState<string>('');
  const [slot, setSlot] = useState<string>('15:00');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState<number>(15);
  const [attrs, setAttrs] = useState<InfusionAttribute[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [evacToast, setEvacToast] = useState<string | null>(null);
  const [evacBusy, setEvacBusy] = useState(false);

  useEffect(() => {
    if (!saunaId && saunas[0]) setSaunaId(saunas[0].id);
  }, [saunaId, saunas]);

  const todayDate = new Date();
  const tomorrowDate = addDays(todayDate, 1);
  const availableSlots = useMemo(
    () => getAvailableSlots(day === 'today' ? todayDate : tomorrowDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day]
  );
  const isMondaySelected = (day === 'today' ? todayDate : tomorrowDate).getDay() === 1;

  useEffect(() => {
    if (availableSlots.length > 0 && !availableSlots.includes(slot)) {
      setSlot(availableSlots[Math.floor(availableSlots.length / 2)] ?? availableSlots[0]);
    }
  }, [availableSlots, slot]);

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
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!selectedMember) return setError('Bitte zuerst auswählen, wer du bist.');
    if (!saunaId) return setError('Bitte eine Sauna wählen.');
    if (!title.trim()) return setError('Titel fehlt.');
    if (isMondaySelected) return setError('Montag keine Aufgüsse.');

    const start = slotToDate(day, slot);
    if (day === 'today' && isBefore(start, new Date())) return setError('Slot liegt in der Vergangenheit.');
    if (isSlotTaken(slot)) return setError('Slot bereits belegt.');

    try {
      await addInf.mutateAsync({
        sauna_id: saunaId,
        template_id: null,
        saunameister_id: selectedMember.id,
        title: title.trim(),
        description: null,
        attributes: attrs,
        start_time: start.toISOString(),
        duration_minutes: duration,
        team_infusion: false,
      });
      clearForm();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) { setError((e as Error).message); }
  }

  // ─── Evakuierung ────────────────────────────────────────────────────────
  async function triggerEvacuation() {
    if (!selectedMember) {
      if (!confirm('Evakuierungsalarm auslösen? (Kein Aufgieser ausgewählt)')) return;
    } else {
      if (!confirm('Evakuierungsalarm WIRKLICH auslösen?')) return;
    }
    setEvacBusy(true);
    setEvacToast(null);

    const triggeredByName = selectedMember?.name ?? 'Öl-Raum-Tablet';
    const presentNames = (presentQ.data ?? []).map((p) => p.name);

    // Foto aufnehmen
    const photoBlob = await capturePhoto();

    try {
      const triggeredById = selectedMember?.id ?? '';
      // Evakuierung in DB eintragen
      let triggeredAt = new Date().toISOString();
      try {
        const ev = await trigEvac.mutateAsync({ triggered_by: triggeredById || undefined as any, present_names: presentNames });
        triggeredAt = ev.triggered_at;
      } catch { /* weiter auch ohne DB-Eintrag */ }

      broadcastEvac({ type: 'start', triggeredBy: triggeredByName, triggeredAt: Date.parse(triggeredAt) });

      // Telegram-Nachricht + Foto
      const r = await sendEvacuationWithPhoto({
        triggeredBy: triggeredByName,
        triggeredAt: new Date(triggeredAt),
        presentNames,
        photoBlob: photoBlob ?? undefined,
      });
      setEvacToast(
        r.ok
          ? `Alarm + ${photoBlob ? 'Foto ' : ''}an Telegram gesendet.`
          : `Telegram fehlgeschlagen: ${r.detail ?? 'unbekannt'}`
      );
    } catch (e) {
      setEvacToast(`Fehler: ${(e as Error).message}`);
    } finally {
      setEvacBusy(false);
    }
  }

  async function cancelEvacuation() {
    if (!evacQ.data) return;
    try {
      await endEvac.mutateAsync(evacQ.data.id);
      broadcastEvac({ type: 'stop' });
    } catch { /* ignore */ }
  }

  const myInfusions = useMemo(
    () => infusions
      .filter((i) => i.saunameister_id === selectedMember?.id)
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time)),
    [infusions, selectedMember?.id]
  );

  const saunaName = (id: string) => saunas.find((s) => s.id === id)?.name ?? '';
  const saunaColor = (id: string) => saunas.find((s) => s.id === id)?.accent_color ?? '#22c55e';
  const evacuation = evacQ.data;

  // ─── Evakuierungs-Overlay ─────────────────────────────────────────────────
  if (evacuation) {
    return (
      <div className="fixed inset-0 z-50 bg-rose-950/98 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">🚨</div>
        <h1 className="text-3xl font-black uppercase tracking-widest text-rose-100 mb-2">EVAKUIERUNG</h1>
        <p className="text-rose-200 mb-4">Bitte verlasse sofort das Gebäude.</p>
        <div className="rounded-2xl bg-rose-900/60 ring-1 ring-rose-500/40 p-4 max-w-sm w-full mb-4">
          <p className="text-sm font-semibold text-rose-100 mb-2">Anwesend ({evacuation.present_count}):</p>
          <ul className="text-sm text-rose-200 space-y-1 max-h-40 overflow-y-auto">
            {evacuation.present_names.map((n) => <li key={n}>• {n}</li>)}
          </ul>
        </div>
        {evacToast && <p className="text-xs text-rose-300/80 mb-3">{evacToast}</p>}
        <button onClick={cancelEvacuation}
          className="rounded-xl bg-rose-600 px-8 py-4 text-base font-bold text-white hover:bg-rose-500">
          Alarm beenden
        </button>
      </div>
    );
  }

  // ─── Mitglieds-Auswahl ────────────────────────────────────────────────────
  if (!selectedMember) {
    return (
      <div className="bg-schwarzwald-soft min-h-screen text-slate-100 flex flex-col">
        <header className="border-b border-forest-800/40 bg-forest-950/95 backdrop-blur px-4 py-4 text-center">
          <h1 className="text-xl font-bold text-forest-100">Öl-Raum · Aufguss planen</h1>
          <p className="text-xs text-forest-300/70 mt-0.5">Bitte auswählen, wer du bist</p>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {presentAufgieser.length === 0 ? (
            <div className="text-center space-y-3">
              <div className="text-4xl">😔</div>
              <p className="text-forest-300/70 text-base">Kein Aufgieser aktuell eingecheckt.</p>
              <p className="text-forest-300/50 text-sm">Bitte erst am Eingang einchecken.</p>
            </div>
          ) : (
            <div className="w-full max-w-md space-y-3">
              {presentAufgieser.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedMember({ id: p.id, name: p.name })}
                  className="w-full rounded-2xl bg-forest-600/20 ring-2 ring-forest-500/40 px-6 py-5 text-lg font-bold text-forest-100 hover:bg-forest-600/30 transition text-left"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {/* Evakuierungs-Button auch auf Auswahl-Screen */}
          <div className="mt-12 w-full max-w-md">
            <button
              type="button"
              disabled={evacBusy}
              onClick={triggerEvacuation}
              className="w-full rounded-2xl border-2 border-rose-600/60 bg-rose-950/40 px-5 py-5 text-base font-bold uppercase tracking-wider text-rose-200 hover:bg-rose-950/60 transition disabled:opacity-60"
            >
              🚨 Evakuierung auslösen
            </button>
            {evacToast && <p className="mt-2 text-xs text-center text-rose-300/80">{evacToast}</p>}
          </div>
        </div>
      </div>
    );
  }

  // ─── Aufguss-Planer ───────────────────────────────────────────────────────
  return (
    <div className="bg-schwarzwald-soft min-h-screen text-slate-100">
      <header className="border-b border-forest-800/40 bg-forest-950/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-forest-100">Öl-Raum · Aufguss planen</h1>
          <p className="text-xs text-forest-300/70">{selectedMember.name}</p>
        </div>
        <button
          onClick={() => setSelectedMember(null)}
          className="rounded-lg bg-forest-900/80 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900"
        >
          Wechseln
        </button>
      </header>

      <div className="mx-auto max-w-2xl p-4 space-y-4">

        {/* Notfall */}
        <div className="rounded-2xl border-2 border-rose-600/60 bg-rose-950/40 p-4 ring-1 ring-rose-500/30">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-rose-200">🚨 Notfall</h2>
              <p className="text-xs text-rose-200/70 mt-0.5">Alarm auslösen + Foto an Telegram</p>
            </div>
            <button
              type="button"
              disabled={evacBusy}
              onClick={triggerEvacuation}
              className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold uppercase text-white hover:bg-rose-500 transition disabled:opacity-60 whitespace-nowrap"
            >
              {evacBusy ? 'Sendet …' : 'Evakuierung'}
            </button>
          </div>
          {evacToast && <p className="mt-2 text-xs text-rose-200/80">{evacToast}</p>}
        </div>

        {/* Aufguss-Formular */}
        <form onSubmit={submit} className="rounded-2xl bg-forest-950/70 p-5 ring-1 ring-forest-800/50 backdrop-blur space-y-4">
          <h2 className="text-base font-semibold text-forest-100">Neuen Aufguss eintragen</h2>

          {/* Heute / Morgen */}
          <div className="grid grid-cols-2 gap-2">
            {(['today', 'tomorrow'] as const).map((d) => (
              <button key={d} type="button" onClick={() => setDay(d)}
                className={`rounded-xl px-4 py-3 text-base font-medium ring-1 transition ${
                  day === d ? 'bg-forest-600 text-white ring-forest-500' : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                }`}>
                {d === 'today' ? 'Heute' : 'Morgen'}
              </button>
            ))}
          </div>

          {isMondaySelected ? (
            <div className="rounded-xl bg-forest-900/60 px-4 py-6 text-center text-forest-300/70 ring-1 ring-forest-800/40">
              Montag keine Aufgüsse
            </div>
          ) : (
            <>
              {/* Sauna */}
              <div>
                <label className="text-sm text-forest-300">Sauna</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {saunas.map((s) => (
                    <button key={s.id} type="button" onClick={() => setSaunaId(s.id)}
                      className="rounded-xl px-2 py-4 text-sm ring-1 transition"
                      style={saunaId === s.id
                        ? { background: s.accent_color, color: '#0b1f10', boxShadow: `0 0 0 2px ${s.accent_color}66` }
                        : { background: 'rgba(20, 83, 45, 0.55)' }}>
                      <div className="font-semibold truncate">{s.name}</div>
                      <div className="text-xs opacity-80">{s.temperature_label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Uhrzeit */}
              <div>
                <label className="text-sm text-forest-300">Uhrzeit (11–20 Uhr)</label>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {availableSlots.map((s) => {
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
                          active ? 'bg-forest-500 text-forest-950 ring-forest-400' : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                        }`}>
                        <span aria-hidden>{a.emoji}</span><span>{a.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/30">{error}</div>}
              {success && <div className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-500/30">✅ Aufguss eingetragen!</div>}

              <button type="submit" disabled={addInf.isPending}
                className="w-full rounded-xl bg-forest-500 px-5 py-4 text-base font-semibold text-forest-950 hover:bg-forest-400 transition disabled:opacity-60">
                {addInf.isPending ? 'Speichere…' : 'Aufguss eintragen'}
              </button>
            </>
          )}
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
                    <div className="text-sm font-medium truncate">{i.title}</div>
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
