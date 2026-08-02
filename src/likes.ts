/**
 * Liked Songs — local-first with Supabase cross-device sync.
 *
 * Local writes happen instantly (localStorage + in-memory).
 * Supabase writes are fire-and-forget — they never block the UI.
 *
 * On sign-in, loadLikesFromSupabase() merges the remote liked list with the
 * local one so the same account shows the same liked songs on every device.
 *
 * Supabase table: liked_songs
 *   (user_id, song_id, title, artist, album, year, duration, hue, hue2,
 *    src, genre, image_url, liked_at)
 */

import { useEffect, useState } from 'react';
import type { Song } from './types';
import { getCurrentUser } from './auth';
import { supabase } from './supabase';

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

// ── Supabase fetch (called once on sign-in) ──────────────────────────────────

/**
 * Fetch this user's liked songs from Supabase and merge with the local list.
 * Remote wins on conflict (same song_id → keep it in the liked list).
 * Called from App.tsx whenever the auth state changes to a real user.
 */
export async function loadLikesFromSupabase(): Promise<void> {
  const user = getCurrentUser();
  if (user.isGuest) return;

  try {
    const { data, error } = await supabase
      .from('liked_songs')
      .select('song_id, title, artist, album, year, duration, hue, hue2, src, genre, image_url')
      .eq('user_id', user.id)
      .order('liked_at', { ascending: false });

    if (error || !data) return;

    const remote: Song[] = data.map(row => ({
      id:       row.song_id as string,
      title:    row.title as string,
      artist:   row.artist as string,
      album:    (row.album as string) ?? '',
      year:     (row.year as number) ?? 0,
      duration: (row.duration as number) ?? 0,
      hue:      (row.hue as number) ?? 200,
      hue2:     (row.hue2 as number) ?? 220,
      src:      (row.src as string) ?? '',
      genre:    (row.genre as string) ?? '',
      imageUrl: (row.image_url as string | null) ?? undefined,
    }));

    // Merge: combine remote + local, dedupe by id (remote order preserved first)
    const seen = new Set<string>();
    const merged: Song[] = [];
    for (const song of [...remote, ..._liked]) {
      if (!seen.has(song.id)) {
        seen.add(song.id);
        merged.push(song);
      }
    }

    _liked = merged;
    save(_liked);
    notify();
  } catch {
    // Silent fail — local data is the source of truth offline
  }
}

// ── Supabase sync (fire-and-forget) ─────────────────────────────────────────

async function syncLikeToSupabase(song: Song): Promise<void> {
  const user = getCurrentUser();
  if (user.isGuest) return;

  try {
    await supabase.from('liked_songs').upsert(
      {
        user_id:   user.id,
        song_id:   song.id,
        title:     song.title,
        artist:    song.artist,
        album:     song.album ?? '',
        year:      song.year ?? 0,
        duration:  song.duration ?? 0,
        hue:       song.hue ?? 200,
        hue2:      song.hue2 ?? 220,
        src:       song.src ?? '',
        genre:     song.genre ?? '',
        image_url: song.imageUrl ?? null,
        liked_at:  new Date().toISOString(),
      },
      { onConflict: 'user_id,song_id' },
    );
  } catch {
    // Silent fail — local store already updated
  }
}

async function syncUnlikeToSupabase(songId: string): Promise<void> {
  const user = getCurrentUser();
  if (user.isGuest) return;

  try {
    await supabase
      .from('liked_songs')
      .delete()
      .eq('user_id', user.id)
      .eq('song_id', songId);
  } catch {
    // Silent fail
  }
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
  syncLikeToSupabase(song);
}

/** Unlike a song. No-op if not liked. */
export function unlikeSong(songId: string): void {
  if (!isLiked(songId)) return;
  _liked = _liked.filter(s => s.id !== songId);
  save(_liked);
  notify();
  syncUnlikeToSupabase(songId);
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
