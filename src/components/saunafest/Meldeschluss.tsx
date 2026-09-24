// Meldeschluss fürs Saunafest (Migration 0167) — Vorgabe Christoph 24.09.2026:
// „Do 18 Uhr ist Meldeschluss, baue auch einen Timer in der App ein, dass man
// sofort sieht, ob und bis wann man noch eine Rückmeldung geben kann."
//
// Standard ist der Donnerstag vor dem Fest, 18:00 (saunafest_tage.meldeschluss,
// vom Admin je Fest verschiebbar). Danach lehnt die Datenbank Änderungen von
// Nicht-Admins ab; die App blendet Formular, „Ändern" und „Austragen" aus.
//
// Der Countdown tickt alle 20 s — das ist der Planer auf dem Handy, nicht die
// 24/7-Tafel; dort läuft dieser Baustein nicht.

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { WEEKDAY_LABEL_DE_SHORT } from '@/lib/garantie';
import { useSaunafestMeldeschlussAendern, type SaunafestTag } from '@/lib/api';

/** „Do 08.10., 18:00 Uhr" */
export function meldeschlussText(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAY_LABEL_DE_SHORT[d.getDay()] ?? ''} ${format(d, 'dd.MM.')}, ${format(d, 'HH:mm')} Uhr`.trim();
}

/** Restzeit lesbar: „2 Tage 5 Std", „5 Std 20 Min", „42 Min", „unter 1 Min". */
export function restzeitText(ms: number): string {
  if (ms <= 0) return 'abgelaufen';
  const min = Math.floor(ms / 60_000);
  const tage = Math.floor(min / 1440);
  const std = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (tage >= 1) return `${tage} ${tage === 1 ? 'Tag' : 'Tage'}${std ? ` ${std} Std` : ''}`;
  if (std >= 1) return `${std} Std${m ? ` ${m} Min` : ''}`;
  if (m >= 1) return `${m} Min`;
  return 'unter 1 Min';
}

/** Kurzform fürs Abzeichen: „2 T", „5 Std", „42 Min". */
export function restzeitKurz(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min >= 1440) return `${Math.floor(min / 1440)} T`;
  if (min >= 60) return `${Math.floor(min / 60)} Std`;
  return `${Math.max(1, min)} Min`;
}

/** Tickende Uhr (alle 20 s) — nur wo ein Meldeschluss angezeigt wird. */
export function useJetzt(aktiv = true): number {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    if (!aktiv) return;
    const t = window.setInterval(() => setJetzt(Date.now()), 20_000);
    return () => window.clearInterval(t);
  }, [aktiv]);
  return jetzt;
}

export type MeldeschlussStand = { iso: string | null; restMs: number; vorbei: boolean };

export function meldeschlussStand(fest: Pick<SaunafestTag, 'meldeschluss'> | null, jetzt: number): MeldeschlussStand {
  const iso = fest?.meldeschluss ?? null;
  if (!iso) return { iso: null, restMs: Infinity, vorbei: false };
  const restMs = new Date(iso).getTime() - jetzt;
  return { iso, restMs, vorbei: restMs <= 0 };
}

/** Großer Countdown oben im Saunafest-Bereich. Nach der Planbestätigung nicht mehr nötig. */
export function MeldeschlussTimer({ stand, eingetragen, bestaetigt, istAdmin }: {
  stand: MeldeschlussStand;
  eingetragen: boolean;
  bestaetigt: boolean;
  istAdmin: boolean;
}) {
  if (!stand.iso || bestaetigt) return null;
  if (stand.vorbei) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl bg-forest-950/70 p-3 ring-1 ring-forest-700/60">
        <span className="text-2xl leading-none" aria-hidden>🔒</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-forest-100">Meldeschluss war {meldeschlussText(stand.iso)}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-forest-300/90">
            {istAdmin
              ? 'Für alle anderen ist die Rückmeldung jetzt gesperrt — du kannst weiter ändern und einteilen.'
              : eingetragen
                ? 'Deine Rückmeldung ist angekommen. Änderungen gehen jetzt nur noch über den Admin.'
                : 'Rückmeldungen sind nicht mehr möglich. Wenn du doch kannst, sprich bitte den Admin an.'}
          </p>
        </div>
      </div>
    );
  }
  const stunden = stand.restMs / 3_600_000;
  const farbe = stunden <= 24
    ? 'bg-rose-500/15 ring-rose-400/60 text-rose-100'
    : stunden <= 48
      ? 'bg-amber-500/15 ring-amber-400/60 text-amber-100'
      : 'bg-emerald-500/10 ring-emerald-400/40 text-emerald-100';
  return (
    <div role="timer" aria-live="off" className={`rounded-2xl p-3 ring-1 ${farbe}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-xs font-bold uppercase tracking-wider opacity-90">⏳ Meldeschluss {meldeschlussText(stand.iso)}</p>
        <p className="text-2xl font-black tabular-nums leading-none">noch {restzeitText(stand.restMs)}</p>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed opacity-90">
        {eingetragen
          ? 'Du bist eingetragen ✓ — bis dahin kannst du deinen Zeitraum noch ändern oder dich austragen.'
          : 'Bis dahin kannst du eintragen, wann du Zeit hättest. Danach teilt der Admin ein.'}
      </p>
    </div>
  );
}

/** Admin-Reiter: Meldeschluss je Fest ansehen und verschieben. */
export function MeldeschlussAdmin({ fest }: { fest: SaunafestTag }) {
  const jetzt = useJetzt();
  const stand = meldeschlussStand(fest, jetzt);
  const aendern = useSaunafestMeldeschlussAendern();
  const [offen, setOffen] = useState(false);
  const [wert, setWert] = useState(() => (fest.meldeschluss ? format(new Date(fest.meldeschluss), "yyyy-MM-dd'T'HH:mm") : ''));
  const [meldung, setMeldung] = useState<string | null>(null);

  async function speichern() {
    setMeldung(null);
    if (!wert) return setMeldung('Bitte Datum und Uhrzeit wählen.');
    try {
      await aendern.mutateAsync({ datum: fest.datum, meldeschluss: new Date(wert).toISOString() });
      setOffen(false);
      setMeldung('Meldeschluss gespeichert ✓');
    } catch (e) {
      setMeldung((e as Error).message);
    }
  }

  return (
    <div className="rounded-xl bg-forest-900/50 p-3 ring-1 ring-forest-700/50">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-forest-100">
          ⏳ Meldeschluss: {stand.iso ? meldeschlussText(stand.iso) : '—'}
        </span>
        {stand.iso && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${
            stand.vorbei ? 'bg-forest-950/70 text-forest-300 ring-forest-700/60' : 'bg-amber-500/20 text-amber-100 ring-amber-500/40'
          }`}>
            {stand.vorbei ? 'vorbei — Mitglieder können nichts mehr ändern' : `noch ${restzeitText(stand.restMs)}`}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOffen((o) => !o)}
          className="ml-auto inline-flex min-h-[44px] items-center rounded-xl bg-forest-900/80 px-3 py-2 text-xs font-semibold text-forest-100 ring-1 ring-forest-700/60 hover:bg-forest-900"
        >
          {offen ? 'Schließen' : 'Verschieben'}
        </button>
      </div>
      {offen && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={wert}
            onChange={(e) => setWert(e.target.value)}
            className="min-h-[44px] rounded-xl bg-forest-950/70 px-3 py-2 text-base sm:text-sm text-forest-100 ring-1 ring-forest-700/60"
          />
          <button
            type="button"
            onClick={speichern}
            disabled={aendern.isPending}
            className="min-h-[44px] rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-60"
          >
            {aendern.isPending ? 'Speichert …' : 'Speichern'}
          </button>
        </div>
      )}
      {meldung && <p className="mt-2 text-xs text-forest-200">{meldung}</p>}
    </div>
  );
}
