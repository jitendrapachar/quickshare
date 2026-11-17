import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  validateFile,
  MAX_FILES_PER_BATCH,
  MAX_FILE_SIZE_MB,
  ALLOWED_EXTENSIONS,
} from '../lib/utils';
import ChatMessage from '../components/ChatMessage';
import QRCodeModal from '../components/QRCodeModal';
import {
  Zap,
  Copy,
  Check,
  QrCode,
  Users,
  LogOut,
  XCircle,
  Send,
  Paperclip,
  AlertCircle,
  WifiOff,
  Loader2,
  X,
} from 'lucide-react';

export default function Room() {
  const { shortId } = useParams();
  const normalizedId = shortId?.toUpperCase();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [roomError, setRoomError] = useState('');

  const [displayName, setDisplayName] = useState(
    localStorage.getItem('quickshare_display_name') || ''
  );
  const [hasJoined, setHasJoined] = useState(false);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(0);

  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadProgressText, setUploadProgressText] = useState('');

  const [onlineMembers, setOnlineMembers] = useState([]);
  const [showMembers, setShowMembers] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [blockedUsers, setBlockedUsers] = useState([]);
  const [bannerError, setBannerError] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [realtimeStatus, setRealtimeStatus] = useState('SUBSCRIBED');

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const sessionKeyRef = useRef(crypto.randomUUID());

  const isCreator = localStorage.getItem(`quickshare_creator_${normalizedId}`) === 'true';
  const roomUrl = window.location.href;

  // Monitor browser internet connectivity
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Verify room exists & is active
  useEffect(() => {
    let active = true;

    const loadRoom = async () => {
      setLoadingRoom(true);
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('short_id', normalizedId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!active) return;

      if (error || !data) {
        setRoomError('This room does not exist, was closed by its creator, or has expired.');
        setLoadingRoom(false);
        return;
      }

      setRoom(data);
      setLoadingRoom(false);
    };

    loadRoom();
    return () => {
      active = false;
    };
  }, [normalizedId]);

  // Subscribe to messages, room status & live presence after joining
  useEffect(() => {
    if (!room || !hasJoined) return;

    let channel;

    const setupRealtime = async () => {
      // Load existing non-expired messages
      const { data: existingMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', room.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (existingMessages) {
        setMessages(existingMessages);
      }

      channel = supabase.channel(`room:${room.id}`, {
        config: {
          presence: { key: sessionKeyRef.current },
        },
      });

      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${room.id}`,
          },
          (payload) => {
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${room.id}`,
          },
          (payload) => {
            if (!payload.new.is_active) {
              alert('This room has been closed by the creator.');
              navigate('/');
            }
          }
        )
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const members = Object.values(state)
            .flat()
            .map((entry) => entry.name);
          setOnlineMembers(members);
        })
        .subscribe(async (status) => {
          setRealtimeStatus(status);
          if (status === 'SUBSCRIBED') {
            await channel.track({
              name: displayName,
              joined_at: new Date().toISOString(),
            });
          }
        });
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [room, hasJoined, displayName, navigate]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const showTempError = (msg) => {
    setBannerError(msg);
    setTimeout(() => {
      setBannerError((current) => (current === msg ? '' : current));
    }, 6000);
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) return;
    localStorage.setItem('quickshare_display_name', trimmed);
    setDisplayName(trimmed);
    setHasJoined(true);
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed || sending) return;

    // Simple rate limit (700ms cooldown)
    if (Date.now() - lastSentAt < 700) {
      showTempError('You are sending messages too quickly. Please wait a moment.');
      return;
    }

    setSending(true);
    setNewMessage('');
    setLastSentAt(Date.now());

    const { error } = await supabase.from('messages').insert([
      {
        room_id: room.id,
        sender_name: displayName,
        content: trimmed,
      },
    ]);

    if (error) {
      showTempError('Failed to send message. The room may have expired.');
      setNewMessage(trimmed);
    }

    setSending(false);
  };

  const handleFilesSelected = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    e.target.value = '';
    if (selectedFiles.length === 0) return;

    if (selectedFiles.length > MAX_FILES_PER_BATCH) {
      showTempError(`You can upload up to ${MAX_FILES_PER_BATCH} files at once.`);
      return;
    }

    if (uploadingCount > 0) {
      showTempError('Please wait for your current upload to finish.');
      return;
    }

    // Validate all files first
    for (const file of selectedFiles) {
      const validationError = validateFile(file);
      if (validationError) {
        showTempError(validationError);
        return;
      }
    }

    setUploadingCount(selectedFiles.length);

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setUploadProgressText(
        `Uploading ${i + 1} of ${selectedFiles.length}: ${file.name}...`
      );

      const safeExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const storagePath = `${room.id}/${crypto.randomUUID()}.${safeExt}`;

      const { error: uploadError } = await supabase.storage
        .from('quickshare-files')
        .upload(storagePath, file, {
          cacheControl: '600',
          upsert: false,
        });

      if (uploadError) {
        if (uploadError.message?.toLowerCase().includes('quota')) {
          showTempError('Storage quota reached. Cannot upload files right now.');
        } else {
          showTempError(`Upload failed for "${file.name}": ${uploadError.message}`);
        }
        continue;
      }

      const { error: msgError } = await supabase.from('messages').insert([
        {
          room_id: room.id,
          sender_name: displayName,
          file_path: storagePath,
          file_name: file.name,
          file_size: file.size,
        },
      ]);

      if (msgError) {
        showTempError(`Uploaded "${file.name}", but failed to post to chat.`);
      }
    }

    setUploadingCount(0);
    setUploadProgressText('');
  };

  const handleCopyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      showTempError('Could not copy link. Copy the URL from your browser bar.');
    }
  };

  const handleCloseRoom = async () => {
    const confirmed = window.confirm(
      'Close this room permanently for all members? No one will be able to rejoin.'
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from('rooms')
      .update({ is_active: false })
      .eq('id', room.id);

    if (error) {
      showTempError('Permission denied or unable to close room.');
      return;
    }

    navigate('/');
  };

  const handleBlockUser = (userName) => {
    if (window.confirm(`Hide all messages from "${userName}"?`)) {
      setBlockedUsers((prev) => [...new Set([...prev, userName])]);
    }
  };

  const handleReportMessage = (msg) => {
    alert(
      `Message from "${msg.sender_name}" has been flagged for moderation. You can also block this participant.`
    );
  };

  // Loading Screen
  if (loadingRoom) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <Loader2 size={32} className="text-blue-600 animate-spin" />
        <p className="text-sm text-slate-500">Connecting to room {normalizedId}...</p>
      </div>
    );
  }

  // Room Not Found / Expired Screen
  if (roomError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Room Unavailable</h2>
          <p className="text-sm text-slate-500 mb-6">{roomError}</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition"
          >
            Back to Homepage
          </Link>
        </div>
      </div>
    );
  }

  // Display Name Prompt before joining
  if (!hasJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl p-7 shadow-sm">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-lg mb-4">
            <Zap size={22} />
            <span>QuickShare</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">
            Join Room <span className="font-mono text-blue-600">{normalizedId}</span>
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Choose a display name so others know who is sharing.
          </p>

          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Your Display Name
              </label>
              <input
                autoFocus
                type="text"
                maxLength={30}
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={!displayName.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
            >
              Enter Room
            </button>
          </form>
        </div>
      </div>
    );
  }

  const visibleMessages = messages.filter((m) => !blockedUsers.includes(m.sender_name));

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto bg-white sm:border-x border-slate-200">
      {/* Room Header */}
      <header className="px-4 sm:px-6 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0"
            title="QuickShare Home"
          >
            <Zap size={19} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm sm:text-base">QuickShare</span>
              <span className="font-mono text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                {normalizedId}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Files auto-delete in 10m • Messages in 1h
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleCopyRoomLink}
            className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl transition"
            title="Copy Room Link"
          >
            {copiedLink ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
            <span className="hidden sm:inline">{copiedLink ? 'Copied' : 'Copy Link'}</span>
          </button>

          <button
            onClick={() => setShowQR(true)}
            className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl transition"
            title="Show QR Code"
          >
            <QrCode size={15} />
            <span className="hidden sm:inline">QR Code</span>
          </button>

          <button
            onClick={() => setShowMembers(!showMembers)}
            className="flex items-center gap-1.5 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-xl transition"
            title="Online Members"
          >
            <Users size={15} />
            <span>{Math.max(1, onlineMembers.length)}</span>
          </button>

          {isCreator && (
            <button
              onClick={handleCloseRoom}
              className="flex items-center gap-1.5 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-xl transition"
              title="Close Room Permanently"
            >
              <XCircle size={15} />
              <span className="hidden md:inline">Close Room</span>
            </button>
          )}

          <button
            onClick={() => navigate('/')}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            title="Leave Room"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {/* Active Participants Drawer */}
      {showMembers && (
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Online now:</span>
            {onlineMembers.length > 0 ? (
              onlineMembers.map((member, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-full text-slate-700"
                >
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  {member}
                </span>
              ))
            ) : (
              <span className="text-slate-500">{displayName} (You)</span>
            )}
          </div>
          <button
            onClick={() => setShowMembers(false)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Offline / Reconnecting Alert */}
      {(!isOnline || realtimeStatus === 'CHANNEL_ERROR' || realtimeStatus === 'TIMED_OUT') && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs flex items-center justify-center gap-2">
          <WifiOff size={14} />
          <span>Connection lost. Reconnecting automatically...</span>
        </div>
      )}

      {/* Error Alert Banner */}
      {bannerError && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 text-red-700 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{bannerError}</span>
          </div>
          <button onClick={() => setBannerError('')} className="text-red-500 hover:text-red-700">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Chat Messages Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/70 space-y-4">
        {visibleMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto py-12">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-3">
              <Zap size={24} />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Room {normalizedId} is ready</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Share the room link or QR code to invite others. Send messages or attach files up to{' '}
              {MAX_FILE_SIZE_MB} MB (auto-deleted after 10 minutes).
            </p>
          </div>
        ) : (
          visibleMessages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isMe={msg.sender_name === displayName}
              onBlockUser={handleBlockUser}
              onReportMessage={handleReportMessage}
              onError={showTempError}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Upload Progress Indicator */}
      {uploadingCount > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center gap-2.5 text-xs text-blue-700">
          <Loader2 size={15} className="animate-spin shrink-0" />
          <span className="truncate font-medium">{uploadProgressText}</span>
        </div>
      )}

      {/* Message & File Input Bar */}
      <footer className="p-3 sm:p-4 bg-white border-t border-slate-200">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',')}
            onChange={handleFilesSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingCount > 0}
            title={`Attach files (Max ${MAX_FILE_SIZE_MB}MB each)`}
            className="p-3 text-slate-500 hover:text-blue-600 hover:bg-slate-100 disabled:opacity-50 rounded-xl transition shrink-0"
          >
            <Paperclip size={20} />
          </button>

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message and press Enter..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />

          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition shrink-0"
            title="Send message"
          >
            <Send size={20} />
          </button>
        </form>
      </footer>

      {/* QR Code Modal */}
      {showQR && (
        <QRCodeModal
          roomUrl={roomUrl}
          shortId={normalizedId}
          onClose={() => setShowQR(false)}
        />
      )}
    </div>
  );
}
