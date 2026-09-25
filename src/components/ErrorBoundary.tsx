// FIX 0107 (Audit Phase 4 CRITICAL): vorher NULL ErrorBoundaries in der ganzen App.
// Ein einziger Render-Crash in Stage/SaunaTileColumn/InfusionCard machte die TV-Tafel
// auf 24/7-85"-TV weiß bis manueller Reload. Grenzen (Stand Audit 25.09.2026):
// App-Root, die Tafel als Ganzes (/dashboard, TafelErrorFallback) und auf der
// Bühne jede Szene und jeder Effekt einzeln (Stage.tsx) — eine kaputte Szene
// reißt die Tafel nicht mehr mit. Die Sauna-Spalten haben KEINE eigene Grenze.

import React from 'react';
import { fehlerMelden } from '@/lib/fehlerbericht';

type Props = {
  children: React.ReactNode;
  /** Was im Fehlerfall gerendert wird. Kann auch Function (error, reset)=>JSX sein. */
  fallback?: React.ReactNode | ((err: Error, reset: () => void) => React.ReactNode);
  /** Auto-Reset nach N Millisekunden (default 300_000 = 5 Min). 0 deaktiviert. */
  autoResetMs?: number;
  /** Optionaler Label-String für Logs (welche Boundary hat gefangen?) */
  label?: string;
};

type State = { error: Error | null; resetKey: number };

/** Fehlt nach einem Deploy ein Programmteil (Lazy-Chunk)? Dann hilft kein
 *  Zurücksetzen — React.lazy merkt sich den Ladefehler —, nur Neuladen.
 *  Meldungen von Chrome, Firefox, Safari und Vites CSS-Preload. */
function istChunkFehler(err: Error): boolean {
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS|Failed to load module script/i
    .test(err?.message ?? '');
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, resetKey: 0 };
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', this.props.label ?? '(unnamed)', error, info.componentStack);
    // Gedrosselt an den Server melden (Audit 25.09.2026) — sonst bemerkt einen
    // Absturz auf Tafel oder Tablet niemand, weil die Grenze still zurücksetzt.
    fehlerMelden(`grenze:${this.props.label ?? 'ohne Namen'}`, error);
    // Auto-Reset planen (für 24/7-Tafel: nach 5 Min wieder versuchen)
    const ms = this.props.autoResetMs ?? 300_000;
    if (ms > 0) {
      if (this.resetTimer) clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => this.reset(), ms);
    }
  }

  componentWillUnmount(): void {
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  reset = (): void => {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));
  };

  render(): React.ReactNode {
    if (this.state.error) {
      const fb = this.props.fallback;
      if (typeof fb === 'function') return fb(this.state.error, this.reset);
      if (fb) return fb;
      const chunkFehler = istChunkFehler(this.state.error);
      return (
        <div className="grid min-h-[200px] place-items-center p-6 text-center">
          <div className="max-w-sm rounded-2xl bg-rose-950/40 p-4 ring-1 ring-rose-800/40">
            <p className="text-rose-200 text-sm">
              {chunkFehler
                ? '⚠️ Ein Teil der App ließ sich nicht laden — meist nach einem App-Update oder bei schwachem Netz. Bitte neu laden.'
                : '⚠️ Ein Teil der Ansicht konnte nicht geladen werden.'}
            </p>
            <button
              onClick={chunkFehler ? () => window.location.reload() : this.reset}
              className="mt-3 rounded-lg bg-rose-500/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-400"
            >
              {chunkFehler ? 'Neu laden' : 'Erneut versuchen'}
            </button>
          </div>
        </div>
      );
    }
    // key bumpen damit React den Subtree komplett neu mounted nach Reset
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

/** Zeitpunkte der letzten Tafel-Abstürze (für „stürzt immer wieder ab"). */
let tafelAbstuerze: number[] = [];
const TAFEL_NEULADEN_KEY = 'tafel-neuladen-um';
const TAFEL_NEULADEN_SPERRE_MS = 10 * 60_000;

/** Einmal neu laden — höchstens alle 10 min (Schleifenschutz). Ohne Netz oder
 *  ohne sessionStorage gar nicht; dann bleibt es beim Zurücksetzen. */
function tafelNeuLaden(): boolean {
  if (!navigator.onLine) return false;
  try {
    const zuletzt = Number(sessionStorage.getItem(TAFEL_NEULADEN_KEY) ?? '0');
    if (Date.now() - zuletzt < TAFEL_NEULADEN_SPERRE_MS) return false;
    sessionStorage.setItem(TAFEL_NEULADEN_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Spezialisierter Fallback für die TV-Tafel: minimal, kein interaktiver Button.
 *  Nach 60 s geht es von selbst weiter, damit ein einmaliger Render-Bug die
 *  Tafel nicht für Stunden lahmlegt:
 *   • fehlt ein Programmteil (Lazy-Chunk) oder stürzt die Tafel binnen 10 min
 *     zum dritten Mal ab → neu laden. React.lazy merkt sich einen Ladefehler;
 *     bloßes Zurücksetzen hing sonst endlos in „Tafel lädt neu …" (Audit
 *     25.09.2026). Schleifenschutz: höchstens ein Neuladen je 10 min.
 *   • sonst → zurücksetzen (Subtree neu aufbauen).
 *  Die umgebende Grenze braucht autoResetMs={0} — ihr eigener 60-s-Timer käme
 *  diesem sonst zuvor und das Neuladen fände nie statt. */
export function TafelErrorFallback({ error, reset }: { error: Error; reset: () => void }): React.ReactElement {
  React.useEffect(() => {
    const jetzt = Date.now();
    tafelAbstuerze = [...tafelAbstuerze.filter((t) => jetzt - t < TAFEL_NEULADEN_SPERRE_MS), jetzt];
    const t = setTimeout(() => {
      if ((istChunkFehler(error) || tafelAbstuerze.length >= 3) && tafelNeuLaden()) return;
      reset();
    }, 60_000);
    return () => clearTimeout(t);
  }, [error, reset]);
  return (
    <div className="fixed inset-0 grid place-items-center bg-forest-950 text-forest-300/60">
      <div className="text-center">
        <div className="text-6xl mb-4">⏳</div>
        <div className="text-sm">Tafel lädt neu …</div>
      </div>
    </div>
  );
}
