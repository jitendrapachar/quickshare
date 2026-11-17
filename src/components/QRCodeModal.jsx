import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Copy, Check, Download, Share2 } from 'lucide-react';

export default function QRCodeModal({ roomUrl, shortId, onClose }) {
  const [copied, setCopied] = useState(false);
  const qrWrapperRef = useRef(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Copy failed. Please copy the URL from your browser address bar.');
    }
  };

  const handleDownloadQR = () => {
    const canvas = qrWrapperRef.current?.querySelector('canvas');
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = `QuickShare-Room-${shortId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join QuickShare Room ${shortId}`,
          text: 'Join my temporary QuickShare room to chat and share files:',
          url: roomUrl,
        });
      } catch {
        // User cancelled share dialog
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl shadow-lg w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-lg text-slate-900">Invite to Room</h3>
            <p className="text-xs text-slate-500">Room ID: {shortId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* QR Code */}
        <div
          ref={qrWrapperRef}
          className="flex flex-col items-center justify-center p-5 bg-slate-50 border border-slate-200 rounded-xl mb-4"
        >
          <QRCodeCanvas
            value={roomUrl}
            size={210}
            level="H"
            marginSize={2}
            bgColor="#ffffff"
            fgColor="#0f172a"
          />
          <p className="text-xs text-slate-500 mt-3 text-center">
            Scan with your phone camera to join instantly
          </p>
        </div>

        {/* Room URL Box */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 mb-4">
          <input
            type="text"
            readOnly
            value={roomUrl}
            className="flex-1 bg-transparent text-xs text-slate-600 px-2 outline-none truncate"
          />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-medium px-3 py-1.5 rounded-lg transition shrink-0"
          >
            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={handleDownloadQR}
            className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium py-2.5 px-3 rounded-xl transition"
          >
            <Download size={16} />
            <span>Save QR</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 px-3 rounded-xl transition"
          >
            <Share2 size={16} />
            <span>Share Link</span>
          </button>
        </div>
      </div>
    </div>
  );
}
