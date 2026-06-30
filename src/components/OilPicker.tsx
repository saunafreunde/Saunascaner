import { useMemo, useRef, useState } from 'react';
import {
  OILS_BY_CATEGORY, OIL_BY_ID, OIL_BY_NUMBER,
  CATEGORY_LABELS, CATEGORY_ORDER, normalizeOilSlots,
  MAX_OIL_SLOTS,
} from '@/lib/oils';
import {
  useDisabledOils, useCurrentMember,
  useMyCustomOils, customOilId, parseCustomOilId,
} from '@/lib/api';
import { Portal } from '@/components/Portal';

type Props = {
  selected: (string | null)[];                  // [Runde 1 … Runde MAX_OIL_SLOTS]
  onChange: (oils: (string | null)[]) => void;
  onClose: () => void;
};

const EMPTY_SLOTS: (string | null)[] = Array.from({ length: MAX_OIL_SLOTS }, () => null);

export default function OilPicker({ selected, onChange, onClose }: Props) {
  const slots = useMemo(() => normalizeOilSlots(selected), [selected]);
  const firstEmpty = slots.findIndex((s) => !s);
  const [activeRound, setActiveRound] = useState<number>(firstEmpty === -1 ? 0 : firstEmpty);
  const [numInput, setNumInput] = useState('');
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Admin-konfigurierbare Öl-Deaktivierung (Migration 0093). Hier wird gefiltert,
  // damit Aufgießer nur Öle wählen die physisch im Regal stehen.
  const disabledOils = useDisabledOils();
  // Eigene Custom-Öle des Aufgießers (Migration 0098) — werden als
  // zusätzliche Sektion oben angezeigt, nur für den jeweiligen User sichtbar.
  const me = useCurrentMember();
  const myCustomOils = useMyCustomOils(me.data?.id);

  function setSlot(round: number, oilId: string | null) {
    const next = [...slots];
    next[round] = oilId;
    onChange(next);
    if (oilId) {
      // Springe zum nächsten leeren Slot
      const nextEmpty = next.findIndex((s, i) => !s && i > round);
      if (nextEmpty !== -1) setActiveRound(nextEmpty);
      else {
        const anyEmpty = next.findIndex((s) => !s);
        if (anyEmpty !== -1) setActiveRound(anyEmpty);
      }
    }
  }

  function pickByNumber(numStr: string) {
    const n = parseInt(numStr, 10);
    if (!Number.isFinite(n) || !OIL_BY_NUMBER[n]) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    setSlot(activeRound, OIL_BY_NUMBER[n].id);
    setNumInput('');
    inputRef.current?.focus();
  }

  function clearAll() {
    onChange([...EMPTY_SLOTS]);
    setActiveRound(0);
  }

  return (
    <Portal>
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3 bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-slate-900 ring-1 ring-forest-700/50 p-4 max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-forest-200">Ätherische Öle wählen</h3>
          <button onClick={onClose} className="text-forest-400 hover:text-forest-200 text-lg leading-none" aria-label="Schließen">✕</button>
        </div>

        {/* Runden-Tabs — zeigt sowohl Standard- als auch Custom-Öle */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          {[0, 1, 2].map((i) => {
            const id = slots[i];
            const customUuid = id ? parseCustomOilId(id) : null;
            const customOil = customUuid ? (myCustomOils.data ?? []).find((o) => o.id === customUuid) : null;
            const stdOil = id && !customUuid ? OIL_BY_ID[id] : null;
            const active = activeRound === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActiveRound(i)}
                className={`rounded-xl px-2 py-2 text-left ring-1 transition ${
                  active
                    ? 'bg-amber-500/20 ring-amber-400 text-amber-100'
                    : 'bg-forest-900/60 ring-forest-800/50 text-forest-200 hover:bg-forest-900'
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider opacity-70">Runde {i + 1}</div>
                <div className="text-sm font-medium truncate">
                  {stdOil && <>#{stdOil.number} {stdOil.emoji} {stdOil.name}</>}
                  {customOil && <>🌿 {customOil.emoji} {customOil.name} <span className="text-[9px] opacity-70">(meins)</span></>}
                  {!stdOil && !customOil && <span className="text-forest-300/60">— wählen —</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Schnellwahl per Nummer + Slot löschen */}
        <div className={`flex items-center gap-2 mb-3 ${shake ? 'animate-[wiggle_0.4s_ease-in-out]' : ''}`}>
          <label className="text-[10px] uppercase tracking-wider text-forest-400/80">Nr.</label>
          <input
            ref={inputRef}
            value={numInput}
            onChange={(e) => setNumInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); pickByNumber(numInput); }
            }}
            inputMode="numeric"
            placeholder="1–64"
            className={`w-20 rounded-lg bg-forest-900/80 px-2.5 py-1.5 text-sm tabular-nums ring-1 focus:outline-none focus:ring-2 ${
              shake ? 'ring-rose-500' : 'ring-forest-700/50 focus:ring-forest-400'
            }`}
          />
          <button
            type="button"
            onClick={() => pickByNumber(numInput)}
            disabled={!numInput}
            className="rounded-lg bg-forest-700 px-3 py-1.5 text-xs font-medium text-forest-100 hover:bg-forest-600 transition disabled:opacity-40"
          >
            in Runde {activeRound + 1}
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setSlot(activeRound, null)}
            className="rounded-lg bg-forest-900/60 px-2.5 py-1.5 text-xs text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-900 transition"
          >
            Slot löschen
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg bg-rose-900/40 px-2.5 py-1.5 text-xs text-rose-200 ring-1 ring-rose-800/50 hover:bg-rose-900/60 transition"
          >
            Alle zurücksetzen
          </button>
        </div>

        {/* ─── Meine eigenen Öle (privat) ─────────────────────────────── */}
        {(myCustomOils.data?.length ?? 0) > 0 && (
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-violet-400/80 mb-1.5">
              🌿 Meine Öle <span className="text-violet-400/50 normal-case">(privat — nur du siehst sie zur Auswahl)</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {(myCustomOils.data ?? []).map((co) => {
                const slotId = customOilId(co.id);
                const inOtherSlot = slots.some((s, i) => s === slotId && i !== activeRound);
                const isCurrent = slots[activeRound] === slotId;
                // Eigene Farbe pro Custom-Oil (Migration 0101) — Default
                // forest-grün falls Alt-Daten ohne Farb-Wahl.
                const colorHex = co.color ?? '#22c55e';
                return (
                  <button
                    key={co.id}
                    type="button"
                    onClick={() => setSlot(activeRound, slotId)}
                    title={co.name}
                    className="relative flex items-center gap-2 rounded-lg px-2 py-2 text-left ring-1 transition hover:brightness-110"
                    style={{
                      background: isCurrent
                        ? `linear-gradient(135deg, ${colorHex}77, ${colorHex}33)`
                        : `linear-gradient(135deg, ${colorHex}33, rgba(2,6,12,0.55))`,
                      boxShadow: `inset 0 0 0 1px ${colorHex}${isCurrent ? 'cc' : '55'}`,
                      color: '#f3f4f6',
                    }}
                  >
                    <span
                      aria-hidden
                      className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-base ring-1 ring-white/20"
                      style={{ background: colorHex }}
                    >
                      {co.emoji}
                    </span>
                    <span className="text-xs leading-tight truncate flex-1">{co.name}</span>
                    {inOtherSlot && (
                      <span className="absolute top-1 right-1 text-[9px] text-white/80" title="Bereits in anderer Runde">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[9px] text-violet-400/60 mt-1">
              Verwalten in deinem Profil (➕ Neues Öl)
            </p>
          </div>
        )}

        {/* Kategorien-Grid */}
        {CATEGORY_ORDER.map((cat) => (
          <div key={cat} className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-forest-400/70 mb-1.5">
              {CATEGORY_LABELS[cat]}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {OILS_BY_CATEGORY[cat]
                .filter((o) => !disabledOils.data?.[o.id])
                .map((o) => {
                const inOtherSlot = slots.some((s, i) => s === o.id && i !== activeRound);
                const isCurrent = slots[activeRound] === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSlot(activeRound, o.id)}
                    title={o.note ? `${o.name} (${o.note})` : o.name}
                    className={`relative flex items-center gap-2 rounded-lg px-2 py-2 text-left ring-1 transition ${
                      isCurrent
                        ? 'bg-amber-500/20 ring-amber-400 text-amber-100'
                        : 'bg-forest-900/60 ring-forest-800/50 text-forest-100 hover:bg-forest-800'
                    }`}
                  >
                    <span className="inline-flex w-7 justify-center rounded-md bg-forest-950/80 px-1 py-0.5 text-[10px] tabular-nums ring-1 ring-forest-700/40 shrink-0">
                      {o.number}
                    </span>
                    <span aria-hidden className="text-base shrink-0">{o.emoji}</span>
                    <span className="text-xs leading-tight truncate flex-1">{o.name}</span>
                    {inOtherSlot && (
                      <span className="absolute top-1 right-1 text-[9px] text-amber-300/80" title="Bereits in anderer Runde">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="sticky bottom-0 -mx-4 -mb-4 mt-3 px-4 pt-3 pb-safe-or-4 bg-slate-900/95 ring-t border-t border-forest-800/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-forest-500 px-4 py-2 text-sm font-semibold text-forest-950 hover:bg-forest-400 transition"
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
