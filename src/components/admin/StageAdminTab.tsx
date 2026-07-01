import { useEffect, useMemo, useState } from 'react';
import {
  useTvStageState, useSetStageManualScenes, useToggleStageScene, useTriggerStageEffect,
} from '@/lib/api';
import { SCENE_REGISTRY } from '@/components/stage/scenes';
import { EFFECT_REGISTRY, EFFECT_CATEGORIES } from '@/components/stage/effects';
import { EffectPlayer } from '@/components/stage/effects/EffectPlayer';
import { activeScenesForState, currentSeasonLabel, THEME_PRESETS } from '@/lib/season';

// Admin-Tab „🎭 Bühne": steuert TV-Tafel-Szenarien + Effekte.
// Drei Sektionen: Aktive Layer (Checkboxes), Themes (One-Click), Effekte
// (nach Kategorie gruppiert + Suche + Lokal-Test-Modus).

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

  // Effekt-Suche + Lokal-Test-Modus. Im Test-Modus spielen die Effekt-Buttons
  // lokal ab (umgeht Realtime) statt an die Tafel zu senden — ersetzt die
  // frühere zweite Vollliste aller Effekte.
  const [effectSearch, setEffectSearch] = useState('');
  const [localTestMode, setLocalTestMode] = useState(false);

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

  // Cooldown auf Effect-Buttons: 5s nach letztem Klick disabled.
  // Verhindert dass schnelle Klick-Folgen (z.B. 3x in 15s, siehe API-Logs)
  // sich gegenseitig überschreiben — jeder neue Trigger ersetzt last_effect,
  // wodurch der EffectPlayer per nonce-key unmounted und alte Effects
  // mid-render abgebrochen werden.
  const [effectCooldownUntil, setEffectCooldownUntil] = useState(0);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (effectCooldownUntil <= Date.now()) return;
    const t = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [effectCooldownUntil]);
  const cooldownRemainingMs = Math.max(0, effectCooldownUntil - Date.now());
  const isCoolingDown = cooldownRemainingMs > 0;

  async function handleEffect(kind: string) {
    if (isCoolingDown) return;
    try {
      setEffectCooldownUntil(Date.now() + 5_000);
      await triggerEffect.mutateAsync(kind);
    } catch (e) {
      setEffectCooldownUntil(0);
      window.alert((e as Error).message);
    }
  }

  // Effekte nach Kategorie gruppiert + nach Suchbegriff (Label) gefiltert.
  const effectGroups = useMemo(() => {
    const q = effectSearch.trim().toLowerCase();
    return EFFECT_CATEGORIES.map((cat) => ({
      cat,
      effects: Object.values(EFFECT_REGISTRY).filter(
        (e) => e.category === cat.id && (q === '' || e.label.toLowerCase().includes(q)),
      ),
    })).filter((g) => g.effects.length > 0);
  }, [effectSearch]);

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

      {/* ── Effekte (One-Shot Trigger, nach Kategorie gruppiert) ── */}
      <section className="rounded-2xl bg-forest-950/70 ring-1 ring-forest-800/50 p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-forest-300">
            🎆 Effekte {localTestMode ? '(Lokal-Test)' : '(sofort an der Tafel)'}
          </h2>
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-forest-300 bg-forest-900/60 ring-1 ring-forest-700/40 px-3 py-1.5 rounded-lg">
            <input
              type="checkbox"
              checked={localTestMode}
              onChange={(e) => setLocalTestMode(e.target.checked)}
              className="w-4 h-4 accent-forest-500"
            />
            🧪 Lokal-Test-Modus <span className="text-forest-400/70 normal-case">(umgeht Realtime)</span>
          </label>
        </div>
        <p className="text-xs text-forest-400 mb-3">
          {localTestMode
            ? 'Effekt läuft nur HIER im Admin ab (Diagnose der Render-Strecke, ohne Tafel). Sichtbar hier aber nicht auf der Tafel → Realtime-Problem.'
            : 'Effekt läuft einmal kurz auf der Tafel, verschwindet dann automatisch. Realtime-Latency ~1s.'}
        </p>

        {/* Suche */}
        <input
          value={effectSearch}
          onChange={(e) => setEffectSearch(e.target.value)}
          placeholder="🔍 Effekt suchen…"
          className="w-full sm:max-w-xs mb-4 rounded-lg bg-forest-900/80 px-3 py-2 text-sm text-forest-100 ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400 placeholder:text-forest-500"
        />

        {/* Klapp-Gruppen pro Kategorie */}
        <div className="space-y-3">
          {effectGroups.map(({ cat, effects }) => (
            <details key={cat.id} open className="group rounded-xl bg-forest-900/30 ring-1 ring-forest-800/40 overflow-hidden">
              <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-semibold text-forest-200 flex items-center gap-2 hover:bg-forest-900/50">
                <span aria-hidden>{cat.emoji}</span>
                <span>{cat.label}</span>
                <span className="text-[10px] text-forest-400 font-normal">({effects.length})</span>
                <span className="ml-auto text-forest-500 text-xs transition group-open:rotate-180">▾</span>
              </summary>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3 pt-0">
                {effects.map((eff) => (
                  <button
                    key={eff.id}
                    onClick={() => (localTestMode ? playLocal(eff.id) : handleEffect(eff.id))}
                    disabled={!localTestMode && (triggerEffect.isPending || isCoolingDown)}
                    className="rounded-xl bg-amber-500/15 ring-1 ring-amber-500/40 px-3 py-3 text-sm font-semibold text-amber-100 hover:bg-amber-500/25 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center gap-1"
                  >
                    <span className="text-2xl" aria-hidden>{eff.emoji}</span>
                    <span className="text-center leading-tight">{eff.label}</span>
                    <span className="text-[10px] text-amber-300/60">
                      {!localTestMode && isCoolingDown ? `${Math.ceil(cooldownRemainingMs / 1000)}s…` : `${Math.round(eff.durationMs / 1000)}s`}
                    </span>
                  </button>
                ))}
              </div>
            </details>
          ))}
          {effectGroups.length === 0 && (
            <p className="text-xs text-forest-400 italic py-2">Kein Effekt gefunden für „{effectSearch}".</p>
          )}
        </div>

        {!localTestMode && isCoolingDown && (
          <p className="text-[11px] text-amber-300/70 mt-3 italic">
            ⏱ Bitte {Math.ceil(cooldownRemainingMs / 1000)}s warten — vorheriger Effekt läuft noch (sonst überschreibt der Neue ihn auf der Tafel).
          </p>
        )}
        {state?.last_effect && (
          <p className="text-[11px] text-forest-400 mt-3">
            Zuletzt ausgelöst: <strong>{EFFECT_REGISTRY[state.last_effect.kind]?.label ?? state.last_effect.kind}</strong>{' '}
            ({new Date(state.last_effect.triggered_at).toLocaleTimeString('de-DE')})
          </p>
        )}
      </section>

      {/* Lokal-Render-Slot. EffectPlayer rendert mit fixed inset-0, z-100 →
          erscheint über dem ganzen Admin-UI für die Dauer des Effekts. */}
      {localTest && <EffectPlayer key={localTest.nonce} effect={localTest} />}
    </div>
  );
}
