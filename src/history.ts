/**
 * history.ts — Recently played & listening-time tracker
 *
 * Local-first: everything is written to localStorage instantly so it works
 * offline and survives page reloads with zero latency.
 *
 * Supabase sync: when a user is signed in, plays and time are also upserted
 * to two tables (created lazily via the Supabase client — no migration needed
 * if the tables don't exist yet; writes are silently skipped on error):
 *
 *   play_history  (user_id, song_id, title, artist, image_url, hue, played_at)
 *   listen_stats  (user_id, total_seconds, updated_at)
 *
 * Public API
 * ──────────
 *   recordPlay(song)          call when a new song starts playing
 *   addListenSeconds(n)       call every N seconds while a song is playing
 *   getRecentlyPlayed()       → RecentPlay[] (up to MAX_RECENT items)
 *   getTotalListenSeconds()   → number
 *   useRecentlyPlayed()       React hook — live list
 *   useListenStats()          React hook — { totalSeconds, hours, minutes }
 */

import { useEffect, useState } from 'react';
import type { Song } from './types';
import { getCurrentUser } from './auth';
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecentPlay = {
  songId: string;
  title: string;
  artist: string;
  imageUrl?: string;
  hue: number;
  playedAt: number; // unix ms
};

export type ListenStats = {
  totalSeconds: number;
  hours: number;
  minutes: number;
};

// ─── Storage keys ─────────────────────────────────────────────────────────────

const HISTORY_KEY = 'vibify-play-history';
const LISTEN_KEY = 'vibify-listen-seconds';
const MAX_RECENT = 30; // keep the last 30 plays locally

// ─── Local storage helpers ────────────────────────────────────────────────────

function loadHistory(): RecentPlay[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as RecentPlay[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(list: RecentPlay[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch { /* quota */ }
}

function loadListenSeconds(): number {
  try {
    return Number(localStorage.getItem(LISTEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveListenSeconds(n: number) {
  try {
    localStorage.setItem(LISTEN_KEY, String(Math.floor(n)));
  } catch { /* quota */ }
}

// ─── In-memory state ──────────────────────────────────────────────────────────

let _history: RecentPlay[] = loadHistory();
let _listenSeconds: number = loadListenSeconds();
const _historyListeners = new Set<() => void>();
const _statsListeners = new Set<() => void>();

function notifyHistory() {
  _historyListeners.forEach((fn) => fn());
}

function notifyStats() {
  _statsListeners.forEach((fn) => fn());
}

// ─── Supabase fetch (on login) ────────────────────────────────────────────────

/**
 * Fetch this user's play history from Supabase and merge it with the local
 * list.  Called once when a signed-in user is detected so that recently-played
 * reflects their account history rather than just the current device's cache.
 */
export async function loadHistoryFromSupabase(): Promise<void> {
  const user = getCurrentUser();
  if (user.isGuest) return;

  try {
    const { data, error } = await supabase
      .from('play_history')
      .select('song_id, title, artist, image_url, hue, played_at')
      .eq('user_id', user.id)
      .order('played_at', { ascending: false })
      .limit(MAX_RECENT);

    if (error || !data) return;

    const remote: RecentPlay[] = data.map((row) => ({
      songId: row.song_id as string,
      title: row.title as string,
      artist: row.artist as string,
      imageUrl: (row.image_url as string | null) ?? undefined,
      hue: (row.hue as number) ?? 200,
      playedAt: new Date(row.played_at as string).getTime(),
    }));

    // Merge: combine remote + local, dedupe by songId (keep most-recent timestamp),
    // sort newest-first, cap at MAX_RECENT.
    const merged = new Map<string, RecentPlay>();
    for (const play of [...remote, ..._history]) {
      const existing = merged.get(play.songId);
      if (!existing || play.playedAt > existing.playedAt) {
        merged.set(play.songId, play);
      }
    }

    _history = Array.from(merged.values())
      .sort((a, b) => b.playedAt - a.playedAt)
      .slice(0, MAX_RECENT);

    saveHistory(_history);
    notifyHistory();
  } catch {
    // Silent fail — local data is the source of truth
  }
}

// ─── Supabase sync (fire-and-forget) ─────────────────────────────────────────

async function syncPlayToSupabase(play: RecentPlay) {
  const user = getCurrentUser();
  if (user.isGuest) return;

  try {
    await supabase.from('play_history').insert({
      user_id: user.id,
      song_id: play.songId,
      title: play.title,
      artist: play.artist,
      image_url: play.imageUrl ?? null,
      hue: play.hue,
      played_at: new Date(play.playedAt).toISOString(),
    });
  } catch {
    // Supabase table may not exist yet — silent fail, local data is the source of truth
  }
}

async function syncListenSecondsToSupabase(total: number) {
  const user = getCurrentUser();
  if (user.isGuest) return;

  try {
    await supabase.from('listen_stats').upsert(
      {
        user_id: user.id,
        total_seconds: total,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  } catch {
    // Silent fail
  }
}

// Debounce listen-seconds sync so we don't hammer Supabase every second
let _syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSyncListenSeconds() {
  if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
  _syncDebounceTimer = setTimeout(() => {
    syncListenSecondsToSupabase(_listenSeconds);
  }, 10_000); // sync at most every 10 s
}

// ─── Public write API ─────────────────────────────────────────────────────────

/**
 * Call this when a new song starts playing.
 * Prepends the song to the recent-plays list (deduped: same song moved to top).
 */
export function recordPlay(song: Song) {
  const play: RecentPlay = {
    songId: song.id,
    title: song.title,
    artist: song.artist,
    imageUrl: song.imageUrl,
    hue: song.hue,
    playedAt: Date.now(),
  };

  // Remove any prior entry for this song, then prepend
  _history = [play, ..._history.filter((p) => p.songId !== song.id)].slice(0, MAX_RECENT);
  saveHistory(_history);
  notifyHistory();

  // Async Supabase sync — doesn't block playback
  syncPlayToSupabase(play);
}

/**
 * Accumulate listening time (call once per second while audio is playing).
 * Batches localStorage writes — only persists every 30 seconds to reduce I/O.
 * Stats listeners are only notified when the visible value (minutes) changes,
 * not on every single second tick.
 */
let _unsavedSeconds = 0;
let _lastNotifiedMinutes = -1; // track what minute count was last broadcast
export function addListenSeconds(n: number) {
  _listenSeconds += n;
  _unsavedSeconds += n;

  // Flush to localStorage every 30 accumulated seconds
  if (_unsavedSeconds >= 30) {
    saveListenSeconds(_listenSeconds);
    _unsavedSeconds = 0;
  }

  // Only wake up stat-subscribers when the displayed minute value changes
  // (i.e. every ~60 seconds) instead of every single second.
  const currentMinutes = Math.floor(_listenSeconds / 60);
  if (currentMinutes !== _lastNotifiedMinutes) {
    _lastNotifiedMinutes = currentMinutes;
    notifyStats();
  }

  scheduleSyncListenSeconds();
}

/** Force-flush any unsaved seconds (call on page unload / song change) */
export function flushListenSeconds() {
  if (_unsavedSeconds > 0) {
    saveListenSeconds(_listenSeconds);
    _unsavedSeconds = 0;
  }
}

// ─── Public read API ──────────────────────────────────────────────────────────

export function getRecentlyPlayed(): RecentPlay[] {
  return _history;
}

export function getTotalListenSeconds(): number {
  return _listenSeconds;
}

export function getListenStats(): ListenStats {
  const total = _listenSeconds;
  return {
    totalSeconds: total,
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
  };
}

// ─── React hooks ─────────────────────────────────────────────────────────────

export function useRecentlyPlayed(): RecentPlay[] {
  const [list, setList] = useState<RecentPlay[]>(() => getRecentlyPlayed());

  useEffect(() => {
    // Sync on mount in case state resolved after render
    setList(getRecentlyPlayed());
    const fn = () => setList([...getRecentlyPlayed()]);
    _historyListeners.add(fn);

    // Fetch account history from Supabase once on mount (if signed in).
    // loadHistoryFromSupabase() notifies listeners when done, so setList fires
    // automatically via the fn listener already registered above.
    loadHistoryFromSupabase();

    return () => { _historyListeners.delete(fn); };
  }, []);

  return list;
}

export function useListenStats(): ListenStats {
  const [stats, setStats] = useState<ListenStats>(() => getListenStats());

  useEffect(() => {
    setStats(getListenStats());
    const fn = () => setStats(getListenStats());
    _statsListeners.add(fn);
    return () => { _statsListeners.delete(fn); };
  }, []);

  return stats;
}

// ─── Auth-change re-fetch ─────────────────────────────────────────────────────
// When the user signs in (e.g., after OAuth redirect), pull their history from
// Supabase so the recently-played list reflects their account straight away.
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      loadHistoryFromSupabase();
    }
    if (event === 'SIGNED_OUT') {
      // Clear to local-only after sign-out
      _history = loadHistory();
      notifyHistory();
    }
  });
}

// ─── Cross-tab sync ───────────────────────────────────────────────────────────
// If the user has multiple tabs open, keep history and stats in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === HISTORY_KEY) {
      _history = loadHistory();
      notifyHistory();
    }
    if (e.key === LISTEN_KEY) {
      _listenSeconds = loadListenSeconds();
      notifyStats();
    }
  });

  // Flush on tab close / navigate away
  window.addEventListener('beforeunload', flushListenSeconds);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushListenSeconds();
  });
}
