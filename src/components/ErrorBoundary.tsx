// FIX 0107 (Audit Phase 4 CRITICAL): vorher NULL ErrorBoundaries in der ganzen App.
// Ein einziger Render-Crash in Stage/SaunaTileColumn/InfusionCard machte die TV-Tafel
// auf 24/7-85"-TV weiß bis manueller Reload. Jetzt: jeder Subtree (Dashboard, Stage,
// Spalten) hat seine eigene Boundary mit Auto-Recovery alle 5 Min.

import React from 'react';

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

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, resetKey: 0 };
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', this.props.label ?? '(unnamed)', error, info.componentStack);
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
      return (
        <div className="grid min-h-[200px] place-items-center p-6 text-center">
          <div className="max-w-sm rounded-2xl bg-rose-950/40 p-4 ring-1 ring-rose-800/40">
            <p className="text-rose-200 text-sm">
              ⚠️ Ein Teil der Ansicht konnte nicht geladen werden.
            </p>
            <button
              onClick={this.reset}
              className="mt-3 rounded-lg bg-rose-500/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-400"
            >
              Erneut versuchen
            </button>
          </div>
        </div>
      );
    }
    // key bumpen damit React den Subtree komplett neu mounted nach Reset
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

/** Spezialisierter Fallback für die TV-Tafel: minimal, kein interaktiver Button.
 *  Auto-Reset nach 60s, damit ein einmaliger Render-Bug die Tafel nicht für
 *  Stunden lahmlegt. */
export function TafelErrorFallback({ reset }: { error: Error; reset: () => void }): React.ReactElement {
  React.useEffect(() => {
    const t = setTimeout(reset, 60_000);
    return () => clearTimeout(t);
  }, [reset]);
  return (
    <div className="fixed inset-0 grid place-items-center bg-forest-950 text-forest-300/60">
      <div className="text-center">
        <div className="text-6xl mb-4">⏳</div>
        <div className="text-sm">Tafel lädt neu …</div>
      </div>
    </div>
  );
}
