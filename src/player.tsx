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
import { canGuestPlaySong, consumeGuestPlayback } from './auth';
import { getSettings } from './settings';
import { recordPlay, addListenSeconds, flushListenSeconds } from './history';
import { getQuickRecommendations } from './recommendations';
import { getJamendoTrackUrl, isJamendoId } from './jamendo';

// ─── Context is split into two parts ─────────────────────────────────────────
// 1. PlayerContext  — stable state that changes only on song/control changes
//    (current, queue, isPlaying, volume, repeat, shuffle, actions…)
//    Components that don't need scrubbing (PlayerBar, HomeView, SearchView…)
//    subscribe to this one — they DON'T re-render at 60fps.
//
// 2. PlaybackContext — high-frequency state (position, duration)
//    Only components that display a seek bar / lyric sync subscribe to this.

type PlayerContextValue = {
  queue: Song[];
  index: number;
  current: Song | null;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  hasStarted: boolean;
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

type PlaybackContextValue = {
  position: number;
  duration: number;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);
const PlaybackContext = createContext<PlaybackContextValue>({ position: 0, duration: 0 });

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within <PlayerProvider>');
  return ctx;
}

/** Returns position + duration — updates at ~60fps. Only use where needed (seek bar, lyrics). */
export function usePlayback(): PlaybackContextValue {
  return useContext(PlaybackContext);
}

// ─── Two Audio elements for crossfade ────────────────────────────────────────
// audioA is the "active" element. audioB is the "next" element that fades in.
// After a crossfade completes, A and B swap roles.
function makeAudio() {
  if (typeof Audio === 'undefined') return null;
  const el = new Audio();
  el.preload = 'auto';
  return el;
}

const audioA = makeAudio();
const audioB = makeAudio();

// Pointer to the currently active audio element (starts as A)
let activeAudio: HTMLAudioElement | null = audioA;
let nextAudio: HTMLAudioElement | null = audioB;

// ─── Web Audio API for enhanced sound quality ─────────────────────────────────
let audioCtx: AudioContext | null = null;
let sourceA: MediaElementAudioSourceNode | null = null;
let sourceB: MediaElementAudioSourceNode | null = null;
let bassFilter: BiquadFilterNode | null = null;
let compressor: DynamicsCompressorNode | null = null;

function ensureAudioContext() {
  if (!audioCtx && typeof AudioContext !== 'undefined') {
    try {
      audioCtx = new AudioContext();
      sourceA = audioCtx.createMediaElementSource(audioA!);
      sourceB = audioCtx.createMediaElementSource(audioB!);
      bassFilter = audioCtx.createBiquadFilter();
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = 200;
      bassFilter.gain.value = 6;

      compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 30;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      sourceA.connect(bassFilter).connect(compressor).connect(audioCtx.destination);
      sourceB.connect(bassFilter).connect(compressor).connect(audioCtx.destination);
    } catch (e) {
      console.warn('[audio] Web Audio API not available:', e);
    }
  }
  if (audioCtx?.state === 'suspended') {
    audioCtx.resume();
  }
}

function downgradeQuality(src: string): string | null {
  const mp4 = src.match(/_(\d+)\.mp4$/);
  if (mp4) {
    const q = parseInt(mp4[1]);
    if (q >= 320) return src.replace(/_320\.mp4$/, '_160.mp4');
    if (q >= 160) return src.replace(/_160\.mp4$/, '_96.mp4');
    return null;
  }
  const mp3 = src.match(/_(\d+)k\.mp3$/);
  if (mp3) {
    const q = parseInt(mp3[1]);
    if (q >= 320) return src.replace(/_320k\.mp3$/, '_160k.mp3');
    if (q >= 160) return src.replace(/_160k\.mp3$/, '_96k.mp3');
    return null;
  }
  return null;
}

/**
 * iOS Safari (and some Android WebViews) silently block audio playback until
 * the user has interacted with the page. We unlock the audio element on the
 * first touchstart/click by playing a zero-duration silent buffer and
 * immediately pausing it.
 */
function unlockAudioOnFirstGesture() {
  const unlock = () => {
    ensureAudioContext();
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

// ─── Media Session API ────────────────────────────────────────────────────────
// Sets the browser's "Now Playing" metadata — shown on lockscreen, notification
// shade, headset controls, and browser media overlay on all platforms.
function updateMediaSession(song: Song | null) {
  if (!('mediaSession' in navigator)) return;
  if (!song) {
    navigator.mediaSession.metadata = null;
    return;
  }

  const artwork: MediaImage[] = [];
  if (song.imageUrl) {
    artwork.push(
      { src: song.imageUrl, sizes: '96x96',   type: 'image/jpeg' },
      { src: song.imageUrl, sizes: '128x128',  type: 'image/jpeg' },
      { src: song.imageUrl, sizes: '192x192',  type: 'image/jpeg' },
      { src: song.imageUrl, sizes: '256x256',  type: 'image/jpeg' },
      { src: song.imageUrl, sizes: '512x512',  type: 'image/jpeg' },
    );
  } else {
    // Fallback: use the app icon
    artwork.push(
      { src: '/icons/logo.png', sizes: '1024x1024', type: 'image/png' },
    );
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title:  song.title,
    artist: song.artist,
    album:  song.album || 'Vibify',
    artwork,
  });
}

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
  const playedRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  /** Clear pending retry timers and reset retry counter */
  const clearRetryState = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    retryCountRef.current = 0;
    playedRef.current = false;
  }, []);

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
    clearRetryState();
  }, [clearRetryState]);

  const handlePlaybackFailure = useCallback(async () => {
    if (!activeAudio || !currentRef.current) return;
    const song = currentRef.current;
    const retries = retryCountRef.current;

    // For Jamendo tracks, try refreshing the expired streaming URL first
    if (isJamendoId(song.id)) {
      try {
        const freshUrl = await getJamendoTrackUrl(song.id);
        if (freshUrl) {
          retryCountRef.current = 0;
          playedRef.current = false;
          activeAudio.src = freshUrl;
          activeAudio.load();
          activeAudio.play().catch(() => {});
          setQueue(q => q.map(s => s.id === song.id ? { ...s, src: freshUrl } : s));
          sourceQueueRef.current = sourceQueueRef.current.map(s => s.id === song.id ? { ...s, src: freshUrl } : s);
          return;
        }
      } catch {
        // fall through to normal retry logic
      }
    }

    if (retries < 3) {
      retryCountRef.current = retries + 1;
      const delay = Math.pow(2, retries) * 1000;
      retryTimerRef.current = setTimeout(() => {
        if (!activeAudio) return;
        playedRef.current = false;
        activeAudio.load();
        activeAudio.play().catch(() => {});
      }, delay);
    } else {
      const lowerSrc = downgradeQuality(activeAudio.src);
      if (lowerSrc) {
        retryCountRef.current = 0;
        playedRef.current = false;
        activeAudio.src = lowerSrc;
        activeAudio.load();
        activeAudio.play().catch(() => {});
      } else {
        setIsPlaying(false);
      }
    }
  }, []);

  /**
   * Advance to the next index — used both by native 'ended' and crossfade.
   * Does NOT touch audio directly; song-load effect handles that.
   */
  const advanceIndex = useCallback(() => {
    clearRetryState();
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
  }, [clearCrossfadeState, clearRetryState]);

  // ─── Crossfade trigger — runs inside the rAF tick, zero React re-renders ──
  // By moving this into the rAF loop we avoid the expensive useEffect that
  // previously re-ran on every single position state update (~60fps).
  const durationRef = useRef(0);
  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlaying;
  durationRef.current = duration;

  const tryCrossfade = useCallback(() => {
    const { crossfadeSecs } = getSettings();
    if (!crossfadeSecs || crossfadeSecs <= 0) return;
    if (!durationRef.current || durationRef.current < crossfadeSecs * 2) return;
    if (!isPlayingRef.current) return;
    if (crossfadeFiredRef.current) return;
    if (!activeAudio) return;

    const remaining = durationRef.current - activeAudio.currentTime;
    if (remaining > crossfadeSecs + 0.3) return;

    crossfadeFiredRef.current = true;
    crossfadeInProgressRef.current = true;

    const q = queueRef.current;
    const idx = indexRef.current;
    const rep = repeatRef.current;
    const targetVol = mutedRef.current ? 0 : volumeRef.current;
    const fadeMs = crossfadeSecs * 1000;

    let nextIdx: number | null = null;
    if (rep === 'one') { nextIdx = idx; }
    else if (idx < q.length - 1) { nextIdx = idx + 1; }
    else if (rep === 'all' && q.length > 0) { nextIdx = 0; }

    if (nextIdx === null || !nextAudio) {
      cancelFadeOutRef.current = rampVolume(activeAudio, targetVol, 0, fadeMs);
      return;
    }

    const nextSong = q[nextIdx];
    if (!nextSong?.src) return;

    nextAudio.src = nextSong.src;
    nextAudio.volume = 0;
    nextAudio.load();

    const startCrossfade = () => {
      if (!nextAudio || !activeAudio) return;
      cancelFadeOutRef.current = rampVolume(activeAudio, targetVol, 0, fadeMs);
      nextAudio.play().catch((err: DOMException) => {
        if (err.name !== 'AbortError') console.error('[crossfade] nextAudio.play() failed:', err.name);
      });
      cancelFadeInRef.current = rampVolume(nextAudio, 0, targetVol, fadeMs, () => {
        if (!activeAudio || !nextAudio) return;
        activeAudio.pause();
        activeAudio.src = '';
        const tmp = activeAudio;
        activeAudio = nextAudio;
        nextAudio = tmp;
        rewireListeners();
        flushListenSeconds();
        recordPlay(nextSong);
        const newDur = isNaN(activeAudio.duration) ? 0 : activeAudio.duration;
        const newPos = isNaN(activeAudio.currentTime) ? 0 : activeAudio.currentTime;
        setDuration(newDur);
        setPosition(newPos);
        updateMediaSession(nextSong);
        crossfadeLoadedIdRef.current = nextSong.id;
        crossfadeInProgressRef.current = false;
        crossfadeFiredRef.current = false;
        setIndex(nextIdx!);
      });
    };

    if (nextAudio.readyState >= 3) {
      startCrossfade();
    } else {
      const onReady = () => { nextAudio?.removeEventListener('canplay', onReady); startCrossfade(); };
      nextAudio.addEventListener('canplay', onReady);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Wire up audio element events once ──────────────────────────────────────
  // The rAF tick throttles position updates: only calls setPosition when the
  // value has changed by more than 100ms, cutting React renders ~10× vs 60fps.
  useEffect(() => {
    if (!activeAudio) return;

    let lastReportedTime = -1;

    const startTick = () => {
      const tick = () => {
        if (!activeAudio) return;
        const t = activeAudio.currentTime;
        // Only update React state when position moved by ≥100 ms — this cuts
        // render frequency from 60fps down to ~10fps for the seek bar while
        // still looking smooth on screen.
        if (Math.abs(t - lastReportedTime) >= 0.1) {
          lastReportedTime = t;
          setPosition(t);
        }
        // Crossfade check runs every rAF frame but does real work only once
        // per song (guarded by crossfadeFiredRef), so it's effectively free.
        tryCrossfade();
        rafRef.current = requestAnimationFrame(tick);
      };
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    const onPlay = () => {
      setIsPlaying(true);
      clearRetryState();
      startTick();
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
      if (crossfadeInProgressRef.current) return;
      advanceIndex();
    };

    const onError = () => {
      if (!activeAudio) return;
      console.error('Audio error:', activeAudio.error?.message, activeAudio.src);
      handlePlaybackFailure();
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

  // ─── Rewire listeners when active/next swap ──────────────────────────────────
  function rewireListeners() {
    if (!activeAudio) return;

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

    // Restart throttled rAF on the new element
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    let lastT = -1;
    const tick = () => {
      if (!activeAudio) return;
      const t = activeAudio.currentTime;
      if (Math.abs(t - lastT) >= 0.1) { lastT = t; setPosition(t); }
      tryCrossfade();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  // Named handlers so we can add/remove them in rewireListeners
  function handlePlay() {
    setIsPlaying(true);
    clearRetryState();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    let lastT = -1;
    const tick = () => {
      if (!activeAudio) return;
      const t = activeAudio.currentTime;
      if (Math.abs(t - lastT) >= 0.1) { lastT = t; setPosition(t); }
      tryCrossfade();
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
    handlePlaybackFailure();
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

    // Cancel any ongoing crossfade or retry
    clearCrossfadeState();
    clearRetryState();

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

    // Update lockscreen / notification metadata immediately on song change
    updateMediaSession(current);

    const targetVol = mutedRef.current ? 0 : volumeRef.current;

    const doPlay = () => {
      if (!activeAudio) return;
      activeAudio.volume = targetVol;
      activeAudio.play().catch((err: DOMException) => {
        if (err.name === 'AbortError') return;
        console.error('[player] play() failed:', err.name, err.message);
        handlePlaybackFailure();
      });
    };

    const onCanPlay = () => {
      if (playedRef.current) return;
      playedRef.current = true;
      activeAudio?.removeEventListener('canplay', onCanPlay);
      doPlay();
    };

    activeAudio.addEventListener('canplay', onCanPlay);
    activeAudio.src = current.src;
    activeAudio.load();

    return () => {
      activeAudio?.removeEventListener('canplay', onCanPlay);
      playedRef.current = false;
      clearRetryState();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // ── Listening-time accumulator ──────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => addListenSeconds(1), 1000);
    return () => clearInterval(id);
  }, [isPlaying]);

  // ── Media Session playback state + action handlers ───────────────────────────
  // Keeps the lockscreen play/pause button, seek bar, and hardware controls
  // in sync with the actual player state.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    // Register hardware/notification button handlers once
    navigator.mediaSession.setActionHandler('play',         () => { activeAudio?.play().catch(() => {}); });
    navigator.mediaSession.setActionHandler('pause',        () => { activeAudio?.pause(); });
    navigator.mediaSession.setActionHandler('previoustrack', () => prev());
    navigator.mediaSession.setActionHandler('nexttrack',    () => next());
    navigator.mediaSession.setActionHandler('stop',         () => { activeAudio?.pause(); setPosition(0); });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) seek(details.seekTime);
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const skipTime = details.seekOffset ?? 10;
      seek(Math.max(0, (activeAudio?.currentTime ?? 0) - skipTime));
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const skipTime = details.seekOffset ?? 10;
      const dur = activeAudio?.duration ?? 0;
      seek(Math.min(dur, (activeAudio?.currentTime ?? 0) + skipTime));
    });

    return () => {
      if (!('mediaSession' in navigator)) return;
      (['play','pause','previoustrack','nexttrack','stop','seekto','seekbackward','seekforward'] as MediaSessionAction[])
        .forEach(a => { try { navigator.mediaSession.setActionHandler(a, null); } catch { /* unsupported */ } });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep Media Session position state in sync (~1s precision is enough for OS)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
    if (!duration || duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(position, duration),
      });
    } catch { /* some browsers throw if duration is Infinity */ }
  // Run on every position change — but position only updates ~10fps now
  }, [position, duration]);

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
          clearRetryState();
          playedRef.current = false;
          activeAudio.src = song.src;
          activeAudio.load();
        }
      }
      activeAudio.play().catch((err: DOMException) => {
        if (err.name === 'AbortError') return;
        console.error('[player] togglePlay play() failed:', err.name, err.message);
        handlePlaybackFailure();
      });
    } else {
      activeAudio.pause();
    }
  }, [handlePlaybackFailure, clearRetryState]);

  const next = useCallback(() => {
    const q = queueRef.current;
    const idx = indexRef.current;
    const rep = repeatRef.current;
    if (!q.length) return;

    const nextIdx = idx < q.length - 1 ? idx + 1 : rep === 'all' ? 0 : idx;
    if (nextIdx === idx) return;

    clearRetryState();
    clearCrossfadeState();
    setIndex(nextIdx);
    setIsPlaying(true);
  }, [clearCrossfadeState, clearRetryState]);

  const prev = useCallback(() => {
    if (activeAudio && activeAudio.currentTime > 3) {
      activeAudio.currentTime = 0;
      setPosition(0);
      clearRetryState();
      return;
    }
    const idx = indexRef.current;
    const prevIdx = idx > 0 ? idx - 1 : 0;
    clearRetryState();
    clearCrossfadeState();
    setIndex(prevIdx);
    setIsPlaying(true);
  }, [clearCrossfadeState, clearRetryState]);

  const seek = useCallback((seconds: number) => {
    if (!activeAudio) return;
    activeAudio.currentTime = seconds;
    setPosition(seconds);
    clearRetryState();
    // After seek, reset crossfade state so it can re-arm at the new position
    clearCrossfadeState();
  }, [clearCrossfadeState, clearRetryState]);

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
    clearRetryState();
    clearCrossfadeState();
    setIndex(idx);
    setIsPlaying(true);
  }, [clearCrossfadeState, clearRetryState]);

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

    getQuickRecommendations(current.artist, 10)
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

  // Stable player value — does NOT include position/duration so it only
  // changes when a song actually changes, not every animation frame.
  const value = useMemo<PlayerContextValue>(
    () => ({
      queue, index, current, isPlaying, volume, muted,
      repeat, shuffle, hasStarted,
      playSongs, togglePlay, next, prev, seek, setVolume, toggleMute,
      cycleRepeat, toggleShuffle, playNext, jumpToQueueItem,
    }),
    [
      queue, index, current, isPlaying, volume, muted,
      repeat, shuffle, hasStarted, playSongs, togglePlay, next, prev, seek,
      setVolume, toggleMute, cycleRepeat, toggleShuffle, playNext, jumpToQueueItem,
    ],
  );

  // High-frequency playback value — updates at ~60fps but only consumed
  // by components that actually need the seek position.
  const playback = useMemo<PlaybackContextValue>(
    () => ({ position, duration }),
    [position, duration],
  );

  return (
    <PlayerContext.Provider value={value}>
      <PlaybackContext.Provider value={playback}>
        {children}
      </PlaybackContext.Provider>
    </PlayerContext.Provider>
  );
}

export function useIsCurrent(id: string): boolean {
  const { current } = usePlayer();
  return current?.id === id;
}
