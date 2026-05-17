import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// Tafel-Overlay für die Mitglieder-Präsentation: riesiger QR-Code mittig auf
// dunklem Backdrop. Mitglieder scannen mit eigenem Handy und kommen auf /tour.
//
// Wird als normale Scene im Admin-Tab „🎭 Bühne" aktiviert/deaktiviert
// (Eintrag „welcome-qr" im SCENE_REGISTRY).

const TOUR_URL = 'https://saunascaner.vercel.app/tour';

export default function WelcomeTourQrScene() {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(TOUR_URL, {
      width: 480,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null));
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 80,
        background: 'radial-gradient(ellipse at center, rgba(2,6,12,0.78) 0%, rgba(2,6,12,0.92) 80%)',
        backdropFilter: 'blur(8px)',
      }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes wq-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(251,191,36,0.4), 0 20px 60px rgba(0,0,0,0.5); }
          50%      { transform: scale(1.02); box-shadow: 0 0 0 18px rgba(251,191,36,0), 0 24px 80px rgba(251,191,36,0.25); }
        }
        @keyframes wq-fade-in {
          0%   { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .wq-card {
          animation: wq-fade-in 0.6s ease-out forwards, wq-pulse 3.5s ease-in-out 0.6s infinite;
          will-change: transform, box-shadow, opacity;
        }
        @media (prefers-reduced-motion: reduce) {
          .wq-card { animation: none; }
        }
      `}</style>

      <div className="flex flex-col items-center gap-8 text-center">
        <div>
          <div className="text-7xl mb-3" aria-hidden>🎉</div>
          <h1 className="text-5xl font-bold text-white tracking-tight">
            Willkommen!
          </h1>
        </div>

        <div className="wq-card rounded-3xl bg-white p-8 ring-4 ring-amber-400/40">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR-Code zur Tour"
              className="block"
              width={480}
              height={480}
            />
          ) : (
            <div className="w-[480px] h-[480px] flex items-center justify-center text-slate-500">
              Lade QR-Code…
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <p className="text-2xl text-amber-200 font-semibold">
            📱 Scan mit deinem Handy für eine kurze Tour
          </p>
          <p className="text-base text-white/70 font-mono tracking-wide">
            saunascaner.vercel.app/tour
          </p>
        </div>
      </div>
    </div>
  );
}
