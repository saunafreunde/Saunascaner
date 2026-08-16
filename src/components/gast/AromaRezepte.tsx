import { useState } from 'react';
import { useApprovedAromaRecipes } from '@/lib/api';

type Rezept = {
  id: string;
  title: string;
  description: string | null;
  ingredients: { name: string; drops?: number }[];
  sauna_type: string | null;
  temperature_c: number | null;
  created_by_name: string | null;
};

// Aroma-Rezepte der Saunameister. Standen bis 0132 hinter der Rolle 'fan'
// (die niemand hatte) — jetzt für jeden freigegebenen Zugang sichtbar.
// Aus Fan.tsx übernommen, damit beim Abbau der Rolle nichts verloren geht.
export function AromaRezepte() {
  const recipes = useApprovedAromaRecipes();
  const liste = recipes.data ?? [];

  if (recipes.isLoading || liste.length === 0) return null;

  return (
    <section className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
        🌿 Aroma-Rezepte unserer Saunameister
      </h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {liste.map((r) => (
          <RezeptKarte key={r.id} rezept={r} />
        ))}
      </div>
    </section>
  );
}

function RezeptKarte({ rezept }: { rezept: Rezept }) {
  const [offen, setOffen] = useState(false);
  return (
    <div className="rounded-2xl bg-forest-900/60 ring-1 ring-forest-800/40 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-forest-100">{rezept.title}</h3>
        {rezept.sauna_type && (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">
            {rezept.sauna_type}
          </span>
        )}
      </div>
      {rezept.temperature_c && (
        <p className="text-[10px] text-forest-400 mb-2">🌡️ {rezept.temperature_c}°C</p>
      )}
      <ul className="text-xs text-forest-200/90 space-y-0.5 mb-2">
        {rezept.ingredients.map((zutat, i) => (
          <li key={i}>
            • {zutat.name}{zutat.drops ? ` · ${zutat.drops} Tropfen` : ''}
          </li>
        ))}
      </ul>
      {rezept.description && (
        <>
          <button
            onClick={() => setOffen(!offen)}
            className="text-[11px] text-amber-300/80 hover:text-amber-200"
          >
            {offen ? '⌃ Weniger' : '⌄ Anleitung'}
          </button>
          {offen && (
            <p className="text-[11px] text-forest-300 mt-2 whitespace-pre-line leading-relaxed">
              {rezept.description}
            </p>
          )}
        </>
      )}
      {rezept.created_by_name && (
        <p className="text-[10px] text-forest-500 mt-2 italic">— {rezept.created_by_name}</p>
      )}
    </div>
  );
}
