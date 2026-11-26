import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Search, X } from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan Trolley QR Code',
}) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onCloseRef = useRef(onClose);
  const onScanSuccessRef = useRef(onScanSuccess);
  onCloseRef.current = onClose;
  onScanSuccessRef.current = onScanSuccess;
  const containerId = 'masl-qr-reader';

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setCameraError(null);

    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            if (!mounted) return;
            onScanSuccessRef.current(decodedText.trim());
            onCloseRef.current();
          },
          () => {
            // Ignore frame decode errors while scanning
          }
        );
      } catch (err) {
        if (mounted) {
          setCameraError(
            err instanceof Error
              ? 'Camera access unavailable or permission denied. Enter the Trolley Number or QR tag manually below.'
              : 'Unable to start camera scanner.'
          );
        }
      }
    };

    const timer = setTimeout(startScanner, 150);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onScanSuccess(manualCode.trim());
    setManualCode('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden shadow-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <Camera className="w-5 h-5 text-[#D71920]" />
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Close scanner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-950 min-h-[240px] flex items-center justify-center">
            <div id={containerId} className="w-full" />
            {cameraError && (
              <div className="p-4 text-center text-xs text-slate-300 leading-relaxed">
                {cameraError}
              </div>
            )}
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="block text-xs font-medium text-slate-600">
              Manual Trolley / QR Tag Lookup
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. TR-MASL-101 or MASL-QR-101"
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D71920]/20 focus:border-[#D71920]"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#D71920] rounded-lg hover:bg-[#B8141A] transition-colors whitespace-nowrap shrink-0"
              >
                <Search className="w-4 h-4" />
                Lookup
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
