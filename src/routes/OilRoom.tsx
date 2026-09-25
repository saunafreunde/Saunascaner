import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { broadcastEvac } from '@/lib/evacuation';
import { sendEvacuationWithPhoto, versandMeldung } from '@/lib/telegram';
import {
  useSaunas, useInfusions, OELRAUM_FALLBACK_TAGE, useScheduleSettings, useMeisterDirectory,
  usePresentAufgieserPublic, useActiveEvacuation, useTriggerEvacuation, useEndEvacuation,
  useAllCustomOils, useAllCustomAttrs, useSudKraeuter, useSudMixe,
  useBrandSync, brandAssetUrl,
  useHolidaySet, isHolidayDate,
  useKioskGeraetStatus, useEvakuierungUebergang,
} from '@/lib/api';
import { useFullscreenLock } from '@/hooks/useFullscreenLock';
import { useNow } from '@/hooks/useNow';
import type { RegalKatalog } from '@/lib/oelraumZutaten';
import { oelraumHintergrundPfad } from '@/lib/oelraumTageszeit';
import { OelraumAnzeige } from '@/components/oelraum/OelraumAnzeige';
import { OelraumEingabe, type EingabeAuftrag } from '@/components/oelraum/OelraumEingabe';
import { GeraetKoppelnQr } from '@/components/kiosk/GeraetKoppelnQr';

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
 *  Gerät läuft rund um die Uhr. Die Aufguss-Daten selbst kommen per Realtime
 *  bzw. über den Poll von useInfusions herein, nicht über diesen Takt. */
const TAKT_MS = 10_000;

/** Harte Frist fürs Evakuierungsfoto — der Alarm läuft zu diesem Zeitpunkt
 *  schon; ein offener Kamera-Dialog darf nur noch das Foto kosten. */
const FOTO_FRIST_MS = 3_000;

/** Ein Foto mit der Rückkamera, höchstens `fristMs` lang. Kommt die Kamera erst
 *  danach (Berechtigungsdialog später bestätigt), wird sie sofort wieder
 *  ausgeschaltet und kein Foto geliefert. */
async function fotoMitFrist(fristMs: number): Promise<Blob | null> {
  let abgelaufen = false;
  const aufnahme = (async (): Promise<Blob | null> => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (abgelaufen) return null;
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      await new Promise((r) => setTimeout(r, 600));
      if (abgelaufen) return null;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    } catch {
      return null;
    } finally {
      // Immer ausschalten — auch wenn die Frist schon vorbei ist.
      stream?.getTracks().forEach((t) => t.stop());
    }
  })();
  const frist = new Promise<null>((resolve) => setTimeout(() => { abgelaufen = true; resolve(null); }, fristMs));
  return Promise.race([aufnahme, frist]);
}

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
  // Personal-Fallbacks nur so weit, wie die Tagesleiste der Eingabe reicht
  // (maxTageVoraus 28); echte Aufgüsse kommen weiterhin alle.
  const infusionsQ = useInfusions({ fallbackTage: OELRAUM_FALLBACK_TAGE });
  // poll: das Tablet bleibt wochenlang gemountet.
  const scheduleQ = useScheduleSettings({ poll: true });
  const meisterQ = useMeisterDirectory({ poll: true });
  const presentQ = usePresentAufgieserPublic();
  const kraeuterQ = useSudKraeuter();
  const mixeQ = useSudMixe();
  const eigeneOeleQ = useAllCustomOils();
  const eigeneAttrsQ = useAllCustomAttrs();
  const holidaySet = useHolidaySet();
  // Mit Takt: die Anzeige bleibt wochenlang gemountet, Admin-Änderungen
  // (Hintergrund, Tageszeit, Vorlauf) müssen ohne Neuladen ankommen.
  const brand = useBrandSync({ poll: true });

  const evacQ = useActiveEvacuation();
  const trigEvac = useTriggerEvacuation();
  // Kopplung (0177): Eintragen am Tablet geht nur, wenn dieses Gerät als
  // Öl-Raum-Gerät gekoppelt ist. Ohne Kopplung zeigt die Anzeige einen Hinweis.
  const geraet = useKioskGeraetStatus();
  const gekoppelt = geraet.data?.status === 'ok' && geraet.data.art === 'oelraum';
  // Nur eine ECHTE Antwort „nicht gekoppelt" zählt — ein Ladefehler ist kein
  // Kopplungsverlust (dann „Prüfe Gerät …", neuer Versuch alle 30 s).
  const sicherUngekoppelt = !!geraet.data && !gekoppelt;
  // Ungekoppelt geht der Alarm nur noch im Übergang (0191) — für den Hinweis.
  const uebergangQ = useEvakuierungUebergang(sicherUngekoppelt);
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
  // Reihenfolge (Audit-Runde 2, 25.09.2026): ZUERST der Alarm (DB-Eintrag →
  // Overlay und Sirene auf allen Geräten; Push + Telegram-Text stößt die
  // Datenbank selbst an, 0191), DANN das Foto mit harter Frist, DANN
  // /api/send-evacuation — das schickt nur noch das Foto nach (bzw. Text und
  // Push, falls der Server-Anstoß scheiterte). Vorher kam das Foto zuerst: Ein
  // offener Kamera-Dialog hielt den Alarm unbegrenzt auf, und ein Fehler beim
  // Auslösen wurde verschluckt (ohne DB-Eintrag gibt es aber keinen Alarm).
  const [evacBusy, setEvacBusy] = useState(false);
  const [evacToast, setEvacToast] = useState<string | null>(null);
  // Auslösen gescheitert → großes Fenster mit dem, was jetzt zu tun ist.
  const [evacFehler, setEvacFehler] = useState<string | null>(null);
  // Wer gerade am Gerät steht. Liegt hier oben, weil der Evakuierungs-Eintrag
  // festhalten soll, WER ausgelöst hat — die Eingabe meldet ihren gewählten
  // Aufgießer herauf. Wird beim Zurückspringen zur Anzeige geleert: das Tablet
  // ist ein gemeinsames Gerät, der Nächste darf nicht als der Vorige gelten.
  const [amGeraet, setAmGeraet] = useState<{ id: string; name: string } | null>(null);
  // Kopplung per QR-Code (0197): Tablet zeigt den Code, Admin gibt per Handy frei.
  const [koppelnOffen, setKoppelnOffen] = useState(false);

  async function evakuierungAusloesen(schonBestaetigt = false) {
    if (!schonBestaetigt && !confirm(amGeraet
      ? 'Evakuierungsalarm WIRKLICH auslösen?'
      : 'Evakuierungsalarm auslösen? (Kein Aufgießer ausgewählt)')) return;
    setEvacBusy(true);
    setEvacToast(null);
    setEvacFehler(null);

    const auslöser = amGeraet?.name ?? 'Öl-Raum-Tablet';
    let ev: Awaited<ReturnType<typeof trigEvac.mutateAsync>>;
    try {
      // triggered_by darf leer bleiben — die Spalte nimmt NULL, und ein
      // Alarm ohne Namen ist tausendmal besser als kein Alarm.
      ev = await trigEvac.mutateAsync({ triggered_by: amGeraet?.id ?? null });
    } catch (e) {
      // KEIN Alarm entstanden (nicht gekoppelt, gebremst, Netz weg …). Ohne
      // DB-Eintrag gibt es weder Overlay noch Push noch Telegram — also laut
      // sagen, statt es in einer Zeile Kleingedrucktem zu verstecken.
      setEvacFehler((e as Error).message || 'unbekannter Fehler');
      setEvacBusy(false);
      return;
    }

    try {
      broadcastEvac({ type: 'start', triggeredBy: auslöser, triggeredAt: Date.parse(ev.triggered_at) });
      // Foto nur vom gekoppelten Tablet: im Übergang nimmt der Server keins an,
      // dann soll auch kein Kamera-Dialog aufgehen.
      const foto = gekoppelt ? await fotoMitFrist(FOTO_FRIST_MS) : null;
      const r = await sendEvacuationWithPhoto({
        triggeredBy: auslöser,
        triggeredAt: new Date(ev.triggered_at),
        presentNames: Array.isArray(ev.present_names) ? ev.present_names : [],
        photoBlob: foto ?? undefined,
      });
      setEvacToast(`${ev.schon_aktiv ? 'Alarm lief bereits.' : 'Alarm ausgelöst.'} ${versandMeldung(r)}`);
    } catch (e) {
      setEvacToast(`Alarm läuft, aber: ${(e as Error).message}`);
    } finally {
      setEvacBusy(false);
    }
  }

  // Hinweis am Notfall-Knopf, wenn das Tablet (sicher) nicht gekoppelt ist.
  const alarmHinweis = !sicherUngekoppelt ? null
    : uebergangQ.data === false
      ? '⛔ Tablet nicht gekoppelt — Alarm von hier NICHT möglich. Im Notfall: Admin/Personal per Handy anrufen, bei Feuer 112. Ein Admin muss das Tablet koppeln.'
      : uebergangQ.data === true
        ? '⚠️ Tablet nicht gekoppelt — Alarm geht hier nur noch übergangsweise (ohne Foto, längstens bis 08.10.). Ein Admin muss das Tablet koppeln.'
        : null;

  const evakuierung = (
    <div className="rounded-2xl border-2 border-rose-600/60 bg-rose-950/40 p-4 ring-1 ring-rose-500/30">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-rose-200">🚨 Notfall</h2>
          <p className="mt-0.5 text-xs text-rose-200/70">
            {gekoppelt ? 'Alarm auslösen + Foto an Telegram' : 'Alarm auslösen (Push + Telegram)'}
          </p>
        </div>
        <button type="button" disabled={evacBusy} onClick={() => void evakuierungAusloesen()}
          className="whitespace-nowrap rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold uppercase text-white transition hover:bg-rose-500 disabled:opacity-60">
          {evacBusy ? 'Sendet …' : 'Evakuierung'}
        </button>
      </div>
      {alarmHinweis && (
        <p className="mt-2 rounded-lg bg-amber-500/90 px-2.5 py-1.5 text-xs font-semibold leading-snug text-amber-950">{alarmHinweis}</p>
      )}
      {evacToast && <p className="mt-2 text-xs text-rose-200/80">{evacToast}</p>}
    </div>
  );

  // Auslösen gescheitert: großes Fenster über allem (auch über der Eingabe).
  const evacFehlerFenster = evacFehler ? (
    <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-6">
      <div className="w-full max-w-lg rounded-3xl bg-rose-700 p-6 text-center text-white shadow-2xl ring-4 ring-white/70">
        <div className="text-6xl" aria-hidden>⛔</div>
        <h2 className="mt-2 text-3xl font-black uppercase tracking-wide">Alarm NICHT ausgelöst</h2>
        <p className="mt-3 rounded-xl bg-black/30 px-3 py-2 text-sm">{evacFehler}</p>
        <ol className="mt-4 space-y-2 text-left text-lg font-semibold leading-snug">
          <li>1. Laut rufen und alle warnen.</li>
          <li>2. Handy: Admin oder Personal anrufen — oder angemeldet in der App den Alarm auslösen.</li>
          <li>3. Bei Feuer oder Verletzten: <strong>112</strong>.</li>
        </ol>
        {sicherUngekoppelt && (
          <p className="mt-3 text-sm text-rose-100">
            Dieses Tablet ist nicht gekoppelt. Ein Admin koppelt es über „📱 Jetzt koppeln" oben links (QR-Code mit dem Handy scannen).
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <button type="button" disabled={evacBusy} onClick={() => void evakuierungAusloesen(true)}
            className="flex-1 rounded-2xl bg-white px-4 py-4 text-lg font-bold text-rose-700 disabled:opacity-60">
            {evacBusy ? 'Versuche …' : 'Nochmal versuchen'}
          </button>
          <button type="button" onClick={() => setEvacFehler(null)}
            className="rounded-2xl bg-rose-900/60 px-4 py-4 text-base font-semibold ring-1 ring-white/40">
            Schließen
          </button>
        </div>
      </div>
    </div>
  ) : null;

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

  // Eintragen/Planen bleibt ohne Kopplung gesperrt (Sicherheitsentscheidung
  // 0177) — der Hinweis muss deshalb unübersehbar sagen, dass ein Admin koppeln
  // muss. Ein Ladefehler ist KEIN „nicht gekoppelt" (sonst hielte man die
  // Kopplung nach einem kurzen Netzausfall für verloren).
  const kopplungsHinweis = sicherUngekoppelt ? (
    <div className="fixed left-3 top-3 z-50 max-w-md rounded-xl bg-amber-500/95 px-4 py-3 text-sm font-semibold leading-snug text-amber-950 shadow-lg ring-2 ring-amber-200">
      <div className="text-base font-black">🔐 Admin muss dieses Tablet koppeln</div>
      Ohne Kopplung gehen hier kein Eintragen, Ändern, Übernehmen oder Absagen
      {uebergangQ.data === false ? ' — und auch kein Evakuierungsalarm' : ''}.
      <button
        type="button"
        onClick={() => setKoppelnOffen(true)}
        className="mt-2 block w-full rounded-lg bg-amber-950 px-3 py-2 text-sm font-bold text-amber-100 hover:bg-amber-900"
      >
        📱 Jetzt koppeln (QR-Code für das Admin-Handy)
      </button>
    </div>
  ) : !geraet.data && geraet.isError ? (
    <div className="fixed left-3 top-3 z-50 max-w-sm rounded-xl bg-slate-800/90 px-3 py-2 text-xs font-semibold text-slate-100 shadow-lg">
      Prüfe Gerät … (Server gerade nicht erreichbar, neuer Versuch läuft)
    </div>
  ) : null;

  const koppelnFenster = koppelnOffen && sicherUngekoppelt ? (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[65] grid place-items-center overflow-y-auto bg-black/80 p-4">
      <div className="w-full max-w-md space-y-3">
        <GeraetKoppelnQr art="oelraum" />
        <button type="button" onClick={() => setKoppelnOffen(false)}
          className="w-full rounded-xl bg-forest-900/90 px-4 py-3 text-sm font-semibold text-forest-100 ring-1 ring-forest-700/60 hover:bg-forest-800">
          Schließen
        </button>
      </div>
    </div>
  ) : null;

  if (auftrag) {
    return (
      <>
        {vollbildKnopf}
        {kopplungsHinweis}
        {koppelnFenster}
        {evacFehlerFenster}
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
      {kopplungsHinweis}
      {koppelnFenster}
      {evacFehlerFenster}
      <OelraumAnzeige
        now={now}
        infusions={infusions}
        saunas={saunas}
        katalog={katalog}
        nameFuer={nameFuer}
        anwesend={anwesend}
        einstellungen={brand.oelraum}
        logoUrl={brandAssetUrl(brand.logo.icon)}
        // Nach Tageszeit, wenn eingeschaltet — `now` tickt ohnehin alle 10 s,
        // der Phasenwechsel braucht keinen eigenen Timer.
        hintergrundUrl={brandAssetUrl(oelraumHintergrundPfad(brand.oelraum, now))}
        onEintragen={oeffnen}
        fusszeile={fusszeile}
      />
    </>
  );
}
