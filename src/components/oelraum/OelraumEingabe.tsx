import { useEffect, useMemo, useState } from 'react';
import { addDays, format, isBefore, setHours, setMilliseconds, setMinutes, setSeconds } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Infusion, Sauna } from '@/types/database';
import type { InfusionAttribute } from '@/lib/attributes';
import { fmtClock, dayLabel } from '@/lib/time';
import { displayMemberName } from '@/lib/memberDisplay';
import { slotHoursForWeekday } from '@/lib/garantie';
import { OIL_BY_ID, MAX_OIL_SLOTS, normalizeOilSlots, parseCustomOilId } from '@/lib/oils';
import { SCHNAPS, SCHNAPS_BY_ID } from '@/lib/schnaps';
import { RAEUCHER_ATTR, RAEUCHER_THEME, BANJA_ATTR, KRAEUTER_ATTR } from '@/lib/aufgussTheme';
import { KraeuterSchalter } from '@/components/KraeuterSchalter';
import {
  MAX_AUSWAHL, VOLL_HINWEIS, ATTRIBUTE_CHIPS, fehltNoch,
  auswahlAnzahl as zaehleAuswahl, attrsPayload as baueAttrsPayload,
  zerlegeAttributes, pruefeAuswahl, kraeuterUmschalten, type ZutatenAuswahl,
} from '@/lib/aufgussRegeln';
import OilPicker from '@/components/OilPicker';
import { SudPicker } from '@/components/SudPicker';
import { TitleSuggestionPicker } from '@/components/TitleSuggestionPicker';
import { zutatenAus } from '@/lib/titelZutaten';
import {
  useAddInfusionKiosk, useUpdateInfusionKiosk, useDeleteInfusionKiosk,
  useTakeoverFallbackKiosk,
  useMyCustomAttrs, useMyCustomOils, useTemplatesKiosk,
  useSudKraeuter, useSudMixe, useSaunafestTage, saunafestAm,
  isInfusionCancelLocked, INFUSION_CANCEL_LOCK_MINUTES,
  type MeisterDirectoryEntry,
} from '@/lib/api';

/** Die Eingabe am Öl-Raum-Tablet.
 *
 *  Sie folgt seit 14.08.2026 denselben Regeln wie der Planer — vier Zutaten-
 *  Reiter, das 3–8-Kontingent, drei Öl-Plätze. Vorher galten hier andere:
 *  sechs Öl-Plätze (die Datenbank erlaubt nur drei — es rettete allein die
 *  stille Normalisierung im OilPicker), kein Kontingent, und die selbst
 *  gebauten Buttons wurden beim Absenden kommentarlos weggeworfen.
 *
 *  Seit 18.09.2026 (Vorgabe Christoph: „dieselben Auswahlmöglichkeiten wie in
 *  der Planer-App, Name aussuchen und planen") außerdem: Tagesauswahl wie im
 *  Planer statt nur Heute/Morgen, KI-Titelvorschläge, Team-Aufguss und die
 *  Vorlagen des gewählten Aufgießers. Bewusst NICHT am Tablet: Banja und
 *  der Saunafest-Zeitraum (Bereich „Saunafest“ im Planer, 0163) — beides hängt
 *  am Login (siehe unten).
 *
 *  Zwei Betriebsarten:
 *    'neu'        einen Aufguss anlegen — volles Formular
 *    'ergaenzen'  einem bestehenden Aufguss die Zutaten nachtragen — der Weg,
 *                 den die Forderungs-Anzeige anbietet. Öle, Sud, Räucherwerk
 *                 und Schnaps sind hier ergänzbar (Vorgabe 14.08.2026); fest
 *                 bleiben Zeit, Sauna und Dauer. Das Banja ist bewusst außen
 *                 vor: das ist keine Zutat, sondern eine Buchung (2 Kacheln,
 *                 Ruhephase, eigene Dauer) — die entsteht nur im Planer über
 *                 book_banja_ritual.
 */
export type EingabeAuftrag =
  | { art: 'neu' }
  | { art: 'ergaenzen'; inf: Infusion };

const DURATIONS = [20, 30, 45] as const;

/** So weit voraus wie im Planer: Mitglieder 14 Tage, Gast-Aufgießer 28. Der
 *  Planer lässt Admins 182 Tage — am Tablet wäre das eine Leiste mit einem
 *  halben Jahr Tagen; dort ist bei 28 Schluss, für mehr gibt es die App. */
function maxTageVoraus(rolle: string | undefined): number {
  return rolle === 'admin' || rolle === 'guest_aufgieser' ? 28 : 14;
}
const DEFAULT_DURATION_MIN = 20;

// Der Banja-Chip fehlt am Tablet BEWUSST: ein Banja ist eine Buchung mit
// eigenem atomarem Pfad (book_banja_ritual räumt Personal-Fallbacks, belegt
// zwei Kacheln, hängt die Ruhephase an) — die Kiosk-RPCs kennen davon nichts.
// Der Chip hier würde nur einen Aufguss erzeugen, den der BEFORE-Trigger
// ablehnt oder die Tafel falsch rendert. Im Planer bleibt Banja wählbar.
const TABLET_CHIPS = ATTRIBUTE_CHIPS.filter((a) => a.id !== BANJA_ATTR);

/** Slot → Zeitpunkt, auf die volle Minute GLATT.
 *
 *  `new Date()` bringt die aktuellen Sekunden und Millisekunden mit; setHours/
 *  setMinutes lassen sie stehen. Bis 18.09.2026 ging deshalb „18:00:37.123" an
 *  die Datenbank — und check_secondary_sauna_allowed, das den Garantie-Slot mit
 *  exakt gleicher Startzeit sucht, meldete „Zweit-Sauna gesperrt", obwohl der
 *  100°-Slot längst belegt war. In der Zweitsauna ließ sich am Tablet so noch
 *  nie neu anlegen. (create_infusion_kiosk rundet seit 0159 zusätzlich selbst.) */
function slotToDate(tagOffset: number, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return setMilliseconds(setSeconds(setMinutes(setHours(addDays(new Date(), tagOffset), h), m), 0), 0);
}

export function OelraumEingabe({
  auftrag, saunas, infusions, meister, anwesend, mondayOpen, istFeiertag,
  onMeister, onFertig, evakuierung,
}: {
  auftrag: EingabeAuftrag;
  saunas: readonly Sauna[];
  infusions: readonly Infusion[];
  meister: readonly MeisterDirectoryEntry[];
  anwesend: ReadonlySet<string>;
  mondayOpen: boolean;
  istFeiertag: (d: Date) => boolean;
  /** Meldet nach oben, wer gerade am Gerät steht — der Evakuierungs-Eintrag
   *  soll festhalten, WER ausgelöst hat. */
  onMeister: (m: { id: string; name: string } | null) => void;
  onFertig: () => void;
  evakuierung: React.ReactNode;
}) {
  const bestehend = auftrag.art === 'ergaenzen' ? auftrag.inf : null;

  // ─── Wer bin ich? ──────────────────────────────────────────────────────────
  // Seit Migration 0130 ist der Check-in die FOLGE des Eintragens, nicht mehr
  // seine Bedingung. Deshalb steht hier die ganze Aufgießer-Liste und nicht
  // mehr nur die bereits eingecheckten — sonst säße jemand ohne Handy, der
  // direkt in den Öl-Raum geht, in einer Sackgasse.
  const [meisterId, setMeisterId] = useState<string | null>(bestehend?.saunameister_id ?? null);
  const gewaehlt = useMemo(
    () => meister.find((m) => m.id === meisterId) ?? null,
    [meister, meisterId],
  );

  useEffect(() => {
    onMeister(gewaehlt ? { id: gewaehlt.id, name: gewaehlt.name } : null);
  }, [gewaehlt, onMeister]);

  const addInf = useAddInfusionKiosk(meisterId);
  const updInf = useUpdateInfusionKiosk(meisterId);
  const delInf = useDeleteInfusionKiosk(meisterId);
  const uebernahme = useTakeoverFallbackKiosk(meisterId);
  const eigeneAttrsQ = useMyCustomAttrs(meisterId);
  const eigeneAttrs = useMemo(() => eigeneAttrsQ.data ?? [], [eigeneAttrsQ.data]);
  // Für den Zähler „eigene Öle" (der Picker holt sie sich über dieselbe Query
  // noch einmal aus dem Cache) und für die Titel-KI, die Klartext-Namen braucht.
  const eigeneOeleQ = useMyCustomOils(meisterId);
  const sudKraeuterQ = useSudKraeuter();
  const sudMixeQ = useSudMixe();
  const vorlagenQ = useTemplatesKiosk(meisterId);
  const vorlagen = useMemo(() => vorlagenQ.data ?? [], [vorlagenQ.data]);
  const festeQ = useSaunafestTage();

  // ─── Formular ──────────────────────────────────────────────────────────────
  // 0 = heute, 1 = morgen, … bis maxTageVoraus(Rolle) — wie der Planer.
  const [tagOffset, setTagOffset] = useState(0);
  const [saunaId, setSaunaId] = useState<string>(bestehend?.sauna_id ?? '');
  const [slot, setSlot] = useState<string>(
    bestehend ? fmtClock(bestehend.start_time) : '15:00',
  );
  const [titel, setTitel] = useState(bestehend?.title ?? '');
  const [dauer, setDauer] = useState<number>(bestehend?.duration_minutes ?? DEFAULT_DURATION_MIN);
  const [attrs, setAttrs] = useState<InfusionAttribute[]>([]);
  const [eigeneAttrIds, setEigeneAttrIds] = useState<string[]>([]);
  const [oils, setOils] = useState<(string | null)[]>(() => normalizeOilSlots(bestehend?.oils));
  const [sudAuswahl, setSudAuswahl] = useState<string[]>([]);
  const [schnaps, setSchnaps] = useState<string | null>(null);
  const [reiter, setReiter] = useState<'oils' | 'schnaps' | 'raeuchern' | 'sud'>('oils');
  const [pickerOffen, setPickerOffen] = useState(false);
  const [titelPickerOffen, setTitelPickerOffen] = useState(false);
  const [teamAufguss, setTeamAufguss] = useState(false);
  const [vorlageId, setVorlageId] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState<{ text: string; eingecheckt: boolean } | null>(null);

  // Beim Ergänzen den Bestand ins Formular holen — aber erst, wenn die eigenen
  // Buttons geladen sind: sonst würden deren UUIDs als „unbekannt" verworfen
  // und der Aufgießer verlöre beim Speichern seine eigenen Angaben.
  const [uebernommen, setUebernommen] = useState(false);
  useEffect(() => {
    // isSuccess, nicht !isLoading: schlägt die Query nach den Retries fehl
    // (24/7-Tablet, WLAN-Aussetzer), wäre isLoading false bei data=undefined —
    // zerlegeAttributes würde dann alle eigenen Button-UUIDs verwerfen und das
    // Speichern sie still löschen. Solange nicht übernommen ist, blockt
    // absenden() den Ergänzen-Submit.
    if (!bestehend || uebernommen || !eigeneAttrsQ.isSuccess) return;
    const teile = zerlegeAttributes(bestehend.attributes, eigeneAttrs.map((a) => a.id));
    setAttrs([...teile.attrs]);
    setEigeneAttrIds([...teile.customAttrIds]);
    setSudAuswahl([...teile.sudAuswahl]);
    setSchnaps(teile.schnaps);
    setUebernommen(true);
  }, [bestehend, uebernommen, eigeneAttrsQ.isLoading, eigeneAttrs]);

  const aktiveSaunen = useMemo(() => saunas.filter((s) => s.is_active), [saunas]);
  useEffect(() => {
    if (!saunaId && aktiveSaunen[0]) setSaunaId(aktiveSaunen[0].id);
  }, [saunaId, aktiveSaunen]);

  const maxTage = maxTageVoraus(gewaehlt?.role);
  useEffect(() => { if (tagOffset > maxTage) setTagOffset(maxTage); }, [tagOffset, maxTage]);

  const datum = addDays(new Date(), tagOffset);
  const feiertag = istFeiertag(datum);
  // Saunafest (0163): am Festtag bucht niemand selbst — man trägt im Planer-
  // Bereich „Saunafest“ seinen Zeitraum ein (hängt am Login), der Admin teilt
  // ein. Das Tablet bietet an Festtagen darum keine Slots an, statt an der
  // Einteilung vorbei Aufgüsse anzulegen.
  const fest = saunafestAm(datum, festeQ.data ?? []);
  const slots = useMemo(
    () => slotHoursForWeekday(datum.getDay(), { mondayOpen, isHoliday: feiertag, saunafest: !!fest })
      .map((h) => `${String(h).padStart(2, '0')}:00`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tagOffset, mondayOpen, feiertag, !!fest],
  );
  const montagZu = datum.getDay() === 1 && !mondayOpen && !feiertag && !fest;

  // Die Tagesleiste: Heute, Morgen, dann Wochentag + Datum.
  const tage = useMemo(() => Array.from({ length: maxTage + 1 }, (_, i) => {
    const d = addDays(new Date(), i);
    const istFest = !!saunafestAm(d, festeQ.data ?? []);
    const zu = !istFest && slotHoursForWeekday(d.getDay(), { mondayOpen, isHoliday: istFeiertag(d) }).length === 0;
    return {
      offset: i,
      label: i === 0 ? 'Heute' : i === 1 ? 'Morgen' : format(d, 'EEE dd.MM.', { locale: de }),
      istFest, zu,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [maxTage, mondayOpen, festeQ.data, istFeiertag]);

  useEffect(() => {
    if (bestehend) return;
    if (slots.length > 0 && !slots.includes(slot)) {
      setSlot(slots[Math.floor(slots.length / 2)] ?? slots[0]);
    }
  }, [slots, slot, bestehend]);

  // Slot-Zustand — mit deckendem Vergleich, damit ein laufender Mehrstünder
  // (Banja: zwei Kacheln) nicht als frei gilt. Personal-Fallbacks zählen NICHT
  // als belegt, sondern als übernehmbar: an einem frisch materialisierten Tag
  // trägt JEDE Stunde einen Fallback in der Garantie-Sauna — wer sie als
  // belegt rendert, baut ein Tablet, an dem man nie etwas eintragen kann
  // (Testlauf 14.08.2026, Migration 0131).
  function slotInfo(hhmm: string): { art: 'frei' | 'belegt' | 'fallback'; fallbackId?: string } {
    const start = slotToDate(tagOffset, hhmm).getTime();
    const deckend = infusions.filter((i) =>
      i.sauna_id === saunaId &&
      i.id !== bestehend?.id &&
      Date.parse(i.start_time) <= start &&
      Date.parse(i.end_time) > start);
    if (deckend.some((i) => !i.is_personal_fallback)) return { art: 'belegt' };
    const fb = deckend.find((i) => i.is_personal_fallback);
    return fb ? { art: 'fallback', fallbackId: fb.id } : { art: 'frei' };
  }

  // ─── Kontingent ────────────────────────────────────────────────────────────
  const auswahl: ZutatenAuswahl = { attrs, customAttrIds: eigeneAttrIds, oils, sudAuswahl, schnaps };
  const anzahl = zaehleAuswahl(auswahl);
  const voll = anzahl >= MAX_AUSWAHL;
  const fehlt = fehltNoch(auswahl);

  function toggleAttr(a: InfusionAttribute) {
    setAttrs((v) => (v.includes(a) ? v.filter((x) => x !== a) : voll ? v : [...v, a]));
  }
  function toggleEigen(id: string) {
    setEigeneAttrIds((v) => (v.includes(id) ? v.filter((x) => x !== id) : voll ? v : [...v, id]));
  }

  const raeuchernAn = (attrs as string[]).includes(RAEUCHER_ATTR);
  const kraeuterAn = (attrs as string[]).includes(KRAEUTER_ATTR);
  function toggleKraeuter() {
    const neu = kraeuterUmschalten(auswahl);
    if (!neu) return;   // Kontingent voll — der Zähler oben zeigt es an
    setAttrs(neu.attrs);
    setOils(neu.oils);
  }
  const gewaehlterSchnaps = schnaps ? SCHNAPS_BY_ID[schnaps] ?? null : null;

  // Die drei Öl-Plätze — identisch im Neu-Formular (Reiter „Öle") und im
  // Nachtragen-Modus, deshalb nur einmal gebaut.
  const oelChips = (
    <div className="flex flex-wrap items-center gap-2">
      {oils.map((id, i) => {
        const eigenesId = id ? parseCustomOilId(id) : null;
        const o = id && !eigenesId ? OIL_BY_ID[id] : null;
        const gesperrt = !id && voll;
        return (
          <button key={i} type="button" disabled={gesperrt}
            onClick={() => setPickerOffen(true)}
            title={gesperrt ? VOLL_HINWEIS : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm ring-1 transition ${
              gesperrt ? 'cursor-not-allowed opacity-30 ' : ''
            }${id
              ? 'bg-amber-900/40 text-amber-100 ring-amber-400/40'
              : 'border border-dashed border-forest-700/60 bg-forest-900/60 text-forest-300 ring-forest-800/50'
            }`}>
            <span className="font-bold tabular-nums opacity-80">{i + 1}.</span>
            {o ? (
              <>
                <span className="rounded bg-amber-950/60 px-1 text-[11px] tabular-nums">#{o.number}</span>
                <span aria-hidden>{o.emoji}</span><span>{o.name}</span>
              </>
            ) : eigenesId ? (
              <span>🌿 eigenes Öl</span>
            ) : (
              <span>+ Öl wählen</span>
            )}
          </button>
        );
      })}
    </div>
  );

  function leeren() {
    setTitel(''); setAttrs([]); setEigeneAttrIds([]);
    setOils(normalizeOilSlots(null)); setSudAuswahl([]); setSchnaps(null);
    setReiter('oils'); setDauer(DEFAULT_DURATION_MIN);
    setTeamAufguss(false); setVorlageId('');
  }

  /** Vorlage ins Formular holen — wie applyTemplate im Planer. Vorlagen legen
   *  ALLES in einem Feld ab (Standard-Attribute, UUIDs eigener Buttons, Sud,
   *  Schnaps); zerlegeAttributes sortiert es zurück in die Reiter. */
  function vorlageAnwenden(id: string) {
    setVorlageId(id);
    const t = vorlagen.find((v) => v.id === id);
    if (!t) return;
    const teile = zerlegeAttributes(t.attributes, eigeneAttrs.map((a) => a.id));
    setTitel(t.title);
    setAttrs([...teile.attrs].filter((a) => a !== BANJA_ATTR));
    setEigeneAttrIds([...teile.customAttrIds]);
    setSudAuswahl([...teile.sudAuswahl]);
    setSchnaps(teile.schnaps);
    setOils(normalizeOilSlots(t.oils));
    if (!bestehend && (DURATIONS as readonly number[]).includes(t.duration_minutes)) setDauer(t.duration_minutes);
    setFehler(null);
  }

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null); setErfolg(null);
    if (!gewaehlt) return setFehler('Bitte zuerst auswählen, wer du bist.');
    if (bestehend && !uebernommen) {
      return setFehler('Der Bestand wird noch geladen — bitte einen Moment.');
    }

    const warDa = anwesend.has(gewaehlt.id);

    try {
      if (!titel.trim()) return setFehler('Titel fehlt.');
      // Dasselbe Kontingent wie im Planer — auch beim Nachtragen: es gelten
      // die gleichen Vorgaben wie in der App jedes Einzelnen.
      const kontingent = pruefeAuswahl(auswahl);
      if (kontingent) return setFehler(kontingent);
      const payload = baueAttrsPayload(auswahl) as InfusionAttribute[];
      const oelListe = oils.some(Boolean) ? oils : null;

      if (bestehend) {
        // Nachtragen: Öle, Sud, Räucherwerk, Schnaps, Besonderheiten, Titel.
        // Zeit, Sauna und Dauer bleiben fest — und ein Banja lässt sich hier
        // nicht anheften, das ist eine Buchung und entsteht nur im Planer.
        await updInf.mutateAsync({ id: bestehend.id, title: titel.trim(), attributes: payload, oils: oelListe });
        setErfolg({ text: 'Zutaten nachgetragen.', eingecheckt: !warDa });
        setTimeout(onFertig, 2600);
        return;
      }

      if (!saunaId) return setFehler('Bitte eine Sauna wählen.');
      if (fest) return setFehler('Am Saunafest wird hier nicht gebucht — trag in der Planer-App im Bereich „Saunafest“ ein, wann du Zeit hast; der Admin teilt ein.');
      if (montagZu) return setFehler('Montag keine Aufgüsse.');
      if (!slots.includes(slot)) return setFehler('Diese Uhrzeit gehört nicht zu den Aufgusszeiten des Tages.');
      const start = slotToDate(tagOffset, slot);
      if (isBefore(start, new Date())) return setFehler('Slot liegt in der Vergangenheit.');

      const info = slotInfo(slot);
      if (info.art === 'belegt') return setFehler('Slot bereits belegt.');

      if (info.art === 'fallback' && info.fallbackId) {
        // Der Slot gehört dem Personal-Platzhalter — übernehmen statt anlegen.
        // Ein INSERT daneben würde ohnehin am Overlap-Trigger scheitern.
        await uebernahme.mutateAsync({
          infusion_id: info.fallbackId,
          title: titel.trim(),
          attributes: payload,
          oils: oelListe,
          team_infusion: teamAufguss,
        });
        leeren();
        setErfolg({ text: 'Personal-Slot übernommen.', eingecheckt: !warDa });
        return;
      }

      await addInf.mutateAsync({
        sauna_id: saunaId,
        template_id: null,
        saunameister_id: gewaehlt.id,
        title: titel.trim(),
        description: null,
        attributes: payload,
        oils: oelListe,
        start_time: start.toISOString(),
        duration_minutes: dauer,
        team_infusion: teamAufguss,
      });
      leeren();
      setErfolg({ text: 'Aufguss eingetragen.', eingecheckt: !warDa });
    } catch (err) { setFehler((err as Error).message); }
  }

  // ─── Namensauswahl ─────────────────────────────────────────────────────────
  if (!gewaehlt) {
    return (
      <div className="min-h-screen bg-schwarzwald-soft text-slate-100 flex flex-col">
        <Kopf titel="Wer bist du?" unter="Antippen — danach bist du automatisch als anwesend eingetragen" onFertig={onFertig} />
        <div className="flex-1 overflow-y-auto p-4">
          {meister.length === 0 ? (
            <p className="mt-10 text-center text-forest-300/70">Aufgießer-Liste konnte nicht geladen werden.</p>
          ) : (
            <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2.5 sm:grid-cols-3">
              {meister.map((m) => {
                const da = anwesend.has(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => setMeisterId(m.id)}
                    className="rounded-2xl bg-forest-600/20 px-4 py-4 text-left ring-2 ring-forest-500/40 transition hover:bg-forest-600/35 active:scale-[0.98]"
                  >
                    {/* Selbst gewählter Aufguss-Name — das Tablet hängt im
                        Öl-Raum, dort hat der Klarname nichts verloren. */}
                    <span className="block truncate text-base font-bold text-forest-50">
                      {displayMemberName(m, 'Aufgießer:in')}
                    </span>
                    <span className={`mt-0.5 block text-[11px] ${da ? 'text-emerald-400' : 'text-forest-400/70'}`}>
                      {da ? '● ist eingecheckt' : '○ noch nicht eingecheckt'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-4">{evakuierung}</div>
      </div>
    );
  }

  // ─── Formular ──────────────────────────────────────────────────────────────
  const meineAufguesse = infusions
    .filter((i) => i.saunameister_id === gewaehlt.id && !i.is_personal_fallback)
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));

  return (
    <div className="min-h-screen bg-schwarzwald-soft text-slate-100">
      {pickerOffen && (
        <OilPicker
          selected={oils}
          onChange={setOils}
          onClose={() => setPickerOffen(false)}
          memberId={gewaehlt.id}
        />
      )}

      {titelPickerOffen && (
        <TitleSuggestionPicker
          vorhandeneTitel={infusions.map((x) => x.title).filter((t): t is string => !!t)}
          zutaten={zutatenAus({
            attrs,
            customAttrIds: eigeneAttrIds,
            oils,
            schnaps,
            sudAuswahl,
            customAttrs: eigeneAttrs,
            customOils: eigeneOeleQ.data ?? [],
            sudKraeuter: sudKraeuterQ.data ?? [],
            sudMixe: sudMixeQ.data ?? [],
            sauna: saunas.find((x) => x.id === (bestehend?.sauna_id ?? saunaId)) ?? null,
            zeitpunkt: bestehend ? new Date(bestehend.start_time) : slotToDate(tagOffset, slot),
          })}
          onPick={(t) => { setTitel(t); setTitelPickerOffen(false); }}
          onClose={() => setTitelPickerOffen(false)}
        />
      )}

      <Kopf
        titel={bestehend ? 'Zutaten nachtragen' : 'Aufguss eintragen'}
        unter={displayMemberName(gewaehlt, 'Aufgießer:in')}
        onFertig={onFertig}
        rechts={!bestehend && (
          <button
            // Mit dem Wechsel auch das Formular leeren: Vorlage, eigene Buttons
            // und eigene Öle gehören der vorigen Person — ohne das landeten
            // deren Button-UUIDs im Aufguss des Nächsten.
            onClick={() => { leeren(); setFehler(null); setMeisterId(null); }}
            className="rounded-lg bg-forest-900/80 px-3 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50"
          >
            Wechseln
          </button>
        )}
      />

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {erfolg && (
          <div className="rounded-2xl bg-emerald-500/15 px-4 py-3 ring-1 ring-emerald-500/40">
            <p className="text-base font-bold text-emerald-100">✅ {erfolg.text}</p>
            {erfolg.eingecheckt && (
              <p className="mt-1 text-sm text-emerald-200/90">
                <strong>{displayMemberName(gewaehlt, 'Aufgießer:in')}</strong> ist damit auch als <strong>anwesend</strong> eingetragen —
                das zählt für Statistik, Bewertungen und die Evakuierungsliste.
              </p>
            )}
          </div>
        )}

        {evakuierung}

        <form onSubmit={absenden} className="space-y-4 rounded-2xl bg-forest-950/70 p-5 ring-1 ring-forest-800/50 backdrop-blur">
          {bestehend ? (
            <div className="rounded-xl bg-forest-900/60 px-4 py-3 ring-1 ring-forest-800/50">
              <p className="text-sm text-forest-300/80">Bestehender Aufguss</p>
              <p className="text-base font-bold text-forest-50">
                {dayLabel(bestehend.start_time)} · {fmtClock(bestehend.start_time)} ·{' '}
                {saunas.find((s) => s.id === bestehend.sauna_id)?.name ?? ''}
              </p>
              <p className="mt-1 text-xs text-forest-400/70">
                Öle, Sud, Räucherwerk, Schnaps und Besonderheiten lassen sich
                hier nachtragen. Zeit, Sauna und Dauer bleiben, wie sie sind —
                und ein Banja bucht man im Planer, das ist keine Zutat.
              </p>
            </div>
          ) : (
            <>
              {/* Tagesleiste wie im Planer — wischbar, so weit voraus wie dort. */}
              <Feld label={`Tag — bis ${maxTage} Tage im Voraus`}>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {tage.map((t) => (
                    <button key={t.offset} type="button" onClick={() => setTagOffset(t.offset)}
                      className={`flex-shrink-0 whitespace-nowrap rounded-xl px-4 py-3 text-base font-medium ring-1 transition ${
                        tagOffset === t.offset ? 'bg-forest-600 text-white ring-forest-500'
                          : t.zu ? 'bg-forest-950/40 text-forest-300/40 ring-forest-900/40'
                            : 'bg-forest-900/60 text-forest-200 ring-forest-800/50'
                      }`}>
                      {t.istFest && <span aria-hidden className="mr-1">🎪</span>}{t.label}
                    </button>
                  ))}
                </div>
              </Feld>

              {fest ? (
                <div className="rounded-xl bg-amber-500/10 px-4 py-5 text-center text-amber-100 ring-1 ring-amber-500/40">
                  <p className="text-base font-bold">🎪 Saunafest{fest.motto ? ` — ${fest.motto}` : ''}</p>
                  <p className="mt-1 text-sm text-amber-100/80">
                    An diesem Tag wird hier nicht gebucht — trag in der Planer-App im Bereich {'„Saunafest“'} ein, wann du Zeit hast; der Admin teilt ein.
                  </p>
                </div>
              ) : montagZu ? (
                <div className="rounded-xl bg-forest-900/60 px-4 py-6 text-center text-forest-300/70 ring-1 ring-forest-800/40">
                  Montag keine Aufgüsse
                </div>
              ) : (
                <>
                  <Feld label="Sauna">
                    <div className="grid grid-cols-3 gap-2">
                      {aktiveSaunen.map((s) => (
                        <button key={s.id} type="button" onClick={() => setSaunaId(s.id)}
                          className="rounded-xl px-2 py-4 text-sm ring-1 transition"
                          style={saunaId === s.id
                            ? { background: s.accent_color, color: '#0b1f10', boxShadow: `0 0 0 2px ${s.accent_color}66` }
                            : { background: 'rgba(20, 83, 45, 0.55)' }}>
                          <span className="block truncate font-semibold">{s.name}</span>
                          <span className="block text-xs opacity-80">{s.temperature_label}</span>
                        </button>
                      ))}
                    </div>
                  </Feld>

                  <Feld label="Uhrzeit">
                    <div className="grid grid-cols-5 gap-2">
                      {slots.map((s) => {
                        const info = slotInfo(s);
                        const vorbei = tagOffset === 0 && isBefore(slotToDate(0, s), new Date());
                        const aus = info.art === 'belegt' || vorbei;
                        const istFallback = info.art === 'fallback' && !aus;
                        return (
                          <button key={s} type="button" disabled={aus} onClick={() => setSlot(s)}
                            title={istFallback ? 'Personal-Slot — beim Eintragen übernimmst du ihn' : undefined}
                            className={`rounded-md px-1 py-3 font-mono text-sm tabular-nums ring-1 transition ${
                              slot === s && !aus
                                ? (istFallback
                                    ? 'bg-amber-500 font-bold text-amber-950 ring-amber-400'
                                    : 'bg-forest-500 font-bold text-forest-950 ring-forest-400')
                                : aus ? 'cursor-not-allowed bg-forest-950/40 text-forest-300/30 line-through ring-forest-900/40'
                                  : istFallback
                                    ? 'bg-amber-900/40 text-amber-200 ring-amber-600/50'
                                    : 'bg-forest-900/60 text-forest-200 ring-forest-800/50'
                            }`}>
                            {istFallback && <span aria-hidden>👨‍🍳</span>}{s}
                          </button>
                        );
                      })}
                    </div>
                    {slots.some((s) => slotInfo(s).art === 'fallback') && (
                      <p className="mt-1.5 text-[11px] text-amber-300/80">
                        👨‍🍳 = Personal-Slot. Wähl ihn aus und trag ein — dann übernimmst du ihn.
                      </p>
                    )}
                  </Feld>
                </>
              )}
            </>
          )}

          {(!!bestehend || (!montagZu && !fest)) && (
            <>
              {vorlagen.length > 0 && (
                <Feld label="Vorlage — füllt Titel, Dauer und Zutaten">
                  <select value={vorlageId} onChange={(e) => vorlageAnwenden(e.target.value)}
                    className="w-full rounded-lg bg-forest-900/80 px-3 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400">
                    <option value="">— ohne Vorlage —</option>
                    {vorlagen.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                  </select>
                </Feld>
              )}

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-forest-300">Titel</span>
                    {/* Wie im Planer: erst Zutaten wählen, dann schlägt die KI fünf Titel vor. */}
                    <button type="button" onClick={() => setTitelPickerOffen(true)}
                      disabled={anzahl === 0 && !schnaps}
                      className="rounded-md bg-amber-500/15 px-3 py-1.5 text-sm font-medium text-amber-300 ring-1 ring-amber-500/30 transition disabled:cursor-not-allowed disabled:opacity-30">
                      ✨ Vorschlagen
                    </button>
                  </div>
                  <input value={titel} onChange={(e) => setTitel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                    enterKeyHint="done" autoComplete="off" maxLength={80}
                    placeholder="z.B. Zirbelkiefer und kein Zurück mehr"
                    className="mt-2 w-full rounded-lg bg-forest-900/80 px-3 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400" />
                </div>
                {!bestehend && (
                  <Feld label="Dauer">
                    <select value={dauer} onChange={(e) => setDauer(Number(e.target.value))}
                      className="rounded-lg bg-forest-900/80 px-3 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400">
                      {DURATIONS.map((d) => <option key={d} value={d}>{d} Min</option>)}
                    </select>
                  </Feld>
                )}
              </div>

              {/* Kontingent-Anzeige — dieselbe Regel wie im Planer */}
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-forest-300">Zutaten & Besonderheiten</span>
                <span className={`text-sm font-bold tabular-nums ${
                  fehlt.oele > 0 || fehlt.besonderheiten > 0 ? 'text-amber-300'
                    : voll ? 'text-rose-300' : 'text-forest-300'
                }`}>
                  {anzahl}/{MAX_AUSWAHL}
                  {(fehlt.oele > 0 || fehlt.besonderheiten > 0) && ` — noch ${[
                    fehlt.oele > 0 ? `${fehlt.oele} ${fehlt.oele === 1 ? 'Öl' : 'Öle'}` : null,
                    fehlt.besonderheiten > 0
                      ? `${fehlt.besonderheiten} ${fehlt.besonderheiten === 1 ? 'Besonderheit' : 'Besonderheiten'}`
                      : null,
                  ].filter(Boolean).join(' und ')} nötig`}
                </span>
              </div>

              {/* Vier Reiter wie im Planer */}
              <div>
                <div className="flex gap-1.5 rounded-xl bg-forest-950/60 p-1 ring-1 ring-forest-800/50">
                  {([
                    { id: 'oils', icon: '🌿', label: 'Öle', gefuellt: oils.some(Boolean) || kraeuterAn },
                    { id: 'schnaps', icon: '🥃', label: 'Schnaps', gefuellt: !!schnaps },
                    { id: 'raeuchern', icon: '💨', label: 'Räuchern', gefuellt: raeuchernAn },
                    { id: 'sud', icon: '🧪', label: 'Sud', gefuellt: sudAuswahl.length > 0 },
                  ] as const).map((t) => {
                    const aktiv = reiter === t.id;
                    return (
                      <button key={t.id} type="button" onClick={() => setReiter(t.id)}
                        className={`relative flex-1 rounded-lg px-2 py-2.5 text-sm font-medium transition ${
                          aktiv ? 'bg-forest-500 text-forest-950' : 'text-forest-300'
                        }`}>
                        <span aria-hidden className="mr-1">{t.icon}</span>{t.label}
                        {!aktiv && t.gefuellt && (
                          <span aria-hidden className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {reiter === 'oils' ? (
                  <div className="mt-2">
                    <p className="text-xs text-forest-400/70">
                      Eines pro Runde — höchstens {MAX_OIL_SLOTS}, zählt aufs Kontingent.
                    </p>
                    {/* Reiner Kräuteraufguss: keine Öl-Plätze — „rein" heißt ohne Öl. */}
                    {!kraeuterAn && <div className="mt-2">{oelChips}</div>}
                    <KraeuterSchalter an={kraeuterAn} onToggle={toggleKraeuter} />
                  </div>
                ) : reiter === 'schnaps' ? (
                  <div className="mt-2">
                    <select value={schnaps ?? ''} onChange={(e) => setSchnaps(e.target.value || null)}
                      className="w-full rounded-lg bg-forest-900/80 px-3 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400">
                      <option value="">— kein Schnaps —</option>
                      {SCHNAPS.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
                    </select>
                    {gewaehlterSchnaps && (
                      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white"
                        style={{ background: gewaehlterSchnaps.color }}>
                        🥃 {gewaehlterSchnaps.name}-Aufguss
                      </span>
                    )}
                  </div>
                ) : reiter === 'sud' ? (
                  <SudPicker
                    auswahl={sudAuswahl} onChange={setSudAuswahl}
                    memberId={gewaehlt.id} voll={voll} vollHinweis={VOLL_HINWEIS}
                  />
                ) : (
                  <div className="mt-2">
                    <button type="button"
                      onClick={() => toggleAttr(RAEUCHER_ATTR as InfusionAttribute)}
                      disabled={!raeuchernAn && voll}
                      title={!raeuchernAn && voll ? VOLL_HINWEIS : undefined}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left ring-1 transition"
                      style={raeuchernAn
                        ? { background: `${RAEUCHER_THEME.color}55`, boxShadow: `inset 0 0 0 2px ${RAEUCHER_THEME.color}` }
                        : { background: 'rgba(20,83,45,0.35)', boxShadow: 'inset 0 0 0 1px rgba(20,83,45,0.7)' }}>
                      <span className={`relative h-6 w-10 flex-shrink-0 rounded-full transition ${raeuchernAn ? 'bg-slate-200' : 'bg-forest-800'}`}>
                        <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${raeuchernAn ? 'translate-x-4' : ''}`} />
                      </span>
                      <span className="text-sm font-semibold text-forest-100">💨 Räucheraufguss</span>
                    </button>
                    {raeuchernAn && (
                      <SudPicker
                        auswahl={sudAuswahl} onChange={setSudAuswahl}
                        memberId={gewaehlt.id} art="raeucher" voll={voll} vollHinweis={VOLL_HINWEIS}
                      />
                    )}
                  </div>
                )}
              </div>

              <Feld label="Besonderheiten">
                <div className="flex flex-wrap gap-2">
                  {TABLET_CHIPS.map((a) => {
                    const aktiv = attrs.includes(a.id);
                    const gesperrt = !aktiv && voll;
                    return (
                      <button key={a.id} type="button" onClick={() => toggleAttr(a.id)}
                        disabled={gesperrt} title={gesperrt ? VOLL_HINWEIS : undefined}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm ring-1 transition ${
                          gesperrt ? 'cursor-not-allowed opacity-30 ' : ''
                        }${aktiv ? 'bg-forest-500 text-forest-950 ring-forest-400'
                          : 'bg-forest-900/60 text-forest-200 ring-forest-800/50'}`}>
                        <span aria-hidden>{a.emoji}</span><span>{a.label}</span>
                      </button>
                    );
                  })}
                </div>
              </Feld>

              {eigeneAttrs.length > 0 && (
                <Feld label="Meine Buttons">
                  <div className="flex flex-wrap gap-2">
                    {eigeneAttrs.map((a) => {
                      const aktiv = eigeneAttrIds.includes(a.id);
                      const gesperrt = !aktiv && voll;
                      return (
                        <button key={a.id} type="button" onClick={() => toggleEigen(a.id)}
                          disabled={gesperrt} title={gesperrt ? VOLL_HINWEIS : undefined}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm ring-1 transition ${gesperrt ? 'cursor-not-allowed opacity-30' : ''}`}
                          style={aktiv
                            ? { background: a.color, color: '#0b1f10', boxShadow: `0 0 0 2px ${a.color}66` }
                            : { background: 'rgba(20, 83, 45, 0.55)', color: '#d1fae5' }}>
                          <span aria-hidden>{a.emoji}</span><span>{a.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </Feld>
              )}

              {/* Team-Aufguss wie im Planer. Beim Nachtragen nicht: update_infusion_kiosk
                  ändert nur Titel und Zutaten. */}
              {!bestehend && (
                <button type="button" onClick={() => setTeamAufguss((v) => !v)} aria-pressed={teamAufguss}
                  className="flex w-full items-center gap-3 text-left">
                  <span className={`relative h-6 w-10 flex-shrink-0 rounded-full transition ${teamAufguss ? 'bg-amber-500' : 'bg-forest-800'}`}>
                    <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${teamAufguss ? 'translate-x-4' : ''}`} />
                  </span>
                  <span className="text-sm text-forest-200">
                    👥 Team-Aufguss <span className="text-forest-300/60">— andere Aufgießer können mitmachen</span>
                  </span>
                </button>
              )}

              {fehler && <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/30">{fehler}</p>}

              <button type="submit" disabled={addInf.isPending || updInf.isPending || uebernahme.isPending}
                className="w-full rounded-xl bg-forest-500 px-5 py-4 text-base font-semibold text-forest-950 transition hover:bg-forest-400 disabled:opacity-60">
                {addInf.isPending || updInf.isPending || uebernahme.isPending ? 'Speichere…'
                  : bestehend ? 'Zutaten speichern'
                    : slotInfo(slot).art === 'fallback' ? '👨‍🍳 Personal-Slot übernehmen'
                      : 'Aufguss eintragen'}
              </button>

              {!anwesend.has(gewaehlt.id) && (
                <p className="text-center text-xs text-forest-400/80">
                  Mit dem Speichern wirst du automatisch als anwesend eingetragen.
                </p>
              )}
            </>
          )}
        </form>

        {!bestehend && (
          <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50 backdrop-blur">
            <h2 className="mb-3 text-base font-semibold text-forest-100">Meine Aufgüsse</h2>
            {meineAufguesse.length === 0 ? (
              <p className="text-sm text-forest-300/60">Noch keine geplant.</p>
            ) : (
              <ul className="space-y-2">
                {meineAufguesse.map((i) => {
                  const gesperrt = isInfusionCancelLocked(i.start_time);
                  return (
                    <li key={i.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-forest-900/60 px-3 py-2 ring-1 ring-forest-800/40"
                      style={{ borderLeft: `3px solid ${saunas.find((s) => s.id === i.sauna_id)?.accent_color ?? '#22c55e'}` }}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{i.title}</p>
                        <p className="mt-0.5 text-xs text-forest-300/70">
                          {dayLabel(i.start_time)} · {fmtClock(i.start_time)} ·{' '}
                          {saunas.find((s) => s.id === i.sauna_id)?.name ?? ''} · {i.duration_minutes} Min
                        </p>
                      </div>
                      <button
                        onClick={() => delInf.mutate(i.id, { onError: (err) => window.alert((err as Error).message) })}
                        disabled={gesperrt}
                        title={gesperrt ? `Steht bereits auf der Tafel — Absage ab ${INFUSION_CANCEL_LOCK_MINUTES} Min vor Start gesperrt` : undefined}
                        className="rounded-md px-2 py-1 text-xs text-rose-300 disabled:cursor-not-allowed disabled:opacity-40">
                        {gesperrt ? '🔒 gesperrt' : 'Löschen'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function Kopf({ titel, unter, onFertig, rechts }: {
  titel: string; unter: string; onFertig: () => void; rechts?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-forest-800/40 bg-forest-950/95 px-4 py-3 backdrop-blur">
      <button onClick={onFertig}
        className="rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-200 ring-1 ring-forest-700/50">
        ← Anzeige
      </button>
      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-base font-bold text-forest-100">{titel}</p>
        <p className="truncate text-xs text-forest-300/70">{unter}</p>
      </div>
      <div className="min-w-[5.5rem] text-right">{rechts}</div>
    </header>
  );
}

function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-sm text-forest-300">{label}</span>
      <div className="mt-2">{children}</div>
    </div>
  );
}
