// Admin-Karte „Eingangs-Tablet" (Migration 0153) — sitzt oben im Admin-Bereich,
// direkt unter dem Notfall-Alarm, damit sie nach der Push-Meldung sofort da ist.
//
// Außerhalb der Öffnungszeiten zeigt das Welcome-Tablet den Joker-Bildschirm-
// schoner und ist gesperrt. Tippt jemand darauf, bekommen alle Admins eine
// Nachricht — und nur hier lässt sich der Bildschirm freigeben (zeitlich
// begrenzt) oder wieder sperren. Unter „Zeiten" stehen die Öffnungszeiten,
// nach denen der Server sperrt, und der Hauptschalter.

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  useCurrentMember, useKioskSperreStatus, useKioskSperreFreigeben, useKioskSperreSperren,
  useKioskSperreKonfigSetzen, useKioskSperreJetztSperren, useKioskSperreAufheben, type KioskSperreZeiten,
} from '@/lib/api';

const ZEILEN: { key: keyof KioskSperreZeiten; label: string; hinweis: string }[] = [
  { key: 'di_do', label: 'Di – Do', hinweis: 'Aufgüsse 14–20 Uhr' },
  { key: 'fr_so', label: 'Fr – So', hinweis: 'auch Feiertag und offener Montag' },
  { key: 'fest',  label: 'Saunafest', hinweis: 'Aufgüsse 10:30–23:30' },
];

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
  const konfig = useKioskSperreKonfigSetzen();
  const jetztSperren = useKioskSperreJetztSperren();
  const aufheben = useKioskSperreAufheben();
  const [offen, setOffen] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<{ aktiv: boolean; zeiten: KioskSperreZeiten } | null>(null);

  const s = statusQ.data;

  // Entwurf der Einstellungen beim Aufklappen aus dem Serverstand füllen.
  useEffect(() => {
    if (offen && s && !entwurf) setEntwurf({ aktiv: s.aktiv, zeiten: s.zeiten });
    if (!offen && entwurf) setEntwurf(null);
  }, [offen, s, entwurf]);

  if (!isAdmin || !s) return null;

  const busy = freigeben.isPending || sperren.isPending || konfig.isPending || jetztSperren.isPending || aufheben.isPending;
  const beruehrtVor = s.letzte_beruehrung_at ? Date.now() - Date.parse(s.letzte_beruehrung_at) : null;
  const frischBeruehrt = s.gesperrt && beruehrtVor !== null && beruehrtVor < 30 * 60_000;

  const lage =
    s.grund === 'aus' ? { punkt: 'bg-forest-500', text: 'Bildschirmschoner ist ausgeschaltet — das Tablet ist immer offen.' }
    : s.grund === 'freigegeben' ? { punkt: 'bg-amber-400', text: `Von einem Admin freigegeben bis ${s.freigegeben_bis ? uhrzeit(s.freigegeben_bis) : '—'} Uhr.` }
    : s.grund === 'manuell' ? { punkt: 'bg-rose-500', text: `Von Hand gesperrt — der Joker läuft bis ${s.gesperrt_bis ? uhrzeit(s.gesperrt_bis) : '—'} Uhr, danach gelten wieder die Zeiten.` }
    : s.grund === 'offen' ? { punkt: 'bg-emerald-400', text: 'Geöffnet — das Tablet ist normal bedienbar.' }
    : { punkt: 'bg-rose-500', text: `Gesperrt — der Joker läuft${s.oeffnet_um ? `, öffnet um ${s.oeffnet_um} Uhr` : ''}.` };

  async function run(fn: () => Promise<unknown>, ok: string) {
    setMeldung(null);
    try { await fn(); setMeldung(ok); }
    catch (e) { setMeldung(`Fehler: ${(e as Error).message}`); }
  }

  function setZeit(key: keyof KioskSperreZeiten, idx: 0 | 1, wert: string) {
    setEntwurf((d) => {
      if (!d) return d;
      const paar: [string, string] = [...d.zeiten[key]] as [string, string];
      paar[idx] = wert;
      return { ...d, zeiten: { ...d.zeiten, [key]: paar } };
    });
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
          <h2 className="text-sm font-bold text-forest-100">Eingangs-Tablet</h2>
          <p className="flex items-center gap-2 text-xs text-forest-300">
            <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${lage.punkt}`} />
            <span>{lage.text}</span>
          </p>
          {s.letzte_beruehrung_at && (
            <p className={`mt-0.5 text-xs ${frischBeruehrt ? 'font-semibold text-amber-200' : 'text-forest-400'}`}>
              Zuletzt angetippt {formatDistanceToNow(new Date(s.letzte_beruehrung_at), { addSuffix: true, locale: de })}
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
              onClick={() => run(() => freigeben.mutateAsync(f.minuten), `Tablet für ${f.label} freigegeben.`)}
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
          {/* Sperre von Hand: die Zeiten sind nur ein Raster — wer früher schließt, startet den Joker hier. */}
          {s.aktiv && !s.gesperrt && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => jetztSperren.mutateAsync(), 'Tablet gesperrt — der Joker läuft bis morgen früh.')}
              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              Jetzt sperren
            </button>
          )}
          {s.grund === 'manuell' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => aufheben.mutateAsync(), 'Hand-Sperre aufgehoben — es gelten wieder die Zeiten.')}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-forest-100 ring-1 ring-forest-500/60 hover:bg-forest-800/60 disabled:opacity-50"
            >
              Sperre aufheben
            </button>
          )}
          <button
            type="button"
            onClick={() => setOffen((o) => !o)}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-forest-200 ring-1 ring-forest-600/60 hover:bg-forest-800/60"
            aria-expanded={offen}
          >
            Zeiten {offen ? '▴' : '▾'}
          </button>
        </div>
      </div>

      {meldung && <p className="mt-2 text-xs text-forest-200">{meldung}</p>}

      {offen && entwurf && (
        <div className="mt-4 border-t border-forest-700/50 pt-4">
          <label className="flex items-center gap-2 text-sm text-forest-100">
            <input
              type="checkbox"
              checked={entwurf.aktiv}
              onChange={(e) => setEntwurf({ ...entwurf, aktiv: e.target.checked })}
              className="h-4 w-4 accent-amber-500"
            />
            Bildschirmschoner außerhalb der Öffnungszeiten einschalten
          </label>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {ZEILEN.map((z) => (
              <div key={z.key} className="rounded-xl bg-forest-950/50 p-3 ring-1 ring-forest-800/60">
                <div className="text-xs font-bold text-forest-100">{z.label}</div>
                <div className="text-[11px] text-forest-400">{z.hinweis}</div>
                <div className="mt-2 flex items-center gap-2 text-xs text-forest-300">
                  <input
                    type="time"
                    value={entwurf.zeiten[z.key][0]}
                    onChange={(e) => setZeit(z.key, 0, e.target.value)}
                    className="rounded-md bg-forest-900 px-2 py-1 text-forest-100 ring-1 ring-forest-700"
                    aria-label={`${z.label} offen ab`}
                  />
                  <span>bis</span>
                  <input
                    type="time"
                    value={entwurf.zeiten[z.key][1]}
                    onChange={(e) => setZeit(z.key, 1, e.target.value)}
                    className="rounded-md bg-forest-900 px-2 py-1 text-forest-100 ring-1 ring-forest-700"
                    aria-label={`${z.label} offen bis`}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-2 text-[11px] text-forest-400">
            Montag ist Ruhetag (ganztägig gesperrt), außer der offene Montag ist im Aufgussplan eingeschaltet.
            Außerhalb dieser Zeiten läuft der Joker — tippt jemand darauf, bekommen alle Admins eine Nachricht.
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => konfig.mutateAsync(entwurf), 'Zeiten gespeichert.')}
            className="mt-3 rounded-lg bg-forest-600 px-4 py-2 text-xs font-bold text-white hover:bg-forest-500 disabled:opacity-50"
          >
            Speichern
          </button>
        </div>
      )}
    </section>
  );
}
