import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Member, MemberCustomAttr } from '@/lib/api';
import {
  useSetSaunaName, useSetBirthday,
  useMyCustomOils, useAddCustomOil, useDeleteCustomOil,
  useSetMyDefaultMood, customOilId,
} from '@/lib/api';
import { ATTRIBUTES } from '@/lib/attributes';
import { OILS } from '@/lib/oils';
import { sendNotification } from '@/lib/telegram';
import EmojiPicker from '@/components/EmojiPicker';

const MAX_DEFAULT_ATTRS = 5;
const MAX_DEFAULT_OILS = 3;

// Identisches Farb-Preset wie in CustomAttrCreator — damit eigene Öle
// und eigene Buttons den gleichen Farb-Pool teilen und der User
// konsistent erkennt was zu was gehört.
const OIL_PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f43f5e', '#84cc16', '#06b6d4', '#a855f7',
];

interface IdentityCardProps {
  member: Member;
  customAttrs: MemberCustomAttr[];
  onOpenAttrCreator: () => void;
}

export function IdentityCard({ member, customAttrs, onOpenAttrCreator }: IdentityCardProps) {
  const setSaunaName = useSetSaunaName();
  const setBirthday = useSetBirthday();

  // Eigene Öle (Migration 0098 + 0101 für color) — Verwaltung
  const myOils = useMyCustomOils(member.id);
  const addOil = useAddCustomOil();
  const delOil = useDeleteCustomOil();
  const [newOilName, setNewOilName] = useState('');
  const [newOilEmoji, setNewOilEmoji] = useState('🌿');
  const [newOilColor, setNewOilColor] = useState(OIL_PRESET_COLORS[3]); // grün als Default
  const [showOilEmojiPicker, setShowOilEmojiPicker] = useState(false);
  const [oilError, setOilError] = useState<string | null>(null);

  async function handleAddOil() {
    setOilError(null);
    if (!newOilName.trim()) return setOilError('Name darf nicht leer sein.');
    try {
      await addOil.mutateAsync({
        member_id: member.id,
        name: newOilName.trim(),
        emoji: newOilEmoji || '🌿',
        color: newOilColor,
      });
      setNewOilName('');
      setNewOilEmoji('🌿');
      setNewOilColor(OIL_PRESET_COLORS[3]); // zurück zu grün für nächstes Öl
    } catch (e) {
      setOilError((e as Error).message);
    }
  }
  async function handleDeleteOil(id: string) {
    setOilError(null);
    try { await delOil.mutateAsync({ id, member_id: member.id }); }
    catch (e) { setOilError((e as Error).message); }
  }

  // ─── Standard-Stil / Default-Mood (Migration 0100) ─────────────────────
  // Aufgießer hinterlegt bis zu 5 Standard-Eigenschaften + 3 Standard-Öle
  // die auf der TV-Tafel angezeigt werden, falls ein Aufguss leere
  // attrs/oils hat. Local-State wird beim ersten Render aus member-Daten
  // initialisiert und nach Save in den Server gespiegelt.
  const setMood = useSetMyDefaultMood();
  const [moodAttrs, setMoodAttrs] = useState<string[]>(member.default_mood_attributes ?? []);
  const [moodOils, setMoodOils] = useState<string[]>(member.default_mood_oils ?? []);
  const [moodError, setMoodError] = useState<string | null>(null);
  const [moodSaved, setMoodSaved] = useState(false);
  // Re-sync wenn Server-Daten ankommen (z.B. nach Login-Refetch)
  useEffect(() => {
    setMoodAttrs(member.default_mood_attributes ?? []);
    setMoodOils(member.default_mood_oils ?? []);
  }, [member.default_mood_attributes, member.default_mood_oils]);

  const moodAttrsDirty = useMemo(() => {
    const a = [...(member.default_mood_attributes ?? [])].sort().join(',');
    const b = [...moodAttrs].sort().join(',');
    return a !== b;
  }, [member.default_mood_attributes, moodAttrs]);
  const moodOilsDirty = useMemo(() => {
    const a = [...(member.default_mood_oils ?? [])].sort().join(',');
    const b = [...moodOils].sort().join(',');
    return a !== b;
  }, [member.default_mood_oils, moodOils]);
  const moodDirty = moodAttrsDirty || moodOilsDirty;

  function toggleMoodAttr(id: string) {
    setMoodError(null);
    setMoodSaved(false);
    setMoodAttrs((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_DEFAULT_ATTRS) {
        setMoodError(`Maximal ${MAX_DEFAULT_ATTRS} Standard-Eigenschaften.`);
        return prev;
      }
      return [...prev, id];
    });
  }
  function toggleMoodOil(id: string) {
    setMoodError(null);
    setMoodSaved(false);
    setMoodOils((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_DEFAULT_OILS) {
        setMoodError(`Maximal ${MAX_DEFAULT_OILS} Standard-Öle.`);
        return prev;
      }
      return [...prev, id];
    });
  }
  async function saveMood() {
    setMoodError(null);
    try {
      await setMood.mutateAsync({ attributes: moodAttrs, oils: moodOils });
      setMoodSaved(true);
      setTimeout(() => setMoodSaved(false), 2000);
    } catch (e) {
      setMoodError((e as Error).message);
    }
  }
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [editingBirthday, setEditingBirthday] = useState(false);
  const [birthdayInput, setBirthdayInput] = useState(member.birthday ?? '');
  const [birthdaySaved, setBirthdaySaved] = useState(false);

  async function saveBirthday() {
    try {
      await setBirthday.mutateAsync(birthdayInput || null);
      setEditingBirthday(false);
      setBirthdaySaved(true);
      setTimeout(() => setBirthdaySaved(false), 3000);
    } catch (e) {
      console.error(e);
    }
  }

  async function saveName() {
    setNameError(null);
    const trimmed = nameInput.trim();
    try {
      await setSaunaName.mutateAsync(trimmed);
      const oldName = member.sauna_name || member.name || '';
      const newName = trimmed || member.name || '';
      await sendNotification(`🎭 <b>${member.name}</b> hat seinen Aufguss-Namen geändert: ${oldName} → ${newName}`);
      setEditingName(false);
      setNameInput('');
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 3000);
    } catch (e) {
      setNameError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      {/* Aufguss-Name section */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs">🎭</span>
          <h3 className="text-[11px] font-bold text-violet-300/80 uppercase tracking-[0.12em]">
            Aufguss-Name
          </h3>
        </div>
        {nameSaved && <p className="text-sm text-emerald-300 mb-2">✅ Name gespeichert.</p>}
        {!editingName ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-base font-semibold text-forest-100">
                {member.sauna_name || <span className="text-forest-300/50 font-normal text-sm italic">— nicht gesetzt —</span>}
              </span>
            </div>
            <button
              onClick={() => { setEditingName(true); setNameInput(member.sauna_name ?? ''); setNameError(null); }}
              className="rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs text-violet-200 ring-1 ring-violet-500/30 hover:bg-violet-500/25"
            >
              ✏️ Ändern
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="z.B. Der Feuermeister"
              maxLength={40}
              autoFocus
              className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-violet-700/30 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            {nameError && <p className="text-xs text-rose-300">{nameError}</p>}
            <div className="flex gap-2">
              <button onClick={saveName} disabled={setSaunaName.isPending}
                className="flex-1 rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-violet-950 hover:bg-violet-400 disabled:opacity-60">
                {setSaunaName.isPending ? 'Speichere…' : 'Speichern'}
              </button>
              <button onClick={() => { setEditingName(false); setNameError(null); }}
                className="rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-300 ring-1 ring-forest-700/50 hover:bg-forest-900">
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Geburtstag */}
      <section className="pt-3 border-t border-forest-800/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs">🎂</span>
          <h3 className="text-[11px] font-bold text-violet-300/80 uppercase tracking-[0.12em]">Geburtstag</h3>
        </div>
        {birthdaySaved && <p className="text-sm text-emerald-300 mb-2">✅ Geburtstag gespeichert.</p>}
        {!editingBirthday ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-forest-200">
              {member.birthday
                ? new Date(member.birthday).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
                : <span className="text-forest-300/50 italic">— nicht gesetzt —</span>}
            </span>
            <button
              onClick={() => { setEditingBirthday(true); setBirthdayInput(member.birthday ?? ''); }}
              className="rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs text-violet-200 ring-1 ring-violet-500/30 hover:bg-violet-500/25"
            >
              {member.birthday ? '✏️ Ändern' : '+ Setzen'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="date"
              value={birthdayInput}
              onChange={(e) => setBirthdayInput(e.target.value)}
              className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm ring-1 ring-violet-700/30 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <div className="flex gap-2">
              <button onClick={saveBirthday} disabled={setBirthday.isPending}
                className="flex-1 rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-violet-950 hover:bg-violet-400 disabled:opacity-60">
                {setBirthday.isPending ? 'Speichere…' : 'Speichern'}
              </button>
              <button onClick={() => setEditingBirthday(false)}
                className="rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-300 ring-1 ring-forest-700/50 hover:bg-forest-900">
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Buttons section */}
      {member.custom_attrs_enabled !== false && (
        <section className="pt-3 border-t border-forest-800/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs">🎨</span>
              <h3 className="text-[11px] font-bold text-violet-300/80 uppercase tracking-[0.12em]">
                Eigene Buttons <span className="text-forest-500 normal-case tracking-normal">({customAttrs.length}/8)</span>
              </h3>
            </div>
            {customAttrs.length < 8 && (
              <button
                onClick={onOpenAttrCreator}
                className="rounded-lg bg-violet-500/15 px-2 py-1 text-[11px] text-violet-200 ring-1 ring-violet-500/30 hover:bg-violet-500/25"
              >
                + Neu
              </button>
            )}
          </div>
          {customAttrs.length === 0 ? (
            <p className="text-xs text-forest-400 italic">Noch keine eigenen Buttons.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {customAttrs.map((a, idx) => (
                <motion.div
                  key={a.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: idx * 0.04 }}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-white/10"
                  style={{ background: a.color, color: '#0b1f10' }}
                >
                  <span>{a.emoji}</span>
                  <span>{a.label}</span>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Meine eigenen Öle (Migration 0098) — nur für Aufgießer */}
      {(member.is_aufgieser || member.role === 'admin' || member.role === 'guest_aufgieser') && (
        <section className="pt-3 border-t border-forest-800/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs">🌿</span>
              <h3 className="text-[11px] font-bold text-violet-300/80 uppercase tracking-[0.12em]">
                Meine eigenen Öle <span className="text-forest-500 normal-case tracking-normal">({(myOils.data ?? []).length}/50)</span>
              </h3>
            </div>
          </div>
          <p className="text-[10px] text-forest-400/70 mb-2">
            Nur du siehst sie in der Auswahl. Sobald in einem Aufguss verwendet, sehen sie alle auf der Tafel.
          </p>

          {/* Add-Form mit EmojiPicker (Modal) + ColorPicker-Preset.
              Identische UX wie CustomAttrCreator damit "Buttons" und "Öle"
              konsistent angelegt werden. */}
          {(myOils.data?.length ?? 0) < 50 && (
            <div className="space-y-2 mb-3 rounded-xl bg-violet-950/30 ring-1 ring-violet-700/30 p-2.5">
              {/* Live-Preview */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowOilEmojiPicker(true)}
                  className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-2xl ring-2 ring-white/20 hover:ring-white/40 transition"
                  style={{ background: newOilColor }}
                  title="Emoji wählen"
                  aria-label="Emoji wählen"
                >
                  {newOilEmoji}
                </button>
                <input
                  type="text"
                  value={newOilName}
                  onChange={(e) => setNewOilName(e.target.value.slice(0, 40))}
                  placeholder="z.B. Räuchersalbei, Mein Spezial-Mix"
                  className="flex-1 min-w-0 rounded-lg bg-forest-900/80 px-2.5 py-2 text-sm ring-1 ring-violet-700/30 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  maxLength={40}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddOil(); } }}
                />
              </div>

              {/* ColorPicker — Preset-Reihe analog CustomAttrCreator */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-forest-400/70 mb-1">Hintergrund-Farbe</p>
                <div className="flex flex-wrap gap-1.5">
                  {OIL_PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewOilColor(c)}
                      title={c}
                      aria-label={`Farbe ${c}`}
                      className={`w-7 h-7 rounded-full ring-2 transition ${
                        newOilColor === c ? 'ring-white scale-110' : 'ring-white/20 hover:ring-white/50'
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleAddOil}
                disabled={addOil.isPending || !newOilName.trim()}
                className="w-full rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-violet-950 hover:bg-violet-400 disabled:opacity-50 transition"
              >
                {addOil.isPending ? '…' : '+ Öl hinzufügen'}
              </button>
            </div>
          )}

          {oilError && (
            <p className="text-xs text-rose-300 mb-2">⚠️ {oilError}</p>
          )}

          {(myOils.data?.length ?? 0) === 0 ? (
            <p className="text-xs text-forest-400 italic">Noch keine eigenen Öle.</p>
          ) : (
            <ul className="space-y-1">
              {(myOils.data ?? []).map((o) => (
                <li
                  key={o.id}
                  className="flex items-center gap-2 rounded-lg ring-1 ring-white/10 px-2.5 py-1.5"
                  style={{
                    background: `linear-gradient(135deg, ${o.color ?? '#22c55e'}55, rgba(2,6,12,0.55))`,
                  }}
                >
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-base ring-1 ring-white/20"
                    style={{ background: o.color ?? '#22c55e' }}
                  >
                    {o.emoji}
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-forest-100 truncate">{o.name}</span>
                  <button
                    onClick={() => handleDeleteOil(o.id)}
                    disabled={delOil.isPending}
                    title="Löschen"
                    className="rounded-md bg-rose-900/40 ring-1 ring-rose-700/40 px-2 py-0.5 text-[10px] text-rose-200 hover:bg-rose-900/60 disabled:opacity-40"
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* EmojiPicker als Modal — rendert sich via Portal auf body, also
              kein Stacking-Konflikt mit dem umliegenden IdentityCard. */}
          {showOilEmojiPicker && (
            <EmojiPicker
              onSelect={(e) => setNewOilEmoji(e)}
              onClose={() => setShowOilEmojiPicker(false)}
            />
          )}
        </section>
      )}

      {/* Standard-Stil / Default-Mood (Migration 0100) — nur für Aufgießer.
          Wird auf der TV-Tafel als "🪶 Sein Stil"-Pills gezeigt, wenn
          ein Aufguss leere Eigenschaften / Öle hat. Verhindert sterile
          halbleere Karten ohne dass der Aufgießer bei jedem Slot alles
          neu wählen muss. */}
      {(member.is_aufgieser || member.role === 'admin' || member.role === 'guest_aufgieser') && (
        <section className="pt-3 border-t border-forest-800/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs">🪶</span>
            <h3 className="text-[11px] font-bold text-violet-300/80 uppercase tracking-[0.12em]">
              Mein Standard-Stil
            </h3>
          </div>
          <p className="text-[10px] text-forest-400/70 mb-3">
            Wird auf der Tafel als „Sein Stil" gezeigt, wenn du für einen Aufguss spontan keine Eigenschaften/Öle wählst.
            Max {MAX_DEFAULT_ATTRS} Eigenschaften + {MAX_DEFAULT_OILS} Öle.
          </p>

          {/* Standard-Eigenschaften */}
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-forest-400/80 mb-1.5">
              Eigenschaften ({moodAttrs.length}/{MAX_DEFAULT_ATTRS})
            </p>
            <div className="flex flex-wrap gap-1">
              {ATTRIBUTES.map((a) => {
                const active = moodAttrs.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleMoodAttr(a.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ring-1 transition ${
                      active
                        ? 'bg-violet-500 text-violet-950 ring-violet-300'
                        : 'bg-forest-900/60 text-forest-300 ring-forest-700/50 hover:bg-forest-900'
                    }`}
                  >
                    <span aria-hidden>{a.emoji}</span>
                    <span>{a.label}</span>
                  </button>
                );
              })}
              {/* Custom-Attrs des Users (Vereins-eigene) */}
              {customAttrs.map((a) => {
                const active = moodAttrs.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleMoodAttr(a.id)}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ring-1 transition"
                    style={
                      active
                        ? { background: a.color, color: '#0b1f10', boxShadow: `0 0 0 2px ${a.color}66` }
                        : { background: 'rgba(20, 83, 45, 0.55)', color: '#d1fae5' }
                    }
                  >
                    <span aria-hidden>{a.emoji}</span>
                    <span>{a.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Standard-Öle */}
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-forest-400/80 mb-1.5">
              Öle ({moodOils.length}/{MAX_DEFAULT_OILS})
            </p>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto rounded-lg ring-1 ring-forest-800/40 bg-forest-950/40 p-1.5">
              {OILS.map((o) => {
                const active = moodOils.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggleMoodOil(o.id)}
                    title={o.note ? `${o.name} (${o.note})` : o.name}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 transition ${
                      active
                        ? 'bg-amber-500 text-amber-950 ring-amber-300'
                        : 'bg-forest-900/60 text-forest-300 ring-forest-700/40 hover:bg-forest-900'
                    }`}
                  >
                    <span aria-hidden>{o.emoji}</span>
                    <span>{o.name}</span>
                  </button>
                );
              })}
              {/* Eigene Öle (Custom-Oils) — werden als custom:<uuid>-ID gespeichert */}
              {(myOils.data ?? []).map((co) => {
                const id = customOilId(co.id);
                const active = moodOils.includes(id);
                return (
                  <button
                    key={co.id}
                    type="button"
                    onClick={() => toggleMoodOil(id)}
                    title={`${co.name} (eigenes Öl)`}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 transition ${
                      active
                        ? 'bg-violet-500 text-violet-950 ring-violet-300'
                        : 'bg-violet-900/30 text-violet-100 ring-violet-700/40 hover:bg-violet-900/50'
                    }`}
                  >
                    <span aria-hidden>{co.emoji}</span>
                    <span>{co.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {moodError && (
            <p className="text-xs text-rose-300 mb-2">⚠️ {moodError}</p>
          )}
          {moodSaved && (
            <p className="text-xs text-emerald-300 mb-2">✅ Standard-Stil gespeichert.</p>
          )}
          <div className="flex justify-end">
            <button
              onClick={saveMood}
              disabled={setMood.isPending || !moodDirty}
              className="rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-semibold text-violet-950 hover:bg-violet-400 disabled:opacity-40 transition"
            >
              {setMood.isPending ? '…' : moodDirty ? '💾 Speichern' : '✓ Gespeichert'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
