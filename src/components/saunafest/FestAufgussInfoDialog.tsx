// Angaben zu einem Fest-Aufguss (Nachtrag Christoph 24.09.2026): „Nachdem der
// Plan vom Admin bestätigt wurde, bekommt jeder eine Info in der App, dort
// soll er die Infos für diesen Aufguss angeben, damit wir die passende
// Aufguss-Tafel bauen können. Jedes Schild soll ein passendes Video werden."
//
// KEINE Pflichtfelder. Gespeichert wird über saunafest_aufguss_info_speichern
// (Migration 0164): Titel/Beschreibung und die ersten drei Öle landen in
// infusions (Tafel, Öl-Raum, Bewertung lesen sie wie immer), Thema, Bildidee,
// Musik, Requisiten und ALLE Öle in saunafest_aufguss_info. Danach stößt der
// Dialog das KI-Video an (api/saunafest-video.ts) — der Server entscheidet, ob
// sich die Angaben seit dem letzten Video überhaupt geändert haben.
//
// Admins dürfen fremde Fest-Aufgüsse bearbeiten; die „eigenen Öle" sind dann
// die des Aufgießers, nicht die des Admins (wie im EditInfusionModal).

import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useSaunafestAufgussInfos, useSaunafestAufgussInfoSpeichern, saunafestVideoStarten,
  useCurrentMember, useMember, useSaunas, useAllCustomOils, parseCustomOilId,
  SAUNAFEST_INFO_MAX,
  type SaunafestAufgussInfo, type CustomOil, type VideoStartAntwort,
} from '@/lib/api';
import { OIL_BY_ID } from '@/lib/oils';
import { isAdmin as istAdminRolle } from '@/lib/roles';
import { zutatenAus } from '@/lib/titelZutaten';
import { Portal } from '@/components/Portal';
import { TitleSuggestionPicker } from '@/components/TitleSuggestionPicker';
import { Zeichenzaehler } from '@/components/saunafest/Zeichenzaehler';
import { OelRegalAuswahl } from '@/components/saunafest/OelRegalAuswahl';
import { VideoVorschau } from '@/components/saunafest/VideoVorschau';
import type { Infusion } from '@/types/database';

/** Titel, den saunafest_einteilen vergibt — gilt hier als „noch kein Titel". */
const STANDARD_TITEL = 'Saunafest-Aufguss';

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** 'Sa 10.10. · 15:30' in Berliner Zeit — unabhängig von der Zeitzone des Geräts. */
function berlinZeitpunkt(iso: string): string {
  const teile = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const t = (typ: Intl.DateTimeFormatPartTypes) => teile.find((p) => p.type === typ)?.value ?? '';
  const wt = WOCHENTAG[new Date(Date.UTC(Number(t('year')), Number(t('month')) - 1, Number(t('day')))).getUTCDay()];
  return `${wt} ${t('day')}.${t('month')}. · ${t('hour')}:${t('minute')}`;
}

/** Doppelte und leere Einträge raus, Reihenfolge bleibt (wie der Server). */
function ohneDoppelte(ids: readonly (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const s = id?.trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

type Werte = {
  titel: string; beschreibung: string; thema: string;
  bildidee: string; musik: string; requisiten: string; oele: string[];
};

function vorbelegung(infusion: Infusion, info: SaunafestAufgussInfo | null): Werte {
  return {
    titel: infusion.title === STANDARD_TITEL ? '' : (infusion.title ?? ''),
    beschreibung: infusion.description ?? '',
    thema: info?.thema ?? '',
    bildidee: info?.bildidee ?? '',
    musik: info?.musik ?? '',
    requisiten: info?.requisiten ?? '',
    // Alle Öle stehen in den Angaben; ohne Angaben die (höchstens drei) aus dem Aufguss.
    oele: ohneDoppelte(info && info.oele.length > 0 ? info.oele : (infusion.oils ?? [])),
  };
}

export function FestAufgussInfoDialog({ infusion, onClose, onSaved }: {
  infusion: Infusion;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const infosQ = useSaunafestAufgussInfos([infusion.id]);
  const me = useCurrentMember();
  const saunasQ = useSaunas();
  const istAdmin = istAdminRolle(me.data);
  // Admin bearbeitet den Aufguss eines anderen → dessen Namen im Kopf zeigen.
  const fremd = istAdmin && !!infusion.saunameister_id && infusion.saunameister_id !== me.data?.id;
  const aufgiesserQ = useMember(fremd ? infusion.saunameister_id : null);

  const sauna = (saunasQ.data ?? []).find((s) => s.id === infusion.sauna_id) ?? null;
  const saunaText = sauna ? `${sauna.name} ${sauna.temperature_label ?? ''}`.trim() : '';
  const kopf = {
    titel: fremd
      ? `Saunafest-Aufguss${aufgiesserQ.data?.name ? ` von ${aufgiesserQ.data.name}` : ''}`
      : 'Dein Saunafest-Aufguss',
    zeile: `${berlinZeitpunkt(infusion.start_time)}${saunaText ? ` · ${saunaText}` : ''}`,
    admin: fremd,
  };

  // Erst rendern, wenn die Angaben da sind — sonst überschreibt die späte
  // Antwort, was schon getippt wurde. Ein Fehler beim Laden blockiert nicht:
  // dann eben mit dem, was im Aufguss selbst steht.
  const laedt = infosQ.isPending;
  const info = infosQ.data?.find((x) => x.infusion_id === infusion.id) ?? null;

  // Eine Portal-Instanz für beide Zustände — ein Wechsel der Portal-Instanz
  // ließe den Dialog einen Frame lang verschwinden.
  return (
    <Portal>
      {laedt ? (
        <Huelle kopf={kopf} onSchliessen={onClose} fuss={
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={KNOPF_ZWEIT}>Abbrechen</button>
          </div>
        }>
          <div className="space-y-3" aria-busy="true">
            <p className="text-sm text-forest-300">Deine Angaben werden geladen …</p>
            <div aria-hidden className="h-10 animate-pulse rounded-lg bg-forest-900/60" />
            <div aria-hidden className="h-24 animate-pulse rounded-lg bg-forest-900/60" />
          </div>
        </Huelle>
      ) : (
        <Formular
          infusion={infusion}
          start={vorbelegung(infusion, info)}
          ladeFehler={infosQ.isError}
          ownerId={infusion.saunameister_id ?? me.data?.id ?? null}
          istAdmin={istAdmin}
          sauna={sauna}
          kopf={kopf}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Portal>
  );
}

// ── Das eigentliche Formular ──────────────────────────────────────────────

type Kopf = { titel: string; zeile: string; admin: boolean };

function Formular({ infusion, start, ladeFehler, ownerId, istAdmin, sauna, kopf, onClose, onSaved }: {
  infusion: Infusion;
  start: Werte;
  ladeFehler: boolean;
  ownerId: string | null;
  istAdmin: boolean;
  sauna: { name: string; temperature_label?: string | null } | null;
  kopf: Kopf;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const speichernM = useSaunafestAufgussInfoSpeichern();
  const alleEigenenQ = useAllCustomOils();
  const eigene = alleEigenenQ.data ?? [];

  const [titel, setTitel] = useState(start.titel);
  const [beschreibung, setBeschreibung] = useState(start.beschreibung);
  const [thema, setThema] = useState(start.thema);
  const [bildidee, setBildidee] = useState(start.bildidee);
  const [musik, setMusik] = useState(start.musik);
  const [requisiten, setRequisiten] = useState(start.requisiten);
  const [oele, setOele] = useState<string[]>(start.oele);

  const [regalOffen, setRegalOffen] = useState(false);
  const [titelPickerOffen, setTitelPickerOffen] = useState(false);
  const [videoStartet, setVideoStartet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState<{ text: string; warnung: boolean } | null>(null);

  // „Ungespeichert?" — Vergleich mit dem zuletzt gespeicherten Stand.
  const stand = JSON.stringify({ titel, beschreibung, thema, bildidee, musik, requisiten, oele });
  const [gespeicherterStand, setGespeicherterStand] = useState(stand);
  const geaendert = stand !== gespeicherterStand;
  const beschaeftigt = speichernM.isPending || videoStartet;

  function schliessenMitNachfrage() {
    if (geaendert && !window.confirm('Deine Änderungen sind noch nicht gespeichert. Trotzdem schließen?')) return;
    onClose();
  }

  // Esc schließt — außer ein Unterfenster ist offen, das fängt Esc selbst.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || regalOffen || titelPickerOffen) return;
      if (geaendert && !window.confirm('Deine Änderungen sind noch nicht gespeichert. Trotzdem schließen?')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [regalOffen, titelPickerOffen, geaendert, onClose]);

  async function speichern() {
    if (beschaeftigt) return;
    setFehler(null);
    setErfolg(null);
    const gespeichert = stand;
    try {
      await speichernM.mutateAsync({
        infusionId: infusion.id,
        // Leerer Titel → wieder der Standard. Der Server ließe bei leerem
        // Titel sonst den bisherigen stehen — Löschen ginge nicht.
        titel: titel.trim() || STANDARD_TITEL,
        beschreibung, oele, thema, bildidee, musik, requisiten,
      });
    } catch (e) {
      // Die RPC-Meldungen sind schon deutsch und verständlich.
      const err = e as { message?: string };
      setFehler(err.message ?? String(e));
      return;
    }
    setGespeicherterStand(gespeichert);

    // Video anstoßen — scheitert das, sind die Angaben trotzdem gespeichert.
    setVideoStartet(true);
    let antwort: VideoStartAntwort;
    try {
      antwort = await saunafestVideoStarten(infusion.id);
    } catch {
      antwort = { status: 'fehler', meldung: 'Das Video ließ sich gerade nicht starten — später unten „Video neu erzeugen“ tippen.' };
    }
    setVideoStartet(false);
    qc.invalidateQueries({ queryKey: ['saunafest-videos'] });
    // Läuft schon ein Video, entsteht es aus den Angaben, mit denen es gestartet
    // wurde. veraltet: true = die gerade gespeicherten sind andere (Server-
    // meldung sagt das), false = dieselben, fehlt = unbekannt (Rennfall, Lese-
    // fehler) → sicherheitshalber ebenfalls als Hinweis.
    const laeuftUnklar = antwort.status === 'laeuft' && antwort.veraltet === undefined;
    setErfolg({
      text: laeuftUnklar
        ? 'Gespeichert ✓ — gerade entsteht schon ein Video. Zeigt es deine letzte Änderung nicht, tippe unten auf „Video neu erzeugen“, sobald es fertig ist.'
        : antwort.meldung ? `Gespeichert ✓ — ${antwort.meldung}` : 'Gespeichert ✓',
      warnung: antwort.status === 'fehler' || antwort.status === 'gesperrt' || antwort.veraltet === true || laeuftUnklar,
    });
    onSaved?.();
  }

  const M = SAUNAFEST_INFO_MAX;

  return (
    <>
      <Huelle
        kopf={kopf}
        onSchliessen={schliessenMitNachfrage}
        fuss={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={erfolg && !geaendert ? onClose : schliessenMitNachfrage}
              className={KNOPF_ZWEIT}
            >
              {erfolg && !geaendert ? 'Schließen' : 'Abbrechen'}
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={speichern}
              disabled={beschaeftigt}
              className="min-h-[44px] rounded-xl bg-amber-500 px-6 text-sm font-semibold text-amber-950 transition hover:bg-amber-400 active:scale-95 disabled:opacity-50"
            >
              {speichernM.isPending ? 'Speichern …' : videoStartet ? 'Video wird angestoßen …' : 'Speichern'}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <p className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm leading-snug text-amber-100 ring-1 ring-amber-500/25">
            Keine Pflichtfelder — alles, was du einträgst, hilft uns beim Schild und beim Video.
          </p>
          {ladeFehler && (
            <p className="rounded-lg bg-amber-950/40 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-800/40">
              Frühere Angaben ließen sich gerade nicht laden — beim Speichern werden sie ersetzt.
            </p>
          )}

          {/* Titel mit optionalen KI-Vorschlägen aus den gewählten Ölen */}
          <Feld
            id="fest-titel"
            label="Titel"
            wert={titel}
            onWert={setTitel}
            max={M.titel}
            platzhalter={STANDARD_TITEL}
            hilfe={oele.length === 0 ? 'Für Titel-Vorschläge erst unten Öle aus dem Regal wählen.' : undefined}
            zusatz={
              <button
                type="button"
                onClick={() => setTitelPickerOffen(true)}
                disabled={oele.length === 0}
                title={oele.length === 0 ? 'Erst Öle wählen — daraus entstehen die Vorschläge' : 'Titel-Vorschläge aus deinen Ölen'}
                className="min-h-[44px] rounded-md bg-amber-500/15 px-3 text-xs font-medium text-amber-300 ring-1 ring-amber-500/30 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ✨ Vorschläge
              </button>
            }
          />

          <Feld
            id="fest-beschreibung"
            label="Beschreibung"
            hilfe="Steht auf dem Schild — was erwartet die Gäste?"
            wert={beschreibung}
            onWert={setBeschreibung}
            max={M.beschreibung}
            platzhalter="z. B. Ein warmer Herbstaufguss mit Waldduft und einer Überraschung zum Schluss."
            zeilen={3}
          />

          <Feld
            id="fest-thema"
            label="Thema / Geschichte"
            hilfe="Worum geht es? Eine kleine Geschichte, ein Motto, ein Ort."
            wert={thema}
            onWert={setThema}
            max={M.thema}
            platzhalter="z. B. Ein Spaziergang durch den Schwarzwald im Oktober"
            zeilen={3}
          />

          <Feld
            id="fest-bildidee"
            label="Bildidee fürs Video"
            hilfe="Daraus entsteht das bewegte Bild auf der Tafel — ohne Personen und ohne Schrift."
            wert={bildidee}
            onWert={setBildidee}
            max={M.bildidee}
            platzhalter="z. B. Nebel im Herbstwald, warmes Licht, fallendes Laub"
            zeilen={3}
          />

          <Feld
            id="fest-musik"
            label="Musik"
            wert={musik}
            onWert={setMusik}
            max={M.musik}
            platzhalter="z. B. ruhige Klaviermusik, Waldgeräusche, Trommeln"
            zeilen={2}
          />

          <Feld
            id="fest-requisiten"
            label="Requisiten / Effekte"
            wert={requisiten}
            onWert={setRequisiten}
            max={M.requisiten}
            platzhalter="z. B. Fächer, Eiskugeln, Klangschale, Lichtwechsel"
            zeilen={2}
          />

          {/* Öle aus dem Regal */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-forest-300">Öle</p>
            <button
              type="button"
              onClick={() => setRegalOffen(true)}
              className="mt-1.5 flex min-h-[48px] w-full items-center justify-between gap-2 rounded-xl bg-forest-900/60 px-3 py-2.5 text-left text-sm text-forest-50 ring-1 ring-forest-700/50 transition hover:bg-forest-900"
            >
              <span>🌿 Öle aus dem Regal wählen ({oele.length} gewählt)</span>
              <span aria-hidden className="text-forest-400">›</span>
            </button>
            {oele.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Gewählte Öle in Reihenfolge">
                {oele.map((id, i) => (
                  <OelChip key={id} id={id} index={i} eigene={eigene} onEntfernen={() => setOele((alt) => alt.filter((x) => x !== id))} />
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] leading-snug text-forest-400">
              Der Öl-Raum zeigt alle gewählten Öle, die ersten drei als Runde 1–3.
            </p>
          </div>

          {fehler && (
            <p className="rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-800/40" role="alert">
              ⚠️ {fehler}
            </p>
          )}
          {erfolg && (
            <p
              className={`rounded-lg px-3 py-2 text-sm font-medium ring-1 ${
                erfolg.warnung
                  ? 'bg-amber-950/40 text-amber-200 ring-amber-700/40'
                  : 'bg-emerald-900/40 text-emerald-200 ring-emerald-500/40'
              }`}
              role="status"
            >
              {erfolg.text}
            </p>
          )}

          <VideoVorschau infusionId={infusion.id} darfNeuErzeugen istAdmin={istAdmin} />
        </div>
      </Huelle>

      {regalOffen && (
        <OelRegalAuswahl
          ausgewaehlt={oele}
          onChange={setOele}
          onClose={() => setRegalOffen(false)}
          memberId={ownerId}
        />
      )}

      {titelPickerOffen && (
        <TitleSuggestionPicker
          zutaten={zutatenAus({
            attrs: [],
            oils: oele,
            customOils: eigene,
            sauna,
            zeitpunkt: new Date(infusion.start_time),
          })}
          onPick={(t) => { setTitel(t.slice(0, M.titel)); setTitelPickerOffen(false); }}
          onClose={() => setTitelPickerOffen(false)}
        />
      )}
    </>
  );
}

// ── Bausteine ─────────────────────────────────────────────────────────────

const KNOPF_ZWEIT = 'min-h-[44px] rounded-xl bg-forest-900/70 px-4 text-sm text-forest-100 ring-1 ring-forest-700/50 transition hover:bg-forest-800';

/** Dialog-Hülle: mobil Vollbild, ab sm höchstens max-w-lg; Inhalt scrollt,
 *  der Fuß klebt unten. */
function Huelle({ kopf, onSchliessen, fuss, children }: {
  kopf: Kopf;
  onSchliessen: () => void;
  fuss: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/70 sm:items-center sm:p-4"
      onClick={onSchliessen}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fest-angaben-titel"
        className="flex h-screen-dvh w-full flex-col bg-forest-950 shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-2xl sm:ring-1 sm:ring-forest-700/60"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-forest-800/50 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:pt-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">
              🔥 Saunafest{kopf.admin && <span className="ml-1.5 rounded bg-violet-500/20 px-1.5 py-0.5 text-violet-200">Admin</span>}
            </p>
            <h2 id="fest-angaben-titel" className="mt-0.5 text-lg font-bold leading-tight text-forest-50">{kopf.titel}</h2>
            <p className="mt-0.5 text-sm tabular-nums text-forest-300">{kopf.zeile}</p>
          </div>
          <button
            type="button"
            onClick={onSchliessen}
            aria-label="Schließen"
            className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-forest-300 hover:bg-forest-800/60"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {children}
        </div>
        <footer className="shrink-0 border-t border-forest-800/50 bg-forest-950 px-4 pt-3 pb-safe-or-4 sm:px-5">
          {fuss}
        </footer>
      </div>
    </div>
  );
}

/** Ein Freitextfeld mit maxLength und runterzählendem Zeichenzähler. */
function Feld({ id, label, hilfe, wert, onWert, max, platzhalter, zeilen = 1, zusatz }: {
  id: string;
  label: string;
  hilfe?: string;
  wert: string;
  onWert: (s: string) => void;
  max: number;
  platzhalter: string;
  zeilen?: number;
  zusatz?: ReactNode;
}) {
  // text-base (16 px) gegen den iOS-Zoom beim Antippen.
  const klasse = 'mt-1 w-full rounded-lg bg-forest-900/60 px-3 py-2 text-base text-forest-50 placeholder-forest-400/50 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400 sm:text-sm';
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-forest-300">{label}</label>
        {zusatz}
      </div>
      {hilfe && <p className="mt-0.5 text-[11px] leading-snug text-forest-400">{hilfe}</p>}
      {zeilen > 1 ? (
        <textarea
          id={id}
          value={wert}
          onChange={(e) => onWert(e.target.value.slice(0, max))}
          maxLength={max}
          rows={zeilen}
          placeholder={platzhalter}
          className={`${klasse} resize-none`}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={wert}
          onChange={(e) => onWert(e.target.value.slice(0, max))}
          /* Return schließt nur die Tastatur (iPhone), speichert nicht. */
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
          enterKeyHint="done"
          autoComplete="off"
          maxLength={max}
          placeholder={platzhalter}
          className={klasse}
        />
      )}
      <div className="mt-1 flex justify-end">
        <Zeichenzaehler wert={wert} max={max} />
      </div>
    </div>
  );
}

/** Gewähltes Öl als Chip: Regalnummer + Name bzw. Name des eigenen Öls.
 *  Die ersten drei sind im Öl-Raum Runde 1–3 und deshalb hervorgehoben. */
function OelChip({ id, index, eigene, onEntfernen }: {
  id: string;
  index: number;
  eigene: CustomOil[];
  onEntfernen: () => void;
}) {
  const std = OIL_BY_ID[id];
  const uuid = std ? null : parseCustomOilId(id);
  const eigenes = uuid ? eigene.find((c) => c.id === uuid) ?? null : null;
  const name = std ? std.name : eigenes ? eigenes.name : uuid ? 'Eigenes Öl' : id;
  const runde = index < 3;
  return (
    <li
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full py-0.5 pl-2 pr-0.5 text-sm ring-1 ${
        runde ? 'bg-amber-500/15 text-amber-50 ring-amber-500/40' : 'bg-forest-900/70 text-forest-100 ring-forest-700/50'
      }`}
    >
      {runde && (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/90" title={`Runde ${index + 1} im Öl-Raum`}>
          R{index + 1}
        </span>
      )}
      {std ? (
        <span className="rounded bg-black/40 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">{std.number}</span>
      ) : uuid ? (
        <span aria-hidden>{eigenes?.emoji ?? '🌿'}</span>
      ) : null}
      <span className="max-w-[11rem] truncate">{name}</span>
      {uuid && <span className="text-[10px] text-violet-300/80">eigen</span>}
      <button
        type="button"
        onClick={onEntfernen}
        aria-label={`${name} entfernen`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-forest-300 hover:bg-black/30 hover:text-rose-200"
      >
        ✕
      </button>
    </li>
  );
}
