import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { generateRoomId } from '../lib/utils';
import { Zap, ArrowRight, ShieldCheck, Clock, AlertCircle, Loader2 } from 'lucide-react';

export default function Home() {
  const [joinId, setJoinId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreateRoom = async () => {
    setError('');
    setLoading(true);

    try {
      const shortId = generateRoomId(8);
      const { error: insertError } = await supabase
        .from('rooms')
        .insert([{ short_id: shortId }]);

      if (insertError) throw insertError;

      // Mark this browser as the room creator
      localStorage.setItem(`quickshare_creator_${shortId}`, 'true');
      navigate(`/room/${shortId}`);
    } catch (err) {
      setError('Could not create room. Please check your connection and try again.');
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    setError('');
    const cleanedId = joinId.trim().toUpperCase();

    if (!cleanedId) {
      setError('Please enter a valid Room ID.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('rooms')
        .select('short_id')
        .eq('short_id', cleanedId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (fetchError || !data) {
        setError('Room not found or has already expired.');
        setLoading(false);
        return;
      }

      navigate(`/room/${cleanedId}`);
    } catch {
      setError('Unable to verify room. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50">
      {/* Top Navbar */}
      <header className="w-full max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm">
            <Zap size={20} />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">QuickShare</span>
        </div>
        <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-full">
          Free • No Sign-Up Required
        </span>
      </header>

      {/* Main Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2.5">
              Share instantly. No account. No hassle.
            </h1>
            <p className="text-slate-500 text-sm sm:text-base">
              Create a temporary room and share files and messages with anyone.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Create New Room */}
          <button
            onClick={handleCreateRoom}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3.5 px-5 rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Creating Room...</span>
              </>
            ) : (
              <>
                <span>Create New Room</span>
                <ArrowRight size={19} />
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative flex items-center my-6">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="mx-3 text-xs uppercase tracking-wider text-slate-400 font-medium">
              or join with ID
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Join Existing Room */}
          <form onSubmit={handleJoinRoom} className="flex gap-2">
            <input
              type="text"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.toUpperCase())}
              placeholder="Enter Room ID (e.g. AB82KX92)"
              maxLength={10}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono uppercase tracking-wider placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
            <button
              type="submit"
              disabled={loading || !joinId.trim()}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-5 py-3 rounded-xl text-sm font-semibold transition"
            >
              Join Room
            </button>
          </form>

          {/* Automatic Deletion Notice */}
          <div className="mt-7 pt-6 border-t border-slate-100 space-y-2.5">
            <div className="flex items-start gap-2.5 text-xs text-slate-600">
              <Clock size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Automatic File Deletion:</strong> Every uploaded file is permanently erased from our servers <strong>10 minutes</strong> after upload.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-600">
              <ShieldCheck size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Ephemeral Chat:</strong> Messages auto-delete after 1 hour, and room creators can close a room anytime.
              </span>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-400">
        QuickShare • Temporary Group Chat & File Sharing
      </footer>
    </div>
  );
}
