import React, { useEffect } from 'react';
import { Scanner as QrScanner } from '@yudiel/react-qr-scanner';

interface ScannerProps {
  onScan: (text: string) => void;
  isScanning: boolean;
  onStateChange?: (state: 'scanning' | 'idle') => void;
}

export const Scanner: React.FC<ScannerProps> = ({ onScan, isScanning, onStateChange }) => {
  useEffect(() => {
    if (isScanning) {
      onStateChange?.('scanning');
    } else {
      onStateChange?.('idle');
    }
  }, [isScanning, onStateChange]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-forest-950 shadow-inner border border-white/5">
      <div className="w-full min-h-[380px] flex items-center justify-center">
        {isScanning ? (
          <QrScanner
            onScan={(result) => {
              if (result && result.length > 0) {
                onScan(result[0].rawValue);
              }
            }}
            onError={(error) => {
              console.error('QR Scanner error:', error);
            }}
            formats={['qr_code']}
            styles={{
              container: { width: '100%', height: '100%' },
              video: { objectFit: 'cover' }
            }}
          />
        ) : (
          <div className="text-cream-100/40 font-medium">Kamera pausiert</div>
        )}
      </div>
      
      {/* Overlay UI */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
        <div className="relative w-[280px] h-[280px]">
          {/* Corners */}
          <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-moss-500 rounded-tl-2xl drop-shadow-[0_0_8px_rgba(94,123,87,0.5)]" />
          <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-moss-500 rounded-tr-2xl drop-shadow-[0_0_8px_rgba(94,123,87,0.5)]" />
          <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-moss-500 rounded-bl-2xl drop-shadow-[0_0_8px_rgba(94,123,87,0.5)]" />
          <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-moss-500 rounded-br-2xl drop-shadow-[0_0_8px_rgba(94,123,87,0.5)]" />
          
          {/* Scanning Line */}
          {isScanning && (
            <div className="absolute left-4 right-4 h-0.5 bg-moss-500/80 shadow-[0_0_15px_rgba(94,123,87,0.8)] animate-[scan_2s_linear_infinite]" />
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 10%; opacity: 0.5; }
          50% { opacity: 1; }
          100% { top: 90%; opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};
