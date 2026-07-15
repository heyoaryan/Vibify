/**
 * Liked Songs — persisted in localStorage.
 *
 * Stores the full Song object so the Library view can show
 * liked songs even if they came from the live JioSaavn API
 * (i.e. they won't be in the static songs array).
 */

import { useEffect, useState } from 'react';
import type { Song } from './types';

const STORAGE_KEY = 'vibify_liked_songs_v1';

// ── In-memory store ──────────────────────────────────────────────────────────

function load(): Song[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Song[]) : [];
  } catch {
    return [];
  }
}

function save(songs: Song[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  } catch { /* quota exceeded — ignore */ }
}

let _liked: Song[] = load();
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach(fn => fn());
}

// ── Public API ───────────────────────────────────────────────────────────────

/** All liked songs, most-recently-liked first */
export function getLikedSongs(): Song[] {
  return _liked;
}

/** Whether a song id is currently liked */
export function isLiked(songId: string): boolean {
  return _liked.some(s => s.id === songId);
}

/** Like a song. No-op if already liked. */
export function likeSong(song: Song): void {
  if (isLiked(song.id)) return;
  _liked = [song, ..._liked];
  save(_liked);
  notify();
}

/** Unlike a song. No-op if not liked. */
export function unlikeSong(songId: string): void {
  if (!isLiked(songId)) return;
  _liked = _liked.filter(s => s.id !== songId);
  save(_liked);
  notify();
}

/** Toggle liked state. Returns the new state. */
export function toggleLike(song: Song): boolean {
  if (isLiked(song.id)) {
    unlikeSong(song.id);
    return false;
  } else {
    likeSong(song);
    return true;
  }
}

/** Subscribe to any change. Returns unsubscribe fn. */
export function onLikesChange(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// ── React hook ───────────────────────────────────────────────────────────────

/** Re-renders whenever liked songs change. */
export function useLikes() {
  const [liked, setLiked] = useState<Song[]>(() => getLikedSongs());

  useEffect(() => {
    // Sync across tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        _liked = load();
        setLiked([..._liked]);
      }
    };
    window.addEventListener('storage', onStorage);
    const unsub = onLikesChange(() => setLiked([...getLikedSongs()]));
    return () => {
      window.removeEventListener('storage', onStorage);
      unsub();
    };
  }, []);

  return {
    likedSongs: liked,
    isLiked: (id: string) => liked.some(s => s.id === id),
    toggle: toggleLike,
  };
}
