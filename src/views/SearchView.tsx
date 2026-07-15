import { Loader2, Mic, MicOff, Music2, Play, Search as SearchIcon, X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePlayer } from '../player';
import type { Song } from '../types';
import { Artwork } from '../components/Artwork';
import { formatTime } from '../lib';
import { searchSongs, getArtistSongs } from '../saavn';
import { ALL_SONGS } from '../data';

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: {
    results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }>;
  }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

// ─── Dedup helper ─────────────────────────────────────────────────────────────
function deduplicateSongs(songs: Song[]): Song[] {
  const seenIds = new Set<string>();
  const seenTitleArtist = new Set<string>();
  const seenImages = new Set<string>();
  const result: Song[] = [];
  for (const song of songs) {
    if (seenIds.has(song.id)) continue;
    const key = `${song.title.toLowerCase().trim()}|${song.artist.toLowerCase().trim()}`;
    if (seenTitleArtist.has(key)) continue;
    if (song.imageUrl && seenImages.has(song.imageUrl)) continue;
    seenIds.add(song.id);
    seenTitleArtist.add(key);
    if (song.imageUrl) seenImages.add(song.imageUrl);
    result.push(song);
  }
  return result;
}

const GENRES = [
  { label: 'Bollywood',    query: 'bollywood hits',          hue: 340 },
  { label: 'Arijit Singh', query: 'arijit singh',            hue: 210 },
  { label: 'Punjabi',      query: 'punjabi hits',            hue: 30  },
  { label: 'Lo-fi',        query: 'lofi hindi',              hue: 200 },
  { label: 'Romantic',     query: 'romantic hindi songs',    hue: 0   },
  { label: 'Party',        query: 'party songs hindi',       hue: 260 },
  { label: 'Devotional',   query: 'hindi devotional songs',  hue: 45  },
  { label: 'Retro',        query: 'old hindi songs retro',   hue: 170 },
  { label: 'Hip-Hop',      query: 'hindi hip hop rap',       hue: 280 },
  { label: 'Sad Songs',    query: 'sad hindi songs',         hue: 230 },
  { label: 'Item Songs',   query: 'item songs bollywood',    hue: 10  },
  { label: 'Sufi',         query: 'sufi songs hindi',        hue: 150 },
  { label: 'Workout',      query: 'workout gym songs hindi', hue: 90  },
  { label: 'AR Rahman',    query: 'ar rahman songs',         hue: 190 },
  { label: 'Indie',        query: 'hindi indie songs',       hue: 310 },
  { label: 'Chill',        query: 'chill vibes hindi',       hue: 175 },
  { label: 'Trending',     query: 'trending songs 2024',     hue: 55  },
  { label: 'English Pop',  query: 'english pop hits',        hue: 240 },
];

// ─── Module-level search cache (persists across re-mounts) ───────────────────
const _searchCache = new Map<string, Song[]>();

// ─── Skeleton rows (memoized constant) ───────────────────────────────────────
const SkeletonRows = memo(function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-1 overflow-hidden rounded-xl">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="grid grid-cols-[20px_40px_1fr_auto] items-center gap-3 px-3 py-2.5 sm:grid-cols-[24px_44px_1fr_auto]">
          <div className="h-4 w-4 animate-pulse rounded bg-ink-700" />
          <div className="h-10 w-10 animate-pulse rounded-md bg-ink-700" />
          <div className="space-y-1.5">
            <div className="h-3 w-2/3 animate-pulse rounded bg-ink-700" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-ink-800" />
          </div>
          <div className="h-3 w-8 animate-pulse rounded bg-ink-700" />
        </div>
      ))}
    </div>
  );
});

// ─── Single song row — memoized so list re-renders only when isCurrent changes ─
const SongRow = memo(function SongRow({
  song,
  index,
  isCurrent,
  isPlaying,
  onPlay,
}: {
  song: Song;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  return (
    <button
      onClick={onPlay}
      className="group grid w-full grid-cols-[20px_40px_1fr_auto] items-center gap-2.5 px-3 py-2.5
        text-left transition-colors hover:bg-white/5 sm:grid-cols-[24px_44px_1fr_auto] sm:gap-3"
    >
      <span className="text-xs tabular-nums text-ink-300 sm:text-sm">
        {isCurrent && isPlaying ? (
          <span className="flex items-end gap-[2px] h-4">
            {[0.6, 1, 0.4].map((h, j) => (
              <span key={j} className="w-[2px] rounded-full bg-brand-400 animate-bar-rise"
                style={{ height: `${h * 100}%`, animationDelay: `${j * 0.2}s` }} />
            ))}
          </span>
        ) : (
          <>
            <span className="group-hover:hidden">{index + 1}</span>
            <Play size={13} className="hidden fill-brand-400 text-brand-400 group-hover:block" />
          </>
        )}
      </span>
      <Artwork title={song.title} hue={song.hue} hue2={song.hue2} imageUrl={song.imageUrl}
        className="h-10 w-10" rounded="rounded-md" />
      <div className="min-w-0">
        <p className={`truncate text-xs font-medium sm:text-sm ${isCurrent ? 'text-brand-400' : 'text-ink-50'}`}>
          {song.title}
        </p>
        <p className="truncate text-[10px] text-ink-300 sm:text-xs">{song.artist} · {song.album}</p>
      </div>
      <span className="hidden text-xs tabular-nums text-ink-300 sm:block">{formatTime(song.duration)}</span>
    </button>
  );
});

// ─── Main view ────────────────────────────────────────────────────────────────
export const SearchView = memo(function SearchView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Browse all — fetched once, cached in module scope
  const [browseAll, setBrowseAll] = useState<Song[]>(() => _searchCache.get('__browse__') ?? []);
  const [browseLoading, setBrowseLoading] = useState(_searchCache.get('__browse__') == null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const { playSongs, current, isPlaying, togglePlay } = usePlayer();

  // ── Local (offline) search — partial/fuzzy substring match ───────────────
  // Each term only needs to appear as a substring anywhere in title/artist/album.
  // e.g. "arij" matches "Arijit Singh", "dil" matches "Dilbaro".
  const localSearch = useCallback((text: string, limit = 20) => {
    const terms = text.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
    if (!terms.length) return [];
    return ALL_SONGS
      .map(song => {
        const hay = `${song.title} ${song.artist} ${song.album} ${song.genre}`.toLowerCase();
        // Score: how many terms match, and reward exact word boundary matches
        let score = 0;
        for (const t of terms) {
          if (!hay.includes(t)) return null; // must match all terms
          score += hay.split(t).length - 1; // count occurrences
          // Bonus for starting match
          if (hay.startsWith(t) || hay.includes(' ' + t)) score += 2;
        }
        return { song, score };
      })
      .filter((x): x is { song: Song; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .map(x => x.song)
      .slice(0, limit);
  }, []);

  // ── Browse all — fetch once on first mount ─────────────────────────────────
  useEffect(() => {
    if (_searchCache.has('__browse__')) return;
    setBrowseLoading(true);
    searchSongs('trending hindi songs 2024', 10)
      .then(songs => {
        const dedupd = deduplicateSongs(songs);
        _searchCache.set('__browse__', dedupd);
        setBrowseAll(dedupd);
      })
      .catch(() => {})
      .finally(() => setBrowseLoading(false));
  }, []);

  // ── "Go to artist" event from NowPlayingView action sheet ──────────────────
  useEffect(() => {
    const handler = async (e: Event) => {
      const artist = (e as CustomEvent<string>).detail;
      if (!artist) return;
      setQuery(artist);
      setLoading(true);
      setSearched(false);
      const cached = _searchCache.get(artist);
      if (cached) {
        setResults(cached);
        setSearched(true);
        setLoading(false);
        return;
      }
      try {
        const remote = await searchSongs(artist, 20);
        const local = localSearch(artist, 20);
        const remoteIds = new Set(remote.map(s => s.id));
        const merged = [...remote, ...local.filter(s => !remoteIds.has(s.id))];
        const next = deduplicateSongs(merged.length > 0 ? merged : local);
        _searchCache.set(artist, next);
        setResults(next);
      } catch {
        setResults(deduplicateSongs(localSearch(artist, 20)));
      } finally {
        setSearched(true);
        setLoading(false);
      }
    };
    window.addEventListener('vibify-search', handler);
    return () => window.removeEventListener('vibify-search', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Voice recognition — created once on mount ──────────────────────────────
  useEffect(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) { setVoiceSupported(false); return; }
    setVoiceSupported(true);
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-IN';
    rec.onresult = event => {
      let interim = '', final = '';
      for (let i = event.results.length - 1; i >= 0; i--) {
        const t = event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) final = t; else interim = t;
      }
      setInterimTranscript(interim);
      if (final) { setVoiceError(null); setQuery(final); }
    };
    rec.onerror = ev => {
      setVoiceListening(false);
      setVoiceError(ev.error === 'not-allowed' ? 'Microphone access was denied.' : 'Voice search could not be completed.');
    };
    rec.onend = () => { setVoiceListening(false); setInterimTranscript(''); };
    recognitionRef.current = rec;
    return () => { recognitionRef.current?.stop(); recognitionRef.current = null; };
  }, []);

  // ── Debounced search — 350ms, with cache + prefix expansion ──────────────
  // If user types a short partial word (≥4 chars, no space), we append a
  // wildcard-style expansion so JioSaavn returns broader results.
  // e.g.  "arij"  → API gets "arijit"  (first 4 chars → try common expansion)
  //        "dil"  → too short, just send as-is
  //        "dilb" → send "dilb" — JioSaavn handles prefix search well
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) { setResults([]); setSearched(false); setLoading(false); return; }

    // Instant hit from cache — no spinner at all
    const cached = _searchCache.get(q);
    if (cached) {
      setResults(cached);
      setSearched(true);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Build the actual API query.
    // JioSaavn does native prefix search — "arij" already returns "Arijit Singh".
    // For short partial words (4–7 chars, single token), we also merge local
    // results so even offline/data-limited users get partial matches.
    const tokens = q.split(/\s+/).filter(Boolean);
    const isSinglePartial = tokens.length === 1 && tokens[0].length >= 4 && tokens[0].length <= 7;
    const apiQuery = q;

    debounceRef.current = setTimeout(async () => {
      try {
        const remote = await searchSongs(apiQuery, 20);

        // If partial single word AND remote results are few, merge local results
        let merged = remote;
        if (isSinglePartial || remote.length < 5) {
          const local = localSearch(q, 20);
          // Combine: remote first (more accurate), then local extras not already in remote
          const remoteIds = new Set(remote.map(s => s.id));
          const extras = local.filter(s => !remoteIds.has(s.id));
          merged = [...remote, ...extras];
        }

        const next = deduplicateSongs(merged.length > 0 ? merged : localSearch(q, 20));
        _searchCache.set(q, next);
        setResults(next);
      } catch {
        const fallback = deduplicateSongs(localSearch(q, 20));
        setResults(fallback);
      } finally {
        setSearched(true);
        setLoading(false);
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const playSong = useCallback((s: Song) => {
    if (current?.id === s.id) togglePlay();
    else playSongs(results.length > 0 ? results : [s], s.id);
  }, [current, togglePlay, playSongs, results]);

  const toggleVoiceSearch = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) { setVoiceError('Voice search is not supported in this browser.'); return; }
    if (voiceListening) {
      rec.stop();
      setVoiceListening(false);
      setInterimTranscript('');
      return;
    }
    setVoiceError(null);
    setInterimTranscript('');
    setVoiceListening(true);
    if (current && isPlaying) togglePlay();
    try { rec.start(); }
    catch { setVoiceListening(false); setVoiceError('Voice search could not be started.'); }
  }, [voiceListening, current, isPlaying, togglePlay]);

  const playGenre = useCallback(async (g: typeof GENRES[0]) => {
    const cached = _searchCache.get('genre:' + g.query);
    if (cached) { playSongs(cached, cached[0].id); return; }
    const list = deduplicateSongs(await getArtistSongs(g.query, 10));
    if (list.length) {
      _searchCache.set('genre:' + g.query, list);
      playSongs(list, list[0].id);
    }
  }, [playSongs]);

  // Memoize the results list so it doesn't re-render when only playback state changes
  const resultRows = useMemo(() =>
    results.map((s, i) => (
      <SongRow
        key={s.id}
        song={s}
        index={i}
        isCurrent={current?.id === s.id}
        isPlaying={isPlaying && current?.id === s.id}
        onPlay={() => playSong(s)}
      />
    )),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [results, current?.id, isPlaying]);

  const browseRows = useMemo(() =>
    browseAll.map((s, i) => (
      <SongRow
        key={s.id}
        song={s}
        index={i}
        isCurrent={current?.id === s.id}
        isPlaying={isPlaying && current?.id === s.id}
        onPlay={() => {
          if (current?.id === s.id) togglePlay();
          else playSongs(browseAll, s.id);
        }}
      />
    )),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [browseAll, current?.id, isPlaying]);

  return (
    <div className="animate-fade-in space-y-6 px-3 pb-12 sm:space-y-8 sm:px-5 lg:px-8">

      {/* ── Search input ── */}
      <div className="relative">
        <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-300 sm:size-5" />
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={voiceListening ? 'Listening...' : 'Songs, artists, albums…'}
          className="w-full rounded-2xl border border-white/5 bg-white/[0.04]
            py-3 pl-11 pr-24 text-sm text-ink-50 placeholder:text-ink-300
            outline-none backdrop-blur-xl transition-colors
            focus:border-brand-400/40 focus:bg-white/[0.06]
            sm:py-3.5 sm:pl-12 sm:pr-28 sm:text-base"
        />
        <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1 sm:right-3.5">
          {voiceListening ? (
            <button onClick={toggleVoiceSearch} aria-label="Stop voice search"
              className="rounded-full bg-red-500/15 p-2 text-red-300 transition-colors hover:bg-red-500/25">
              <MicOff size={16} />
            </button>
          ) : (
            <button onClick={toggleVoiceSearch} aria-label="Voice search"
              disabled={!voiceSupported}
              className={`rounded-full p-2 transition-colors ${voiceSupported ? 'text-ink-300 hover:text-ink-50' : 'cursor-not-allowed text-ink-500'}`}>
              <Mic size={16} />
            </button>
          )}
          {loading
            ? <Loader2 size={17} className="animate-spin text-brand-400" />
            : query
              ? <button onClick={() => setQuery('')} aria-label="Clear"
                  className="rounded-full p-1 text-ink-300 hover:text-ink-50">
                  <X size={17} />
                </button>
              : null}
        </div>
      </div>
      {voiceError && <p className="text-sm text-red-400">{voiceError}</p>}

      {/* ── Voice listening modal ── */}
      {voiceListening && (
        <div
          onClick={toggleVoiceSearch}
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="flex w-[92%] max-w-xs sm:max-w-sm flex-col items-center gap-6 rounded-3xl
              border border-brand-400/20 bg-gradient-to-b from-brand-500/10 to-ink-900/50
              p-5 sm:p-8 shadow-2xl max-h-[80vh] overflow-auto mt-24 sm:mt-0"
          >
            <div className="flex items-end justify-center gap-1 h-16">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="w-1 rounded-full bg-gradient-to-t from-brand-400 to-brand-300"
                  style={{ height: `${20 + Math.sin(i * 0.5) * 20}px`, animation: `wave-motion 0.8s ease-in-out ${i * 0.05}s infinite` }} />
              ))}
            </div>
            <div className="text-center">
              <p className="font-display text-2xl font-bold text-ink-50">Listening…</p>
              <p className="mt-2 text-sm text-ink-300">Speak a song or artist name</p>
            </div>
            {interimTranscript && (
              <div className="w-full rounded-2xl border border-brand-400/30 bg-white/[0.03] p-4 backdrop-blur-xl">
                <p className="text-sm text-brand-200">{interimTranscript}</p>
              </div>
            )}
            <button onClick={toggleVoiceSearch}
              className="mt-4 w-full rounded-xl bg-brand-400 py-2.5 text-sm font-semibold text-ink-950 transition-all hover:scale-105 active:scale-95">
              Stop Listening
            </button>
          </div>
          <style>{`@keyframes wave-motion{0%,100%{transform:scaleY(.8);opacity:.5}50%{transform:scaleY(1.2);opacity:1}}`}</style>
        </div>
      )}

      {/* ── Browse (no query) ── */}
      {!query.trim() && (
        <>
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-ink-50 sm:mb-4 sm:text-xl">Browse genres</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
              {GENRES.map(g => (
                <button key={g.label} onClick={() => playGenre(g)}
                  className="group relative h-24 overflow-hidden rounded-2xl p-4 text-left
                    transition-transform hover:scale-[1.02] active:scale-[0.98] sm:h-28"
                  style={{ background: `linear-gradient(135deg, hsl(${g.hue} 60% 35%), hsl(${(g.hue + 40) % 360} 55% 22%))` }}
                >
                  <span className="font-display text-base font-bold text-white drop-shadow sm:text-lg">{g.label}</span>
                  <Play size={18} className="absolute bottom-3 right-3 fill-white text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-ink-50 sm:mb-4 sm:text-xl">Browse all</h2>
            {browseLoading && <SkeletonRows count={10} />}
            {!browseLoading && browseAll.length > 0 && (
              <div className="overflow-hidden rounded-xl">{browseRows}</div>
            )}
            {!browseLoading && browseAll.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Music2 size={28} className="mb-3 text-ink-400" />
                <p className="text-sm text-ink-400">Couldn't load songs right now.</p>
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-ink-50 sm:text-xl">Songs</h2>
          <SkeletonRows count={7} />
        </section>
      )}

      {/* ── Empty state ── */}
      {searched && !loading && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center sm:py-20">
          <div className="grid h-14 w-14 place-items-center rounded-full border border-white/5 bg-white/[0.03] text-ink-300 backdrop-blur-xl sm:h-16 sm:w-16">
            <SearchIcon size={26} />
          </div>
          <p className="mt-4 font-display text-base font-semibold text-ink-100 sm:text-lg">No results for "{query}"</p>
          <p className="mt-1 text-xs text-ink-300 sm:text-sm">Try a different song or artist name.</p>
        </div>
      )}

      {/* ── Results ── */}
      {!loading && results.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-ink-50 sm:text-xl">
            Songs <span className="ml-2 text-sm font-normal text-ink-400">{results.length} results</span>
          </h2>
          <div className="overflow-hidden rounded-xl">{resultRows}</div>
        </section>
      )}
    </div>
  );
});
