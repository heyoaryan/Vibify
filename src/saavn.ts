/**
 * JioSaavn API client — uses the official JioSaavn internal API (www.jiosaavn.com/api.php)
 *
 * Flow:
 *  1. search.getResults  → get song IDs + metadata
 *  2. song.getDetails    → batch-fetch full encrypted_media_url (comma-separated IDs, 1 request)
 *  3. decryptUrl()       → DES-ECB decrypt to get a real CDN audio URL
 */

import type { Song } from './types';
import { getSettings } from './settings';

// In dev, Vite proxies /jiosaavn/* → https://www.jiosaavn.com/*
// In production, Vercel rewrites /jiosaavn/api.php → /api/jiosaavn (serverless proxy)
const JIOSAAVN_API = '/jiosaavn/api.php';
const DES_KEY = '38346591';

// ─── DES-ECB decryption (Web Crypto API) ────────────────────────────────────

/**
 * Decrypt a JioSaavn encrypted_media_url using DES-ECB with key '38346591'.
 * The Web Crypto API doesn't support DES, so we use a tiny pure-JS DES impl.
 */

// Minimal DES-ECB implementation (public domain, compatible with JioSaavn's key scheme)
// Based on the algorithm used by every open-source JioSaavn client.
function desDecrypt(ciphertext: Uint8Array, keyStr: string): Uint8Array {
  const key = strToBytes(keyStr);
  const subkeys = generateSubkeys(key);
  const out = new Uint8Array(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i += 8) {
    const block = ciphertext.slice(i, i + 8);
    const dec = desBlock(block, subkeys, true);
    out.set(dec, i);
  }
  return out;
}

function strToBytes(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
  return b;
}

// Initial permutation table
const IP = [
  58,50,42,34,26,18,10,2, 60,52,44,36,28,20,12,4,
  62,54,46,38,30,22,14,6, 64,56,48,40,32,24,16,8,
  57,49,41,33,25,17, 9,1, 59,51,43,35,27,19,11,3,
  61,53,45,37,29,21,13,5, 63,55,47,39,31,23,15,7
];
const IP_INV = [
  40,8,48,16,56,24,64,32, 39,7,47,15,55,23,63,31,
  38,6,46,14,54,22,62,30, 37,5,45,13,53,21,61,29,
  36,4,44,12,52,20,60,28, 35,3,43,11,51,19,59,27,
  34,2,42,10,50,18,58,26, 33,1,41, 9,49,17,57,25
];
const E = [
  32,1,2,3,4,5, 4,5,6,7,8,9, 8,9,10,11,12,13,
  12,13,14,15,16,17, 16,17,18,19,20,21, 20,21,22,23,24,25,
  24,25,26,27,28,29, 28,29,30,31,32,1
];
const P = [
  16,7,20,21,29,12,28,17, 1,15,23,26,5,18,31,10,
  2,8,24,14,32,27,3,9,   19,13,30,6,22,11,4,25
];
const S_BOXES = [
  [14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7,0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0,15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13],
  [15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10,3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5,0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15,13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9],
  [10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8,13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7,1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12],
  [7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15,13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4,3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14],
  [2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9,14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14,11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3],
  [12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11,10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6,4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13],
  [4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1,13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2,6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12],
  [13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7,1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2,7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8,2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11]
];
const PC1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
const PC2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
const SHIFTS = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];

function permute(bits: number[], table: number[]): number[] {
  return table.map(p => bits[p - 1]);
}

function bytesToBits(bytes: Uint8Array): number[] {
  const bits: number[] = [];
  for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  return bits;
}

function bitsToBytes(bits: number[]): Uint8Array {
  const bytes = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bytes.length; i++) {
    let val = 0;
    for (let j = 0; j < 8; j++) val = (val << 1) | bits[i * 8 + j];
    bytes[i] = val;
  }
  return bytes;
}

function rotateLeft(arr: number[], n: number): number[] {
  return [...arr.slice(n), ...arr.slice(0, n)];
}

function generateSubkeys(key: Uint8Array): number[][] {
  const keyBits = bytesToBits(key);
  const permuted = permute(keyBits, PC1);
  let C = permuted.slice(0, 28);
  let D = permuted.slice(28, 56);
  const subkeys: number[][] = [];
  for (let i = 0; i < 16; i++) {
    C = rotateLeft(C, SHIFTS[i]);
    D = rotateLeft(D, SHIFTS[i]);
    subkeys.push(permute([...C, ...D], PC2));
  }
  return subkeys;
}

function feistel(R: number[], subkey: number[]): number[] {
  const expanded = permute(R, E);
  const xored = expanded.map((b, i) => b ^ subkey[i]);
  const sResult: number[] = [];
  for (let i = 0; i < 8; i++) {
    const block = xored.slice(i * 6, i * 6 + 6);
    const row = (block[0] << 1) | block[5];
    const col = (block[1] << 3) | (block[2] << 2) | (block[3] << 1) | block[4];
    const val = S_BOXES[i][row * 16 + col];
    for (let j = 3; j >= 0; j--) sResult.push((val >> j) & 1);
  }
  return permute(sResult, P);
}

function desBlock(block: Uint8Array, subkeys: number[][], decrypt: boolean): Uint8Array {
  const bits = permute(bytesToBits(block), IP);
  let L = bits.slice(0, 32);
  let R = bits.slice(32, 64);
  const keys = decrypt ? [...subkeys].reverse() : subkeys;
  for (const sk of keys) {
    const newR = L.map((b, i) => b ^ feistel(R, sk)[i]);
    L = R;
    R = newR;
  }
  return bitsToBytes(permute([...R, ...L], IP_INV));
}

/** Decode a JioSaavn encrypted_media_url to a plain CDN URL */
function decryptUrl(encryptedUrl: string): string {
  // Normalize base64 (standard, not URL-safe)
  let b64 = encryptedUrl.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';

  const cipher = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

  // Pad to multiple of 8 (DES block size)
  let padded = cipher;
  if (cipher.length % 8 !== 0) {
    const extra = 8 - (cipher.length % 8);
    padded = new Uint8Array(cipher.length + extra);
    padded.set(cipher);
  }

  const plain = desDecrypt(padded, DES_KEY);

  // Convert to string, stop at first null byte
  let url = '';
  for (let i = 0; i < plain.length; i++) {
    if (plain[i] === 0) break;
    if (plain[i] >= 0x20 && plain[i] <= 0x7e) url += String.fromCharCode(plain[i]);
  }
  return url.trim();
}

/** Given a decrypted CDN URL (e.g. ending _96.mp4), swap to preferred quality */
function qualityUrl(url: string, quality: '96' | '160' | '320'): string {
  return url.replace(/_\d+\.mp4$/, `_${quality}.mp4`);
}

// ─── API response types ──────────────────────────────────────────────────────

type JioSearchResult = {
  id: string;
  song: string;           // HTML-encoded title
  album: string;
  year: string;
  language: string;
  duration: string | number;
  primary_artists: string;
  image: string;          // ends with -150x150.jpg
  '320kbps': string | boolean;
  encrypted_media_url: string;  // may be truncated in search results
};

type JioSearchResponse = {
  total: number;
  results: JioSearchResult[];
};

type JioDetailSong = JioSearchResult & {
  encrypted_media_url: string;  // full URL here
};

// ─── Text helpers ────────────────────────────────────────────────────────────

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
  t = t.replace(/\s*[\[(]From\s+["']?[^)\]]*["']?[\])]/gi, '');
  t = t.replace(/\s*[\[(](Remix|Remastered|Official|Lyrical?|Audio|Video|Full Song|HD|4K|feat\.?|ft\.?)[^\])]*[\])]/gi, '');
  return t.replace(/\s{2,}/g, ' ').trim();
}

/** Replace -150x150.jpg with -500x500.jpg in JioSaavn image URLs */
function highResImage(url: string): string {
  return url.replace(/-\d+x\d+\.jpg$/, '-500x500.jpg');
}

// ─── Song mapper ─────────────────────────────────────────────────────────────

function mapSong(raw: JioDetailSong): Song | null {
  const encUrl = raw.encrypted_media_url;
  if (!encUrl) return null;

  let audioUrl = '';
  try {
    const base = decryptUrl(encUrl);
    if (!base) return null;
    // Use quality from global settings; dataSaver caps at 96kbps
    const { audioQuality, dataSaver } = getSettings();
    const quality = dataSaver ? '96' : audioQuality;
    audioUrl = qualityUrl(base, quality);
  } catch {
    return null;
  }

  const hash = raw.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  return {
    id: raw.id,
    title: cleanTitle(raw.song),
    artist: decodeHtml(raw.primary_artists.split(',')[0].trim()),
    album: cleanTitle(raw.album),
    year: parseInt(String(raw.year), 10) || new Date().getFullYear(),
    duration: typeof raw.duration === 'string' ? parseInt(raw.duration, 10) : raw.duration,
    hue: hash % 360,
    hue2: (hash * 7) % 360,
    src: audioUrl,
    genre: raw.language === 'hindi' ? 'Hindi' : raw.language === 'english' ? 'English' : 'Other',
    imageUrl: highResImage(raw.image),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Deduplicate songs by id then by title+artist */
function dedupSongs(songs: Song[]): Song[] {
  const seenIds = new Set<string>();
  const seenTitleArtist = new Set<string>();
  const unique: Song[] = [];
  for (const song of songs) {
    if (seenIds.has(song.id)) continue;
    const key = `${song.title.toLowerCase().trim()}|${song.artist.toLowerCase().trim()}`;
    if (seenTitleArtist.has(key)) continue;
    seenIds.add(song.id);
    seenTitleArtist.add(key);
    unique.push(song);
  }
  return unique;
}

/** Batch-fetch full song details for a list of IDs and return mapped Songs */
async function fetchSongDetails(ids: string[]): Promise<Song[]> {
  if (!ids.length) return [];
  const detailUrl =
    `${JIOSAAVN_API}?__call=song.getDetails&cc=in&_marker=0&_format=json&pids=${ids.join(',')}`;
  const res = await fetch(detailUrl);
  if (!res.ok) throw new Error(`Detail HTTP ${res.status}`);
  const json: Record<string, JioDetailSong> = await res.json();
  return Object.values(json)
    .map(s => mapSong(s))
    .filter((s): s is Song => s !== null && !!s.src);
}

// ─── Artist search ────────────────────────────────────────────────────────────

type JioArtist = {
  artistid: string;
  name: string;
};

type JioArtistSearchResponse = {
  artist_search?: {
    data?: { results?: JioArtist[] };
  };
};

type JioArtistTopSongsResponse = {
  topSongs?: {
    songs?: JioDetailSong[];
  };
};

/**
 * Try to find an exact/close artist match on JioSaavn and return their top songs.
 * Returns null if no confident artist match found.
 */
async function getArtistTopSongs(artistQuery: string, limit: number): Promise<Song[] | null> {
  try {
    // Step 1 — search for the artist
    const artistSearchUrl =
      `${JIOSAAVN_API}?__call=search.getArtistResults&q=${encodeURIComponent(artistQuery)}&p=1&n=5&_format=json&_marker=0&ctx=web6dot0`;
    const artistRes = await fetch(artistSearchUrl);
    if (!artistRes.ok) return null;

    const artistJson: JioArtistSearchResponse = await artistRes.json();
    const artistResults = artistJson?.artist_search?.data?.results;
    if (!artistResults?.length) return null;

    // Pick the best matching artist — prefer exact name match (case-insensitive)
    const queryNorm = artistQuery.toLowerCase().trim();
    const matched =
      artistResults.find(a => a.name.toLowerCase().trim() === queryNorm) ??
      artistResults.find(a => a.name.toLowerCase().includes(queryNorm)) ??
      artistResults.find(a => queryNorm.includes(a.name.toLowerCase())) ??
      null;

    if (!matched) return null;

    // Step 2 — fetch that artist's top songs
    const topSongsUrl =
      `${JIOSAAVN_API}?__call=artist.getTopSongs&artistId=${matched.artistid}&page=0&category=latest&sort_order=desc&includeMetaTags=0&_format=json&_marker=0&ctx=web6dot0`;
    const topRes = await fetch(topSongsUrl);
    if (!topRes.ok) return null;

    const topJson: JioArtistTopSongsResponse = await topRes.json();
    const rawSongs = topJson?.topSongs?.songs;
    if (!rawSongs?.length) return null;

    // These songs already have full encrypted_media_url — map directly
    const songs = rawSongs
      .slice(0, limit)
      .map(s => mapSong(s as JioDetailSong))
      .filter((s): s is Song => s !== null && !!s.src);

    return songs.length ? songs : null;
  } catch {
    return null;
  }
}

/**
 * Search songs by query.
 *
 * Artist detection: if the query looks like a known artist (no song-like words
 * such as "from", "lyrics", brackets, or common song keywords), we first try
 * the artist search path which returns only that artist's songs. Falls back to
 * regular song search if artist search returns nothing.
 */
export async function searchSongs(query: string, limit = 20): Promise<Song[]> {
  if (!query.trim()) return [];
  try {
    // Heuristic: query is likely an artist name if it has no song-specific markers
    const q = query.trim();
    const songKeywords = /from|lyrics|song|audio|video|full|official|remix|feat|ft\.|[\[(]/i;
    const looksLikeArtist = !songKeywords.test(q) && q.split(/\s+/).length <= 4;

    if (looksLikeArtist) {
      // Try artist path first — returns only that artist's songs
      const artistSongs = await getArtistTopSongs(q, limit);
      if (artistSongs && artistSongs.length >= 3) {
        return dedupSongs(artistSongs);
      }
    }

    // Step 1 — regular song search to get IDs
    const searchUrl =
      `${JIOSAAVN_API}?__call=search.getResults&q=${encodeURIComponent(q)}&p=1&n=${limit}&_format=json&_marker=0&ctx=web6dot0`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error(`Search HTTP ${searchRes.status}`);

    const searchJson: JioSearchResponse = await searchRes.json();
    const results = searchJson?.results;
    if (!results?.length) return [];

    // Step 2 — batch fetch full details
    const songs = await fetchSongDetails(results.map(r => r.id));

    // If query looks like an artist, sort: artist's songs first
    if (looksLikeArtist) {
      const qNorm = q.toLowerCase();
      songs.sort((a, b) => {
        const aMatch = a.artist.toLowerCase().includes(qNorm) ? 0 : 1;
        const bMatch = b.artist.toLowerCase().includes(qNorm) ? 0 : 1;
        return aMatch - bMatch;
      });
    }

    return dedupSongs(songs);
  } catch (error) {
    console.error('searchSongs error:', error);
    return [];
  }
}

/** Trending songs */
export async function getTrendingSongs(limit = 20): Promise<Song[]> {
  return searchSongs('trending hindi 2025', limit);
}

/** New releases */
export async function getNewReleases(limit = 20): Promise<Song[]> {
  return searchSongs('new hindi songs 2025', limit);
}

/** Top songs by artist — uses artist search path for accurate results */
export async function getArtistSongs(artistName: string, limit = 10): Promise<Song[]> {
  // Try dedicated artist path first
  const artistSongs = await getArtistTopSongs(artistName, limit);
  if (artistSongs && artistSongs.length > 0) return dedupSongs(artistSongs);
  // Fallback to generic search
  return searchSongs(artistName, limit);
}

/** Get a single song's details by JioSaavn song ID */
export async function getSongDetails(songId: string): Promise<Song | null> {
  try {
    const url = `${JIOSAAVN_API}?__call=song.getDetails&cc=in&_marker=0&_format=json&pids=${songId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json: Record<string, JioDetailSong> = await res.json();
    const song = Object.values(json)[0];
    if (!song) return null;
    return mapSong(song);
  } catch {
    return null;
  }
}
