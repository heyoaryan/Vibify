import { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, LogOut, Music2, Plus, Play, Pause, SkipForward } from 'lucide-react';
import { useRoom } from '../room';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [showMemberSelect, setShowMemberSelect] = useState(false);
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSearched, setSearchSearched] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
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
    setIsCreating(true);
    setShowMemberSelect(false);
    const success = await createRoom(count);
    if (!success) {
      setIsCreating(false);
    }
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
    setIsCreating(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchSearched(false);
    setSearchLoading(false);
  };

  const handleSelectSong = async (song: Song) => {
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
                className={`flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold transition-all border border-white/10 text-ink-100 hover:bg-white/5`}
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
           <h2 className="font-display text-2xl font-bold text-ink-50 sm:text-3xl">Room</h2>
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

  // Creating room
  if (isCreating && !roomState) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-4">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-ink-50 sm:text-3xl">Creating Room</h2>
          <p className="mt-2 text-sm text-ink-400">Setting up your listening room...</p>
        </div>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
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
  if (isPlayingRoom) {
    const song = roomState!.currentSong;

    return (
      <div className="flex h-full flex-col px-4 py-4">
        {toast.visible && (
          <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 animate-fade-in">
            <div className="flex items-center gap-2 rounded-full bg-brand-500/20 px-4 py-2 text-sm font-medium text-brand-300 backdrop-blur-xl">
              <Music2 size={16} />
              {toast.message}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink-50">Room</h2>
          <button
            onClick={handleLeave}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:bg-white/5 hover:text-ink-50"
          >
            <LogOut size={14} />
            Leave
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-4">
          <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-5 pt-4">
            {/* Search */}
            {isHost && (
              <div className="w-full space-y-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search a song to play..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-ink-50 outline-none placeholder:text-ink-500 focus:border-brand-400/50"
                />
                {searchQuery.trim() && (
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-ink-900/60 p-2">
                    {searchLoading && (
                      <div className="flex items-center justify-center py-4">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
                      </div>
                    )}
                    {!searchLoading && searchResults.map(s => (
                      <button
                        key={s.id}
                        onClick={() => handleSelectSong(s)}
                        className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/5"
                      >
                        {s.imageUrl ? (
                          <img src={s.imageUrl} alt={s.title} className="h-10 w-10 shrink-0 rounded-md object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-400 to-accent-500 text-xs font-bold text-ink-950">
                            {s.title.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-100">{s.title}</p>
                          <p className="truncate text-xs text-ink-400">{s.artist}</p>
                        </div>
                      </button>
                    ))}
                    {!searchLoading && searchSearched && searchResults.length === 0 && (
                      <p className="text-center text-xs text-ink-500">No songs found</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Song display or placeholder */}
            {song ? (
              <div className="flex w-full flex-col items-center gap-3">
                <Artwork
                  title={song.title}
                  hue={song.hue}
                  hue2={song.hue2}
                  imageUrl={song.imageUrl}
                  className="aspect-square w-full max-w-[260px] rounded-3xl shadow-2xl"
                  variant="vinyl"
                />
                <div className="w-full space-y-0.5 text-center">
                  <h3 className="truncate text-lg font-bold text-ink-50">{song.title}</h3>
                  <p className="truncate text-sm text-ink-400">{song.artist}</p>
                </div>
              </div>
            ) : (
              <div className="flex w-full flex-col items-center justify-center gap-4 py-16 text-center">
                <Music2 size={48} className="text-ink-600" />
                <p className="text-sm text-ink-400">Play a song from search bar</p>
              </div>
            )}

            {/* Host controls */}
            {isHost && song && (
              <div className="flex items-center gap-4">
                <button
                  onClick={handleHostToggle}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-400 text-ink-950 transition-all hover:scale-105 active:scale-95"
                >
                  {roomState!.isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                </button>
                <button
                  onClick={handleSkip}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-ink-100 transition-all hover:bg-white/5"
                >
                  <SkipForward size={16} />
                </button>
              </div>
            )}

            {/* Non-host status */}
            {!isHost && (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2">
                <div className={`h-2.5 w-2.5 rounded-full ${roomState!.isPlaying ? 'animate-pulse bg-brand-400' : 'bg-ink-600'}`} />
                <p className="text-sm text-ink-300">
                  {roomState!.isPlaying ? 'Host is playing' : 'Host paused'}
                </p>
              </div>
            )}

            {/* Members */}
            <div className="w-full">
              <p className="mb-2 text-xs font-medium text-ink-400">
                {roomState!.members.length} / {roomState!.maxMembers} listeners
              </p>
              <div className="flex flex-wrap gap-2">
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
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
};
