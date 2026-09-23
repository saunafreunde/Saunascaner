// Saunafest: eigenen Zeitraum eintragen (Migration 0163).
//
// Vorgabe Christoph 23./24.09.2026: beim Fest wählt man NUR einen Zeitraum —
// den ersten und den letzten Aufguss, den man übernehmen könnte —, dazu die
// Lieblingssauna, wie viele Aufgüsse man höchstens schafft, und einen Hinweis/
// Wunsch an den Admin (max. 300 Zeichen, Zähler zählt runter). Eingeteilt wird
// vom Admin. Die Uhrzeiten als native <select> (iOS zeigt das Rad), Eingaben
// in text-base, damit Safari nicht hineinzoomt.

import { useMemo, useState } from 'react';
import {
  useSaunafestZeitraumSetzen, SAUNAFEST_NOTIZ_MAX,
  type SaunafestTag, type SaunafestZeitraum,
} from '@/lib/api';
import { festZeiten, hhmm, type FestSlot } from '@/lib/saunafestPlan';
import { Zeichenzaehler } from '@/components/saunafest/Zeichenzaehler';
import type { Sauna } from '@/types/database';

function minuten(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

const MAX_WAHL: (number | null)[] = [1, 2, 3, 4, null];

export function ZeitraumFormular({ fest, plan, saunen, bestehend, onGespeichert, onAbbrechen }: {
  fest: SaunafestTag;
  plan: FestSlot[];
  /** Saunen, die am Fest laufen (Reihenfolge wie auf der Tafel). */
  saunen: Sauna[];
  /** Vorhandener Eintrag beim „Ändern" — sonst null (Felder starten leer). */
  bestehend: SaunafestZeitraum | null;
  onGespeichert: () => void;
  /** Nur beim Ändern: zurück zur Zusammenfassung. */
  onAbbrechen?: () => void;
}) {
  const setzen = useSaunafestZeitraumSetzen();
  const zeiten = useMemo(() => festZeiten(plan), [plan]);

  // Vorhandene Werte nur übernehmen, wenn es die Zeit im Raster noch gibt.
  const start = (t: string | undefined) => {
    const z = t ? hhmm(t) : '';
    return zeiten.includes(z) ? z : '';
  };
  const [von, setVon] = useState<string>(() => start(bestehend?.von));
  const [bis, setBis] = useState<string>(() => start(bestehend?.bis));
  const [lieblings, setLieblings] = useState<string | null>(bestehend?.lieblings_sauna_id ?? null);
  const [max, setMax] = useState<number | null>(bestehend?.max_aufguesse ?? null);
  const [notiz, setNotiz] = useState<string>(bestehend?.notiz ?? '');
  const [fehler, setFehler] = useState<string | null>(null);

  const bereichOk = !!von && !!bis && minuten(von) <= minuten(bis);
  const imBereich = (zeit: string) => bereichOk && minuten(von) <= minuten(zeit) && minuten(zeit) <= minuten(bis);
  const anzahlZeiten = zeiten.filter(imBereich).length;
  const maxBalken = Math.max(1, ...plan.map((s) => s.saunaIds.length));

  // Läuft die Lieblingssauna im gewählten Zeitraum überhaupt? (z. B. die dritte
  // Sauna erst ab 17:30) — nur ein Hinweis, kein Fehler.
  const lieblingsSauna = saunen.find((s) => s.id === lieblings) ?? null;
  const lieblingLaeuftNicht = !!lieblingsSauna && bereichOk
    && !plan.some((s) => imBereich(s.zeit) && s.saunaIds.includes(lieblingsSauna.id));

  // Ein Wert außerhalb 1–4 (älterer Eintrag) bekommt einen eigenen Chip.
  const maxChips = max !== null && !MAX_WAHL.includes(max) ? [...MAX_WAHL.slice(0, -1), max, null] : MAX_WAHL;

  function waehleVon(v: string) {
    setVon(v);
    setFehler(null);
    if (v && bis && minuten(bis) < minuten(v)) setBis(v);
  }

  async function speichern() {
    setFehler(null);
    if (!von || !bis) {
      setFehler('Bitte wähle „Von“ und „Bis“ — den ersten und den letzten Aufguss, den du übernehmen könntest.');
      return;
    }
    if (minuten(von) > minuten(bis)) {
      setFehler('„Von“ muss vor „Bis“ liegen (oder gleich sein).');
      return;
    }
    try {
      await setzen.mutateAsync({
        datum: fest.datum,
        von,
        bis,
        lieblingsSaunaId: lieblings,
        maxAufguesse: max,
        notiz: notiz.trim() ? notiz.trim().slice(0, SAUNAFEST_NOTIZ_MAX) : null,
      });
      onGespeichert();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  const selectKlasse = 'w-full min-h-[44px] rounded-xl bg-forest-950/80 px-3 py-2 text-base sm:text-sm font-mono tabular-nums text-forest-100 ring-1 ring-forest-700/60 focus:outline-none focus:ring-2 focus:ring-amber-400/70';
  const chip = (aktiv: boolean) =>
    `min-h-[44px] rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition active:scale-[0.98] ${
      aktiv ? 'bg-amber-500 text-amber-950 ring-amber-300' : 'bg-forest-900/60 text-forest-100 ring-forest-700/50 hover:bg-forest-900'
    }`;

  return (
    <div className="space-y-4 rounded-2xl bg-forest-950/50 p-3 sm:p-4 ring-1 ring-amber-500/30">
      <div>
        <h3 className="text-sm font-bold text-amber-100">
          {bestehend ? 'Zeitraum ändern' : 'Wann hättest du Zeit?'}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-forest-300/80">
          Wähle den ersten und den letzten Aufguss, den du übernehmen könntest. Eingeteilt wird vom Admin
          innerhalb deines Zeitraums — du bekommst Bescheid, sobald der Plan steht.
        </p>
      </div>

      {/* ── Zeitraum ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-forest-300">Von</span>
          <select value={von} onChange={(e) => waehleVon(e.target.value)} className={selectKlasse} aria-label="Erster Aufguss, den du übernehmen könntest">
            <option value="">– wählen –</option>
            {zeiten.map((z) => <option key={z} value={z}>{z} Uhr</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-forest-300">Bis</span>
          <select value={bis} onChange={(e) => { setBis(e.target.value); setFehler(null); }} className={selectKlasse} aria-label="Letzter Aufguss, den du übernehmen könntest">
            <option value="">– wählen –</option>
            {zeiten.map((z) => (
              <option key={z} value={z} disabled={!!von && minuten(z) < minuten(von)}>{z} Uhr</option>
            ))}
          </select>
        </label>
      </div>

      {/* Vorschau-Leiste: je Aufguss-Zeit ein Balken (Höhe = Saunen, die dran sind), der gewählte Bereich leuchtet. */}
      <div>
        <div className="flex items-end gap-0.5" aria-hidden>
          {plan.map((s) => {
            const an = imBereich(s.zeit);
            return (
              <div key={s.zeit} className="flex min-w-0 flex-1 flex-col items-center gap-0.5" title={`${s.zeit} Uhr · ${s.saunaIds.length} ${s.saunaIds.length === 1 ? 'Sauna' : 'Saunen'}`}>
                <div
                  className={`w-full rounded-sm transition-colors ${an ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]' : 'bg-forest-800/70'}`}
                  style={{ height: `${8 + (s.saunaIds.length / maxBalken) * 14}px` }}
                />
                <span className={`text-[9px] tabular-nums leading-none ${an ? 'text-amber-200' : 'text-forest-500'}`}>{s.zeit.slice(0, 2)}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-forest-300/80">
          {bereichOk
            ? <>Du könntest <b className="text-amber-200">{anzahlZeiten}</b> {anzahlZeiten === 1 ? 'Aufguss-Zeit' : 'Aufguss-Zeiten'} abdecken: {von}–{bis} Uhr.</>
            : 'Balkenhöhe = wie viele Saunen um diese Zeit dran sind.'}
        </p>
      </div>

      {/* ── Lieblingssauna ────────────────────────────────────────── */}
      <div>
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-forest-300">Lieblingssauna</span>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setLieblings(null)} className={chip(lieblings === null)}>
            Egal
          </button>
          {saunen.map((s) => (
            <button key={s.id} type="button" onClick={() => setLieblings(s.id)} className={`${chip(lieblings === s.id)} text-left`}>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.accent_color, boxShadow: `0 0 6px ${s.accent_color}` }} />
                <span>{s.name}</span>
                <span className={`font-mono text-[11px] ${lieblings === s.id ? 'text-amber-900' : 'text-forest-400'}`}>{s.temperature_label}</span>
              </span>
              {fest.dritte_sauna_id === s.id && (
                <span className={`block text-[10px] font-medium ${lieblings === s.id ? 'text-amber-900' : 'text-forest-400'}`}>
                  ab {hhmm(fest.ab_alle)} Uhr
                </span>
              )}
            </button>
          ))}
        </div>
        {lieblingLaeuftNicht && lieblingsSauna && (
          <p className="mt-1.5 text-[11px] text-amber-200/90">
            Die {lieblingsSauna.name} läuft in deinem Zeitraum nicht — der Admin teilt dich dann in einer anderen Sauna ein.
          </p>
        )}
      </div>

      {/* ── Höchstzahl ────────────────────────────────────────────── */}
      <div>
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-forest-300">
          Wie viele Aufgüsse schaffst du höchstens?
        </span>
        <div className="flex flex-wrap gap-1.5">
          {maxChips.map((n) => (
            <button
              key={n ?? 'egal'}
              type="button"
              onClick={() => setMax(n)}
              className={`${chip(max === n)} min-w-[44px] tabular-nums`}
            >
              {n ?? 'egal'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Hinweis / Wünsche ─────────────────────────────────────── */}
      <label className="block">
        <span className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-forest-300">Hinweis / Wünsche an den Admin</span>
          <Zeichenzaehler wert={notiz} max={SAUNAFEST_NOTIZ_MAX} />
        </span>
        <textarea
          value={notiz}
          onChange={(e) => setNotiz(e.target.value.slice(0, SAUNAFEST_NOTIZ_MAX))}
          maxLength={SAUNAFEST_NOTIZ_MAX}
          rows={3}
          placeholder="z. B. komme erst gegen 15 Uhr, würde gern mit Anna zusammen aufgießen …"
          className="w-full resize-y rounded-xl bg-forest-950/80 px-3 py-2 text-base sm:text-sm text-forest-100 placeholder:text-forest-500 ring-1 ring-forest-700/60 focus:outline-none focus:ring-2 focus:ring-amber-400/70"
        />
        <span className="mt-0.5 block text-[10px] text-forest-500">freiwillig — sieht nur der Admin</span>
      </label>

      {fehler && (
        <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-500/30">
          {fehler}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={speichern}
          disabled={setzen.isPending}
          className="min-h-[44px] flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-amber-950 hover:bg-amber-400 active:scale-[0.99] transition disabled:opacity-60"
        >
          {setzen.isPending ? 'Speichert …' : bestehend ? 'Änderung speichern' : 'Zeitraum eintragen'}
        </button>
        {onAbbrechen && (
          <button
            type="button"
            onClick={onAbbrechen}
            disabled={setzen.isPending}
            className="min-h-[44px] rounded-xl bg-forest-900/80 px-4 py-3 text-sm font-medium text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-900 disabled:opacity-60"
          >
            Abbrechen
          </button>
        )}
      </div>
    </div>
  );
}
