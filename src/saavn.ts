/**
 * JioSaavn API client — uses jiosavan-api2.vercel.app (public wrapper)
 *
 * This wrapper returns direct downloadUrl[] per song — no DES decryption,
 * no geo-restriction issues, works identically in dev and production.
 */

import type { Song } from './types';
import { getSettings } from './settings';
import { searchJamendo, getTrendingJamendo, getJamendoTrackUrl, isJamendoId } from './jamendo';

const API_BASE = 'https://jiosavan-api2.vercel.app/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type DownloadUrl = { quality: string; url: string };

type ApiSong = {
  id: string;
  name: string;
  artists: { primary: Array<{ name: string }> };
  album: { name: string };
  year: string;
  duration: number;
  language: string;
  image: Array<{ quality: string; url: string }>;
  downloadUrl: DownloadUrl[];
};

type SearchResponse = {
  success: boolean;
  data: { results: ApiSong[] };
};

type SongResponse = {
  success: boolean;
  data: ApiSong[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  t = t.replace(/\s*[(]From\s+[^)]*[)]/gi, '');
  t = t.replace(/\s*[(](?:Remix|Remastered|Official|Lyrical?|Audio|Video|Full Song|HD|4K|feat\.?|ft\.?)[^)]*[)]/gi, '');
  return t.replace(/\s{2,}/g, ' ').trim();
}

/** Pick best audio URL based on user quality setting */
function pickUrl(downloadUrl: DownloadUrl[]): string {
  if (!downloadUrl?.length) return '';
  const { audioQuality, dataSaver } = getSettings();

  type ConnectionInfo = { effectiveType?: string; saveData?: boolean };
  const conn = (navigator as unknown as { connection?: ConnectionInfo }).connection;
  const slowNetwork = conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g' || conn?.saveData;

  const wantQuality = dataSaver || slowNetwork ? '96kbps' : `${audioQuality}kbps`;

  // Try exact match first, then fallback down
  const order = ['320kbps', '160kbps', '96kbps', '48kbps', '12kbps'];
  const wantIdx = order.indexOf(wantQuality);
  const candidates = order.slice(Math.max(0, wantIdx));

  for (const q of candidates) {
    const found = downloadUrl.find(d => d.quality === q);
    if (found?.url) return found.url;
  }
  // Last resort — any available
  return downloadUrl[downloadUrl.length - 1]?.url ?? '';
}

/** Map an ApiSong to our internal Song type */
function mapSong(s: ApiSong): Song | null {
  const src = pickUrl(s.downloadUrl);
  if (!src) return null;

  const artist = decodeHtml(s.artists?.primary?.[0]?.name ?? 'Unknown');
  const hash = s.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const image500 = s.image?.find(i => i.quality === '500x500')?.url
    ?? s.image?.[s.image.length - 1]?.url
    ?? '';

  const lang = s.language?.toLowerCase() ?? '';
  const genre = lang === 'hindi' ? 'Hindi'
    : lang === 'english' ? 'English'
    : lang === 'punjabi' ? 'Punjabi'
    : lang === 'korean' ? 'K-Pop'
    : lang === 'tamil' ? 'Tamil'
    : lang === 'telugu' ? 'Telugu'
    : lang || 'Other';

  return {
    id: s.id,
    title: cleanTitle(s.name),
    artist,
    album: cleanTitle(s.album?.name ?? ''),
    year: parseInt(s.year, 10) || new Date().getFullYear(),
    duration: s.duration ?? 0,
    hue: hash % 360,
    hue2: (hash * 7) % 360,
    src,
    genre,
    imageUrl: image500,
    provider: 'saavn' as const,
  };
}

/** Deduplicate songs by id, then by title+artist */
function dedupSongs(songs: Song[]): Song[] {
  const seenIds = new Set<string>();
  const seenTitleArtist = new Set<string>();
  return songs.filter(s => {
    if (seenIds.has(s.id)) return false;
    const key = `${s.title.toLowerCase().trim()}|${s.artist.toLowerCase().trim()}`;
    if (seenTitleArtist.has(key)) return false;
    seenIds.add(s.id);
    seenTitleArtist.add(key);
    return true;
  });
}

// ─── Core fetch functions ────────────────────────────────────────────────────

/** Search songs from JioSaavn via the public API wrapper */
async function searchSaavnSongs(query: string, limit = 20): Promise<Song[]> {
  try {
    const url = `${API_BASE}/search/songs?query=${encodeURIComponent(query)}&page=1&limit=${limit}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const json: SearchResponse = await res.json();
    if (!json.success) return [];
    return json.data.results
      .map(s => mapSong(s))
      .filter((s): s is Song => s !== null && !!s.src);
  } catch {
    return [];
  }
}

/** Fetch song details by ID */
async function fetchSongById(id: string): Promise<Song | null> {
  try {
    const url = `${API_BASE}/songs/${id}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json: SongResponse = await res.json();
    if (!json.success || !json.data?.length) return null;
    return mapSong(json.data[0]);
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Search songs — JioSaavn + Jamendo in parallel */
export async function searchSongs(query: string, limit = 20): Promise<Song[]> {
  if (!query.trim()) return [];
  const [saavn, jamendo] = await Promise.all([
    searchSaavnSongs(query, limit),
    searchJamendo(query, limit),
  ]);
  return dedupSongs([...saavn, ...jamendo]);
}

/** Trending songs */
export async function getTrendingSongs(limit = 20): Promise<Song[]> {
  const [saavn, jamendo] = await Promise.all([
    searchSaavnSongs('trending hindi songs 2025', limit),
    getTrendingJamendo(limit),
  ]);
  return dedupSongs([...saavn, ...jamendo]);
}

/** New releases */
export async function getNewReleases(limit = 20): Promise<Song[]> {
  const [saavn, jamendo] = await Promise.all([
    searchSaavnSongs('new hindi songs 2025', limit),
    searchJamendo('new releases 2025', limit),
  ]);
  return dedupSongs([...saavn, ...jamendo]);
}

/** Top songs by artist */
export async function getArtistSongs(artistName: string, limit = 10): Promise<Song[]> {
  const [saavn, jamendo] = await Promise.all([
    searchSaavnSongs(artistName, limit),
    searchJamendo(artistName, limit),
  ]);
  return dedupSongs([...saavn, ...jamendo]);
}

/** Single song by JioSaavn song ID */
export async function getSongDetails(songId: string): Promise<Song | null> {
  return fetchSongById(songId);
}

/** Refresh Jamendo URLs — src may expire */
export async function refreshJamendoUrls(songs: Song[]): Promise<Song[]> {
  const jmSongs = songs.filter(s => isJamendoId(s.id) && (!s.src || s.src.length === 0));
  if (!jmSongs.length) return songs;

  const refreshed = await Promise.all(
    jmSongs.map(async (song) => {
      const freshUrl = await getJamendoTrackUrl(song.id);
      return freshUrl ? { ...song, src: freshUrl } : song;
    }),
  );

  const refreshedIds = new Set(refreshed.map(s => s.id));
  return [...refreshed, ...songs.filter(s => !refreshedIds.has(s.id))];
}
