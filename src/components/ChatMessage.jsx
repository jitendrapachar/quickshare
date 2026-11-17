import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { FILE_EXPIRY_MINUTES, formatFileSize } from '../lib/utils';
import { FileText, Download, Clock, AlertCircle, Flag, Ban, Loader2 } from 'lucide-react';

export default function ChatMessage({ message, isMe, onBlockUser, onReportMessage, onError }) {
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const hasFile = Boolean(message.file_path);

  useEffect(() => {
    if (!hasFile) return;

    const expiryTime = new Date(message.created_at).getTime() + FILE_EXPIRY_MINUTES * 60 * 1000;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [hasFile, message.created_at]);

  const isExpired = hasFile && secondsLeft !== null && secondsLeft <= 0;

  const formatCountdown = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleDownload = async () => {
    if (isExpired || downloading) return;
    setDownloading(true);

    try {
      const { data, error } = await supabase.storage
        .from('quickshare-files')
        .createSignedUrl(message.file_path, 60);

      if (error || !data?.signedUrl) {
        onError('This file has expired and is no longer available for download.');
        setSecondsLeft(0);
        setDownloading(false);
        return;
      }

      const response = await fetch(data.signedUrl);
      if (!response.ok) {
        onError('File already expired or deleted from server.');
        setSecondsLeft(0);
        setDownloading(false);
        return;
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = message.file_name || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      onError('Download failed. Please check your connection and try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`group flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
      {/* Sender & Time */}
      <div className="flex items-center gap-2 mb-1 px-1">
        <span className="text-xs font-medium text-slate-600">
          {isMe ? 'You' : message.sender_name}
        </span>
        <span className="text-[11px] text-slate-400">
          {format(new Date(message.created_at), 'h:mm a')}
        </span>

        {!isMe && (
          <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-1 transition-opacity">
            <button
              onClick={() => onReportMessage(message)}
              title="Report message"
              className="p-0.5 text-slate-400 hover:text-amber-600 rounded"
            >
              <Flag size={12} />
            </button>
            <button
              onClick={() => onBlockUser(message.sender_name)}
              title={`Block ${message.sender_name}`}
              className="p-0.5 text-slate-400 hover:text-red-600 rounded"
            >
              <Ban size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Message Bubble */}
      <div
        className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 border ${
          isMe
            ? 'bg-blue-600 text-white border-blue-600 rounded-tr-xs'
            : 'bg-white text-slate-900 border-slate-200 rounded-tl-xs shadow-2xs'
        }`}
      >
        {message.content && (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
        )}

        {/* File Attachment Card */}
        {hasFile && (
          <div
            className={`${message.content ? 'mt-2.5 pt-2.5 border-t' : ''} ${
              isMe ? 'border-blue-500' : 'border-slate-100'
            }`}
          >
            {isExpired ? (
              <div
                className={`flex items-center gap-2.5 p-2.5 rounded-xl text-xs ${
                  isMe ? 'bg-blue-700/60 text-blue-100' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <AlertCircle size={16} className="shrink-0" />
                <div>
                  <p className="font-medium line-through">{message.file_name}</p>
                  <p>File expired after 10 minutes and was permanently deleted.</p>
                </div>
              </div>
            ) : (
              <div
                className={`flex items-center gap-3 p-2.5 rounded-xl ${
                  isMe ? 'bg-blue-700/60' : 'bg-slate-50 border border-slate-200/80'
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    isMe ? 'bg-blue-500/50 text-white' : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  <FileText size={20} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={message.file_name}>
                    {message.file_name}
                  </p>
                  <div
                    className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] mt-0.5 ${
                      isMe ? 'text-blue-100' : 'text-slate-500'
                    }`}
                  >
                    <span>{formatFileSize(message.file_size)}</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Clock size={11} />
                      {secondsLeft !== null ? `Expires in ${formatCountdown(secondsLeft)}` : '10:00'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  title="Download file"
                  className={`p-2 rounded-xl transition shrink-0 ${
                    isMe
                      ? 'bg-white text-blue-600 hover:bg-blue-50'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } disabled:opacity-50`}
                >
                  {downloading ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Download size={17} />
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
