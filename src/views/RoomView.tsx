import { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, LogOut, Music2, Plus, Play, Pause, SkipForward, Check } from 'lucide-react';
import { useRoom } from '../room';
import { usePlayer } from '../player';
import { useCurrentUser } from '../auth';
import { searchSongs } from '../saavn';
import { Artwork } from '../components/Artwork';
import type { Song } from '../types';

export const RoomView = function RoomView() {
  const {
    roomState, isLoading, error,
    createRoom, joinRoom, leaveRoom, restoreRoom,
    playRoom, pauseRoom, setRoomSong,
  } = useRoom();
  const { togglePlay, next, current, isPlaying, playSongs } = usePlayer();
  const user = useCurrentUser();

  const [joinCode, setJoinCode]                 = useState('');
  const [copied, setCopied]                     = useState(false);
  const [searchQuery, setSearchQuery]           = useState('');
  const [toast, setToast]                       = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [showMemberSelect, setShowMemberSelect] = useState(false);
  const [searchResults, setSearchResults]       = useState<Song[]>([]);
  const [searchLoading, setSearchLoading]       = useState(false);
  const [searchSearched, setSearchSearched]     = useState(false);
  const [isCreating, setIsCreating]             = useState(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSongIdRef     = useRef<string | null>(null);
  const didRestoreRef     = useRef(false);

  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;
    const savedId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('vibify-room-id') : null;
    if (savedId && !roomState) restoreRoom(savedId);
  }, [roomState, restoreRoom]);

  const isHost     = roomState?.hostId === user.id;
  const isWaiting  = roomState?.status === 'waiting';
  const isPlaying_ = roomState?.status === 'playing';

  const showToast = useCallback((msg: string) => {
    setToast({ message: msg, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3000);
  }, []);

  useEffect(() => {
    if (!roomState?.currentSong) return;
    if (prevSongIdRef.current !== null && prevSongIdRef.current !== roomState.currentSong.id) {
      const host = roomState.members.find(m => m.id === roomState.hostId);
      showToast(`${host?.name || 'Someone'} played ${roomState.currentSong.title}`);
    }
    prevSongIdRef.current = roomState.currentSong.id;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomState?.currentSong?.id]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!q) { setSearchResults([]); setSearchSearched(false); setSearchLoading(false); return; }
    setSearchLoading(true); setSearchSearched(false);
    searchDebounceRef.current = setTimeout(async () => {
      try { setSearchResults(await searchSongs(q, 20)); }
      catch { setSearchResults([]); }
      finally { setSearchLoading(false); setSearchSearched(true); }
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (!isHost || !isPlaying_ || !current) return;
    if (roomState?.currentSong && current.id !== roomState.currentSong.id) setRoomSong(current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, isPlaying_, isHost, roomState?.currentSong?.id]);

  useEffect(() => {
    if (!isHost || !isPlaying_ || !roomState?.currentSong) return;
    if (!isPlaying) playSongs([roomState.currentSong], roomState.currentSong.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying_, isHost, roomState?.currentSong]);

  const copyCode = async () => {
    if (!roomState?.code) return;
    await navigator.clipboard.writeText(roomState.code);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    const ok = await joinRoom(joinCode.trim());
    if (ok) setJoinCode('');
  };

  const handleLeave = async () => {
    await leaveRoom();
    setIsCreating(false); setSearchQuery(''); setSearchResults([]);
    setSearchSearched(false); setSearchLoading(false);
  };

  const handleSelectSong = async (song: Song) => {
    setSearchQuery('');
    await setRoomSong(song);
    playSongs([song], song.id);
    if (isWaiting) await playRoom();
  };

  const handleHostToggle = async () => {
    togglePlay();
    if (roomState!.isPlaying) await pauseRoom(); else await playRoom();
  };

  // Shared toast UI
  const ToastBanner = () => toast.visible ? (
    <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 animate-fade-in pointer-events-none">
      <div className="flex items-center gap-2 rounded-full bg-brand-500/20 px-4 py-2 text-sm font-medium text-brand-300 backdrop-blur-xl shadow-lg">
        <Music2 size={15} />
        {toast.message}
      </div>
    </div>
  ) : null;

  // ── Not in room ────────────────────────────────────────────────────────────
  if (!roomState) {

    if (showMemberSelect) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-8 px-6 py-10">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-ink-50 sm:text-4xl">Create a Room</h2>
            <p className="mt-2 text-sm text-ink-300">How many people can join?</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {[2, 3, 4, 5, 6].map(n => (
              <button
                key={n}
                disabled={isLoading}
                onClick={async () => {
                  setIsCreating(true); setShowMemberSelect(false);
                  const ok = await createRoom(n);
                  if (!ok) setIsCreating(false);
                }}
                className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10
                  text-xl font-bold text-ink-100 transition-all
                  hover:border-brand-400/40 hover:bg-brand-500/10 hover:text-brand-300
                  active:scale-95 disabled:opacity-50"
              >
                {n}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowMemberSelect(false)}
            className="text-sm text-ink-400 transition-colors hover:text-ink-200"
          >
            ← Back
          </button>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-10 px-6 py-10">
        {/* Icon + heading */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-brand-500/15 text-brand-300 shadow-glow">
            <Music2 size={36} />
          </div>
          <div>
            <h2 className="font-display text-3xl font-bold text-ink-50 sm:text-4xl">Listen Together</h2>
            <p className="mt-2 max-w-xs text-sm text-ink-300 sm:text-base">
              Create a room and vibe with friends in real-time sync.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex w-full max-w-sm flex-col gap-4">
          <button
            onClick={() => setShowMemberSelect(true)}
            disabled={isLoading}
            className="flex items-center justify-center gap-2.5 rounded-2xl bg-brand-400
              py-4 text-base font-bold text-ink-950 shadow-glow transition-all
              hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <Plus size={20} />
            Create Room
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-ink-500">or join with code</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <input
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="XXXXXX"
            maxLength={6}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04]
              px-5 py-4 text-center text-xl font-mono font-bold tracking-[0.3em]
              text-ink-50 outline-none placeholder:text-ink-600
              focus:border-brand-400/50 focus:bg-white/[0.06] transition-colors"
          />
          <button
            onClick={handleJoin}
            disabled={isLoading || joinCode.length !== 6}
            className="flex items-center justify-center rounded-2xl border border-white/10
              py-4 text-base font-semibold text-ink-100 transition-all
              hover:bg-white/5 active:scale-[0.98] disabled:opacity-40"
          >
            Join Room
          </button>
        </div>

        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  // Creating spinner
  if (isCreating && !roomState) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
        <p className="text-sm text-ink-400">Creating your room…</p>
      </div>
    );
  }

  // ── Waiting room ───────────────────────────────────────────────────────────
  if (isWaiting) {
    const slots = Array.from({ length: roomState!.maxMembers }, (_, i) => roomState!.members[i] ?? null);
    const cols  = slots.length <= 2
      ? 'grid-cols-2'
      : slots.length <= 4
        ? 'grid-cols-2 sm:grid-cols-4'
        : 'grid-cols-3 sm:grid-cols-6';

    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 px-6 py-10">
        <ToastBanner />

        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-ink-50 sm:text-3xl">Waiting Room</h2>
          <p className="mt-1 text-sm text-ink-400">Share the code with friends</p>
        </div>

        {/* Room code */}
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-500">Room Code</p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[0.25em] text-ink-50">{roomState!.code}</p>
          </div>
          <button
            onClick={copyCode}
            aria-label="Copy code"
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15
              text-brand-300 transition-all hover:bg-brand-500/25 active:scale-95"
          >
            {copied ? <Check size={22} /> : <Copy size={22} />}
          </button>
        </div>

        {/* Members */}
        <div className="w-full max-w-sm">
          <p className="mb-4 text-center text-xs font-medium text-ink-400">
            {roomState!.members.length} / {roomState!.maxMembers} joined
          </p>
          <div className={`grid ${cols} gap-4`} style={{ justifyItems: 'center' }}>
            {slots.map((member, idx) => (
              <div key={member?.id ?? `empty-${idx}`} className="flex flex-col items-center gap-2">
                {member ? (
                  <>
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full
                      bg-gradient-to-br from-brand-400 to-accent-500 text-lg font-bold text-ink-950 shadow-glow">
                      {member.avatar
                        ? <img src={member.avatar} alt={member.name} className="h-full w-full rounded-full object-cover" />
                        : member.name.charAt(0).toUpperCase()}
                      {member.id === roomState!.hostId && (
                        <span className="absolute -bottom-1 -right-1 rounded-full bg-brand-400 px-1.5 py-0.5 text-[9px] font-bold text-ink-950">
                          HOST
                        </span>
                      )}
                    </div>
                    <span className="max-w-[72px] truncate text-center text-xs font-medium text-ink-200">
                      {member.name}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full
                      border-2 border-dashed border-white/10 text-ink-600">
                      <Plus size={18} />
                    </div>
                    <span className="text-xs text-ink-600">Empty</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleLeave}
          className="flex items-center gap-2 rounded-2xl border border-white/10 px-6 py-3
            text-sm font-medium text-ink-400 transition-all
            hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 active:scale-95"
        >
          <LogOut size={16} />
          Leave Room
        </button>
      </div>
    );
  }

  // ── Playing room ───────────────────────────────────────────────────────────
  if (isPlaying_) {
    const song = roomState!.currentSong;

    return (
      <div className="flex h-full flex-col">
        <ToastBanner />

        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-3 sm:px-8">
          <div>
            <h2 className="font-display text-lg font-bold text-ink-50">Room</h2>
            <p className="text-xs text-ink-500">{roomState!.members.length}/{roomState!.maxMembers} listeners</p>
          </div>
          <button
            onClick={handleLeave}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2
              text-xs font-medium text-ink-400 transition-all
              hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 active:scale-95"
          >
            <LogOut size={14} />
            Leave
          </button>
        </div>

        {/* Scrollable body — always centered */}
        <div className="flex flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-6 px-5 py-4 sm:px-8">

            {/* Host search */}
            {isHost && (
              <div className="w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search a song to play…"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04]
                    px-4 py-3 text-sm text-ink-50 outline-none placeholder:text-ink-500
                    focus:border-brand-400/50 focus:bg-white/[0.06] transition-colors"
                />
                {searchQuery.trim() && (
                  <div className="mt-2 max-h-52 overflow-y-auto rounded-2xl border border-white/10 bg-ink-900/90 backdrop-blur-xl">
                    {searchLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
                      </div>
                    ) : searchResults.length > 0 ? searchResults.map(s => (
                      <button
                        key={s.id}
                        onClick={() => handleSelectSong(s)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                      >
                        <Artwork title={s.title} hue={s.hue} hue2={s.hue2} imageUrl={s.imageUrl}
                          className="h-10 w-10 shrink-0" rounded="rounded-lg" />
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-sm font-medium text-ink-100">{s.title}</p>
                          <p className="text-xs text-ink-400">{s.artist}</p>
                        </div>
                      </button>
                    )) : searchSearched ? (
                      <p className="py-6 text-center text-xs text-ink-500">No results found</p>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {song ? (
              <>
                {/* Album art */}
                <div className="relative w-full max-w-[260px] sm:max-w-[300px]">
                  <div
                    className="absolute -inset-6 rounded-3xl opacity-25 blur-3xl"
                    style={{ background: `linear-gradient(135deg, hsl(${song.hue} 70% 50%), hsl(${song.hue2} 70% 35%))` }}
                  />
                  <div className={`relative aspect-square w-full overflow-hidden rounded-3xl shadow-2xl
                    ring-1 ring-white/10 transition-transform duration-700
                    ${isPlaying ? 'scale-[1.03]' : 'scale-100'}`}>
                    <Artwork
                      title={song.title} hue={song.hue} hue2={song.hue2}
                      imageUrl={song.imageUrl} className="h-full w-full" rounded="rounded-3xl"
                    />
                  </div>
                </div>

                {/* Song info */}
                <div className="w-full text-center">
                  <h3 className="line-clamp-2 break-words font-display text-xl font-bold text-ink-50 sm:text-2xl">
                    {song.title}
                  </h3>
                  <p className="mt-1 text-sm text-ink-400">{song.artist}</p>
                </div>

                {/* Host controls */}
                {isHost && (
                  <div className="flex items-center gap-5">
                    <button
                      onClick={handleHostToggle}
                      className="flex h-14 w-14 items-center justify-center rounded-full
                        bg-brand-400 text-ink-950 shadow-glow transition-all
                        hover:scale-105 active:scale-95"
                    >
                      {roomState!.isPlaying
                        ? <Pause size={22} className="fill-ink-950" />
                        : <Play  size={22} className="fill-ink-950 translate-x-[1px]" />}
                    </button>
                    <button
                      onClick={() => next()}
                      className="flex h-11 w-11 items-center justify-center rounded-full
                        border border-white/10 text-ink-200 transition-all
                        hover:bg-white/5 active:scale-95"
                    >
                      <SkipForward size={18} />
                    </button>
                  </div>
                )}

                {/* Guest status */}
                {!isHost && (
                  <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-2.5">
                    <div className={`h-2 w-2 rounded-full ${roomState!.isPlaying ? 'animate-pulse bg-brand-400' : 'bg-ink-600'}`} />
                    <p className="text-sm text-ink-300">
                      {roomState!.isPlaying ? 'Host is playing' : 'Host paused'}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <Music2 size={48} className="text-ink-700" />
                <p className="text-sm text-ink-500">
                  {isHost ? 'Search a song above to start playing' : 'Waiting for host to play a song…'}
                </p>
              </div>
            )}

            {/* Members */}
            <div className="w-full">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-500">In this room</p>
              <div className="flex flex-wrap justify-center gap-2">
                {roomState!.members.map(member => (
                  <div key={member.id}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                      bg-gradient-to-br from-brand-400 to-accent-500 text-[11px] font-bold text-ink-950">
                      {member.avatar
                        ? <img src={member.avatar} alt={member.name} className="h-full w-full rounded-full object-cover" />
                        : member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-ink-100">{member.name}</p>
                      {member.id === roomState!.hostId && (
                        <p className="text-[10px] font-semibold text-brand-400">Host</p>
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

  return null;
};
