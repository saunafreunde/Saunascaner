import { useMemo, useState } from 'react';
import { useCreateWunsch, useMyWuensche } from '@/lib/api';
import type { Infusion } from '@/types/database';
import { OILS, OIL_BY_ID, CATEGORY_LABELS, CATEGORY_ORDER, OILS_BY_CATEGORY } from '@/lib/oils';
import { fmtClock, berlinYmd } from '@/lib/time';

// Duft-Wunsch des Gastes (Migration 0133).
//
// Bewusst an einen KONKRETEN kommenden Aufguss gebunden statt an eine Person:
// so landet der Wunsch dort, wo er brauchbar ist — im Öl-Raum, wo ohnehin
// steht, was ans Regal muss. Ein Wunsch „an Christoph" wäre nur ein Gefühl,
// ein Wunsch „für 17:00 in der Kelo" ist eine Arbeitsanweisung.
//
// Ein offener Wunsch pro Tag. Das Limit erzwingt der eindeutige Index in der
// DB, nicht diese Komponente — hier ist es nur die freundliche Erklärung.

const FEHLERTEXTE: Record<string, string> = {
  schon_ein_offener_wunsch_heute:
    'Du hast heute schon einen offenen Wunsch. Warte ab, was daraus wird 🙂',
  aufguss_liegt_in_der_vergangenheit: 'Dieser Aufguss ist schon gelaufen.',
  kein_aufgieser_fuer_diesen_slot: 'Für diesen Slot steht noch kein Aufgießer fest.',
  not_authenticated: 'Bitte melde dich neu an.',
};

function fehlertext(e: unknown): string {
  const raw = (e as Error)?.message ?? '';
  for (const [key, text] of Object.entries(FEHLERTEXTE)) {
    if (raw.includes(key)) return text;
  }
  return raw || 'Das hat nicht geklappt.';
}

export function DuftWunsch({
  infusions,
  saunaName,
  meisterName,
}: {
  infusions: Infusion[];
  saunaName: (saunaId: string) => string;
  meisterName: (id: string | null) => string;
}) {
  const meine = useMyWuensche();
  const anlegen = useCreateWunsch();
  const [offen, setOffen] = useState(false);
  const [infusionId, setInfusionId] = useState<string>('');
  const [oilKey, setOilKey] = useState<string>('');
  const [notiz, setNotiz] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);

  const heute = berlinYmd(new Date());
  const offenerWunsch = (meine.data ?? []).find((w) => w.status === 'offen');
  const letzteErfuellte = (meine.data ?? []).filter((w) => w.status === 'erfuellt').slice(0, 1);

  // Wählbar: kommende Aufgüsse mit echtem Aufgießer, heute und morgen.
  // Weiter voraus zu wünschen macht die Liste lang und den Wunsch beliebig.
  const waehlbar = useMemo(() => {
    const jetzt = Date.now();
    return infusions
      .filter((i) => !i.is_personal_fallback && i.saunameister_id)
      .filter((i) => new Date(i.start_time).getTime() > jetzt)
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))
      .slice(0, 12);
  }, [infusions]);

  async function absenden() {
    setFehler(null);
    if (!infusionId) return setFehler('Bitte einen Aufguss auswählen.');
    if (!oilKey) return setFehler('Bitte einen Duft auswählen.');
    try {
      await anlegen.mutateAsync({ infusionId, oilKey, notiz: notiz.trim() || undefined });
      setOffen(false);
      setInfusionId(''); setOilKey(''); setNotiz('');
    } catch (e) {
      setFehler(fehlertext(e));
    }
  }

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
        🌿 Dein Duft-Wunsch
      </h2>

      {offenerWunsch ? (
        <div className="rounded-2xl bg-amber-950/25 ring-1 ring-amber-500/30 p-4">
          <div className="text-sm text-amber-100">
            Du wünschst dir <strong>{OIL_BY_ID[offenerWunsch.oil_key]?.name ?? offenerWunsch.oil_key}</strong>
            {' '}für {fmtClock(offenerWunsch.infusion_start)} Uhr
            {offenerWunsch.sauna_name ? ` · ${offenerWunsch.sauna_name}` : ''}
            {offenerWunsch.aufgieser_name ? ` · bei ${offenerWunsch.aufgieser_name}` : ''}.
          </div>
          {offenerWunsch.notiz && (
            <div className="mt-1 text-xs text-forest-300/80 italic">„{offenerWunsch.notiz}"</div>
          )}
          <div className="mt-2 text-[11px] text-forest-400">
            Dein Aufgießer sieht den Wunsch — ob er passt, entscheidet er.
          </div>
        </div>
      ) : offen ? (
        <div className="space-y-3">
          <label className="block text-xs text-forest-300">
            Für welchen Aufguss?
            <select
              value={infusionId}
              onChange={(e) => setInfusionId(e.target.value)}
              className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50"
            >
              <option value="">— bitte wählen —</option>
              {waehlbar.map((i) => (
                <option key={i.id} value={i.id}>
                  {berlinYmd(i.start_time) === heute ? 'Heute' : 'Morgen'}
                  {' '}{fmtClock(i.start_time)} · {saunaName(i.sauna_id)} · {meisterName(i.saunameister_id)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-forest-300">
            Welcher Duft?
            <select
              value={oilKey}
              onChange={(e) => setOilKey(e.target.value)}
              className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50"
            >
              <option value="">— bitte wählen —</option>
              {CATEGORY_ORDER.map((cat) => (
                <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
                  {(OILS_BY_CATEGORY[cat] ?? []).map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="block text-xs text-forest-300">
            Noch ein Satz dazu? (freiwillig)
            <input
              type="text"
              value={notiz}
              maxLength={140}
              onChange={(e) => setNotiz(e.target.value)}
              placeholder="z. B. weil ich nach der Arbeit wach werden will"
              className="mt-1 w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50"
            />
          </label>

          {fehler && <p className="text-xs text-rose-300">{fehler}</p>}

          <div className="flex gap-2">
            <button
              onClick={absenden}
              disabled={anlegen.isPending}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
            >
              {anlegen.isPending ? 'Sende…' : 'Wunsch abschicken'}
            </button>
            <button
              onClick={() => { setOffen(false); setFehler(null); }}
              className="rounded-xl bg-forest-900/60 px-4 py-2 text-sm text-forest-300 ring-1 ring-forest-700/40"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-forest-300/80 leading-relaxed mb-3">
            Such dir einen kommenden Aufguss aus und wünsch dir einen Duft dazu.
            Dein Aufgießer sieht ihn — und im Öl-Raum steht er da, wo die Fläschchen stehen.
            Ein Wunsch pro Tag.
          </p>
          {waehlbar.length === 0 ? (
            <p className="text-xs text-forest-500">
              Gerade ist kein Aufguss geplant, für den du dir etwas wünschen könntest.
            </p>
          ) : (
            <button
              onClick={() => setOffen(true)}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500"
            >
              🌿 Duft wünschen
            </button>
          )}
        </>
      )}

      {letzteErfuellte.length > 0 && !offenerWunsch && (
        <p className="mt-3 text-[11px] text-emerald-300/80">
          ✓ Zuletzt erfüllt: {OIL_BY_ID[letzteErfuellte[0].oil_key]?.name ?? letzteErfuellte[0].oil_key}
          {letzteErfuellte[0].aufgieser_name ? ` von ${letzteErfuellte[0].aufgieser_name}` : ''}.
        </p>
      )}
    </section>
  );
}

/** Namen zu einem Öl-Schlüssel — auch für Einträge, die nicht im Katalog stehen. */
export function oelName(key: string): string {
  return OIL_BY_ID[key]?.name ?? OILS.find((o) => o.id === key)?.name ?? key;
}
