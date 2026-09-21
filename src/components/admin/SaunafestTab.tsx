// Admin-Reiter „Saunafest" (Migrationen 0150–0152).
//
// Am Fest bewerben sich die Aufgießer im Planer auf Slots — hier entscheidet
// der Admin. Die Matrix folgt dem Festraster (lib/saunafestPlan.ts): Zeilen
// sind die Uhrzeiten 10:30 … 23:30, Spalten die Saunen; Kacheln, die der Plan
// nicht vorsieht (z. B. Blockhaus um 10:30), sind zu. Ein Klick auf „Zuteilen"
// macht aus der Bewerbung den Aufguss des Bewerbers, die übrigen des Slots
// gelten als abgelehnt. „Aufheben" nimmt das zurück.

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  useSaunafestTage, useSaunafestBewerbungen, useSaunafestZuteilen, useSaunafestZuteilungAufheben,
  useSaunas, useAllMembers, useInfusions, sendPushTo,
  type SaunafestTag, type SaunafestBewerbung,
} from '@/lib/api';
import { festSlots, festZeiten, festSlotOffen, festAblaufText, hhmm, type FestSlot } from '@/lib/saunafestPlan';
import type { Infusion, Sauna } from '@/types/database';

function lokalDatum(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function lokalZeit(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Push an den Bewerber — Zugabe, nie Pflicht: schlägt der Versand fehl, steht die Zuteilung trotzdem.
 *  Läuft über sendPushTo (mit Login-Header): der nackte fetch davor kam als 401 nie an. */
async function benachrichtige(memberId: string, body: string) {
  try {
    await sendPushTo([memberId], { title: '🔥 Saunafest — du bist dran', body, url: '/planner', tag: 'saunafest-zuteilung' });
  } catch { /* still */ }
}

export function SaunafestTab() {
  const festeQ = useSaunafestTage();
  const bewQ = useSaunafestBewerbungen();
  const saunasQ = useSaunas();
  const membersQ = useAllMembers();
  const infusionsQ = useInfusions();
  const zuteilen = useSaunafestZuteilen();
  const aufheben = useSaunafestZuteilungAufheben();

  const heute = lokalDatum(new Date());
  const feste = useMemo(() => (festeQ.data ?? []).filter((f) => f.datum >= heute), [festeQ.data, heute]);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const fest: SaunafestTag | null = feste.find((f) => f.datum === gewaehlt) ?? feste[0] ?? null;

  const [busyId, setBusyId] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const memberName = (id: string) => membersQ.data?.find((m) => m.id === id)?.name ?? '?';

  const plan: FestSlot[] = useMemo(() => (fest ? festSlots(fest, saunasQ.data ?? []) : []), [fest, saunasQ.data]);
  const saunen: Sauna[] = useMemo(() => {
    const imPlan = new Set(plan.flatMap((s) => s.saunaIds));
    return (saunasQ.data ?? []).filter((s) => imPlan.has(s.id)).sort((a, b) => a.sort_order - b.sort_order);
  }, [plan, saunasQ.data]);
  const zeiten = useMemo(() => festZeiten(plan), [plan]);

  const bewerbungen = useMemo(() => (bewQ.data ?? []).filter((b) => fest && b.fest_datum === fest.datum), [bewQ.data, fest]);

  /** Echter Aufguss (kein Personal-Fallback) in Sauna × Uhrzeit am Festtag. */
  const aufgussIn = (saunaId: string, zeit: string): Infusion | undefined => {
    if (!fest) return undefined;
    return (infusionsQ.data ?? []).find((i) => {
      if (i.sauna_id !== saunaId || i.is_personal_fallback) return false;
      const s = new Date(i.start_time);
      return lokalDatum(s) === fest.datum && lokalZeit(s) === zeit;
    });
  };

  async function handleZuteilen(b: SaunafestBewerbung) {
    setBusyId(b.id); setMeldung(null);
    try {
      await zuteilen.mutateAsync(b.id);
      const sauna = saunen.find((s) => s.id === b.sauna_id)?.name ?? 'Sauna';
      const datum = fest ? format(new Date(`${fest.datum}T12:00:00`), 'dd.MM.') : '';
      setMeldung(`✓ ${memberName(b.member_id)} gießt am ${datum} um ${hhmm(b.slot_zeit)} Uhr in der ${sauna} auf.`);
      void benachrichtige(b.member_id, `${datum} · ${hhmm(b.slot_zeit)} Uhr · ${sauna}. Titel und Öle bitte im Planer eintragen.`);
    } catch (e) {
      setMeldung(`Zuteilen fehlgeschlagen: ${(e as Error).message}`);
    } finally { setBusyId(null); }
  }

  async function handleAufheben(b: SaunafestBewerbung) {
    if (!window.confirm(`Zuteilung für ${memberName(b.member_id)} aufheben? Der Aufguss wird wieder entfernt, alle Bewerber des Slots sind wieder im Rennen.`)) return;
    setBusyId(b.id); setMeldung(null);
    try {
      await aufheben.mutateAsync(b.id);
      setMeldung(`Zuteilung für ${memberName(b.member_id)} aufgehoben.`);
    } catch (e) {
      setMeldung(`Aufheben fehlgeschlagen: ${(e as Error).message}`);
    } finally { setBusyId(null); }
  }

  const offen = bewerbungen.filter((b) => b.status === 'offen').length;
  const zugeteilt = bewerbungen.filter((b) => b.status === 'zugeteilt').length;
  const bewerberIds = new Set(bewerbungen.map((b) => b.member_id));
  const slotsGesamt = plan.reduce((n, s) => n + s.saunaIds.length, 0);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-forest-950/70 p-4 ring-1 ring-amber-700/30 backdrop-blur">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold text-amber-100">
            <span>🔥</span><span>Saunafest — Aufgießer zuteilen</span>
          </h2>
          {fest && (
            <span className="text-xs text-forest-400 tabular-nums">
              {slotsGesamt} Slots · {bewerbungen.length} Bewerbungen von {bewerberIds.size} Personen · {zugeteilt} zugeteilt · {offen} offen
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-forest-300/70 leading-relaxed">
          Alle außer Gästen tragen im Planer ein, wann sie Zeit haben — so viele Slots sie wollen, auch du selbst
          (Planer → „Eintragen, wann ich Zeit habe"). Du entscheidest je Slot, wer aufgießt — daraus wird sein
          Aufguss, Titel und Öle trägt er selbst nach.
          {fest && <> Raster: {festAblaufText(fest)}.</>}
        </p>

        {feste.length === 0 ? (
          <p className="mt-3 text-xs text-forest-400">Keine kommenden Saunafeste eingetragen.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {feste.map((f) => {
              const aktiv = fest?.datum === f.datum;
              const n = (bewQ.data ?? []).filter((b) => b.fest_datum === f.datum).length;
              return (
                <button
                  key={f.datum}
                  type="button"
                  onClick={() => setGewaehlt(f.datum)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium ring-1 transition ${
                    aktiv ? 'bg-amber-500 text-amber-950 ring-amber-400' : 'bg-forest-900/60 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
                  }`}
                >
                  {format(new Date(`${f.datum}T12:00:00`), 'dd.MM.')} · {f.motto}
                  {n > 0 && <span className="ml-1.5 tabular-nums opacity-70">✋{n}</span>}
                </button>
              );
            })}
          </div>
        )}
        {meldung && <p className="mt-3 text-xs text-forest-200">{meldung}</p>}
      </section>

      {fest && (
        <section className="rounded-2xl bg-forest-950/70 p-3 ring-1 ring-forest-800/50 overflow-x-auto">
          <div
            className="grid gap-1.5 min-w-[640px]"
            style={{ gridTemplateColumns: `64px repeat(${saunen.length}, minmax(0, 1fr))` }}
          >
            <div />
            {saunen.map((s) => (
              <div key={`h-${s.id}`} className="flex items-center justify-center gap-1.5 rounded-md bg-forest-900/70 px-2 py-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: s.accent_color, boxShadow: `0 0 6px ${s.accent_color}` }} />
                <span className="text-xs font-bold text-forest-100">{s.name}</span>
                <span className="text-[10px] font-mono text-forest-400">{s.temperature_label}</span>
              </div>
            ))}

            {zeiten.map((zeit) => (
              <SlotZeile
                key={zeit}
                zeit={zeit}
                plan={plan}
                saunen={saunen}
                bewerbungen={bewerbungen.filter((b) => hhmm(b.slot_zeit) === zeit)}
                aufgussIn={aufgussIn}
                memberName={memberName}
                busyId={busyId}
                onZuteilen={handleZuteilen}
                onAufheben={handleAufheben}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-forest-500">
            ✋ = Bewerbung · ✓ = zugeteilt · 🧖 = Aufguss anderweitig eingetragen · — = in dieser Stunde nicht dran
          </p>
        </section>
      )}
    </div>
  );
}

function SlotZeile({ zeit, plan, saunen, bewerbungen, aufgussIn, memberName, busyId, onZuteilen, onAufheben }: {
  zeit: string;
  plan: FestSlot[];
  saunen: Sauna[];
  bewerbungen: SaunafestBewerbung[];
  aufgussIn: (saunaId: string, zeit: string) => Infusion | undefined;
  memberName: (id: string) => string;
  busyId: string | null;
  onZuteilen: (b: SaunafestBewerbung) => void;
  onAufheben: (b: SaunafestBewerbung) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-center rounded-md bg-forest-900/50 text-sm font-mono font-bold tabular-nums text-forest-100">
        {zeit}
      </div>
      {saunen.map((s) => {
        if (!festSlotOffen(plan, zeit, s.id)) {
          return (
            <div key={s.id} className="rounded-md bg-forest-950/30 px-2 py-2 text-center text-xs text-forest-500 ring-1 ring-forest-900/40">—</div>
          );
        }
        const inf = aufgussIn(s.id, zeit);
        const hier = bewerbungen.filter((b) => b.sauna_id === s.id);
        const zugeteilte = hier.find((b) => b.status === 'zugeteilt');
        const offene = hier.filter((b) => b.status !== 'zugeteilt');
        const fremd = inf && (!zugeteilte || zugeteilte.infusion_id !== inf.id);
        return (
          <div key={s.id} className={`rounded-md px-2 py-2 ring-1 space-y-1 ${zugeteilte ? 'bg-emerald-500/10 ring-emerald-500/40' : hier.length ? 'bg-amber-500/10 ring-amber-500/30' : 'bg-forest-900/40 ring-forest-800/40'}`}>
            {zugeteilte && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-emerald-100 truncate">✓ {memberName(zugeteilte.member_id)}</span>
                <button
                  type="button"
                  disabled={busyId === zugeteilte.id}
                  onClick={() => onAufheben(zugeteilte)}
                  className="shrink-0 rounded-md px-2 py-0.5 text-[10px] text-rose-200 ring-1 ring-rose-500/30 hover:bg-rose-500/15 disabled:opacity-50"
                >
                  Aufheben
                </button>
              </div>
            )}
            {fremd && (
              <div className="text-[11px] text-rose-200/90 truncate" title={inf.title}>🧖 {inf.title}</div>
            )}
            {offene.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2">
                <span className={`text-xs truncate ${b.status === 'abgelehnt' ? 'text-forest-500 line-through' : 'text-forest-100'}`}>
                  ✋ {memberName(b.member_id)}
                </span>
                {!zugeteilte && !inf && (
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => onZuteilen(b)}
                    className="shrink-0 rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    Zuteilen
                  </button>
                )}
              </div>
            ))}
            {!zugeteilte && !inf && offene.length === 0 && (
              <div className="text-[11px] text-forest-500">keine Bewerbung</div>
            )}
          </div>
        );
      })}
    </>
  );
}
