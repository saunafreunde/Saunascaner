import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { addDays, format, setHours, setMinutes, isBefore } from 'date-fns';
import { de } from 'date-fns/locale';
import { Link, useLocation } from 'react-router-dom';
import { UnvollstaendigeAufguesse } from '@/components/UnvollstaendigeAufguesse';
import { EditInfusionModal } from '@/components/EditInfusionModal';
// Saunafest (0163/0164): eigener Bereich statt Bewerben im Tagesplaner, und
// die Angaben je Fest-Aufguss (ohne Pflichtfelder) statt EditInfusionModal.
import { SaunafestZone } from '@/components/saunafest/SaunafestZone';
import { FestAufgussInfoDialog } from '@/components/saunafest/FestAufgussInfoDialog';
import { BanjaAlarm, istBanjaSperre, banjaGrund } from '@/components/BanjaAlarm';
import { meldeBanjaVersuch } from '@/lib/api';
import { banjaDauerFuer, banjaEndetRechtzeitig, BANJA_RUHE_STUNDEN, BANJA_SCHLUSS_HINWEIS } from '@/lib/banja';
import { ATTR_BY_ID, type InfusionAttribute } from '@/lib/attributes';
import { broadcastEvac } from '@/lib/evacuation';
import { sendEvacuationList, sendBadgeAnnouncement, versandMeldung } from '@/lib/telegram';
import { checkAndAwardBadges } from '@/lib/checkBadges';
import type { BadgeDefinition } from '@/lib/badges';
import { PageBackground } from '@/components/PageBackground';
import CustomAttrCreator from '@/components/CustomAttrCreator';
import OilPicker from '@/components/OilPicker';
import { OIL_BY_ID, normalizeOilSlots, MAX_OIL_SLOTS, parseCustomOilId } from '@/lib/oils';
import { SCHNAPS, SCHNAPS_BY_ID, parseSchnapsAttr } from '@/lib/schnaps';
import { RAEUCHER_ATTR, RAEUCHER_THEME, KRAEUTER_ATTR } from '@/lib/aufgussTheme';
import { KraeuterSchalter } from '@/components/KraeuterSchalter';
import { SudPicker } from '@/components/SudPicker';
// Das Kontingent und die Zerlegung liegen seit 14.08.2026 in einer eigenen
// Datei, damit der Öl-Raum-Kiosk dieselben Regeln benutzt statt einer Kopie.
import {
  MAX_AUSWAHL, VOLL_HINWEIS, ATTRIBUTE_CHIPS,
  PFLICHT_OELE, PFLICHT_BESONDERHEITEN, fehltNoch,
  auswahlAnzahl as zaehleAuswahl, attrsPayload as baueAttrsPayload,
  zerlegeAttributes, pruefeAuswahl, kraeuterUmschalten, type ZutatenAuswahl,
} from '@/lib/aufgussRegeln';
import { TitleSuggestionPicker } from '@/components/TitleSuggestionPicker';
import { zutatenAus } from '@/lib/titelZutaten';
import { lookupMemberName } from '@/lib/memberDisplay';
import { berlinYmd } from '@/lib/time';
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
  useMyCustomAttrs, useMyCustomOils, useSudKraeuter, useSudMixe,
  useRatableInfusions, type RatableInfusion,
  setMyPresence, type MyPoll,
  sendVorlagePush,
  useMyRecurringSlots, useApplyRecurringSlot, useRevokeMyRecurringSlot,
  useAbsences, useAddAbsence, useDeleteAbsence,
  useTakeoverPersonalFallback, useBookBanjaRitual, type Template,
  useScheduleSettings,
  useHolidaySet, isHolidayDate,
  useSaunafestTage, saunafestAm, type SaunafestTag,
} from '@/lib/api';
import { garantieTemperatureFor, garantieTemperatureForWeekdayHour, slotHoursForWeekday, WEEKDAY_LABEL_DE, WEEKDAY_LABEL_DE_SHORT } from '@/lib/garantie';
import { absageHinweis } from '@/lib/absage';
import { festSlots, festSlotOffen, festSaunenUm, festAblaufText, type FestSlot } from '@/lib/saunafestPlan';
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
function getAvailableSlots(
  forDate: Date, mondayOpen: boolean, isHoliday: boolean = false, plan: FestSlot[] | null = null,
): string[] {
  // Saunafest (0152): das Raster kommt aus dem Plan — halbe Stunden, 10:30 … 23:30.
  if (plan) return plan.map((s) => s.zeit);
  return slotHoursForWeekday(forDate.getDay(), { mondayOpen, isHoliday }).map(
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

// Aufguss-Dauer: User-Wunsch — Default 20 Min, Auswahl 20/30/45.
// Wenn ein bestehender Aufguss eine andere Dauer hat (z.B. Alt-Daten mit
// 15 Min), wird die im Select dynamisch ergänzt damit der Wert weiter
// gespeichert wird ohne Verlust.
const DEFAULT_DURATION_MIN = 20;
const DURATION_OPTIONS = [20, 30, 45, 90, 120] as const;

// Banja-Ritual: langes Dampfritual, Marker = 'banja' im attributes-Array.
// Dauer (90 Min um 19 Uhr, sonst 120), Betriebsschluss 20:30 und Ruhestunde
// stehen in lib/banja.ts — dieselbe Regel nutzt der Bearbeiten-Dialog.
// Gespiegelt in DB: validate_infusion_banja_and_overlap() + book_banja_ritual().
const RUHE_MS = BANJA_RUHE_STUNDEN * 60 * 60 * 1000;
const BANJA_ATTR: InfusionAttribute = 'banja';
const BANJA_TITLE_DEFAULT = '♨️ Traditionelles Banja-Ritual';

function isBanjaInfusion(inf: { attributes?: string[] | null; duration_minutes?: number } | null | undefined): boolean {
  return !!inf && Array.isArray(inf.attributes) && inf.attributes.includes(BANJA_ATTR);
}

// Saunafest (0163): am Festtag bucht im Tagesplaner nur der Admin. Dieselbe
// Meldung steht als Hinweiskarte über der Matrix und im Absende-Schutz.
const FEST_NICHT_BUCHEN = '🔥 Saunafest — hier wird nicht gebucht. Trag im Bereich „Saunafest“ ein, wann du Zeit hast; der Admin teilt ein.';

// Slot-Status pro (sauna, hhmm) für SlotMatrix
type SlotStatus =
  | { kind: 'past' }
  | { kind: 'free' }
  | { kind: 'fallback'; infusion: Infusion }   // Personal-Aufguss → übernehmbar
  | { kind: 'mine'; infusion: Infusion }       // eigener Aufguss
  | { kind: 'taken'; infusion: Infusion }      // anderer Aufgießer
  // Ein laengerer Aufguss laeuft in diese Stunde hinein — betrifft vor allem
  // das zweistuendige Banja-Ritual. Vorher fehlte dieser Zustand: die Matrix
  // fragte nur, ob zu GENAU dieser Stunde etwas BEGINNT, und zeigte die
  // zweite Banja-Stunde faelschlich als frei an.
  | { kind: 'laeuft'; infusion: Infusion }
  // Saunafest (0150): die dritte Sauna macht erst später am Tag auf.
  | { kind: 'geschlossen'; hinweis: string }
  // Saunafest (0163): im Tagesplaner bucht am Fest nur der Admin. Alle anderen
  // tragen ihren Zeitraum im Bereich „Saunafest" ein — die Kachel ist zu.
  // Solange der Plan Entwurf ist, verrät sie auch keine Einteilung.
  | { kind: 'fest' }
  // Ruhephase nach dem Ritual — die Sauna wird gereinigt und gelueftet.
  // Serverseitig gesperrt (validate_infusion_banja_and_overlap).
  | { kind: 'ruhe' };

// 4-Farben-System (User-Entscheidung Mai 2026): Rot / Grün / Orange + Violett für mine.
// Wird von BEIDEN Slot-Renderern genutzt (SaunaSlotRow Desktop + DaySaunaMatrix Mobile)
// damit kein visueller Drift zwischen den Layouts entsteht.
type SlotVisual = {
  bg: string;          // Tailwind bg-…
  text: string;        // Tailwind text-…
  ring: string;        // Tailwind ring-…
  icon: string | null; // Sub-Icon (Emoji), null wenn ohne
  title: string;       // tooltip
  disabled: boolean;
};

function slotVisualFor(status: SlotStatus, blockedBySecondary: boolean): SlotVisual {
  if (status.kind === 'past') {
    return { bg: 'bg-forest-950/30', text: 'text-forest-300/30', ring: 'ring-forest-900/30', icon: null, title: 'Vergangenheit', disabled: true };
  }
  if (status.kind === 'taken') {
    return { bg: 'bg-rose-500/20', text: 'text-rose-100', ring: 'ring-rose-500/40', icon: '🧖', title: `Belegt — ${status.infusion.title}`, disabled: true };
  }
  if (status.kind === 'mine') {
    return { bg: 'bg-violet-500/25', text: 'text-violet-100', ring: 'ring-violet-400/60 ring-2', icon: '✓', title: `Dein Aufguss — ${status.infusion.title}`, disabled: true };
  }
  if (status.kind === 'fallback') {
    return { bg: 'bg-amber-500/20', text: 'text-amber-100', ring: 'ring-amber-500/40', icon: '👨‍🍳', title: 'Personal-Aufguss übernehmen', disabled: false };
  }
  if (status.kind === 'laeuft') {
    return { bg: 'bg-rose-500/15', text: 'text-rose-100/80', ring: 'ring-rose-500/30', icon: '⏳', title: `Läuft noch — ${status.infusion.title}`, disabled: true };
  }
  if (status.kind === 'ruhe') {
    return { bg: 'bg-sky-500/15', text: 'text-sky-100/80', ring: 'ring-sky-400/30', icon: '🌬️', title: 'Ruhephase — die Sauna wird gereinigt', disabled: true };
  }
  if (status.kind === 'geschlossen') {
    return { bg: 'bg-forest-950/30', text: 'text-forest-300/40', ring: 'ring-forest-900/40', icon: '🕰️', title: status.hinweis, disabled: true };
  }
  if (status.kind === 'fest') {
    return { bg: 'bg-amber-500/10', text: 'text-amber-100/70', ring: 'ring-amber-500/30', icon: '🔥', title: 'Am Saunafest teilt der Admin ein', disabled: true };
  }
  // status.kind === 'free'
  if (blockedBySecondary) {
    return { bg: 'bg-amber-500/15', text: 'text-amber-200/70', ring: 'ring-amber-500/30', icon: '🔒', title: 'Erst Garantie-Sauna planen', disabled: true };
  }
  return { bg: 'bg-emerald-500/15', text: 'text-emerald-100', ring: 'ring-emerald-500/30', icon: null, title: 'Frei — neuer Aufguss', disabled: false };
}

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
  const bookBanja = useBookBanjaRitual();
  const delInf = useDeleteInfusion();
  const addTpl = useAddTemplate();
  const delTpl = useDeleteTemplate();
  const trigEvac = useTriggerEvacuation();
  const endEvac = useEndEvacuation();
  // suggestTitle wird nicht mehr direkt im Planner gerufen — der neue
  // TitleSuggestionPicker hält den Mutation-Hook selbst und liefert beim
  // onPick den ausgewählten Titel zurück (User-Wunsch 29.05.2026: 5 statt 1).
  const [titlePickerOpen, setTitlePickerOpen] = useState(false);

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
  // Nur fuer den Titel-Vorschlag: eigene Oele und das Kraeuterregal, um
  // UUIDs in lesbare Namen aufzuloesen (siehe lib/titelZutaten.ts).
  const myOilsQ = useMyCustomOils(m?.id ?? null);
  const sudKraeuterQ = useSudKraeuter();
  const sudMixeQ = useSudMixe();
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
    // Wie toggleAttr: abwählen immer, dazuwählen nur mit freiem Kontingent.
    setCustomAttrIds((prev) => (prev.includes(id)
      ? prev.filter((x) => x !== id)
      : (auswahlVoll ? prev : [...prev, id])));
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
      // Zielzustand statt Umschalten (Migration 0188, Audit 25.09.2026): gesendet
      // wird, was der Knopf anzeigt. Wer inzwischen am Tablet eingecheckt hat,
      // wird so nicht versehentlich ausgecheckt (und umgekehrt).
      const jetztDa = await setMyPresence(!isPresent);
      setCheckMsg({ ok: true, text: jetztDa ? '✅ Eingecheckt — willkommen!' : '👋 Ausgecheckt — bis zum nächsten Mal!' });
      await presentQ.refetch();
      // Streak-Badges checken nach Check-in
      if (jetztDa) {
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
  // Schnaps-Aufguss: genau eine Sorte, wird als 'schnaps:<slug>' in die
  // attributes geschrieben (siehe lib/schnaps.ts). Öle und Schnaps sind
  // unabhängig — der Reiter schaltet nur die Sicht, nicht die Daten.
  const [schnaps, setSchnaps] = useState<string | null>(null);
  const [aromaTab, setAromaTab] = useState<'oils' | 'schnaps' | 'raeuchern' | 'sud'>('oils');
  // Sud: fertige Attribut-Eintraege ('sud:<uuid>' / 'sudmix:<uuid>'), damit sie
  // unveraendert in attributes[] wandern koennen (siehe lib/sud.ts).
  const [sudAuswahl, setSudAuswahl] = useState<string[]>([]);
  const [teamInfusion, setTeamInfusion] = useState(false);
  // Aufguss-Dauer (User-Wunsch: 20/30/45 wählbar, Default 20; 90 = Banja)
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION_MIN);
  // Banja-Erkennung im Outer-Scope (für Button-Label + Disabled-State).
  // submit() hat eine eigene lokale Kopie, hier nur fürs Rendering.
  const isBanjaPlanned = (attrs as string[]).includes(BANJA_ATTR);
  const selectedSchnaps = schnaps ? SCHNAPS_BY_ID[schnaps] ?? null : null;
  const raeuchernOn = (attrs as string[]).includes(RAEUCHER_ATTR);
  const kraeuterOn = (attrs as string[]).includes(KRAEUTER_ATTR);
  // 3–6-Regel (User-Wunsch 03.08.2026): mindestens DREI, höchstens SECHS
  // Dinge pro Aufguss — Öle und Besonderheiten frei gemischt. Die Öle
  // bleiben dabei bei ihren MAX_OIL_SLOTS (3) Plätzen, die Besonderheiten
  // füllen den Rest.
  //
  // Die Schnaps-Sorte zählt bewusst NICHT mit: sie beschreibt die ART des
  // Aufgusses (eigener Reiter, eigener Karten-Look), sie ist keine Zutat aus
  // dem Kontingent. Räuchern zählt dagegen mit — es ist und bleibt ein
  // normales Attribut.
  // Zaehlweise, Obergrenze und Payload-Bau stehen in lib/aufgussRegeln.ts —
  // dieselbe Datei benutzt der Oel-Raum-Kiosk, damit am Tablet nicht andere
  // Regeln gelten als in der App jedes Einzelnen.
  const auswahl: ZutatenAuswahl = { attrs, customAttrIds, oils, sudAuswahl, schnaps };
  const auswahlAnzahl = zaehleAuswahl(auswahl);
  const auswahlVoll = auswahlAnzahl >= MAX_AUSWAHL;
  // So viele Öl-Runden lässt das Kontingent zu: alles andere Gewählte
  // (Besonderheiten, eigene Buttons, Sud) geht ab — der OilPicker füllt
  // darüber hinaus keinen leeren Slot mehr.
  const oelPlaetzeErlaubt = Math.max(0, MAX_AUSWAHL - (auswahlAnzahl - oils.filter(Boolean).length));
  const fehlt = fehltNoch(auswahl);
  // Welcher Aufguss wird gerade über die Nachpflege-Liste bearbeitet?
  const [nachpflege, setNachpflege] = useState<Infusion | null>(null);
  // Grund des Banja-Umgehungsversuchs, solange das rote Fenster steht.
  const [banjaAlarm, setBanjaAlarm] = useState<string | null>(null);
  const attrsPayload = (): string[] => baueAttrsPayload(auswahl);
  // Admin kann anderen Saunameister beim Erstellen wählen — default: self.
  // Bei nicht-Admins wird m.id verwendet (Backend lehnt fremde IDs eh ab).
  const [adminSaunameisterId, setAdminSaunameisterId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [evacToast, setEvacToast] = useState<string | null>(null);

  useEffect(() => {
    if (!saunaId && saunas[0]) setSaunaId(saunas[0].id);
  }, [saunaId, saunas]);

  // Heute (lokale Mitternacht) — NICHT einmalig merken: wer den Planer über
  // Nacht offen lässt, blieb sonst beim gestrigen Tag hängen („Heute noch
  // nichts geplant", Pager eins daneben). `now` tickt jede Minute und sofort,
  // wenn die App wieder sichtbar wird oder den Fokus bekommt; der Tages-
  // schlüssel ändert sich aber nur um Mitternacht — erst dann gibt es ein
  // neues Datum-Objekt und die abhängigen Berechnungen laufen neu.
  const heuteLokal = format(now, 'yyyy-MM-dd');
  const todayDate = useMemo(() => {
    const [y, mo, d] = heuteLokal.split('-').map(Number);
    return new Date(y, mo - 1, d);
  }, [heuteLokal]);
  // Rutscht der gewählte Tag nach Mitternacht in die Vergangenheit, geht er
  // auf heute weiter. Ein bewusst gewählter künftiger Tag bleibt stehen.
  useEffect(() => {
    setSelectedDate((d) => (d.getTime() < todayDate.getTime() ? todayDate : d));
  }, [todayDate]);
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

  // Covering-Lookup: eine Infusion markiert ALLE Stunden-Slots die sie überlappt.
  // Wichtig für Banja (90/120 Min) — der 19:00-Banja muss auch im 20:00-Slot derselben
  // Sauna als 'taken' erscheinen. Generisch: jede Infusion mit duration > 60 spannt
  // mehrere Slots. ceil(dur/60) Slots werden markiert (covering, nicht overlap).
  const infusionByKey = useMemo(() => {
    const map = new Map<string, Infusion>();
    for (const i of infusions) {
      const start = new Date(i.start_time);
      const slotsCovered = Math.max(1, Math.ceil((i.duration_minutes ?? 20) / 60));
      for (let k = 0; k < slotsCovered; k++) {
        const slotStart = new Date(start.getTime() + k * 60 * 60_000);
        map.set(infusionKey(i.sauna_id, slotStart), i);
      }
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
    /** Saunafest an diesem Tag (0150) — sonst null. */
    fest: SaunafestTag | null;
  };

  const holidaySet = useHolidaySet();
  // Saunafeste (0150): an diesen Samstagen Aufgüsse ab 14 Uhr in den beiden
  // Außensaunen, ab 17 Uhr auch in der dritten. Die Matrix bekommt dann
  // drei Spalten, und die Garantie-Sperre der Zweitsauna entfällt — am Fest
  // wählt jeder frei.
  const festTageQ = useSaunafestTage();
  const festAm = useCallback((date: Date) => saunafestAm(date, festTageQ.data), [festTageQ.data]);
  // Saunafest-Bereich (0163, Vorgabe Christoph 23./24.09.2026): der Planer fürs
  // Fest ist ein eigener Bereich, getrennt vom Tagesplaner. Dort trägt jeder
  // außer Gästen seinen Zeitraum ein, der Admin teilt ein und bestätigt den
  // Plan. Im Tagesplaner bucht am Festtag nur noch der Admin direkt.
  // Anzeige in der Sprungleiste nur, solange ein Fest bevorsteht — dieselbe
  // Bedingung, unter der SaunafestZone überhaupt etwas zeigt.
  const heuteYmd = berlinYmd(now);
  const hatKommendesFest = (festTageQ.data ?? []).some((f) => f.datum >= heuteYmd);
  const darfSaunafest = !!m && (previewRole ? previewRole !== 'gast' : m.role !== 'gast');
  const garantieOptsFor = useCallback((date: Date, fest: SaunafestTag | null) => ({
    mondayOpen,
    isHoliday: isHolidayDate(date, holidaySet),
    saunafest: !!fest,
  }), [mondayOpen, holidaySet]);
  /** Welche Saunen an diesem Tag planbar sind: die aktiven, am Fest dazu die dritte. */
  const saunenAmTag = useCallback((fest: SaunafestTag | null) =>
    saunas
      .filter((s) => s.is_active || (fest?.dritte_sauna_id != null && s.id === fest.dritte_sauna_id))
      .sort((a, b) => a.sort_order - b.sort_order),
  [saunas]);
  /** Das Festraster (0152): Uhrzeit × Sauna — null an normalen Tagen. */
  const festPlanFor = useCallback((fest: SaunafestTag | null): FestSlot[] | null =>
    (fest ? festSlots(fest, saunas) : null), [saunas]);
  const saunaName = useCallback((id: string) => saunas.find((s) => s.id === id)?.name ?? '?', [saunas]);

  const dayContextOf = useCallback((date: Date): DayContext => {
    const isHol = isHolidayDate(date, holidaySet);
    const fest = festAm(date);
    const isMonday = date.getDay() === 1;
    // Feiertag öffnet auch den Montag (überschreibt mondayOpen)
    const isMondayBlocked = isMonday && !mondayOpen && !isHol;
    const isPast = date.getTime() < todayDate.getTime();
    const availableSlots = getAvailableSlots(date, mondayOpen, isHol, festPlanFor(fest));
    const opts = garantieOptsFor(date, fest);
    const garantieSlotsOpen: DayContext['garantieSlotsOpen'] = [];
    // Am Fest gibt es keine Garantie-Slots (0152).
    if (!isMondayBlocked && !fest) {
      const weekday = date.getDay();
      for (const h of slotHoursForWeekday(weekday, opts)) {
        const slotDate = setMinutes(setHours(date, h), 0);
        const tempC = garantieTemperatureFor(slotDate, opts);
        if (tempC === null) continue;
        const garantieSauna = saunas.find((s) => s.temperature_label === `${tempC}°C` && s.is_active);
        if (!garantieSauna) continue;
        const inf = infusionByKey.get(infusionKey(garantieSauna.id, slotDate));
        const hasReal = inf && !inf.is_personal_fallback;
        // In der Ruhestunde nach einem Banja ist die Garantie-Sauna zu — dort
        // gibt es nichts zu übernehmen, also bleibt die Zweit-Sauna offen
        // (gespiegelt in check_secondary_sauna_allowed, Migration 0183).
        const t = slotDate.getTime();
        const inRuhe = infusions.some((x) => x.sauna_id === garantieSauna.id && isBanjaInfusion(x)
          && t >= new Date(x.end_time).getTime() && t < new Date(x.end_time).getTime() + RUHE_MS);
        if (!hasReal && !inRuhe) garantieSlotsOpen.push({ hour: h, saunaName: garantieSauna.name, tempC });
      }
    }
    return { date, isMonday: isMondayBlocked, isPast, availableSlots, garantieSlotsOpen, fest };
  }, [todayDate, saunas, infusionByKey, infusions, mondayOpen, holidaySet, festAm, garantieOptsFor, festPlanFor]);

  const slotStatusFor = useCallback((date: Date, saunaIdLookup: string, hhmm: string): SlotStatus => {
    const start = slotToDate(date, hhmm);
    if (isBefore(start, new Date())) return { kind: 'past' };
    // Saunafest (0150): die dritte Sauna öffnet erst ab abDrei — davor ist
    // die Kachel sichtbar, aber zu. Die gemeinsame Stundenliste beginnt bei
    // abZwei, deshalb greift das nur für die dritte Sauna.
    const fest = festAm(date);
    // Saunafest (0152): nur Kacheln, die der Plan vorsieht — 10:30 ist z. B.
    // nur die 80-°C-Sauna dran, die dritte kommt erst ab 17:30 dazu.
    const plan = festPlanFor(fest);
    if (fest && plan && !festSlotOffen(plan, hhmm, saunaIdLookup)) {
      const dran = festSaunenUm(plan, hhmm).map(saunaName);
      return { kind: 'geschlossen', hinweis: dran.length ? `Um ${hhmm} Uhr am Fest: ${dran.join(' + ')}` : `Um ${hhmm} Uhr am Fest kein Aufguss` };
    }
    // Saunafest (0163): Nicht-Admins buchen hier nicht — sie tragen im Bereich
    // „Saunafest" ihren Zeitraum ein, der Admin teilt ein. Solange der Plan
    // Entwurf ist, zeigt die Kachel keine Einteilung (auch nicht die eigene):
    // erst mit „Plan bestätigen" erfährt jeder, ob und wann er dran ist.
    if (fest && !isAdmin && !fest.plan_bestaetigt_at) return { kind: 'fest' };
    const inf = infusionByKey.get(infusionKey(saunaIdLookup, start));
    // Nach der Bestätigung: Einteilungen wie gewohnt (belegt / mein Aufguss),
    // nur die freien Kacheln bleiben zu — auch ein Personal-Aufguss ist am
    // Fest nichts zum Übernehmen.
    if (fest && !isAdmin && (!inf || inf.is_personal_fallback)) return { kind: 'fest' };
    // Ein Personal-Slot in der Ruhestunde nach einem Banja ist nicht
    // übernehmbar (der Trigger lehnt ab) — also Ruhe zeigen statt 👨‍🍳.
    // Seit 0183 räumt book_banja_ritual solche Slots ab; das hier greift
    // für Altbestand und bis zum nächsten Nachladen.
    if (inf?.is_personal_fallback) {
      const tf = start.getTime();
      const inRuhe = infusions.some((x) => x.sauna_id === saunaIdLookup && isBanjaInfusion(x)
        && tf >= new Date(x.end_time).getTime() && tf < new Date(x.end_time).getTime() + RUHE_MS);
      if (inRuhe) return { kind: 'ruhe' };
    }
    if (inf) {
      if (inf.is_personal_fallback) return { kind: 'fallback', infusion: inf };
      if (inf.saunameister_id === m?.id) return { kind: 'mine', infusion: inf };
      return { kind: 'taken', infusion: inf };
    }

    // Kein Aufguss, der GENAU hier beginnt — aber laeuft einer herein?
    // Die Map oben ist nach Startzeit indiziert und uebersieht deshalb jede
    // Stunde, die ein laengerer Aufguss ueberdeckt. Beim zweistuendigen Banja
    // war dadurch die zweite Stunde als frei markiert, und die Ruhephase
    // danach ebenfalls — die Sperre existierte nur in der Datenbank und
    // schlug erst beim Speichern zu.
    const t = start.getTime();
    for (const x of infusions) {
      if (x.sauna_id !== saunaIdLookup) continue;
      const s0 = new Date(x.start_time).getTime();
      const e0 = new Date(x.end_time).getTime();
      if (t > s0 && t < e0) return { kind: 'laeuft', infusion: x };
      if (x.attributes?.includes(BANJA_ATTR) && t >= e0 && t < e0 + RUHE_MS) {
        return { kind: 'ruhe' };
      }
    }
    // Kein Aufguss, der hier beginnt, und nichts läuft herein — am Fest ist
    // die Kachel für Nicht-Admins trotzdem zu (siehe oben).
    if (fest && !isAdmin) return { kind: 'fest' };
    return { kind: 'free' };
  }, [infusionByKey, infusions, m?.id, festAm, festPlanFor, saunaName, isAdmin]);

  // Banja: prüft die Stunden, die das Ritual ab startStunde belegt, und die
  // Ruhestunde danach — dieselbe Regel wie book_banja_ritual (0183). Karte und
  // Absenden nutzen beide diese Prüfung, damit sie nie auseinanderlaufen
  // (vorher prüfte das Absenden fest 19:00 und 20:00, egal wann das Banja
  // beginnt). Ritual-Stunden: frei oder Personal-Slot (den räumt die RPC ab).
  // Ruhestunde: kein echter Aufguss.
  const banjaKonflikt = useCallback((date: Date, sid: string, startStunde: number): string | null => {
    const ritualStunden = Math.ceil(banjaDauerFuer(startStunde) / 60);
    for (let k = 0; k < ritualStunden + BANJA_RUHE_STUNDEN; k++) {
      const hh = `${String(startStunde + k).padStart(2, '0')}:00`;
      const st = slotStatusFor(date, sid, hh);
      if (k >= ritualStunden) {
        if (st.kind === 'taken' || st.kind === 'mine' || st.kind === 'laeuft') {
          return `♨️ Um ${hh} Uhr steht in dieser Sauna schon ein Aufguss – nach dem Ritual bleibt sie aber eine Stunde zu.`;
        }
      } else if (st.kind === 'ruhe') {
        return `♨️ Um ${hh} Uhr ist diese Sauna nach einem anderen Banja noch in der Ruhestunde.`;
      } else if (st.kind !== 'free' && st.kind !== 'fallback') {
        return `♨️ ${hh} Uhr ist in dieser Sauna schon belegt.`;
      }
    }
    return null;
  }, [slotStatusFor]);

  // Klick in der Matrix: Slot für Schritt 2 übernehmen. Am Saunafest kommen
  // hier nur Admins an — für alle anderen sind die Fest-Kacheln gesperrt.
  function pickSlot(date: Date, pickedSaunaId: string, picked: string) {
    setSelectedDate(date);
    setSaunaId(pickedSaunaId);
    setSlot(picked);
  }

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

  // Slot-Clamp: beim Tages-Wechsel kann der gewählte Slot außerhalb der
  // Öffnungs-Stunden des neuen Tages liegen (Sa 11:00 gewählt → Di startet
  // erst 14:00). Dann auf den ersten verfügbaren Slot zurücksetzen, damit
  // der „Gewählt:"-Chip und submit() nie einen nicht-existenten Slot führen.
  useEffect(() => {
    const avail = selectedDayCtx.availableSlots;
    if (avail.length > 0 && !avail.includes(slot)) setSlot(avail[0]);
  }, [selectedDayCtx.availableSlots, slot]);

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
    const temp = garantieTemperatureFor(start, garantieOptsFor(selectedDate, festAm(selectedDate)));
    if (temp === null) return false;
    const sauna = saunas.find((s) => s.id === saunaId);
    if (!sauna) return false;
    return sauna.temperature_label === `${temp}°C`;
  }, [selectedDate, slot, saunaId, saunas, garantieOptsFor, festAm]);

  const garantieSlotsOpenToday = selectedDayCtx.garantieSlotsOpen;
  // Per-Stunde-Sperre (Migration 0092): Zweit-Sauna ist nur für die konkrete
  // Stunde gesperrt wenn der Garantie-Slot DIESER Stunde noch nicht durch einen
  // echten Aufgießer belegt ist. Andere Stunden des Tages sind unabhängig.
  const selectedSlotHour = Number(slot.split(':')[0]);
  // Am Saunafest (0150) gibt es keine Zweitsauna-Sperre: jeder wählt frei.
  const secondarySaunaBlocked =
    !selectedDayCtx.fest &&
    !isGarantieSauna &&
    Number.isFinite(selectedSlotHour) &&
    garantieSlotsOpenToday.some((g) => g.hour === selectedSlotHour);

  function toggleAttr(a: InfusionAttribute) {
    // Abwählen geht immer, Dazuwählen nur solange das 3–6-Kontingent Platz hat.
    setAttrs((prev) => (prev.includes(a)
      ? prev.filter((x) => x !== a)
      : (auswahlVoll ? prev : [...prev, a])));
  }

  function applyTemplate(t: { title: string; description: string | null; duration_minutes: number; attributes: string[]; oils?: (string | null)[] | null }) {
    setTitle(t.title);
    // Vorlagen legen ALLES in EINEM Feld ab (siehe saveAsTemplate): Standard-
    // Attribute, die UUIDs eigener Buttons, den Sud und die Schnaps-Sorte.
    // Beim Anwenden muss das wieder auseinander — sonst landen UUIDs in
    // `attrs`, wo es keinen Chip dafuer gibt: unsichtbar, aber im Kontingent
    // mitgezaehlt und dadurch nicht mehr abwaehlbar. Und ein doppelt
    // gefuehrter Schnaps/Sud wuerde von attrsPayload() zweimal geschrieben.
    // `customAttrIds` wird dabei bewusst NEU gesetzt statt stehen gelassen,
    // sonst zaehlt eine Alt-Auswahl doppelt.
    const tpl = zerlegeAttributes(t.attributes, customAttrs.map((a) => a.id));
    setSchnaps(tpl.schnaps);
    setAromaTab(tpl.schnaps ? 'schnaps' : 'oils');
    setSudAuswahl([...tpl.sudAuswahl]);
    setAttrs([...tpl.attrs]);
    setCustomAttrIds([...tpl.customAttrIds]);
    setOils(normalizeOilSlots(t.oils));
    // Template-Dauer übernehmen (falls 15 oder andere Alt-Daten → wird im
    // UI als Ad-hoc-Button gezeigt, siehe DURATION_OPTIONS-Block).
    setDuration(t.duration_minutes || DEFAULT_DURATION_MIN);
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
        duration_minutes: duration,
        // Standard-attrs + Custom-Attr-UUIDs zusammen ablegen.
        // Cast nötig weil customAttrIds string[] (UUIDs) sind, die
        // Mutation aber InfusionAttribute[] erwartet. DB-Spalte ist
        // text[] und nimmt beide Formen an.
        attributes: attrsPayload() as InfusionAttribute[],
        oils: oils.some(Boolean) ? oils : null,
      });
    } catch (e) { setFormError((e as Error).message); }
  }

  function clearForm() {
    setTitle('');
    setAttrs([]);
    setCustomAttrIds([]);
    setOils(Array.from({ length: MAX_OIL_SLOTS }, () => null) as (string | null)[]);
    setSchnaps(null);
    setSudAuswahl([]);
    setAromaTab('oils');
    setTeamInfusion(false);
    setAdminSaunameisterId('');
    setDuration(DEFAULT_DURATION_MIN);
  }

  // „Banja buchen" füllt nur das Formular. Ohne diesen Ausweg blieb der
  // Banja-Modus stehen (banja + wenik sind keine Chips) und jeder weitere
  // Aufguss wurde zum Banja. Beide Attribute gehen zusammen raus — der
  // Trigger lehnt Wenik ohne Banja ab (0150).
  function banjaAbwaehlen() {
    setAttrs((a) => a.filter((x) => x !== BANJA_ATTR && x !== 'wenik'));
    // Das Wort „Banja" ist dem Ritual vorbehalten (Trigger: title ~* '\mbanja').
    // Bliebe ein angepasster Banja-Titel stehen, landete der normale Aufguss
    // im roten Betrugsfenster samt Log-Eintrag — deshalb jeden solchen Titel leeren.
    setTitle((t) => (t === BANJA_TITLE_DEFAULT || /(^|[^\p{L}\p{N}_])banja/iu.test(t) ? '' : t));
    setDuration(DEFAULT_DURATION_MIN);
    setFormError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!m) return setFormError('Bitte zuerst anmelden.');
    if (!saunaId) return setFormError('Bitte eine Sauna wählen.');
    if (!title.trim()) return setFormError('Titel fehlt.');
    // 3-6-Regel: Oele und Besonderheiten zusammen. Die Chips sperren oben
    // schon bei 6, das hier ist die Sperre gegen Vorlagen und Alt-Zustaende.
    //
    // Das Banja-Ritual ist davon beim MINIMUM ausgenommen: sein Schnellbuchungs-
    // Knopf setzt genau zwei Eigenschaften (banja + wenik), und das Ritual hat
    // einen festen Charakter, dem man nicht kuenstlich eine dritte Zutat
    // anhaengen sollte. Die Obergrenze gilt auch fuer Banja.
    const kontingentFehler = pruefeAuswahl(auswahl);
    if (kontingentFehler) return setFormError(kontingentFehler);
    if (isMondaySelected) return setFormError('Montag keine Aufgüsse.');
    // Defense in depth zum Slot-Clamp-Effect: nie außerhalb der Öffnungs-
    // Stunden des Tages eintragen (seit 0183 prüft der Server das ebenfalls,
    // hier kommt die Meldung nur früher).
    if (!selectedDayCtx.availableSlots.includes(slot)) {
      return setFormError('Slot liegt außerhalb der Aufgusszeiten dieses Tages — bitte oben neu wählen.');
    }
    // Saunafest (0163): im Tagesplaner bucht am Fest nur der Admin. Die Fest-
    // Kacheln sind für alle anderen gesperrt und Schritt 2 ist ausgeblendet —
    // trotzdem abfangen (Tageswechsel mit gemerktem Slot, alte Zustände).
    if (selectedDayCtx.fest && !isAdmin) {
      return setFormError(FEST_NICHT_BUCHEN);
    }
    // Saunafest (0152): nur Slots aus dem Festraster (Admin-Direktbuchung).
    {
      const plan = festPlanFor(selectedDayCtx.fest);
      if (plan && !festSlotOffen(plan, slot, saunaId)) {
        return setFormError('Dieser Slot ist am Fest für diese Sauna nicht vorgesehen — bitte oben eine offene Kachel wählen.');
      }
    }

    // Banja-Pfad früh erkennen — umgeht mehrere Standard-Checks (Slot-Taken,
    // Secondary-Block, Staff-Restriction), weil book_banja_ritual atomar
    // Personal-Fallbacks aufräumt und als Spezial-Event eigene Regeln hat.
    const isBanjaSubmit = (attrs as string[]).includes(BANJA_ATTR);

    const start = slotToDate(selectedDate, slot);
    if (isBefore(start, new Date())) return setFormError('Slot liegt in der Vergangenheit.');
    if (!isBanjaSubmit && isSlotTaken(slot)) return setFormError('Slot bereits belegt.');
    // Staff darf NUR Personal-Fallbacks übernehmen (Banja-Pfad nicht für Staff offen,
    // RPC prüft Aufgießer/Admin nochmal serverseitig)
    if (!isBanjaSubmit && isStaff && !selectedFallbackId) {
      return setFormError('Als Personal kannst du nur 👨‍🍳-Slots (Personal-Aufgüsse) übernehmen. Wähle einen gelben Slot in der Matrix.');
    }
    // Sperrregel gilt NICHT, wenn der gewählte Slot ein Personal-Fallback ist
    // (übernehmen bringt die Garantie-Sauna ja erst zum vollständigen Besetzt-Status).
    // Banja ist Spezial-Event und überschreibt secondarySauna-Sperre ebenfalls
    // (Banja in 80°C ist priorisiert auch wenn 100°C bei 19:00 noch Garantie-Fallback hat).
    if (!isBanjaSubmit && !selectedFallbackId && secondarySaunaBlocked) {
      const dranGarantie = garantieSlotsOpenToday.find((g) => g.hour === selectedSlotHour);
      return setFormError(
        `⛔ Für ${String(selectedSlotHour).padStart(2,'0')}:00 ist erst der Personal-Slot in der ${dranGarantie?.saunaName ?? 'dran'}-Sauna zu übernehmen.`,
      );
    }

    // ── BANJA-RITUAL: dieselben Regeln wie book_banja_ritual (0183), damit
    // der Fehler sofort kommt statt nach dem Server-Aufruf. Die Datenbank
    // bleibt maßgeblich. Die Dauer wählt niemand — die RPC setzt sie aus der
    // Startstunde (90 Min um 19 Uhr, sonst 120); geprüft werden die Stunden,
    // die das Ritual wirklich belegt, plus Ruhestunde und Betriebsschluss.
    if (isBanjaSubmit) {
      if (!selectedDayCtx.fest && !banjaEndetRechtzeitig(selectedSlotHour)) {
        return setFormError(BANJA_SCHLUSS_HINWEIS);
      }
      const konflikt = banjaKonflikt(selectedDate, saunaId, selectedSlotHour);
      if (konflikt) return setFormError(konflikt);
    }

    try {
      if (isBanjaSubmit) {
        // Banja-Pfad: atomare RPC book_banja_ritual räumt Personal-Slots im
        // Ritual und in der Ruhestunde ab und legt das Banja (90/120 Min) als
        // neue Infusion an. Umgeht die normale takeover/addInf-Verzweigung.
        await bookBanja.mutateAsync({
          sauna_id: saunaId,
          date: selectedDate,
          start_hour: selectedSlotHour,
          title: title.trim(),
          attributes: attrsPayload(),
          oils: oils.some(Boolean) ? oils : null,
          team_infusion: teamInfusion,
          saunameister_id: (isAdmin && adminSaunameisterId) ? adminSaunameisterId : null,
        });
      } else if (selectedFallbackId) {
        await takeoverFallback.mutateAsync({
          infusion_id: selectedFallbackId,
          title: title.trim(),
          description: null,
          // Standard-attrs + Custom-Attr-UUIDs zusammen ablegen (Cast: s.o.)
          attributes: attrsPayload() as InfusionAttribute[],
          oils: oils.some(Boolean) ? oils : null,
          team_infusion: teamInfusion,
          // Seit 0184: gewählte Dauer und (Admin) gewählter Saunameister
          // gelten auch bei der Übernahme — vorher blieb es still bei 15 Min
          // und beim Admin selbst.
          duration_minutes: duration,
          saunameister_id: (isAdmin && adminSaunameisterId && adminSaunameisterId !== m.id) ? adminSaunameisterId : null,
        });
      } else {
        await addInf.mutateAsync({
        sauna_id: saunaId,
        template_id: null,
        // Admin kann anderen Saunameister wählen — sonst self.
        saunameister_id: (isAdmin && adminSaunameisterId) ? adminSaunameisterId : m.id,
        title: title.trim(),
        description: null,
        // Standard-attrs + Custom-Attr-UUIDs zusammen ablegen (Cast: s.o.)
        attributes: attrsPayload() as InfusionAttribute[],
        oils: oils.some(Boolean) ? oils : null,
        start_time: start.toISOString(),
        duration_minutes: duration,
        team_infusion: teamInfusion,
      });
      }
      // Push an die anderen Aufgießer, wenn ein TEAM-Aufguss veröffentlicht
      // wird. Text und Empfänger baut der Server (Vorlage, api/push-send) —
      // freie Rundrufe dürfen seit 25.09.2026 nur Admins schicken.
      if (teamInfusion) {
        sendVorlagePush({
          vorlage: 'team_aufguss',
          sauna_id: saunaId,
          start_time: start.toISOString(),
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
    } catch (e) {
      // Banja-Umgehung ist kein normaler Fehler: rotes Fenster statt roter
      // Zeile, und der Admin erfährt davon (0149).
      if (istBanjaSperre(e)) {
        // Admins dürfen immer (0183) — kommt die Sperre trotzdem (z. B. das
        // Wort „Banja" im Titel eines normalen Aufgusses), ist das ein
        // normaler Fehler und kein Umgehungsversuch: kein rotes Fenster,
        // kein Eintrag im Aktivitätslog. In der Vorschau-Rolle zählt die echte.
        if (isAdminOrig) { setFormError(banjaGrund(e)); return; }
        setBanjaAlarm(banjaGrund(e));
        meldeBanjaVersuch(banjaGrund(e), title || null);
        return;
      }
      setFormError((e as Error).message);
    }
  }

  // ─── Evakuierung ────────────────────────────────────────────────────────
  async function triggerEvacuation() {
    if (!m) return;
    if (!confirm('Evakuierungsalarm WIRKLICH auslösen?')) return;
    setEvacToast(null);
    const presentNames = (presentQ.data ?? []).map((p) => p.name);
    let ev;
    try {
      ev = await trigEvac.mutateAsync({ triggered_by: m.id, present_names: presentNames });
    } catch (e) {
      // Kein Alarm entstanden: laut melden (Fenster), nicht nur als Zeile.
      const text = `ALARM NICHT AUSGELÖST: ${(e as Error).message}`;
      setEvacToast(text);
      window.alert(`${text}\n\nBitte sofort Personal/Admin anrufen, bei Feuer 112.`);
      return;
    }
    try {
      broadcastEvac({ type: 'start', triggeredBy: m.name, triggeredAt: Date.parse(ev.triggered_at) });
      // Telegram UND Web-Push an alle schickt der Server genau einmal — seit
      // 0191 stößt ihn die Datenbank selbst an; dieser Aufruf ist Rückfall.
      const r = await sendEvacuationList({ triggeredBy: m.name, triggeredAt: new Date(ev.triggered_at), presentNames });
      setEvacToast(`${ev.schon_aktiv ? 'Alarm lief bereits.' : 'Alarm ausgelöst.'} ${versandMeldung(r)}`);
    } catch (e) { setEvacToast(`Alarm läuft, aber: ${(e as Error).message}`); }
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

  // Saunafest (0164): Fest-Aufgüsse laufen NICHT über die normale Bearbeiten-
  // Maske — dort sind 3 Öle + 2 Besonderheiten Pflicht, am Fest gibt es keine
  // Pflichtfelder (Titel, Geschichte, Bildidee, Musik, beliebig viele Öle …).
  // Deshalb raus aus Nachpflege-Liste und Atelier-Liste; die eigenen stehen im
  // Atelier als eigene Liste und öffnen die Fest-Angaben (FestAufgussInfoDialog).
  const myInfusionsOhneFest = useMemo(
    () => myInfusions.filter((i) => !festAm(new Date(i.start_time))),
    [myInfusions, festAm],
  );
  // Nachpflege-Liste: nur Aufgüsse, die man auch bearbeiten und absagen DARF.
  // Fremde Team-Aufgüsse stehen in myInfusions nur zum Beitreten — für sie
  // scheitern „Zutaten wählen" (update_infusion → not_owner) und 🗑
  // (cancel_my_infusion) bei Nicht-Admins immer.
  const nachpflegeInfusions = useMemo(
    () => (isAdmin
      ? myInfusionsOhneFest
      : myInfusionsOhneFest.filter((i) => m != null && i.saunameister_id === m.id)),
    [myInfusionsOhneFest, isAdmin, m],
  );
  // Nur die EIGENEN Fest-Aufgüsse (auch beim Admin — fremde bearbeitet er im
  // Bereich „Saunafest"). Vor der Planbestätigung ist die Einteilung Entwurf:
  // ein Nicht-Admin sieht sie dann noch nicht.
  const meineFestAufguesse = useMemo(
    () => myInfusions.filter((i) => {
      if (!m || i.saunameister_id !== m.id) return false;
      const fest = festAm(new Date(i.start_time));
      if (!fest) return false;
      if (new Date(i.end_time).getTime() <= now.getTime()) return false;
      return isAdmin || !!fest.plan_bestaetigt_at;
    }),
    [myInfusions, m, festAm, isAdmin, now],
  );
  // Welcher Fest-Aufguss gerade in den Fest-Angaben offen ist.
  const [festInfo, setFestInfo] = useState<Infusion | null>(null);

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
  // Actionable-Zähler für die Heute-Zone: offene Abfragen + bewertbare Aufgüsse.
  // Wird als Badge am Zonen-Header gerendert — bleibt auch bei ZUGEKLAPPTER
  // Zone sichtbar, sonst würde eine gemerkte Collapse-Entscheidung neue Polls
  // dauerhaft verstecken (TodayLiveBento ist deren einziger Einstiegspunkt).
  const heuteOffen = openPolls.length + (ratableQ.data?.length ?? 0);

  // ─── Bereichs-Sprungleiste ───────────────────────────────────────────────
  // Rollenabhängige Zonen-Anker im Sticky-Header — macht die lange Hub-Seite
  // navigierbar ohne Scrollen. IDs matchen die HubZone-id-Props unten.
  const navSections = [
    { id: 'heute', label: '🔥 Heute', show: true },
    // Saunafest-Bereich (0163): alle außer Gästen, solange ein Fest bevorsteht.
    { id: 'saunafest', label: '🎉 Saunafest', show: darfSaunafest && hatKommendesFest },
    { id: 'planen', label: '📋 Planen', show: isAufgieser || isStaff },
    { id: 'atelier', label: '🧖 Atelier', show: isAufgieser },
    { id: 'stammslot', label: '📅 Stamm-Slot', show: canApplyStammSlot && !!m },
    { id: 'profil', label: '🏆 Profil', show: !!m },
  ].filter((s) => s.show);

  function jumpToZone(zoneId: string) {
    // Zugeklappte Zone erst öffnen, dann scrollen (Children brauchen einen Tick zum Mounten)
    window.dispatchEvent(new CustomEvent('hubzone:open', { detail: { id: zoneId } }));
    setTimeout(() => {
      document.getElementById(zoneId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  // Deep-Link /planner#saunafest (Push + Posteingang, 0163/0164): Bereich
  // öffnen und hinscrollen — einmal je Navigation, sobald Mitglied und Feste
  // geladen sind. Die Zone rendert erst danach (und lädt selbst nach), darum
  // kurz auf ihr Element warten. Auch wenn der Planer schon offen ist, kommt
  // der Posteingang per navigate() hierher — deshalb location statt nur Mount.
  const location = useLocation();
  const festSprungFuer = useRef<string | null>(null);
  useEffect(() => {
    if (location.hash !== '#saunafest') return;
    if (!m || !festTageQ.data) return;
    if (festSprungFuer.current === location.key) return;
    festSprungFuer.current = location.key;
    let versuche = 0;
    const warteAufZone = () => {
      if (document.getElementById('saunafest')) { jumpToZone('saunafest'); return; }
      versuche += 1;
      if (versuche < 20) window.setTimeout(warteAufZone, 150);
    };
    warteAufZone();
    // jumpToZone ist eine reine DOM-Hilfe ohne Zustand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash, location.key, m, festTageQ.data]);

  return (
    <PageBackground page="planner">
      <PreviewBanner />
      {showAttrCreator && m && (
        <CustomAttrCreator memberId={m.id} onClose={() => { setShowAttrCreator(false); customAttrsQ.refetch(); }} />
      )}

      {showOilPicker && (
        <OilPicker
          selected={oils}
          maxOele={oelPlaetzeErlaubt}
          vollHinweis={`Höchstens ${MAX_AUSWAHL} Dinge zusammen — für ein weiteres Öl erst eine Besonderheit oder den Sud abwählen.`}
          onChange={(next) => {
            // Runde 1–3 sind feste Plätze (der Öl-Raum zeigt sie in dieser
            // Reihenfolge) — deshalb NICHT zusammenschieben. Vorher rückte
            // ein Öl aus Runde 3 in Runde 1 und wurde vom nächsten überschrieben.
            // Die Obergrenze prüft der Picker selbst (maxOele); hier nur als
            // Rückhalt: mehr Öle als erlaubt werden nicht übernommen. Tauschen
            // und Abwählen gehen immer, auch aus einer schon zu vollen Vorlage.
            const neu = next.filter(Boolean).length;
            if (neu > oils.filter(Boolean).length && neu > oelPlaetzeErlaubt) return;
            setOils(normalizeOilSlots(next));
          }}
          onClose={() => setShowOilPicker(false)}
        />
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
        {/* Bereichs-Sprungleiste: ein Tap springt zur Zone (öffnet sie falls zugeklappt) */}
        {navSections.length > 1 && (
          <nav
            aria-label="Bereiche"
            className="mx-auto flex max-w-7xl gap-1.5 overflow-x-auto px-4 sm:px-6 pb-2 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}
          >
            {navSections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => jumpToZone(s.id)}
                className="shrink-0 rounded-full bg-forest-900/70 px-3 py-1.5 text-[11px] font-semibold text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-800 hover:text-amber-200 active:scale-95 transition"
              >
                {s.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      {evacToast && (
        <div className="border-b border-forest-800/40 bg-forest-950/70 px-4 py-2 text-xs text-forest-200">{evacToast}</div>
      )}

      {/* Modern Layout */}
      <div className="mx-auto max-w-7xl p-3 sm:p-4 lg:p-6 space-y-4">

        {/* Doppelrolle: Personal (auch Aufgießer) → zurück zum Personal-Bereich */}
        {m?.role === 'staff' && (
          <Link
            to="/mitarbeiter"
            className="flex items-center justify-between gap-3 rounded-2xl bg-slate-500/15 ring-1 ring-slate-400/40 px-4 py-3 hover:bg-slate-500/25 transition"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100">👨‍🍳 Zum Personal-Bereich</div>
              <div className="text-[11px] text-slate-300/70 truncate">Verfügbarkeit, Wochenplan &amp; Anwesenheit als Mitarbeiter.</div>
            </div>
            <span className="text-slate-200 text-lg flex-shrink-0">→</span>
          </Link>
        )}

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

        {/* Nachpflege ganz oben, noch vor „Heute": ein Aufguss ohne Zutaten
            fällt sonst erst am Aufgusstag auf, wenn im Ölraum nichts steht.
            Fest-Aufgüsse nicht — für die gibt es keine Pflichtzutaten (0164). */}
        <UnvollstaendigeAufguesse
          infusions={nachpflegeInfusions}
          saunaName={(id) => saunas.find((s) => s.id === id)?.name ?? '?'}
          // Ab 60 Min. vor Start sperrt der Server Bearbeiten und Absagen für
          // Nicht-Admins — dann nur noch der Hinweis aufs Öl-Raum-Tablet.
          gesperrt={(inf) => !isAdmin && new Date(inf.start_time).getTime() - 60 * 60_000 <= now.getTime()}
          onNachpflegen={(inf) => setNachpflege(inf)}
          onLoeschen={(inf) => {
            const wann = format(new Date(inf.start_time), 'EEEE, d. MMMM HH:mm', { locale: de });
            if (!window.confirm(
              `Aufguss am ${wann} Uhr wirklich absagen?\n\n`
              + `${absageHinweis(inf)} Rückgängig machen geht nicht.`,
            )) return;
            delInf.mutate(inf.id, { onError: (e) => window.alert((e as Error).message) });
          }}
          busy={delInf.isPending}
        />

        {/* ══ ZONE: SAUNAFEST — eigener Bereich, getrennt vom Tagesplaner ═══
            (0163): Zeitraum + Lieblingssauna + Hinweis eintragen, Tages-
            übersicht mit Zahlen, nach der Planbestätigung die eigenen
            Einteilungen samt Angaben fürs Schild. Rendert selbst die HubZone
            id="saunafest" — oder nichts (Gäste, kein Fest in Sicht). */}
        {m && previewRole !== 'gast' && (
          <SaunafestZone member={m} isAdmin={isAdmin} />
        )}

        {/* ══ ZONE: HEUTE — Tagesprogramm + Live-Status in EINER Zone ═══════
            (vorher: DailyOverview standalone hier + "Heute Live"-Zone weit
            unten NACH dem Formular — zusammengehörige Tages-Infos waren
            quer über die Seite verteilt) */}
        <HubZone
          id="heute" icon="🔥" title="Heute" subtitle="Tagesprogramm · Live-Status · Anwesende"
          accent="#f59e0b" collapsible
          badge={heuteOffen > 0 ? (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-amber-950 tabular-nums">
              {heuteOffen} offen
            </span>
          ) : undefined}
        >
          <div className="space-y-4">
            <DailyOverview
              date={todayDate}
              infusions={infusions}
              saunas={saunas}
              meisterNameFor={(id) => meisterName(id)}
              now={now}
            />
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
          </div>
        </HubZone>

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
                          onClick={() => m && leaveTeam.mutate(
                            { infusion_id: i.id, member_id: m.id },
                            { onError: (e) => window.alert(`Verlassen hat nicht geklappt: ${(e as Error).message}`) },
                          )}
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

        {/* ══ ZONE: AUFGUSS PLANEN — klarer 2-Schritte-Flow (Aufgießer + Staff) ═══ */}
        {(isAufgieser || isStaff) && (
          <HubZone id="planen" icon="📋" title="Aufguss planen" subtitle="Schritt 1: Slot wählen · Schritt 2: Details eintragen" accent="#38bdf8" collapsible>
          <form onSubmit={submit} className="space-y-4">
            {/* ── SCHRITT 1: Slot wählen ──────────────────────────────── */}
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-sky-300/90">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 ring-1 ring-sky-500/40 text-[10px] text-sky-200">1</span>
              Slot wählen
            </p>

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
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/70" /> 👨‍🍳 Personal — übernehmen</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/70" /> 🔒 gesperrt</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500/70" /> 🧖 belegt</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet-500/70" /> ✓ mein Aufguss</span>
              {selectedDayCtx.fest && !isAdmin && (
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/40" /> 🔥 Saunafest — teilt der Admin ein</span>
              )}
            </div>

            {/* ── TAG ANZEIGE ────────────────────────────────────────── */}
            <div className="space-y-3">
              {visibleDayContexts.map(({ date: d, ctx }) => {
                const isSelected = isSameYMD(d, selectedDate);
                const isToday = isSameYMD(d, todayDate);
                const weekdayLabel = WEEKDAY_LABEL_DE[d.getDay()] ?? '';
                // Marker, ob der Tag überhaupt Garantie-Sperren hat — die
                // konkrete Sperre pro Slot wird in SaunaSlotRow per-Stunde
                // entschieden (siehe blockedBySecondary unten).
                // Am Saunafest (0150) entfällt die Sperre — freie Wahl in allen Saunen.
                const secondaryBlockedForDay = ctx.garantieSlotsOpen.length > 0 && !ctx.fest;
                const saunenHeute = saunenAmTag(ctx.fest);
                // Saunafest (0163): für Nicht-Admins ist der Tag im Tagesplaner
                // zu — dann auch keine grüne „gewählt"-Markierung auf einer
                // gesperrten Kachel (der Slot-Clamp setzt sonst die erste).
                const festGesperrt = !!ctx.fest && !isAdmin;
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
                        {ctx.fest && (
                          <span
                            className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200 ring-1 ring-amber-500/40"
                            title={`Saunafest: ${festAblaufText(ctx.fest)}`}
                          >
                            🔥 Saunafest · {ctx.fest.motto}
                          </span>
                        )}
                      </div>
                      {ctx.isPast && !isToday && (
                        <span className="text-[10px] text-forest-500">vergangen</span>
                      )}
                    </div>
                    {/* Saunafest (0163): im Tagesplaner wird am Fest nicht gebucht —
                        Zeitraum, Lieblingssauna und Hinweis trägt jeder im Bereich
                        „Saunafest" ein, der Admin teilt ein. */}
                    {festGesperrt && ctx.fest && (
                      <div className="mb-3 rounded-xl bg-gradient-to-r from-amber-950/70 to-forest-950/60 p-3 ring-1 ring-amber-500/40">
                        <p className="text-sm font-semibold text-amber-100">{FEST_NICHT_BUCHEN}</p>
                        {ctx.fest.plan_bestaetigt_at && (
                          <p className="mt-1 text-xs text-amber-200/90">
                            Der Plan steht — deine Einteilung und die Angaben fürs Schild findest du dort.
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-amber-200/70">{festAblaufText(ctx.fest)}</p>
                        {darfSaunafest && (
                          <button
                            type="button"
                            onClick={() => jumpToZone('saunafest')}
                            className="mt-2 min-h-[44px] w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-amber-950 hover:bg-amber-400 active:scale-[0.99] transition"
                          >
                            Zum Saunafest-Bereich →
                          </button>
                        )}
                      </div>
                    )}
                    {/* Admins buchen am Fest weiter direkt (nur Kacheln aus dem
                        Festraster). Einteilen nach den eingetragenen Zeiträumen
                        läuft im Bereich „Saunafest". */}
                    {ctx.fest && !festGesperrt && !ctx.isPast && (
                      <p className="-mt-1 mb-2 text-[11px] text-amber-200/80">
                        {festAblaufText(ctx.fest)}. Als Admin buchst du hier direkt; eingeteilt nach Zeiträumen wird im{' '}
                        <button
                          type="button"
                          onClick={() => jumpToZone('saunafest')}
                          className="font-semibold text-amber-100 underline decoration-amber-400/60 underline-offset-2 hover:text-amber-50"
                        >
                          Bereich „Saunafest“
                        </button>.
                      </p>
                    )}

                    {ctx.isMonday ? (
                      <div className="rounded-lg bg-forest-900/40 px-3 py-3 text-center text-[11px] text-forest-400/70 ring-1 ring-forest-800/30">
                        Montag — Ruhetag, keine Aufgüsse
                      </div>
                    ) : (
                      <>
                        {/* Mobile: 2 Saunen NEBENEINANDER mit zeit-synchroner
                            linker Zeit-Spalte. Eine gemeinsame Grid-Matrix
                            statt gestapelter SaunaSlotRows. */}
                        <div className="lg:hidden">
                          <DaySaunaMatrix
                            saunas={saunenHeute}
                            slots={ctx.availableSlots}
                            selectedSaunaId={isSelected && !festGesperrt ? saunaId : ''}
                            selectedSlot={isSelected && !festGesperrt ? slot : ''}
                            slotStatus={(saunaIdLookup, hhmm) => slotStatusFor(d, saunaIdLookup, hhmm)}
                            secondarySaunaBlocked={secondaryBlockedForDay}
                            garantieSlotsOpenToday={ctx.garantieSlotsOpen}
                            onPick={(pickedSaunaId, picked) => pickSlot(d, pickedSaunaId, picked)}
                          />
                        </div>
                        {/* Desktop: bestehendes Stapeln pro Sauna mit breitem
                            horizontalen Slot-Grid bleibt unverändert. */}
                        <div className="hidden lg:block space-y-1.5">
                          {saunenHeute.map((s) => (
                            <SaunaSlotRow
                              key={s.id}
                              sauna={s}
                              slots={ctx.availableSlots}
                              selectedSaunaId={isSelected && !festGesperrt ? saunaId : ''}
                              selectedSlot={isSelected && !festGesperrt ? slot : ''}
                              slotStatus={(saunaIdLookup, hhmm) => slotStatusFor(d, saunaIdLookup, hhmm)}
                              secondarySaunaBlocked={secondaryBlockedForDay}
                              garantieSlotsOpenToday={ctx.garantieSlotsOpen}
                              onPick={(picked) => pickSlot(d, s.id, picked)}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {isMondaySelected ? (
              <div className="rounded-xl bg-forest-900/60 px-4 py-3 text-center text-forest-300/70 ring-1 ring-forest-800/40 text-xs">
                Bitte zuerst einen Slot in der Wochen-Übersicht oben wählen — Montag ist Ruhetag.
              </div>
            ) : selectedDayCtx.fest && !isAdmin ? (
              // Saunafest (0163): für Nicht-Admins gibt es an diesem Tag nichts
              // zu buchen — kein Schritt 2 (die Hinweiskarte oben erklärt es).
              // submit() fängt denselben Fall zusätzlich ab.
              null
            ) : (
              <>
                {/* ── BANJA-RITUAL QUICK-ACTION ─────────────────────────────
                    Seit 08.08.2026 frei planbar: der Knopf richtet sich nach
                    dem, was oben in der Matrix gewaehlt ist — Sauna und Slot
                    kommen von dort, die Dauer aus der Startstunde. Vorher war
                    beides fest auf 19:00 in der 80°C-Sauna verdrahtet.       */}
                {(() => {
                  const banjaSauna = saunas.find((s) => s.id === saunaId && s.is_active);
                  if (!banjaSauna) return null;
                  // Ohne Freigabe (0148) keine Karte — die Sperre sitzt im
                  // DB-Trigger, aber ein Knopf, der garantiert ins rote
                  // Fenster führt, wäre eine Falle statt einer Funktion.
                  if (!(m?.darf_banja || isAdmin)) {
                    return (
                      <p className="text-[11px] text-forest-400/80">
                        ♨️ Das Banja-Ritual (mit Wenikaufguss) darf nur anbieten, wer vom Admin dafür freigegeben ist.
                      </p>
                    );
                  }
                  const startStunde = selectedSlotHour;
                  const dauer = banjaDauerFuer(startStunde);
                  // Ritual-Kacheln (2) plus die Ruhestunde danach — dieselbe
                  // Prüfung wie beim Absenden (banjaKonflikt).
                  const ritualStunden = Math.ceil(dauer / 60);
                  const stati = Array.from({ length: ritualStunden + BANJA_RUHE_STUNDEN }, (_, k) =>
                    slotStatusFor(selectedDate, banjaSauna.id, `${String(startStunde + k).padStart(2, '0')}:00`));
                  const banjaStart = new Date(selectedDate);
                  banjaStart.setHours(startStunde, 0, 0, 0);
                  const isInPast = banjaStart.getTime() < Date.now();
                  // An normalen Tagen ist um 20:30 Schluss (am Fest nicht).
                  const endetRechtzeitig = !!selectedDayCtx.fest || banjaEndetRechtzeitig(startStunde);
                  const konflikt = banjaKonflikt(selectedDate, banjaSauna.id, startStunde);
                  // Personal-Aufguesse im Ritual und in der Ruhestunde raeumt
                  // book_banja_ritual atomar ab.
                  const takesOverFallback = stati.some((st) => st.kind === 'fallback');
                  // Admins dürfen immer (0183); alle anderen sehen die Karte nur
                  // mit Banja-Freigabe (Abfrage oben).
                  const canBook = (isAufgieser || isAdmin) && !konflikt && endetRechtzeitig && !isInPast;

                  let hint = '';
                  if (isInPast) hint = '⏱️ Dieser Slot ist bereits vorbei.';
                  else if (!endetRechtzeitig) hint = BANJA_SCHLUSS_HINWEIS;
                  else if (konflikt) hint = '🔴 ' + konflikt;
                  else if (!isAufgieser && !isAdmin) hint = 'Nur Aufgießer dürfen Banja anlegen.';
                  else if (takesOverFallback) hint = '👨‍🍳 Personal-Aufguss wird automatisch übernommen.';

                  return (
                    <div
                      className={`rounded-2xl p-4 ring-1 backdrop-blur transition ${
                        canBook
                          ? 'bg-gradient-to-br from-rose-950/60 via-amber-950/40 to-forest-950/60 ring-rose-500/40'
                          : 'bg-forest-950/40 ring-forest-800/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-3xl flex-shrink-0">♨️</div>
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-sm font-bold ${canBook ? 'text-rose-100' : 'text-forest-300'}`}>
                            Spezial: Traditionelles Banja-Ritual
                          </h3>
                          <p className={`text-[11px] mt-0.5 ${canBook ? 'text-rose-200/80' : 'text-forest-400/70'}`}>
                            {dauer} Min · ab {String(startStunde).padStart(2, '0')}:00 Uhr · {banjaSauna.name}
                            {' '}· 2 Kacheln + {BANJA_RUHE_STUNDEN} h Ruhe danach
                          </p>
                          {hint && (
                            <p className="text-[10px] mt-1 text-forest-400">{hint}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={!canBook}
                          onClick={() => {
                            setSelectedDate(selectedDate);
                            setSaunaId(banjaSauna.id);
                            setDuration(dauer);
                            setTitle(BANJA_TITLE_DEFAULT);
                            setAttrs([BANJA_ATTR, 'wenik']);
                          }}
                          className={`flex-shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                            canBook
                              ? 'bg-rose-600 text-white hover:bg-rose-500 active:scale-95'
                              : 'bg-forest-900/60 text-forest-500 cursor-not-allowed'
                          }`}
                        >
                          Banja buchen
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* ── SCHRITT 2: gewählten Slot zusammenfassen + Details ──
                    Vorher war nirgends sichtbar WAS man in der Matrix oben
                    angeklickt hat — man musste hochscrollen und den
                    markierten Slot suchen. */}
                {(() => {
                  const saunaSel = saunas.find((s) => s.id === saunaId);
                  const dayLbl = dayOffset === 0 ? 'Heute' : dayOffset === 1 ? 'Morgen'
                    : `${WEEKDAY_LABEL_DE_SHORT[selectedDate.getDay()]} ${format(selectedDate, 'dd.MM.')}`;
                  return (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-sky-500/10 px-3 py-2.5 ring-1 ring-sky-500/30">
                      <span aria-hidden>📍</span>
                      <span className="text-xs font-semibold text-sky-200">Gewählt:</span>
                      <span className="text-sm font-semibold text-forest-50 tabular-nums">{dayLbl} · {slot} Uhr</span>
                      {saunaSel && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[11px] font-mono tabular-nums"
                          style={{ background: `${saunaSel.accent_color}22`, color: saunaSel.accent_color }}
                        >
                          {saunaSel.name} {saunaSel.temperature_label}
                        </span>
                      )}
                      {selectedFallbackId && (
                        <span className="text-[11px] font-semibold text-amber-300">🔄 Personal-Übernahme</span>
                      )}
                    </div>
                  );
                })()}

                <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-sky-300/90 pt-1">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 ring-1 ring-sky-500/40 text-[10px] text-sky-200">2</span>
                  Details eintragen
                </p>

                {/* Banja gewählt: sichtbar machen und wieder abwählbar — sonst
                    wurde jeder weitere Aufguss still zum Banja. */}
                {isBanjaPlanned && (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-100 ring-1 ring-rose-500/40">
                    <span className="font-semibold">
                      ♨️ Banja-Ritual gewählt ({banjaDauerFuer(selectedSlotHour)} Min ab {String(selectedSlotHour).padStart(2, '0')}:00 Uhr, mit Wenik)
                    </span>
                    <button
                      type="button"
                      onClick={banjaAbwaehlen}
                      className="flex-shrink-0 rounded-md bg-forest-900/70 px-2.5 py-1.5 text-[11px] font-medium text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-900"
                    >
                      ✕ Doch kein Banja
                    </button>
                  </div>
                )}

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
                    <p className="font-semibold">⛔ Diese Stunde ist gesperrt.</p>
                    <p className="mt-0.5 text-amber-200/80">
                      Für {String(selectedSlotHour).padStart(2,'0')}:00 ist die Garantie-Sauna ({garantieSlotsOpenToday.find((g) => g.hour === selectedSlotHour)?.saunaName ?? '—'}) noch nicht durch einen Aufgießer belegt. Erst diesen gelben Slot oben übernehmen — andere Stunden des Tages sind frei.
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-forest-300">Titel</label>
                    <button
                      type="button"
                      onClick={() => setTitlePickerOpen(true)}
                      disabled={attrs.length === 0 && oils.every((o) => !o) && !schnaps}
                      title="Öffnet 5 KI-Vorschläge in unterschiedlichen Stilen (poetisch, kurz, mystisch, sinnlich, frech). Bei API-Outage Fallback auf regelbasiert."
                      className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      ✨ Vorschlagen
                    </button>
                  </div>
                  {/* iPhone-fest (18.09.2026): 16 px Schrift, sonst zoomt iOS beim
                      Antippen ins Feld und die Seite springt; und „Return" auf der
                      iOS-Tastatur darf das halb ausgefüllte Formular nicht absenden —
                      es schließt nur die Tastatur. */}
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                    enterKeyHint="done" autoComplete="off" maxLength={80}
                    placeholder="z.B. Zirbelkiefer und kein Zurück mehr"
                    className="mt-1.5 w-full rounded-lg bg-forest-900/80 px-3 py-2.5 text-base sm:text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400" />
                </div>
                {titlePickerOpen && (
                  <TitleSuggestionPicker
                    /* Was es schon gibt, soll nicht nochmal vorgeschlagen
                       werden — die Liste liegt ohnehin im Speicher. */
                    vorhandeneTitel={infusions
                      .map((x) => x.title)
                      .filter((t): t is string => !!t)}
                    /* ALLES mitgeben, nicht nur Standard-Besonderheiten und
                       Oele: vorher fehlten eigene Buttons, eigene Oele, der
                       Schnaps, der Sud und das Raeucherwerk komplett — ein
                       Kirschwasser-Aufguss mit Rosmarin-Sud erzeugte denselben
                       Titel wie ein leerer. */
                    zutaten={zutatenAus({
                      attrs,
                      customAttrIds,
                      oils,
                      schnaps,
                      sudAuswahl,
                      customAttrs,
                      customOils: myOilsQ.data ?? [],
                      sudKraeuter: sudKraeuterQ.data ?? [],
                      sudMixe: sudMixeQ.data ?? [],
                      sauna: saunas.find((x) => x.id === saunaId) ?? null,
                      zeitpunkt: slotToDate(selectedDate, slot),
                    })}
                    onPick={(t) => { setTitle(t); setTitlePickerOpen(false); }}
                    onClose={() => setTitlePickerOpen(false)}
                  />
                )}

                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <label className="text-xs text-forest-300">Besonderheiten</label>
                    {/* Laufender Zähler statt Fehlermeldung erst beim Absenden —
                        die Pflicht ist sonst unsichtbar, bis es zu spät ist.
                        Zeigt getrennt, was noch fehlt: Öle und Besonderheiten
                        sind seit 09.09.2026 zwei eigene Pflichten. */}
                    <span className={`text-[11px] tabular-nums ${
                      fehlt.oele > 0 || fehlt.besonderheiten > 0 ? 'text-amber-300'
                        : auswahlVoll ? 'text-forest-400/70' : 'text-forest-300/70'
                    }`}>
                      {auswahlAnzahl}/{MAX_AUSWAHL} gewählt
                      {fehlt.oele > 0 || fehlt.besonderheiten > 0
                        ? ` — noch ${[
                          fehlt.oele > 0 ? `${fehlt.oele} ${fehlt.oele === 1 ? 'Öl' : 'Öle'}` : null,
                          fehlt.besonderheiten > 0
                            ? `${fehlt.besonderheiten} ${fehlt.besonderheiten === 1 ? 'Besonderheit' : 'Besonderheiten'}`
                            : null,
                        ].filter(Boolean).join(' und ')} nötig`
                        : auswahlVoll ? ' — voll' : ''}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-forest-400/60">
                    Pflicht: {PFLICHT_OELE} Öle und {PFLICHT_BESONDERHEITEN} Besonderheiten.
                    Bei Räuchern, Sud, Schnaps und reinem Kräuteraufguss (Schalter im Öle-Reiter) entfällt die Öl-Pflicht.
                    Höchstens {MAX_AUSWAHL} Dinge zusammen.
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {/* hidden  = Kirschwasser/Haferpflaume/Räuchern — laufen über
                            die Reiter weiter unten (lib/attributes.ts).
                        retired = ausgemustert, siehe dort.
                        automatisch = Banja + Wenik: nur über die Banja-
                            Spezialkarte, nie als Chip (13.09.2026). */}
                    {ATTRIBUTE_CHIPS
                      .map((a) => {
                      const active = attrs.includes(a.id);
                      const gesperrt = !active && auswahlVoll;
                      return (
                        <button key={a.id} type="button" onClick={() => toggleAttr(a.id)}
                          disabled={gesperrt}
                          title={gesperrt ? `Höchstens ${MAX_AUSWAHL} Dinge — erst etwas abwählen.` : undefined}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs ring-1 transition ${
                            active ? 'bg-forest-500 text-forest-950 ring-forest-400' : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                          } ${gesperrt ? 'opacity-30 cursor-not-allowed hover:bg-forest-900/60' : ''}`}>
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
                        const gesperrt = !active && auswahlVoll;
                        return (
                          <button key={a.id} type="button" onClick={() => toggleCustomAttr(a.id)}
                            disabled={gesperrt}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs ring-1 transition${gesperrt ? ' opacity-30 cursor-not-allowed' : ''}`}
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

                {/* Aroma-Bereich mit drei Reitern: Öle · Schnaps · Räuchern.
                    Die Reiter schalten nur die Sicht — mehreres darf gleichzeitig
                    gesetzt sein, der Punkt auf dem inaktiven Reiter zeigt das an. */}
                <div>
                  <div className="flex gap-1.5 rounded-xl bg-forest-950/60 p-1 ring-1 ring-forest-800/50">
                    {([
                      { id: 'oils',      icon: '🌿', label: 'Öle',      filled: oils.some(Boolean) || kraeuterOn },
                      { id: 'schnaps',   icon: '🥃', label: 'Schnaps',  filled: !!schnaps },
                      { id: 'raeuchern', icon: '💨', label: 'Räuchern', filled: raeuchernOn },
                      { id: 'sud',       icon: '🧪', label: 'Sud',       filled: sudAuswahl.length > 0 },
                    ] as const).map((t) => {
                      const active = aromaTab === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setAromaTab(t.id)}
                          className={`relative flex-1 rounded-lg px-2 py-2 text-xs font-medium transition ${
                            active
                              ? 'bg-forest-500 text-forest-950'
                              : 'text-forest-300 hover:bg-forest-900/70'
                          }`}
                        >
                          <span aria-hidden className="mr-1">{t.icon}</span>{t.label}
                          {!active && t.filled && (
                            <span aria-hidden className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {aromaTab === 'oils' ? (
                    <div className="mt-2">
                      <label className="text-xs text-forest-300">Ätherische Öle <span className="text-forest-400/60">— eines pro Runde (max. 3, zählt aufs Kontingent)</span></label>
                      {/* Reiner Kräuteraufguss: keine Öl-Plätze — „rein" heißt ohne Öl. */}
                      {!kraeuterOn && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {oils.map((id, i) => {
                          // Eigene Öle stehen als custom:<uuid> im Platz (OilPicker
                          // „Meine Öle"). Sie zählen aufs Kontingent und müssen auch
                          // als belegt erscheinen — vorher zeigte der Chip „+ Öl
                          // wählen" und war bei vollem Kontingent sogar gesperrt
                          // (Audit-Runde 2, 25.09.2026). Gesperrt wird nur ein
                          // wirklich LEERER Platz.
                          const eigenesUuid = id ? parseCustomOilId(id) : null;
                          const o = id && !eigenesUuid ? OIL_BY_ID[id] : null;
                          const eigenes = eigenesUuid
                            ? (myOilsQ.data ?? []).find((x) => x.id === eigenesUuid) ?? null
                            : null;
                          const gesperrt = !id && auswahlVoll;
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setShowOilPicker(true)}
                              disabled={gesperrt}
                              title={gesperrt ? VOLL_HINWEIS : undefined}
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs ring-1 transition ${gesperrt ? 'opacity-30 cursor-not-allowed ' : ''}${
                                id
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
                              ) : eigenes ? (
                                <>
                                  <span aria-hidden>🌿 {eigenes.emoji}</span>
                                  <span>{eigenes.name}</span>
                                  <span className="text-[10px] opacity-70">(meins)</span>
                                </>
                              ) : id ? (
                                // Eigenes Öl noch nicht geladen oder inzwischen
                                // gelöscht (Vorlage nennt es noch): trotzdem belegt.
                                <span>🌿 {eigenesUuid ? 'eigenes Öl' : 'unbekanntes Öl'}</span>
                              ) : (
                                <span>+ Öl wählen</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      )}
                      <KraeuterSchalter
                        an={kraeuterOn}
                        onToggle={() => {
                          const neu = kraeuterUmschalten(auswahl);
                          if (!neu) { setFormError(VOLL_HINWEIS); return; }
                          setAttrs(neu.attrs);
                          setOils(neu.oils);
                        }}
                      />
                    </div>
                  ) : aromaTab === 'schnaps' ? (
                    <div className="mt-2">
                      <label className="text-xs text-forest-300">Schnaps-Sorte <span className="text-forest-400/60">— eine pro Aufguss</span></label>
                      <select
                        value={schnaps ?? ''}
                        onChange={(e) => setSchnaps(e.target.value || null)}
                        className="mt-1.5 w-full rounded-lg bg-forest-900/80 px-3 py-2.5 text-base sm:text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
                      >
                        <option value="">— kein Schnaps —</option>
                        {SCHNAPS.map((s) => (
                          <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
                        ))}
                      </select>
                      {selectedSchnaps && (
                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white"
                            style={{ background: selectedSchnaps.color, boxShadow: `0 0 0 2px ${selectedSchnaps.color}55` }}
                          >
                            🥃 {selectedSchnaps.name}-Aufguss
                          </span>
                          <span className="text-[11px] text-forest-400/70">erscheint mit Fruchtbild auf der Tafel</span>
                        </div>
                      )}
                    </div>
                  ) : aromaTab === 'sud' ? (
                    <SudPicker
                      auswahl={sudAuswahl}
                      onChange={setSudAuswahl}
                      memberId={m?.id ?? ''}
                      istAdmin={isAdmin}
                      voll={auswahlVoll}
                      vollHinweis={VOLL_HINWEIS}
                    />
                  ) : (
                    /* Räuchern hat keine Sorten — nur an/aus. Gespeichert wird das
                       seit jeher vorhandene Attribut 'raeuchern' (lib/aufgussTheme.ts),
                       deshalb kein eigener State. */
                    <div className="mt-2">
                      <label className="text-xs text-forest-300">Räucheraufguss</label>
                      <button
                        type="button"
                        onClick={() => toggleAttr(RAEUCHER_ATTR as InfusionAttribute)}
                        disabled={!raeuchernOn && auswahlVoll}
                        title={!raeuchernOn && auswahlVoll
                          ? VOLL_HINWEIS : undefined}
                        className="mt-1.5 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left ring-1 transition"
                        style={raeuchernOn
                          ? { background: `${RAEUCHER_THEME.color}55`, boxShadow: `inset 0 0 0 2px ${RAEUCHER_THEME.color}` }
                          : { background: 'rgba(20,83,45,0.35)', boxShadow: 'inset 0 0 0 1px rgba(20,83,45,0.7)' }}
                      >
                        <span className={`relative h-6 w-10 flex-shrink-0 rounded-full transition ${raeuchernOn ? 'bg-slate-200' : 'bg-forest-800'}`}>
                          <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${raeuchernOn ? 'translate-x-4' : ''}`} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-forest-100">💨 Räucheraufguss</span>
                          <span className="block text-[11px] text-forest-300/70">
                            {raeuchernOn ? 'erscheint mit Räucher-Bild auf der Tafel' : 'Kräuterbündel & Harz auf den Steinen'}
                          </span>
                        </span>
                      </button>

                      {/* Raeucherwerk aus demselben gemeinsamen Regal wie die
                          Sud-Kraeuter — nur nach `art` gefiltert. Erscheint
                          erst, wenn Raeuchern auch angehakt ist: ohne den
                          Aufguss waere die Auswahl gegenstandslos. */}
                      {raeuchernOn && (
                        <SudPicker
                          auswahl={sudAuswahl}
                          onChange={setSudAuswahl}
                          memberId={m?.id ?? ''}
                          istAdmin={isAdmin}
                          art="raeucher"
                          voll={auswahlVoll}
                          vollHinweis={VOLL_HINWEIS}
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setTeamInfusion((v) => !v)}>
                  <div className={`relative w-10 h-6 rounded-full transition flex-shrink-0 ${teamInfusion ? 'bg-amber-500' : 'bg-forest-800'}`}>
                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${teamInfusion ? 'translate-x-4' : ''}`} />
                  </div>
                  <span className="text-xs text-forest-200">
                    Team-Aufguss <span className="text-forest-300/60">— andere Aufgieser können mitmachen</span>
                  </span>
                </div>

                {/* Dauer-Picker — User-Wunsch: Default 20, Auswahl 20/30/45.
                    Wenn ein vorheriger Wert ungewöhnlich war (z.B. 15), wird
                    er dynamisch ergänzt damit man ihn nicht versehentlich
                    überschreibt. Beim Banja wählt niemand die Dauer — sie
                    ergibt sich aus der Startstunde (Hinweis oben). */}
                <div className={isBanjaPlanned ? 'hidden' : undefined}>
                  <label className="text-xs text-forest-300">Dauer</label>
                  <div className="mt-1.5 flex gap-1.5">
                    {DURATION_OPTIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDuration(d)}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ring-1 transition ${
                          duration === d
                            ? 'bg-amber-500 text-amber-950 ring-amber-300'
                            : 'bg-forest-900/60 text-forest-300 ring-forest-700/50 hover:bg-forest-900'
                        }`}
                      >
                        {d} Min
                      </button>
                    ))}
                    {/* Falls Dauer aus Alt-Daten (15/25/60 etc.) gewählt war,
                        bleibt sie als zusätzlicher Button sichtbar, damit
                        sie nicht versehentlich überschrieben wird. */}
                    {!(DURATION_OPTIONS as readonly number[]).includes(duration) && (
                      <button
                        type="button"
                        className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold bg-amber-500 text-amber-950 ring-1 ring-amber-300"
                      >
                        {duration} Min
                      </button>
                    )}
                  </div>
                </div>

                {/* Admin-only: Saunameister-Auswahl (default: self) */}
                {isAdmin && (
                  <div>
                    <label className="text-xs text-violet-300">⚙️ Saunameister zuweisen <span className="text-forest-400/60">(Admin)</span></label>
                    <select
                      value={adminSaunameisterId || m?.id || ''}
                      onChange={(e) => setAdminSaunameisterId(e.target.value)}
                      className="mt-1.5 w-full rounded-lg bg-forest-900/80 px-3 py-2.5 text-base sm:text-sm ring-1 ring-violet-700/40 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    >
                      {m && <option value={m.id}>{m.sauna_name || m.name} (du)</option>}
                      {(meisterDir.data ?? [])
                        .filter((x) => x.id !== m?.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>{x.name}</option>
                        ))}
                    </select>
                  </div>
                )}

                {formError && (
                  <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/30">{formError}</div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                  <button
                    type="submit"
                    disabled={addInf.isPending || takeoverFallback.isPending || bookBanja.isPending}
                    className="flex-1 rounded-xl bg-forest-500 px-4 py-3 text-sm font-semibold text-forest-950 hover:bg-forest-400 transition disabled:opacity-60"
                  >
                    {addInf.isPending || takeoverFallback.isPending || bookBanja.isPending
                      ? 'Speichere …'
                      : isBanjaPlanned
                        ? '♨️ Banja-Ritual buchen'
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
          </HubZone>
        )}

        {/* ══ ZONE: Mein Aufguss-Atelier (nur Aufgieser) ═════════════════ */}
        {isAufgieser && (
          <HubZone id="atelier" icon="🧖" title="Mein Atelier" subtitle="Werkbank für Aufgüsse" accent="#22c55e" collapsible>
            {/* Eigene Fest-Aufgüsse (0164): nicht über die normale Bearbeiten-
                Maske (Pflichtzutaten), sondern über die Fest-Angaben fürs
                Schild und das Video. Deshalb fehlen sie in der Liste darunter. */}
            {meineFestAufguesse.length > 0 && (
              <div className="mb-3 rounded-xl bg-gradient-to-r from-amber-950/60 to-forest-950/50 p-3 ring-1 ring-amber-500/40">
                <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-amber-200/90">
                  <span aria-hidden>🔥</span>
                  <span>Meine Saunafest-Aufgüsse</span>
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {meineFestAufguesse.map((i) => {
                    const sauna = saunas.find((s) => s.id === i.sauna_id);
                    return (
                      <li
                        key={i.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-forest-950/60 px-3 py-2 ring-1 ring-amber-500/20"
                        style={{ borderLeft: `3px solid ${sauna?.accent_color ?? '#f59e0b'}` }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-amber-50">{i.title}</div>
                          <div className="text-[11px] text-amber-200/70 tabular-nums">
                            {format(new Date(i.start_time), 'EEE dd.MM. · HH:mm', { locale: de })} Uhr · {sauna?.name ?? '?'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFestInfo(i)}
                          className="min-h-[44px] rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-400 active:scale-95 transition whitespace-nowrap"
                        >
                          ✏️ Angaben fürs Schild
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <AtelierTabs
              myInfusions={myInfusionsOhneFest}
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
              onLeaveTeam={(id) => m && leaveTeam.mutate(
                { infusion_id: id, member_id: m.id },
                { onError: (e) => window.alert(`Verlassen hat nicht geklappt: ${(e as Error).message}`) },
              )}
              onApplyTemplate={(t) => applyTemplate(t)}
              onDeleteTemplate={(id) => delTpl.mutate(id, {
                onError: (e) => window.alert(`Vorlage löschen hat nicht geklappt: ${(e as Error).message}`),
              })}
              isAdmin={isAdmin}
              now={now}
            />
          </HubZone>
        )}

        {/* ══ ZONE: Stamm-Slot & Urlaub (nur Vereins-Aufgießer, NICHT Gast-Aufgießer) ═════════════════ */}
        {canApplyStammSlot && m && (
          <HubZone id="stammslot" icon="📅" title="Stamm-Slot & Urlaub" subtitle="Feste Wochenslots beantragen · Abwesenheit eintragen" accent="#fbbf24" collapsible defaultCollapsed>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <StammSlotPanel
                slots={myRecurringQ.data ?? []}
                saunas={saunas}
                templates={myTemplates}
                onApply={async (p) => {
                  try {
                    const slotId = await applyRecurring.mutateAsync(p);
                    // Push nur an die Admins (vorher an alle Abonnenten); Text baut der Server.
                    if (slotId) sendVorlagePush({ vorlage: 'stammslot_antrag', slot_id: slotId }).catch(() => {});
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
                      // Push an die anderen Aufgießer; Text und Liste baut der Server (Vorlage).
                      if (result.absence_id) sendVorlagePush({ vorlage: 'urlaubsslots', absence_id: result.absence_id }).catch(() => {});
                      window.alert(`${result.freed_slots.length} Slot${result.freed_slots.length === 1 ? '' : 's'} freigegeben — andere Aufgießer wurden benachrichtigt.`);
                    } else {
                      window.alert('Urlaub eingetragen. Keine Stamm-Slots in diesem Zeitraum betroffen.');
                    }
                  } catch (e) { window.alert((e as Error).message); }
                }}
                onDelete={async (id) => {
                  if (!confirm('Urlaubseintrag löschen? Deine Stamm-Aufgüsse in diesem Zeitraum bekommst du zurück, soweit sie noch niemand übernommen hat.')) return;
                  try { await deleteAbsence.mutateAsync(id); }
                  catch (e) { window.alert((e as Error).message); }
                }}
              />
            </div>
          </HubZone>
        )}

        {/* ══ ZONE: Mein Profil & Erfolge ═════════════════════════════════ */}
        {m && (
          <HubZone id="profil" icon="🏆" title="Mein Profil & Erfolge" subtitle="Identität · Bewertungen · Trophäen" accent="#a78bfa" collapsible defaultCollapsed>
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
                        className={`flex-1 rounded-lg bg-forest-900/80 px-3 py-2 text-base sm:text-sm ring-1 focus:outline-none focus:ring-2 transition-colors ${
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
                        <button
                          disabled={updateEntryCode.isPending}
                          onClick={async () => {
                            if (!m) return;
                            setCodeError(null);
                            // Wie saveEntryCode: Fehler sichtbar machen statt
                            // still zu verschlucken (Editor bleibt dann offen).
                            try {
                              await updateEntryCode.mutateAsync({ id: m.id, entry_code: null });
                              setEditingCode(false);
                            } catch (e) { setCodeError(`Löschen hat nicht geklappt: ${(e as Error).message}`); }
                          }}
                          className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/25 disabled:opacity-50">
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

      {/* Nachpflegen aus der Liste ganz oben — derselbe Dialog wie im Atelier,
          damit es nur eine Bearbeiten-Maske gibt. Fest-Aufgüsse stehen nicht
          in der Liste; falls doch einer hierher kommt, öffnen die Fest-Angaben
          (am Fest gelten die Pflichtzutaten nicht). */}
      {nachpflege && (festAm(new Date(nachpflege.start_time)) ? (
        <FestAufgussInfoDialog
          infusion={nachpflege}
          onClose={() => setNachpflege(null)}
        />
      ) : (
        <EditInfusionModal
          infusion={nachpflege}
          onClose={() => setNachpflege(null)}
          onSaved={() => setNachpflege(null)}
        />
      ))}

      {/* Fest-Angaben aus „Meine Saunafest-Aufgüsse" im Atelier (0164). */}
      {festInfo && (
        <FestAufgussInfoDialog
          infusion={festInfo}
          onClose={() => setFestInfo(null)}
        />
      )}

      {banjaAlarm && (
        <BanjaAlarm grund={banjaAlarm} onClose={() => setBanjaAlarm(null)} />
      )}
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

          // Continuation-Skip: vorherige Mehrstunden-Infusion (z.B. Banja 19:00)
          // covered diesen Slot — wird via col-span vorher gerendert.
          if (status.kind === 'taken' || status.kind === 'mine' || status.kind === 'fallback') {
            const infStartHour = new Date(status.infusion.start_time).getHours();
            if (infStartHour < hour) return null;
          }

          // Col-Span für Mehrstunden-Aufgüsse (Banja 90/120 Min = 2 Cols).
          const spanCols =
            (status.kind === 'taken' || status.kind === 'mine' || status.kind === 'fallback')
              ? Math.max(1, Math.ceil(status.infusion.duration_minutes / 60))
              : 1;
          const isBanjaBlock =
            (status.kind === 'taken' || status.kind === 'mine')
              && isBanjaInfusion(status.infusion);

          const isSelected = selectedSaunaId === sauna.id && selectedSlot === hhmm;
          // Ist diese Sauna die Garantie-Sauna für diesen Slot?
          const isGarantieSauna = garantieSlotsOpenToday.some((g) => g.hour === hour && g.saunaName === sauna.name);
          // Per-Stunde-Sperre (Migration 0092): blockiert nur wenn die GLEICHE
          // Stunde noch einen offenen Garantie-Slot in einer anderen Sauna hat.
          // Andere Stunden sind unabhängig — niemand wird mehr global gesperrt.
          const hourHasOpenGarantie = garantieSlotsOpenToday.some((g) => g.hour === hour);
          const blockedBySecondary =
            secondarySaunaBlocked && !isGarantieSauna && status.kind === 'free' && hourHasOpenGarantie;

          const v = slotVisualFor(status, blockedBySecondary);
          let { bg, text, ring } = v;
          if (isSelected) {
            bg = 'bg-forest-500';
            text = 'text-forest-950';
            ring = 'ring-forest-400 ring-2';
          }
          if (isBanjaBlock) {
            bg = 'bg-gradient-to-br from-rose-700/40 via-rose-600/30 to-amber-700/30';
            text = 'text-rose-50';
            ring = 'ring-rose-400/60 ring-2';
          }

          return (
            <button
              key={hhmm}
              type="button"
              disabled={v.disabled}
              onClick={() => onPick(hhmm)}
              title={isBanjaBlock ? `♨️ Banja-Ritual — ${(status as { infusion: Infusion }).infusion.title}` : v.title}
              style={spanCols > 1 ? { gridColumn: `span ${spanCols}` } : undefined}
              className={`relative rounded-lg min-h-[44px] px-2 py-2 text-sm lg:text-xs font-mono tabular-nums ring-1 transition ${bg} ${text} ${ring} ${v.disabled && !isBanjaBlock ? 'cursor-not-allowed opacity-60' : 'hover:brightness-125 active:scale-95'} ${isSelected ? 'font-bold' : ''}`}
            >
              {isBanjaBlock ? (
                <span className="flex items-center justify-center gap-1.5 font-bold">
                  <span>♨️</span>
                  <span className="uppercase tracking-wider text-[10px]">Banja {(status as { infusion: Infusion }).infusion.duration_minutes} Min</span>
                </span>
              ) : (
                <>
                  {hhmm}
                  {v.icon && <span className="absolute -bottom-0.5 right-0.5 text-[8px]">{v.icon}</span>}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mobile Sauna-Matrix (2 Spalten zeit-synchron) ────────────────────────────
// Eine gemeinsame Grid-Tabelle für alle aktiven Saunen eines Tages: Zeit-Spalte
// links + 1 Spalte pro Sauna. Slot 14:00 Sauna A steht damit auf gleicher Höhe
// wie Slot 14:00 Sauna B. Wird nur unter `lg`-Breakpoint gerendert; Desktop
// nutzt weiter die gestapelten SaunaSlotRows.

function DaySaunaMatrix({
  saunas,
  slots,
  selectedSaunaId,
  selectedSlot,
  slotStatus,
  secondarySaunaBlocked,
  garantieSlotsOpenToday,
  onPick,
}: {
  saunas: Sauna[];
  slots: string[];
  selectedSaunaId: string;
  selectedSlot: string;
  slotStatus: (saunaId: string, hhmm: string) => SlotStatus;
  secondarySaunaBlocked: boolean;
  garantieSlotsOpenToday: { hour: number; saunaName: string; tempC: 80 | 100 }[];
  onPick: (saunaId: string, hhmm: string) => void;
}) {
  return (
    <div
      className="grid gap-1 rounded-xl bg-forest-900/40 p-2 ring-1 ring-forest-800/40"
      style={{ gridTemplateColumns: `auto repeat(${saunas.length}, minmax(0, 1fr))` }}
    >
      {/* Header-Row: leere Zeit-Zelle + 1 Header pro Sauna */}
      <div className="sticky top-0 z-10 bg-forest-900/85 backdrop-blur-sm rounded-md px-1 py-1.5" aria-hidden />
      {saunas.map((s) => (
        <div
          key={`h-${s.id}`}
          className="sticky top-0 z-10 bg-forest-900/85 backdrop-blur-sm rounded-md px-1 py-1.5 flex items-center justify-center gap-1 min-w-0"
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: s.accent_color, boxShadow: `0 0 4px ${s.accent_color}` }}
          />
          <span className="text-[10px] font-bold text-forest-100 truncate">{s.name.slice(0, 3)}</span>
          <span
            className="text-[9px] px-1 py-0.5 rounded font-mono tabular-nums"
            style={{ background: `${s.accent_color}22`, color: s.accent_color }}
          >
            {s.temperature_label}
          </span>
        </div>
      ))}

      {/* Body: pro Slot-Stunde eine Row */}
      {slots.flatMap((hhmm) => {
        const hour = Number(hhmm.split(':')[0]);
        const cells: React.ReactNode[] = [
          <div
            key={`t-${hhmm}`}
            className="px-2 py-2 text-xs font-mono tabular-nums text-forest-200 flex items-center justify-end"
          >
            {hhmm}
          </div>,
        ];
        for (const s of saunas) {
          const status = slotStatus(s.id, hhmm);

          // ── Continuation-Skip: dieser Slot wird von einer vorherigen
          //    Mehrstunden-Infusion (z.B. Banja 19:00 covers 20:00) bereits
          //    via row-span gerendert. Zelle hier auslassen damit Grid
          //    sauber bleibt.
          if (status.kind === 'taken' || status.kind === 'mine' || status.kind === 'fallback') {
            const infStartHour = new Date(status.infusion.start_time).getHours();
            if (infStartHour < hour) continue;
          }

          // ── Row-Span für Banja (90/120 Min = 2 Slots). Generisch: ceil(dur/60).
          const spanRows =
            (status.kind === 'taken' || status.kind === 'mine' || status.kind === 'fallback')
              ? Math.max(1, Math.ceil(status.infusion.duration_minutes / 60))
              : 1;
          const isBanjaBlock =
            (status.kind === 'taken' || status.kind === 'mine')
              && isBanjaInfusion(status.infusion);

          const isSelected = selectedSaunaId === s.id && selectedSlot === hhmm;
          const isGarantieSauna = garantieSlotsOpenToday.some(
            (g) => g.hour === hour && g.saunaName === s.name,
          );
          const hourHasOpenGarantie = garantieSlotsOpenToday.some((g) => g.hour === hour);
          const blockedBySecondary =
            secondarySaunaBlocked && !isGarantieSauna && status.kind === 'free' && hourHasOpenGarantie;

          const v = slotVisualFor(status, blockedBySecondary);
          let { bg, text, ring } = v;
          if (isSelected) {
            bg = 'bg-forest-500';
            text = 'text-forest-950';
            ring = 'ring-forest-400 ring-2';
          }

          // Banja-Block: kräftiges Rose-Visual mit Hero-Label "♨️ BANJA" + echter Dauer
          if (isBanjaBlock) {
            bg = 'bg-gradient-to-br from-rose-700/40 via-rose-600/30 to-amber-700/30';
            text = 'text-rose-50';
            ring = 'ring-rose-400/60 ring-2';
          }

          cells.push(
            <button
              key={`s-${s.id}-${hhmm}`}
              type="button"
              disabled={v.disabled}
              onClick={() => onPick(s.id, hhmm)}
              title={isBanjaBlock ? `♨️ Banja-Ritual — ${(status as { infusion: Infusion }).infusion.title}` : v.title}
              style={spanRows > 1 ? { gridRow: `span ${spanRows}` } : undefined}
              className={`relative rounded-lg min-h-[44px] px-1.5 py-1.5 text-xs font-mono tabular-nums ring-1 transition flex flex-col items-center justify-center gap-0.5 ${bg} ${text} ${ring} ${v.disabled && !isBanjaBlock ? 'cursor-not-allowed opacity-60' : 'active:scale-95'} ${isSelected ? 'font-bold' : ''}`}
            >
              {isBanjaBlock ? (
                <>
                  <span className="text-base">♨️</span>
                  <span className="text-[9px] font-black uppercase tracking-wider">Banja</span>
                  <span className="text-[8px] opacity-80">{(status as { infusion: Infusion }).infusion.duration_minutes} Min</span>
                </>
              ) : (
                <span className="flex items-center gap-1">
                  <span>{hhmm}</span>
                  {v.icon && <span className="text-[10px]">{v.icon}</span>}
                </span>
              )}
            </button>,
          );
        }
        return cells;
      })}
    </div>
  );
}

// ─── Tages-Übersicht "Heute geplant" ──────────────────────────────────────────
// Hero-Sektion oben im Planner: listet alle heutigen Aufgüsse mit Uhrzeit,
// Sauna, Aufgießer und Pills (attrs + oils). Vergangene Aufgüsse bleiben
// gedimmt sichtbar (Tagesverlauf). Beantwortet "was läuft heute?" ohne
// Wochen-Planner zu scrollen.

function DailyOverview({
  date,
  infusions,
  saunas,
  meisterNameFor,
  now,
}: {
  date: Date;
  infusions: Infusion[];
  saunas: Sauna[];
  meisterNameFor: (id: string | null) => string;
  now: Date;
}) {
  const todaysInfusions = infusions
    .filter((i) => isSameYMD(new Date(i.start_time), date))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const dateLabel = `${WEEKDAY_LABEL_DE[date.getDay()]}, ${format(date, 'dd.MM.yyyy')}`;

  return (
    <div className="rounded-2xl bg-gradient-to-b from-amber-900/30 to-forest-950/60 p-4 ring-1 ring-amber-700/30 backdrop-blur">
      <h2 className="text-sm font-semibold text-amber-100 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className="text-base">🔥</span>
        <span>Heute geplant</span>
        <span className="ml-auto text-[10px] font-normal text-forest-300 normal-case tabular-nums">{dateLabel}</span>
      </h2>
      {todaysInfusions.length === 0 ? (
        <div className="text-center text-forest-300/80 py-6 text-sm">
          🌱 Heute noch nichts geplant — sei der/die Erste!
        </div>
      ) : (
        <div className="space-y-2">
          {todaysInfusions.map((inf) => {
            const s = saunas.find((x) => x.id === inf.sauna_id);
            if (!s) return null;
            const start = new Date(inf.start_time);
            const end = new Date(inf.end_time);
            const isPast = now >= end;
            const isRunning = now >= start && now < end;
            const meister = meisterNameFor(inf.saunameister_id);
            const attrs = (inf.attributes ?? []) as string[];
            const oils = ((inf.oils ?? []).filter(Boolean) as string[]).slice(0, MAX_OIL_SLOTS);
            return (
              <div
                key={inf.id}
                className={`rounded-xl bg-forest-950/50 px-3 py-2.5 ring-1 ring-forest-800/40 transition ${isPast ? 'opacity-50' : ''}`}
                style={{ borderLeft: `3px solid ${s.accent_color}` }}
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: s.accent_color, boxShadow: `0 0 6px ${s.accent_color}` }}
                  />
                  <span className="text-sm font-mono tabular-nums font-bold text-forest-100">
                    {format(start, 'HH:mm')}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono tabular-nums"
                    style={{ background: `${s.accent_color}22`, color: s.accent_color }}
                  >
                    {s.temperature_label}
                  </span>
                  {isRunning && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500 text-emerald-950">
                      live
                    </span>
                  )}
                  {isPast && (
                    <span className="text-[9px] text-forest-500">beendet</span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-forest-50 leading-tight mb-1">{inf.title}</h3>
                <div className="text-[11px] text-forest-300 flex items-center gap-1 mb-1.5">
                  <span>👤</span>
                  <span>{meister}</span>
                  {inf.team_infusion && <span className="text-amber-400" title="Team-Aufguss">👥</span>}
                </div>
                {(attrs.length > 0 || oils.length > 0) && (
                  <div className="flex flex-wrap gap-1">
                    {attrs.map((a, i) => {
                      const std = ATTR_BY_ID[a as InfusionAttribute];
                      // Schnaps steht als 'schnaps:<slug>' im selben Array und
                      // wäre sonst ein nichtssagender ⚡-Chip.
                      const sch = SCHNAPS_BY_ID[parseSchnapsAttr(a) ?? ''];
                      return (
                        <span
                          key={`a-${i}`}
                          className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ring-1 ${
                            sch ? 'text-white ring-transparent' : 'bg-forest-900/60 text-forest-200 ring-forest-800/40'
                          }`}
                          style={sch
                            ? { background: `${sch.color}55`, boxShadow: `inset 0 0 0 1px ${sch.color}` }
                            : undefined}
                        >
                          {sch ? `🥃 ${sch.name}` : std ? `${std.emoji} ${std.label}` : '⚡'}
                        </span>
                      );
                    })}
                    {oils.map((o, i) => {
                      const std = OIL_BY_ID[o];
                      return (
                        <span
                          key={`o-${i}`}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/30 whitespace-nowrap"
                        >
                          {std ? `${std.emoji} ${std.name}` : '🌿'}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
  const [note, setNote] = useState('');
  const [templateId, setTemplateId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // Stamm-Aufgüsse trägt die App nur in der Garantie-Sauna der Stunde ein
  // (dort, wo sonst das Personal gießt) — der Server lehnt alles andere ab
  // (Migration 0184). Die Sauna ergibt sich deshalb aus Wochentag + Stunde.
  const garantieSaunaFuer = (wd: number, h: number): Sauna | undefined => {
    const temp = garantieTemperatureForWeekdayHour(wd, h);
    return temp === null ? undefined : activeSaunas.find((s) => s.temperature_label === `${temp}°C`);
  };

  // Montag ist nie ein Stamm-Tag: der Server lehnt ihn ab und die nächtliche
  // Planung legt montags nichts an — auch wenn der Montag geöffnet ist.
  const slotHours = slotHoursForWeekday(weekday);
  useEffect(() => {
    if (slotHours.length > 0 && !slotHours.includes(hour)) {
      setHour(slotHours[Math.floor(slotHours.length / 2)] ?? slotHours[0]);
    }
  }, [weekday, slotHours, hour]);
  const garantieSauna = garantieSaunaFuer(weekday, hour);

  async function submit() {
    if (!garantieSauna) return;
    setBusy(true);
    try {
      await onApply({
        weekday, hour, sauna_id: garantieSauna.id,
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
        Feste wöchentliche Aufgusszeit beantragen. Admin gibt frei. Ab der Freigabe trägt die App dich für die nächsten 8 Wochen ein, danach rollend jede Woche — in der Garantie-Sauna dieser Stunde, wo sonst das Personal gießt.
      </p>

      {slots.length > 0 && (
        <ul className="space-y-1.5">
          {slots.map((s) => {
            const saunaName = saunas.find((x) => x.id === s.sauna_id)?.name ?? '?';
            const tplName = templates.find((t) => t.id === s.template_id)?.title;
            // Alt-Anträge aus der Zeit vor 0184: andere Sauna als die
            // Garantie-Sauna → daraus entsteht nie ein Aufguss.
            const soll = s.status !== 'revoked' ? garantieSaunaFuer(s.weekday, s.slot_hour) : undefined;
            const falscheSauna = s.status !== 'revoked' && soll?.id !== s.sauna_id;
            return (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-forest-900/50 px-3 py-2 ring-1 ring-forest-800/40">
                <div className="min-w-0">
                  <div className="text-sm text-amber-100">
                    {WEEKDAY_LABEL_DE_SHORT[s.weekday]} {String(s.slot_hour).padStart(2,'0')}:00 · {saunaName}
                    {tplName && <span className="ml-1.5 text-[10px] text-emerald-300/80">📋 {tplName}</span>}
                  </div>
                  <div className="text-[10px] text-forest-400 truncate">{s.note || '—'}</div>
                  {falscheSauna && (
                    <div className="mt-0.5 text-[10px] text-rose-300">
                      ⚠️ Dieser Slot erzeugt keine Aufgüsse: {soll ? `um diese Uhrzeit ist ${soll.name} die Garantie-Sauna` : 'zu dieser Uhrzeit gibt es keinen Garantie-Aufguss'}. Bitte kündigen und neu beantragen.
                    </div>
                  )}
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
            className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-base sm:text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400">
            {[2,3,4,5,6,0].map((d) => (
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
          <div className="mt-1 w-full rounded-lg bg-forest-900/50 px-2 py-1.5 text-base sm:text-sm text-forest-100 ring-1 ring-forest-700/40">
            {garantieSauna
              ? `${garantieSauna.name} · ${garantieSauna.temperature_label}`
              : 'Zu dieser Uhrzeit gibt es keinen Garantie-Aufguss'}
          </div>
          <p className="mt-1 text-[10px] text-forest-400">
            Stamm-Slots gibt es nur in der Garantie-Sauna der gewählten Stunde — die Sauna ergibt sich deshalb von selbst.
          </p>
        </div>
        <div>
          <label className="text-[10px] text-forest-300">
            Vorlage (optional)
            {templates.length === 0 && <span className="text-forest-400/60"> — keine vorhanden, du kannst eine im Atelier anlegen</span>}
          </label>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={templates.length === 0}
            className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-base sm:text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50">
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
            className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-base sm:text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <button onClick={submit} disabled={busy || !garantieSauna}
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
  const today = berlinYmd();
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
        Urlaub eintragen. Deine Stamm-Slot-Aufgüsse in diesem Zeitraum werden automatisch freigegeben — Push geht an alle anderen Aufgießer. Löschst du den Eintrag wieder, bekommst du sie zurück, soweit sie noch niemand übernommen hat.
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
              className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-base sm:text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="text-[10px] text-forest-300">Bis</label>
            <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)}
              className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-base sm:text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-forest-300">Notiz (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200}
            placeholder="z.B. „Urlaub Ostsee"
            className="mt-1 w-full rounded-lg bg-forest-900/80 px-2 py-1.5 text-base sm:text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
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
              className="flex-1 rounded-lg bg-forest-900/80 px-3 py-2 text-base sm:text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <button onClick={() => handleSubmit(value)} disabled={busy || !value.trim()}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60">OK</button>
          </div>
        )}
      </div>
    </div>
  );
}
