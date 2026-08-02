import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Copy, LogOut, Music2, Plus, Play, Pause, SkipForward,
  SkipBack, Check, Search, X, Trash2, ListMusic, Users,
} from 'lucide-react';
import { useRoom } from '../room';
import { usePlayer } from '../player';
import { usePlayback } from '../player';
import { useCurrentUser } from '../auth';
import { searchSongs } from '../saavn';
import { Artwork } from '../components/Artwork';
import type { Song } from '../types';

/* ─── helpers ──────────────────────────────────────────────────────────────── */
function fmtTime(sec: number) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export const RoomView = function RoomView() {
  const {
    roomState, isLoading, error,
    createRoom, joinRoom, leaveRoom, restoreRoom,
    playRoom, setRoomSong,
    addToQueue, playFromQueue, playNext, playPrevious,
    removeFromQueue, togglePlayPause,
  } = useRoom();
  const { playSongs, current } = usePlayer();
  const { position, duration } = usePlayback();
  const user = useCurrentUser();

  const [joinCode, setJoinCode]             = useState('');
  const [copied, setCopied]                 = useState(false);
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState<Song[]>([]);
  const [searchLoading, setSearchLoading]   = useState(false);
  const [searchSearched, setSearchSearched] = useState(false);
  const [showSearch, setShowSearch]         = useState(false);
  const [activeTab, setActiveTab]           = useState<'queue' | 'members'>('queue');
  const [toast, setToast]                   = useState('');
  const [showMemberSelect, setShowMemberSelect] = useState(false);
  const [isCreating, setIsCreating]         = useState(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSongIdRef     = useRef<string | null>(null);
  const prevChangedByRef  = useRef<string | null>(null);
  const didRestoreRef     = useRef(false);

  /* restore room from session */
  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;
    const savedId = typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('vibify-room-id') : null;
    if (savedId && !roomState) restoreRoom(savedId);
  }, [roomState, restoreRoom]);

  const isHost    = roomState?.hostId === user.id;
  const isWaiting = roomState?.status === 'waiting';
  const isPlaying_= roomState?.status === 'playing';

  /* toast helper */
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  /* notify when song changes */
  useEffect(() => {
    if (!roomState?.currentSong) return;
    const songId    = roomState.currentSong.id;
    const changedBy = roomState.lastChangedBy;
    if (prevSongIdRef.current !== null && prevSongIdRef.current !== songId) {
      const who = roomState.members.find(m => m.id === changedBy);
      const name = who ? (who.id === user.id ? 'You' : who.name) : 'Someone';
      showToast(`${name} played "${roomState.currentSong.title}"`);
    }
    prevSongIdRef.current   = songId;
    prevChangedByRef.current = changedBy;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomState?.currentSong?.id]);

  /* search with debounce */
  useEffect(() => {
    const q = searchQuery.trim();
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!q) { setSearchResults([]); setSearchSearched(false); setSearchLoading(false); return; }
    setSearchLoading(true); setSearchSearched(false);
    searchDebounceRef.current = setTimeout(async () => {
      try { setSearchResults(await searchSongs(q, 20)); }
      catch { setSearchResults([]); }
      finally { setSearchLoading(false); setSearchSearched(true); }
    }, 350);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  /* host: keep room current_song in sync with local player */
  useEffect(() => {
    if (!isHost || !isPlaying_ || !current) return;
    if (roomState?.currentSong && current.id !== roomState.currentSong.id) setRoomSong(current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, isPlaying_, isHost, roomState?.currentSong?.id]);

  /* host: start playing when room switches to playing */
  useEffect(() => {
    if (!isHost || !isPlaying_ || !roomState?.currentSong) return;
    playSongs(
      roomState.queue.length > 0 ? roomState.queue : [roomState.currentSong],
      roomState.currentSong.id,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying_, isHost, roomState?.currentSong?.id]);

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
    setIsCreating(false); setSearchQuery('');
    setSearchResults([]); setSearchSearched(false); setShowSearch(false);
  };

  /* any member can play a song immediately */
  const handlePlayNow = async (song: Song) => {
    setSearchQuery(''); setShowSearch(false);
    const newQueue = roomState?.queue.some(s => s.id === song.id)
      ? roomState.queue
      : [...(roomState?.queue ?? []), song];
    const idx = newQueue.findIndex(s => s.id === song.id);
    await setRoomSong(song);
    if (roomState?.queue && !roomState.queue.some(s => s.id === song.id)) {
      await addToQueue(song);
    }
    await playFromQueue(idx < 0 ? 0 : idx);
    if (isWaiting) await playRoom();
    playSongs(newQueue, song.id);
  };

  /* any member can add to queue */
  const handleAddToQueue = async (song: Song) => {
    await addToQueue(song);
    showToast(`"${song.title}" added to queue`);
  };

  /* toggle play/pause — any member */
  const handleTogglePlay = async () => {
    await togglePlayPause();
  };

  /* ─── Toast ─────────────────────────────────────────────────────────────── */
  const ToastBanner = () => toast ? (
    <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 animate-fade-in pointer-events-none">
      <div className="flex items-center gap-2 rounded-full bg-brand-500/20 px-4 py-2
        text-sm font-medium text-brand-300 backdrop-blur-xl shadow-lg whitespace-nowrap">
        <Music2 size={14} />
        {toast}
      </div>
    </div>
  ) : null;

  /* ─── Search panel ───────────────────────────────────────────────────────── */
  const SearchPanel = () => (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <Search size={16} className="text-ink-500 shrink-0" />
        <input
          autoFocus
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search songs to add…"
          className="flex-1 bg-transparent text-sm text-ink-50 outline-none placeholder:text-ink-500"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-ink-500 hover:text-ink-300">
            <X size={15} />
          </button>
        )}
        <button
          onClick={() => { setShowSearch(false); setSearchQuery(''); }}
          className="ml-1 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-ink-400
            hover:bg-white/5 transition-colors"
        >
          Done
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {searchLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
          </div>
        ) : searchResults.length > 0 ? (
          searchResults.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors">
              <Artwork title={s.title} hue={s.hue} hue2={s.hue2} imageUrl={s.imageUrl}
                className="h-10 w-10 shrink-0" rounded="rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium text-ink-100">{s.title}</p>
                <p className="text-xs text-ink-400">{s.artist}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handlePlayNow(s)}
                  title="Play now"
                  className="flex h-8 w-8 items-center justify-center rounded-xl
                    bg-brand-400 text-ink-950 hover:bg-brand-300 transition-colors active:scale-95"
                >
                  <Play size={13} className="fill-ink-950 translate-x-[1px]" />
                </button>
                <button
                  onClick={() => handleAddToQueue(s)}
                  title="Add to queue"
                  className="flex h-8 w-8 items-center justify-center rounded-xl
                    border border-white/10 text-ink-300 hover:bg-white/5 transition-colors active:scale-95"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))
        ) : searchSearched ? (
          <p className="py-10 text-center text-xs text-ink-500">No results found</p>
        ) : (
          <p className="py-10 text-center text-xs text-ink-500">Type to search songs</p>
        )}
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════════
     NOT IN ROOM
  ══════════════════════════════════════════════════════════════════════════ */
  if (!roomState) {
    if (showMemberSelect) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-8 px-6 py-10">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-ink-50">Create a Room</h2>
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
                  text-xl font-bold text-ink-100 transition-all hover:border-brand-400/40
                  hover:bg-brand-500/10 hover:text-brand-300 active:scale-95 disabled:opacity-50"
              >
                {n}
              </button>
            ))}
          </div>
          <button onClick={() => setShowMemberSelect(false)} className="text-sm text-ink-400 hover:text-ink-200">
            ← Back
          </button>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-10 px-6 py-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-brand-500/15 text-brand-300 shadow-glow">
            <Music2 size={36} />
          </div>
          <div>
            <h2 className="font-display text-3xl font-bold text-ink-50">Listen Together</h2>
            <p className="mt-2 max-w-xs text-sm text-ink-300">Create a room and vibe with friends in real-time sync.</p>
          </div>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-4">
          <button
            onClick={() => setShowMemberSelect(true)}
            disabled={isLoading}
            className="flex items-center justify-center gap-2.5 rounded-2xl bg-brand-400
              py-4 text-base font-bold text-ink-950 shadow-glow transition-all
              hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <Plus size={20} /> Create Room
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

  if (isCreating && !roomState) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
        <p className="text-sm text-ink-400">Creating your room…</p>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     WAITING ROOM
  ══════════════════════════════════════════════════════════════════════════ */
  if (isWaiting) {
    const slots = Array.from({ length: roomState.maxMembers }, (_, i) => roomState.members[i] ?? null);
    const cols  = slots.length <= 2 ? 'grid-cols-2'
      : slots.length <= 4 ? 'grid-cols-2 sm:grid-cols-4'
      : 'grid-cols-3 sm:grid-cols-6';

    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 px-6 py-10">
        <ToastBanner />
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-ink-50">Waiting Room</h2>
          <p className="mt-1 text-sm text-ink-400">Share the code with friends to start</p>
        </div>

        {/* Code */}
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-500">Room Code</p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[0.25em] text-ink-50">{roomState.code}</p>
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

        {/* Members grid */}
        <div className="w-full max-w-sm">
          <p className="mb-4 text-center text-xs font-medium text-ink-400">
            {roomState.members.length} / {roomState.maxMembers} joined
            {roomState.members.length < 2 && (
              <span className="ml-2 text-ink-600">• Need at least 2 to start</span>
            )}
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
                      {member.id === roomState.hostId && (
                        <span className="absolute -bottom-1 -right-1 rounded-full bg-brand-400
                          px-1.5 py-0.5 text-[9px] font-bold text-ink-950">HOST</span>
                      )}
                    </div>
                    <span className="max-w-[72px] truncate text-center text-xs font-medium text-ink-200">
                      {member.name}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full
                      border-2 border-dashed border-white/10 text-ink-600"><Plus size={18} /></div>
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
          <LogOut size={16} /> Leave Room
        </button>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PLAYING ROOM
  ══════════════════════════════════════════════════════════════════════════ */
  if (isPlaying_) {
    const song     = roomState.currentSong;
    const queue    = roomState.queue;
    const progress = duration > 0 ? (position / duration) * 100 : 0;

    /* who changed last */
    const changer = roomState.members.find(m => m.id === roomState.lastChangedBy);
    const changerName = changer
      ? (changer.id === user.id ? 'You' : changer.name)
      : null;

    if (showSearch) {
      return (
        <div className="flex h-full flex-col">
          <ToastBanner />
          <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-2 border-b border-white/10">
            <h2 className="font-display text-base font-bold text-ink-50">Add Songs</h2>
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <div className={`h-1.5 w-1.5 rounded-full ${roomState.isPlaying ? 'animate-pulse bg-brand-400' : 'bg-ink-600'}`} />
              <span className="line-clamp-1 min-w-0">{song?.title ?? 'Nothing playing'}</span>
            </div>
          </div>
          <SearchPanel />
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col">
        <ToastBanner />

        {/* ── Top bar ── */}
        <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-3 sm:px-8">
          <div>
            <h2 className="font-display text-lg font-bold text-ink-50">Room
              <span className="ml-2 font-mono text-xs font-normal text-ink-500">{roomState.code}</span>
            </h2>
            <p className="text-xs text-ink-500">{roomState.members.length}/{roomState.maxMembers} listeners</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2
                text-xs font-medium text-ink-300 transition-all hover:bg-white/5 active:scale-95"
            >
              <Search size={13} /> Search
            </button>
            <button
              onClick={handleLeave}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2
                text-xs font-medium text-ink-400 transition-all
                hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 active:scale-95"
            >
              <LogOut size={13} /> Leave
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex flex-1 flex-col overflow-y-auto">

          {/* Now playing card */}
          {song ? (
            <div className="mx-4 mt-2 mb-4 rounded-3xl border border-white/[0.07] bg-white/[0.03] p-4 sm:mx-8">
              <div className="flex items-center gap-4">
                {/* Artwork */}
                <div className="relative shrink-0">
                  <div
                    className="absolute -inset-2 rounded-2xl opacity-30 blur-xl"
                    style={{ background: `linear-gradient(135deg, hsl(${song.hue} 70% 50%), hsl(${song.hue2} 70% 35%))` }}
                  />
                  <div className={`relative h-20 w-20 overflow-hidden rounded-2xl ring-1 ring-white/10
                    transition-transform duration-500 ${roomState.isPlaying ? 'scale-105' : 'scale-100'}`}>
                    <Artwork title={song.title} hue={song.hue} hue2={song.hue2}
                      imageUrl={song.imageUrl} className="h-full w-full" rounded="rounded-2xl" />
                  </div>
                </div>

                {/* Info + controls */}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 font-display text-base font-bold text-ink-50">{song.title}</p>
                  <p className="text-xs text-ink-400 mt-0.5">{song.artist}</p>
                  {changerName && (
                    <p className="mt-1 text-[10px] text-ink-600">played by {changerName}</p>
                  )}

                  {/* Controls — ALL members */}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => playPrevious()}
                      title="Previous"
                      className="flex h-8 w-8 items-center justify-center rounded-full
                        border border-white/10 text-ink-300 transition-all hover:bg-white/5 active:scale-90"
                    >
                      <SkipBack size={14} />
                    </button>
                    <button
                      onClick={handleTogglePlay}
                      className="flex h-10 w-10 items-center justify-center rounded-full
                        bg-brand-400 text-ink-950 shadow-glow transition-all hover:scale-105 active:scale-95"
                    >
                      {roomState.isPlaying
                        ? <Pause size={16} className="fill-ink-950" />
                        : <Play  size={16} className="fill-ink-950 translate-x-[1px]" />}
                    </button>
                    <button
                      onClick={() => playNext()}
                      title="Next"
                      className="flex h-8 w-8 items-center justify-center rounded-full
                        border border-white/10 text-ink-300 transition-all hover:bg-white/5 active:scale-90"
                    >
                      <SkipForward size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-brand-400 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-ink-600">
                  <span>{fmtTime(position)}</span>
                  <span>{fmtTime(duration)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-4 mt-2 mb-4 flex flex-col items-center gap-3 rounded-3xl border
              border-dashed border-white/10 py-10 text-center sm:mx-8">
              <Music2 size={36} className="text-ink-700" />
              <p className="text-sm text-ink-500">No song playing — search one to start</p>
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-2 rounded-xl bg-brand-400 px-4 py-2
                  text-sm font-semibold text-ink-950 shadow-glow transition-all hover:scale-105 active:scale-95"
              >
                <Search size={14} /> Search Songs
              </button>
            </div>
          )}

          {/* ── Tabs: Queue / Members ── */}
          <div className="flex shrink-0 gap-1 px-4 pb-2 sm:px-8">
            {(['queue', 'members'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold
                  transition-colors capitalize
                  ${activeTab === tab
                    ? 'bg-brand-500/20 text-brand-300'
                    : 'text-ink-500 hover:text-ink-300 hover:bg-white/5'}`}
              >
                {tab === 'queue' ? <ListMusic size={13} /> : <Users size={13} />}
                {tab === 'queue' ? `Queue (${queue.length})` : `Members (${roomState.members.length})`}
              </button>
            ))}
          </div>

          {/* ── Queue tab ── */}
          {activeTab === 'queue' && (
            <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-8">
              {queue.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <ListMusic size={28} className="text-ink-700" />
                  <p className="text-xs text-ink-500">Queue is empty</p>
                  <button
                    onClick={() => setShowSearch(true)}
                    className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2
                      text-xs text-ink-300 hover:bg-white/5 transition-colors"
                  >
                    <Plus size={12} /> Add songs
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {queue.map((s, idx) => {
                    const isActive = s.id === song?.id;
                    return (
                      <div
                        key={`${s.id}-${idx}`}
                        className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors
                          ${isActive ? 'bg-brand-500/15 ring-1 ring-brand-400/20' : 'hover:bg-white/5'}`}
                      >
                        {/* Index / playing dot */}
                        <div className="w-5 shrink-0 text-center">
                          {isActive
                            ? <div className={`mx-auto h-2 w-2 rounded-full bg-brand-400 ${roomState.isPlaying ? 'animate-pulse' : ''}`} />
                            : <span className="text-[11px] text-ink-600">{idx + 1}</span>}
                        </div>

                        <Artwork title={s.title} hue={s.hue} hue2={s.hue2} imageUrl={s.imageUrl}
                          className="h-10 w-10 shrink-0" rounded="rounded-lg" />

                        <div className="min-w-0 flex-1">
                          <p className={`line-clamp-1 text-sm font-medium ${isActive ? 'text-brand-300' : 'text-ink-100'}`}>
                            {s.title}
                          </p>
                          <p className="text-xs text-ink-500">{s.artist}</p>
                        </div>

                        {/* Any member can play or remove */}
                        <div className="flex items-center gap-1 shrink-0">
                          {!isActive && (
                            <button
                              onClick={() => playFromQueue(idx)}
                              title="Play this song"
                              className="flex h-7 w-7 items-center justify-center rounded-lg
                                text-ink-400 hover:bg-white/10 hover:text-ink-100 transition-colors"
                            >
                              <Play size={12} className="translate-x-[1px]" />
                            </button>
                          )}
                          <button
                            onClick={() => removeFromQueue(idx)}
                            title="Remove from queue"
                            className="flex h-7 w-7 items-center justify-center rounded-lg
                              text-ink-600 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Floating add button */}
              <button
                onClick={() => setShowSearch(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl
                  border border-dashed border-white/10 py-3 text-xs text-ink-500
                  hover:border-brand-400/30 hover:text-brand-400 transition-colors"
              >
                <Plus size={13} /> Add to queue
              </button>
            </div>
          )}

          {/* ── Members tab ── */}
          {activeTab === 'members' && (
            <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-8">
              <div className="flex flex-col gap-2">
                {roomState.members.map(member => (
                  <div key={member.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center
                      rounded-full bg-gradient-to-br from-brand-400 to-accent-500 text-sm font-bold text-ink-950">
                      {member.avatar
                        ? <img src={member.avatar} alt={member.name} className="h-full w-full rounded-full object-cover" />
                        : member.name.charAt(0).toUpperCase()}
                      {member.id === roomState.hostId && (
                        <span className="absolute -bottom-1 -right-1 rounded-full bg-brand-400 px-1 py-0.5 text-[8px] font-bold text-ink-950">HOST</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-100">
                        {member.name}
                        {member.id === user.id && <span className="ml-1.5 text-[10px] text-ink-500">(you)</span>}
                      </p>
                      <p className="text-xs text-ink-500">Can search, queue &amp; control playback</p>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80]" />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>{/* end scrollable body */}
      </div>
    );
  }

  return null;
};
