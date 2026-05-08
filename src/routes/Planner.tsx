import { useEffect, useMemo, useState, useCallback } from 'react';
import { addDays, format, setHours, setMinutes, isBefore } from 'date-fns';
import { differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { fmtClock, dayLabel } from '@/lib/time';
import { ATTRIBUTES, ATTR_BY_ID, type InfusionAttribute } from '@/lib/attributes';
import { broadcastEvac } from '@/lib/evacuation';
import { sendEvacuationList, sendNotification, sendBadgeAnnouncement } from '@/lib/telegram';
import { checkAndAwardBadges } from '@/lib/checkBadges';
import type { BadgeDefinition } from '@/lib/badges';
import { PageBackground } from '@/components/PageBackground';
import CustomAttrCreator from '@/components/CustomAttrCreator';
import BadgeShowcase from '@/components/BadgeShowcase';
import AchievementToast from '@/components/AchievementToast';
import MonthlyLeaderboard from '@/components/MonthlyLeaderboard';
import { useAuth } from '@/hooks/useAuth';
import {
  useSaunas, useInfusions, useTemplates,
  useAddInfusion, useDeleteInfusion,
  useAddTemplate, useDeleteTemplate,
  useCurrentMember, usePresentMembers,
  useActiveEvacuation, useTriggerEvacuation, useEndEvacuation,
  useCoAufgieser, useJoinTeamInfusion, useLeaveTeamInfusion,
  useMeisterDirectory,
  useMyPolls, useSubmitPollResponse, useUpdateEntryCode,
  useSetSaunaName, useMyCustomAttrs,
  togglePresenceByCode, type MyPoll,
} from '@/lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMemberNumber(n: number | null | undefined): string {
  if (!n) return '';
  return `FDS-${String(n).padStart(3, '0')}`;
}

function fmtDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function getAvailableSlots(forDate: Date): string[] {
  if (forDate.getDay() === 1) return [];
  return Array.from({ length: 10 }, (_, i) =>
    `${String(11 + i).padStart(2, '0')}:00`
  );
}

function slotToDate(day: 'today' | 'tomorrow', hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const base = day === 'tomorrow' ? addDays(new Date(), 1) : new Date();
  return setMinutes(setHours(base, h), m);
}

const DURATIONS = [10, 15, 20, 25, 30] as const;

function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur ${className}`}>
      {title && (
        <h2 className="text-xs font-semibold text-forest-400 uppercase tracking-wider mb-3">{title}</h2>
      )}
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Planner() {
  const { signOut } = useAuth();
  const member = useCurrentMember();
  const saunasQ = useSaunas();
  const infusionsQ = useInfusions();
  const presentQ = usePresentMembers();
  const evacQ = useActiveEvacuation();
  const templatesQ = useTemplates(member.data?.id ?? null);
  const pollsQ = useMyPolls();
  const updateEntryCode = useUpdateEntryCode();
  const meisterDir = useMeisterDirectory();
  const setSaunaName = useSetSaunaName();

  const addInf = useAddInfusion();
  const delInf = useDeleteInfusion();
  const addTpl = useAddTemplate();
  const delTpl = useDeleteTemplate();
  const trigEvac = useTriggerEvacuation();
  const endEvac = useEndEvacuation();

  const teamInfusionIds = useMemo(
    () => infusionsQ.data?.filter((i) => i.team_infusion).map((i) => i.id) ?? [],
    [infusionsQ.data]
  );
  const coAufgieserQ = useCoAufgieser(teamInfusionIds);
  const joinTeam = useJoinTeamInfusion();
  const leaveTeam = useLeaveTeamInfusion();

  const m = member.data;
  const isAufgieser = !!(m?.is_aufgieser || m?.role === 'admin');
  const isAdmin = m?.role === 'admin';

  const customAttrsQ = useMyCustomAttrs(isAufgieser ? m?.id : undefined);
  const customAttrs = customAttrsQ.data ?? [];
  const [showAttrCreator, setShowAttrCreator] = useState(false);
  const [customAttrIds, setCustomAttrIds] = useState<string[]>([]);

  // ─── Achievement Toast ───────────────────────────────────────────────────
  const [newBadges, setNewBadges] = useState<BadgeDefinition[]>([]);
  const [toastIndex, setToastIndex] = useState(0);

  const handleToastClose = useCallback(() => {
    if (toastIndex < newBadges.length - 1) {
      setToastIndex((i) => i + 1);
    } else {
      setNewBadges([]);
      setToastIndex(0);
    }
  }, [toastIndex, newBadges.length]);

  function toggleCustomAttr(id: string) {
    setCustomAttrIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const saunas = saunasQ.data ?? [];
  const infusions = infusionsQ.data ?? [];
  const myTemplates = (templatesQ.data ?? []).filter((t) => t.member_id === m?.id);

  // ─── Check-in/out state ─────────────────────────────────────────────────
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkMsg, setCheckMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmCheckout, setConfirmCheckout] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const myPresence = presentQ.data?.find((p) => p.id === m?.id);
  const isPresent = !!myPresence;
  const checkedInAt = myPresence?.last_scan_at ? new Date(myPresence.last_scan_at).getTime() : null;
  const presenceDuration = isPresent && checkedInAt ? nowTick - checkedInAt : null;

  async function toggleCheckin() {
    if (!m) return;
    if (isPresent && !confirmCheckout) { setConfirmCheckout(true); return; }
    setConfirmCheckout(false);
    setCheckBusy(true);
    setCheckMsg(null);
    try {
      const r = await togglePresenceByCode(m.member_code);
      setCheckMsg({ ok: true, text: r.is_present ? '✅ Eingecheckt — willkommen!' : '👋 Ausgecheckt — bis zum nächsten Mal!' });
      await presentQ.refetch();
    } catch (e) {
      setCheckMsg({ ok: false, text: (e as Error).message });
    } finally {
      setCheckBusy(false);
    }
  }

  // ─── Entry-Code ─────────────────────────────────────────────────────────
  const [editingCode, setEditingCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSaved, setCodeSaved] = useState(false);

  async function saveEntryCode() {
    setCodeError(null);
    if (!m) return;
    const trimmed = codeInput.trim();
    if (trimmed.length > 0 && (trimmed.length < 4 || trimmed.length > 8)) {
      setCodeError('Code muss 4–8 Zeichen lang sein.');
      return;
    }
    try {
      await updateEntryCode.mutateAsync({ id: m.id, entry_code: trimmed || null });
      setEditingCode(false);
      setCodeInput('');
      setCodeSaved(true);
      setTimeout(() => setCodeSaved(false), 3000);
    } catch (e) { setCodeError((e as Error).message); }
  }

  // ─── Sauna-Name ─────────────────────────────────────────────────────────
  const [editingSaunaName, setEditingSaunaName] = useState(false);
  const [saunaNameInput, setSaunaNameInput] = useState('');
  const [saunaNameError, setSaunaNameError] = useState<string | null>(null);
  const [saunaNameSaved, setSaunaNameSaved] = useState(false);

  const canChangeSaunaName = useMemo(() => {
    if (!m?.sauna_name_changed_at) return true;
    return differenceInDays(new Date(), new Date(m.sauna_name_changed_at)) >= 30;
  }, [m?.sauna_name_changed_at]);

  const daysUntilNextChange = useMemo(() => {
    if (!m?.sauna_name_changed_at) return 0;
    const diff = differenceInDays(new Date(), new Date(m.sauna_name_changed_at));
    return Math.max(0, 30 - diff);
  }, [m?.sauna_name_changed_at]);

  async function saveSaunaName() {
    setSaunaNameError(null);
    const trimmed = saunaNameInput.trim();
    try {
      await setSaunaName.mutateAsync(trimmed);
      const oldName = m?.sauna_name || m?.name || '';
      const newName = trimmed || m?.name || '';
      await sendNotification(`🎭 <b>${m?.name}</b> hat seinen Aufguss-Namen geändert: ${oldName} → ${newName}`);
      setEditingSaunaName(false);
      setSaunaNameInput('');
      setSaunaNameSaved(true);
      setTimeout(() => setSaunaNameSaved(false), 3000);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('cooldown')) setSaunaNameError(`Noch ${daysUntilNextChange} Tage bis zur nächsten Änderung.`);
      else setSaunaNameError(msg);
    }
  }

  // ─── Aufguss-Formular ───────────────────────────────────────────────────
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [saunaId, setSaunaId] = useState<string>('');
  const [slot, setSlot] = useState<string>('15:00');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState<number>(15);
  const [attrs, setAttrs] = useState<InfusionAttribute[]>([]);
  const [teamInfusion, setTeamInfusion] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [evacToast, setEvacToast] = useState<string | null>(null);

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

  function applyTemplate(t: { title: string; description: string | null; duration_minutes: number; attributes: string[] }) {
    setTitle(t.title);
    setDescription(t.description ?? '');
    setDuration(t.duration_minutes);
    setAttrs(t.attributes as InfusionAttribute[]);
  }

  async function saveAsTemplate() {
    setFormError(null);
    if (!m) return setFormError('Bitte zuerst anmelden.');
    if (!title.trim()) return setFormError('Titel fehlt für die Vorlage.');
    try {
      await addTpl.mutateAsync({
        member_id: m.id,
        title: title.trim(),
        description: description.trim() || null,
        duration_minutes: duration,
        attributes: attrs,
      });
    } catch (e) { setFormError((e as Error).message); }
  }

  function clearForm() {
    setTitle('');
    setDescription('');
    setAttrs([]);
    setCustomAttrIds([]);
    setDuration(15);
    setTeamInfusion(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!m) return setFormError('Bitte zuerst anmelden.');
    if (!saunaId) return setFormError('Bitte eine Sauna wählen.');
    if (!title.trim()) return setFormError('Titel fehlt.');
    if (isMondaySelected) return setFormError('Montag keine Aufgüsse.');

    const start = slotToDate(day, slot);
    if (day === 'today' && isBefore(start, new Date())) return setFormError('Slot liegt in der Vergangenheit.');
    if (isSlotTaken(slot)) return setFormError('Slot bereits belegt.');

    try {
      await addInf.mutateAsync({
        sauna_id: saunaId,
        template_id: null,
        saunameister_id: m.id,
        title: title.trim(),
        description: description.trim() || null,
        attributes: attrs,
        start_time: start.toISOString(),
        duration_minutes: duration,
        team_infusion: teamInfusion,
      });
      clearForm();
      // Badge-Check nach erfolgreichem Aufguss
      const displayName = m.sauna_name ?? m.name;
      const earned = await checkAndAwardBadges(m.id);
      if (earned.length > 0) {
        setNewBadges(earned);
        setToastIndex(0);
        for (const badge of earned) {
          sendBadgeAnnouncement(displayName, badge).catch(() => {});
        }
      }
    } catch (e) { setFormError((e as Error).message); }
  }

  // ─── Evakuierung ────────────────────────────────────────────────────────
  async function triggerEvacuation() {
    if (!m) return;
    if (!confirm('Evakuierungsalarm WIRKLICH auslösen?')) return;
    setEvacToast(null);
    const presentNames = (presentQ.data ?? []).map((p) => p.name);
    try {
      const ev = await trigEvac.mutateAsync({ triggered_by: m.id, present_names: presentNames });
      broadcastEvac({ type: 'start', triggeredBy: m.name, triggeredAt: Date.parse(ev.triggered_at) });
      const r = await sendEvacuationList({ triggeredBy: m.name, triggeredAt: new Date(ev.triggered_at), presentNames });
      setEvacToast(r.ok ? `Liste an Telegram gesendet (${presentNames.length} Personen).` : `Telegram fehlgeschlagen: ${r.detail ?? 'unbekannt'}`);
    } catch (e) { setEvacToast(`Fehler: ${(e as Error).message}`); }
  }

  async function cancelEvacuation() {
    if (!evacQ.data) return;
    try {
      await endEvac.mutateAsync(evacQ.data.id);
      broadcastEvac({ type: 'stop' });
    } catch (e) { setEvacToast(`Fehler: ${(e as Error).message}`); }
  }

  // ─── Derived data ────────────────────────────────────────────────────────
  const myInfusions = useMemo(
    () => infusions.filter((i) => i.saunameister_id === m?.id).sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time)),
    [infusions, m?.id]
  );

  const joinableTeamInfusions = useMemo(
    () => infusions.filter((i) => i.team_infusion && i.saunameister_id !== m?.id).sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time)),
    [infusions, m?.id]
  );

  const todayInfusions = useMemo(
    () => infusions.filter((i) => new Date(i.start_time).toDateString() === new Date().toDateString()),
    [infusions]
  );

  function getCoNames(infusionId: string): string[] {
    return (coAufgieserQ.data ?? []).filter((c) => c.infusion_id === infusionId).map((c) => c.member_name ?? '?');
  }

  function isJoined(infusionId: string): boolean {
    return (coAufgieserQ.data ?? []).some((c) => c.infusion_id === infusionId && c.member_id === m?.id);
  }

  const meisterName = (id: string | null) => (id && meisterDir.data?.find((x) => x.id === id)?.name) || '—';
  const saunaName = (id: string) => saunas.find((s) => s.id === id)?.name ?? '';
  const saunaColor = (id: string) => saunas.find((s) => s.id === id)?.accent_color ?? '#22c55e';
  const evacuation = evacQ.data;
  const openPolls = (pollsQ.data ?? []).filter((p) => !p.my_answer);
  const answeredPolls = (pollsQ.data ?? []).filter((p) => !!p.my_answer);

  return (
    <PageBackground page="planner">
      {showAttrCreator && m && (
        <CustomAttrCreator memberId={m.id} onClose={() => { setShowAttrCreator(false); customAttrsQ.refetch(); }} />
      )}

      {newBadges.length > 0 && (
        <AchievementToast badges={newBadges} currentIndex={toastIndex} onClose={handleToastClose} />
      )}

      {/* Evakuierungs-Alarm-Overlay */}
      {evacuation && (
        <div className="fixed inset-0 z-50 bg-rose-950/95 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-6xl mb-4">🚨</div>
          <h1 className="text-3xl font-black uppercase tracking-widest text-rose-100 mb-2">EVAKUIERUNG</h1>
          <p className="text-rose-200 mb-4">Bitte verlasse sofort das Gebäude.</p>
          <div className="rounded-2xl bg-rose-900/60 ring-1 ring-rose-500/40 p-4 max-w-sm w-full mb-4">
            <p className="text-sm font-semibold text-rose-100 mb-2">Anwesend ({evacuation.present_count}):</p>
            <ul className="text-sm text-rose-200 space-y-1 max-h-40 overflow-y-auto">
              {evacuation.present_names.map((n) => <li key={n}>• {n}</li>)}
            </ul>
          </div>
          {isAufgieser && (
            <button onClick={cancelEvacuation} className="rounded-xl bg-rose-600 px-6 py-3 text-sm font-bold text-white hover:bg-rose-500">
              Alarm beenden
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-forest-800/40 bg-forest-950/85 backdrop-blur px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-forest-100 truncate">
            {m ? `Hallo, ${m.name.split(' ')[0]}` : 'Interner Bereich'}
          </h1>
          {m && (
            <p className="text-xs text-forest-300/70 truncate">
              {fmtMemberNumber(m.member_number)}
              {m.is_aufgieser && <span className="ml-1.5 text-amber-300">· Aufgieser</span>}
              {isAdmin && <span className="ml-1.5 text-forest-300">· Admin</span>}
              {m.sauna_name && <span className="ml-1.5 text-forest-200">· {m.sauna_name}</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link to="/dashboard" className="hidden sm:inline text-xs text-forest-300 hover:text-forest-100 underline">
            Tafel
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className="rounded-lg bg-forest-700/50 px-3 py-1.5 text-xs font-semibold text-forest-100 ring-1 ring-forest-600/40 hover:bg-forest-700"
            >
              Admin-Bereich
            </Link>
          )}
          <button
            onClick={() => signOut()}
            className="rounded-lg bg-forest-900/80 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900"
          >
            Abmelden
          </button>
        </div>
      </header>

      {evacToast && (
        <div className="border-b border-forest-800/40 bg-forest-950/70 px-4 py-2 text-xs text-forest-200">{evacToast}</div>
      )}

      {/* 2-Spalten-Layout (Desktop) */}
      <div className="mx-auto max-w-7xl p-3 sm:p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ══ LINKE SPALTE: Persönlicher Bereich ══════════════════════════ */}
          <div className="space-y-4">

            {/* Check-in/out */}
            <Card>
              <div className="text-center">
                {isPresent && presenceDuration !== null ? (
                  <>
                    <p className="text-xs text-emerald-400/80 mb-1 uppercase tracking-wider font-semibold">Anwesend seit</p>
                    <p className="text-4xl font-black text-emerald-300 tabular-nums mb-4">{fmtDuration(presenceDuration)}</p>
                    {confirmCheckout ? (
                      <div className="space-y-2">
                        <p className="text-sm text-forest-200 mb-2">Wirklich auschecken?</p>
                        <div className="flex gap-2">
                          <button onClick={toggleCheckin} disabled={checkBusy}
                            className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white px-5 py-3 text-sm font-bold transition disabled:opacity-60">
                            Ja, auschecken
                          </button>
                          <button onClick={() => setConfirmCheckout(false)}
                            className="flex-1 rounded-xl bg-forest-900/80 px-5 py-3 text-sm font-medium text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900">
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={toggleCheckin} disabled={checkBusy || !m}
                        className="w-full rounded-xl bg-rose-600/20 ring-1 ring-rose-500/40 px-5 py-3 text-sm font-semibold text-rose-200 hover:bg-rose-600/30 transition disabled:opacity-60">
                        {checkBusy ? 'Bitte warten…' : 'Auschecken'}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-forest-300/70 mb-1">Dein Status</p>
                    <div className="text-lg font-bold mb-4 text-forest-300/60">⬜ Nicht eingecheckt</div>
                    <button onClick={toggleCheckin} disabled={checkBusy || !m}
                      className="w-full rounded-xl bg-forest-500 hover:bg-forest-400 text-forest-950 px-5 py-4 text-base font-bold transition disabled:opacity-60">
                      {checkBusy ? 'Bitte warten…' : 'Einchecken'}
                    </button>
                  </>
                )}
                {checkMsg && (
                  <p className={`mt-3 text-sm font-medium ${checkMsg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{checkMsg.text}</p>
                )}
              </div>
            </Card>

            {/* Offene Polls */}
            {openPolls.length > 0 && (
              <div className="rounded-2xl bg-amber-950/40 ring-2 ring-amber-500/40 p-4 backdrop-blur">
                <h2 className="text-xs font-bold text-amber-200 mb-3 uppercase tracking-wider">
                  📋 {openPolls.length} offene Abfrage{openPolls.length > 1 ? 'n' : ''}
                </h2>
                <div className="space-y-3">
                  {openPolls.map((poll) => (
                    <PollCard key={poll.id} poll={poll} memberId={m?.id ?? ''} onAnswered={() => pollsQ.refetch()} />
                  ))}
                </div>
              </div>
            )}

            {/* Heutiger Aufgussplan */}
            <Card title="Heutiger Aufgussplan">
              {todayInfusions.length === 0 ? (
                <p className="text-sm text-forest-300/60">Heute noch keine Aufgüsse geplant.</p>
              ) : (
                <ul className="space-y-2">
                  {todayInfusions.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 rounded-lg bg-forest-900/60 px-3 py-2 ring-1 ring-forest-800/40"
                      style={{ borderLeft: `3px solid ${saunaColor(i.sauna_id)}` }}>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {i.title}{i.team_infusion && <span className="ml-1.5 text-xs text-amber-300">👥</span>}
                        </div>
                        <div className="text-xs text-forest-300/70 mt-0.5">
                          {fmtClock(i.start_time)} · {saunaName(i.sauna_id)} · {i.duration_minutes} Min
                          · {meisterName(i.saunameister_id)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Monatliches Ranking */}
            <Card title="Ranking diesen Monat">
              <MonthlyLeaderboard />
            </Card>

            {/* Einlass-Code */}
            <Card title="Mein Einlass-Code">
              <p className="text-xs text-forest-300/60 mb-3">Verwende diesen Code am Eingangs-Tablet statt QR-Scan.</p>
              {codeSaved && <p className="text-sm text-emerald-300 mb-2">✅ Code gespeichert.</p>}
              {!editingCode ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-forest-200">
                    {m?.entry_code ? '●●●●●●' : <span className="text-forest-300/50">Nicht gesetzt</span>}
                  </span>
                  <button onClick={() => { setEditingCode(true); setCodeInput(''); setCodeError(null); }}
                    className="rounded-lg bg-forest-800/60 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-800">
                    {m?.entry_code ? 'Ändern' : 'Code setzen'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input type="text" value={codeInput} onChange={(e) => setCodeInput(e.target.value)}
                    placeholder="4–8 Zeichen, z.B. sonne7" maxLength={8} autoFocus
                    className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400" />
                  {codeError && <p className="text-xs text-rose-300">{codeError}</p>}
                  <div className="flex gap-2">
                    <button onClick={saveEntryCode} disabled={updateEntryCode.isPending}
                      className="flex-1 rounded-lg bg-forest-500 px-3 py-2 text-sm font-semibold text-forest-950 hover:bg-forest-400 disabled:opacity-60">
                      {updateEntryCode.isPending ? 'Speichere…' : 'Speichern'}
                    </button>
                    {m?.entry_code && (
                      <button onClick={async () => { if (!m) return; await updateEntryCode.mutateAsync({ id: m.id, entry_code: null }); setEditingCode(false); }}
                        className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/25">
                        Löschen
                      </button>
                    )}
                    <button onClick={() => { setEditingCode(false); setCodeError(null); }}
                      className="rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-300 ring-1 ring-forest-700/50 hover:bg-forest-900">
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </Card>

            {/* Bereits beantwortete Polls */}
            {answeredPolls.length > 0 && (
              <Card title="Bereits beantwortet">
                <ul className="space-y-2">
                  {answeredPolls.map((poll) => (
                    <li key={poll.id} className="rounded-lg bg-forest-900/50 px-3 py-2 ring-1 ring-forest-800/30">
                      <div className="text-sm font-medium text-forest-200">{poll.title}</div>
                      <div className="text-xs text-emerald-300 mt-0.5">✓ {poll.my_answer}</div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Anwesende Mitglieder (nur Admin) */}
            {isAdmin && (
              <Card title={`Aktuell anwesend (${presentQ.data?.length ?? 0})`}>
                {(presentQ.data ?? []).length === 0 ? (
                  <p className="text-sm text-forest-300/60">Niemand eingecheckt.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {(presentQ.data ?? []).map((p) => (
                      <li key={p.id} className={`rounded-full px-3 py-1 text-sm ring-1 ${
                        p.id === m?.id ? 'bg-forest-500 text-forest-950 ring-forest-400 font-semibold' : 'bg-forest-900/60 text-forest-200 ring-forest-800/40'
                      }`}>
                        {p.name}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>

          {/* ══ RECHTE SPALTE: Aufguss-Planung (nur Aufgieser/Admin) ════════ */}
          {isAufgieser && (
            <div className="space-y-4">

              {/* Aufguss-Künstlername */}
              <Card title="Mein Aufguss-Name">
                <p className="text-xs text-forest-300/60 mb-3">Wird auf der Tafel angezeigt. Alle 30 Tage änderbar.</p>
                {saunaNameSaved && <p className="text-sm text-emerald-300 mb-2">✅ Name gespeichert.</p>}
                {!editingSaunaName ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-base font-semibold text-forest-100">
                        {m?.sauna_name || <span className="text-forest-300/50 font-normal text-sm">Kein Aufguss-Name gesetzt</span>}
                      </span>
                      {!canChangeSaunaName && (
                        <p className="text-xs text-forest-400/60 mt-0.5">Noch {daysUntilNextChange} Tage bis zur nächsten Änderung</p>
                      )}
                    </div>
                    <button
                      onClick={() => { setEditingSaunaName(true); setSaunaNameInput(m?.sauna_name ?? ''); setSaunaNameError(null); }}
                      disabled={!canChangeSaunaName}
                      className="rounded-lg bg-forest-800/60 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {m?.sauna_name ? 'Ändern' : 'Name setzen'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={saunaNameInput}
                      onChange={(e) => setSaunaNameInput(e.target.value)}
                      placeholder="z.B. Der Feuermeister"
                      maxLength={40}
                      autoFocus
                      className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
                    />
                    {saunaNameError && <p className="text-xs text-rose-300">{saunaNameError}</p>}
                    <div className="flex gap-2">
                      <button onClick={saveSaunaName} disabled={setSaunaName.isPending}
                        className="flex-1 rounded-lg bg-forest-500 px-3 py-2 text-sm font-semibold text-forest-950 hover:bg-forest-400 disabled:opacity-60">
                        {setSaunaName.isPending ? 'Speichere…' : 'Speichern'}
                      </button>
                      <button onClick={() => { setEditingSaunaName(false); setSaunaNameError(null); }}
                        className="rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-300 ring-1 ring-forest-700/50 hover:bg-forest-900">
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
              </Card>

              {/* Eigene Buttons */}
              {m?.custom_attrs_enabled !== false && (
                <Card title={`Meine Buttons (${customAttrs.length}/8)`}>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {customAttrs.map((a) => (
                      <div
                        key={a.id}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-white/10"
                        style={{ background: a.color, color: '#0b1f10' }}
                      >
                        <span>{a.emoji}</span>
                        <span>{a.label}</span>
                      </div>
                    ))}
                    {customAttrs.length === 0 && (
                      <p className="text-xs text-forest-300/60">Noch keine eigenen Buttons erstellt.</p>
                    )}
                  </div>
                  {customAttrs.length < 8 ? (
                    <button
                      type="button"
                      onClick={() => setShowAttrCreator(true)}
                      className="rounded-lg bg-forest-800/60 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-800"
                    >
                      + Button erstellen
                    </button>
                  ) : (
                    <p className="text-xs text-forest-400/60">Maximum erreicht. Nur Admin kann Buttons löschen.</p>
                  )}
                </Card>
              )}

              {/* Meine Auszeichnungen */}
              {m && (
                <Card title="Meine Auszeichnungen">
                  <BadgeShowcase memberId={m.id} />
                </Card>
              )}

              {/* Notfall */}
              <div className="rounded-2xl border-2 border-rose-600/60 bg-rose-950/40 p-4 ring-1 ring-rose-500/30 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-rose-200">🚨 Notfall</h2>
                    <p className="mt-0.5 text-xs text-rose-200/80">Vollbild-Alarm + Telegram</p>
                  </div>
                  <button type="button" disabled={trigEvac.isPending || !!evacuation} onClick={triggerEvacuation}
                    className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-rose-500 transition disabled:opacity-60 whitespace-nowrap">
                    {evacuation ? 'Alarm läuft …' : trigEvac.isPending ? 'Sendet …' : 'Evakuierung'}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-rose-200/60">Anwesend: {presentQ.data?.length ?? 0} Personen</p>
              </div>

              {/* Vorlagen */}
              <Card title="Meine Vorlagen">
                <ul className="space-y-2">
                  {myTemplates.length === 0 && (
                    <li className="text-xs text-forest-300/60">„Als Vorlage" speichert die aktuelle Eingabe.</li>
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
                      <button onClick={() => delTpl.mutate(t.id)}
                        className="rounded-md px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10">✕</button>
                    </li>
                  ))}
                </ul>
              </Card>

              {/* Meine Aufgüsse */}
              <Card title="Meine Aufgüsse">
                <ul className="space-y-2">
                  {myInfusions.length === 0 && <li className="text-xs text-forest-300/60">Noch keine geplant.</li>}
                  {myInfusions.map((i) => {
                    const coNames = getCoNames(i.id);
                    return (
                      <li key={i.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-forest-900/60 px-3 py-2 ring-1 ring-forest-800/40"
                        style={{ borderLeft: `3px solid ${saunaColor(i.sauna_id)}` }}>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {i.title}{i.team_infusion && <span className="ml-1.5 text-xs text-amber-300">👥 Team</span>}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-forest-300/70">
                            <span>{dayLabel(i.start_time)} · {fmtClock(i.start_time)}</span>
                            <span>·</span>
                            <span style={{ color: saunaColor(i.sauna_id) }} className="font-semibold">{saunaName(i.sauna_id)}</span>
                            <span>· {i.duration_minutes} Min</span>
                            {(i.attributes as InfusionAttribute[]).map((a) => (
                              <span key={a} aria-hidden>{ATTR_BY_ID[a]?.emoji}</span>
                            ))}
                          </div>
                          {coNames.length > 0 && <div className="text-xs text-amber-300/80 mt-0.5">+ {coNames.join(', ')}</div>}
                        </div>
                        <button onClick={() => delInf.mutate(i.id)}
                          className="rounded-md px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10 flex-shrink-0">Löschen</button>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              {/* Team-Aufgüsse anderer */}
              {joinableTeamInfusions.length > 0 && (
                <div className="rounded-2xl bg-amber-950/30 p-4 ring-1 ring-amber-500/30 backdrop-blur">
                  <h2 className="text-xs font-semibold text-amber-200 uppercase tracking-wider mb-1">Team-Aufgüsse 👥</h2>
                  <p className="text-xs text-amber-200/60 mb-3">Du kannst diesen Aufgüssen beitreten.</p>
                  <ul className="space-y-2">
                    {joinableTeamInfusions.map((i) => {
                      const joined = isJoined(i.id);
                      const coNames = getCoNames(i.id);
                      return (
                        <li key={i.id}
                          className="flex items-center justify-between gap-3 rounded-lg bg-amber-900/30 px-3 py-2 ring-1 ring-amber-800/40"
                          style={{ borderLeft: `3px solid ${saunaColor(i.sauna_id)}` }}>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate text-amber-50">{i.title}</div>
                            <div className="mt-0.5 text-xs text-amber-200/70">
                              {dayLabel(i.start_time)} · {fmtClock(i.start_time)} · {saunaName(i.sauna_id)}
                            </div>
                            <div className="text-xs text-amber-200/50 mt-0.5">
                              {meisterName(i.saunameister_id)}{coNames.length > 0 && ` + ${coNames.join(', ')}`}
                            </div>
                          </div>
                          {joined ? (
                            <button onClick={() => m && leaveTeam.mutate({ infusion_id: i.id, member_id: m.id })}
                              className="rounded-md px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10 whitespace-nowrap flex-shrink-0">
                              Verlassen
                            </button>
                          ) : (
                            <button onClick={() => m && joinTeam.mutate({ infusion_id: i.id, member_id: m.id })}
                              className="rounded-md bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-500 whitespace-nowrap flex-shrink-0">
                              Beitreten
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Aufguss-Formular */}
              <form onSubmit={submit} className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur space-y-4">
                <h2 className="text-sm font-semibold text-forest-100 uppercase tracking-wider">Neuen Aufguss eintragen</h2>

                <div className="grid grid-cols-2 gap-2">
                  {(['today', 'tomorrow'] as const).map((d) => (
                    <button key={d} type="button" onClick={() => setDay(d)}
                      className={`rounded-xl px-4 py-3 text-sm font-medium ring-1 transition ${
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
                    <div>
                      <label className="text-xs text-forest-300">Sauna</label>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {saunas.map((s) => (
                          <button key={s.id} type="button" onClick={() => setSaunaId(s.id)}
                            className="rounded-xl px-2 py-3 text-sm ring-1 transition"
                            style={saunaId === s.id
                              ? { background: s.accent_color, color: '#0b1f10', boxShadow: `0 0 0 2px ${s.accent_color}66` }
                              : { background: 'rgba(20, 83, 45, 0.55)' }}>
                            <div className="font-semibold truncate">{s.name}</div>
                            <div className="text-xs opacity-80">{s.temperature_label}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-forest-300">Uhrzeit (11–20 Uhr)</label>
                      <div className="mt-2 grid grid-cols-5 gap-1.5">
                        {availableSlots.map((s) => {
                          const taken = isSlotTaken(s);
                          const past = day === 'today' && isBefore(slotToDate('today', s), new Date());
                          const disabled = taken || past;
                          return (
                            <button key={s} type="button" disabled={disabled} onClick={() => setSlot(s)}
                              className={`rounded-md px-1 py-2.5 text-xs font-mono tabular-nums ring-1 transition ${
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

                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <div>
                        <label className="text-xs text-forest-300">Titel</label>
                        <input value={title} onChange={(e) => setTitle(e.target.value)}
                          placeholder="z.B. Eukalyptus klassisch"
                          className="mt-1.5 w-full rounded-lg bg-forest-900/80 px-3 py-2.5 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400" />
                      </div>
                      <div>
                        <label className="text-xs text-forest-300">Dauer</label>
                        <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                          className="mt-1.5 rounded-lg bg-forest-900/80 px-3 py-2.5 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400">
                          {DURATIONS.map((d) => <option key={d} value={d}>{d} Min</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-forest-300">Beschreibung (optional)</label>
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                        rows={2} placeholder="z.B. Klärend & frisch"
                        className="mt-1.5 w-full rounded-lg bg-forest-900/80 px-3 py-2.5 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400" />
                    </div>

                    <div>
                      <label className="text-xs text-forest-300">Eigenschaften</label>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {ATTRIBUTES.map((a) => {
                          const active = attrs.includes(a.id);
                          return (
                            <button key={a.id} type="button" onClick={() => toggleAttr(a.id)}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs ring-1 transition ${
                                active ? 'bg-forest-500 text-forest-950 ring-forest-400' : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                              }`}>
                              <span aria-hidden>{a.emoji}</span><span>{a.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Eigene Buttons im Formular */}
                    {customAttrs.length > 0 && (
                      <div>
                        <label className="text-xs text-forest-300">Meine Buttons</label>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {customAttrs.map((a) => {
                            const active = customAttrIds.includes(a.id);
                            return (
                              <button key={a.id} type="button" onClick={() => toggleCustomAttr(a.id)}
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs ring-1 transition"
                                style={active
                                  ? { background: a.color, color: '#0b1f10', boxShadow: `0 0 0 2px ${a.color}66` }
                                  : { background: 'rgba(20, 83, 45, 0.55)', color: '#d1fae5' }}>
                                <span aria-hidden>{a.emoji}</span><span>{a.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setTeamInfusion((v) => !v)}>
                      <div className={`relative w-10 h-6 rounded-full transition flex-shrink-0 ${teamInfusion ? 'bg-amber-500' : 'bg-forest-800'}`}>
                        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${teamInfusion ? 'translate-x-4' : ''}`} />
                      </div>
                      <span className="text-xs text-forest-200">
                        Team-Aufguss <span className="text-forest-300/60">— andere Aufgieser können mitmachen</span>
                      </span>
                    </div>

                    {formError && (
                      <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/30">{formError}</div>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                      <button type="submit" disabled={addInf.isPending}
                        className="flex-1 rounded-xl bg-forest-500 px-4 py-3 text-sm font-semibold text-forest-950 hover:bg-forest-400 transition disabled:opacity-60">
                        {addInf.isPending ? 'Speichere …' : 'Aufguss eintragen'}
                      </button>
                      <button type="button" onClick={saveAsTemplate} disabled={addTpl.isPending}
                        className="rounded-xl bg-forest-900/70 px-3 py-2.5 text-xs font-medium text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-900 transition disabled:opacity-60">
                        Als Vorlage
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </PageBackground>
  );
}

// ─── Poll Card ────────────────────────────────────────────────────────────────

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

  if (done) return <div className="rounded-xl bg-forest-900/60 px-3 py-2 text-sm text-emerald-300">✓ Antwort gespeichert</div>;

  return (
    <div className="rounded-xl bg-forest-900/60 p-3 ring-1 ring-amber-500/20">
      <p className="text-sm font-semibold text-amber-100">{poll.title}</p>
      {poll.description && <p className="text-xs text-forest-300/70 mt-0.5">{poll.description}</p>}
      {poll.deadline && <p className="text-xs text-amber-400/80 mt-1">Bis: {new Date(poll.deadline).toLocaleDateString('de-DE')}</p>}
      <div className="mt-3">
        {poll.answer_type === 'yesno' && (
          <div className="flex gap-2">
            <button onClick={() => handleSubmit('Ja')} disabled={busy}
              className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">Ja</button>
            <button onClick={() => handleSubmit('Nein')} disabled={busy}
              className="flex-1 rounded-lg bg-rose-700 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-60">Nein</button>
          </div>
        )}
        {poll.answer_type === 'choice' && (
          <div className="flex flex-col gap-2">
            {(poll.choices ?? []).map((c) => (
              <button key={c} onClick={() => handleSubmit(c)} disabled={busy}
                className="w-full rounded-lg bg-forest-700/60 py-2 text-sm text-forest-100 hover:bg-forest-600 disabled:opacity-60 ring-1 ring-forest-600/40">{c}</button>
            ))}
          </div>
        )}
        {(poll.answer_type === 'text' || poll.answer_type === 'number') && (
          <div className="flex gap-2">
            <input type={poll.answer_type === 'number' ? 'number' : 'text'} value={value} onChange={(e) => setValue(e.target.value)}
              placeholder={poll.answer_type === 'number' ? 'Zahl eingeben…' : 'Antwort eingeben…'}
              className="flex-1 rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <button onClick={() => handleSubmit(value)} disabled={busy || !value.trim()}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60">OK</button>
          </div>
        )}
      </div>
    </div>
  );
}
