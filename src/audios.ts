/**
 * Fallback audio API client — Audiomack
 *
 * Used when JioSaavn has no results for a query. Audiomack is a free
 * music API that provides direct streaming URLs.
 *
 * Docs: https://www.audiomack.com/data-api/docs
 *
 * Flow:
 *  1. GET /search?q=...&show=music  → { results: [...] }
 *  2. map each result to a Song (streaming_url holds the MP3)
 *
 * NOTE: the streaming_url is only valid for ~10s, so we request it at search
 * time and use it directly. If it expires mid-play, the player should refetch
 * via getAudiomackTrackUrl().
 */

import type { Song } from './types';

const AUDIOMACK_API = '/api/audiomack';

type AudiomackTrack = {
  id: number | string;
  title: string;
  artist: string;
  album?: string;
  image?: string;
  duration?: number;
  streaming_url?: string;
  stream_url?: string;
  url?: string;
  uploader?: { name?: string; image?: string };
};

type AudiomackSearchResponse = {
  results?: AudiomackTrack[];
  count?: number;
  errorcode?: number;
  message?: string;
};

function decodeHtml(raw: string): string {
  return raw
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .trim();
}

function cleanTitle(raw: string): string {
  let t = decodeHtml(raw);
  t = t.replace(/\s*[([]From\s+[^)\]]*[)\]]/gi, '');
  t = t.replace(/\s*[(](?:Remix|Remastered|Official|Lyrical?|Audio|Video|Full Song|HD|4K|feat\.?|ft\.?)[^)]*[)]/gi, '');
  return t.replace(/\s{2,}/g, ' ').trim();
}

function highResImage(url: string): string {
  if (!url) return '';
  return url.replace(/-\d+x\d+\.jpg$/, '-500x500.jpg');
}

function resolveSrc(track: AudiomackTrack): string {
  return track.streaming_url || track.stream_url || '';
}

function resolveArtist(track: AudiomackTrack): string {
  const a = decodeHtml(track.artist || track.uploader?.name || 'Unknown');
  return a || 'Unknown';
}

function mapAudiomackTrack(track: AudiomackTrack): Song | null {
  const src = resolveSrc(track);
  if (!src) return null;

  const id = String(track.id);

  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  return {
    id: `am-${id}`,
    title: cleanTitle(track.title || ''),
    artist: resolveArtist(track),
    album: cleanTitle(track.album || ''),
    year: new Date().getFullYear(),
    duration: track.duration ?? 0,
    hue: hash % 360,
    hue2: (hash * 7) % 360,
    src: src || '',
    genre: 'Other',
    imageUrl: highResImage(track.image || track.uploader?.image || ''),
    provider: 'audiomack' as const,
  };
}

/** Search Audiomack for tracks matching the query */
export async function searchAudiomack(query: string, limit = 20): Promise<Song[]> {
  if (!query.trim()) return [];
  try {
    const url =
      `${AUDIOMACK_API}/search?q=${encodeURIComponent(query)}&show=music&limit=${limit}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) return [];

    const json: AudiomackSearchResponse = await res.json();
    if (json.errorcode) {
      console.warn('[audios] audiomack error:', json.errorcode, json.message);
      return [];
    }

    const results = json?.results;
    if (!results?.length) return [];

    return results
      .map(t => mapAudiomackTrack(t))
      .filter((s): s is Song => s !== null && !!s.src);

  } catch (error) {
    console.error('[audios] search error:', error);
    return [];
  }
}

/** Get trending songs from Audiomack */
export async function getTrendingAudiomack(limit = 20): Promise<Song[]> {
  try {
    const url = `${AUDIOMACK_API}/music/trending?show=music&limit=${limit}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) return [];

    const json: AudiomackSearchResponse = await res.json();
    if (json.errorcode) return [];

    const results = json?.results;
    if (!results?.length) return [];

    return results
      .map(t => mapAudiomackTrack(t))
      .filter((s): s is Song => s !== null && !!s.src);
  } catch (error) {
    console.error('[audios] trending error:', error);
    return [];
  }
}

/** Get songs by genre from Audiomack using genre-specific endpoints */
export async function getGenreAudiomack(genre: string, limit = 20): Promise<Song[]> {
  const normalized = genre.toLowerCase().replace(/\s+/g, '-');
  const supportedGenres = ['rap', 'electronic', 'rock', 'pop', 'other'];
  const genrePath = supportedGenres.includes(normalized) ? normalized : 'other';

  try {
    const url = `${AUDIOMACK_API}/music/${genrePath}/recent?show=music&limit=${limit}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) {
      // Fallback to generic search if genre endpoint fails
      return searchAudiomack(genre, limit);
    }

    const json: AudiomackSearchResponse = await res.json();
    if (json.errorcode) {
      return searchAudiomack(genre, limit);
    }

    const results = json?.results;
    if (!results?.length) return [];

    return results
      .map(t => mapAudiomackTrack(t))
      .filter((s): s is Song => s !== null && !!s.src);
  } catch (error) {
    console.error('[audios] genre error:', error);
    return searchAudiomack(genre, limit);
  }
}

/** Get a fresh streaming URL for an Audiomack track by its ID (with am- prefix) */
export async function getAudiomackTrackUrl(amId: string): Promise<string | null> {
  const id = amId.replace(/^am-/, '');
  if (!id) return null;
  try {
    const url = `${AUDIOMACK_API}/music/${encodeURIComponent(id)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) return null;

    const json = await res.json();

    // Handle both { results: {...} } and direct object responses
    const track: AudiomackTrack | undefined = json?.results
      ? (Array.isArray(json.results) ? json.results[0] : json.results)
      : json;

    if (!track) return null;

    return track.streaming_url || track.stream_url || null;
  } catch {
    return null;
  }
}

/** Check if a song ID belongs to an Audiomack track */
export function isAudiomackId(id: string): boolean {
  return id.startsWith('am-');
}
