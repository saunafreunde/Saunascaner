// Admin-Reiter „Saunafest“ (Migrationen 0150–0152, 0163–0165).
//
// Ablauf seit 24.09.2026 (Vorgabe Christoph): Alle außer Gästen tragen im
// Planer (eigener Bereich „Saunafest“) je Fest EINEN Zeitraum ein, dazu ihre
// Lieblingssauna, optional eine Höchstzahl und einen Hinweis/Wunsch (≤ 300
// Zeichen). Hier teilt der Admin in Ruhe ein — solange der Plan Entwurf ist,
// wird niemand angepingt. Erst „Plan bestätigen“ benachrichtigt alle
// Eingetragenen (Eingeteilte: ihre Zeiten; alle anderen: Dank). Danach tragen
// die Eingeteilten die Angaben für ihr Schild ein; daraus erzeugt die App je
// Aufguss ein Standbild und einen 5-s-Loop, der am Festtag hinter der Karte
// auf der TV-Tafel läuft.
//
// Aufbau: Kopf (Fest-Chips, Statusleiste, Aktionen) · Raster Uhrzeit × Sauna
// (lib/saunafestPlan.ts) mit Kandidaten und Einteilungs-Vorschlag aus
// lib/saunafestEinteilung.ts · Liste der Eingetragenen · „Schilder & Videos“.
// Die alten Bewerbungen (0151) spielen hier keine Rolle mehr.

import { Fragment, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import {
  useSaunafestTage, useSaunafestZeitraeume, useSaunafestEinteilen, useSaunafestAusteilen,
  useSaunafestErinnern, useSaunafestPlanBestaetigen, useSaunafestPlanZuruecknehmen,
  useSaunafestAufgussInfos, useSaunafestVideos, saunafestVideoStarten,
  useSaunafestVideoEinstellungen, useSaunafestVideoTafelSetzen,
  useSaunas, useAllMembers, useInfusions,
  type Member, type SaunafestTag, type SaunafestZeitraum, type SaunafestAufgussInfo,
} from '@/lib/api';
import { festSlots, festZeiten, festSlotOffen, festAblaufText, hhmm, type FestSlot } from '@/lib/saunafestPlan';
import { einteilungsVorschlag, kandidaten, hatZeit, type Einteilung, type Zeitfenster } from '@/lib/saunafestEinteilung';
import { VideoVorschau, type VideoStand } from '@/components/saunafest/VideoVorschau';
import { FestAufgussInfoDialog } from '@/components/saunafest/FestAufgussInfoDialog';
import { MeldeschlussAdmin } from '@/components/saunafest/Meldeschluss';
import { Portal } from '@/components/Portal';
import type { Infusion, Sauna } from '@/types/database';

/** Titel, den saunafest_einteilen jedem neuen Fest-Aufguss gibt (= noch nichts eingetragen). */
const STANDARD_TITEL = 'Saunafest-Aufguss';
/** So viele Kandidaten zeigt eine freie Kachel sofort, der Rest steht hinter „+N weitere“. */
const KANDIDATEN_SICHTBAR = 4;

const KNOPF = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 min-h-[44px] text-sm font-semibold ring-1 transition disabled:cursor-not-allowed disabled:opacity-50';
const KNOPF_RUHIG = `${KNOPF} bg-forest-900/60 text-forest-100 ring-forest-700/60 hover:bg-forest-900`;
const KNOPF_AMBER = `${KNOPF} bg-amber-500 text-amber-950 ring-amber-400 hover:bg-amber-400`;
const KNOPF_GRUEN = `${KNOPF} bg-emerald-500 text-emerald-950 ring-emerald-400 hover:bg-emerald-400`;
const KNOPF_ROSE = `${KNOPF} bg-rose-500/10 text-rose-200 ring-rose-500/40 hover:bg-rose-500/20`;
/** Kleine Knöpfe im Raster — trotzdem ≥ 44 px Touch-Ziel. */
const MINI = 'shrink-0 inline-flex items-center justify-center rounded-lg px-2.5 min-h-[44px] min-w-[44px] text-xs font-bold ring-1 transition disabled:cursor-not-allowed disabled:opacity-50';

function lokalDatum(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function lokalZeit(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** „Sa 10.10.“ */
function festTagKurz(datum: string): string {
  return format(new Date(`${datum}T12:00:00`), 'EEEEEE dd.MM.', { locale: de });
}

function kachelKey(zeit: string, saunaId: string): string {
  return `${zeit}|${saunaId}`;
}

/** Liegt dieser Slot schon in der Vergangenheit? (Die RPCs lehnen ihn dann ohnehin ab.) */
function slotVorbei(datum: string, zeit: string): boolean {
  return new Date(`${datum}T${zeit}:00`).getTime() < Date.now();
}

function mehrzahl(n: number, eins: string, viele: string): string {
  return `${n} ${n === 1 ? eins : viele}`;
}

type Meldung = { text: string; fehler?: boolean };
type Lauf = { was: string; fertig: number; gesamt: number };

export function SaunafestTab() {
  const qc = useQueryClient();
  const festeQ = useSaunafestTage();
  const zeitraeumeQ = useSaunafestZeitraeume();
  const saunasQ = useSaunas();
  const membersQ = useAllMembers();
  const infusionsQ = useInfusions();
  const einteilenM = useSaunafestEinteilen();
  const austeilenM = useSaunafestAusteilen();
  const erinnernM = useSaunafestErinnern();
  const bestaetigenM = useSaunafestPlanBestaetigen();
  const zuruecknehmenM = useSaunafestPlanZuruecknehmen();
  const einstellungenQ = useSaunafestVideoEinstellungen();
  const tafelSetzenM = useSaunafestVideoTafelSetzen();

  const heute = lokalDatum(new Date());
  const feste = useMemo(() => (festeQ.data ?? []).filter((f) => f.datum >= heute), [festeQ.data, heute]);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const fest: SaunafestTag | null = feste.find((f) => f.datum === gewaehlt) ?? feste[0] ?? null;
  const datum = fest?.datum ?? null;
  const bestaetigt = !!fest?.plan_bestaetigt_at;

  /** Schlüssel der gerade laufenden Aktion — sperrt alle anderen Knöpfe. */
  const [busy, setBusy] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const [lauf, setLauf] = useState<Lauf | null>(null);
  const [vorschlag, setVorschlag] = useState<{ datum: string; eintraege: Einteilung[] } | null>(null);
  const [aufgeklappt, setAufgeklappt] = useState<Set<string>>(() => new Set());
  const [infoFuerId, setInfoFuerId] = useState<string | null>(null);

  // Erfolgsmeldungen verschwinden von selbst, Fehler bleiben, bis man sie wegklickt.
  useEffect(() => {
    if (!meldung || meldung.fehler) return;
    const t = window.setTimeout(() => setMeldung(null), 8000);
    return () => window.clearTimeout(t);
  }, [meldung]);

  const memberById = useMemo(() => new Map((membersQ.data ?? []).map((m) => [m.id, m])), [membersQ.data]);
  const memberName = (id: string | null) => (id ? memberById.get(id)?.name ?? '?' : 'ohne Person');
  const saunaName = (id: string) => saunasQ.data?.find((s) => s.id === id)?.name ?? 'Sauna';

  // ── Raster ────────────────────────────────────────────────────────────
  const plan: FestSlot[] = useMemo(() => (fest ? festSlots(fest, saunasQ.data ?? []) : []), [fest, saunasQ.data]);
  const saunen: Sauna[] = useMemo(() => {
    const imPlan = new Set(plan.flatMap((s) => s.saunaIds));
    return (saunasQ.data ?? []).filter((s) => imPlan.has(s.id)).sort((a, b) => a.sort_order - b.sort_order);
  }, [plan, saunasQ.data]);
  const zeiten = useMemo(() => festZeiten(plan), [plan]);
  const slotsGesamt = plan.reduce((n, s) => n + s.saunaIds.length, 0);

  // ── Eingetragene (Zeiträume dieses Fests), sortiert nach „von“ ───────
  const eintraege: SaunafestZeitraum[] = useMemo(() => (zeitraeumeQ.data ?? [])
    .filter((z) => z.fest_datum === datum)
    .sort((a, b) => hhmm(a.von).localeCompare(hhmm(b.von)) || hhmm(a.bis).localeCompare(hhmm(b.bis))
      || (memberById.get(a.member_id)?.name ?? '').localeCompare(memberById.get(b.member_id)?.name ?? '', 'de')),
  [zeitraeumeQ.data, datum, memberById]);
  const eintragVon = useMemo(() => new Map(eintraege.map((z) => [z.member_id, z])), [eintraege]);
  const fenster: Zeitfenster[] = useMemo(() => eintraege.map((z) => ({
    member_id: z.member_id, von: z.von, bis: z.bis,
    lieblings_sauna_id: z.lieblings_sauna_id, max_aufguesse: z.max_aufguesse,
  })), [eintraege]);

  // ── Echte Fest-Aufgüsse (lokales Datum = Fest, kein Personal-Fallback) ─
  const festAufguesse: Infusion[] = useMemo(() => {
    if (!datum) return [];
    return (infusionsQ.data ?? [])
      .filter((i) => !i.is_personal_fallback && lokalDatum(new Date(i.start_time)) === datum)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [infusionsQ.data, datum]);
  const aufgussIn = useMemo(() => {
    const m = new Map<string, Infusion>();
    for (const i of festAufguesse) m.set(kachelKey(lokalZeit(new Date(i.start_time)), i.sauna_id), i);
    return m;
  }, [festAufguesse]);
  /** Eingeteilt = echte Fest-Aufgüsse MIT Person; belegt = alle echten Fest-Aufgüsse. */
  const bestehend: Einteilung[] = useMemo(() => festAufguesse.flatMap((i) => (i.saunameister_id
    ? [{ zeit: lokalZeit(new Date(i.start_time)), sauna_id: i.sauna_id, member_id: i.saunameister_id }]
    : [])), [festAufguesse]);
  const belegt = useMemo(
    () => festAufguesse.map((i) => ({ zeit: lokalZeit(new Date(i.start_time)), sauna_id: i.sauna_id })),
    [festAufguesse],
  );
  const aufguesseVon = useMemo(() => {
    const m = new Map<string, Infusion[]>();
    for (const i of festAufguesse) {
      if (i.saunameister_id) m.set(i.saunameister_id, [...(m.get(i.saunameister_id) ?? []), i]);
    }
    return m;
  }, [festAufguesse]);
  const anzahlVon = useMemo(() => new Map([...aufguesseVon].map(([id, l]) => [id, l.length])), [aufguesseVon]);

  // ── Zahlen der Statusleiste ───────────────────────────────────────────
  const besetzt = plan.reduce((n, s) => n + s.saunaIds.filter((id) => aufgussIn.has(kachelKey(s.zeit, id))).length, 0);
  const offen = slotsGesamt - besetzt;
  const verfuegbarUm = (zeit: string) => fenster.filter((f) => hatZeit(f, zeit)).length;
  const mangelBloecke = plan.filter((s) => verfuegbarUm(s.zeit) < s.saunaIds.length).length;
  const ohneEinteilung = eintraege.filter((z) => !aufguesseVon.has(z.member_id)).length;

  // ── Vorschlag (Geister-Einträge, bis der Admin sie übernimmt) ─────────
  const vorschlaege: Einteilung[] = datum && vorschlag?.datum === datum
    ? vorschlag.eintraege.filter((e) => !aufgussIn.has(kachelKey(e.zeit, e.sauna_id)) && !slotVorbei(datum, e.zeit))
    : [];
  const vorschlagIn = new Map(vorschlaege.map((e) => [kachelKey(e.zeit, e.sauna_id), e]));
  const freiKuenftig = datum
    ? plan.reduce((n, s) => n + (slotVorbei(datum, s.zeit) ? 0 : s.saunaIds.filter((id) => !aufgussIn.has(kachelKey(s.zeit, id))).length), 0)
    : 0;

  // ── Personen für Erinnern und „Andere Person …“ ───────────────────────
  // Gleiche Auswahl wie saunafest_erinnern (Migration 0163).
  const ohneEintrag = useMemo(() => (membersQ.data ?? []).filter((m) =>
    !m.revoked_at && m.role !== 'gast' && (m.is_aufgieser || m.role === 'guest_aufgieser') && !eintragVon.has(m.id)),
  [membersQ.data, eintragVon]);
  // Nur freigeschaltete Konten: wer noch nicht freigeschaltet ist, sieht in der
  // App nur „Warte auf Freigabe“ und käme nie an seine Angaben fürs Schild.
  const nichtGaeste = useMemo(
    () => (membersQ.data ?? []).filter((m) => !m.revoked_at && m.role !== 'gast' && m.approved),
    [membersQ.data],
  );

  // ── Schilder & Videos ─────────────────────────────────────────────────
  const aufgussIds = useMemo(() => festAufguesse.map((i) => i.id), [festAufguesse]);
  const infosQ = useSaunafestAufgussInfos(aufgussIds);
  // EINE Abfrage für alle Videos des Fests — die Vorschauen bekommen ihren
  // Stand über `stand` (sonst je Kachel eine eigene Abfrage, ~30 beim Öffnen).
  const videosQ = useSaunafestVideos(aufgussIds, { behalten: true });
  const infoVon = useMemo(() => new Map((infosQ.data ?? []).map((a) => [a.infusion_id, a])), [infosQ.data]);
  const videoVon = useMemo(() => new Map((videosQ.data ?? []).map((v) => [v.infusion_id, v])), [videosQ.data]);
  const videoStand = (id: string): VideoStand => ({
    video: videoVon.get(id) ?? null,
    laedt: videosQ.isPending,
    fehler: videosQ.isError && !videosQ.data,
  });
  /** Mit Angaben, aber ohne fertiges oder laufendes Video (und noch nicht vorbei). */
  const fehlendeVideos = festAufguesse.filter((i) => {
    if (!infoVon.has(i.id) || new Date(i.end_time).getTime() < Date.now()) return false;
    const v = videoVon.get(i.id);
    return !v || v.status === 'fehler';
  });
  const mitAngaben = festAufguesse.filter((i) => infoVon.has(i.id)).length;
  const videosFertig = festAufguesse.filter((i) => videoVon.get(i.id)?.status === 'fertig').length;
  const tafelAktiv = einstellungenQ.data?.tafel_aktiv ?? true;
  const infoFuer = infoFuerId ? festAufguesse.find((i) => i.id === infoFuerId) ?? null : null;

  // ── Aktionen ──────────────────────────────────────────────────────────
  function festWaehlen(d: string) {
    setGewaehlt(d);
    setMeldung(null);
    setAufgeklappt(new Set());
  }

  function entferneVorschlag(zeit: string, saunaId: string) {
    setVorschlag((v) => v && { ...v, eintraege: v.eintraege.filter((e) => !(e.zeit === zeit && e.sauna_id === saunaId)) });
  }

  function aufklappen(key: string) {
    setAufgeklappt((alt) => {
      const neu = new Set(alt);
      if (neu.has(key)) neu.delete(key); else neu.add(key);
      return neu;
    });
  }

  async function einteilen(zeit: string, saunaId: string, memberId: string, ausnahme: boolean) {
    if (!fest || busy) return;
    const name = memberName(memberId);
    const wo = `${zeit} Uhr · ${saunaName(saunaId)}`;
    if (ausnahme || bestaetigt) {
      const teile = [`${name} einteilen: ${wo}?`];
      if (ausnahme) teile.push(`${name} steht für diese Uhrzeit nicht auf der Kandidatenliste (kein passender Zeitraum eingetragen oder Höchstzahl erreicht).`);
      if (bestaetigt) teile.push(`Der Plan ist schon bestätigt — ${name} bekommt sofort eine Nachricht.`);
      if (!window.confirm(teile.join('\n\n'))) return;
    }
    setBusy(`ein:${kachelKey(zeit, saunaId)}`);
    setMeldung(null);
    try {
      await einteilenM.mutateAsync({ datum: fest.datum, zeit, saunaId, memberId });
      entferneVorschlag(zeit, saunaId);
      setMeldung({ text: `✓ ${name} · ${wo}${bestaetigt ? ' — die Nachricht ist raus.' : ' (Entwurf, noch niemand benachrichtigt).'}` });
    } catch (e) {
      setMeldung({ text: `Einteilen fehlgeschlagen: ${(e as Error).message}`, fehler: true });
    } finally {
      setBusy(null);
    }
  }

  async function aufheben(inf: Infusion) {
    if (busy) return;
    const zeit = lokalZeit(new Date(inf.start_time));
    const name = memberName(inf.saunameister_id);
    const teile = [
      `Einteilung aufheben: ${name} · ${zeit} Uhr · ${saunaName(inf.sauna_id)}?`,
      'Der Aufguss wird gelöscht — samt eingetragenen Angaben und Video.',
    ];
    if (bestaetigt && inf.saunameister_id) teile.push(`Der Plan ist schon bestätigt — ${name} bekommt sofort Bescheid.`);
    if (!window.confirm(teile.join('\n\n'))) return;
    setBusy(`aus:${inf.id}`);
    setMeldung(null);
    try {
      await austeilenM.mutateAsync(inf.id);
      setMeldung({ text: `Einteilung aufgehoben: ${name} · ${zeit} Uhr${bestaetigt && inf.saunameister_id ? ' — die Nachricht ist raus.' : '.'}` });
    } catch (e) {
      setMeldung({ text: `Aufheben fehlgeschlagen: ${(e as Error).message}`, fehler: true });
    } finally {
      setBusy(null);
    }
  }

  function vorschlagBerechnen() {
    if (!fest) return;
    const kuenftig = plan.filter((s) => !slotVorbei(fest.datum, s.zeit));
    const v = einteilungsVorschlag(kuenftig, fenster, bestehend, belegt);
    setVorschlag({ datum: fest.datum, eintraege: v });
    setMeldung(v.length
      ? { text: `${mehrzahl(v.length, 'Vorschlag', 'Vorschläge')} — gestrichelt im Raster. Eingeteilt wird erst, wenn du übernimmst.` }
      : { text: 'Kein Vorschlag möglich: alle Slots sind besetzt, oder für die freien hat niemand Zeit.' });
  }

  async function alleUebernehmen() {
    if (!fest || busy || vorschlaege.length === 0) return;
    const liste = [...vorschlaege];
    if (bestaetigt && !window.confirm(`Der Plan ist schon bestätigt — alle ${liste.length} Eingeteilten bekommen sofort eine Nachricht. Alle übernehmen?`)) return;
    setBusy('alle');
    setMeldung(null);
    let n = 0;
    setLauf({ was: 'Vorschläge übernehmen', fertig: 0, gesamt: liste.length });
    try {
      for (const e of liste) {
        try {
          await einteilenM.mutateAsync({ datum: fest.datum, zeit: e.zeit, saunaId: e.sauna_id, memberId: e.member_id });
        } catch (err) {
          setMeldung({
            text: `Angehalten bei ${e.zeit} Uhr · ${saunaName(e.sauna_id)} (${memberName(e.member_id)}): ${(err as Error).message} — ${n} von ${liste.length} übernommen.`,
            fehler: true,
          });
          return;
        }
        n++;
        entferneVorschlag(e.zeit, e.sauna_id);
        setLauf({ was: 'Vorschläge übernehmen', fertig: n, gesamt: liste.length });
      }
      setMeldung({ text: `✓ ${mehrzahl(n, 'Vorschlag', 'Vorschläge')} übernommen${bestaetigt ? ' — die Nachrichten sind raus.' : ' (Entwurf, noch niemand benachrichtigt).'}` });
    } finally {
      setLauf(null);
      setBusy(null);
    }
  }

  async function erinnern() {
    if (!fest || busy) return;
    if (!window.confirm(`${mehrzahl(ohneEintrag.length, 'Aufgießer', 'Aufgießer')} ohne Eintrag für ${festTagKurz(fest.datum)} erinnern?\n\nSie bekommen eine Nachricht mit der Bitte, ihren Zeitraum einzutragen (höchstens einmal am Tag).`)) return;
    setBusy('erinnern');
    setMeldung(null);
    try {
      const n = await erinnernM.mutateAsync(fest.datum);
      setMeldung({ text: n > 0 ? `✓ ${n} erinnert.` : '0 erinnert — alle Betroffenen wurden heute schon erinnert.' });
    } catch (e) {
      setMeldung({ text: `Erinnern fehlgeschlagen: ${(e as Error).message}`, fehler: true });
    } finally {
      setBusy(null);
    }
  }

  function zusammenfassung(): string {
    const zeilen = [
      `• ${mehrzahl(aufguesseVon.size, 'Person', 'Personen')} eingeteilt (${mehrzahl(bestehend.length, 'Aufguss', 'Aufgüsse')}) — sie bekommen ihre Zeiten und die Bitte, die Angaben für Schild und Video einzutragen.`,
      `• ${mehrzahl(ohneEinteilung, 'Eingetragener', 'Eingetragene')} ohne Einteilung ${ohneEinteilung === 1 ? 'bekommt' : 'bekommen'} einen Dank.`,
      `• ${mehrzahl(offen, 'Slot bleibt', 'Slots bleiben')} unbesetzt.`,
    ];
    if (vorschlaege.length > 0) zeilen.push(`• Achtung: ${mehrzahl(vorschlaege.length, 'Vorschlag ist', 'Vorschläge sind')} noch nicht übernommen.`);
    return zeilen.join('\n');
  }

  async function planBestaetigen(erneut: boolean) {
    if (!fest || busy) return;
    const frage = erneut
      ? `Den aktuellen Plan für ${festTagKurz(fest.datum)} noch einmal an alle schicken?`
      : `Plan für ${festTagKurz(fest.datum)} bestätigen und alle benachrichtigen?`;
    if (!window.confirm(`${frage}\n\n${zusammenfassung()}`)) return;
    setBusy('bestaetigen');
    setMeldung(null);
    try {
      const n = await bestaetigenM.mutateAsync(fest.datum);
      setMeldung({ text: `✓ ${mehrzahl(n, 'Nachricht', 'Nachrichten')} verschickt.` });
    } catch (e) {
      setMeldung({ text: `Bestätigen fehlgeschlagen: ${(e as Error).message}`, fehler: true });
    } finally {
      setBusy(null);
    }
  }

  async function zuruecknehmen() {
    if (!fest || busy) return;
    if (!window.confirm(`Bestätigung für ${festTagKurz(fest.datum)} zurücknehmen?\n\nDer Plan ist dann wieder Entwurf: Es geht keine Nachricht raus, und Änderungen erfährt erst mit der nächsten Bestätigung jemand.`)) return;
    setBusy('zuruecknehmen');
    setMeldung(null);
    try {
      await zuruecknehmenM.mutateAsync(fest.datum);
      setMeldung({ text: 'Bestätigung zurückgenommen — der Plan ist wieder Entwurf.' });
    } catch (e) {
      setMeldung({ text: `Zurücknehmen fehlgeschlagen: ${(e as Error).message}`, fehler: true });
    } finally {
      setBusy(null);
    }
  }

  async function videosErzeugen() {
    if (busy || fehlendeVideos.length === 0) return;
    const liste = [...fehlendeVideos];
    if (!window.confirm(`${mehrzahl(liste.length, 'Video', 'Videos')} erzeugen lassen?\n\nJe Aufguss entsteht per KI (fal.ai) aus den Angaben ein Standbild und ein 5-s-Loop — das kostet jedes Mal Geld.`)) return;
    setBusy('videos');
    setMeldung(null);
    let gestartet = 0;
    let sonst = 0;
    // Ein Fehler bei einem Aufguss (z. B. Kosten-Deckel, abgelehnter Auftrag)
    // hält die übrigen nicht auf — ein Abbruch würde beim nächsten Versuch
    // wieder am selben Aufguss hängen bleiben. Gemeldet wird am Ende.
    const fehler: string[] = [];
    try {
      for (const [k, i] of liste.entries()) {
        setLauf({ was: 'Videos anstoßen', fertig: k, gesamt: liste.length });
        const wo = `${lokalZeit(new Date(i.start_time))} ${saunaName(i.sauna_id)}`;
        try {
          const r = await saunafestVideoStarten(i.id, true);
          if (r.status === 'gestartet') gestartet++;
          else if (r.status === 'fehler' || r.status === 'gesperrt') fehler.push(`${wo}: ${r.meldung}`);
          else sonst++;
        } catch (e) {
          fehler.push(`${wo}: ${(e as Error).message}`);
        }
      }
      const teile = [`${mehrzahl(gestartet, 'Video', 'Videos')} gestartet`];
      if (sonst) teile.push(`${sonst} liefen schon oder waren aktuell`);
      if (fehler.length) teile.push(`${fehler.length} nicht gestartet (${fehler[0]}${fehler.length > 1 ? ' …' : ''})`);
      setMeldung({
        text: `${fehler.length ? '' : '✓ '}${teile.join(' · ')}.${gestartet ? ' In ein paar Minuten fertig — der Stand aktualisiert sich von selbst.' : ''}`,
        fehler: fehler.length > 0,
      });
    } finally {
      setLauf(null);
      setBusy(null);
      void qc.invalidateQueries({ queryKey: ['saunafest-videos'] });
    }
  }

  async function tafelUmschalten() {
    if (tafelSetzenM.isPending) return;
    const neu = !tafelAktiv;
    try {
      await tafelSetzenM.mutateAsync(neu);
      setMeldung({ text: neu ? 'Die TV-Tafel spielt die Fest-Videos ab.' : 'Die TV-Tafel zeigt nur noch die Standbilder.' });
    } catch (e) {
      setMeldung({ text: `Umschalten fehlgeschlagen: ${(e as Error).message}`, fehler: true });
    }
  }

  // ── Anzeige ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* a) Kopf + b) Statusleiste + c) Aktionen */}
      <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-amber-700/30 backdrop-blur">
        <h2 className="flex items-center gap-2 text-base font-semibold text-amber-100">
          <span>🔥</span><span>Saunafest — Einteilung</span>
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-forest-300/80">
          Alle außer Gästen tragen im Planer (Bereich „Saunafest“) ihren Zeitraum, ihre Lieblingssauna und einen
          Hinweis ein. Du teilst hier in Ruhe ein — solange der Plan Entwurf ist, bekommt niemand eine Nachricht.
          Erst mit „Plan bestätigen“ erfährt jeder Eingetragene, ob und wann er dran ist; die Eingeteilten tragen
          dann die Angaben für ihr Schild und Video ein.
          {fest && <> Raster: {festAblaufText(fest)}.</>}
        </p>

        {festeQ.isLoading ? (
          <p className="mt-3 text-xs text-forest-400">Lade Saunafeste …</p>
        ) : festeQ.error ? (
          <p className="mt-3 text-xs text-rose-200">Saunafeste nicht ladbar: {(festeQ.error as Error).message}</p>
        ) : feste.length === 0 ? (
          <p className="mt-3 text-xs text-forest-400">Keine kommenden Saunafeste eingetragen.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {feste.map((f) => {
              const aktiv = f.datum === datum;
              const n = (zeitraeumeQ.data ?? []).filter((z) => z.fest_datum === f.datum).length;
              return (
                <button
                  key={f.datum}
                  type="button"
                  onClick={() => festWaehlen(f.datum)}
                  aria-pressed={aktiv}
                  className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-xs font-medium ring-1 transition ${
                    aktiv ? 'bg-amber-500 text-amber-950 ring-amber-400' : 'bg-forest-900/60 text-forest-100 ring-forest-800/50 hover:bg-forest-900'
                  }`}
                >
                  <span>{festTagKurz(f.datum)} · {f.motto}</span>
                  <span className="tabular-nums opacity-75" title="Eingetragene">👥 {n}</span>
                  {f.plan_bestaetigt_at && <span title="Plan bestätigt">✓</span>}
                </button>
              );
            })}
          </div>
        )}

        {fest && (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
              {fest.plan_bestaetigt_at ? (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-200 ring-1 ring-emerald-500/40">
                  ✓ bestätigt am {format(new Date(fest.plan_bestaetigt_at), "dd.MM. 'um' HH:mm 'Uhr'")}
                </span>
              ) : (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-1 font-semibold text-amber-200 ring-1 ring-amber-500/40">
                  Plan: Entwurf
                </span>
              )}
              <Zahl wert={eintraege.length} text="eingetragen" />
              <Zahl wert={slotsGesamt} text="Slots gesamt" />
              <Zahl wert={besetzt} text="eingeteilt" />
              <Zahl wert={offen} text="offen" warn={offen > 0} />
              <Zahl
                wert={mangelBloecke}
                text={mangelBloecke === 1 ? 'Block mit Mangel' : 'Blöcke mit Mangel'}
                warn={mangelBloecke > 0}
                title="Uhrzeiten, zu denen weniger Leute Zeit haben, als Saunen dran sind"
              />
            </div>
            {bestaetigt && (
              <p className="mt-2 text-[11px] leading-relaxed text-amber-200/90">
                Der Plan ist bestätigt: Wer jetzt eingeteilt oder ausgeteilt wird, bekommt sofort eine Nachricht.
              </p>
            )}

            {/* Meldeschluss (0167): Standard Do vorher 18:00, hier verschiebbar. */}
            <div className="mt-3">
              <MeldeschlussAdmin key={`${fest.datum}-${fest.meldeschluss ?? ''}`} fest={fest} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={vorschlagBerechnen}
                disabled={!!busy || fenster.length === 0 || infusionsQ.isLoading || zeitraeumeQ.isLoading}
                title={fenster.length === 0 ? 'Noch niemand eingetragen' : undefined}
                className={KNOPF_RUHIG}
              >
                🧮 Vorschlag berechnen
              </button>
              <button
                type="button"
                onClick={() => void erinnern()}
                disabled={!!busy || ohneEintrag.length === 0}
                title={ohneEintrag.length === 0 ? 'Alle Aufgießer haben sich eingetragen' : 'Aufgießer ohne Eintrag erinnern'}
                className={KNOPF_RUHIG}
              >
                🔔 Erinnern ({ohneEintrag.length})
              </button>
              {!bestaetigt ? (
                <button type="button" onClick={() => void planBestaetigen(false)} disabled={!!busy} className={KNOPF_AMBER}>
                  ✓ Plan bestätigen & alle benachrichtigen
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => void planBestaetigen(true)} disabled={!!busy} className={KNOPF_RUHIG}>
                    📣 Erneut an alle senden
                  </button>
                  <button type="button" onClick={() => void zuruecknehmen()} disabled={!!busy} className={KNOPF_ROSE}>
                    ↩ Bestätigung zurücknehmen
                  </button>
                </>
              )}
            </div>

            {vorschlaege.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-amber-400/50 bg-amber-500/5 p-3">
                <p className="min-w-0 flex-1 text-xs leading-relaxed text-amber-100">
                  {mehrzahl(vorschlaege.length, 'Vorschlag', 'Vorschläge')} gestrichelt im Raster.
                  {freiKuenftig > vorschlaege.length && (
                    <> {mehrzahl(freiKuenftig - vorschlaege.length, 'freier Slot findet', 'freie Slots finden')} niemanden.</>
                  )}
                  {lauf && busy === 'alle' && <span className="ml-1 tabular-nums"> · {lauf.fertig}/{lauf.gesamt}</span>}
                </p>
                <button type="button" onClick={() => void alleUebernehmen()} disabled={!!busy} className={KNOPF_GRUEN}>
                  {vorschlaege.length === 1 ? '✓ Vorschlag übernehmen' : `✓ Alle ${vorschlaege.length} Vorschläge übernehmen`}
                </button>
                <button type="button" onClick={() => setVorschlag(null)} disabled={busy === 'alle'} className={KNOPF_RUHIG}>
                  Verwerfen
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* d) Raster Uhrzeit × Sauna */}
      {fest && (
        <section className="rounded-2xl bg-forest-950/70 p-3 ring-1 ring-forest-800/50">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-1">
            <h3 className="text-sm font-semibold text-forest-100">Einteilung · Uhrzeit × Sauna</h3>
            <span className="text-[11px] text-forest-400">👥 = Zeit haben / Saunen dran</span>
          </div>
          {plan.length === 0 ? (
            <p className="px-1 text-xs text-forest-400">
              {saunasQ.isLoading ? 'Lade Saunen …' : 'Kein Raster — sind die Saunen (80 °C / 100 °C) aktiv?'}
            </p>
          ) : (
            <div className="overflow-x-auto pb-1">
              <div
                className="grid min-w-[760px] gap-1.5"
                style={{ gridTemplateColumns: `76px repeat(${saunen.length}, minmax(210px, 1fr))` }}
              >
                <div className="sticky left-0 z-10 bg-forest-950" />
                {saunen.map((s) => (
                  <div key={`h-${s.id}`} className="flex items-center justify-center gap-1.5 rounded-md bg-forest-900/70 px-2 py-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.accent_color, boxShadow: `0 0 6px ${s.accent_color}` }} />
                    <span className="text-xs font-bold text-forest-100">{s.name}</span>
                    <span className="font-mono text-[10px] text-forest-400">{s.temperature_label}</span>
                  </div>
                ))}

                {zeiten.map((zeit) => {
                  const bedarf = plan.find((p) => p.zeit === zeit)?.saunaIds.length ?? 0;
                  const verf = verfuegbarUm(zeit);
                  const vorbei = slotVorbei(fest.datum, zeit);
                  return (
                    <Fragment key={zeit}>
                      <div className={`sticky left-0 z-10 flex flex-col items-center justify-center rounded-md bg-forest-900 px-1 py-2 ${vorbei ? 'opacity-60' : ''}`}>
                        <span className="font-mono text-sm font-bold tabular-nums text-forest-100">{zeit}</span>
                        <span
                          className={`mt-0.5 text-[10px] tabular-nums ${verf < bedarf ? 'font-bold text-rose-300' : 'text-forest-400'}`}
                          title="Zeit haben / Saunen dran"
                        >
                          👥 {verf}/{bedarf}
                        </span>
                      </div>
                      {saunen.map((s) => {
                        if (!festSlotOffen(plan, zeit, s.id)) {
                          return (
                            <div key={s.id} className="flex items-center justify-center rounded-md bg-forest-950/30 px-2 py-2 text-xs text-forest-500 ring-1 ring-forest-900/40">
                              —
                            </div>
                          );
                        }
                        const key = kachelKey(zeit, s.id);
                        const inf = aufgussIn.get(key);
                        return (
                          <Kachel
                            key={s.id}
                            sauna={s}
                            inf={inf}
                            videoStand={inf ? videoStand(inf.id) : undefined}
                            vorschlag={vorschlagIn.get(key)}
                            kand={kandidaten(zeit, s.id, fenster, bestehend)}
                            eintragVon={eintragVon}
                            anzahlVon={anzahlVon}
                            nichtGaeste={nichtGaeste}
                            vorbei={vorbei}
                            aufgeklappt={aufgeklappt.has(key)}
                            gesperrt={!!busy}
                            memberName={memberName}
                            onAufklappen={() => aufklappen(key)}
                            onEinteilen={(memberId, ausnahme) => void einteilen(zeit, s.id, memberId, ausnahme)}
                            onAufheben={(inf) => void aufheben(inf)}
                          />
                        );
                      })}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          )}
          <p className="mt-2 px-1 text-[11px] leading-relaxed text-forest-500">
            ✓ = eingeteilt · gestrichelt = Vorschlag · ♥ = Lieblingssauna · egal = keine Lieblingssauna ·
            n/m = schon eingeteilt / höchstens · 💬 = Hinweis (gekürzt; voller Text unten bei „Eingetragen“) ·
            — = Sauna um diese Uhrzeit nicht dran
          </p>
        </section>
      )}

      {/* e) Eingetragen */}
      {fest && (
        <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50">
          <h3 className="text-sm font-semibold text-forest-100">
            Eingetragen <span className="font-normal text-forest-400">({eintraege.length})</span>
          </h3>
          {zeitraeumeQ.error ? (
            <p className="mt-2 text-xs text-rose-200">Einträge nicht ladbar: {(zeitraeumeQ.error as Error).message}</p>
          ) : eintraege.length === 0 ? (
            <p className="mt-2 text-xs text-forest-400">Noch niemand hat einen Zeitraum eingetragen.</p>
          ) : (
            <ul className="mt-2 divide-y divide-forest-800/50">
              {eintraege.map((z) => {
                const meine = aufguesseVon.get(z.member_id) ?? [];
                return (
                  <li key={z.id} className="space-y-1 py-2.5">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
                      <span className="text-sm font-semibold text-forest-100">{memberName(z.member_id)}</span>
                      <span className="font-mono tabular-nums text-forest-100">{hhmm(z.von)}–{hhmm(z.bis)} Uhr</span>
                      <span className="text-forest-300">
                        <span className="text-forest-500">Lieblingssauna:</span> {z.lieblings_sauna_id ? saunaName(z.lieblings_sauna_id) : 'egal'}
                      </span>
                      <span className="text-forest-300">
                        <span className="text-forest-500">höchstens:</span> {z.max_aufguesse ?? 'egal'}
                      </span>
                      <span className={meine.length > 0 ? 'text-emerald-300' : 'text-forest-400'}>
                        <span className="text-forest-500">eingeteilt:</span> {meine.length}
                        {meine.length > 0 && ` · ${meine.map((i) => `${lokalZeit(new Date(i.start_time))} ${saunaName(i.sauna_id)}`).join(', ')}`}
                      </span>
                    </div>
                    {z.notiz && (
                      <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-forest-300">💬 {z.notiz}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* f) Schilder & Videos */}
      {fest && (
        <section className="space-y-3 rounded-2xl bg-forest-950/70 p-4 ring-1 ring-forest-800/50">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-forest-100">🎬 Schilder & Videos</h3>
            {festAufguesse.length > 0 && (
              <span className="text-xs tabular-nums text-forest-400">
                {mitAngaben}/{festAufguesse.length} mit Angaben · {videosFertig} {videosFertig === 1 ? 'Video' : 'Videos'} fertig
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-forest-300/80">
            Aus den Angaben der Aufgießer (Titel, Thema, Bildidee, Musik, Öle …) erzeugt die App per KI ein Standbild und
            einen 5-s-Loop. Er läuft am Festtag als bewegter Hintergrund der Aufguss-Karte auf der TV-Tafel.
            {!bestaetigt && ' Um ihre Angaben gebeten werden die Eingeteilten erst mit der Planbestätigung.'}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-forest-900/40 p-3 ring-1 ring-forest-800/50">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-forest-100">Videos auf der TV-Tafel abspielen</div>
              <div className="text-[11px] text-forest-400">Aus = nur Standbilder, falls der TV-Stick ruckelt.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={tafelAktiv}
              onClick={() => void tafelUmschalten()}
              disabled={tafelSetzenM.isPending || einstellungenQ.isLoading}
              className={`${MINI} rounded-full px-4 ${
                tafelAktiv
                  ? 'bg-amber-500/25 text-amber-100 ring-amber-400/60'
                  : 'bg-forest-950/60 text-forest-300 ring-forest-700/60 hover:ring-amber-500/40'
              }`}
            >
              {tafelAktiv ? 'An' : 'Aus'}
            </button>
          </div>

          {festAufguesse.length === 0 ? (
            <p className="text-xs text-forest-400">Noch niemand eingeteilt.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void videosErzeugen()}
                  disabled={!!busy || fehlendeVideos.length === 0}
                  title={fehlendeVideos.length === 0 ? 'Jeder Aufguss mit Angaben hat ein fertiges oder laufendes Video' : undefined}
                  className={KNOPF_RUHIG}
                >
                  ✨ Fehlende Videos erzeugen ({fehlendeVideos.length})
                </button>
                {lauf && busy === 'videos' && (
                  <span className="text-xs tabular-nums text-forest-300">{lauf.fertig}/{lauf.gesamt} …</span>
                )}
              </div>
              <ul className="space-y-2">
                {festAufguesse.map((i) => {
                  const vorbei = new Date(i.end_time).getTime() < Date.now();
                  return (
                    <li
                      key={i.id}
                      className="grid gap-3 rounded-xl bg-forest-900/40 p-3 ring-1 ring-forest-800/50 sm:grid-cols-[minmax(0,1fr)_minmax(0,300px)]"
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-forest-300">
                          <span className="font-mono text-sm font-bold tabular-nums text-forest-100">{lokalZeit(new Date(i.start_time))}</span>
                          <span>{saunaName(i.sauna_id)}</span>
                          <span>· {memberName(i.saunameister_id)}</span>
                        </div>
                        <div className={`break-words text-sm font-semibold ${i.title === STANDARD_TITEL ? 'italic text-forest-400' : 'text-amber-100'}`}>
                          {i.title}
                        </div>
                        <AngabenStatus inf={i} info={infoVon.get(i.id)} />
                        <button
                          type="button"
                          onClick={() => setInfoFuerId(i.id)}
                          disabled={vorbei}
                          title={vorbei ? 'Dieser Aufguss ist schon vorbei' : undefined}
                          className={KNOPF_RUHIG}
                        >
                          ✏️ Angaben bearbeiten
                        </button>
                      </div>
                      <VideoVorschau infusionId={i.id} stand={videoStand(i.id)} darfNeuErzeugen istAdmin />
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}

      {infoFuer && (
        <FestAufgussInfoDialog
          infusion={infoFuer}
          onClose={() => setInfoFuerId(null)}
          onSaved={() => setMeldung({ text: '✓ Angaben gespeichert.' })}
        />
      )}

      {/* Nicht, solange der Angaben-Dialog offen ist: Die Leiste (z-[70]) läge
          sonst auf dem iPhone über dessen Fuß mit „Schließen“/„Speichern“. */}
      {(meldung || lauf) && !infoFuer && (
        <Portal>
          <div
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            <div
              role="status"
              aria-live="polite"
              className={`pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-2xl ring-1 ${
                meldung?.fehler && !lauf ? 'bg-rose-950/95 text-rose-100 ring-rose-500/50' : 'bg-forest-950/95 text-forest-100 ring-amber-500/40'
              }`}
            >
              <p className="min-w-0 flex-1 break-words leading-snug">
                {lauf ? `${lauf.was} … ${lauf.fertig}/${lauf.gesamt}` : meldung?.text}
              </p>
              {!lauf && (
                <button
                  type="button"
                  onClick={() => setMeldung(null)}
                  aria-label="Meldung schließen"
                  className="-my-2 -mr-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-forest-300 hover:text-forest-100"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

function Zahl({ wert, text, warn = false, title }: { wert: number; text: string; warn?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={`rounded-full px-2.5 py-1 tabular-nums ring-1 ${
        warn ? 'bg-rose-500/10 text-rose-200 ring-rose-500/40' : 'bg-forest-900/60 text-forest-100 ring-forest-800/60'
      }`}
    >
      <b className="font-bold">{wert}</b> {text}
    </span>
  );
}

/** Eine offene Kachel im Raster: belegt (✓ Name, Titel, Video) oder frei (Vorschlag, Kandidaten, Ausnahme). */
function Kachel({
  sauna, inf, videoStand, vorschlag, kand, eintragVon, anzahlVon, nichtGaeste, vorbei, aufgeklappt, gesperrt,
  memberName, onAufklappen, onEinteilen, onAufheben,
}: {
  sauna: Sauna;
  inf: Infusion | undefined;
  /** Video-Stand aus der Sammel-Abfrage des Reiters (nur bei belegter Kachel). */
  videoStand?: VideoStand;
  vorschlag: Einteilung | undefined;
  kand: Zeitfenster[];
  eintragVon: Map<string, SaunafestZeitraum>;
  anzahlVon: Map<string, number>;
  nichtGaeste: Member[];
  vorbei: boolean;
  aufgeklappt: boolean;
  gesperrt: boolean;
  memberName: (id: string | null) => string;
  onAufklappen: () => void;
  onEinteilen: (memberId: string, ausnahme: boolean) => void;
  onAufheben: (inf: Infusion) => void;
}) {
  if (inf) {
    return (
      <div className="min-w-0 space-y-1.5 rounded-lg bg-emerald-500/10 p-2 ring-1 ring-emerald-500/40">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-emerald-100">✓ {memberName(inf.saunameister_id)}</div>
            <div
              className={`truncate text-[11px] ${inf.title === STANDARD_TITEL ? 'italic text-forest-400' : 'text-forest-100'}`}
              title={inf.title}
            >
              {inf.title}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onAufheben(inf)}
            disabled={gesperrt || vorbei}
            className={`${MINI} bg-transparent text-rose-200 ring-rose-500/40 hover:bg-rose-500/15`}
          >
            Aufheben
          </button>
        </div>
        <VideoVorschau infusionId={inf.id} stand={videoStand} kompakt darfNeuErzeugen istAdmin />
      </div>
    );
  }

  if (vorbei) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-forest-950/30 px-2 py-3 text-[11px] text-forest-500 ring-1 ring-forest-900/40">
        vorbei · unbesetzt
      </div>
    );
  }

  const sichtbar = aufgeklappt ? kand : kand.slice(0, KANDIDATEN_SICHTBAR);
  const rest = kand.length - KANDIDATEN_SICHTBAR;
  const kandIds = new Set(kand.map((f) => f.member_id));
  const vorschlagLiebling = vorschlag ? eintragVon.get(vorschlag.member_id)?.lieblings_sauna_id === sauna.id : false;
  const vorschlagNotiz = vorschlag ? eintragVon.get(vorschlag.member_id)?.notiz ?? null : null;

  return (
    <div className="min-w-0 space-y-1 rounded-lg bg-forest-900/40 p-2 ring-1 ring-forest-800/40">
      {vorschlag && (
        <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-dashed border-amber-400/60 bg-amber-500/5 py-1 pl-2 pr-1">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/80">Vorschlag</div>
            <div className="truncate text-sm font-semibold text-amber-100">
              {memberName(vorschlag.member_id)}
              {vorschlagLiebling && <span className="ml-1 text-rose-300" title="Lieblingssauna">♥</span>}
            </div>
            {vorschlagNotiz && (
              <p className="line-clamp-2 break-words text-[11px] leading-snug text-amber-100/80" title={vorschlagNotiz}>
                💬 {vorschlagNotiz}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onEinteilen(vorschlag.member_id, !kandIds.has(vorschlag.member_id))}
            disabled={gesperrt}
            className={`${MINI} bg-amber-500 text-amber-950 ring-amber-400 hover:bg-amber-400`}
          >
            ✓ übernehmen
          </button>
        </div>
      )}

      {kand.length === 0 ? (
        <p className="px-1 py-1 text-[11px] text-rose-200/80">Niemand mit passendem Zeitraum frei.</p>
      ) : (
        sichtbar.map((f) => {
          const notiz = eintragVon.get(f.member_id)?.notiz ?? null;
          return (
            <div key={f.member_id} className="flex items-center justify-between gap-1.5">
              {/* Hinweis sichtbar unter dem Namen — ein title-Tooltip gibt es auf dem Handy nicht. */}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1 text-xs text-forest-100">
                  <span className="truncate">{memberName(f.member_id)}</span>
                  {f.lieblings_sauna_id === sauna.id && <span className="shrink-0 text-rose-300" title="Lieblingssauna">♥</span>}
                  {f.lieblings_sauna_id === null && (
                    <span className="shrink-0 text-[10px] text-forest-400" title="Lieblingssauna: egal">egal</span>
                  )}
                  <span className="shrink-0 text-[10px] tabular-nums text-forest-400" title="schon eingeteilt / höchstens">
                    {anzahlVon.get(f.member_id) ?? 0}/{f.max_aufguesse ?? '∞'}
                  </span>
                </div>
                {notiz && (
                  <p className="line-clamp-2 break-words text-[11px] leading-snug text-forest-300" title={notiz}>
                    💬 {notiz}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onEinteilen(f.member_id, false)}
                disabled={gesperrt}
                className={`${MINI} bg-emerald-500 text-emerald-950 ring-emerald-400 hover:bg-emerald-400`}
              >
                Einteilen
              </button>
            </div>
          );
        })
      )}

      {rest > 0 && (
        <button
          type="button"
          onClick={onAufklappen}
          className="min-h-[44px] w-full rounded-lg text-[11px] font-medium text-forest-300 hover:bg-forest-900/60"
        >
          {aufgeklappt ? 'weniger zeigen' : `+${rest} weitere`}
        </button>
      )}

      <select
        value=""
        onChange={(e) => {
          const id = e.target.value;
          if (id) onEinteilen(id, !kandIds.has(id));
        }}
        disabled={gesperrt}
        aria-label={`Andere Person in der ${sauna.name} einteilen`}
        className="min-h-[44px] w-full rounded-lg bg-forest-950/60 px-2 text-base text-forest-300 ring-1 ring-forest-800/60 sm:text-xs"
      >
        <option value="">Andere Person …</option>
        {nichtGaeste.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
    </div>
  );
}

/** Welche Angaben zum Schild schon da sind — Titel/Beschreibung stehen am Aufguss, der Rest in saunafest_aufguss_info. */
function AngabenStatus({ inf, info }: { inf: Infusion; info: SaunafestAufgussInfo | undefined }) {
  const punkte: [string, boolean][] = [
    ['Titel', inf.title.trim() !== '' && inf.title !== STANDARD_TITEL],
    ['Beschreibung', !!inf.description?.trim()],
    ['Thema', !!info?.thema],
    ['Bildidee', !!info?.bildidee],
    ['Musik', !!info?.musik],
    ['Requisiten', !!info?.requisiten],
  ];
  const oele = info ? info.oele.length : (inf.oils ?? []).filter(Boolean).length;
  return (
    <div className="space-y-1">
      <div className={`text-xs font-semibold ${info ? 'text-emerald-300' : 'text-amber-200'}`}>
        {info
          ? `✓ Angaben eingetragen · Stand ${format(new Date(info.updated_at), 'dd.MM. HH:mm')}`
          : 'Noch keine Angaben'}
      </div>
      <div className="flex flex-wrap gap-1">
        {punkte.map(([name, da]) => (
          <span
            key={name}
            className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${
              da ? 'bg-emerald-500/15 text-emerald-100 ring-emerald-500/40' : 'text-forest-500 ring-forest-800/60'
            }`}
          >
            {da ? '✓' : '–'} {name}
          </span>
        ))}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] tabular-nums ring-1 ${
            oele > 0 ? 'bg-emerald-500/15 text-emerald-100 ring-emerald-500/40' : 'text-forest-500 ring-forest-800/60'
          }`}
        >
          {oele} {oele === 1 ? 'Öl' : 'Öle'}
        </span>
      </div>
    </div>
  );
}
