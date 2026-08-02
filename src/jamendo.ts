import type { Song } from './types';

/**
 * Jamendo API client.
 *
 * All requests go to /api/jamendo (Vercel serverless proxy in prod,
 * Vite dev-proxy in dev). The proxy injects JAMENDO_CLIENT_ID and
 * JAMENDO_CLIENT_SECRET server-side — no credentials are ever exposed
 * in the browser bundle.
 */

const JAMENDO_API = '/api/jamendo';

type JamendoTrack = {
  id: string;
  name: string;
  artist_name: string;
  album_name: string;
  album_image: string;
  image: string;
  duration: number;
  audio: string;
  releasedate: string;
  genre: string;
  tags: string;
};

type JamendoSearchResponse = {
  headers: { status: string };
  results: JamendoTrack[];
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
  t = t.replace(/\s*[(](?:Remix|Remastered|Official|Lyrical?|Audio|Video|Full Song|HD|4K|feat\.?|ft\.?)[^)]*[)]/gi, '');
  return t.replace(/\s{2,}/g, ' ').trim();
}

function highResImage(url: string): string {
  if (!url) return '';
  return url.replace(/-\d+x\d+\.jpg$/, '-500x500.jpg');
}

/**
 * Build a URL for the Jamendo proxy.
 * client_id is NOT included here — the server-side proxy adds it.
 */
function jamendoUrl(path: string, params: Record<string, string>): string {
  const qs = new URLSearchParams({ format: 'json' });
  for (const [key, value] of Object.entries(params)) {
    qs.set(key, value);
  }
  return `${JAMENDO_API}${path}?${qs.toString()}`;
}

function mapJamendoTrack(track: JamendoTrack): Song | null {
  if (!track.audio) return null;

  const hash = track.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  return {
    id: `jm-${track.id}`,
    title: cleanTitle(track.name),
    artist: decodeHtml(track.artist_name),
    album: cleanTitle(track.album_name || ''),
    year: parseInt(track.releasedate?.slice(0, 4) || String(new Date().getFullYear()), 10) || new Date().getFullYear(),
    duration: track.duration ?? 0,
    hue: hash % 360,
    hue2: (hash * 7) % 360,
    src: track.audio,
    genre: track.genre || track.tags?.split(' ')[0] || 'Other',
    imageUrl: highResImage(track.album_image || track.image || ''),
    provider: 'jamendo' as const,
  };
}

/** Search Jamendo for tracks matching the query */
export async function searchJamendo(query: string, limit = 20): Promise<Song[]> {
  if (!query.trim()) return [];

  try {
    const url = jamendoUrl('/tracks', { limit: String(limit), search: query, include: 'musicinfo' });
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) return [];

    const json: JamendoSearchResponse = await res.json();
    if (json.headers?.status !== 'success') return [];

    return json.results.map(t => mapJamendoTrack(t)).filter((s): s is Song => s !== null);
  } catch (error) {
    console.error('[jamendo] search error:', error);
    return [];
  }
}

/** Get trending songs from Jamendo */
export async function getTrendingJamendo(limit = 20): Promise<Song[]> {
  try {
    const url = jamendoUrl('/tracks', { limit: String(limit), order: 'popularity_total', include: 'musicinfo' });
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) return [];

    const json: JamendoSearchResponse = await res.json();
    if (json.headers?.status !== 'success') return [];

    return json.results.map(t => mapJamendoTrack(t)).filter((s): s is Song => s !== null);
  } catch (error) {
    console.error('[jamendo] trending error:', error);
    return [];
  }
}

/** Get songs by genre/tags from Jamendo */
export async function getGenreJamendo(genre: string, limit = 20): Promise<Song[]> {
  try {
    const url = jamendoUrl('/tracks', { limit: String(limit), tags: genre, order: 'popularity_total', include: 'musicinfo' });
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) return [];

    const json: JamendoSearchResponse = await res.json();
    if (json.headers?.status !== 'success') return [];

    return json.results.map(t => mapJamendoTrack(t)).filter((s): s is Song => s !== null);
  } catch (error) {
    console.error('[jamendo] genre error:', error);
    return [];
  }
}

/** Get a fresh streaming URL for a Jamendo track by its ID (with jm- prefix) */
export async function getJamendoTrackUrl(jmId: string): Promise<string | null> {
  const id = jmId.replace(/^jm-/, '');
  if (!id) return null;
  try {
    const url = jamendoUrl('/tracks', { id, include: 'musicinfo' });
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) return null;

    const json: JamendoSearchResponse = await res.json();
    if (json.headers?.status !== 'success') return null;

    const track = json.results[0];
    return track?.audio || null;
  } catch {
    return null;
  }
}

/** Check if a song ID belongs to a Jamendo track */
export function isJamendoId(id: string): boolean {
  return id.startsWith('jm-');
}
