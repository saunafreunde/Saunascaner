// Admin-Karte „Displays" (Migrationen 0153–0155) — sitzt oben im Admin-Bereich,
// direkt unter dem Notfall-Alarm, damit sie nach der Push-Meldung sofort da ist.
//
// Ist die Sauna zu, zeigen alle Displays (TV-Tafel, Eingangs-Tablet, Öl-Raum,
// Scanner) den Joker-Bildschirmschoner und sind gesperrt. „Offen" rechnet der
// Server aus dem Aufguss-Raster: erster planbarer Slot − 30 min bis Ende des
// letzten Slots + 30 min. Tippt jemand auf ein gesperrtes Display, bekommen
// alle Admins eine Nachricht — und nur hier lässt sich freigeben (zeitlich
// begrenzt), von Hand sperren oder der Schoner ganz ausschalten.

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  useCurrentMember, useKioskSperreStatus, useKioskSperreFreigeben, useKioskSperreSperren,
  useKioskSperreAktivSetzen, useKioskSperreJetztSperren, useKioskSperreAufheben,
} from '@/lib/api';

const FREIGABEN: { minuten: number; label: string }[] = [
  { minuten: 30, label: '30 min' },
  { minuten: 120, label: '2 Std' },
  { minuten: 720, label: '12 Std' },
];

function uhrzeit(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function TabletSperreCard() {
  const me = useCurrentMember();
  const isAdmin = me.data?.role === 'admin';
  const statusQ = useKioskSperreStatus({ enabled: isAdmin, intervalMs: 15_000 });
  const freigeben = useKioskSperreFreigeben();
  const sperren = useKioskSperreSperren();
  const aktivSetzen = useKioskSperreAktivSetzen();
  const jetztSperren = useKioskSperreJetztSperren();
  const aufheben = useKioskSperreAufheben();
  const [meldung, setMeldung] = useState<string | null>(null);

  const s = statusQ.data;
  if (!isAdmin || !s) return null;

  const busy = freigeben.isPending || sperren.isPending || aktivSetzen.isPending || jetztSperren.isPending || aufheben.isPending;
  const beruehrtVor = s.letzte_beruehrung_at ? Date.now() - Date.parse(s.letzte_beruehrung_at) : null;
  const frischBeruehrt = s.gesperrt && beruehrtVor !== null && beruehrtVor < 30 * 60_000;

  const lage =
    s.grund === 'aus' ? { punkt: 'bg-forest-500', text: 'Joker ist ausgeschaltet — alle Displays sind immer offen.' }
    : s.grund === 'freigegeben' ? { punkt: 'bg-amber-400', text: `Von einem Admin freigegeben bis ${s.freigegeben_bis ? uhrzeit(s.freigegeben_bis) : '—'} Uhr.` }
    : s.grund === 'manuell' ? { punkt: 'bg-rose-500', text: `Von Hand gesperrt — der Joker läuft bis ${s.gesperrt_bis ? uhrzeit(s.gesperrt_bis) : '—'} Uhr, danach gilt wieder das Aufguss-Raster.` }
    : s.grund === 'offen' ? { punkt: 'bg-emerald-400', text: 'Geöffnet — alle Displays laufen normal.' }
    : { punkt: 'bg-rose-500', text: `Geschlossen — auf allen Displays läuft der Joker${s.oeffnet_um ? `, öffnet um ${s.oeffnet_um} Uhr` : ''}.` };

  const fenster = s.heute_von && s.heute_bis
    ? `Heute offen ${s.heute_von}–${s.heute_bis} Uhr`
    : 'Heute Ruhetag — ganztägig geschlossen';

  async function run(fn: () => Promise<unknown>, ok: string) {
    setMeldung(null);
    try { await fn(); setMeldung(ok); }
    catch (e) { setMeldung(`Fehler: ${(e as Error).message}`); }
  }

  return (
    <section
      className={`rounded-2xl p-4 ring-1 ${
        frischBeruehrt ? 'bg-amber-500/10 ring-amber-400/60' : 'bg-forest-900/50 ring-forest-700/50'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-2xl leading-none" aria-hidden>🃏</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-forest-100">Displays · Joker-Sperre</h2>
          <p className="flex items-center gap-2 text-xs text-forest-300">
            <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${lage.punkt}`} />
            <span>{lage.text}</span>
          </p>
          <p className="mt-0.5 text-xs text-forest-400">
            {fenster} <span className="text-forest-500">(Aufguss-Raster ± {s.puffer_min} min)</span>
          </p>
          {s.letzte_beruehrung_at && (
            <p className={`mt-0.5 text-xs ${frischBeruehrt ? 'font-semibold text-amber-200' : 'text-forest-400'}`}>
              {s.letztes_display ?? 'Display'} angetippt {formatDistanceToNow(new Date(s.letzte_beruehrung_at), { addSuffix: true, locale: de })}
              {' '}({uhrzeit(s.letzte_beruehrung_at)} Uhr) · insgesamt {s.beruehrungen}×
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {s.gesperrt && FREIGABEN.map((f) => (
            <button
              key={f.minuten}
              type="button"
              disabled={busy}
              onClick={() => run(() => freigeben.mutateAsync(f.minuten), `Displays für ${f.label} freigegeben.`)}
              className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-forest-950 hover:bg-amber-400 disabled:opacity-50"
            >
              Freigeben {f.label}
            </button>
          ))}
          {s.grund === 'freigegeben' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => sperren.mutateAsync(), 'Freigabe beendet.')}
              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              Wieder sperren
            </button>
          )}
          {/* Sperre von Hand: wer früher schließt, startet den Joker hier. */}
          {s.aktiv && !s.gesperrt && s.grund !== 'freigegeben' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => jetztSperren.mutateAsync(), 'Displays gesperrt — der Joker läuft bis morgen früh.')}
              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              Jetzt sperren
            </button>
          )}
          {s.grund === 'manuell' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => aufheben.mutateAsync(), 'Hand-Sperre aufgehoben — es gilt wieder das Aufguss-Raster.')}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-forest-100 ring-1 ring-forest-500/60 hover:bg-forest-800/60 disabled:opacity-50"
            >
              Sperre aufheben
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => run(
              () => aktivSetzen.mutateAsync(!s.aktiv),
              s.aktiv ? 'Joker ausgeschaltet — alle Displays bleiben offen.' : 'Joker eingeschaltet.',
            )}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-forest-200 ring-1 ring-forest-600/60 hover:bg-forest-800/60 disabled:opacity-50"
          >
            {s.aktiv ? 'Joker ausschalten' : 'Joker einschalten'}
          </button>
        </div>
      </div>

      {meldung && <p className="mt-2 text-xs text-forest-200">{meldung}</p>}
    </section>
  );
}
