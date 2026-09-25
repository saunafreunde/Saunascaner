// Gerät koppeln per QR-Code (Migration 0197, 25.09.2026).
//
// Christoph musste den langen Kopplungs-Link am Anwesenheits-PC abtippen. Jetzt
// geht es andersherum, wie beim Anmelden eines Smart-TVs: Das GERÄT zeigt einen
// QR-Code und einen kurzen Code, ein Admin scannt ihn mit dem Handy und tippt
// „Freigeben". Das Gerät fragt alle 3 Sekunden nach und schaltet sich selbst
// frei. Das Token würfelt das Gerät selbst; der Server kennt nur seinen
// sha256-Wert. Einmal gekoppelt, bleibt das Gerät gekoppelt (localStorage).

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import {
  KIOSK_GERAET_ARTEN, geraetBeschreibung, kopplungAbschliessen, kopplungsCodeAnzeige, kopplungsToken,
  type KioskGeraetArt,
} from '@/lib/kioskGeraet';

type Phase =
  | { p: 'lade' }
  | { p: 'wartet'; anfrage: string; code: string; bis: number }
  | { p: 'fertig'; art: string; name: string }
  | { p: 'abgelehnt' }
  | { p: 'pause' }
  | { p: 'fehler'; text: string };

/** Nach so vielen abgelaufenen Codes (je 15 min) hört das Gerät auf, neue
 *  anzufordern, und zeigt einen Knopf — ein vergessener Bildschirm soll nicht
 *  tagelang Anfragen stellen. */
const MAX_ERNEUERUNGEN = 8;

export function GeraetKoppelnQr({
  art,
  onGekoppelt,
  kompakt = false,
}: {
  /** Vorschlag für den Admin; er kann die Art beim Freigeben noch ändern. */
  art: KioskGeraetArt | null;
  /** Nach der Freigabe. Standard: Seite neu laden (alle Kiosk-Prüfungen lesen
   *  das Token beim Start). */
  onGekoppelt?: (art: string) => void;
  kompakt?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>({ p: 'lade' });
  const [qr, setQr] = useState<string | null>(null);
  const [, setTakt] = useState(0);
  const tokenRef = useRef<string>('');
  const erneuertRef = useRef(0);
  const aktivRef = useRef(true);
  const onGekoppeltRef = useRef(onGekoppelt);
  onGekoppeltRef.current = onGekoppelt;

  const fertig = useCallback((token: string, gArt: string, name: string) => {
    kopplungAbschliessen(token);
    setPhase({ p: 'fertig', art: gArt, name });
    window.setTimeout(() => {
      if (!aktivRef.current) return;
      if (onGekoppeltRef.current) onGekoppeltRef.current(gArt);
      else window.location.reload();
    }, 1800);
  }, []);

  const anfragen = useCallback(async (neuesToken = false) => {
    setPhase({ p: 'lade' });
    try {
      if (!supabase) throw new Error('Keine Verbindung zum Server.');
      let token = kopplungsToken(neuesToken);
      let versuch = 0;
      while (versuch < 2) {
        versuch += 1;
        tokenRef.current = token;
        const { data, error } = await supabase.rpc('kiosk_kopplung_anfragen', {
          p_token: token, p_art: art, p_info: geraetBeschreibung(),
        });
        if (error) throw error;
        if (!aktivRef.current) return;
        const d = (data ?? {}) as { ok?: boolean; grund?: string; anfrage?: string; code?: string; gueltig_bis?: string };
        if (d.ok && d.anfrage && d.code) {
          setPhase({ p: 'wartet', anfrage: d.anfrage, code: d.code, bis: Date.parse(d.gueltig_bis ?? '') || Date.now() + 15 * 60_000 });
          return;
        }
        if (d.grund === 'schon_gekoppelt') {
          // Freigabe kam, während dieses Gerät nicht hingeschaut hat.
          const { data: g } = await supabase.rpc('kiosk_geraet_pruefen', { p_token: token });
          const gg = (g ?? {}) as { ok?: boolean; art?: string; name?: string };
          fertig(token, gg.art ?? art ?? '', gg.name ?? '');
          return;
        }
        if (d.grund === 'token_verbraucht') {
          token = kopplungsToken(true);
          continue;
        }
        if (d.grund === 'zu_viele_anfragen') {
          setPhase({ p: 'fehler', text: 'Gerade laufen zu viele Kopplungen gleichzeitig. Neuer Versuch in einer Minute.' });
          return;
        }
        throw new Error(d.grund ?? 'unbekannte Antwort');
      }
      throw new Error('kein gültiges Token');
    } catch (e) {
      if (!aktivRef.current) return;
      setPhase({ p: 'fehler', text: `Server nicht erreichbar (${(e as Error).message}). Neuer Versuch läuft automatisch.` });
    }
  }, [art, fertig]);

  useEffect(() => {
    aktivRef.current = true;
    void anfragen();
    return () => { aktivRef.current = false; };
  }, [anfragen]);

  // Fehler → nach 60 s selbst neu versuchen (Kiosk steht ohne Aufsicht).
  useEffect(() => {
    if (phase.p !== 'fehler') return;
    const t = window.setTimeout(() => void anfragen(), 60_000);
    return () => window.clearTimeout(t);
  }, [phase, anfragen]);

  // QR-Bild zum Code.
  const code = phase.p === 'wartet' ? phase.code : null;
  useEffect(() => {
    if (!code) { setQr(null); return; }
    QRCode.toDataURL(`${window.location.origin}/k/${code}`, { margin: 1, width: 520, errorCorrectionLevel: 'M' })
      .then((u) => { if (aktivRef.current) setQr(u); })
      .catch(() => setQr(null));
  }, [code]);

  // Warten auf die Freigabe: alle 3 s nachfragen.
  const anfrage = phase.p === 'wartet' ? phase.anfrage : null;
  useEffect(() => {
    if (!anfrage || !supabase) return;
    const sb = supabase;
    let laeuft = false;
    const t = window.setInterval(async () => {
      setTakt((x) => x + 1);
      if (laeuft) return;
      laeuft = true;
      try {
        const { data, error } = await sb.rpc('kiosk_kopplung_status', { p_anfrage: anfrage, p_token: tokenRef.current });
        if (error || !aktivRef.current) return;
        const d = (data ?? {}) as { status?: string; art?: string; name?: string };
        if (d.status === 'freigegeben') {
          window.clearInterval(t);
          fertig(tokenRef.current, d.art ?? '', d.name ?? '');
        } else if (d.status === 'abgelehnt') {
          window.clearInterval(t);
          setPhase({ p: 'abgelehnt' });
        } else if (d.status === 'abgelaufen' || d.status === 'unbekannt') {
          window.clearInterval(t);
          erneuertRef.current += 1;
          if (erneuertRef.current > MAX_ERNEUERUNGEN) setPhase({ p: 'pause' });
          else void anfragen();
        }
      } catch {
        /* Netz kurz weg — beim nächsten Takt wieder */
      } finally {
        laeuft = false;
      }
    }, 3000);
    return () => window.clearInterval(t);
  }, [anfrage, anfragen, fertig]);

  const label = art ? KIOSK_GERAET_ARTEN.find((a) => a.art === art)?.label : null;
  const restMin = phase.p === 'wartet' ? Math.max(0, Math.ceil((phase.bis - Date.now()) / 60_000)) : 0;

  return (
    <div className={`w-full rounded-3xl bg-forest-950/90 text-center ring-1 ring-amber-400/40 backdrop-blur ${kompakt ? 'p-5' : 'p-7'}`}>
      <h2 className={`${kompakt ? 'text-lg' : 'text-2xl'} font-bold text-forest-50`}>
        🔐 Gerät koppeln{label ? ` als ${label}` : ''}
      </h2>

      {phase.p === 'lade' && <p className="mt-6 text-forest-300">Code wird erzeugt …</p>}

      {phase.p === 'wartet' && (
        <>
          <ol className="mx-auto mt-3 max-w-sm space-y-1 text-left text-sm leading-snug text-forest-200">
            <li>1. Mit dem <strong className="text-amber-200">Handy eines Admins</strong> diesen QR-Code scannen.</li>
            <li>2. Auf dem Handy <strong className="text-amber-200">„Freigeben"</strong> tippen.</li>
            <li>3. Dieses Gerät schaltet sich danach von selbst frei.</li>
          </ol>
          <div className="mt-4 flex justify-center">
            {qr
              ? <img src={qr} alt="QR-Code zum Koppeln dieses Geräts" className={`${kompakt ? 'h-52 w-52' : 'h-64 w-64'} rounded-2xl bg-white p-2`} />
              : <div className={`${kompakt ? 'h-52 w-52' : 'h-64 w-64'} rounded-2xl bg-white/10`} />}
          </div>
          <p className="mt-4 text-xs uppercase tracking-widest text-forest-400">oder Code eingeben</p>
          <p className="mt-1 font-mono text-4xl font-black tracking-[0.18em] text-amber-300 tabular-nums">
            {kopplungsCodeAnzeige(phase.code)}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-snug text-forest-400">
            In der App: Admin → 🔐 Kiosk-Geräte → „Code eingeben". Der Code gilt noch
            {' '}{restMin} Min.; danach erscheint hier automatisch ein neuer.
          </p>
        </>
      )}

      {phase.p === 'fertig' && (
        <div className="mt-5">
          <div className="text-5xl">✅</div>
          <p className="mt-2 text-lg font-semibold text-forest-50">Freigegeben{phase.name ? ` als „${phase.name}"` : ''}.</p>
          <p className="mt-1 text-sm text-forest-300">Das Gerät startet gleich neu und ist dann einsatzbereit.</p>
        </div>
      )}

      {phase.p === 'abgelehnt' && (
        <div className="mt-5 space-y-3">
          <p className="text-base font-semibold text-rose-200">Die Kopplung wurde abgelehnt.</p>
          <button type="button" onClick={() => { erneuertRef.current = 0; void anfragen(true); }}
            className="rounded-xl bg-amber-500 px-5 py-3 font-semibold text-amber-950 hover:bg-amber-400">
            Neuen Code anzeigen
          </button>
        </div>
      )}

      {phase.p === 'pause' && (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-forest-300">Der Code ist abgelaufen.</p>
          <button type="button" onClick={() => { erneuertRef.current = 0; void anfragen(); }}
            className="rounded-xl bg-amber-500 px-5 py-3 font-semibold text-amber-950 hover:bg-amber-400">
            Neuen Code anzeigen
          </button>
        </div>
      )}

      {phase.p === 'fehler' && (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-rose-200">{phase.text}</p>
          <button type="button" onClick={() => void anfragen()}
            className="rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-forest-100 ring-1 ring-forest-600/60 hover:bg-forest-700">
            Jetzt erneut versuchen
          </button>
        </div>
      )}
    </div>
  );
}
