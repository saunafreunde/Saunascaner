import { useState } from 'react';
import {
  useMyAromaRecipes,
  useCreateAromaRecipe,
  useDeleteAromaRecipe,
  type AromaRecipeIngredient,
  type AromaRecipe,
} from '@/lib/api';

// Saunameister-Submit-UI: eigene Aroma-Rezepte einreichen + verwalten.
// Pending werden vom Admin geprüft, approved erscheinen im /fan-Bereich
// als exklusiver Premium-Content für Fördernde Mitglieder.
export function MyAromaRecipesEditor({ memberId }: { memberId: string }) {
  const recipes = useMyAromaRecipes(memberId);
  const create = useCreateAromaRecipe();
  const del = useDeleteAromaRecipe();

  const [showForm, setShowForm] = useState(false);

  const list = recipes.data ?? [];
  const pendingCount = list.filter((r) => !r.approved).length;
  const approvedCount = list.filter((r) => r.approved).length;

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
            🌿 Meine Aroma-Rezepte
          </h2>
          <p className="text-[11px] text-forest-400 mt-0.5">
            Reiche deine Lieblings-Mischungen ein. Nach Freigabe sieht jeder Fan sie im exklusiven Premium-Bereich.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-100 ring-1 ring-amber-400/50 hover:bg-amber-500/40"
          >
            + Neues Rezept
          </button>
        )}
      </div>

      {showForm && (
        <RecipeForm
          isSubmitting={create.isPending}
          onSubmit={async (data) => {
            await create.mutateAsync({ ...data, created_by: memberId });
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {!showForm && (
        <>
          {pendingCount + approvedCount === 0 ? (
            <p className="text-xs text-forest-400/70 text-center py-4">
              Noch keine eingereichten Rezepte.
            </p>
          ) : (
            <div className="space-y-2 mt-3">
              <div className="text-[10px] text-forest-400 uppercase tracking-wider">
                {approvedCount > 0 && <>{approvedCount} freigegeben</>}
                {approvedCount > 0 && pendingCount > 0 && ' · '}
                {pendingCount > 0 && <span className="text-amber-300">{pendingCount} wartet auf Admin</span>}
              </div>
              <ul className="space-y-2">
                {list.map((r) => (
                  <li
                    key={r.id}
                    className={`rounded-xl p-3 ring-1 ${
                      r.approved
                        ? 'bg-emerald-950/20 ring-emerald-500/30'
                        : 'bg-amber-950/20 ring-amber-500/30'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-forest-100">
                        {r.title}
                        {r.sauna_type && (
                          <span className="ml-2 rounded-full bg-forest-800/60 px-2 py-0.5 text-[10px] text-forest-300">
                            {r.sauna_type}
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold ${r.approved ? 'text-emerald-300' : 'text-amber-300'}`}>
                          {r.approved ? '✓ freigegeben' : '⏳ wartet'}
                        </span>
                        {!r.approved && (
                          <button
                            onClick={() => {
                              if (!window.confirm(`Rezept "${r.title}" löschen?`)) return;
                              del.mutate(r.id);
                            }}
                            className="text-[11px] text-rose-300 hover:text-rose-200"
                            title="Eigene Einreichung zurückziehen"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </div>
                    <ul className="text-xs text-forest-200/90 mb-1">
                      {r.ingredients.map((ing, i) => (
                        <li key={i}>• {ing.name}{ing.drops ? ` · ${ing.drops} Tropfen` : ''}</li>
                      ))}
                    </ul>
                    {r.description && (
                      <p className="text-[11px] text-forest-300/80 mt-2 whitespace-pre-line">{r.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Form: Titel + Zutaten (dynamische Liste) + Sauna-Typ + Temp + Anleitung
// ─────────────────────────────────────────────────────────────────────────────

function RecipeForm({
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  isSubmitting: boolean;
  onSubmit: (data: {
    title: string;
    description: string | null;
    ingredients: AromaRecipeIngredient[];
    sauna_type: AromaRecipe['sauna_type'];
    temperature_c: number | null;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saunaType, setSaunaType] = useState<AromaRecipe['sauna_type']>(null);
  const [temperature, setTemperature] = useState<string>('');
  const [ingredients, setIngredients] = useState<AromaRecipeIngredient[]>([
    { name: '', drops: undefined },
  ]);
  const [error, setError] = useState<string | null>(null);

  const updateIngredient = (idx: number, patch: Partial<AromaRecipeIngredient>) => {
    setIngredients((prev) => prev.map((ing, i) => (i === idx ? { ...ing, ...patch } : ing)));
  };
  const addIngredient = () => setIngredients((prev) => [...prev, { name: '', drops: undefined }]);
  const removeIngredient = (idx: number) =>
    setIngredients((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanedIngredients = ingredients
      .filter((ing) => ing.name.trim().length > 0)
      .map((ing) => ({ name: ing.name.trim(), drops: ing.drops }));

    if (!title.trim()) {
      setError('Bitte gib einen Titel ein.');
      return;
    }
    if (cleanedIngredients.length === 0) {
      setError('Bitte mindestens eine Zutat angeben.');
      return;
    }

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        ingredients: cleanedIngredients,
        sauna_type: saunaType,
        temperature_c: temperature ? parseInt(temperature, 10) : null,
      });
    } catch (err) {
      setError((err as Error).message || 'Konnte nicht gespeichert werden.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-3 rounded-2xl bg-forest-900/60 p-4 ring-1 ring-amber-500/30">
      <label className="block text-xs text-forest-300">
        Titel *
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
          placeholder="z.B. Birkenwald-Frische"
          className="mt-1 w-full rounded-lg bg-forest-950/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
        />
      </label>

      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-xs text-forest-300">Zutaten *</span>
          <button
            type="button"
            onClick={addIngredient}
            className="text-[11px] text-amber-300 hover:text-amber-200"
          >
            + Zutat
          </button>
        </div>
        <div className="space-y-1.5">
          {ingredients.map((ing, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={ing.name}
                onChange={(e) => updateIngredient(idx, { name: e.target.value })}
                placeholder="z.B. Birke"
                className="flex-1 rounded-lg bg-forest-950/80 px-2 py-1.5 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
              />
              <input
                type="number"
                value={ing.drops ?? ''}
                onChange={(e) => updateIngredient(idx, { drops: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                placeholder="Tropfen"
                min={1}
                max={50}
                className="w-20 rounded-lg bg-forest-950/80 px-2 py-1.5 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
              />
              {ingredients.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeIngredient(idx)}
                  className="rounded px-2 text-rose-300 hover:text-rose-200"
                  title="Entfernen"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-forest-300">
          Sauna-Typ
          <select
            value={saunaType ?? ''}
            onChange={(e) => setSaunaType((e.target.value || null) as AromaRecipe['sauna_type'])}
            className="mt-1 w-full rounded-lg bg-forest-950/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50"
          >
            <option value="">—</option>
            <option value="finnisch">Finnisch</option>
            <option value="bio">Bio</option>
            <option value="kelo">Kelo</option>
            <option value="aufguss">Aufguss</option>
            <option value="event">Event</option>
          </select>
        </label>
        <label className="text-xs text-forest-300">
          Temperatur (°C)
          <input
            type="number"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            min={40}
            max={110}
            placeholder="optional"
            className="mt-1 w-full rounded-lg bg-forest-950/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50"
          />
        </label>
      </div>

      <label className="block text-xs text-forest-300">
        Anleitung / Story
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Wann gießt du das? Wie warmgeht der Aufguss am besten?"
          className="mt-1 w-full rounded-lg bg-forest-950/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
        />
      </label>

      {error && (
        <div className="rounded-lg bg-rose-500/20 ring-1 ring-rose-500/40 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-amber-500/30 px-4 py-2 text-sm font-semibold text-amber-100 ring-1 ring-amber-400/50 hover:bg-amber-500/40 disabled:opacity-50"
        >
          {isSubmitting ? 'Sende…' : '🌿 Zur Freigabe einreichen'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-forest-900/60 ring-1 ring-forest-700/40 px-3 py-2 text-sm text-forest-200"
        >
          Abbrechen
        </button>
      </div>

      <p className="text-[10px] text-forest-400/80 leading-snug">
        Hinweis: Nach dem Einreichen prüft die Admin-Crew dein Rezept. Bei Freigabe ist es im
        Fan-Bereich für Fördernde Mitglieder sichtbar — mit deinem Namen als Saunameister.
      </p>
    </form>
  );
}
