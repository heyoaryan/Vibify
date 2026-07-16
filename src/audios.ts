/**
 * Fallback audio API client — Audiomack
 *
 * Used when JioSaavn has no results for a query. Audiomack is a free,
 * no-auth-required music API that provides direct streaming URLs.
 *
 * Flow:
 *  1. search.getResults → get track metadata + stream URL
 */

import type { Song } from './types';

const AUDIOMACK_API = '/api/audiomack';

type AudiomackTrack = {
  id: number;
  title: string;
  artist: string;
  artist_id: number;
  album: string;
  album_id: number;
  image: string;
  duration: number;
  stream_url: string;
  url: string;
};

type AudiomackSearchResponse = {
  data: {
    results: AudiomackTrack[];
  };
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
  return url.replace(/-\d+x\d+\.jpg$/, '-500x500.jpg');
}

function mapAudiomackTrack(track: AudiomackTrack): Song {
  const hash = String(track.id).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const qualityUrl = (url: string): string => {
    return url.replace(/_(\d+)k\.mp3$/, '_320k.mp3');
  };

  return {
    id: `am-${track.id}`,
    title: cleanTitle(track.title),
    artist: decodeHtml(track.artist),
    album: cleanTitle(track.album),
    year: new Date().getFullYear(),
    duration: track.duration,
    hue: hash % 360,
    hue2: (hash * 7) % 360,
    src: track.stream_url || qualityUrl(track.stream_url),
    genre: 'Other',
    imageUrl: highResImage(track.image),
  };
}

/** Search Audiomack for tracks matching the query */
export async function searchAudiomack(query: string, limit = 20): Promise<Song[]> {
  if (!query.trim()) return [];
  try {
    const url = `${AUDIOMACK_API}/search?q=${encodeURIComponent(query)}&show=music&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) return [];

    const json: AudiomackSearchResponse = await res.json();
    const results = json?.data?.results;
    if (!results?.length) return [];

    return results.map(t => mapAudiomackTrack(t)).filter(s => !!s.src);
  } catch (error) {
    console.error('[audios] search error:', error);
    return [];
  }
}

/** Get trending songs from Audiomack */
export async function getTrendingAudiomack(limit = 20): Promise<Song[]> {
  try {
    const url = `${AUDIOMACK_API}/charts/track/1?limit=${limit}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) return [];

    const json: { data: { results: AudiomackTrack[] } } = await res.json();
    const results = json?.data?.results;
    if (!results?.length) return [];

    return results.map(t => mapAudiomackTrack(t)).filter(s => !!s.src);
  } catch (error) {
    console.error('[audios] trending error:', error);
    return [];
  }
}

/** Get songs by genre from Audiomack */
export async function getGenreAudiomack(genre: string, limit = 20): Promise<Song[]> {
  try {
    const url = `${AUDIOMACK_API}/search?q=${encodeURIComponent(genre)}&show=music&limit=${limit}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) return [];

    const json: AudiomackSearchResponse = await res.json();
    const results = json?.data?.results;
    if (!results?.length) return [];

    return results.map(t => mapAudiomackTrack(t)).filter(s => !!s.src);
  } catch (error) {
    console.error('[audios] genre error:', error);
    return [];
  }
}
