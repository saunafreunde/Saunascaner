import { useEffect, useMemo, useState, useCallback } from 'react';
import { addDays, format, setHours, setMinutes, isBefore } from 'date-fns';
import { Link } from 'react-router-dom';
import { ATTRIBUTES, type InfusionAttribute } from '@/lib/attributes';
import { broadcastEvac } from '@/lib/evacuation';
import { sendEvacuationList, sendBadgeAnnouncement } from '@/lib/telegram';
import { checkAndAwardBadges } from '@/lib/checkBadges';
import type { BadgeDefinition } from '@/lib/badges';
import { PageBackground } from '@/components/PageBackground';
import CustomAttrCreator from '@/components/CustomAttrCreator';
import OilPicker from '@/components/OilPicker';
import { OIL_BY_ID, normalizeOilSlots } from '@/lib/oils';
import AchievementToast from '@/components/AchievementToast';
import { RatingForm } from '@/components/RatingForm';
import { MeisterRadarWidget } from '@/components/MeisterRadarWidget';
import { AdminQuickNav } from '@/components/AdminQuickNav';
import { Avatar } from '@/components/Avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HubZone } from '@/components/HubZone';
import { TodayLiveBento } from '@/components/TodayLiveBento';
import { AtelierTabs } from '@/components/AtelierTabs';
import { IdentityCard } from '@/components/IdentityCard';
import { TrophyWall } from '@/components/TrophyWall';
import { WmStandMini } from '@/components/WmStandMini';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import { fireBadgeUnlock, fireFirstInfusionOfDay } from '@/lib/confetti';
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
  useMyCustomAttrs,
  useRatableInfusions, type RatableInfusion,
  togglePresenceByCode, type MyPoll,
  sendBroadcastPush,
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
  // 09:00 bis 22:00 = 14 Slots
  return Array.from({ length: 14 }, (_, i) =>
    `${String(9 + i).padStart(2, '0')}:00`
  );
}

function slotToDate(day: 'today' | 'tomorrow', hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const base = day === 'tomorrow' ? addDays(new Date(), 1) : new Date();
  return setMinutes(setHours(base, h), m);
}

const DURATIONS = [10, 15, 20, 25, 30] as const;

function Card({ title, icon, children, className = '', accent }: {
  title?: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-b from-forest-950/80 to-forest-950/60 p-4 ring-1 ring-forest-800/50 backdrop-blur-md shadow-lg shadow-black/20 ${className}`}
      style={accent ? { boxShadow: `inset 0 1px 0 ${accent}33, 0 8px 24px rgba(0,0,0,0.25)` } : undefined}
    >
      {title && (
        <h2 className="flex items-center gap-2 text-[11px] font-semibold text-forest-300/80 uppercase tracking-[0.12em] mb-3">
          {icon && <span className="text-sm">{icon}</span>}
          <span>{title}</span>
        </h2>
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

  const [ratingFormInfusion, setRatingFormInfusion] = useState<RatableInfusion | null>(null);
  const [ratingToast, setRatingToast] = useState<string | null>(null);
  const [activePoll, setActivePoll] = useState<MyPoll | null>(null);

  const customAttrsQ = useMyCustomAttrs(isAufgieser ? m?.id : undefined);
  const ratableQ = useRatableInfusions(m?.is_present ? m?.id : undefined);
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
      // Streak-Badges checken nach Check-in
      if (r.is_present) {
        try {
          const badges = await checkAndAwardBadges(m.id);
          if (badges.length > 0) { setNewBadges(badges); setToastIndex(0); }
        } catch { /* ignore */ }
      }
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

  // ─── Aufguss-Formular ───────────────────────────────────────────────────
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [saunaId, setSaunaId] = useState<string>('');
  const [slot, setSlot] = useState<string>('15:00');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState<number>(15);
  const [attrs, setAttrs] = useState<InfusionAttribute[]>([]);
  const [oils, setOils] = useState<(string | null)[]>([null, null, null]);
  const [showOilPicker, setShowOilPicker] = useState(false);
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

  function applyTemplate(t: { title: string; description: string | null; duration_minutes: number; attributes: string[]; oils?: (string | null)[] | null }) {
    setTitle(t.title);
    setDescription(t.description ?? '');
    setDuration(t.duration_minutes);
    setAttrs(t.attributes as InfusionAttribute[]);
    setOils(normalizeOilSlots(t.oils));
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
        oils: oils.some(Boolean) ? oils : null,
      });
    } catch (e) { setFormError((e as Error).message); }
  }

  function clearForm() {
    setTitle('');
    setDescription('');
    setAttrs([]);
    setCustomAttrIds([]);
    setOils([null, null, null]);
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
        oils: oils.some(Boolean) ? oils : null,
        start_time: start.toISOString(),
        duration_minutes: duration,
        team_infusion: teamInfusion,
      });
      clearForm();
      // 🎉 Konfetti beim ersten eigenen Aufguss des Tages
      fireFirstInfusionOfDay(m.id).catch(() => {});
      // Badge-Check nach erfolgreichem Aufguss
      const displayName = m.sauna_name ?? m.name;
      const earned = await checkAndAwardBadges(m.id);
      if (earned.length > 0) {
        setNewBadges(earned);
        setToastIndex(0);
        fireBadgeUnlock().catch(() => {});
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
      // Push an alle Mitglieder mit Subscription (parallel)
      sendBroadcastPush({
        title: '🚨 EVAKUIERUNG',
        body: `Bitte sofort das Gebäude verlassen — ausgelöst von ${m.name}`,
        url: '/dashboard',
        tag: 'evacuation',
        requireInteraction: true,
      }).catch(() => { /* push ist optional */ });
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

  function getCoNames(infusionId: string): string[] {
    return (coAufgieserQ.data ?? []).filter((c) => c.infusion_id === infusionId).map((c) => c.member_name ?? '?');
  }

  function isJoined(infusionId: string): boolean {
    return (coAufgieserQ.data ?? []).some((c) => c.infusion_id === infusionId && c.member_id === m?.id);
  }

  const meisterName = (id: string | null) => (id && meisterDir.data?.find((x) => x.id === id)?.name) || '—';
  const evacuation = evacQ.data;
  const openPolls = (pollsQ.data ?? []).filter((p) => !p.my_answer);

  return (
    <PageBackground page="planner">
      {showAttrCreator && m && (
        <CustomAttrCreator memberId={m.id} onClose={() => { setShowAttrCreator(false); customAttrsQ.refetch(); }} />
      )}

      {showOilPicker && (
        <OilPicker selected={oils} onChange={setOils} onClose={() => setShowOilPicker(false)} />
      )}

      {newBadges.length > 0 && (
        <AchievementToast badges={newBadges} currentIndex={toastIndex} onClose={handleToastClose} />
      )}

      {activePoll && m && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setActivePoll(null)}
        >
          <div className="w-full max-w-md rounded-2xl bg-forest-950 ring-1 ring-amber-700/50 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">📋 Abfrage</span>
              <button onClick={() => setActivePoll(null)} className="text-forest-400 hover:text-slate-200 text-xl leading-none">✕</button>
            </div>
            <PollCard poll={activePoll} memberId={m.id} onAnswered={() => { pollsQ.refetch(); setActivePoll(null); }} />
          </div>
        </div>
      )}

      {ratingFormInfusion && m && (
        <RatingForm
          infusion={ratingFormInfusion}
          meisterName={meisterName(ratingFormInfusion.saunameister_id)}
          memberId={m.id}
          onClose={() => setRatingFormInfusion(null)}
          onSuccess={async () => {
            setRatingFormInfusion(null);
            setRatingToast('Danke für dein Feedback! 🙏');
            ratableQ.refetch();
            setTimeout(() => setRatingToast(null), 4000);
            if (m) {
              const badges = await checkAndAwardBadges(m.id);
              if (badges.length > 0) {
                setNewBadges(badges);
                setToastIndex(0);
                fireBadgeUnlock().catch(() => {});
              }
            }
          }}
        />
      )}

      {ratingToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-emerald-100 shadow-lg ring-1 ring-emerald-500/50">
          {ratingToast}
        </div>
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

      {/* Modern sticky glassmorphism header */}
      <header className="sticky top-0 z-30 border-b border-forest-800/40 bg-forest-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to={m ? `/profile/${m.id}` : '/planner'}
              title="Mein Profil"
              className="shrink-0 transition hover:opacity-90"
            >
              <Avatar
                name={m?.name ?? '?'}
                avatarPath={m?.avatar_path ?? null}
                size="sm"
                isAufgieser={!!m?.is_aufgieser}
              />
            </Link>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold text-forest-100 leading-tight truncate">
                {m ? `Hallo, ${m.name.split(' ')[0]}` : 'Interner Bereich'}
              </h1>
              {m && (
                <p className="text-[10px] sm:text-xs text-forest-400 truncate flex flex-wrap items-center gap-x-1.5">
                  <span>{fmtMemberNumber(m.member_number)}</span>
                  {m.is_aufgieser && <span className="text-amber-300">· Aufgieser</span>}
                  {isAdmin && <span className="text-violet-300">· Admin</span>}
                  {m.sauna_name && <span className="text-forest-200">· {m.sauna_name}</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle compact />
            {isAdmin ? (
              <AdminQuickNav variant="icons" />
            ) : (
              <>
                <Link to="/members" className="flex h-9 w-9 items-center justify-center rounded-lg text-base bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800 transition" title="Mitglieder-Galerie">
                  👥
                </Link>
                <Link to="/wm" className="flex h-9 w-9 items-center justify-center rounded-lg text-base bg-amber-900/40 text-amber-300 ring-1 ring-amber-700/40 hover:bg-amber-900/70 transition" title="WM-Tipspiel">
                  🏆
                </Link>
                <Link to="/dashboard" className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg text-base bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800 transition" title="Tafel">
                  📺
                </Link>
              </>
            )}
            <button
              onClick={() => signOut()}
              className="rounded-lg bg-forest-900/80 px-2.5 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900 transition"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      {evacToast && (
        <div className="border-b border-forest-800/40 bg-forest-950/70 px-4 py-2 text-xs text-forest-200">{evacToast}</div>
      )}

      {/* Modern Layout */}
      <div className="mx-auto max-w-7xl p-3 sm:p-4 lg:p-6 space-y-4">

        {/* ══ WM-TIPSPIEL Banner (sichtbar für ALLE) ═══════════════ */}
        {m && <WmStandMini memberId={m.id} />}

        {/* ══ HERO-ROW: Anwesenheit + Notfall ═══════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

          {isAufgieser && (
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
          )}
        </div>

        {/* ══ AUFGUSS-FORMULAR: Volle Breite ═══════════════════════ */}
        {isAufgieser && (
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

                <div>
                  <label className="text-xs text-forest-300">Ätherische Öle <span className="text-forest-400/60">— eines pro Runde (max. 3)</span></label>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {oils.map((id, i) => {
                      const o = id ? OIL_BY_ID[id] : null;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setShowOilPicker(true)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs ring-1 transition ${
                            o
                              ? 'bg-amber-900/40 ring-amber-400/40 text-amber-100 hover:bg-amber-900/60'
                              : 'bg-forest-900/60 ring-forest-800/50 text-forest-300 hover:bg-forest-900 border border-dashed border-forest-700/60'
                          }`}
                        >
                          <span className="font-bold tabular-nums opacity-80">{i + 1}.</span>
                          {o ? (
                            <>
                              <span className="rounded bg-amber-950/60 px-1 text-[10px] tabular-nums">#{o.number}</span>
                              <span aria-hidden>{o.emoji}</span>
                              <span>{o.name}</span>
                            </>
                          ) : (
                            <span>+ Öl wählen</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

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
        )}

        {/* ══ ZONE 1: Heute Live ══════════════════════════════════════════ */}
        <HubZone icon="🔥" title="Heute Live" subtitle="Was heute passiert" accent="#f59e0b">
          <TodayLiveBento
            memberId={m?.id ?? ""}
            isPresent={isPresent}
            isAdmin={isAdmin}
            infusions={infusions}
            saunas={saunas}
            meisterName={meisterName}
            now={new Date(nowTick)}
            presentMembers={(presentQ.data ?? []).map((p) => ({ id: p.id, name: p.name, is_aufgieser: p.is_aufgieser }))}
            openPolls={openPolls}
            onOpenPoll={(poll) => setActivePoll(poll)}
            onRate={(inf) => setRatingFormInfusion(inf)}
          />
        </HubZone>

        {/* ══ ZONE 2: Mein Aufguss-Atelier (nur Aufgieser) ═════════════════ */}
        {isAufgieser && (
          <HubZone icon="🧖" title="Mein Atelier" subtitle="Werkbank für Aufgüsse" accent="#22c55e">
            <AtelierTabs
              myInfusions={myInfusions}
              joinableTeamInfusions={joinableTeamInfusions}
              templates={myTemplates}
              saunas={saunas}
              meisterName={meisterName}
              getCoNames={getCoNames}
              isJoined={isJoined}
              onDeleteInfusion={(id) => delInf.mutate(id)}
              onJoinTeam={(id) => m && joinTeam.mutate({ infusion_id: id, member_id: m.id })}
              onLeaveTeam={(id) => m && leaveTeam.mutate({ infusion_id: id, member_id: m.id })}
              onApplyTemplate={(t) => applyTemplate(t)}
              onDeleteTemplate={(id) => delTpl.mutate(id)}
            />
          </HubZone>
        )}

        {/* ══ ZONE 3: Mein Profil & Erfolge ═════════════════════════════════ */}
        {m && (
          <HubZone icon="🏆" title="Mein Profil & Erfolge" subtitle="Identität · Bewertungen · Trophäen" accent="#a78bfa">
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-forest-950/60 ring-1 ring-violet-800/30 p-4">
                  <IdentityCard
                    member={m}
                    customAttrs={customAttrs}
                    onOpenAttrCreator={() => setShowAttrCreator(true)}
                  />
                </div>
                <div className="rounded-2xl bg-forest-950/60 ring-1 ring-violet-800/30 p-4">
                  <h3 className="flex items-center gap-2 text-[11px] font-bold text-violet-300/80 uppercase tracking-[0.12em] mb-2">
                    <span className="text-sm">📡</span><span>Meine Bewertungen</span>
                  </h3>
                  <MeisterRadarWidget memberId={m.id} size="lg" />
                </div>
              </div>

              <div className="rounded-2xl bg-forest-950/60 ring-1 ring-violet-800/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs">🔑</span>
                  <h3 className="text-[11px] font-bold text-violet-300/80 uppercase tracking-[0.12em]">Einlass-Code</h3>
                </div>
                <p className="text-xs text-forest-400 mb-2">Verwende diesen Code am Eingangs-Tablet statt QR-Scan.</p>
                {codeSaved && <p className="text-sm text-emerald-300 mb-2">✅ Code gespeichert.</p>}
                {!editingCode ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-forest-200 tabular-nums">
                      {m.entry_code ? '●●●●●●' : <span className="text-forest-300/50 italic">Nicht gesetzt</span>}
                    </span>
                    <button onClick={() => { setEditingCode(true); setCodeInput(''); setCodeError(null); }}
                      className="rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs text-violet-200 ring-1 ring-violet-500/30 hover:bg-violet-500/25">
                      {m.entry_code ? '✏️ Ändern' : '+ Code setzen'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input type="text" value={codeInput} onChange={(e) => setCodeInput(e.target.value)}
                      placeholder="4–8 Zeichen, z.B. sonne7" maxLength={8} autoFocus
                      className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-violet-700/30 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                    {codeError && <p className="text-xs text-rose-300">{codeError}</p>}
                    <div className="flex gap-2">
                      <button onClick={saveEntryCode} disabled={updateEntryCode.isPending}
                        className="flex-1 rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-violet-950 hover:bg-violet-400 disabled:opacity-60">
                        {updateEntryCode.isPending ? 'Speichere…' : 'Speichern'}
                      </button>
                      {m.entry_code && (
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
              </div>

              <div className="rounded-2xl bg-forest-950/60 ring-1 ring-violet-800/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs">🏅</span>
                  <h3 className="text-[11px] font-bold text-violet-300/80 uppercase tracking-[0.12em]">Auszeichnungen</h3>
                </div>
                <TrophyWall memberId={m.id} />
              </div>

              {/* PWA-Install (Android/iOS-Hinweis) */}
              <PWAInstallButton />
            </div>
          </HubZone>
        )}
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
