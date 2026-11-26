import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, X } from 'lucide-react';
import { Asset } from '../types';
import { MahindraAcceloLogo } from './MahindraAcceloLogo';

interface QrLabelModalProps {
  asset: Asset | null;
  onClose: () => void;
}

export const QrLabelModal: React.FC<QrLabelModalProps> = ({ asset, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!asset) return;
    const payload = asset.qrCode || asset.trolleyNumber;
    QRCode.toDataURL(payload, {
      width: 240,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('QR generation failed:', err));
  }, [asset]);

  if (!asset) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm overflow-hidden shadow-lg">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 no-print">
          <h3 className="text-sm font-semibold text-slate-900">Trolley Asset QR Tag</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center text-center">
          <MahindraAcceloLogo className="mb-4" />

          {qrDataUrl && (
            <div className="p-3 bg-white border border-slate-200 rounded-lg mb-4">
              <img
                src={qrDataUrl}
                alt={`QR Code for ${asset.trolleyNumber}`}
                className="w-44 h-44"
              />
            </div>
          )}

          <p className="font-mono text-lg font-bold text-slate-900">{asset.trolleyNumber}</p>
          <p className="text-sm font-medium text-slate-700 mt-0.5">{asset.name}</p>
          <p className="text-xs text-slate-500 mt-2">
            Line: <span className="font-mono font-medium text-slate-700">{asset.shopCode}</span>
            {asset.partNumber && (
              <>
                {' '}
                · Part: <span className="font-mono font-medium text-slate-700">{asset.partNumber}</span>
              </>
            )}
          </p>
          <p className="font-mono text-[11px] text-slate-400 mt-1">{asset.qrCode}</p>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Tag
          </button>
        </div>
      </div>
    </div>
  );
};
