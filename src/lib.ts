import { ALL_SONGS, ALL_PLAYLISTS } from './data';
import type { Playlist, Song } from './types';

export const songById = (id: string): Song | undefined =>
  ALL_SONGS.find((s) => s.id === id);

export const playlistById = (id: string): Playlist | undefined =>
  ALL_PLAYLISTS.find((p) => p.id === id);

export const songsByIds = (ids: string[]): Song[] =>
  ids.map(songById).filter((s): s is Song => Boolean(s));

export const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  // Hours only shown for genuinely long tracks (podcasts, mixes) to avoid
  // an awkward "0:3:45" on normal songs.
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

/** Deterministic gradient style from a song/playlist hue pair */
export function gradientStyle(hue: number, hue2: number, angle = 135): string {
  return `linear-gradient(${angle}deg, hsl(${hue} 70% 45%), hsl(${hue2} 70% 30%))`;
}

/** A softer, larger gradient for hero backgrounds */
export function heroGradient(hue: number, hue2: number): string {
  return `linear-gradient(160deg, hsl(${hue} 55% 20%) 0%, hsl(${hue2} 45% 12%) 45%, #05090c 100%)`;
}

/** Build a shuffled copy of an array (Fisher–Yates) */
export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export { ALL_SONGS, ALL_PLAYLISTS };
