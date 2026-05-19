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
import { OIL_BY_ID, normalizeOilSlots, MAX_OIL_SLOTS } from '@/lib/oils';
import { generateInfusionTitle } from '@/lib/titleGenerator';
import { lookupMemberName } from '@/lib/memberDisplay';
import AchievementToast from '@/components/AchievementToast';
import { RatingForm } from '@/components/RatingForm';
import { MeisterRadarWidget } from '@/components/MeisterRadarWidget';
import { AdminQuickNav } from '@/components/AdminQuickNav';
import { MemberQuickNav } from '@/components/MemberQuickNav';
import { Avatar } from '@/components/Avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HubZone } from '@/components/HubZone';
import { TodayLiveBento } from '@/components/TodayLiveBento';
import { AtelierTabs } from '@/components/AtelierTabs';
import { IdentityCard } from '@/components/IdentityCard';
import { TrophyWall } from '@/components/TrophyWall';
import { WmStandMini } from '@/components/WmStandMini';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import { ProfileIntegrations } from '@/components/ProfileIntegrations';
import { fireBadgeUnlock, fireFirstInfusionOfDay } from '@/lib/confetti';
import { useAuth } from '@/hooks/useAuth';
import { useNow } from '@/hooks/useNow';
import {
  useSaunas, useInfusions, useTemplates,
  useAddInfusion, useDeleteInfusion,
  useAddTemplate, useDeleteTemplate,
  useCurrentMember, usePresentMembers,
  useActiveEvacuation, useTriggerEvacuation, useEndEvacuation,
  useCoAufgieser, useJoinTeamInfusion, useLeaveTeamInfusion,
  useMeisterDirectory,
  useMyPolls, useSubmitPollResponse, useUpdateEntryCode, checkEntryCodeAvailable,
  useMyCustomAttrs,
  useRatableInfusions, type RatableInfusion,
  togglePresenceByCode, type MyPoll,
  sendBroadcastPush,
  useMyRecurringSlots, useApplyRecurringSlot, useRevokeMyRecurringSlot,
  useAbsences, useAddAbsence, useDeleteAbsence,
  useTakeoverPersonalFallback, type Template,
  useScheduleSettings,
} from '@/lib/api';
import { garantieTemperatureFor, slotHoursForWeekday, WEEKDAY_LABEL_DE, WEEKDAY_LABEL_DE_SHORT } from '@/lib/garantie';
import { isStaff as isStaffHelper, isAufgieser as isAufgieserHelper, isAdmin as isAdminHelper, isGuestAufgieser as isGuestAufgieserHelper } from '@/lib/roles';
import { usePreviewMode } from '@/hooks/usePreviewMode';
import { PreviewBanner } from '@/components/PreviewBanner';
import type { RecurringSlot, AufgieserAbsence, Sauna, Infusion } from '@/types/database';

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

// Slot-Stunden via zentrale garantie.ts (Single Source of Truth).
// mondayOpen kommt aus schedule_settings (Migration 0083) — bei true
// werden auch am Montag Slots (11–20 wie Sa/So) angeboten.
function getAvailableSlots(forDate: Date, mondayOpen: boolean): string[] {
  return slotHoursForWeekday(forDate.getDay(), { mondayOpen }).map(
    (h) => `${String(h).padStart(2, '0')}:00`,
  );
}

function slotToDate(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return setMinutes(setHours(date, h), m);
}

// Hot-path-Formatter: `<saunaId>|YYYY-MM-DD HH:mm` ohne date-fns format()-Overhead.
// Wird bei ~120 Slots pro Render aufgerufen — date-fns format() ist hier zu teuer.
function infusionKey(saunaId: string, d: Date): string {
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const da = d.getDate();
  const h = d.getHours();
  const mn = d.getMinutes();
  return `${saunaId}|${y}-${mo < 10 ? '0' + mo : mo}-${da < 10 ? '0' + da : da} ${h < 10 ? '0' + h : h}:${mn < 10 ? '0' + mn : mn}`;
}

// Tagesansicht — keine Wochen-Helpers mehr benötigt (vorher weekDays/weekStartDate).

function isSameYMD(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const FIXED_DURATION_MIN = 15;

// Slot-Status pro (sauna, hhmm) für SlotMatrix
type SlotStatus =
  | { kind: 'past' }
  | { kind: 'free' }
  | { kind: 'fallback'; infusion: Infusion }   // Personal-Aufguss → übernehmbar
  | { kind: 'mine'; infusion: Infusion }       // eigener Aufguss
  | { kind: 'taken'; infusion: Infusion };     // anderer Aufgießer

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
  const scheduleQ = useScheduleSettings();
  const mondayOpen = !!scheduleQ.data?.monday_open;

  const addInf = useAddInfusion();
  const takeoverFallback = useTakeoverPersonalFallback();
  const delInf = useDeleteInfusion();
  const addTpl = useAddTemplate();
  const delTpl = useDeleteTemplate();
  const trigEvac = useTriggerEvacuation();
  const endEvac = useEndEvacuation();

  // Stamm-Slot + Urlaub (Migrationen 0027/0028)
  const myRecurringQ = useMyRecurringSlots(member.data?.id ?? null);
  const myAbsencesQ = useAbsences(member.data?.id ?? null);
  const applyRecurring = useApplyRecurringSlot();
  const revokeRecurring = useRevokeMyRecurringSlot();
  const addAbsence = useAddAbsence();
  const deleteAbsence = useDeleteAbsence();

  const teamInfusionIds = useMemo(
    () => infusionsQ.data?.filter((i) => i.team_infusion).map((i) => i.id) ?? [],
    [infusionsQ.data]
  );
  const coAufgieserQ = useCoAufgieser(teamInfusionIds);
  const joinTeam = useJoinTeamInfusion();
  const leaveTeam = useLeaveTeamInfusion();

  const m = member.data;
  // Kanonische Helper aus src/lib/roles.ts — bezieht Gast-Aufgießer + Admin ein
  const isAufgieserOrig = isAufgieserHelper(m);
  const isAdminOrig = isAdminHelper(m);
  const isStaffOrig = isStaffHelper(m);
  const isGuestAufgieserOrig = isGuestAufgieserHelper(m);

  // Admin-Preview-Modus: ?preview=<rolle> simuliert die Sicht eines normalen Users
  const { previewRole } = usePreviewMode();
  const isAufgieser = previewRole ? (previewRole === 'aufgieser' || previewRole === 'guest_aufgieser') : isAufgieserOrig;
  const isAdmin = previewRole ? false : isAdminOrig;
  const isStaff = previewRole ? (previewRole === 'staff') : isStaffOrig;
  const isGuestAufgieser = previewRole ? (previewRole === 'guest_aufgieser') : isGuestAufgieserOrig;
  // Stamm-Slot/Urlaub nur für VEREINS-Aufgießer (nicht Gast-Aufgießer, die helfen nur gelegentlich aus)
  const canApplyStammSlot = isAufgieser && !isGuestAufgieser;
  const now = useNow(60_000);

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
  // Live-Verfügbarkeits-Check (Migration 0025): debounced 300ms während Tippen
  type CodeStatus = 'idle' | 'tooShort' | 'checking' | 'available' | 'taken';
  const [codeStatus, setCodeStatus] = useState<CodeStatus>('idle');

  useEffect(() => {
    if (!editingCode) { setCodeStatus('idle'); return; }
    const trimmed = codeInput.trim();
    if (!trimmed) { setCodeStatus('idle'); return; }
    if (trimmed.length < 4 || trimmed.length > 8) { setCodeStatus('tooShort'); return; }
    setCodeStatus('checking');
    const handle = setTimeout(async () => {
      try {
        const free = await checkEntryCodeAvailable(trimmed);
        // Race-Guard: nur anwenden wenn der Input sich nicht weiter geändert hat
        setCodeInput((current) => {
          if (current.trim() === trimmed) setCodeStatus(free ? 'available' : 'taken');
          return current;
        });
      } catch {
        // Wenn Check fehlschlägt: idle (Server validiert beim Save final)
        setCodeStatus('idle');
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [codeInput, editingCode]);

  async function generateRandomCode() {
    // 4-stellige numerische PIN — bis zu 30 Versuche bis frei
    for (let i = 0; i < 30; i++) {
      const pin = String(Math.floor(1000 + Math.random() * 9000));
      try {
        if (await checkEntryCodeAvailable(pin)) {
          setCodeInput(pin);
          setCodeError(null);
          return;
        }
      } catch { /* nächster Versuch */ }
    }
    setCodeError('Konnte keinen freien Zufalls-PIN finden — bitte selbst wählen.');
  }

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
  // Rollen-basiertes Planungs-Fenster (in TAGEN):
  //   Admin: unbegrenzt (Cap ~6 Monate)
  //   Gast-Aufgießer: 4 Wochen voraus = 28 Tage
  //   Aufgießer/Staff: 2 Wochen voraus = 14 Tage
  const MAX_DAY_OFFSET = isAdmin ? 182 : isGuestAufgieser ? 28 : isStaff ? 0 : 14;

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0); return t;
  });
  const [saunaId, setSaunaId] = useState<string>('');
  const [slot, setSlot] = useState<string>('15:00');
  const [title, setTitle] = useState('');
  const [attrs, setAttrs] = useState<InfusionAttribute[]>([]);
  const [oils, setOils] = useState<(string | null)[]>(Array.from({ length: MAX_OIL_SLOTS }, () => null) as (string | null)[]);
  const [showOilPicker, setShowOilPicker] = useState(false);
  const [teamInfusion, setTeamInfusion] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [evacToast, setEvacToast] = useState<string | null>(null);

  useEffect(() => {
    if (!saunaId && saunas[0]) setSaunaId(saunas[0].id);
  }, [saunaId, saunas]);

  const todayDate = useMemo(() => { const t = new Date(); t.setHours(0,0,0,0); return t; }, []);
  // Tagesansicht: nur der selectedDate ist sichtbar (statt ganzer Woche).
  const visibleDays = useMemo(() => [selectedDate], [selectedDate]);

  // Tag-Offset (für Pager-Begrenzung + Anzeige). Negative Werte = Vergangenheit.
  const dayOffset = useMemo(() => {
    const diffMs = selectedDate.getTime() - todayDate.getTime();
    return Math.round(diffMs / (24 * 60 * 60 * 1000));
  }, [selectedDate, todayDate]);

  // Pager-Helper: 1 Tag vor/zurück; Mo überspringen falls nicht offen.
  function shiftDay(direction: -1 | 1) {
    let next = addDays(selectedDate, direction);
    // Skip-Mo wenn Toggle aus (nicht-planbarer Tag)
    if (next.getDay() === 1 && !mondayOpen) {
      next = addDays(next, direction);
    }
    // Begrenzungen: nicht in Vergangenheit, nicht über MAX_DAY_OFFSET
    const nextOffset = Math.round((next.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000));
    if (nextOffset < 0) return;
    if (nextOffset > MAX_DAY_OFFSET) return;
    setSelectedDate(next);
  }

  const infusionByKey = useMemo(() => {
    const map = new Map<string, Infusion>();
    for (const i of infusions) {
      map.set(infusionKey(i.sauna_id, new Date(i.start_time)), i);
    }
    return map;
  }, [infusions]);

  // Garantie-Status pro Tag (vorberechnet — wird sowohl im Matrix-Rendering
  // als auch in der Submit-Validierung verwendet)
  type DayContext = {
    date: Date;
    isMonday: boolean;
    isPast: boolean;
    availableSlots: string[];
    garantieSlotsOpen: { hour: number; saunaName: string; tempC: 80 | 100 }[];
  };

  const dayContextOf = useCallback((date: Date): DayContext => {
    const isMonday = date.getDay() === 1;
    const isMondayBlocked = isMonday && !mondayOpen; // mondayOpen aus schedule_settings
    const isPast = date.getTime() < todayDate.getTime();
    const availableSlots = getAvailableSlots(date, mondayOpen);
    const garantieSlotsOpen: DayContext['garantieSlotsOpen'] = [];
    if (!isMondayBlocked) {
      const weekday = date.getDay();
      for (const h of slotHoursForWeekday(weekday, { mondayOpen })) {
        const slotDate = setMinutes(setHours(date, h), 0);
        const tempC = garantieTemperatureFor(slotDate, { mondayOpen });
        if (tempC === null) continue;
        const garantieSauna = saunas.find((s) => s.temperature_label === `${tempC}°C` && s.is_active);
        if (!garantieSauna) continue;
        const inf = infusionByKey.get(infusionKey(garantieSauna.id, slotDate));
        const hasReal = inf && !inf.is_personal_fallback;
        if (!hasReal) garantieSlotsOpen.push({ hour: h, saunaName: garantieSauna.name, tempC });
      }
    }
    return { date, isMonday: isMondayBlocked, isPast, availableSlots, garantieSlotsOpen };
  }, [todayDate, saunas, infusionByKey, mondayOpen]);

  const slotStatusFor = useCallback((date: Date, saunaIdLookup: string, hhmm: string): SlotStatus => {
    const start = slotToDate(date, hhmm);
    if (isBefore(start, new Date())) return { kind: 'past' };
    const inf = infusionByKey.get(infusionKey(saunaIdLookup, start));
    if (!inf) return { kind: 'free' };
    if (inf.is_personal_fallback) return { kind: 'fallback', infusion: inf };
    if (inf.saunameister_id === m?.id) return { kind: 'mine', infusion: inf };
    return { kind: 'taken', infusion: inf };
  }, [infusionByKey, m?.id]);

  function getInfusionAt(date: Date, saunaIdLookup: string, hhmm: string): Infusion | undefined {
    return infusionByKey.get(infusionKey(saunaIdLookup, slotToDate(date, hhmm)));
  }

  // Wochen-Contexte einmal pro Render vorberechnen (6 Tage × ~10 Stunden Garantie-Logik)
  const visibleDayContexts = useMemo(
    () => visibleDays.map((d) => ({ date: d, ctx: dayContextOf(d) })),
    [visibleDays, dayContextOf]
  );
  // Selected-Day-Context — bevorzugt aus Wochen-Liste, sonst fallback
  const selectedDayCtx = useMemo(
    () => visibleDayContexts.find((x) => isSameYMD(x.date, selectedDate))?.ctx ?? dayContextOf(selectedDate),
    [visibleDayContexts, dayContextOf, selectedDate]
  );
  const isMondaySelected = selectedDayCtx.isMonday;

  // ID des aktuell gewählten Personal-Fallbacks (für Submit-Branch)
  const selectedFallbackId = useMemo(() => {
    const inf = getInfusionAt(selectedDate, saunaId, slot);
    return inf?.is_personal_fallback ? inf.id : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saunaId, slot, selectedDate, infusionByKey]);

  function isSlotTaken(hhmm: string) {
    const inf = getInfusionAt(selectedDate, saunaId, hhmm);
    if (!inf) return false;
    // Personal-Fallback ist NICHT "taken" — er ist übernehmbar
    return !inf.is_personal_fallback;
  }

  // ─── Garantie-Sperre: Sauna 2 erst, wenn alle Garantie-Slots des Tages
  // ─── durch echte Aufgießer (nicht Personal-Fallback) belegt sind.
  const isGarantieSauna = useMemo(() => {
    const start = slotToDate(selectedDate, slot);
    const temp = garantieTemperatureFor(start, { mondayOpen });
    if (temp === null) return false;
    const sauna = saunas.find((s) => s.id === saunaId);
    if (!sauna) return false;
    return sauna.temperature_label === `${temp}°C`;
  }, [selectedDate, slot, saunaId, saunas, mondayOpen]);

  const garantieSlotsOpenToday = selectedDayCtx.garantieSlotsOpen;
  const secondarySaunaBlocked = !isGarantieSauna && garantieSlotsOpenToday.length > 0;

  function toggleAttr(a: InfusionAttribute) {
    setAttrs((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  function applyTemplate(t: { title: string; description: string | null; duration_minutes: number; attributes: string[]; oils?: (string | null)[] | null }) {
    setTitle(t.title);
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
        description: null,
        duration_minutes: FIXED_DURATION_MIN,
        attributes: attrs,
        oils: oils.some(Boolean) ? oils : null,
      });
    } catch (e) { setFormError((e as Error).message); }
  }

  function clearForm() {
    setTitle('');
    setAttrs([]);
    setCustomAttrIds([]);
    setOils(Array.from({ length: MAX_OIL_SLOTS }, () => null) as (string | null)[]);
    setTeamInfusion(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!m) return setFormError('Bitte zuerst anmelden.');
    if (!saunaId) return setFormError('Bitte eine Sauna wählen.');
    if (!title.trim()) return setFormError('Titel fehlt.');
    if (isMondaySelected) return setFormError('Montag keine Aufgüsse.');

    const start = slotToDate(selectedDate, slot);
    if (isBefore(start, new Date())) return setFormError('Slot liegt in der Vergangenheit.');
    if (isSlotTaken(slot)) return setFormError('Slot bereits belegt.');
    // Staff darf NUR Personal-Fallbacks übernehmen
    if (isStaff && !selectedFallbackId) {
      return setFormError('Als Personal kannst du nur 👨‍🍳-Slots (Personal-Aufgüsse) übernehmen. Wähle einen gelben Slot in der Matrix.');
    }
    // Sperrregel gilt NICHT, wenn der gewählte Slot ein Personal-Fallback ist
    // (übernehmen bringt die Garantie-Sauna ja erst zum vollständigen Besetzt-Status)
    if (!selectedFallbackId && secondarySaunaBlocked) {
      const list = garantieSlotsOpenToday.map((g) => `${String(g.hour).padStart(2,'0')}:00 ${g.saunaName}`).join(', ');
      return setFormError(`⛔ Zuerst Garantie-Slots durch Aufgießer belegen. Offen: ${list}`);
    }

    try {
      if (selectedFallbackId) {
        await takeoverFallback.mutateAsync({
          infusion_id: selectedFallbackId,
          title: title.trim(),
          description: null,
          attributes: attrs,
          oils: oils.some(Boolean) ? oils : null,
          team_infusion: teamInfusion,
        });
      } else {
        await addInf.mutateAsync({
        sauna_id: saunaId,
        template_id: null,
        saunameister_id: m.id,
        title: title.trim(),
        description: null,
        attributes: attrs,
        oils: oils.some(Boolean) ? oils : null,
        start_time: start.toISOString(),
        duration_minutes: FIXED_DURATION_MIN,
        team_infusion: teamInfusion,
      });
      }
      // Push an alle Mitglieder wenn TEAM-Aufguss veröffentlicht
      if (teamInfusion) {
        const saunaLabel = saunas.find((s) => s.id === saunaId)?.name ?? '';
        const dayLabel = isSameYMD(selectedDate, todayDate)
          ? 'heute'
          : isSameYMD(selectedDate, addDays(todayDate, 1))
            ? 'morgen'
            : format(selectedDate, 'EEE dd.MM.');
        sendBroadcastPush({
          title: '👥 Neuer Team-Aufguss',
          body: `${m.name} sucht 2 Co-Aufgießer · ${title.trim()} · ${dayLabel} ${format(start, 'HH:mm')}${saunaLabel ? ' · ' + saunaLabel : ''}`,
          url: '/planner',
          tag: `team-aufguss-${start.toISOString()}`,
        }).catch(() => { /* push ist optional */ });
      }
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
    () => infusions
      .filter((i) => {
        // Personal-Fallbacks (Garantie-Aufgüsse vom Cron) NIE im Atelier
        // anzeigen — die sind System-Generierte Platzhalter, keine
        // geplanten Aufgüsse. Übernehmen läuft via Slot-Matrix oben.
        if (i.is_personal_fallback) return false;
        if (isAdmin) return true;
        if (i.saunameister_id === m?.id) return true;
        // Team-Aufgüsse anderer Meister sollen Aufgießern auch in 'Geplant'
        // angezeigt werden, damit sie beitreten können.
        if (i.team_infusion && i.saunameister_id !== m?.id) return true;
        return false;
      })
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time)),
    [infusions, m?.id, isAdmin]
  );

  function getCoNames(infusionId: string): string[] {
    return (coAufgieserQ.data ?? []).filter((c) => c.infusion_id === infusionId).map((c) => c.member_name ?? '?');
  }

  function isJoined(infusionId: string): boolean {
    return (coAufgieserQ.data ?? []).some((c) => c.infusion_id === infusionId && c.member_id === m?.id);
  }

  // Offene Team-Aufgüsse (fremd + zukünftig + noch nicht 2 Co-Aufgießer eingebucht)
  const openTeamInfusions = useMemo(
    () => infusions.filter((i) => {
      if (!i.team_infusion) return false;
      if (i.saunameister_id === m?.id) return false;
      if (new Date(i.end_time) <= new Date()) return false;
      const coCount = (coAufgieserQ.data ?? []).filter((c) => c.infusion_id === i.id).length;
      return coCount < 2;
    }),
    [infusions, m?.id, coAufgieserQ.data],
  );

  const meisterName = (id: string | null) => lookupMemberName(meisterDir.data, id, '—');
  const evacuation = evacQ.data;
  const openPolls = (pollsQ.data ?? []).filter((p) => !p.my_answer);

  return (
    <PageBackground page="planner">
      <PreviewBanner />
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
              <MemberQuickNav myMemberId={m?.id} />
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

          {/* Evakuierungs-Alarm: NUR Admins dürfen ihn hier auslösen.
              Aufgießer/Staff/Mitglieder lösen ihn am Öl-Tablet (/oil-room) aus. */}
          {isAdmin && (
            <div className="rounded-2xl border-2 border-rose-600/60 bg-rose-950/40 p-4 ring-1 ring-rose-500/30 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-rose-200">🚨 Notfall (Admin)</h2>
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

        {/* ══ OFFENE TEAM-AUFGÜSSE — Quick-Liste über der Eingabe ═══ */}
        {isAufgieser && openTeamInfusions.length > 0 && (
          <div className="rounded-2xl bg-amber-950/30 p-4 ring-1 ring-amber-500/30 backdrop-blur space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base">👥</span>
              <h2 className="text-sm font-semibold text-amber-100 uppercase tracking-wider">
                Offene Team-Plätze ({openTeamInfusions.length})
              </h2>
            </div>
            <p className="text-[11px] text-amber-200/70">Klick auf „Beitreten" um dich als Co-Aufgießer einzubuchen — max 2 pro Aufguss.</p>
            <ul className="space-y-1.5">
              {openTeamInfusions.map((i) => {
                const coCount = (coAufgieserQ.data ?? []).filter((c) => c.infusion_id === i.id).length;
                const meIn = isJoined(i.id);
                const accent = saunas.find((s) => s.id === i.sauna_id)?.accent_color ?? '#fbbf24';
                const saunaLabel = saunas.find((s) => s.id === i.sauna_id)?.name ?? '?';
                return (
                  <li
                    key={i.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-amber-950/40 px-3 py-2 ring-1 ring-amber-500/20"
                    style={{ borderLeft: `3px solid ${accent}` }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-amber-50 truncate">{i.title}</div>
                      <div className="text-[11px] text-amber-200/70">
                        {format(new Date(i.start_time), 'EEE HH:mm')} · {saunaLabel} · Meister: {meisterName(i.saunameister_id)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] font-bold text-amber-300/90 tabular-nums">{coCount}/2</span>
                      {meIn ? (
                        <button
                          onClick={() => m && leaveTeam.mutate({ infusion_id: i.id, member_id: m.id })}
                          className="rounded-md px-2.5 py-1 text-[11px] text-rose-200 hover:bg-rose-500/15 ring-1 ring-rose-500/30 whitespace-nowrap"
                        >
                          Verlassen
                        </button>
                      ) : (
                        <button
                          onClick={() => m && joinTeam.mutate(
                            { infusion_id: i.id, member_id: m.id },
                            { onError: (e) => window.alert((e as Error).message) },
                          )}
                          className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1 text-[11px] font-bold text-amber-950 whitespace-nowrap"
                        >
                          + Beitreten
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* ══ STAFF-HINWEIS: Personal-Aufgüsse übernehmen ═══════════ */}
        {isStaff && (
          <div className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-slate-500/30 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="text-3xl">👨‍🍳</span>
              <div>
                <h2 className="text-base font-bold text-slate-100">Hallo, Personal!</h2>
                <p className="mt-0.5 text-sm text-slate-300/80">
                  Du kannst Personal-Aufgüsse übernehmen — wähle einen 👨‍🍳-Slot in der Slot-Matrix unten und trage Titel/Eigenschaften ein.
                </p>
                <p className="mt-1.5 text-xs text-slate-400">
                  Du darfst außerdem: 🚨 Notfall-Alarm auslösen · 🏆 WM-Tipspiel mitspielen · 👥 Mitgliederübersicht einsehen.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ══ AUFGUSS-FORMULAR: Volle Breite (Aufgießer + Staff) ═══ */}
        {(isAufgieser || isStaff) && (
          <form onSubmit={submit} className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur space-y-4">
            <h2 className="text-sm font-semibold text-forest-100 uppercase tracking-wider">Neuen Aufguss eintragen</h2>

            {/* ── TAGES-PAGER ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-2 rounded-xl bg-forest-900/40 px-3 py-2 ring-1 ring-forest-800/40">
              <button
                type="button"
                onClick={() => shiftDay(-1)}
                disabled={dayOffset === 0}
                className="rounded-lg bg-forest-900/70 min-h-[44px] px-3.5 py-2 text-sm font-medium text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-900 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >◀ Tag</button>
              <div className="text-center">
                <div className="text-sm font-semibold text-forest-100">
                  {dayOffset === 0 ? 'Heute' : dayOffset === 1 ? 'Morgen' : `In ${dayOffset} Tagen`}
                </div>
                <div className="text-[11px] text-forest-400 tabular-nums">
                  {WEEKDAY_LABEL_DE[selectedDate.getDay()]}, {format(selectedDate, 'dd.MM.yyyy')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => shiftDay(1)}
                disabled={dayOffset >= MAX_DAY_OFFSET}
                title={dayOffset >= MAX_DAY_OFFSET ? `Maximal ${MAX_DAY_OFFSET} Tage im Voraus planen` : ''}
                className="rounded-lg bg-forest-900/70 min-h-[44px] px-3.5 py-2 text-sm font-medium text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-900 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >Tag ▶</button>
            </div>

            {/* ── LEGENDE ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-forest-400 px-1">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/70" /> frei</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/70" /> Personal — übernehmen</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500/70" /> belegt</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet-500/70" /> mein Aufguss</span>
            </div>

            {/* ── TAG ANZEIGE ────────────────────────────────────────── */}
            <div className="space-y-3">
              {visibleDayContexts.map(({ date: d, ctx }) => {
                const isSelected = isSameYMD(d, selectedDate);
                const isToday = isSameYMD(d, todayDate);
                const weekdayLabel = WEEKDAY_LABEL_DE[d.getDay()] ?? '';
                const secondaryBlockedForDay = ctx.garantieSlotsOpen.length > 0; // wird pro-Slot weiter verfeinert
                return (
                  <div
                    key={d.toISOString()}
                    className={`rounded-2xl p-3 ring-1 transition ${
                      isSelected
                        ? 'bg-forest-900/70 ring-forest-500/60 shadow-md shadow-forest-900/40'
                        : 'bg-forest-950/40 ring-forest-800/40'
                    }`}
                  >
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-sm font-bold ${isToday ? 'text-amber-200' : 'text-forest-100'}`}>
                          {weekdayLabel}
                        </span>
                        <span className="text-[11px] text-forest-400 tabular-nums">{format(d, 'dd.MM.')}</span>
                        {isToday && <span className="text-[9px] uppercase tracking-wider text-amber-300/80">heute</span>}
                      </div>
                      {ctx.isPast && !isToday && (
                        <span className="text-[10px] text-forest-500">vergangen</span>
                      )}
                    </div>

                    {ctx.isMonday ? (
                      <div className="rounded-lg bg-forest-900/40 px-3 py-3 text-center text-[11px] text-forest-400/70 ring-1 ring-forest-800/30">
                        Montag — Ruhetag, keine Aufgüsse
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {saunas.filter((s) => s.is_active).map((s) => (
                          <SaunaSlotRow
                            key={s.id}
                            sauna={s}
                            slots={ctx.availableSlots}
                            selectedSaunaId={isSelected ? saunaId : ''}
                            selectedSlot={isSelected ? slot : ''}
                            slotStatus={(saunaIdLookup, hhmm) => slotStatusFor(d, saunaIdLookup, hhmm)}
                            secondarySaunaBlocked={secondaryBlockedForDay}
                            garantieSlotsOpenToday={ctx.garantieSlotsOpen}
                            onPick={(picked) => {
                              setSelectedDate(d);
                              setSaunaId(s.id);
                              setSlot(picked);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {isMondaySelected ? (
              <div className="rounded-xl bg-forest-900/60 px-4 py-3 text-center text-forest-300/70 ring-1 ring-forest-800/40 text-xs">
                Bitte zuerst einen Slot in der Wochen-Übersicht oben wählen — Montag ist Ruhetag.
              </div>
            ) : (
              <>
                {selectedFallbackId && (
                  <div className="rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/30">
                    <p className="font-semibold">🔄 Du übernimmst einen Personal-Aufguss.</p>
                    <p className="mt-0.5 text-amber-200/80">
                      Trage deinen Titel/Eigenschaften/Öle unten ein — der Standard-Personal-Aufguss wird durch deinen ersetzt.
                    </p>
                  </div>
                )}

                {!selectedFallbackId && secondarySaunaBlocked && (
                  <div className="rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/30">
                    <p className="font-semibold">⛔ Zweit-Sauna-Planung gesperrt.</p>
                    <p className="mt-0.5 text-amber-200/80">
                      Solange in der „dran"-Sauna noch Personal-Aufgüsse stehen, kann in der anderen Sauna nicht zusätzlich geplant werden. Erst die gelben Slots oben übernehmen.
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-forest-300">Titel</label>
                    <button
                      type="button"
                      onClick={() => {
                        const validOils = oils.filter((o): o is string => !!o);
                        const suggestion = generateInfusionTitle(attrs, validOils);
                        setTitle(suggestion);
                      }}
                      disabled={attrs.length === 0 && oils.every((o) => !o)}
                      title="Erstellt einen Titel-Vorschlag basierend auf den ausgewählten Eigenschaften und Ölen. Mehrfach klicken = anderer Vorschlag."
                      className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      ✨ Vorschlagen
                    </button>
                  </div>
                  <input value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="z.B. Eukalyptus klassisch"
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
                  <button type="submit" disabled={addInf.isPending || takeoverFallback.isPending}
                    className="flex-1 rounded-xl bg-forest-500 px-4 py-3 text-sm font-semibold text-forest-950 hover:bg-forest-400 transition disabled:opacity-60">
                    {addInf.isPending || takeoverFallback.isPending
                      ? 'Speichere …'
                      : selectedFallbackId
                        ? '🔄 Personal-Aufguss übernehmen'
                        : 'Aufguss eintragen'}
                  </button>
                  {!isStaff && (
                    <button type="button" onClick={saveAsTemplate} disabled={addTpl.isPending}
                      className="rounded-xl bg-forest-900/70 px-3 py-2.5 text-xs font-medium text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-900 transition disabled:opacity-60">
                      Als Vorlage
                    </button>
                  )}
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
              myMemberId={m?.id}
              templates={myTemplates}
              saunas={saunas}
              meisterName={meisterName}
              getCoNames={getCoNames}
              isJoined={isJoined}
              onDeleteInfusion={(id) => delInf.mutate(id, {
                onError: (e) => window.alert((e as Error).message),
              })}
              onJoinTeam={(id) => m && joinTeam.mutate(
                { infusion_id: id, member_id: m.id },
                { onError: (e) => window.alert((e as Error).message) },
              )}
              onLeaveTeam={(id) => m && leaveTeam.mutate({ infusion_id: id, member_id: m.id })}
              onApplyTemplate={(t) => applyTemplate(t)}
              onDeleteTemplate={(id) => delTpl.mutate(id)}
              isAdmin={isAdmin}
              now={now}
            />
          </HubZone>
        )}

        {/* ══ ZONE 2.5: Stamm-Slot & Urlaub (nur Vereins-Aufgießer, NICHT Gast-Aufgießer) ═════════════════ */}
        {canApplyStammSlot && m && (
          <HubZone icon="📅" title="Stamm-Slot & Urlaub" subtitle="Feste Wochenslots beantragen · Abwesenheit eintragen" accent="#fbbf24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <StammSlotPanel
                slots={myRecurringQ.data ?? []}
                saunas={saunas}
                templates={myTemplates}
                onApply={async (p) => {
                  try {
                    await applyRecurring.mutateAsync(p);
                    const saunaName = saunas.find((s) => s.id === p.sauna_id)?.name ?? '?';
                    sendBroadcastPush({
                      title: '🔔 Neuer Stamm-Slot-Antrag',
                      body: `${m.name} möchte ${WEEKDAY_LABEL_DE[p.weekday] ?? '?'} ${String(p.hour).padStart(2,'0')}:00 ${saunaName}`,
                      url: '/admin',
                      tag: 'recurring-slot-apply',
                    }).catch(() => {});
                  } catch (e) {
                    window.alert((e as Error).message);
                  }
                }}
                onRevoke={async (id) => {
                  if (!confirm('Stamm-Slot wirklich kündigen?')) return;
                  try { await revokeRecurring.mutateAsync(id); }
                  catch (e) { window.alert((e as Error).message); }
                }}
              />
              <AbsencePanel
                absences={myAbsencesQ.data ?? []}
                onAdd={async (p) => {
                  try {
                    const result = await addAbsence.mutateAsync(p);
                    if (result.freed_slots.length > 0) {
                      const list = result.freed_slots.slice(0, 5).map((s) =>
                        `${format(new Date(s.start_time), 'EEE dd.MM. HH:mm')} ${s.sauna_name}`
                      ).join(' · ');
                      sendBroadcastPush({
                        title: '🏖️ Urlaubsslots frei',
                        body: `${m.name} ist im Urlaub — ${result.freed_slots.length} Slot${result.freed_slots.length === 1 ? '' : 's'} verfügbar: ${list}${result.freed_slots.length > 5 ? '…' : ''}`,
                        url: '/planner',
                        tag: 'urlaubsslots',
                      }).catch(() => {});
                      window.alert(`${result.freed_slots.length} Slot${result.freed_slots.length === 1 ? '' : 's'} freigegeben — andere Aufgießer wurden benachrichtigt.`);
                    } else {
                      window.alert('Urlaub eingetragen. Keine Stamm-Slots in diesem Zeitraum betroffen.');
                    }
                  } catch (e) { window.alert((e as Error).message); }
                }}
                onDelete={async (id) => {
                  if (!confirm('Urlaubseintrag löschen?')) return;
                  try { await deleteAbsence.mutateAsync(id); }
                  catch (e) { window.alert((e as Error).message); }
                }}
              />
            </div>
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
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value)}
                        placeholder="4–8 Zeichen, z.B. sonne7"
                        maxLength={8}
                        autoFocus
                        className={`flex-1 rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 focus:outline-none focus:ring-2 transition-colors ${
                          codeStatus === 'taken'     ? 'ring-rose-500/50 focus:ring-rose-400'
                          : codeStatus === 'available' ? 'ring-emerald-500/50 focus:ring-emerald-400'
                          : 'ring-violet-700/30 focus:ring-violet-400'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={generateRandomCode}
                        title="Zufalls-PIN generieren (4-stellig, garantiert frei)"
                        className="rounded-lg bg-violet-500/15 px-3 py-2 text-sm text-violet-200 ring-1 ring-violet-500/30 hover:bg-violet-500/25 whitespace-nowrap"
                      >
                        🎲
                      </button>
                    </div>

                    {/* Live-Status-Zeile */}
                    {codeStatus === 'checking' && (
                      <p className="text-xs text-forest-300/70 flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-forest-400 animate-pulse" />
                        Prüfe Verfügbarkeit…
                      </p>
                    )}
                    {codeStatus === 'available' && (
                      <p className="text-xs text-emerald-300 flex items-center gap-1.5">
                        <span>✓</span> Code ist verfügbar
                      </p>
                    )}
                    {codeStatus === 'taken' && (
                      <p className="text-xs text-rose-300 flex items-center gap-1.5">
                        <span>✕</span> Dieser Code ist bereits vergeben — bitte einen anderen wählen
                      </p>
                    )}
                    {codeStatus === 'tooShort' && codeInput.trim() && (
                      <p className="text-xs text-amber-300/80 flex items-center gap-1.5">
                        <span>⚠</span> Code muss 4–8 Zeichen lang sein
                      </p>
                    )}
                    {codeError && <p className="text-xs text-rose-300">{codeError}</p>}

                    <div className="flex gap-2">
                      <button
                        onClick={saveEntryCode}
                        disabled={
                          updateEntryCode.isPending
                          || codeStatus === 'taken'
                          || codeStatus === 'tooShort'
                          || codeStatus === 'checking'
                        }
                        className="flex-1 rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-violet-950 hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
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

              {/* Kalender-Abo + Telegram-Verknüpfung */}
              <ProfileIntegrations member={m} />

              {/* PWA-Install (Android/iOS-Hinweis) */}
              <PWAInstallButton />
            </div>
          </HubZone>
        )}
      </div>
    </PageBackground>
  );
}

// ─── Sauna-Slot-Zeile (Matrix-Layout) ─────────────────────────────────────────

function SaunaSlotRow({
  sauna,
  slots,
  selectedSaunaId,
  selectedSlot,
  slotStatus,
  secondarySaunaBlocked,
  garantieSlotsOpenToday,
  onPick,
}: {
  sauna: Sauna;
  slots: string[];
  selectedSaunaId: string;
  selectedSlot: string;
  slotStatus: (saunaId: string, hhmm: string) => SlotStatus;
  secondarySaunaBlocked: boolean;
  garantieSlotsOpenToday: { hour: number; saunaName: string; tempC: 80 | 100 }[];
  onPick: (hhmm: string) => void;
}) {
  return (
    <div className="rounded-xl bg-forest-900/40 p-2 ring-1 ring-forest-800/40">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: sauna.accent_color, boxShadow: `0 0 6px ${sauna.accent_color}` }}
        />
        <span className="text-xs font-bold text-forest-100 tracking-wide">{sauna.name}</span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-mono"
          style={{ background: `${sauna.accent_color}22`, color: sauna.accent_color }}
        >
          {sauna.temperature_label}
        </span>
      </div>
      <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 lg:grid-cols-10 gap-1.5">
        {slots.map((hhmm) => {
          const hour = Number(hhmm.split(':')[0]);
          const status = slotStatus(sauna.id, hhmm);
          const isSelected = selectedSaunaId === sauna.id && selectedSlot === hhmm;
          // Ist diese Sauna die Garantie-Sauna für diesen Slot?
          const isGarantieSauna = garantieSlotsOpenToday.some((g) => g.hour === hour && g.saunaName === sauna.name);
          // Ist Klick in der Zweit-Sauna blockiert? Nur wenn nicht Garantie-Sauna und nicht Fallback (Fallback ist übernehmbar)
          const blockedBySecondary = secondarySaunaBlocked && !isGarantieSauna && status.kind === 'free';

          let bg = 'bg-forest-950/40';
          let text = 'text-forest-200';
          let ring = 'ring-forest-800/40';
          let label: React.ReactNode = hhmm;
          let extra: React.ReactNode = null;
          let disabled = false;
          let title = '';

          if (status.kind === 'past') {
            bg = 'bg-forest-950/30'; text = 'text-forest-300/30'; ring = 'ring-forest-900/30';
            disabled = true; title = 'Vergangenheit';
          } else if (status.kind === 'taken') {
            bg = 'bg-rose-500/15'; text = 'text-rose-200/80'; ring = 'ring-rose-500/30';
            disabled = true; title = `Belegt — ${status.infusion.title}`;
            extra = <span className="absolute -bottom-0.5 right-0.5 text-[8px] text-rose-300/80">🧖</span>;
          } else if (status.kind === 'mine') {
            bg = 'bg-violet-500/20'; text = 'text-violet-100'; ring = 'ring-violet-500/40';
            disabled = true; title = `Dein Aufguss — ${status.infusion.title}`;
            extra = <span className="absolute -bottom-0.5 right-0.5 text-[8px] text-violet-300">✓</span>;
          } else if (status.kind === 'fallback') {
            bg = 'bg-amber-500/20'; text = 'text-amber-100'; ring = 'ring-amber-500/40';
            title = 'Personal-Aufguss übernehmen';
            extra = <span className="absolute -bottom-0.5 right-0.5 text-[8px]">👨‍🍳</span>;
          } else if (status.kind === 'free') {
            if (blockedBySecondary) {
              bg = 'bg-forest-950/40'; text = 'text-forest-300/40'; ring = 'ring-forest-800/30';
              disabled = true; title = 'Erst Garantie-Slots übernehmen';
            } else {
              bg = 'bg-emerald-500/15'; text = 'text-emerald-100'; ring = 'ring-emerald-500/30';
              title = 'Frei — neuer Aufguss';
            }
          }

          if (isSelected) {
            bg = 'bg-forest-500';
            text = 'text-forest-950';
            ring = 'ring-forest-400 ring-2';
          }

          return (
            <button
              key={hhmm}
              type="button"
              disabled={disabled}
              onClick={() => onPick(hhmm)}
              title={title}
              className={`relative rounded-lg min-h-[44px] px-2 py-2 text-sm lg:text-xs font-mono tabular-nums ring-1 transition ${bg} ${text} ${ring} ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:brightness-125 active:scale-95'} ${isSelected ? 'font-bold' : ''}`}
            >
              {label}
              {extra}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stamm-Slot Panel ─────────────────────────────────────────────────────────

function StammSlotPanel({
  slots,
  saunas,
  templates,
  onApply,
  onRevoke,
}: {
  slots: RecurringSlot[];
  saunas: Sauna[];
  templates: Template[];
  onApply: (p: { weekday: number; hour: number; sauna_id: string; note?: string | null; template_id?: string | null }) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
}) {
  const activeSaunas = useMemo(() => saunas.filter((s) => s.is_active), [saunas]);
  const [weekday, setWeekday] = useState<number>(2);
  const [hour, setHour] = useState<number>(18);
  const [saunaId, setSaunaId] = useState<string>(activeSaunas[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [templateId, setTemplateId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!saunaId && activeSaunas[0]) setSaunaId(activeSaunas[0].id);
  }, [saunaId, activeSaunas]);

  const sched = useScheduleSettings();
  const slotHours = slotHoursForWeekday(weekday, { mondayOpen: !!sched.data?.monday_open });
  useEffect(() => {
    if (slotHours.length > 0 && !slotHours.includes(hour)) {
      setHour(slotHours[Math.floor(slotHours.length / 2)] ?? slotHours[0]);
    }
  }, [weekday, slotHours, hour]);

  async function submit() {
    setBusy(true);
    try {
      await onApply({
        weekday, hour, sauna_id: saunaId,
        note: note.trim() || null,
        template_id: templateId || null,
      });
      setNote('');
      setTemplateId('');
    } finally { setBusy(false); }
  }

  const statusColor = (s: RecurringSlot['status']) =>
    s === 'pending' ? 'bg-amber-500/20 text-amber-200 ring-amber-500/30'
    : s === 'active' ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/30'
    : 'bg-zinc-500/20 text-zinc-300 ring-zinc-500/30';
  const statusLabel = (s: RecurringSlot['status']) =>
    s === 'pending' ? 'wartet auf Freigabe' : s === 'active' ? 'aktiv' : 'gekündigt';

  return (
    <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-amber-700/30 backdrop-blur space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">🪵</span>
        <h3 className="text-sm font-semibold text-amber-100 uppercase tracking-wider">Mein Stamm-Slot</h3>
      </div>
      <p className="text-[11px] text-forest-300/70">
        Feste wöchentliche Aufgusszeit beantragen. Admin gibt frei. Andere Aufgießer können dann nicht in diesen Slot planen.
      </p>

      {slots.length > 0 && (
        <ul className="space-y-1.5">
          {slots.map((s) => {
            const saunaName = saunas.find((x) => x.id === s.sauna_id)?.name ?? '?';
            const tplName = templates.find((t) => t.id === s.template_id)?.title;
            return (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-forest-900/50 px-3 py-2 ring-1 ring-forest-800/40">
                <div className="min-w-0">
                  <div className="text-sm text-amber-100">
                    {WEEKDAY_LABEL_DE_SHORT[s.weekday]} {String(s.slot_hour).padStart(2,'0')}:00 · {saunaName}
                    {tplName && <span className="ml-1.5 text-[10px] text-emerald-300/80">📋 {tplName}</span>}
                  </div>
                  <div className="text-[10px] text-forest-400 truncate">{s.note || '—'}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ${statusColor(s.status)}`}>
                    {statusLabel(s.status)}
                  </span>
                  {s.status !== 'revoked' && (
                    <button onClick={() => onRevoke(s.id)}
                      className="rounded-md px-2 py-0.5 text-[10px] text-rose-200 ring-1 ring-rose-500/30 hover:bg-rose-500/15">
                      Kündigen
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-2 border-t border-forest-800/40 pt-3">
        <p className="text-[11px] font-semibold text-amber-200 uppercase tracking-wider">Neuen Stamm-Slot beantragen</p>
        <div>
          <label className="text-[10px] text-forest-300">Wochentag</label>
          <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}
            className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400">
            {(sched.data?.monday_open ? [1,2,3,4,5,6,0] : [2,3,4,5,6,0]).map((d) => (
              <option key={d} value={d}>{WEEKDAY_LABEL_DE[d]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-forest-300">Stunde</label>
          <div className="mt-1 grid grid-cols-5 gap-1">
            {slotHours.map((h) => (
              <button key={h} type="button" onClick={() => setHour(h)}
                className={`rounded-md px-1 py-1.5 text-xs font-mono tabular-nums ring-1 transition ${
                  hour === h
                    ? 'bg-amber-500 text-amber-950 ring-amber-400 font-bold'
                    : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                }`}>
                {String(h).padStart(2,'0')}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] text-forest-300">Sauna</label>
          <select value={saunaId} onChange={(e) => setSaunaId(e.target.value)}
            className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400">
            {activeSaunas.map((s) => (
              <option key={s.id} value={s.id}>{s.name} · {s.temperature_label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-forest-300">
            Vorlage (optional)
            {templates.length === 0 && <span className="text-forest-400/60"> — keine vorhanden, du kannst eine im Atelier anlegen</span>}
          </label>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={templates.length === 0}
            className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50">
            <option value="">— keine Vorlage (Standard „Stamm-Aufguss") —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          {templateId && (
            <p className="mt-1 text-[10px] text-emerald-300/70">
              ✓ Diese Vorlage wird bei jedem Stamm-Aufguss automatisch übernommen (Titel, Eigenschaften, Öle).
            </p>
          )}
        </div>
        <div>
          <label className="text-[10px] text-forest-300">Begründung / Notiz (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200}
            placeholder="z.B. „mein Stamm-Slot seit 5 Jahren"
            className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <button onClick={submit} disabled={busy || !saunaId}
          className="w-full rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-2 text-sm font-semibold text-amber-950 disabled:opacity-50">
          {busy ? 'Beantrage…' : 'Antrag stellen'}
        </button>
      </div>
    </div>
  );
}

// ─── Absence (Urlaub) Panel ──────────────────────────────────────────────────

function AbsencePanel({
  absences,
  onAdd,
  onDelete,
}: {
  absences: AufgieserAbsence[];
  onAdd: (p: { start: string; end: string; note?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!start || !end) return;
    setBusy(true);
    try {
      await onAdd({ start, end, note: note.trim() || null });
      setNote('');
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-amber-700/30 backdrop-blur space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">🏖️</span>
        <h3 className="text-sm font-semibold text-amber-100 uppercase tracking-wider">Meine Abwesenheit</h3>
      </div>
      <p className="text-[11px] text-forest-300/70">
        Urlaub eintragen. Deine Stamm-Slot-Aufgüsse in diesem Zeitraum werden automatisch freigegeben — Push geht an alle anderen Aufgießer.
      </p>

      {absences.length > 0 && (
        <ul className="space-y-1.5">
          {absences.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-forest-900/50 px-3 py-2 ring-1 ring-forest-800/40">
              <div className="min-w-0">
                <div className="text-sm text-amber-100 tabular-nums">
                  {format(new Date(a.start_date), 'dd.MM.yyyy')} – {format(new Date(a.end_date), 'dd.MM.yyyy')}
                </div>
                <div className="text-[10px] text-forest-400 truncate">{a.note || '—'}</div>
              </div>
              <button onClick={() => onDelete(a.id)}
                className="rounded-md px-2 py-0.5 text-[10px] text-rose-200 ring-1 ring-rose-500/30 hover:bg-rose-500/15">
                Löschen
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 border-t border-forest-800/40 pt-3">
        <p className="text-[11px] font-semibold text-amber-200 uppercase tracking-wider">Neue Abwesenheit</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-forest-300">Von</label>
            <input type="date" value={start} min={today} onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="text-[10px] text-forest-300">Bis</label>
            <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)}
              className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-forest-300">Notiz (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200}
            placeholder="z.B. „Urlaub Ostsee"
            className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <button onClick={submit} disabled={busy}
          className="w-full rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-2 text-sm font-semibold text-amber-950 disabled:opacity-50">
          {busy ? 'Speichere…' : 'Abwesenheit speichern'}
        </button>
      </div>
    </div>
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
