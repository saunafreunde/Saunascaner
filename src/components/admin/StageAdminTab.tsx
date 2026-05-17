import { useEffect, useState } from 'react';
import {
  useTvStageState, useSetStageManualScenes, useToggleStageScene, useTriggerStageEffect,
} from '@/lib/api';
import { SCENE_REGISTRY } from '@/components/stage/scenes';
import { EFFECT_REGISTRY } from '@/components/stage/effects';
import { EffectPlayer } from '@/components/stage/effects/EffectPlayer';
import { activeScenesForState, currentSeasonLabel, THEME_PRESETS } from '@/lib/season';

// Admin-Tab „🎭 Bühne": steuert TV-Tafel-Szenarien + Effekte.
// Drei Sektionen: Aktive Layer (Checkboxes), Themes (One-Click), Effekte (Trigger).

export function StageAdminTab() {
  const stateQ = useTvStageState();
  const setScenes = useSetStageManualScenes();
  const toggleScene = useToggleStageScene();
  const triggerEffect = useTriggerStageEffect();

  // Re-Render alle 30s für „aktuelle Saison"-Anzeige
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Lokal-Test: spielt einen Effect IM ADMIN-TAB ab (umgeht Realtime).
  // So lässt sich isolieren ob ein Bug im Render-Layer oder in der
  // Realtime-Strecke steckt. Synthetic nonce, damit jede Klick-Wiederholung
  // den EffectPlayer neu mountet.
  const [localTest, setLocalTest] = useState<{ kind: string; triggered_at: string; nonce: string } | null>(null);
  function playLocal(kind: string) {
    setLocalTest({
      kind,
      triggered_at: new Date().toISOString(),
      nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    });
  }

  const state = stateQ.data;
  const active = activeScenesForState(now, state ?? null);
  const seasonLabel = currentSeasonLabel(now);

  function isManual(id: string): boolean {
    return state?.manual_scenes.includes(id) ?? false;
  }
  function isActive(id: string): boolean {
    return active.includes(id);
  }
  function isAuto(id: string): boolean {
    return isActive(id) && !isManual(id);
  }

  async function handleToggle(id: string, newActive: boolean) {
    try {
      await toggleScene.mutateAsync({ sceneId: id, active: newActive });
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  async function handleTheme(preset: typeof THEME_PRESETS[number]) {
    try {
      await setScenes.mutateAsync({ scenes: preset.scenes, suppress_auto: true });
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  async function handleAutoToggle(newSuppress: boolean) {
    try {
      await setScenes.mutateAsync({
        scenes: state?.manual_scenes ?? [],
        suppress_auto: newSuppress,
      });
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  async function handleEffect(kind: string) {
    try {
      await triggerEffect.mutateAsync(kind);
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  if (stateQ.isLoading) {
    return <div className="text-forest-300 text-center py-12">Lade…</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── Status-Header ── */}
      <section className="rounded-2xl bg-forest-950/70 ring-1 ring-forest-800/50 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-widest text-forest-400 mb-1">Aktuelle Saison</div>
            <div className="text-xl font-bold text-forest-100">{seasonLabel}</div>
            <p className="text-xs text-forest-400 mt-1">
              {state?.suppress_auto_season
                ? '🚫 Auto-Saison überschrieben — nur manuelle Layer werden gezeigt'
                : `✅ Auto-aktiviert: ${active.length} Layer (${active.join(', ') || 'keine'})`}
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none bg-forest-900/60 ring-1 ring-forest-700/40 px-3 py-2 rounded-xl">
            <input
              type="checkbox"
              checked={state?.suppress_auto_season ?? false}
              onChange={(e) => handleAutoToggle(e.target.checked)}
              className="w-4 h-4 accent-forest-500"
            />
            <span className="text-sm text-forest-200">Auto-Saison übersteuern</span>
          </label>
        </div>
      </section>

      {/* ── Aktive Layer (Checkboxes) ── */}
      <section className="rounded-2xl bg-forest-950/70 ring-1 ring-forest-800/50 p-5">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-300">
            🎨 Szenarien-Layer
          </h2>
          <span className="text-xs text-forest-400">
            ⬜ aus · ✅ manuell · ⭕ auto (durch Saison)
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.values(SCENE_REGISTRY).map((scene) => {
            const auto = isAuto(scene.id);
            const manual = isManual(scene.id);
            const checked = auto || manual;
            return (
              <label
                key={scene.id}
                className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ring-1 cursor-pointer transition ${
                  checked
                    ? 'bg-forest-600/15 ring-forest-500/40 text-forest-100'
                    : 'bg-forest-900/40 ring-forest-800/40 text-forest-300 hover:bg-forest-900/70'
                }`}
              >
                <input
                  type="checkbox"
                  checked={manual}
                  onChange={(e) => handleToggle(scene.id, e.target.checked)}
                  className="mt-1 w-4 h-4 accent-forest-500 flex-shrink-0"
                  disabled={auto && !manual && !state?.suppress_auto_season}
                  title={auto && !manual ? 'Aktuell durch Saison automatisch aktiv' : undefined}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span aria-hidden>{scene.emoji}</span>
                    <span className="truncate">{scene.label}</span>
                    {auto && !manual && <span className="text-[10px] text-forest-400 bg-forest-800/60 px-1.5 py-0.5 rounded">auto</span>}
                  </div>
                  {scene.defaultSeason && (
                    <div className="text-[10px] text-forest-400/80 mt-0.5">{scene.defaultSeason}</div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {/* ── Themes (One-Click) ── */}
      <section className="rounded-2xl bg-forest-950/70 ring-1 ring-forest-800/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-300 mb-4">
          🎭 Themes (One-Click-Voreinstellungen)
        </h2>
        <p className="text-xs text-forest-400 mb-3">
          Setzt alle Layer auf eine Voreinstellung. Auto-Saison wird dabei deaktiviert.
        </p>
        <div className="flex flex-wrap gap-2">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleTheme(preset)}
              disabled={setScenes.isPending}
              className="rounded-xl bg-forest-900/60 ring-1 ring-forest-700/50 px-4 py-2.5 text-sm font-medium text-forest-100 hover:bg-forest-800 active:scale-95 transition disabled:opacity-50"
            >
              <span aria-hidden className="mr-1.5">{preset.emoji}</span>
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Effekte (One-Shot Trigger) ── */}
      <section className="rounded-2xl bg-forest-950/70 ring-1 ring-forest-800/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-300 mb-4">
          🎆 Effekte (sofort an der Tafel)
        </h2>
        <p className="text-xs text-forest-400 mb-3">
          Effekt läuft einmal kurz, verschwindet dann automatisch. Realtime-Latency ~1s.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Object.values(EFFECT_REGISTRY).map((eff) => (
            <button
              key={eff.id}
              onClick={() => handleEffect(eff.id)}
              disabled={triggerEffect.isPending}
              className="rounded-xl bg-amber-500/15 ring-1 ring-amber-500/40 px-3 py-3 text-sm font-semibold text-amber-100 hover:bg-amber-500/25 active:scale-95 transition disabled:opacity-50 flex flex-col items-center gap-1"
            >
              <span className="text-2xl" aria-hidden>{eff.emoji}</span>
              <span>{eff.label}</span>
              <span className="text-[10px] text-amber-300/60">{Math.round(eff.durationMs / 1000)}s</span>
            </button>
          ))}
        </div>
        {state?.last_effect && (
          <p className="text-[11px] text-forest-400 mt-3">
            Zuletzt ausgelöst: <strong>{EFFECT_REGISTRY[state.last_effect.kind]?.label ?? state.last_effect.kind}</strong>{' '}
            ({new Date(state.last_effect.triggered_at).toLocaleTimeString('de-DE')})
          </p>
        )}
      </section>

      {/* ── Lokal-Test (Diagnose) ── */}
      <section className="rounded-2xl bg-forest-950/40 ring-1 ring-forest-800/40 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-forest-400 mb-2">
          🧪 Lokal-Test (umgeht Realtime — testet nur die Render-Strecke)
        </h2>
        <p className="text-[11px] text-forest-400/80 mb-2">
          Wenn der Effekt hier sichtbar ist aber auf der Tafel nicht: Realtime-Problem.
          Wenn hier auch nichts kommt: Render-Problem.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {Object.values(EFFECT_REGISTRY).map((eff) => (
            <button
              key={eff.id}
              onClick={() => playLocal(eff.id)}
              className="rounded-md bg-forest-900/60 ring-1 ring-forest-700/40 px-2 py-1 text-[11px] text-forest-200 hover:bg-forest-800"
            >
              {eff.emoji} {eff.label}
            </button>
          ))}
        </div>
      </section>

      {/* Lokal-Render-Slot. EffectPlayer rendert mit fixed inset-0, z-100 →
          erscheint über dem ganzen Admin-UI für die Dauer des Effekts. */}
      {localTest && <EffectPlayer key={localTest.nonce} effect={localTest} />}
    </div>
  );
}
