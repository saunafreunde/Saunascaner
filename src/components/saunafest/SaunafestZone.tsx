// Planer-Bereich „Saunafest" (Migrationen 0163–0165) — eigener Bereich,
// getrennt vom Tagesplaner (Vorgabe Christoph 23./24.09.2026).
//
// Ablauf für jeden außer Gästen:
//   1. Zeitraum eintragen (erster/letzter Aufguss, den man übernehmen könnte),
//      Lieblingssauna, Höchstzahl, Hinweis/Wünsche (≤ 300 Zeichen).
//   2. Danach nur noch die Zusammenfassung + Tagesübersicht (Zahlen je Block).
//   3. Der Admin teilt ein (Entwurf — hier NICHT sichtbar) und bestätigt den
//      Plan. Dann: „Deine Aufgüsse" mit den Angaben fürs Schild/Video und der
//      fertige Plan für alle.
// Die Benachrichtigungen (Push + Posteingang) verlinken auf /planner#saunafest
// — dieser Bereich klappt sich dann selbst auf und scrollt ins Bild.

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  useSaunafestTage, useSaunafestZeitraeume, useSaunafestZeitraumLoeschen, useSaunafestAufgussInfos,
  useSaunas, useInfusions,
  type Member, type SaunafestTag, type SaunafestZeitraum,
} from '@/lib/api';
import { festSlots, festAblaufText, hhmm, type FestSlot } from '@/lib/saunafestPlan';
import { WEEKDAY_LABEL_DE_SHORT } from '@/lib/garantie';
import { HubZone } from '@/components/HubZone';
import { ZeitraumFormular } from '@/components/saunafest/ZeitraumFormular';
import { Tagesuebersicht } from '@/components/saunafest/Tagesuebersicht';
import { FestPlanAnsicht, type FestAufguss } from '@/components/saunafest/FestPlanAnsicht';
import { MeineFestAufguesse } from '@/components/saunafest/MeineFestAufguesse';
import type { Infusion, Sauna } from '@/types/database';

// Datum/Uhrzeit in Lokalzeit des Geräts (Berlin) — wie SaunafestTab/Planner.
function lokalDatum(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function lokalZeit(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
/** '2026-10-10' → „Sa 10.10." */
function festDatumKurz(datum: string): string {
  const d = new Date(`${datum}T12:00:00`);
  return `${WEEKDAY_LABEL_DE_SHORT[d.getDay()] ?? ''} ${format(d, 'dd.MM.')}`.trim();
}

/** Echte Aufgüsse (kein Personal-Fallback) an diesem Festtag, mit Uhrzeit, nach Zeit sortiert. */
function aufguesseAm(infusions: Infusion[], datum: string): FestAufguss[] {
  return infusions
    .filter((i) => !i.is_personal_fallback && lokalDatum(new Date(i.start_time)) === datum)
    .map((inf) => ({ inf, zeit: lokalZeit(new Date(inf.start_time)) }))
    .sort((a, b) => a.inf.start_time.localeCompare(b.inf.start_time));
}

export function SaunafestZone({ member, isAdmin }: { member: Member; isAdmin: boolean }): JSX.Element | null {
  const darf = member.role !== 'gast';
  const festeQ = useSaunafestTage();
  const saunasQ = useSaunas();
  const zeitraeumeQ = useSaunafestZeitraeume(darf);
  const infusionsQ = useInfusions();
  const location = useLocation();
  const qc = useQueryClient();

  const heute = lokalDatum(new Date());
  const feste = useMemo(() => (festeQ.data ?? []).filter((f) => f.datum >= heute), [festeQ.data, heute]);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const fest: SaunafestTag | null = feste.find((f) => f.datum === gewaehlt) ?? feste[0] ?? null;

  /** Eigene Zeiträume je Festdatum (der Admin bekommt per RLS alle — hier nur die eigenen). */
  const meineZeitraeume = useMemo(() => {
    const m = new Map<string, SaunafestZeitraum>();
    for (const z of zeitraeumeQ.data ?? []) if (z.member_id === member.id) m.set(z.fest_datum, z);
    return m;
  }, [zeitraeumeQ.data, member.id]);

  /** Eigene Aufgüsse je bestätigtem Fest — Entwürfe bleiben unsichtbar. */
  const meineBestaetigt = useMemo(() => {
    const m = new Map<string, FestAufguss[]>();
    for (const f of feste) {
      if (!f.plan_bestaetigt_at) continue;
      m.set(f.datum, aufguesseAm(infusionsQ.data ?? [], f.datum).filter((a) => a.inf.saunameister_id === member.id));
    }
    return m;
  }, [feste, infusionsQ.data, member.id]);

  const meineIds = useMemo(() => [...meineBestaetigt.values()].flat().map((a) => a.inf.id), [meineBestaetigt]);
  const infosQ = useSaunafestAufgussInfos(meineIds);
  const mitInfos = useMemo(() => new Set((infosQ.data ?? []).map((i) => i.infusion_id)), [infosQ.data]);
  // data bleibt auch nach einem gescheiterten Nachladen stehen (react-query v5)
  // → dann gilt der alte Stand weiter. Nur ohne jeden Stand ist es ein Fehler.
  const infosDa = infosQ.data !== undefined;
  const infosGeladen = meineIds.length === 0 || infosDa;
  const infosFehler = meineIds.length > 0 && !infosDa && infosQ.isError;

  /** Offene Angaben je Fest: eigene Aufgüsse ohne Infos, die noch nicht vorbei sind.
   *  Ohne geladenen Stand bewusst 0 — ob etwas fehlt, ist dann unbekannt. */
  const jetzt = Date.now();
  const infosFehlenAm = (datum: string): number =>
    !infosDa ? 0
      : (meineBestaetigt.get(datum) ?? []).filter((a) => !mitInfos.has(a.inf.id) && new Date(a.inf.end_time).getTime() > jetzt).length;
  const infosFehlenGesamt = feste.reduce((n, f) => n + infosFehlenAm(f.datum), 0);
  // „Zeitraum fehlt" nur fürs nächste Fest und nur, solange der Plan Entwurf ist.
  const naechstes = feste[0] ?? null;
  const zeitraumFehlt = !!naechstes && !naechstes.plan_bestaetigt_at && zeitraeumeQ.isSuccess && !meineZeitraeume.has(naechstes.datum);

  const sichtbar = darf && !!fest;
  // Ohne Saunen bleibt die Zone sonst für immer bei „Lade …“ (schwaches Netz im Saunabereich).
  const ladeFehler: unknown = zeitraeumeQ.error ?? (!saunasQ.data ? saunasQ.error : null);

  // Aus Push/Posteingang (/planner#saunafest, bzw. umgeleitet nach
  // /unterstuetzer, /mitarbeiter): Der Plan kann seit dem letzten Laden
  // bestätigt worden sein — saunafest_tage hat kein Realtime-Abo, staleTime
  // 10 min, und ein schon offener Planer lädt beim Antippen nicht neu. Darum
  // je Navigation frisch laden (nicht, wenn gerade ohnehin geladen wird —
  // etwa beim ersten Laden der Seite aus dem Push heraus).
  useEffect(() => {
    if (!darf || location.hash !== '#saunafest') return;
    if (qc.getQueryState(['saunafest-tage'])?.fetchStatus === 'fetching') return;
    void qc.invalidateQueries({ queryKey: ['saunafest-tage'] });
    void qc.invalidateQueries({ queryKey: ['saunafest-info'] });
  }, [darf, location.hash, location.key, qc]);

  // Zone aufklappen und hinscrollen.
  useEffect(() => {
    if (!sichtbar || location.hash !== '#saunafest') return;
    window.dispatchEvent(new CustomEvent('hubzone:open', { detail: { id: 'saunafest' } }));
    const t = window.setTimeout(() => {
      document.getElementById('saunafest')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(t);
  }, [sichtbar, location.hash, location.key]);

  if (!sichtbar || !fest) return null;

  const badge = infosFehlenGesamt > 0 ? (
    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
      Infos fehlen{infosFehlenGesamt > 1 ? ` (${infosFehlenGesamt})` : ''}
    </span>
  ) : zeitraumFehlt ? (
    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-amber-950">Zeitraum fehlt</span>
  ) : fest.plan_bestaetigt_at ? (
    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-500/40">Plan steht</span>
  ) : meineZeitraeume.has(fest.datum) ? (
    <span className="rounded-full bg-forest-900/70 px-2 py-0.5 text-[10px] font-semibold text-forest-100 ring-1 ring-forest-700/50">✓ eingetragen</span>
  ) : undefined;

  return (
    <HubZone
      id="saunafest"
      icon="🎉"
      title="Saunafest"
      subtitle={`${festDatumKurz(fest.datum)} · ${fest.motto}`}
      accent="#f97316"
      collapsible
      badge={badge}
    >
      <div className="space-y-4">
        {/* ── Fest-Auswahl ─────────────────────────────────────────── */}
        {feste.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {feste.map((f) => {
              const aktiv = f.datum === fest.datum;
              const eingetragen = meineZeitraeume.has(f.datum);
              const fehlen = infosFehlenAm(f.datum);
              return (
                <button
                  key={f.datum}
                  type="button"
                  onClick={() => setGewaehlt(f.datum)}
                  className={`min-h-[44px] rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition ${
                    aktiv ? 'bg-amber-500 text-amber-950 ring-amber-300' : 'bg-forest-900/60 text-forest-100 ring-forest-700/50 hover:bg-forest-900'
                  }`}
                >
                  {festDatumKurz(f.datum)} · {f.motto}
                  {eingetragen && <span className="ml-1.5" title="Zeitraum eingetragen">✓</span>}
                  {fehlen > 0 && <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white" title="Infos fehlen">!</span>}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-amber-200/80">🔥 {festAblaufText(fest)}</p>

        {isAdmin && <AdminLeiste fest={fest} />}

        {!saunasQ.data || !zeitraeumeQ.isSuccess ? (
          ladeFehler ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-500/30">
              <span className="min-w-0 flex-1">Saunafest-Daten konnten nicht geladen werden: {(ladeFehler as Error).message}</span>
              <button
                type="button"
                onClick={() => { void saunasQ.refetch(); void zeitraeumeQ.refetch(); }}
                className="min-h-[44px] rounded-xl bg-forest-900/80 px-3 py-2 text-xs font-semibold text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-900"
              >
                Nochmal
              </button>
            </div>
          ) : (
            <p className="text-xs text-forest-400">Lade …</p>
          )
        ) : (
          <FestBereich
            key={fest.datum}
            fest={fest}
            saunas={saunasQ.data}
            eigener={meineZeitraeume.get(fest.datum) ?? null}
            festAufguesse={aufguesseAm(infusionsQ.data ?? [], fest.datum)}
            meine={meineBestaetigt.get(fest.datum) ?? []}
            mitInfos={mitInfos}
            infosGeladen={infosGeladen}
            infosFehler={infosFehler}
            onInfosNeuLaden={() => { void infosQ.refetch(); }}
            memberId={member.id}
            isAdmin={isAdmin}
          />
        )}
      </div>
    </HubZone>
  );
}

// ── Admin: Stand des Plans + Sprung in den Einteilen-Reiter ────────────────
function AdminLeiste({ fest }: { fest: SaunafestTag }) {
  const bestaetigt = fest.plan_bestaetigt_at ? new Date(fest.plan_bestaetigt_at) : null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-950/40 p-2 ring-1 ring-amber-500/30">
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${
          bestaetigt ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-500/40' : 'bg-amber-500/20 text-amber-100 ring-amber-500/40'
        }`}
      >
        {bestaetigt ? `Plan bestätigt ${format(bestaetigt, 'dd.MM. HH:mm')} Uhr` : 'Plan: Entwurf'}
      </span>
      <Link
        to="/admin#saunafest"
        className="ml-auto inline-flex min-h-[44px] items-center rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-400 transition"
      >
        Admin: Aufgießer einteilen →
      </Link>
    </div>
  );
}

// ── Inhalt je Fest (key = Datum → Zustand setzt sich beim Festwechsel zurück) ─
function FestBereich({
  fest, saunas, eigener, festAufguesse, meine, mitInfos, infosGeladen, infosFehler, onInfosNeuLaden, memberId, isAdmin,
}: {
  fest: SaunafestTag;
  saunas: Sauna[];
  eigener: SaunafestZeitraum | null;
  festAufguesse: FestAufguss[];
  meine: FestAufguss[];
  mitInfos: Set<string>;
  infosGeladen: boolean;
  /** Die eigenen Angaben ließen sich nicht laden (und es gibt keinen alten Stand). */
  infosFehler: boolean;
  onInfosNeuLaden: () => void;
  memberId: string;
  isAdmin: boolean;
}) {
  const [bearbeiten, setBearbeiten] = useState(false);
  const [uebersichtOffen, setUebersichtOffen] = useState(false);
  const bestaetigt = !!fest.plan_bestaetigt_at;

  const plan: FestSlot[] = useMemo(() => festSlots(fest, saunas), [fest, saunas]);
  const festSaunen: Sauna[] = useMemo(() => {
    const imPlan = new Set(plan.flatMap((s) => s.saunaIds));
    return saunas.filter((s) => imPlan.has(s.id)).sort((a, b) => a.sort_order - b.sort_order);
  }, [plan, saunas]);

  const eigenerBereich = eigener ? { von: hhmm(eigener.von), bis: hhmm(eigener.bis) } : null;

  // Abbrechen gibt es nur, wenn es etwas gibt, wohin man zurück kann: die
  // Zusammenfassung (Eintrag vorhanden) oder den fertigen Plan.
  const formular = (
    <ZeitraumFormular
      fest={fest}
      plan={plan}
      saunen={festSaunen}
      bestehend={eigener}
      onGespeichert={() => setBearbeiten(false)}
      onAbbrechen={eigener || bestaetigt ? () => setBearbeiten(false) : undefined}
    />
  );

  const zusammenfassung = eigener && (
    <ZeitraumZusammenfassung
      fest={fest}
      zeitraum={eigener}
      saunas={saunas}
      bestaetigt={bestaetigt}
      onAendern={() => setBearbeiten(true)}
    />
  );

  // ── Entwurf: Formular bzw. Zusammenfassung + Tagesübersicht ─────────────
  if (!bestaetigt) {
    if (!eigener || bearbeiten) return formular;
    return (
      <div className="space-y-4">
        {zusammenfassung}
        <p className="rounded-xl bg-forest-950/50 px-3 py-2.5 text-xs leading-relaxed text-forest-300/90 ring-1 ring-forest-800/50">
          ⏳ Der Admin stellt den Plan zusammen — sobald er steht, bekommst du Bescheid.
        </p>
        <Tagesuebersicht datum={fest.datum} saunen={saunas} eigenerZeitraum={eigenerBereich} />
      </div>
    );
  }

  // ── Plan bestätigt ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <MeineFestAufguesse
        aufguesse={meine}
        saunen={saunas}
        mitInfos={mitInfos}
        infosGeladen={infosGeladen}
        infosFehler={infosFehler}
        onInfosNeuLaden={onInfosNeuLaden}
        isAdmin={isAdmin}
        zeitraumEingetragen={!!eigener}
      />

      {bearbeiten ? formular : eigener ? zusammenfassung : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-forest-950/50 px-3 py-2 ring-1 ring-forest-800/50">
          <span className="text-xs text-forest-300/90">Der Plan steht. Du hast doch noch Zeit?</span>
          <button
            type="button"
            onClick={() => setBearbeiten(true)}
            className="min-h-[44px] rounded-xl bg-forest-900/80 px-3 py-2 text-xs font-semibold text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-900"
          >
            Zeitraum eintragen
          </button>
        </div>
      )}

      <FestPlanAnsicht plan={plan} saunen={saunas} aufguesse={festAufguesse} memberId={memberId} />

      <div>
        <button
          type="button"
          onClick={() => setUebersichtOffen((o) => !o)}
          aria-expanded={uebersichtOffen}
          className="flex min-h-[44px] w-full items-center justify-between rounded-xl bg-forest-950/50 px-3 py-2 text-left text-xs font-semibold text-forest-100 ring-1 ring-forest-800/50 hover:bg-forest-900/60"
        >
          <span>📊 Tagesübersicht (wer wann Zeit hätte)</span>
          <span aria-hidden className={`text-forest-400 transition-transform ${uebersichtOffen ? 'rotate-90' : ''}`}>▶</span>
        </button>
        {uebersichtOffen && (
          <div className="mt-2">
            <Tagesuebersicht datum={fest.datum} saunen={saunas} eigenerZeitraum={eigenerBereich} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── „✓ Eingetragen – du hättest Zeit: 14:30–19:30 · Lieblingssauna Kelo · höchstens 2 · Hinweis: …" ─
// Bewusst NICHT „Du bist dabei“: so heißt es in der Nachricht nach „Plan
// bestätigen“ nur für die tatsächlich Eingeteilten (0164).
function ZeitraumZusammenfassung({ fest, zeitraum, saunas, bestaetigt, onAendern }: {
  fest: SaunafestTag;
  zeitraum: SaunafestZeitraum;
  saunas: Sauna[];
  bestaetigt: boolean;
  onAendern: () => void;
}) {
  const loeschen = useSaunafestZeitraumLoeschen();
  const [fehler, setFehler] = useState<string | null>(null);
  const lieblings = zeitraum.lieblings_sauna_id ? saunas.find((s) => s.id === zeitraum.lieblings_sauna_id) : null;

  const teile = [
    `${hhmm(zeitraum.von)}–${hhmm(zeitraum.bis)} Uhr`,
    `Lieblingssauna ${lieblings ? lieblings.name : 'egal'}`,
    zeitraum.max_aufguesse ? `höchstens ${zeitraum.max_aufguesse}` : 'Anzahl egal',
  ];

  async function austragen() {
    if (!window.confirm(`Wirklich austragen? Dein Zeitraum für das Saunafest ${festDatumKurz(fest.datum)} wird gelöscht.`)) return;
    setFehler(null);
    try {
      await loeschen.mutateAsync(fest.datum);
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  return (
    <div className="rounded-2xl bg-emerald-500/10 p-3 ring-1 ring-emerald-500/35">
      <p className="text-sm font-bold text-emerald-100">
        {bestaetigt ? 'Dein Zeitraum:' : '✓ Eingetragen – du hättest Zeit:'}{' '}
        <span className="font-semibold text-forest-100">{teile.join(' · ')}</span>
      </p>
      {zeitraum.notiz && (
        <p className="mt-1 whitespace-pre-line break-words text-xs text-forest-300/90">
          <span className="font-semibold text-forest-100">Hinweis:</span> {zeitraum.notiz}
        </p>
      )}
      {fehler && (
        <p role="alert" className="mt-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-500/30">
          {fehler}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onAendern}
          disabled={loeschen.isPending}
          className="min-h-[44px] flex-1 rounded-xl bg-forest-900/80 px-3 py-2 text-sm font-semibold text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-900 disabled:opacity-60"
        >
          Ändern
        </button>
        <button
          type="button"
          onClick={austragen}
          disabled={loeschen.isPending}
          className="min-h-[44px] rounded-xl px-3 py-2 text-sm font-semibold text-rose-200 ring-1 ring-rose-500/40 hover:bg-rose-500/15 disabled:opacity-60"
        >
          {loeschen.isPending ? 'Trägt aus …' : 'Austragen'}
        </button>
      </div>
    </div>
  );
}
