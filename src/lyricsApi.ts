/**
 * Lyrics fetching service
 *
 * Priority:
 *  1. Static built-in map  (s1–s12, instant)
 *  2. lrclib.net search    (synced LRC — best quality, proxied in dev)
 *  3. lyrics.ovh           (plain text fallback, proxied in dev)
 *
 * Both external APIs are race-fetched in parallel with a hard 5-second
 * timeout so the UI never waits more than 5 s regardless of network speed.
 *
 * Results are cached in-memory for the lifetime of the page.
 */

import type { LyricLine } from './lyrics';
import { lyricsForSong as staticLyrics } from './lyrics';

// ─── In-memory cache ──────────────────────────────────────────────────────────
type CacheEntry = { lines: LyricLine[]; status: LyricsFetchStatus };
const cache = new Map<string, CacheEntry>();

// ─── URL helpers (proxy in dev, direct in prod) ───────────────────────────────
const IS_DEV = import.meta.env.DEV;

function lrclibUrl(path: string): string {
  return IS_DEV ? `/lrclib${path}` : `https://lrclib.net${path}`;
}

function ovhUrl(path: string): string {
  return IS_DEV ? `/lyricsovh${path}` : `https://api.lyrics.ovh${path}`;
}

// ─── Title / artist cleaning ──────────────────────────────────────────────────
/**
 * Strip common noise from Saavn titles before using them as search terms.
 * e.g. "Kesariya (From "Brahmastra")" → "Kesariya"
 */
function cleanForSearch(raw: string): string {
  return raw
    .replace(/\s*[\[(][^)\]]*[\])]/g, '')   // remove anything in brackets
    .replace(/\s*feat\.?.*/i, '')            // remove feat. credits
    .replace(/\s*ft\.?.*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─── LRC parser ───────────────────────────────────────────────────────────────
function parseLrc(lrc: string): LyricLine[] {
  const lineRe = /\[(\d{1,3}):(\d{2})[.:](\d{2,3})\](.*)/;
  const lines: LyricLine[] = [];

  for (const raw of lrc.split('\n')) {
    const m = raw.match(lineRe);
    if (!m) continue;
    const t    = parseInt(m[1], 10) * 60
               + parseInt(m[2], 10)
               + parseInt(m[3].padEnd(3, '0'), 10) / 1000;
    const text = m[4].trim();
    lines.push({ t, text });
  }

  lines.sort((a, b) => a.t - b.t);

  // Remove consecutive duplicate non-empty lines
  const out: LyricLine[] = [];
  for (const l of lines) {
    if (out.length && out[out.length - 1].text === l.text && l.text !== '') continue;
    out.push(l);
  }
  return out;
}

// ─── Plain-text → timed lines ─────────────────────────────────────────────────
function plainToTimedLines(text: string, duration = 180): LyricLine[] {
  const raw = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('['));

  if (!raw.length) return [];
  const gap = duration / (raw.length + 1);
  return raw.map((text, i) => ({ t: gap * (i + 1), text }));
}

// ─── lrclib.net ───────────────────────────────────────────────────────────────
async function fetchFromLrclib(
  title: string,
  artist: string,
  signal: AbortSignal,
): Promise<{ lines: LyricLine[]; synced: boolean } | null> {
  try {
    // Use /api/search which is fuzzy and much more forgiving than /api/get
    const params = new URLSearchParams({ q: `${title} ${artist}` });
    const searchRes = await fetch(lrclibUrl(`/api/search?${params}`), {
      headers: { 'Lrclib-Client': 'ARVINE/1.0' },
      signal,
    });
    if (!searchRes.ok) return null;

    type LrclibHit = {
      id: number;
      trackName: string;
      artistName: string;
      duration: number;
      syncedLyrics?: string | null;
      plainLyrics?: string | null;
      instrumental?: boolean;
    };
    const hits: LrclibHit[] = await searchRes.json();
    if (!hits?.length) return null;

    // Pick the best match — prefer synced, non-instrumental
    const best = hits.find(h => h.syncedLyrics && !h.instrumental)
              ?? hits.find(h => h.plainLyrics  && !h.instrumental)
              ?? hits[0];

    if (!best || best.instrumental) return null;

    if (best.syncedLyrics) {
      const lines = parseLrc(best.syncedLyrics);
      if (lines.length) return { lines, synced: true };
    }
    if (best.plainLyrics) {
      const lines = plainToTimedLines(best.plainLyrics, best.duration ?? 180);
      if (lines.length) return { lines, synced: false };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── lyrics.ovh ──────────────────────────────────────────────────────────────
async function fetchFromLyricsOvh(
  title: string,
  artist: string,
  signal: AbortSignal,
): Promise<LyricLine[] | null> {
  try {
    const url = ovhUrl(`/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json: { lyrics?: string; error?: string } = await res.json();
    if (!json.lyrics || json.error) return null;
    const lines = plainToTimedLines(json.lyrics);
    return lines.length ? lines : null;
  } catch {
    return null;
  }
}

// ─── Public types ─────────────────────────────────────────────────────────────
export type LyricsFetchStatus = 'idle' | 'loading' | 'synced' | 'plain' | 'static' | 'none';

export type LyricsResult = {
  lines:  LyricLine[];
  status: LyricsFetchStatus;
};

// ─── Main fetch function ──────────────────────────────────────────────────────
/**
 * Fetch lyrics for a song.
 * - Returns immediately from cache on repeat calls for the same song.
 * - External APIs are raced in parallel with a 5-second hard timeout.
 */
export async function fetchLyrics(
  songId: string,
  title:  string,
  artist: string,
): Promise<LyricsResult> {
  const cacheKey = `${songId}|${title.toLowerCase().trim()}|${artist.toLowerCase().trim()}`;

  // Cache hit
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  // 1. Static built-in (instant)
  const staticLines = staticLyrics(songId);
  if (staticLines.length) {
    const entry: CacheEntry = { lines: staticLines, status: 'static' };
    cache.set(cacheKey, entry);
    return entry;
  }

  // 2 & 3. Race lrclib + lyrics.ovh in parallel, 5s hard timeout
  const cleanTitle  = cleanForSearch(title);
  const cleanArtist = cleanForSearch(artist);

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 5000);

  try {
    const [lrclibResult, ovhLines] = await Promise.all([
      fetchFromLrclib(cleanTitle, cleanArtist, controller.signal),
      fetchFromLyricsOvh(cleanTitle, cleanArtist, controller.signal),
    ]);

    clearTimeout(timeoutId);

    // Prefer synced lrclib result
    if (lrclibResult?.synced) {
      const entry: CacheEntry = { lines: lrclibResult.lines, status: 'synced' };
      cache.set(cacheKey, entry);
      return entry;
    }
    // Then plain lrclib
    if (lrclibResult?.lines.length) {
      const entry: CacheEntry = { lines: lrclibResult.lines, status: 'plain' };
      cache.set(cacheKey, entry);
      return entry;
    }
    // Then ovh
    if (ovhLines?.length) {
      const entry: CacheEntry = { lines: ovhLines, status: 'plain' };
      cache.set(cacheKey, entry);
      return entry;
    }
  } catch {
    clearTimeout(timeoutId);
  }

  // Nothing found
  const entry: CacheEntry = { lines: [], status: 'none' };
  cache.set(cacheKey, entry);
  return entry;
}

/** Clear the in-memory lyrics cache */
export function clearLyricsCache(): void {
  cache.clear();
}
