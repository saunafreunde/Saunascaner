// Vorschau des KI-Videos eines Fest-Aufgusses („Jedes Schild soll ein
// passendes Video werden", Christoph 24.09.2026). api/saunafest-video.ts
// malt aus den Angaben erst ein Standbild (status 'bild'), animiert es dann
// zu einem 5-s-Loop (status 'video') und legt beides im Bucket „assets" ab
// ('fertig'). Am Festtag läuft das Video als Hintergrund der Aufguss-Karte
// auf der TV-Tafel — hier sieht der Aufgießer (bzw. der Admin) es vorab.
//
// Der Stand kommt aus useSaunafestVideos; der Hook fragt alle 10 s nach,
// solange etwas in Arbeit ist — hier also kein eigener Timer. Wer viele
// Vorschauen auf einmal zeigt (Admin-Reiter), lädt alle Videos mit EINER
// Abfrage und reicht den Stand über `stand` herein — dann fragt die Vorschau
// nicht selbst.
// Neu erzeugen per Knopf: immer mit erzwingen=true (neu würfeln auch bei
// gleichen Angaben). Für Aufgießer begrenzt der Server die Zahl der
// Erzeugungen (system_config.saunafest_video.max_versuche), Admins sind
// ausgenommen; max_je_fest gilt für alle. Das Anstoßen nach dem Speichern
// (FestAufgussInfoDialog) läuft ohne Zwang und verbraucht bei unveränderten
// Angaben keinen Versuch.

import { useCallback, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useSaunafestVideos, saunafestVideoStarten, publicAssetUrl,
  type SaunafestVideo, type VideoStartAntwort,
} from '@/lib/api';

/** Von außen geladener Video-Stand (eine Sammel-Abfrage statt einer je Vorschau). */
export type VideoStand = { video: SaunafestVideo | null; laedt: boolean; fehler: boolean };

type Props = {
  infusionId: string;
  darfNeuErzeugen: boolean;
  istAdmin?: boolean;
  kompakt?: boolean;
  /** Gesetzt → keine eigene Abfrage, der Stand kommt von außen. */
  stand?: VideoStand;
};

type Meldung = { text: string; ton: 'gut' | 'neutral' | 'warnung' };

function tonFuer(antwort: VideoStartAntwort): Meldung['ton'] {
  if (antwort.status === 'gestartet') return 'gut';
  if (antwort.status === 'fehler' || antwort.status === 'gesperrt' || antwort.veraltet === true) return 'warnung';
  return 'neutral';
}

const MELDUNG_KLASSE: Record<Meldung['ton'], string> = {
  gut: 'text-emerald-300',
  neutral: 'text-forest-300',
  warnung: 'text-amber-300',
};

/** React setzt `muted` nur als Eigenschaft — manche iOS-Versionen prüfen fürs
 *  stille Autoplay aber defaultMuted/das Attribut. Einmal beim Einhängen setzen. */
function stummSchalten(el: HTMLVideoElement | null) {
  if (!el) return;
  el.muted = true;
  el.defaultMuted = true;
}

function statusText(v: SaunafestVideo | null): { symbol: string; text: string } {
  if (!v) return { symbol: '○', text: 'Noch kein Video' };
  switch (v.status) {
    case 'bild': return { symbol: '⏳', text: 'Standbild entsteht …' };
    case 'video': return { symbol: '⏳', text: 'Video entsteht …' };
    case 'fertig': return { symbol: '🎬', text: 'Video fertig' };
    case 'fehler': return { symbol: '⚠️', text: 'Video fehlgeschlagen' };
  }
}

export function VideoVorschau({ infusionId, darfNeuErzeugen, istAdmin, kompakt, stand }: Props) {
  const qc = useQueryClient();
  // Mit `stand` bleibt die eigene Abfrage aus (leere Liste → enabled: false).
  const eigeneQ = useSaunafestVideos(stand ? [] : [infusionId]);
  const v = stand ? stand.video : eigeneQ.data?.find((x) => x.infusion_id === infusionId) ?? null;
  const laedt = stand ? stand.laedt : eigeneQ.isPending;
  const ladeFehler = stand ? stand.fehler : eigeneQ.isError && !eigeneQ.data;
  const [startet, setStartet] = useState(false);
  const [meldung, setMeldung] = useState<Meldung | null>(null);

  // iOS im Stromsparmodus blockiert Autoplay — dann einen Tipp-Knopf zeigen,
  // statt still nur das Standbild. Deps leer: sonst ruft React den Ref bei
  // jedem Render neu auf (und damit jedes Mal play()).
  const [autoplayGesperrt, setAutoplayGesperrt] = useState(false);
  const videoRef = useCallback((el: HTMLVideoElement | null) => {
    stummSchalten(el);
    if (!el) return;
    el.play().then(
      () => setAutoplayGesperrt(false),
      (e: unknown) => {
        if (e instanceof DOMException && e.name === 'NotAllowedError') setAutoplayGesperrt(true);
      },
    );
  }, []);
  function abspielen(el: HTMLVideoElement | null) {
    if (!el) return;
    void el.play().then(() => setAutoplayGesperrt(false)).catch(() => {});
  }

  const inArbeit = v?.status === 'bild' || v?.status === 'video';
  const poster = publicAssetUrl(v?.poster_pfad);
  const video = publicAssetUrl(v?.video_pfad);
  // Ohne Eintrag entsteht das Video beim Speichern der Angaben — den Knopf
  // bekommt dann nur der Admin (z. B. aus dem Admin-Reiter heraus).
  const knopfZeigen = darfNeuErzeugen && (v !== null || istAdmin === true);
  const knopfText = !v ? 'Video jetzt erzeugen' : v.status === 'fehler' ? 'Nochmal versuchen' : 'Video neu erzeugen';

  async function neuErzeugen() {
    if (startet || inArbeit) return;
    if (v?.status === 'fertig' && !window.confirm(istAdmin
      ? 'Neues Video erzeugen? Das bisherige wird dabei ersetzt.'
      : 'Neues Video erzeugen? Das bisherige wird dabei ersetzt — das zählt als einer deiner begrenzten Versuche.')) return;
    setStartet(true);
    setMeldung(null);
    try {
      // Ausdrücklicher Knopfdruck → immer erzwingen (auch bei gleichen Angaben neu würfeln).
      const antwort = await saunafestVideoStarten(infusionId, true);
      setMeldung({ text: antwort.meldung, ton: tonFuer(antwort) });
    } catch {
      setMeldung({ text: 'Keine Verbindung — bitte gleich noch einmal versuchen.', ton: 'warnung' });
    } finally {
      setStartet(false);
      qc.invalidateQueries({ queryKey: ['saunafest-videos'] });
    }
  }

  // ── Kompakt: eine Zeile mit Mini-Standbild und Status ────────────────────
  if (kompakt) {
    const s = statusText(v);
    return (
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative h-7 w-16 shrink-0 overflow-hidden rounded bg-forest-900 ring-1 ring-forest-800/60">
            {poster && <img src={poster} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}
            {inArbeit && <span aria-hidden className="absolute inset-0 animate-pulse bg-amber-400/25" />}
          </span>
          <span
            className={`min-w-0 truncate text-xs ${v?.status === 'fehler' ? 'text-amber-300' : v?.status === 'fertig' ? 'text-forest-100' : 'text-forest-300'}`}
            title={v?.status === 'fehler' && v.fehler ? v.fehler : undefined}
          >
            <span aria-hidden className="mr-1">{s.symbol}</span>{laedt ? 'Lädt …' : s.text}
          </span>
          {knopfZeigen && (
            <button
              type="button"
              onClick={neuErzeugen}
              disabled={startet || inArbeit}
              aria-label={knopfText}
              title={knopfText}
              className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-forest-900/70 text-sm text-forest-100 ring-1 ring-forest-700/50 transition hover:bg-forest-800 disabled:opacity-40"
            >
              {startet ? '…' : '↻'}
            </button>
          )}
        </div>
        {meldung && <p className={`mt-1 text-[11px] leading-snug ${MELDUNG_KLASSE[meldung.ton]}`}>{meldung.text}</p>}
      </div>
    );
  }

  // ── Voll: 21:9-Rahmen wie die Kachel auf der Tafel ──────────────────────
  return (
    <section className="space-y-2 rounded-xl bg-forest-900/40 p-3 ring-1 ring-forest-800/50">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-forest-300">🎬 Video für die Tafel</p>
        {v && <span className="text-[11px] text-forest-400">{statusText(v).symbol} {statusText(v).text}</span>}
      </div>

      {laedt ? (
        <div aria-hidden className="aspect-[21/9] w-full animate-pulse rounded-lg bg-forest-900/70" />
      ) : ladeFehler ? (
        /* Nur ohne Daten — scheitert bloß ein Nachladen, bleibt der alte Stand stehen. */
        <p className="text-sm text-amber-300">Der Stand des Videos ließ sich gerade nicht laden.</p>
      ) : !v ? (
        <p className="rounded-lg bg-forest-950/60 px-3 py-3 text-sm text-forest-300 ring-1 ring-forest-800/50">
          Noch kein Video — es entsteht, sobald du deine Angaben speicherst.
        </p>
      ) : inArbeit ? (
        <div>
          <Rahmen>
            {poster ? (
              <img src={poster} alt="Standbild des Videos" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span aria-hidden className="absolute inset-0 animate-pulse bg-gradient-to-br from-forest-800/60 via-forest-900/40 to-amber-900/30" />
            )}
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/55 px-3 py-1.5 text-xs font-medium text-white">
              <span aria-hidden className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400" />
              Video wird erstellt …
            </span>
          </Rahmen>
          <p className="mt-1.5 text-[11px] leading-snug text-forest-400">
            {v.status === 'bild' ? 'Erst entsteht das Standbild, danach wird es bewegt.' : 'Das Standbild ist fertig und wird jetzt bewegt.'}
            {' '}Das dauert ein paar Minuten — du kannst das Fenster ruhig schließen.
          </p>
        </div>
      ) : v.status === 'fertig' ? (
        <Rahmen>
          {video ? (
            <video
              key={video}
              ref={videoRef}
              src={video}
              poster={poster ?? undefined}
              muted
              loop
              playsInline
              autoPlay
              preload="metadata"
              onPlaying={() => setAutoplayGesperrt(false)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : poster ? (
            <img src={poster} alt="Standbild des Videos" className="absolute inset-0 h-full w-full object-cover" />
          ) : null}
          {video && autoplayGesperrt && (
            <button
              type="button"
              aria-label="Video abspielen"
              onClick={(e) => abspielen(e.currentTarget.parentElement?.querySelector('video') ?? null)}
              className="absolute inset-0 flex items-center justify-center bg-black/25"
            >
              <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-xl text-white ring-1 ring-white/40">▶</span>
            </button>
          )}
        </Rahmen>
      ) : (
        <div className="space-y-2">
          {poster && (
            <Rahmen>
              <img src={poster} alt="Standbild des Videos" className="absolute inset-0 h-full w-full object-cover opacity-70" />
            </Rahmen>
          )}
          <div className="rounded-lg bg-amber-950/40 px-3 py-2 text-sm text-amber-200 ring-1 ring-amber-800/40">
            ⚠️ Das Video konnte nicht erstellt werden.
            {v.fehler && <span className="mt-0.5 block text-[11px] text-amber-300/80">{v.fehler}</span>}
          </div>
        </div>
      )}

      {knopfZeigen && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={neuErzeugen}
            disabled={startet || inArbeit}
            className="min-h-[44px] rounded-xl bg-forest-800/80 px-4 text-sm font-medium text-forest-50 ring-1 ring-forest-600/50 transition hover:bg-forest-700 disabled:opacity-40"
          >
            {startet ? 'Wird gestartet …' : `↻ ${knopfText}`}
          </button>
        </div>
      )}
      {meldung && <p className={`text-xs leading-snug ${MELDUNG_KLASSE[meldung.ton]}`} role="status">{meldung.text}</p>}
    </section>
  );
}

function Rahmen({ children }: { children: ReactNode }) {
  return (
    <div className="relative aspect-[21/9] w-full overflow-hidden rounded-lg bg-forest-950 ring-1 ring-forest-800/60">
      {children}
    </div>
  );
}
