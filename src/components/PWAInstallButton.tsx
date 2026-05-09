import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY = 'saunafreunde-install-dismissed';

/**
 * Android/Chromium: zeigt einen "App installieren"-Button wenn der Browser bereit ist.
 * iOS: zeigt eine Anleitung (kein nativer Prompt verfügbar).
 * Versteckt sich wenn die App schon als PWA läuft oder der User die Aufforderung weggeklickt hat.
 */
export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(STORAGE_KEY));

  useEffect(() => {
    // Schon als PWA?
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error iOS-Sonderkennung
      window.navigator.standalone === true;
    if (standalone) { setInstalled(true); return; }

    // iOS-Detection (kein beforeinstallprompt-Event auf iOS)
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
    setIsIOS(ios);

    // Android/Chromium: beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);

    const installedHandler = () => setInstalled(true);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  if (installed) return null;
  if (dismissed) return null;

  // Android: nativer Prompt verfügbar
  if (deferredPrompt) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-emerald-900/40 to-forest-950/60 ring-1 ring-emerald-500/40 p-4 flex items-center gap-3">
        <div className="text-3xl shrink-0">📲</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-emerald-200">App installieren</h3>
          <p className="text-xs text-emerald-300/80 mt-0.5">Schneller Zugriff vom Home-Screen + Push-Benachrichtigungen.</p>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={async () => {
              await deferredPrompt.prompt();
              const choice = await deferredPrompt.userChoice;
              if (choice.outcome === 'accepted') setInstalled(true);
              setDeferredPrompt(null);
            }}
            className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 text-xs font-bold text-emerald-950"
          >
            Installieren
          </button>
          <button
            onClick={() => { localStorage.setItem(STORAGE_KEY, '1'); setDismissed(true); }}
            className="text-[10px] text-emerald-300/60 hover:text-emerald-300"
          >
            später
          </button>
        </div>
      </div>
    );
  }

  // iOS: Anleitung statt Prompt
  if (isIOS) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-emerald-900/40 to-forest-950/60 ring-1 ring-emerald-500/40 p-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl shrink-0">📱</div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-emerald-200">App auf iPhone hinzufügen</h3>
            <button
              onClick={() => setShowIOSHint(!showIOSHint)}
              className="text-xs text-emerald-300 hover:underline mt-0.5"
            >
              {showIOSHint ? 'Anleitung ausblenden' : 'So geht\'s →'}
            </button>
          </div>
          <button
            onClick={() => { localStorage.setItem(STORAGE_KEY, '1'); setDismissed(true); }}
            className="text-[10px] text-emerald-300/60 hover:text-emerald-300 shrink-0"
          >
            später
          </button>
        </div>
        {showIOSHint && (
          <ol className="mt-3 space-y-1.5 text-xs text-emerald-200 list-decimal list-inside">
            <li>Tippe unten in Safari auf das <strong>Teilen-Symbol</strong> (Quadrat mit Pfeil ↑)</li>
            <li>Scrolle runter zu „<strong>Zum Home-Bildschirm</strong>"</li>
            <li>Bestätige oben rechts mit „<strong>Hinzufügen</strong>"</li>
            <li>Push-Benachrichtigungen funktionieren erst nach dieser Installation.</li>
          </ol>
        )}
      </div>
    );
  }

  return null;
}
