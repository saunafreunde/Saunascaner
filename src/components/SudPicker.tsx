import { useState } from 'react';
import { useSudKraeuter, useSudMixe, useAddSudKraut, useAddSudMix, useDeleteSudEintrag } from '@/lib/api';
import { sudAttrId, sudMixAttrId, parseSudAttr, parseSudMixAttr } from '@/lib/sud';
import EmojiPicker from '@/components/EmojiPicker';

/** Sudaufguss-Reiter: Kräuter und fertige Mischungen.
 *
 *  Der Kräutervorrat ist GEMEINSAM (Tabelle sud_kraeuter, Migration 0124) —
 *  er steht im Regal und gehört dem Verein, nicht einer Person. Jeder
 *  Aufgießer darf ergänzen, jeder darf alles verwenden. Löschen darf nur, wer
 *  es angelegt hat (oder ein Admin): sonst verschwindet ein Kraut aus dem
 *  bereits geplanten Aufguss eines anderen.
 *
 *  `auswahl` enthält fertige Attribut-Einträge ('sud:<uuid>' / 'sudmix:<uuid>'),
 *  damit der Planer sie unverändert in attributes[] durchreichen kann.
 */
const FARBEN = ['#4d7c0f', '#16a34a', '#0d9488', '#0891b2', '#7c3aed', '#d97706', '#ca8a04', '#78716c'];

export function SudPicker({
  auswahl, onChange, memberId, voll, vollHinweis,
}: {
  auswahl: string[];
  onChange: (next: string[]) => void;
  memberId: string;
  /** Kontingent der 3–8-Regel erschöpft — Dazuwählen gesperrt, Abwählen nicht. */
  voll: boolean;
  vollHinweis: string;
}) {
  const kraeuterQ = useSudKraeuter();
  const mixeQ = useSudMixe();
  const addKraut = useAddSudKraut();
  const addMix = useAddSudMix();
  const del = useDeleteSudEintrag();

  const [neuOffen, setNeuOffen] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🌿');
  const [farbe, setFarbe] = useState(FARBEN[0]);
  const [emojiOffen, setEmojiOffen] = useState(false);
  const [mixName, setMixName] = useState('');
  const [mixOffen, setMixOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const kraeuter = kraeuterQ.data ?? [];
  const mixe = mixeQ.data ?? [];

  const gewaehlteKraeuter = auswahl.map(parseSudAttr).filter((x): x is string => !!x);
  const gewaehlteMixe = auswahl.map(parseSudMixAttr).filter((x): x is string => !!x);

  function toggle(attrId: string) {
    setFehler(null);
    if (auswahl.includes(attrId)) onChange(auswahl.filter((a) => a !== attrId));
    else if (!voll) onChange([...auswahl, attrId]);
  }

  async function krautAnlegen() {
    setFehler(null);
    const n = name.trim();
    if (!n) return setFehler('Bitte einen Namen eingeben.');
    try {
      await addKraut.mutateAsync({ name: n, emoji, color: farbe, created_by: memberId });
      setName(''); setEmoji('🌿'); setNeuOffen(false);
    } catch (e) { setFehler((e as Error).message); }
  }

  async function mixAnlegen() {
    setFehler(null);
    const n = mixName.trim();
    if (!n) return setFehler('Bitte einen Namen für die Mischung eingeben.');
    if (gewaehlteKraeuter.length < 2) {
      return setFehler('Eine Mischung braucht mindestens zwei Kräuter — wähle sie oben aus.');
    }
    try {
      await addMix.mutateAsync({
        name: n, emoji: '🧪', color: '#a16207',
        kraeuter: gewaehlteKraeuter, created_by: memberId,
      });
      // Die Einzelkräuter weichen der frischen Mischung: sonst stünde beides
      // nebeneinander auf der Karte und belegte doppelt so viele Plätze.
      setMixName(''); setMixOffen(false);
    } catch (e) { setFehler((e as Error).message); }
  }

  return (
    <div className="mt-2 space-y-3">
      {/* Fertige Mischungen zuerst — wer eine hat, will meist die, nicht die
          Einzelteile neu zusammensuchen. */}
      {mixe.length > 0 && (
        <div>
          <label className="text-xs text-forest-300">
            Fertige Mischungen <span className="text-forest-400/60">— zählt wie ein Öl</span>
          </label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {mixe.map((m) => {
              const attrId = sudMixAttrId(m.id);
              const an = auswahl.includes(attrId);
              const gesperrt = !an && voll;
              const zutaten = m.kraeuter
                .map((kid) => kraeuter.find((k) => k.id === kid)?.name)
                .filter(Boolean).join(' · ');
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(attrId)}
                  disabled={gesperrt}
                  title={gesperrt ? vollHinweis : zutaten || undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ring-1 transition ${
                    gesperrt ? 'opacity-30 cursor-not-allowed ' : ''
                  }`}
                  style={an
                    ? { background: m.color, color: '#fff', boxShadow: `0 0 0 2px ${m.color}66` }
                    : { background: 'rgba(20,83,45,0.4)', color: '#d1fae5', boxShadow: 'inset 0 0 0 1px rgba(20,83,45,0.8)' }}
                >
                  <span aria-hidden>{m.emoji}</span>
                  <span>{m.name}</span>
                  <span className="opacity-60 tabular-nums">{m.kraeuter.length}</span>
                  {m.created_by === memberId && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Mischung ${m.name} löschen`}
                      onClick={(e) => { e.stopPropagation(); void del.mutateAsync({ id: m.id, art: 'mix' }); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); void del.mutateAsync({ id: m.id, art: 'mix' }); } }}
                      className="ml-0.5 opacity-50 hover:opacity-100"
                    >✕</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <label className="text-xs text-forest-300">
          Kräuter <span className="text-forest-400/60">— jedes zählt einzeln</span>
        </label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {kraeuter.map((k) => {
            const attrId = sudAttrId(k.id);
            const an = auswahl.includes(attrId);
            const gesperrt = !an && voll;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => toggle(attrId)}
                disabled={gesperrt}
                title={gesperrt ? vollHinweis : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition ${
                  gesperrt ? 'opacity-30 cursor-not-allowed ' : ''
                }`}
                style={an
                  ? { background: k.color, color: '#fff', boxShadow: `0 0 0 2px ${k.color}66` }
                  : { background: 'rgba(20,83,45,0.4)', color: '#d1fae5', boxShadow: 'inset 0 0 0 1px rgba(20,83,45,0.8)' }}
              >
                <span aria-hidden>{k.emoji}</span>
                <span>{k.name}</span>
                {k.created_by === memberId && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Kraut ${k.name} löschen`}
                    onClick={(e) => { e.stopPropagation(); void del.mutateAsync({ id: k.id, art: 'kraut' }); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); void del.mutateAsync({ id: k.id, art: 'kraut' }); } }}
                    className="ml-0.5 opacity-50 hover:opacity-100"
                  >✕</span>
                )}
              </button>
            );
          })}
          {kraeuterQ.isLoading && <span className="text-xs text-forest-400/70">lädt…</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setNeuOffen((o) => !o); setMixOffen(false); setFehler(null); }}
          className="rounded-lg bg-forest-900/70 px-3 py-1.5 text-xs text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-900"
        >
          🌱 Neues Kraut
        </button>
        <button
          type="button"
          onClick={() => { setMixOffen((o) => !o); setNeuOffen(false); setFehler(null); }}
          disabled={gewaehlteKraeuter.length < 2}
          title={gewaehlteKraeuter.length < 2 ? 'Erst mindestens zwei Kräuter auswählen' : undefined}
          className="rounded-lg bg-forest-900/70 px-3 py-1.5 text-xs text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-900 disabled:opacity-40"
        >
          🧪 Aus {gewaehlteKraeuter.length || '…'} Kräutern eine Mischung machen
        </button>
      </div>

      {neuOffen && (
        <div className="rounded-xl bg-forest-950/60 p-3 ring-1 ring-forest-800/50 space-y-2">
          <p className="text-[11px] text-forest-400/80">
            Kommt ins gemeinsame Regal — alle Aufgießer können es danach verwenden.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEmojiOffen(true)}
              className="h-9 w-11 rounded-lg bg-forest-900 text-lg ring-1 ring-forest-700/50"
            >{emoji}</button>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Holunderblüte"
              className="flex-1 rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FARBEN.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFarbe(f)}
                className={`h-6 w-6 rounded-full transition ${farbe === f ? 'ring-2 ring-forest-200' : 'ring-1 ring-forest-700/60'}`}
                style={{ background: f }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={krautAnlegen}
            disabled={addKraut.isPending}
            className="rounded-lg bg-forest-500 px-3 py-1.5 text-xs font-bold text-forest-950 disabled:opacity-50"
          >
            {addKraut.isPending ? 'Speichere…' : 'Ins Regal legen'}
          </button>
        </div>
      )}

      {mixOffen && (
        <div className="rounded-xl bg-forest-950/60 p-3 ring-1 ring-forest-800/50 space-y-2">
          <p className="text-[11px] text-forest-400/80">
            Aus{' '}
            {gewaehlteKraeuter
              .map((id) => kraeuter.find((k) => k.id === id)?.name)
              .filter(Boolean).join(' · ')}
            {' '}wird eine Mischung, die alle verwenden können.
          </p>
          <input
            value={mixName}
            onChange={(e) => setMixName(e.target.value)}
            placeholder="Name der Mischung, z.B. Waldspaziergang"
            className="w-full rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
          />
          <button
            type="button"
            onClick={mixAnlegen}
            disabled={addMix.isPending}
            className="rounded-lg bg-forest-500 px-3 py-1.5 text-xs font-bold text-forest-950 disabled:opacity-50"
          >
            {addMix.isPending ? 'Speichere…' : 'Mischung anlegen'}
          </button>
        </div>
      )}

      {fehler && <p className="text-xs text-rose-300">{fehler}</p>}

      {(gewaehlteKraeuter.length > 0 || gewaehlteMixe.length > 0) && (
        <p className="text-[11px] text-forest-400/70">
          Der Aufguss erscheint mit Sud-Bild auf der Tafel.
        </p>
      )}

      {emojiOffen && (
        <EmojiPicker
          onSelect={(e) => { setEmoji(e); setEmojiOffen(false); }}
          onClose={() => setEmojiOffen(false)}
        />
      )}
    </div>
  );
}
