import { Suspense, useEffect, useState } from 'react';
import { useTvStageState } from '@/lib/api';
import { activeScenesForState } from '@/lib/season';
import { StageBackdrop } from './basis/StageBackdrop';
import { StageCore } from './basis/StageCore';
import { StageGliders } from './basis/StageGliders';
import { SCENE_REGISTRY } from './scenes';
import { EffectPlayer } from './effects/EffectPlayer';

// Z-Index-Layering (Memory: klare Stufen, keine Konflikte)
//   Z_BACKDROP=1, Z_CORE=10, Z_SCENE_BACK=20, Z_SCENE_MID=30,
//   Z_SCENE_FRONT=40, Z_EFFECT=50, Z_GLIDERS=60

export function Stage() {
  const state = useTvStageState();

  // Datum-basierte Saison: alle 60s neu evaluieren (reicht für „Heute ist
  // 1.12.")
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const active = activeScenesForState(now, state.data ?? null);
  const lastEffect = state.data?.last_effect ?? null;

  return (
    <>
      <StageBackdrop />
      <StageCore />
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
      <StageGliders />
    </>
  );
}
