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
import { getSettings } from './settings';
import { recordPlay, addListenSeconds, flushListenSeconds } from './history';

type PlayerState = {
  queue: Song[];
  index: number;
  current: Song | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  hasStarted: boolean;
};

type PlayerContextValue = PlayerState & {
  playSongs: (list: Song[], startId?: string) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  playNext: (song: Song) => void;
  /** Jump to a song already in the queue by its id — does NOT consume guest credits */
  jumpToQueueItem: (songId: string) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within <PlayerProvider>');
  return ctx;
}

// ─── Two Audio elements for crossfade ────────────────────────────────────────
// audioA is the "active" element. audioB is the "next" element that fades in.
// After a crossfade completes, A and B swap roles.
function makeAudio() {
  if (typeof Audio === 'undefined') return null;
  const el = new Audio();
  el.preload = 'auto';
  el.crossOrigin = 'anonymous';
  return el;
}

const audioA = makeAudio();
const audioB = makeAudio();

// Pointer to the currently active audio element (starts as A)
let activeAudio: HTMLAudioElement | null = audioA;
let nextAudio: HTMLAudioElement | null = audioB;

/**
 * iOS Safari (and some Android WebViews) silently block audio playback until
 * the user has interacted with the page. We unlock the audio element on the
 * first touchstart/click by playing a zero-duration silent buffer and
 * immediately pausing it.
 */
function unlockAudioOnFirstGesture() {
  const unlock = () => {
    [audioA, audioB].forEach((el) => {
      if (!el) return;
      el.volume = 0;
      el.play()
        .then(() => { el.pause(); el.volume = 0.8; })
        .catch(() => { el.volume = 0.8; });
    });
    document.removeEventListener('touchstart', unlock, true);
    document.removeEventListener('mousedown', unlock, true);
  };

  document.addEventListener('touchstart', unlock, { once: true, capture: true, passive: true });
  document.addEventListener('mousedown', unlock, { once: true, capture: true });
}

unlockAudioOnFirstGesture();

// ─── Volume ramp helper ───────────────────────────────────────────────────────
/**
 * Linearly ramp `el.volume` from `from` to `to` over `durationMs` milliseconds.
 * Returns a cancel function.
 */
function rampVolume(
  el: HTMLAudioElement,
  from: number,
  to: number,
  durationMs: number,
  onDone?: () => void,
): () => void {
  const STEPS = 30;
  const stepTime = durationMs / STEPS;
  let step = 0;
  el.volume = Math.max(0, Math.min(1, from));

  const id = setInterval(() => {
    step++;
    const t = step / STEPS;
    el.volume = Math.max(0, Math.min(1, from + (to - from) * t));
    if (step >= STEPS) {
      clearInterval(id);
      el.volume = Math.max(0, Math.min(1, to));
      onDone?.();
    }
  }, stepTime);

  return () => clearInterval(id);
}

export function PlayerProvider({ children }: { children: ReactNode }) {
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

  // Keep refs for use in callbacks without stale closures
  const currentRef = useRef(current);
  const queueRef = useRef(queue);
  const indexRef = useRef(index);
  const repeatRef = useRef(repeat);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  currentRef.current = current;
  queueRef.current = queue;
  indexRef.current = index;
  repeatRef.current = repeat;
  volumeRef.current = volume;
  mutedRef.current = muted;

  // rAF for smooth scrubbing
  const rafRef = useRef<number | null>(null);

  // Crossfade state
  const crossfadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelFadeOutRef = useRef<(() => void) | null>(null);
  const cancelFadeInRef = useRef<(() => void) | null>(null);
  // Flag: crossfade already triggered for the current song — avoid double-fire
  const crossfadeFiredRef = useRef(false);
  // Flag: crossfade is in progress — suppress the native 'ended' handler
  const crossfadeInProgressRef = useRef(false);
  // Song id that was loaded by crossfade — so the load-effect skips re-loading it
  const crossfadeLoadedIdRef = useRef<string | null>(null);

  /** Clear all crossfade timers and ramps */
  const clearCrossfadeState = useCallback(() => {
    if (crossfadeTimerRef.current !== null) {
      clearTimeout(crossfadeTimerRef.current);
      crossfadeTimerRef.current = null;
    }
    cancelFadeOutRef.current?.();
    cancelFadeOutRef.current = null;
    cancelFadeInRef.current?.();
    cancelFadeInRef.current = null;
    crossfadeFiredRef.current = false;
    crossfadeInProgressRef.current = false;
    crossfadeLoadedIdRef.current = null;
  }, []);

  /**
   * Advance to the next index — used both by native 'ended' and crossfade.
   * Does NOT touch audio directly; song-load effect handles that.
   */
  const advanceIndex = useCallback(() => {
    const q = queueRef.current;
    const idx = indexRef.current;
    const rep = repeatRef.current;

    if (rep === 'one') {
      // Restart same song: clear crossfade state so it re-arms
      clearCrossfadeState();
      if (activeAudio) {
        activeAudio.currentTime = 0;
        activeAudio.play().catch(() => setIsPlaying(false));
      }
      return;
    }
    if (idx < q.length - 1) {
      setIndex(idx + 1);
    } else if (rep === 'all' && q.length > 0) {
      setIndex(0);
    } else {
      setIsPlaying(false);
      setPosition(0);
    }
  }, [clearCrossfadeState]);

  // Wire up audio element events once
  useEffect(() => {
    if (!activeAudio) return;

    const onPlay = () => {
      setIsPlaying(true);
      const tick = () => {
        if (!activeAudio) return;
        setPosition(activeAudio.currentTime);
        rafRef.current = requestAnimationFrame(tick);
      };
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    const onPause = () => {
      setIsPlaying(false);
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };

    const onDurationChange = () => {
      if (!activeAudio) return;
      setDuration(isNaN(activeAudio.duration) ? 0 : activeAudio.duration);
    };

    const onEnded = () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      // If crossfade already handled the transition, ignore native ended
      if (crossfadeInProgressRef.current) return;
      advanceIndex();
    };

    const onError = () => {
      if (!activeAudio) return;
      console.error('Audio error:', activeAudio.error?.message, activeAudio.src);
      setIsPlaying(false);
    };

    activeAudio.addEventListener('play', onPlay);
    activeAudio.addEventListener('pause', onPause);
    activeAudio.addEventListener('durationchange', onDurationChange);
    activeAudio.addEventListener('ended', onEnded);
    activeAudio.addEventListener('error', onError);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      activeAudio?.removeEventListener('play', onPlay);
      activeAudio?.removeEventListener('pause', onPause);
      activeAudio?.removeEventListener('durationchange', onDurationChange);
      activeAudio?.removeEventListener('ended', onEnded);
      activeAudio?.removeEventListener('error', onError);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Crossfade scheduler ────────────────────────────────────────────────────
  // Runs whenever position or duration updates. When position reaches
  // (duration - crossfadeSecs), it kicks off the crossfade.
  useEffect(() => {
    const { crossfadeSecs } = getSettings();
    if (!crossfadeSecs || crossfadeSecs <= 0) return;
    if (!duration || duration < crossfadeSecs * 2) return; // song too short
    if (!isPlaying) return;
    if (crossfadeFiredRef.current) return;

    const remaining = duration - position;
    if (remaining > crossfadeSecs + 0.3) return; // not time yet — wait for next tick

    // ── Time to crossfade ────────────────────────────────────────────────────
    crossfadeFiredRef.current = true;
    crossfadeInProgressRef.current = true;

    const q = queueRef.current;
    const idx = indexRef.current;
    const rep = repeatRef.current;
    const targetVol = mutedRef.current ? 0 : volumeRef.current;
    const fadeMs = crossfadeSecs * 1000;

    // Determine next song
    let nextIdx: number | null = null;
    if (rep === 'one') {
      nextIdx = idx; // restart same
    } else if (idx < q.length - 1) {
      nextIdx = idx + 1;
    } else if (rep === 'all' && q.length > 0) {
      nextIdx = 0;
    }

    if (nextIdx === null || !nextAudio) {
      // No next song — just fade out current
      cancelFadeOutRef.current = rampVolume(
        activeAudio!,
        targetVol,
        0,
        fadeMs,
      );
      return;
    }

    const nextSong = q[nextIdx];
    if (!nextSong?.src) return;

    // Load next song into nextAudio and start it at volume 0
    nextAudio.src = nextSong.src;
    nextAudio.volume = 0;
    nextAudio.load();

    const startCrossfade = () => {
      if (!nextAudio || !activeAudio) return;

      // Fade out current
      cancelFadeOutRef.current = rampVolume(activeAudio, targetVol, 0, fadeMs);

      // Fade in next
      nextAudio.play().catch((err: DOMException) => {
        if (err.name !== 'AbortError') console.error('[crossfade] nextAudio.play() failed:', err.name);
      });
      cancelFadeInRef.current = rampVolume(nextAudio, 0, targetVol, fadeMs, () => {
        // Crossfade complete — swap A/B roles and update React state
        if (!activeAudio || !nextAudio) return;

        // Stop the old active element
        activeAudio.pause();
        activeAudio.src = '';

        // Swap module-level pointers
        const tmp = activeAudio;
        activeAudio = nextAudio;
        nextAudio = tmp;

        // Rewire DOM event listeners to new activeAudio
        rewireListeners();

        // Record history for the new song
        flushListenSeconds();
        recordPlay(nextSong);

        // Update duration/position for new song
        const newDur = isNaN(activeAudio.duration) ? 0 : activeAudio.duration;
        const newPos = isNaN(activeAudio.currentTime) ? 0 : activeAudio.currentTime;
        setDuration(newDur);
        setPosition(newPos);

        // Mark this song as already loaded by crossfade so the load-effect
        // does NOT restart it when setIndex triggers a re-render.
        crossfadeLoadedIdRef.current = nextSong.id;

        // Advance React index — this changes current?.id which would normally
        // trigger the load-effect; crossfadeLoadedIdRef guards against that.
        crossfadeInProgressRef.current = false;
        crossfadeFiredRef.current = false;
        setIndex(nextIdx!);
      });
    };

    // Wait for enough data in nextAudio before starting crossfade
    if (nextAudio.readyState >= 3 /* HAVE_FUTURE_DATA */) {
      startCrossfade();
    } else {
      const onReady = () => {
        nextAudio?.removeEventListener('canplay', onReady);
        startCrossfade();
      };
      nextAudio.addEventListener('canplay', onReady);
    }
  // We intentionally run this on every position tick when playing
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, isPlaying]);

  // ─── Rewire listeners when active/next swap ──────────────────────────────────
  // Kept outside React so it can access the mutable module-level pointers.
  function rewireListeners() {
    if (!activeAudio) return;

    // Remove from old (now nextAudio) — harmless if already removed
    nextAudio?.removeEventListener('play', handlePlay);
    nextAudio?.removeEventListener('pause', handlePause);
    nextAudio?.removeEventListener('durationchange', handleDurationChange);
    nextAudio?.removeEventListener('ended', handleEnded);
    nextAudio?.removeEventListener('error', handleError);

    activeAudio.addEventListener('play', handlePlay);
    activeAudio.addEventListener('pause', handlePause);
    activeAudio.addEventListener('durationchange', handleDurationChange);
    activeAudio.addEventListener('ended', handleEnded);
    activeAudio.addEventListener('error', handleError);

    // Restart rAF on the new element
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const tick = () => {
      if (!activeAudio) return;
      setPosition(activeAudio.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  // Named handlers so we can add/remove them in rewireListeners
  function handlePlay() {
    setIsPlaying(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const tick = () => {
      if (!activeAudio) return;
      setPosition(activeAudio.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function handlePause() {
    setIsPlaying(false);
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }

  function handleDurationChange() {
    if (!activeAudio) return;
    setDuration(isNaN(activeAudio.duration) ? 0 : activeAudio.duration);
  }

  function handleEnded() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (crossfadeInProgressRef.current) return;
    advanceIndex();
  }

  function handleError() {
    if (!activeAudio) return;
    console.error('Audio error:', activeAudio.error?.message, activeAudio.src);
    setIsPlaying(false);
  }

  /**
   * Single source of truth for audio loading.
   * Whenever `current` changes (new song id), load and play it on activeAudio.
   */
  useEffect(() => {
    if (!activeAudio || !current) return;

    if (!current.src) {
      console.warn('[player] song has empty src, skipping:', current.title);
      return;
    }

    // If crossfade already loaded + started this song, don't restart it
    if (crossfadeLoadedIdRef.current === current.id) {
      crossfadeLoadedIdRef.current = null; // consume the guard
      return;
    }

    console.debug('[player] loading:', current.title, '| src:', current.src.slice(0, 80));

    // Cancel any ongoing crossfade
    clearCrossfadeState();

    // Stop next audio if it was pre-loading something
    if (nextAudio) {
      nextAudio.pause();
      nextAudio.src = '';
    }

    // Abort any pending play, then swap src
    activeAudio.pause();
    setPosition(0);
    setDuration(0);

    // Record history
    recordPlay(current);
    flushListenSeconds();

    const targetVol = mutedRef.current ? 0 : volumeRef.current;

    const doPlay = () => {
      if (!activeAudio) return;
      activeAudio.volume = targetVol;
      activeAudio.play().catch((err: DOMException) => {
        if (err.name === 'AbortError') return;
        console.error('[player] play() failed:', err.name, err.message);
        setIsPlaying(false);
      });
    };

    let played = false;
    const onCanPlay = () => {
      if (played) return;
      played = true;
      activeAudio?.removeEventListener('canplay', onCanPlay);
      doPlay();
    };

    activeAudio.addEventListener('canplay', onCanPlay);
    activeAudio.src = current.src;
    activeAudio.load();

    return () => {
      activeAudio?.removeEventListener('canplay', onCanPlay);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // ── Listening-time accumulator ──────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => addListenSeconds(1), 1000);
    return () => clearInterval(id);
  }, [isPlaying]);

  // Sync volume / mute to active audio
  useEffect(() => {
    if (!activeAudio) return;
    // Don't override volume mid-crossfade (the ramp owns it)
    if (crossfadeInProgressRef.current) return;
    activeAudio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  /* ---------------- queue helpers ---------------- */

  const rebuildQueue = useCallback((activeId: string) => {
    const source = sourceQueueRef.current;
    if (!source.length) { setQueue([]); setIndex(0); return; }
    if (shuffleRef.current) {
      const active = source.find((s) => s.id === activeId) ?? source[0];
      const rest = shuffleArray(source.filter((s) => s.id !== active.id));
      setQueue([active, ...rest]);
      setIndex(0);
    } else {
      setQueue(source);
      const i = source.findIndex((s) => s.id === activeId);
      setIndex(i < 0 ? 0 : i);
    }
  }, []);

  /* ---------------- controls ---------------- */

  const playSongs = useCallback((list: Song[], startId?: string) => {
    if (!list.length) return;
    if (!canGuestPlaySong()) {
      console.warn('[player] guest playback limit reached');
      return;
    }
    if (!consumeGuestPlayback()) {
      console.warn('[player] consumeGuestPlayback failed');
      return;
    }

    const start = startId ?? list[0].id;
    sourceQueueRef.current = list;
    const i = list.findIndex((s) => s.id === start);
    const startIndex = i < 0 ? 0 : i;

    let newQueue: Song[];
    let newIndex: number;

    if (shuffleRef.current) {
      const active = list[startIndex];
      const rest = shuffleArray(list.filter((s) => s.id !== active.id));
      newQueue = [active, ...rest];
      newIndex = 0;
    } else {
      newQueue = list;
      newIndex = startIndex;
    }

    const song = newQueue[newIndex];
    if (!song?.src) {
      console.warn('[player] playSongs: song has no src', song);
      return;
    }

    setQueue(newQueue);
    setIndex(newIndex);
    setHasStarted(true);
    setIsPlaying(true);
  }, []);

  const togglePlay = useCallback(() => {
    if (!activeAudio || !currentRef.current) return;
    if (activeAudio.paused) {
      setHasStarted(true);
      if (!activeAudio.src || activeAudio.src === window.location.href) {
        const song = currentRef.current;
        if (song?.src) {
          activeAudio.src = song.src;
          activeAudio.load();
        }
      }
      activeAudio.play().catch((err: DOMException) => {
        if (err.name === 'AbortError') return;
        console.error('[player] togglePlay play() failed:', err.name, err.message);
        setIsPlaying(false);
      });
    } else {
      activeAudio.pause();
    }
  }, []);

  const next = useCallback(() => {
    const q = queueRef.current;
    const idx = indexRef.current;
    const rep = repeatRef.current;
    if (!q.length) return;

    const nextIdx = idx < q.length - 1 ? idx + 1 : rep === 'all' ? 0 : idx;
    if (nextIdx === idx) return;

    clearCrossfadeState();
    setIndex(nextIdx);
    setIsPlaying(true);
  }, [clearCrossfadeState]);

  const prev = useCallback(() => {
    if (activeAudio && activeAudio.currentTime > 3) {
      activeAudio.currentTime = 0;
      setPosition(0);
      return;
    }
    const idx = indexRef.current;
    const prevIdx = idx > 0 ? idx - 1 : 0;
    clearCrossfadeState();
    setIndex(prevIdx);
    setIsPlaying(true);
  }, [clearCrossfadeState]);

  const seek = useCallback((seconds: number) => {
    if (!activeAudio) return;
    activeAudio.currentTime = seconds;
    setPosition(seconds);
    // After seek, reset crossfade state so it can re-arm at the new position
    clearCrossfadeState();
  }, [clearCrossfadeState]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (v > 0) setMuted(false);
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const cycleRepeat = useCallback(
    () => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')),
    [],
  );

  const toggleShuffle = useCallback(() => {
    const next = !shuffleRef.current;
    shuffleRef.current = next;
    setShuffle(next);
    const activeId = queueRef.current[indexRef.current]?.id;
    if (activeId) rebuildQueue(activeId);
  }, [rebuildQueue]);

  const playNext = useCallback((song: Song) => {
    setQueue((q) => {
      const idx = indexRef.current;
      const without = q.filter((s) => s.id !== song.id);
      const newIdx = without.findIndex((s) => s.id === q[idx]?.id);
      const base = newIdx < 0 ? idx : newIdx;
      return [...without.slice(0, base + 1), song, ...without.slice(base + 1)];
    });
    sourceQueueRef.current = [...sourceQueueRef.current, song];
  }, []);

  const jumpToQueueItem = useCallback((songId: string) => {
    const idx = queueRef.current.findIndex((s) => s.id === songId);
    if (idx < 0) return;
    clearCrossfadeState();
    setIndex(idx);
    setIsPlaying(true);
  }, [clearCrossfadeState]);

  /* ---------------- auto-queue refill ---------------- */

  const isFetchingMoreRef = useRef(false);

  useEffect(() => {
    if (repeat !== 'off') return;
    if (!current) return;
    if (queue.length - 1 - index > 2) return;
    if (isFetchingMoreRef.current) return;
    if (!getSettings().autoPlay) return;

    isFetchingMoreRef.current = true;
    const existingIds = new Set(queue.map((s) => s.id));

    searchSongs(current.artist, 15)
      .then((results) => {
        const fresh = results.filter((s) => !existingIds.has(s.id)).slice(0, 10);
        if (!fresh.length) return;
        setQueue((q) => [...q, ...fresh]);
        sourceQueueRef.current = [...sourceQueueRef.current, ...fresh];
      })
      .catch(() => {})
      .finally(() => { isFetchingMoreRef.current = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, queue.length, repeat]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue, index, current, isPlaying, position, duration, volume, muted,
      repeat, shuffle, hasStarted,
      playSongs, togglePlay, next, prev, seek, setVolume, toggleMute,
      cycleRepeat, toggleShuffle, playNext, jumpToQueueItem,
    }),
    [
      queue, index, current, isPlaying, position, duration, volume, muted,
      repeat, shuffle, hasStarted, playSongs, togglePlay, next, prev, seek,
      setVolume, toggleMute, cycleRepeat, toggleShuffle, playNext, jumpToQueueItem,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function useIsCurrent(id: string): boolean {
  const { current } = usePlayer();
  return current?.id === id;
}
