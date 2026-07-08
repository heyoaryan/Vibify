import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { RepeatMode, Song } from './types';
import { shuffleArray } from './lib';
import { searchSongs } from './saavn';
import { canGuestPlaySong, consumeGuestPlayback } from './auth';

type PlayerState = {
  /** The queue as currently ordered (respecting shuffle) */
  queue: Song[];
  /** Index into queue of the active song */
  index: number;
  /** The active song, or null when queue is empty */
  current: Song | null;
  isPlaying: boolean;
  /** Elapsed seconds of current track */
  position: number;
  /** Duration seconds of current track (0 until metadata loads) */
  duration: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  /** Whether the user has started playback at least once (for empty-state UX) */
  hasStarted: boolean;
};

type PlayerContextValue = PlayerState & {
  /** Play a list of songs starting at a specific song */
  playSongs: (list: Song[], startId?: string) => void;
  /** Toggle play/pause for the current song */
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  /** Add a song to play next without replacing the queue */
  playNext: (song: Song) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within <PlayerProvider>');
  return ctx;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';
  }

  // The "source queue" — the un-shuffled order the user requested.
  const sourceQueueRef = useRef<Song[]>([]);
  const shuffleRef = useRef(false);

  const [queue, setQueue] = useState<Song[]>([]);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [shuffle, setShuffle] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const current = queue[index] ?? null;

  /* ---------------- audio element wiring ---------------- */

  // rAF loop for smooth position updates (replaces jerky timeupdate)
  const rafRef = useRef<number | null>(null);
  const startRaf = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const tick = () => {
      setPosition(audio.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);
  const stopRaf = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onDur = () => setDuration(audio.duration || 0);
    const onPlay = () => { setIsPlaying(true); startRaf(); };
    const onPause = () => { setIsPlaying(false); stopRaf(); };
    const onEnded = () => { stopRaf(); handleEnded(); };
    // Still listen to timeupdate as a fallback for initial position sync
    const onTime = () => { if (!rafRef.current) setPosition(audio.currentTime); };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onDur);
    audio.addEventListener('durationchange', onDur);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      stopRaf();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onDur);
      audio.removeEventListener('durationchange', onDur);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, index, repeat]);

  // Load src when current song changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.src !== current.src) {
      audio.src = current.src;
      setPosition(0);
      setDuration(0);
    }
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Sync volume / mute
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  /* ---------------- queue helpers ---------------- */

  /** Rebuild the visible queue from the source queue, applying shuffle. */
  const rebuildQueue = useCallback(
    (activeId: string) => {
      const source = sourceQueueRef.current;
      if (!source.length) {
        setQueue([]);
        setIndex(0);
        return;
      }
      if (shuffleRef.current) {
        const active = source.find((s) => s.id === activeId) ?? source[0];
        const rest = shuffleArray(source.filter((s) => s.id !== active.id));
        const newQueue = [active, ...rest];
        setQueue(newQueue);
        setIndex(0);
      } else {
        setQueue(source);
        const i = source.findIndex((s) => s.id === activeId);
        setIndex(i < 0 ? 0 : i);
      }
    },
    [],
  );

  /* ---------------- controls ---------------- */

  const playSongs = useCallback(
    (list: Song[], startId?: string) => {
      if (!list.length) return;
      if (!canGuestPlaySong()) {
        return;
      }
      const start = startId ?? list[0].id;
      sourceQueueRef.current = list;
      const i = list.findIndex((s) => s.id === start);
      const startIndex = i < 0 ? 0 : i;
      if (shuffleRef.current) {
        const active = list[startIndex];
        const rest = shuffleArray(list.filter((s) => s.id !== active.id));
        setQueue([active, ...rest]);
        setIndex(0);
      } else {
        setQueue(list);
        setIndex(startIndex);
      }
      if (!consumeGuestPlayback()) {
        return;
      }
      setHasStarted(true);
      setIsPlaying(true);
    },
    [],
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) {
      if (!canGuestPlaySong()) {
        return;
      }
      consumeGuestPlayback();
      setHasStarted(true);
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [current]);

  const next = useCallback(() => {
    setQueue((q) => {
      if (!q.length) return q;
      setIndex((idx) => {
        if (idx < q.length - 1) return idx + 1;
        // wrap
        return repeat === 'all' ? 0 : idx;
      });
      return q;
    });
    setIsPlaying(true);
  }, [repeat]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    // If past 3s, restart current track instead of jumping back
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setPosition(0);
      return;
    }
    setIndex((idx) => (idx > 0 ? idx - 1 : 0));
    setIsPlaying(true);
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setPosition(seconds);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (v > 0) setMuted(false);
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const cycleRepeat = useCallback(
    () =>
      setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')),
    [],
  );

  const toggleShuffle = useCallback(() => {
    const nextShuffle = !shuffleRef.current;
    shuffleRef.current = nextShuffle;
    setShuffle(nextShuffle);
    const activeId = queue[index]?.id;
    if (activeId) rebuildQueue(activeId);
  }, [queue, index, rebuildQueue]);

  const playNext = useCallback(
    (song: Song) => {
      setQueue((q) => {
        const idx = index;
        const without = q.filter((s) => s.id !== song.id);
        // If we removed the current song, keep index consistent
        const newIdx = without.findIndex((s) => s.id === q[idx]?.id);
        const base = newIdx < 0 ? idx : newIdx;
        const head = without.slice(0, base + 1);
        const tail = without.slice(base + 1);
        return [...head, song, ...tail];
      });
      // Also keep source queue in sync shape
      sourceQueueRef.current = [...sourceQueueRef.current, song];
    },
    [index],
  );

  /* ---------------- auto-queue refill ---------------- */

  // Tracks whether we're already fetching more songs (prevents duplicate fetches)
  const isFetchingMoreRef = useRef(false);

  useEffect(() => {
    // Only refill when repeat is off and queue is running low (2 or fewer songs left)
    if (repeat !== 'off') return;
    if (!current) return;
    const songsLeft = queue.length - 1 - index;
    if (songsLeft > 2) return;
    if (isFetchingMoreRef.current) return;

    isFetchingMoreRef.current = true;

    const existingIds = new Set(queue.map((s) => s.id));

    // Fetch similar songs based on the current song's artist
    searchSongs(current.artist, 15)
      .then((results) => {
        const fresh = results.filter((s) => !existingIds.has(s.id));
        if (!fresh.length) return;

        // Pick up to 10 new songs
        const toAdd = fresh.slice(0, 10);

        setQueue((q) => [...q, ...toAdd]);
        sourceQueueRef.current = [...sourceQueueRef.current, ...toAdd];
      })
      .catch(() => {/* silently ignore fetch errors */})
      .finally(() => {
        isFetchingMoreRef.current = false;
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, queue.length, repeat]);

  /* ---------------- ended / auto-advance ---------------- */

  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;

  const handleEnded = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (repeatRef.current === 'one') {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    setQueue((q) => {
      if (!q.length) return q;
      setIndex((idx) => {
        if (idx < q.length - 1) return idx + 1;
        return repeatRef.current === 'all' ? 0 : idx;
      });
      return q;
    });
    if (repeatRef.current === 'off' && index >= queue.length - 1) {
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
    }
  }, [index, queue.length]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue,
      index,
      current,
      isPlaying,
      position,
      duration,
      volume,
      muted,
      repeat,
      shuffle,
      hasStarted,
      playSongs,
      togglePlay,
      next,
      prev,
      seek,
      setVolume,
      toggleMute,
      cycleRepeat,
      toggleShuffle,
      playNext,
    }),
    [
      queue, index, current, isPlaying, position, duration, volume, muted,
      repeat, shuffle, hasStarted, playSongs, togglePlay, next, prev, seek,
      setVolume, toggleMute, cycleRepeat, toggleShuffle, playNext,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

/** Convenience hook: is a given song id the currently playing track? */
export function useIsCurrent(id: string): boolean {
  const { current } = usePlayer();
  return current?.id === id;
}

