import { useEffect, useMemo, useState } from 'react';
import { ATTRIBUTES, type InfusionAttribute } from '@/lib/attributes';
import { normalizeOilSlots, MAX_OIL_SLOTS } from '@/lib/oils';
import { generateInfusionTitle } from '@/lib/titleGenerator';
import {
  useUpdateInfusion, useSuggestInfusionTitle,
  useCurrentMember, useMeisterDirectory, useCoAufgieser, useAdminSetCoAufgieser,
} from '@/lib/api';
import { isAdmin as isAdminHelper } from '@/lib/roles';
import OilPicker from '@/components/OilPicker';
import type { Infusion } from '@/types/database';

// Bearbeiten eines bestehenden Aufgusses. Änderbar:
//   - Titel, Beschreibung, Attribute, Öle, Team-Flag, Duration
//   - Admin: zusätzlich Saunameister + (bei team_infusion) Co-Aufgießer
// NICHT änderbar (würde Slot-Logik brechen): start_time, sauna_id.
// Server-Side: 60-Min-Lock für Aufgießer (Admin jederzeit).

export function EditInfusionModal({
  infusion,
  onClose,
  onSaved,
}: {
  infusion: Infusion;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [title, setTitle] = useState(infusion.title ?? '');
  const [description, setDescription] = useState(infusion.description ?? '');
  const [attrs, setAttrs] = useState<InfusionAttribute[]>(infusion.attributes as InfusionAttribute[]);
  const [oils, setOils] = useState<(string | null)[]>(normalizeOilSlots(infusion.oils));
  const [teamInfusion, setTeamInfusion] = useState(infusion.team_infusion);
  const [duration, setDuration] = useState<number>(infusion.duration_minutes);
  const [showOilPicker, setShowOilPicker] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const me = useCurrentMember();
  const isAdmin = isAdminHelper(me.data);
  const meisterDir = useMeisterDirectory();

  // Saunameister-Auswahl (nur Admin sieht das Dropdown im UI)
  const [saunameisterId, setSaunameisterId] = useState<string>(infusion.saunameister_id ?? '');

  // Co-Aufgießer-Auswahl bei Team-Aufgüssen (Admin-only)
  const coAufQ = useCoAufgieser(teamInfusion ? [infusion.id] : []);
  const existingCoIds = useMemo(
    () => (coAufQ.data ?? []).filter((c) => c.infusion_id === infusion.id).map((c) => c.member_id),
    [coAufQ.data, infusion.id],
  );
  const [coAufgieserIds, setCoAufgieserIds] = useState<string[]>([]);
  // Wenn Liste async nachgeladen wird, einmal in den State spiegeln
  useEffect(() => {
    setCoAufgieserIds(existingCoIds);
  }, [existingCoIds]);

  const update = useUpdateInfusion();
  const suggestTitle = useSuggestInfusionTitle();
  const setCoAuf = useAdminSetCoAufgieser();

  // Esc schließt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function toggleAttr(a: InfusionAttribute) {
    setAttrs((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  async function save() {
    setErrorMsg(null);
    try {
      // Update Basis-Felder + (Admin) Saunameister-Wechsel
      const meisterChanged = isAdmin && saunameisterId && saunameisterId !== infusion.saunameister_id;
      await update.mutateAsync({
        id: infusion.id,
        title: title.trim() || undefined,
        description: description.trim() || null,
        attributes: attrs,
        oils,
        team_infusion: teamInfusion,
        duration_minutes: duration,
        saunameister_id: meisterChanged ? saunameisterId : null,
      });
      // Admin + Team: Co-Aufgießer atomar überschreiben
      if (isAdmin && teamInfusion) {
        const cur = [...existingCoIds].sort().join(',');
        const next = [...coAufgieserIds].sort().join(',');
        if (cur !== next) {
          await setCoAuf.mutateAsync({ infusion_id: infusion.id, member_ids: coAufgieserIds });
        }
      }
      // Save erfolgreich — UI bestätigt VISUELL bevor Modal schließt.
      setSavedFlash(true);
      setTimeout(() => {
        onSaved?.();
        onClose();
      }, 700);
    } catch (e) {
      const err = e as { message?: string; details?: string; code?: string };
      const msg = err.message ?? err.details ?? err.code ?? String(e);
      setErrorMsg(msg);
      // eslint-disable-next-line no-console
      console.error('[EditInfusionModal] save error', err);
    }
  }

  function toggleCoAufgieser(memberId: string) {
    setCoAufgieserIds((prev) => {
      if (prev.includes(memberId)) return prev.filter((x) => x !== memberId);
      // Max 2 — wenn schon 2 drin, neuesten verdrängen
      if (prev.length >= 2) return [prev[1], memberId];
      return [...prev, memberId];
    });
  }

  const oilCount = oils.filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-forest-950 ring-1 ring-forest-700/60 shadow-2xl max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-forest-950/95 backdrop-blur z-10 px-5 py-4 border-b border-forest-800/40 flex items-center justify-between">
          <h2 className="text-lg font-bold text-forest-100">✏️ Aufguss bearbeiten</h2>
          <button onClick={onClose} className="rounded-full h-9 w-9 flex items-center justify-center text-forest-300 hover:bg-forest-800/60">✕</button>
        </header>

        <div className="p-5 space-y-4">
          {/* Titel */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-forest-300 uppercase tracking-wider">Titel</label>
              <button
                type="button"
                onClick={async () => {
                  const validOils = oils.filter((o): o is string => !!o);
                  try {
                    const aiTitle = await suggestTitle.mutateAsync({
                      attributes: attrs,
                      oils: validOils,
                    });
                    if (aiTitle) setTitle(aiTitle);
                    else setTitle(generateInfusionTitle(attrs, validOils));
                  } catch {
                    setTitle(generateInfusionTitle(attrs, validOils));
                  }
                }}
                disabled={suggestTitle.isPending || (attrs.length === 0 && oils.every((o) => !o))}
                title="KI-Vorschlag (Claude Haiku) aus Eigenschaften + Ölen. Bei Netzwerkfehler Fallback auf regelbasiert."
                className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                {suggestTitle.isPending ? '✨ …' : '✨ Vorschlagen'}
              </button>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg bg-forest-900/60 ring-1 ring-forest-700/50 px-3 py-2 text-sm text-forest-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder={'z.B. Eukalyptus-Frische'}
            />
          </div>

          {/* Beschreibung */}
          <div>
            <label className="text-xs font-semibold text-forest-300 uppercase tracking-wider">Beschreibung (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 200))}
              rows={2}
              className="mt-1 w-full rounded-lg bg-forest-900/60 ring-1 ring-forest-700/50 px-3 py-2 text-sm text-forest-100 placeholder-forest-500 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              placeholder={'Kurze Beschreibung'}
            />
            <div className="text-right text-[10px] text-forest-500 mt-1">{description.length}/200</div>
          </div>

          {/* Dauer */}
          <div>
            <label className="text-xs font-semibold text-forest-300 uppercase tracking-wider">Dauer in Minuten</label>
            <input
              type="number"
              min={5}
              max={60}
              value={duration}
              onChange={(e) => setDuration(Math.max(5, Math.min(60, parseInt(e.target.value, 10) || 15)))}
              className="mt-1 w-24 rounded-lg bg-forest-900/60 ring-1 ring-forest-700/50 px-3 py-2 text-sm text-forest-100 focus:outline-none focus:ring-2 focus:ring-amber-400 tabular-nums"
            />
          </div>

          {/* Attribute */}
          <div>
            <label className="text-xs font-semibold text-forest-300 uppercase tracking-wider">Eigenschaften</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ATTRIBUTES.map((a) => {
                const active = attrs.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAttr(a.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? 'bg-amber-500 text-amber-950 ring-1 ring-amber-300'
                        : 'bg-forest-900/60 text-forest-300 ring-1 ring-forest-700/50 hover:bg-forest-900'
                    }`}
                  >
                    <span aria-hidden>{a.emoji}</span>
                    <span>{a.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Öle */}
          <div>
            <label className="text-xs font-semibold text-forest-300 uppercase tracking-wider">Öle (bis {MAX_OIL_SLOTS})</label>
            <button
              type="button"
              onClick={() => setShowOilPicker(true)}
              className="mt-1.5 block w-full rounded-lg bg-forest-900/60 ring-1 ring-forest-700/50 px-3 py-3 text-sm text-forest-100 hover:bg-forest-900 text-left"
            >
              {oilCount === 0
                ? '🌿 Öle auswählen…'
                : `🌿 ${oilCount} Öl${oilCount === 1 ? '' : 'e'} gewählt — bearbeiten`}
            </button>
          </div>

          {/* Team-Flag */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={teamInfusion}
                onChange={(e) => setTeamInfusion(e.target.checked)}
                className="h-4 w-4 accent-amber-500"
              />
              <span className="text-sm text-forest-200">👥 Team-Aufguss (andere Aufgießer können mitmachen)</span>
            </label>
          </div>

          {/* Admin-only: Saunameister wechseln */}
          {isAdmin && (
            <div>
              <label className="text-xs font-semibold text-violet-300 uppercase tracking-wider">
                ⚙️ Saunameister <span className="text-forest-400/60 normal-case">(Admin)</span>
              </label>
              <select
                value={saunameisterId}
                onChange={(e) => setSaunameisterId(e.target.value)}
                className="mt-1 w-full rounded-lg bg-forest-900/60 ring-1 ring-violet-700/40 px-3 py-2 text-sm text-forest-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <option value="">— niemand zugewiesen —</option>
                {(meisterDir.data ?? []).map((x) => (
                  <option key={x.id} value={x.id}>{x.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Admin-only: Co-Aufgießer bei Team-Aufgüssen zuweisen (max 2) */}
          {isAdmin && teamInfusion && (
            <div>
              <label className="text-xs font-semibold text-violet-300 uppercase tracking-wider">
                ⚙️ Co-Aufgießer zuweisen <span className="text-forest-400/60 normal-case">(max 2)</span>
              </label>
              <p className="text-[11px] text-forest-400/80 mt-1 mb-2">
                {coAufgieserIds.length === 0
                  ? 'Niemand zugewiesen — Aufgießer können selbst joinen.'
                  : `${coAufgieserIds.length}/2 gewählt`}
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto rounded-lg ring-1 ring-violet-700/30 bg-forest-900/50 p-2">
                {(meisterDir.data ?? [])
                  .filter((x) => x.id !== saunameisterId)
                  .map((x) => {
                    const active = coAufgieserIds.includes(x.id);
                    return (
                      <button
                        key={x.id}
                        type="button"
                        onClick={() => toggleCoAufgieser(x.id)}
                        className={`rounded-full px-2.5 py-1 text-xs ring-1 transition ${
                          active
                            ? 'bg-violet-500 text-violet-950 ring-violet-300'
                            : 'bg-forest-900/60 text-forest-300 ring-forest-700/50 hover:bg-forest-800'
                        }`}
                      >
                        {active ? '✓ ' : ''}{x.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-lg bg-rose-950/60 ring-1 ring-rose-800/40 px-3 py-2 text-sm text-rose-300">
              ⚠️ {errorMsg}
            </div>
          )}
          {savedFlash && (
            <div className="rounded-lg bg-emerald-900/40 ring-1 ring-emerald-500/50 px-3 py-2 text-sm font-semibold text-emerald-200">
              ✅ Änderungen gespeichert.
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 bg-forest-950/95 backdrop-blur z-10 px-5 py-4 border-t border-forest-800/40 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-forest-900/70 ring-1 ring-forest-700/50 px-4 py-2.5 text-sm text-forest-200 hover:bg-forest-800"
          >
            Abbrechen
          </button>
          <button
            onClick={save}
            disabled={update.isPending || setCoAuf.isPending || !title.trim()}
            className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-400 active:scale-95 transition disabled:opacity-50"
          >
            {update.isPending || setCoAuf.isPending ? 'Speichern…' : '💾 Speichern'}
          </button>
        </footer>

        {showOilPicker && (
          <OilPicker
            selected={oils}
            onChange={setOils}
            onClose={() => setShowOilPicker(false)}
          />
        )}
      </div>
    </div>
  );
}
