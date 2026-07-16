import { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, LogOut, Music2, Plus, X, Play, Pause, SkipForward } from 'lucide-react';
import { useRoom, MAX_MEMBERS } from '../room';
import { usePlayer } from '../player';
import { useCurrentUser } from '../auth';
import { searchSongs } from '../saavn';
import { Artwork } from '../components/Artwork';
import type { Song } from '../types';

export const RoomView = function RoomView() {
  const { roomState, isLoading, error, createRoom, joinRoom, leaveRoom, restoreRoom, playRoom, pauseRoom, setRoomSong } = useRoom();
  const { togglePlay, next, current, isPlaying, playSongs } = usePlayer();
  const user = useCurrentUser();
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [showMemberSelect, setShowMemberSelect] = useState(false);
  const [selectedMemberCount, setSelectedMemberCount] = useState(MAX_MEMBERS);
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSearched, setSearchSearched] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSongIdRef = useRef<string | null>(null);

  const didRestoreRef = useRef(false);

  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;

    const savedRoomId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('vibify-room-id') : null;
    if (savedRoomId && !roomState) {
      restoreRoom(savedRoomId);
    }
  }, [roomState, restoreRoom]);

  const isHost = roomState?.hostId === user.id;
  const isWaiting = roomState?.status === 'waiting';
  const isPlayingRoom = roomState?.status === 'playing';

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3000);
  }, []);

  useEffect(() => {
    if (!roomState?.currentSong) return;
    if (prevSongIdRef.current !== null && prevSongIdRef.current !== roomState.currentSong.id) {
      const host = roomState.members.find(m => m.id === roomState.hostId);
      showToast(`${host?.name || 'Someone'} played ${roomState.currentSong.title}`);
    }
    prevSongIdRef.current = roomState.currentSong.id;
  }, [roomState?.currentSong?.id, roomState?.members, roomState?.hostId]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!q) {
      setSearchResults([]);
      setSearchSearched(false);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    setSearchSearched(false);

    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchSongs(q, 20);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
        setSearchSearched(true);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const handleCreateClick = () => {
    setShowMemberSelect(true);
  };

  const handleMemberSelect = async (count: number) => {
    setSelectedMemberCount(count);
    setShowMemberSelect(false);
    await createRoom(count);
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    const success = await joinRoom(joinCode.trim());
    if (success) {
      setJoinCode('');
    }
  };

  const handleLeave = async () => {
    await leaveRoom();
    setSelectedSong(null);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchSearched(false);
    setSearchLoading(false);
  };

  const handleSelectSong = async (song: Song) => {
    setSelectedSong(song);
    setShowSearch(false);
    setSearchQuery('');
    await setRoomSong(song);
    playSongs([song], song.id);
    if (isWaiting) {
      await playRoom();
    }
  };

  const handleHostToggle = async () => {
    togglePlay();
    if (roomState!.isPlaying) {
      await pauseRoom();
    } else {
      await playRoom();
    }
  };

  const handleSkip = async () => {
    next();
    // The position sync will update the DB with the new song
  };

  // Ensure host plays the song when room transitions to playing
  useEffect(() => {
    if (!isHost || !isPlayingRoom || !roomState?.currentSong) return;
    if (!isPlaying) {
      playSongs([roomState.currentSong], roomState.currentSong.id);
    }
  }, [isPlayingRoom, isHost, roomState?.currentSong, isPlaying, playSongs]);

  // Sync current song changes to DB (e.g. when host skips)
  useEffect(() => {
    if (!isHost || !isPlayingRoom || !current) return;
    if (roomState?.currentSong && current.id !== roomState.currentSong.id) {
      setRoomSong(current);
    }
  }, [current?.id, isPlayingRoom, isHost, roomState?.currentSong?.id, setRoomSong]);

  const copyCode = async () => {
    if (roomState?.code) {
      await navigator.clipboard.writeText(roomState.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Not in room
  if (!roomState) {
    if (showMemberSelect) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-4">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold text-ink-50 sm:text-3xl">Create Room</h2>
            <p className="mt-2 text-sm text-ink-400">How many members can join?</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {[2, 3, 4, 5, 6].map(count => (
              <button
                key={count}
                onClick={() => handleMemberSelect(count)}
                disabled={isLoading}
                className={`flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold transition-all ${
                  count === selectedMemberCount
                    ? 'bg-brand-400 text-ink-950'
                    : 'border border-white/10 text-ink-100 hover:bg-white/5'
                }`}
              >
                {count}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowMemberSelect(false)}
            className="text-sm text-ink-400 hover:text-ink-50"
          >
            Back
          </button>
        </div>
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-4">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-ink-50 sm:text-3xl">Listening Room</h2>
          <p className="mt-2 text-sm text-ink-400">Listen together with friends in real-time</p>
        </div>

        <div className="flex w-full max-w-xs flex-col items-center gap-4">
          <button
            onClick={handleCreateClick}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-400 py-4 text-base font-bold text-ink-950 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <Plus size={20} />
            Create Room
          </button>

          <div className="flex w-full items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-ink-500">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="flex w-full flex-col items-center gap-3">
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter room code"
              maxLength={6}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-center text-lg font-mono tracking-widest text-ink-50 outline-none placeholder:text-ink-500 focus:border-brand-400/50"
            />
            <button
              onClick={handleJoin}
              disabled={isLoading || joinCode.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 py-4 text-base font-semibold text-ink-100 transition-all hover:bg-white/5 active:scale-[0.98] disabled:opacity-50"
            >
              Join Room
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
      </div>
    );
  }

  // Waiting room
  if (isWaiting) {
    const memberSlots = Array.from({ length: roomState!.maxMembers }, (_, i) => roomState!.members[i] || null);
    const gridCols = memberSlots.length <= 2 ? 'grid-cols-2' : memberSlots.length <= 4 ? 'grid-cols-2' : 'grid-cols-3';

    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-4 py-6">
        {toast.visible && (
          <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 animate-fade-in">
            <div className="flex items-center gap-2 rounded-full bg-brand-500/20 px-4 py-2 text-sm font-medium text-brand-300 backdrop-blur-xl">
              <Music2 size={16} />
              {toast.message}
            </div>
          </div>
        )}
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-ink-50 sm:text-3xl">Waiting Room</h2>
          <p className="mt-1 text-sm text-ink-400">Share the code with friends to join</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-ink-400">Room Code</p>
            <p className="font-mono text-2xl font-bold tracking-widest text-ink-50">{roomState!.code}</p>
          </div>
          <button
            onClick={copyCode}
            className="rounded-2xl bg-brand-500/15 p-4 text-brand-300 transition-colors hover:bg-brand-500/25"
            aria-label="Copy code"
          >
            {copied ? <Music2 size={24} /> : <Copy size={24} />}
          </button>
        </div>

        <div className="w-full max-w-sm">
          <p className="mb-3 text-center text-xs font-medium text-ink-400">
            {roomState!.members.length} / {roomState!.maxMembers} listeners
          </p>
          <div className={`grid ${gridCols} gap-3 justify-items-center`}>
            {memberSlots.map((member, idx) => (
              <div key={member?.id || `empty-${idx}`} className="flex flex-col items-center gap-1.5">
                {member ? (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-accent-500 text-lg font-bold text-ink-950 shadow-glow">
                      {member.avatar ? (
                        <img src={member.avatar} alt={member.name} className="h-full w-full rounded-full object-cover" />
                      ) : (
                        member.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="truncate text-xs font-medium text-ink-200">{member.name}</span>
                    {member.id === roomState!.hostId && (
                      <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold text-brand-300">Host</span>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-white/10 text-ink-500">
                      <Plus size={20} />
                    </div>
                    <span className="text-xs text-ink-500">Waiting...</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleLeave}
          className="flex items-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-ink-300 transition-colors hover:bg-white/5 hover:text-ink-50"
        >
          <LogOut size={18} />
          Leave Room
        </button>
      </div>
    );
  }

  // Playing room
  if (isPlayingRoom && roomState!.currentSong) {
    const song = roomState!.currentSong;
    const progress = song.duration > 0 ? (roomState!.position / song.duration) * 100 : 0;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-4 py-6">
        {toast.visible && (
          <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 animate-fade-in">
            <div className="flex items-center gap-2 rounded-full bg-brand-500/20 px-4 py-2 text-sm font-medium text-brand-300 backdrop-blur-xl">
              <Music2 size={16} />
              {toast.message}
            </div>
          </div>
        )}
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-ink-50 sm:text-3xl">Creating Room</h2>
          <p className="mt-1 text-sm text-ink-400">{roomState!.members.length} / {roomState!.maxMembers} listening together</p>
        </div>

        <div className="w-full max-w-xs">
          <Artwork title={song.title} hue={song.hue} hue2={song.hue2} imageUrl={song.imageUrl} className="aspect-square w-full rounded-3xl shadow-2xl" variant="vinyl" />
        </div>

        <div className="w-full max-w-xs space-y-1">
          <h3 className="truncate text-lg font-bold text-ink-50">{song.title}</h3>
          <p className="truncate text-sm text-ink-400">{song.artist}</p>
        </div>

        <div className="w-full max-w-xs space-y-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-brand-400 transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-ink-500">
            <span>{formatTime(roomState!.position)}</span>
            <span>{formatTime(song.duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isHost ? (
            <>
              <button
                onClick={handleHostToggle}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-400 text-ink-950 transition-all hover:scale-[1.05] active:scale-[0.95]"
              >
                {roomState!.isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>
              <button
                onClick={handleSkip}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-ink-100 transition-all hover:bg-white/5"
              >
                <SkipForward size={16} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3">
              <div className={`h-3 w-3 rounded-full ${roomState!.isPlaying ? 'animate-pulse bg-brand-400' : 'bg-ink-600'}`} />
              <p className="text-sm text-ink-300">
                {roomState!.isPlaying ? 'Host is playing' : 'Host paused'}
              </p>
            </div>
          )}
        </div>

        {isHost && (
          <div className="w-full max-w-xs space-y-3">
            {!showSearch && !selectedSong && (
              <button
                onClick={() => setShowSearch(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 py-3.5 text-sm font-semibold text-ink-200 transition-all hover:bg-white/5"
              >
                <Music2 size={18} />
                Search a Song
              </button>
            )}

            {showSearch && (
              <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink-100">Search a song</p>
                  <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="rounded-full p-1 text-ink-400 hover:text-ink-50">
                    <X size={18} />
                  </button>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by title or artist..."
                  autoFocus
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-ink-50 outline-none placeholder:text-ink-500 focus:border-brand-400/50"
                />
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {searchLoading && (
                    <div className="flex items-center justify-center py-6">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
                    </div>
                  )}
                  {!searchLoading && searchResults.map(song => (
                    <button
                      key={song.id}
                      onClick={() => handleSelectSong(song)}
                      className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-white/5"
                    >
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br from-brand-400 to-accent-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-100">{song.title}</p>
                        <p className="truncate text-xs text-ink-400">{song.artist}</p>
                      </div>
                    </button>
                  ))}
                  {!searchLoading && searchSearched && searchResults.length === 0 && (
                    <p className="text-center text-xs text-ink-500">No songs found</p>
                  )}
                </div>
              </div>
            )}

            {selectedSong && (
              <div className="flex items-center justify-between rounded-2xl border border-brand-400/20 bg-brand-500/5 p-4">
                <div className="flex items-center gap-3">
                  <Artwork title={selectedSong.title} hue={selectedSong.hue} hue2={selectedSong.hue2} imageUrl={selectedSong.imageUrl} className="h-12 w-12 rounded-lg" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-50">{selectedSong.title}</p>
                    <p className="truncate text-xs text-ink-400">{selectedSong.artist}</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-brand-300">Playing</span>
              </div>
            )}
          </div>
        )}

        <div className="w-full max-w-xs">
          <p className="mb-3 text-xs font-medium text-ink-400">Listeners</p>
          <div className="flex flex-wrap gap-2.5">
            {roomState!.members.map(member => (
              <div key={member.id} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-1.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-accent-500 text-[11px] font-bold text-ink-950">
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.name} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    member.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-ink-100">{member.name}</p>
                  {member.id === roomState!.hostId && (
                    <p className="text-[10px] text-brand-300">Host</p>
                  )}
                </div>
                {roomState!.isPlaying && (
                  <div className="ml-auto flex items-end gap-[2px]">
                    {[0.4, 0.8, 0.5, 0.9, 0.6].map((h, i) => (
                      <span key={i} className="w-[3px] rounded-full bg-brand-400" style={{ height: `${h * 100}%` }} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleLeave}
          className="flex items-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-ink-300 transition-colors hover:bg-white/5 hover:text-ink-50"
        >
          <LogOut size={18} />
          Leave Room
        </button>
      </div>
    );
  }

  // Fallback
  return null;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
