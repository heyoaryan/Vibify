import { Loader2, Mic, MicOff, Music2, Play, Search as SearchIcon, X, Clock } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePlayer } from '../player';
import type { Song } from '../types';
import { Artwork } from '../components/Artwork';
import { formatTime } from '../lib';
import { searchSongs, getArtistSongs } from '../saavn';
import { getCachedSearch, setCachedSearch } from '../searchCache';
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

// ─── Recent searches (sessionStorage) ────────────────────────────────────────
const RECENT_KEY = 'vibify-recent-searches';
const MAX_RECENT = 8;

function getRecentSearches(): string[] {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecentSearch(q: string) {
  try {
    const list = getRecentSearches().filter(s => s.toLowerCase() !== q.toLowerCase());
    list.unshift(q);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
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
  { label: 'English Pop',  query: 'english pop hits',        hue: 240 },
  { label: 'BTS',          query: 'BTS songs',               hue: 280 },
  { label: 'K-Pop',        query: 'kpop hits',               hue: 320 },
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
  { label: 'Rock',         query: 'rock songs',              hue: 120 },
  { label: 'Jazz',         query: 'jazz songs',              hue: 40  },
  { label: 'Classical',    query: 'classical music',         hue: 180 },
  { label: 'EDM',          query: 'edm electronic dance',    hue: 300 },
  { label: 'Country',      query: 'country songs',           hue: 80  },
  { label: 'R&B',          query: 'rnb songs',               hue: 250 },
  { label: 'Taylor Swift', query: 'taylor swift songs',      hue: 130 },
  { label: 'Arijit Singh', query: 'arijit singh',            hue: 210 },
];

// ─── Module-level search cache (persists across re-mounts) ───────────────────
const _searchCache = new Map<string, Song[]>();

// Precompute searchable text for ALL_SONGS for faster local search
const _searchableSongs = ALL_SONGS.map(song => ({
  song,
  hay: `${song.title} ${song.artist} ${song.album} ${song.genre}`.toLowerCase(),
}));

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

// ─── Suggestion item ──────────────────────────────────────────────────────────
const SuggestionItem = memo(function SuggestionItem({
  text,
  type,
  active,
  onSelect,
}: {
  text: string;
  type: 'recent' | 'genre' | 'cache';
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors
        ${active ? 'bg-white/10 text-ink-50' : 'text-ink-200 hover:bg-white/5'}`}
    >
      {type === 'recent' ? (
        <Clock size={14} className="shrink-0 text-ink-400" />
      ) : type === 'genre' ? (
        <Music2 size={14} className="shrink-0 text-brand-400" />
      ) : (
        <SearchIcon size={14} className="shrink-0 text-ink-400" />
      )}
      <span className="truncate">{text}</span>
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

  // Suggestions state
  const [suggestions, setSuggestions] = useState<{ text: string; type: 'recent' | 'genre' | 'cache' }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Browse all — fetched once, cached in module scope
  const [browseAll, setBrowseAll] = useState<Song[]>(() => _searchCache.get('__browse__') ?? []);
  const [browseLoading, setBrowseLoading] = useState(_searchCache.get('__browse__') == null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { playSongs, current, isPlaying, togglePlay } = usePlayer();

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // ── Local (offline) search — partial/fuzzy substring match ───────────────
  const localSearch = useCallback((text: string, limit = 20) => {
    const terms = text.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
    if (!terms.length) return [];
    return _searchableSongs
      .map(({ song, hay }) => {
        let score = 0;
        for (const t of terms) {
          if (!hay.includes(t)) return null;
          score += hay.split(t).length - 1;
          if (hay.startsWith(t) || hay.includes(' ' + t)) score += 2;
        }
        return { song, score };
      })
      .filter((x): x is { song: Song; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .map(x => x.song)
      .slice(0, limit);
  }, []);

  // ── Fetch suggestions for a query ────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      return;
    }
    const qLower = q.toLowerCase();
    const items: { text: string; type: 'recent' | 'genre' | 'cache' }[] = [];

    // Recent searches
    const recent = getRecentSearches();
    for (const s of recent) {
      if (s.toLowerCase().includes(qLower) && s.toLowerCase() !== qLower) {
        items.push({ text: s, type: 'recent' });
      }
    }

    // Genre matches
    for (const g of GENRES) {
      if (g.label.toLowerCase().includes(qLower) || g.query.toLowerCase().includes(qLower)) {
        items.push({ text: g.label, type: 'genre' });
      }
    }

    // Cached queries (from memory)
    for (const cachedQ of _searchCache.keys()) {
      if (cachedQ.startsWith('__') || cachedQ.startsWith('genre:')) continue;
      if (cachedQ.toLowerCase().includes(qLower) && cachedQ.toLowerCase() !== qLower) {
        items.push({ text: cachedQ, type: 'cache' });
      }
    }

    // Deduplicate suggestions
    const seen = new Set<string>();
    const unique = items.filter(item => {
      const key = item.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setSuggestions(unique.slice(0, 6));
    setActiveSuggestionIndex(-1);
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
      setShowSuggestions(false);
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
    rec.onresult = (event: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }> }) => {
      let interim = '', final = '';
      for (let i = event.results.length - 1; i >= 0; i--) {
        const t = event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) final = t; else interim = t;
      }
      setInterimTranscript(interim);
      if (final) { setVoiceError(null); setQuery(final); }
    };
    rec.onerror = (ev: { error: string }) => {
      setVoiceListening(false);
      setVoiceError(ev.error === 'not-allowed' ? 'Microphone access was denied.' : 'Voice search could not be completed.');
    };
    rec.onend = () => { setVoiceListening(false); setInterimTranscript(''); };
    recognitionRef.current = rec;
    return () => { recognitionRef.current?.stop(); recognitionRef.current = null; };
  }, []);

  // ── Instant local results + stale-while-revalidate ────────────────────────
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      setShowSuggestions(false);
      return;
    }

    // Cancel any pending remote fetch
    if (abortRef.current) { abortRef.current(); abortRef.current = null; }

    // INSTANT: Show local results immediately
    const localResults = localSearch(q, 20);
    const hasLocal = localResults.length > 0;

    if (hasLocal) {
      setResults(localResults);
      setSearched(true);
    }

    // Check memory cache
    const cached = _searchCache.get(q);
    if (cached && cached.length > 0) {
      setResults(cached);
      setSearched(true);
      setLoading(false);
      // Still revalidate in background if local results are different
      if (!hasLocal || cached.length !== localResults.length) {
        // Background revalidation
        searchSongs(q, 30).then(remote => {
          const remoteIds = new Set(remote.map(s => s.id));
          const merged = [...remote, ...localResults.filter(s => !remoteIds.has(s.id))];
          const next = deduplicateSongs(merged.length > 0 ? merged : localResults);
          _searchCache.set(q, next);
          setCachedSearch(q, next);
          setResults(next);
        }).catch(() => {});
      }
      return;
    }

    // No cache hit — fetch remote (don't show spinner if we have local results)
    if (!hasLocal) {
      setLoading(true);
    }

    // Async IndexedDB cache check
    let cancelled = false;
    getCachedSearch(q).then(idbCached => {
      if (cancelled || !idbCached) return;
      _searchCache.set(q, idbCached);
      setResults(idbCached);
      setSearched(true);
      setLoading(false);
      // Background revalidation
      searchSongs(q, 30).then(remote => {
        const remoteIds = new Set(remote.map(s => s.id));
        const local = localSearch(q, 20);
        const merged = [...remote, ...local.filter(s => !remoteIds.has(s.id))];
        const next = deduplicateSongs(merged.length > 0 ? merged : local);
        _searchCache.set(q, next);
        setCachedSearch(q, next);
        setResults(next);
      }).catch(() => {});
    });

    // Debounced remote fetch
    debounceRef.current = setTimeout(async () => {
      if (cancelled) return;
      try {
        const [remote, localResults2] = await Promise.all([
          searchSongs(q, 30),
          Promise.resolve(localSearch(q, 20)),
        ]);

        let merged = remote;
        if (remote.length < 5) {
          const remoteIds = new Set(remote.map(s => s.id));
          merged = [...remote, ...localResults2.filter(s => !remoteIds.has(s.id))];
        }

        const next = deduplicateSongs(merged.length > 0 ? merged : localResults2);
        _searchCache.set(q, next);
        setCachedSearch(q, next);
        setResults(next);
      } catch {
        const fallback = deduplicateSongs(localSearch(q, 20));
        setResults(fallback);
      } finally {
        setSearched(true);
        setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // ── Suggestions dropdown logic ────────────────────────────────────────────
  useEffect(() => {
    if (query.trim()) {
      fetchSuggestions(query);
    } else {
      setSuggestions([]);
    }
  }, [query, fetchSuggestions]);

  const handleInputFocus = useCallback(() => {
    if (!query.trim() && recentSearches.length > 0) {
      const items = recentSearches.slice(0, 5).map(text => ({ text, type: 'recent' as const }));
      setSuggestions(items);
      setShowSuggestions(true);
      setActiveSuggestionIndex(-1);
    }
  }, [query, recentSearches]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestions(value.trim().length > 0 || recentSearches.length > 0);
    setActiveSuggestionIndex(-1);
  }, [recentSearches.length]);

  const selectSuggestion = useCallback((text: string) => {
    setQuery(text);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    saveRecentSearch(text);
    setRecentSearches(getRecentSearches());
    inputRef.current?.blur();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
        selectSuggestion(suggestions[activeSuggestionIndex].text);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  }, [showSuggestions, suggestions, activeSuggestionIndex, selectSuggestion]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const clearQuery = useCallback(() => {
    setQuery('');
    setShowSuggestions(recentSearches.length > 0);
    setActiveSuggestionIndex(-1);
    inputRef.current?.focus();
  }, [recentSearches.length]);

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

  const showResults = searched && !loading && results.length > 0;
  const showEmpty = searched && !loading && results.length === 0;
  const showSkeletons = loading;

  return (
    <div className="animate-fade-in space-y-6 px-3 pb-12 sm:space-y-8 sm:px-5 lg:px-8">

      {/* ── Search input ── */}
      <div className="relative">
        <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-300 sm:size-5" />
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
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
              ? <button onClick={clearQuery} aria-label="Clear"
                  className="rounded-full p-1 text-ink-300 hover:text-ink-50">
                  <X size={17} />
                </button>
              : null}
        </div>

        {/* ── Suggestions dropdown ── */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl
              border border-white/5 bg-ink-900/95 backdrop-blur-xl shadow-2xl"
          >
            {suggestions.map((s, i) => (
              <SuggestionItem
                key={`${s.type}-${s.text}`}
                text={s.text}
                type={s.type}
                active={i === activeSuggestionIndex}
                onSelect={() => selectSuggestion(s.text)}
              />
            ))}
          </div>
        )}
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
      {showSkeletons && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-ink-50 sm:text-xl">Songs</h2>
          <SkeletonRows count={7} />
        </section>
      )}

      {/* ── Empty state ── */}
      {showEmpty && (
        <div className="flex flex-col items-center justify-center py-16 text-center sm:py-20">
          <div className="grid h-14 w-14 place-items-center rounded-full border border-white/5 bg-white/[0.03] text-ink-300 backdrop-blur-xl sm:h-16 sm:w-16">
            <SearchIcon size={26} />
          </div>
          <p className="mt-4 font-display text-base font-semibold text-ink-100 sm:text-lg">No results for "{query}"</p>
          <p className="mt-1 text-xs text-ink-300 sm:text-sm">Try a different song or artist name.</p>
        </div>
      )}

      {/* ── Results ── */}
      {showResults && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-ink-50 sm:text-xl">
            {(() => {
              if (results.length >= 3) {
                const q = query.trim().toLowerCase();
                const artistMatch = results.filter(s =>
                  s.artist.toLowerCase().includes(q)
                );
                if (artistMatch.length >= Math.ceil(results.length * 0.6)) {
                  return (
                    <>
                      Songs by <span className="text-brand-400">{results[0].artist}</span>
                      <span className="ml-2 text-sm font-normal text-ink-400">{results.length} songs</span>
                    </>
                  );
                }
              }
              return (
                <>
                  Results <span className="ml-2 text-sm font-normal text-ink-400">{results.length} songs</span>
                </>
              );
            })()}
          </h2>
          <div className="overflow-hidden rounded-xl">{resultRows}</div>
        </section>
      )}
    </div>
  );
});
