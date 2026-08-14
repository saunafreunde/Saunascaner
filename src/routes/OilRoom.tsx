import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { broadcastEvac } from '@/lib/evacuation';
import { sendEvacuationWithPhoto } from '@/lib/telegram';
import {
  useSaunas, useInfusions, useScheduleSettings, useMeisterDirectory,
  usePresentAufgieserPublic, useActiveEvacuation, useTriggerEvacuation, useEndEvacuation,
  useAllCustomOils, useAllCustomAttrs, useSudKraeuter, useSudMixe,
  useBrandSync, brandAssetUrl,
  useHolidaySet, isHolidayDate,
} from '@/lib/api';
import { useFullscreenLock } from '@/hooks/useFullscreenLock';
import { useNow } from '@/hooks/useNow';
import type { RegalKatalog } from '@/lib/oelraumZutaten';
import { OelraumAnzeige } from '@/components/oelraum/OelraumAnzeige';
import { OelraumEingabe, type EingabeAuftrag } from '@/components/oelraum/OelraumEingabe';

// Aus vite.config.ts via `define`. Hilft beim Erkennen, ob das Tablet noch ein
// veraltetes PWA-Bundle bedient (Hash in der Fußzeile mit dem aktuellen Deploy
// abgleichen).
declare const __APP_BUILD__: { sha: string; time: string };

/** Zurück zur Anzeige, wenn niemand mehr tippt. Die Anzeige ist der Normal-
 *  zustand des Geräts — ein offenes Formular blockiert sie für alle anderen. */
const RUECKFALL_MS = 3 * 60 * 1000;

/** Wie oft nach einem neuen Bundle gesucht wird. Früher passierte das nur beim
 *  Mount der Route — das reichte, solange der Sperrbildschirm bei jeder
 *  Benutzung neu aufgebaut wurde. Jetzt steht die Anzeige tage- bis wochenlang
 *  gemountet, und ohne diesen Takt bediente das Tablet ewig ein altes Bundle. */
const SW_PRUEF_MS = 30 * 60 * 1000;

/** Sekunden-genau wäre Verschwendung: die Anzeige rechnet in Minuten, und das
 *  Gerät läuft rund um die Uhr. Die Aufguss-Daten selbst kommen über den
 *  5-s-Poll von useInfusions herein, nicht über diesen Takt. */
const TAKT_MS = 10_000;

export default function OilRoom() {
  // Bleibt in der ÄUSSERSTEN Komponente: der Hook verlässt beim Unmount das
  // Vollbild. Läge er weiter innen, spränge das Tablet bei jedem Wechsel
  // zwischen Anzeige und Eingabe aus dem Vollbild.
  const { isFullscreen, enterFullscreen } = useFullscreenLock();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const pruefen = () => {
      navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {});
    };
    pruefen();
    const id = setInterval(pruefen, SW_PRUEF_MS);
    return () => clearInterval(id);
  }, []);

  const now = useNow(TAKT_MS);

  // ─── Daten ────────────────────────────────────────────────────────────────
  // Alle hier oben, nicht erst im Formular: die Anzeige braucht sie im
  // Ruhezustand, und der ist der Normalfall.
  const saunasQ = useSaunas();
  const infusionsQ = useInfusions();
  const scheduleQ = useScheduleSettings();
  const meisterQ = useMeisterDirectory();
  const presentQ = usePresentAufgieserPublic();
  const kraeuterQ = useSudKraeuter();
  const mixeQ = useSudMixe();
  const eigeneOeleQ = useAllCustomOils();
  const eigeneAttrsQ = useAllCustomAttrs();
  const holidaySet = useHolidaySet();
  const brand = useBrandSync();

  const evacQ = useActiveEvacuation();
  const trigEvac = useTriggerEvacuation();
  const endEvac = useEndEvacuation();

  const saunas = useMemo(() => saunasQ.data ?? [], [saunasQ.data]);
  const infusions = useMemo(() => infusionsQ.data ?? [], [infusionsQ.data]);
  const meister = useMemo(() => meisterQ.data ?? [], [meisterQ.data]);

  const anwesend = useMemo(
    () => new Set((presentQ.data ?? []).map((p) => p.member_id)),
    [presentQ.data],
  );

  const katalog: RegalKatalog = useMemo(() => ({
    eigeneOele: new Map((eigeneOeleQ.data ?? []).map((o) => [o.id, { name: o.name, emoji: o.emoji, color: o.color }])),
    kraeuter: new Map((kraeuterQ.data ?? []).map((k) => [k.id, k])),
    mixe: new Map((mixeQ.data ?? []).map((m) => [m.id, m])),
    eigeneAttrs: new Map((eigeneAttrsQ.data ?? []).map((a) => [a.id, { label: a.label, emoji: a.emoji, color: a.color }])),
  }), [eigeneOeleQ.data, kraeuterQ.data, mixeQ.data, eigeneAttrsQ.data]);

  const nameFuer = useCallback(
    (id: string | null) => (id ? meister.find((m) => m.id === id)?.name ?? 'Unbekannt' : '—'),
    [meister],
  );

  const istFeiertag = useCallback((d: Date) => isHolidayDate(d, holidaySet), [holidaySet]);

  // ─── Anzeige ↔ Eingabe ────────────────────────────────────────────────────
  const [auftrag, setAuftrag] = useState<EingabeAuftrag | null>(null);
  const rueckfallRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!auftrag) return;
    const neu = () => {
      clearTimeout(rueckfallRef.current);
      // Auch amGeraet leeren — der Rückfall IST der Zurückspring-Pfad: bleibt
      // die Person stehen, würde Stunden später ein Evakuierungsalarm dem
      // Falschen zugeschrieben.
      rueckfallRef.current = setTimeout(() => { setAuftrag(null); setAmGeraet(null); }, RUECKFALL_MS);
    };
    neu();
    window.addEventListener('touchstart', neu);
    window.addEventListener('mousedown', neu);
    window.addEventListener('keydown', neu);
    return () => {
      clearTimeout(rueckfallRef.current);
      window.removeEventListener('touchstart', neu);
      window.removeEventListener('mousedown', neu);
      window.removeEventListener('keydown', neu);
    };
  }, [auftrag]);

  const oeffnen = useCallback((vorgabe?: { saunaId: string; startTime: string }) => {
    if (!vorgabe) return setAuftrag({ art: 'neu' });
    // Die Forderungs-Anzeige zeigt auf einen BESTEHENDEN Aufguss. Den kann man
    // nicht neu anlegen (der Slot ist belegt) — er wird ergänzt.
    const inf = infusions.find(
      (i) => i.sauna_id === vorgabe.saunaId && i.start_time === vorgabe.startTime,
    );
    setAuftrag(inf ? { art: 'ergaenzen', inf } : { art: 'neu' });
  }, [infusions]);

  // ─── Evakuierung ──────────────────────────────────────────────────────────
  // Reihenfolge NICHT ändern: Foto → DB-Eintrag im eigenen try/catch →
  // Broadcast → Telegram. Der innere catch ist der Grund, warum der Alarm auch
  // bei kaputter Datenbank noch bei Telegram ankommt.
  const [evacBusy, setEvacBusy] = useState(false);
  const [evacToast, setEvacToast] = useState<string | null>(null);
  // Wer gerade am Gerät steht. Liegt hier oben, weil der Evakuierungs-Eintrag
  // festhalten soll, WER ausgelöst hat — die Eingabe meldet ihren gewählten
  // Aufgießer herauf. Wird beim Zurückspringen zur Anzeige geleert: das Tablet
  // ist ein gemeinsames Gerät, der Nächste darf nicht als der Vorige gelten.
  const [amGeraet, setAmGeraet] = useState<{ id: string; name: string } | null>(null);

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
      await new Promise((r) => setTimeout(r, 600));
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

  async function evakuierungAusloesen() {
    if (!confirm(amGeraet
      ? 'Evakuierungsalarm WIRKLICH auslösen?'
      : 'Evakuierungsalarm auslösen? (Kein Aufgießer ausgewählt)')) return;
    setEvacBusy(true);
    setEvacToast(null);

    const auslöser = amGeraet?.name ?? 'Öl-Raum-Tablet';
    const namen = (presentQ.data ?? []).map((p) => p.name);
    const foto = await capturePhoto();

    try {
      let ausgeloestAm = new Date().toISOString();
      try {
        // triggered_by darf leer bleiben — die Spalte nimmt NULL, und ein
        // Alarm ohne Namen ist tausendmal besser als kein Alarm.
        const ev = await trigEvac.mutateAsync({
          triggered_by: amGeraet?.id ?? null,
          present_names: namen,
        });
        ausgeloestAm = ev.triggered_at;
      } catch { /* weiter auch ohne DB-Eintrag */ }

      broadcastEvac({ type: 'start', triggeredBy: auslöser, triggeredAt: Date.parse(ausgeloestAm) });

      const r = await sendEvacuationWithPhoto({
        triggeredBy: auslöser,
        triggeredAt: new Date(ausgeloestAm),
        presentNames: namen,
        photoBlob: foto ?? undefined,
      });
      setEvacToast(r.ok
        ? `Alarm + ${foto ? 'Foto ' : ''}an Telegram gesendet.`
        : `Telegram fehlgeschlagen: ${r.detail ?? 'unbekannt'}`);
    } catch (e) {
      setEvacToast(`Fehler: ${(e as Error).message}`);
    } finally {
      setEvacBusy(false);
    }
  }

  const evakuierung = (
    <div className="rounded-2xl border-2 border-rose-600/60 bg-rose-950/40 p-4 ring-1 ring-rose-500/30">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-rose-200">🚨 Notfall</h2>
          <p className="mt-0.5 text-xs text-rose-200/70">Alarm auslösen + Foto an Telegram</p>
        </div>
        <button type="button" disabled={evacBusy} onClick={evakuierungAusloesen}
          className="whitespace-nowrap rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold uppercase text-white transition hover:bg-rose-500 disabled:opacity-60">
          {evacBusy ? 'Sendet …' : 'Evakuierung'}
        </button>
      </div>
      {evacToast && <p className="mt-2 text-xs text-rose-200/80">{evacToast}</p>}
    </div>
  );

  // ─── Evakuierungs-Overlay ─────────────────────────────────────────────────
  const evacuation = evacQ.data;
  if (evacuation) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-rose-950/98 p-6 text-center">
        <div className="mb-4 text-6xl">🚨</div>
        <h1 className="mb-2 text-3xl font-black uppercase tracking-widest text-rose-100">EVAKUIERUNG</h1>
        <p className="mb-4 text-rose-200">Bitte verlasse sofort das Gebäude.</p>
        <div className="mb-4 w-full max-w-sm rounded-2xl bg-rose-900/60 p-4 ring-1 ring-rose-500/40">
          <p className="mb-2 text-sm font-semibold text-rose-100">Anwesend ({evacuation.present_count}):</p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-rose-200">
            {evacuation.present_names.map((n) => <li key={n}>• {n}</li>)}
          </ul>
        </div>
        {evacToast && <p className="mb-3 text-xs text-rose-300/80">{evacToast}</p>}
        <button
          onClick={async () => {
            try { await endEvac.mutateAsync(evacuation.id); broadcastEvac({ type: 'stop' }); }
            catch { /* ignore */ }
          }}
          className="rounded-xl bg-rose-600 px-8 py-4 text-base font-bold text-white hover:bg-rose-500">
          Alarm beenden
        </button>
      </div>
    );
  }

  const vollbildKnopf = !isFullscreen ? (
    <button
      onClick={enterFullscreen}
      className="fixed right-3 top-3 z-50 rounded-xl bg-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-100 ring-1 ring-amber-400/60 backdrop-blur hover:bg-amber-500/40"
      title="Browser-Chrome ausblenden (volle Bildschirmfläche)"
    >
      📺 Vollbild
    </button>
  ) : null;

  // Build-Stempel und Neuladen bleiben erreichbar — an denen hängt die Diagnose
  // „bedient das Tablet noch ein altes Bundle?" (siehe SW_PRUEF_MS).
  const fusszeile = (
    <div className="flex items-center gap-3 text-[10px] text-forest-700/70">
      <button
        onClick={async () => {
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.update()));
          }
          window.location.reload();
        }}
        className="rounded px-2 py-1 font-semibold text-forest-600/80 ring-1 ring-forest-800/50"
        title="Holt ein neues Bundle, falls der Service Worker noch das alte ausliefert"
      >
        ⟳ neu laden
      </button>
      <span className="select-text font-mono tabular-nums">
        {__APP_BUILD__.sha} · {new Date(__APP_BUILD__.time).toLocaleDateString('de-DE', {
          day: '2-digit', month: '2-digit', year: '2-digit',
        })}
      </span>
    </div>
  );

  if (auftrag) {
    return (
      <>
        {vollbildKnopf}
        <OelraumEingabe
          auftrag={auftrag}
          saunas={saunas}
          infusions={infusions}
          meister={meister}
          anwesend={anwesend}
          mondayOpen={!!scheduleQ.data?.monday_open}
          istFeiertag={istFeiertag}
          onMeister={setAmGeraet}
          onFertig={() => { setAuftrag(null); setAmGeraet(null); }}
          evakuierung={evakuierung}
        />
      </>
    );
  }

  return (
    <>
      {vollbildKnopf}
      <OelraumAnzeige
        now={now}
        infusions={infusions}
        saunas={saunas}
        katalog={katalog}
        nameFuer={nameFuer}
        anwesend={anwesend}
        einstellungen={brand.oelraum}
        logoUrl={brandAssetUrl(brand.logo.icon)}
        hintergrundUrl={brandAssetUrl(brand.oelraum.hintergrund)}
        onEintragen={oeffnen}
        fusszeile={fusszeile}
      />
    </>
  );
}
