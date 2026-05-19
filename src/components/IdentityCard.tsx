import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Member, MemberCustomAttr } from '@/lib/api';
import { useSetSaunaName, useSetBirthday } from '@/lib/api';
import { sendNotification } from '@/lib/telegram';

interface IdentityCardProps {
  member: Member;
  customAttrs: MemberCustomAttr[];
  onOpenAttrCreator: () => void;
}

export function IdentityCard({ member, customAttrs, onOpenAttrCreator }: IdentityCardProps) {
  const setSaunaName = useSetSaunaName();
  const setBirthday = useSetBirthday();
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
    </div>
  );
}
