// Öl-Regal als echte Mehrfachauswahl für die Angaben eines Fest-Aufgusses
// (Vorgabe Christoph 24.09.2026: „alle verfügbaren Öle aus dem Öl-Regal",
// genug Freiheiten). Anders als der OilPicker gibt es hier keine drei Runden:
// Tippen schaltet ein Öl an oder ab, die Reihenfolge der Wahl bleibt erhalten.
// Die ersten drei landen serverseitig zusätzlich in infusions.oils und sind im
// Öl-Raum Runde 1–3 (saunafest_aufguss_info_speichern, Migration 0164).
//
// Datenquellen wie im OilPicker: Katalog aus lib/oils.ts (nur, was nicht in
// useDisabledOils steht — also physisch im Regal), eigene Öle des Aufgießers
// (bei Admin-Bearbeitung die des Aufgießers, nicht die des Admins). Bilder:
// public/oele/<slug>.webp bzw. image_path der eigenen Öle.

import { useEffect, useMemo, useState } from 'react';
import { OILS_BY_CATEGORY, CATEGORY_LABELS, CATEGORY_ORDER, OIL_BY_NUMBER, type Oil } from '@/lib/oils';
import {
  useDisabledOils, useMyCustomOils, customOilId, publicAssetUrl,
  SAUNAFEST_INFO_MAX, type CustomOil,
} from '@/lib/api';
import { Portal } from '@/components/Portal';

type Props = {
  ausgewaehlt: string[];
  onChange: (neu: string[]) => void;
  onClose: () => void;
  /** Wessen eigene Öle angeboten werden (der Aufgießer des Aufgusses). */
  memberId: string | null;
};

/** Für die Suche: klein, ohne Akzente („Öl" findet man auch mit „ol"). */
function norm(s: string): string {
  return s.toLocaleLowerCase('de').normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

export function OelRegalAuswahl({ ausgewaehlt, onChange, onClose, memberId }: Props) {
  const [suche, setSuche] = useState('');
  const [hinweis, setHinweis] = useState<string | null>(null);
  const disabledOils = useDisabledOils();
  const eigeneQ = useMyCustomOils(memberId);
  const max = SAUNAFEST_INFO_MAX.oele;

  // Esc schließt nur dieses Unterfenster — der Angaben-Dialog darunter
  // ignoriert Esc, solange es offen ist.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Position je ID (1-basiert) — für die Reihenfolge-Nummer an der Kachel.
  const position = useMemo(() => {
    const m = new Map<string, number>();
    ausgewaehlt.forEach((id, i) => { if (!m.has(id)) m.set(id, i + 1); });
    return m;
  }, [ausgewaehlt]);

  function umschalten(id: string) {
    if (position.has(id)) {
      setHinweis(null);
      onChange(ausgewaehlt.filter((x) => x !== id));
      return;
    }
    if (ausgewaehlt.length >= max) {
      setHinweis(`Höchstens ${max} Öle — erst eines abwählen.`);
      return;
    }
    setHinweis(null);
    onChange([...ausgewaehlt, id]);
  }

  // Suche nach Name ODER Regalnummer („12" oder „#12").
  const q = norm(suche).replace(/^#/, '');
  const istNummer = /^\d+$/.test(q);
  const verfuegbar = (o: Oil) => !disabledOils.data?.[o.id];
  const passt = (o: Oil) =>
    !q || (istNummer ? String(o.number).startsWith(q) : norm(o.name).includes(q));

  const eigene: CustomOil[] = (eigeneQ.data ?? []).filter((co) => !q || (!istNummer && norm(co.name).includes(q)));
  const kategorien = CATEGORY_ORDER
    .map((cat) => ({ cat, oele: OILS_BY_CATEGORY[cat].filter((o) => verfuegbar(o) && passt(o)) }))
    .filter((k) => k.oele.length > 0);
  const nichtsGefunden = !!q && eigene.length === 0 && kategorien.length === 0;

  // Return im Suchfeld mit exakter Regalnummer wählt das Öl direkt —
  // wie die Nummern-Schnellwahl im OilPicker, nur als Umschalter.
  // Sonst schließt Return nur die Tastatur, damit die Treffer sichtbar werden.
  function sucheBestaetigen(): boolean {
    if (!istNummer) return false;
    const oel = OIL_BY_NUMBER[Number(q)];
    if (!oel || !verfuegbar(oel)) return false;
    umschalten(oel.id);
    setSuche('');
    return true;
  }

  const anzahl = ausgewaehlt.length;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/70 sm:items-center sm:p-4"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="oel-regal-titel"
          className="flex h-screen-dvh w-full flex-col bg-slate-900 ring-1 ring-forest-700/50 shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Kopf mit Suche */}
          <header className="shrink-0 border-b border-forest-800/50 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 id="oel-regal-titel" className="text-base font-semibold text-forest-50">🌿 Öle aus dem Regal</h3>
                <p className="mt-0.5 text-[11px] leading-snug text-forest-300/80">
                  Tippen wählt an und ab. Die Nummer zeigt deine Reihenfolge — die ersten drei sind im Öl-Raum Runde 1–3.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Schließen"
                className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-forest-300 hover:bg-forest-800/60"
              >
                ✕
              </button>
            </div>
            <input
              type="search"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (!sucheBestaetigen()) e.currentTarget.blur();
                }
              }}
              enterKeyHint="search"
              autoComplete="off"
              placeholder="Suchen: Name oder Regalnummer"
              aria-label="Öl suchen nach Name oder Regalnummer"
              className="mt-3 w-full rounded-xl bg-forest-950/80 px-3 py-2.5 text-base text-forest-50 placeholder-forest-400/60 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400 sm:text-sm"
            />
          </header>

          {/* Inhalt */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            {disabledOils.isPending && (
              <p className="mb-2 text-[11px] text-forest-400">Regal wird geladen …</p>
            )}

            {eigene.length > 0 && (
              <section className="mb-4">
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-violet-300/80">🌿 Meine Öle</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {eigene.map((co) => {
                    const id = customOilId(co.id);
                    return (
                      <Kachel
                        key={co.id}
                        name={co.name}
                        bild={publicAssetUrl(co.image_path)}
                        emoji={co.emoji}
                        farbe={co.color ?? '#22c55e'}
                        abzeichen="eigen"
                        pos={position.get(id) ?? null}
                        onTap={() => umschalten(id)}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {kategorien.map(({ cat, oele }) => (
              <section key={cat} className="mb-4">
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-forest-400/80">{CATEGORY_LABELS[cat]}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {oele.map((o) => (
                    <Kachel
                      key={o.id}
                      name={o.name}
                      bild={`/oele/${o.id}.webp`}
                      emoji={o.emoji}
                      farbe={null}
                      abzeichen={String(o.number)}
                      pos={position.get(o.id) ?? null}
                      onTap={() => umschalten(o.id)}
                    />
                  ))}
                </div>
              </section>
            ))}

            {nichtsGefunden && (
              <p className="py-8 text-center text-sm text-forest-300/80">
                Kein verfügbares Öl passt zu „{suche.trim()}“.
              </p>
            )}
          </div>

          {/* Klebender Fuß */}
          <footer className="shrink-0 border-t border-forest-800/50 bg-slate-900/95 px-4 pt-3 pb-safe-or-4">
            {hinweis && (
              <p className="mb-2 rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/30" role="status">
                {hinweis}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setHinweis(null); onChange([]); }}
                disabled={anzahl === 0}
                className="min-h-[44px] rounded-xl bg-forest-900/70 px-4 text-sm text-forest-100 ring-1 ring-forest-700/50 transition hover:bg-forest-800 disabled:opacity-40"
              >
                Alle abwählen
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] rounded-xl bg-amber-500 px-5 text-sm font-semibold text-amber-950 transition hover:bg-amber-400 active:scale-95"
              >
                Fertig ({anzahl})
              </button>
            </div>
          </footer>
        </div>
      </div>
    </Portal>
  );
}

/** Eine Öl-Kachel: Bild (sonst Farbe + Emoji), Abzeichen oben links
 *  (Regalnummer bzw. „eigen"), bei Auswahl Häkchen + Reihenfolge oben rechts. */
function Kachel({ name, bild, emoji, farbe, abzeichen, pos, onTap }: {
  name: string;
  bild: string | null;
  emoji: string;
  farbe: string | null;
  abzeichen: string;
  pos: number | null;
  onTap: () => void;
}) {
  const [bildKaputt, setBildKaputt] = useState(false);
  const gewaehlt = pos !== null;
  return (
    <button
      type="button"
      onClick={onTap}
      aria-pressed={gewaehlt}
      title={name}
      className={`relative flex flex-col overflow-hidden rounded-xl text-left transition active:scale-[0.97] ${
        gewaehlt
          ? 'bg-amber-500/15 ring-2 ring-amber-400'
          : 'bg-forest-950/70 ring-1 ring-forest-800/60 hover:ring-forest-600'
      }`}
    >
      <span
        className="relative block aspect-[4/3] w-full"
        style={{
          background: farbe
            ? `linear-gradient(135deg, ${farbe}aa, ${farbe}33)`
            : 'linear-gradient(135deg, rgba(20,83,45,0.6), rgba(2,6,12,0.8))',
        }}
      >
        {/* Emoji liegt immer darunter — scheint durch, falls das Bild fehlt. */}
        <span aria-hidden className="absolute inset-0 flex items-center justify-center text-2xl">{emoji}</span>
        {bild && !bildKaputt && (
          <img
            src={bild}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBildKaputt(true)}
            className={`absolute inset-0 h-full w-full object-cover transition ${gewaehlt ? '' : 'opacity-90'}`}
          />
        )}
        <span className="absolute left-1 top-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
          {abzeichen}
        </span>
        {gewaehlt && (
          <span className="absolute right-1 top-1 flex h-6 min-w-[1.5rem] items-center justify-center gap-0.5 rounded-full bg-amber-400 px-1.5 text-[11px] font-bold tabular-nums text-amber-950 shadow">
            ✓ {pos}
          </span>
        )}
      </span>
      <span className={`line-clamp-2 px-2 py-1.5 text-xs leading-tight ${gewaehlt ? 'text-amber-100' : 'text-forest-100'}`}>
        {name}
      </span>
    </button>
  );
}
