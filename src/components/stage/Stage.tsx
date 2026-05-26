import { Suspense, useEffect, useState } from 'react';
import { useTvStageState } from '@/lib/api';
import { activeScenesForState } from '@/lib/season';
import { SCENE_REGISTRY } from './scenes';
import { EffectPlayer } from './effects/EffectPlayer';

// Nackte Tafel-Bühne: keine permanente Basis mehr. Render nur:
// - Aktive Scene-Layer (saisonal-auto + admin-manuell)
// - Letzter One-Shot-Effect (per nonce-key bei jedem RPC-Trigger neu mounted)
//
// Die alten Basis-Komponenten (StageBackdrop/Core/Gliders) sind nicht mehr
// permanent — sie kommen über die Scene „schwarzwald-heim" auf Wunsch zurück.

export function Stage() {
  const state = useTvStageState();

  // Datum-basierte Saison: alle 60s neu evaluieren
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const active = activeScenesForState(now, state.data ?? null);
  const lastEffect = state.data?.last_effect ?? null;

  // FIX 0107 (Audit Phase 9.C): console.log feuerte alle 5s in Production
  // (Bedingung `typeof window !== 'undefined'` ist im Browser IMMER true).
  // → Memory-Leak auf 24/7-TV-Tafel. Jetzt nur in DEV-Builds.
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[Stage] state', { active, lastEffect });
  }

  return (
    <>
      {active.map((sceneId) => {
        const entry = SCENE_REGISTRY[sceneId];
        if (!entry) return null;
        const SceneComponent = entry.component;
        return (
          <Suspense key={sceneId} fallback={null}>
            <SceneComponent />
          </Suspense>
        );
      })}
      {lastEffect && (
        <Suspense fallback={null}>
          <EffectPlayer key={lastEffect.nonce} effect={lastEffect} />
        </Suspense>
      )}
    </>
  );
}
