import { Loader2, Mic, MicOff, Music2, Play, Search as SearchIcon, X, Clock } from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

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
const MAX_RECENT = 5;

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
  { label: 'Bollywood',    query: 'bollywood hits',          hue: 340, icon: '🎬' },
  { label: 'English Pop',  query: 'english pop hits',        hue: 240, icon: '🎵' },
  { label: 'Punjabi',      query: 'punjabi hits',            hue: 30,  icon: '🥁' },
  { label: 'K-Pop',        query: 'kpop hits',               hue: 320, icon: '✨' },
  { label: 'Lo-fi',        query: 'lofi hindi',              hue: 200, icon: '🌙' },
  { label: 'Romantic',     query: 'romantic hindi songs',    hue: 0,   icon: '💕' },
  { label: 'Party',        query: 'party songs hindi',       hue: 260, icon: '🎉' },
  { label: 'Hip-Hop',      query: 'hindi hip hop rap',       hue: 280, icon: '🎤' },
  { label: 'Sad Songs',    query: 'sad hindi songs',         hue: 230, icon: '💔' },
  { label: 'Sufi',         query: 'sufi songs hindi',        hue: 150, icon: '🕊️' },
  { label: 'Workout',      query: 'workout gym songs hindi', hue: 90,  icon: '💪' },
  { label: 'Chill',        query: 'chill vibes hindi',       hue: 175, icon: '😌' },
  { label: 'Retro',        query: 'old hindi songs retro',   hue: 170, icon: '📻' },
  { label: 'Rock',         query: 'rock songs',              hue: 120, icon: '🎸' },
  { label: 'Arijit Singh', query: 'arijit singh',            hue: 210, icon: '🎙️' },
  { label: 'Taylor Swift', query: 'taylor swift songs',      hue: 130, icon: '🌟' },
];

// ─── Module-level search cache ────────────────────────────────────────────────
const _searchCache = new Map<string, Song[]>();

// Precompute searchable text for ALL_SONGS
const _searchableSongs = ALL_SONGS.map(song => ({
  song,
  hay: `${song.title} ${song.artist} ${song.album} ${song.genre}`.toLowerCase(),
}));

// ─── Skeleton rows ────────────────────────────────────────────────────────────
const SkeletonRows = memo(function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
          <div className="w-5 shrink-0" />
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-ink-800" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/5 animate-pulse rounded-lg bg-ink-800" />
            <div className="h-2.5 w-2/5 animate-pulse rounded-lg bg-ink-900" />
          </div>
        </div>
      ))}
    </div>
  );
});

// ─── Song row ─────────────────────────────────────────────────────────────────
const SongRow = memo(function SongRow({
  song, index, isCurrent, isPlaying, onPlay,
}: {
  song: Song; index: number; isCurrent: boolean; isPlaying: boolean; onPlay: () => void;
}) {
  return (
    <button
      onClick={onPlay}
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left
        transition-colors hover:bg-white/[0.06] active:bg-white/10
        ${isCurrent ? 'bg-brand-500/10' : ''}`}
    >
      {/* Index / eq bars */}
      <div className="w-5 shrink-0 text-center">
        {isCurrent && isPlaying ? (
          <span className="flex items-end justify-center gap-[2px] h-3.5">
            {[0.5, 1, 0.6].map((h, j) => (
              <span key={j} className="w-[2px] rounded-full bg-brand-400 animate-bar-rise"
                style={{ height: `${h * 100}%`, animationDelay: `${j * 0.18}s` }} />
            ))}
          </span>
        ) : (
          <span className={`text-xs tabular-nums ${isCurrent ? 'text-brand-400' : 'text-ink-500'} group-hover:hidden`}>
            {index + 1}
          </span>
        )}
        {!(isCurrent && isPlaying) && (
          <Play size={12} className="hidden fill-ink-50 text-ink-50 group-hover:block mx-auto" />
        )}
      </div>

      {/* Artwork */}
      <div className="relative shrink-0">
        <Artwork title={song.title} hue={song.hue} hue2={song.hue2} imageUrl={song.imageUrl}
          className="h-11 w-11 sm:h-12 sm:w-12" rounded="rounded-xl" />
        {isCurrent && isPlaying && (
          <div className="absolute inset-0 rounded-xl bg-black/30" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold leading-tight
          ${isCurrent ? 'text-brand-400' : 'text-ink-50'}`}>
          {song.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-ink-400">
          {song.artist}
        </p>
      </div>

      {/* Duration — hidden on mobile */}
      <span className="hidden shrink-0 text-xs tabular-nums text-ink-600 sm:block">
        {formatTime(song.duration)}
      </span>
    </button>
  );
});

// ─── Recent search item ───────────────────────────────────────────────────────
const RecentItem = memo(function RecentItem({
  text, active, onSelect,
}: {
  text: string; active: boolean; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors
        ${active ? 'bg-white/10 text-ink-50' : 'text-ink-200 hover:bg-white/5'}`}
    >
      <Clock size={14} className="shrink-0 text-ink-400" />
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

  // Recent searches — shown as dropdown only when input is empty + focused
  const [recents, setRecents] = useState<string[]>([]);
  const [showRecents, setShowRecents] = useState(false);
  const [activeRecentIdx, setActiveRecentIdx] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  // Browse all
  const [browseAll, setBrowseAll] = useState<Song[]>(() => _searchCache.get('__browse__') ?? []);
  const [browseLoading, setBrowseLoading] = useState(_searchCache.get('__browse__') == null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recentsRef = useRef<HTMLDivElement>(null);

  const { playSongs, current, isPlaying, togglePlay } = usePlayer();

  // Update dropdown position whenever it opens (fixed positioning needs viewport coords)
  useLayoutEffect(() => {
    if (!showRecents || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });

    // Reposition on scroll or resize while open
    const reposition = () => {
      if (!inputRef.current) return;
      const r = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: r.bottom + 8, left: r.left, width: r.width });
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [showRecents]);

  // ── Local fuzzy search ────────────────────────────────────────────────────
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

  // ── Browse all — fetch once on first mount ────────────────────────────────
  useEffect(() => {
    if (_searchCache.has('__browse__')) return;
    setBrowseLoading(true);
    searchSongs('trending hindi songs 2024', 10)
      .then(songs => {
        const deduped = deduplicateSongs(songs);
        _searchCache.set('__browse__', deduped);
        setBrowseAll(deduped);
      })
      .catch(() => {})
      .finally(() => setBrowseLoading(false));
  }, []);

  // ── "Go to artist" event ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = async (e: Event) => {
      const artist = (e as CustomEvent<string>).detail;
      if (!artist) return;
      setQuery(artist);
      setShowRecents(false);
      setLoading(true);
      setSearched(false);
      const cached = _searchCache.get(artist);
      if (cached) {
        setResults(cached); setSearched(true); setLoading(false); return;
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
        setSearched(true); setLoading(false);
      }
    };
    window.addEventListener('vibify-search', handler);
    return () => window.removeEventListener('vibify-search', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Voice recognition ─────────────────────────────────────────────────────
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

  // ── Search effect — local instant + debounced remote ─────────────────────
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]); setSearched(false); setLoading(false);
      return;
    }

    if (abortRef.current) { abortRef.current(); abortRef.current = null; }

    const localResults = localSearch(q, 20);
    if (localResults.length > 0) { setResults(localResults); setSearched(true); }

    const cached = _searchCache.get(q);
    if (cached && cached.length > 0) {
      setResults(cached); setSearched(true); setLoading(false);
      if (!localResults.length || cached.length !== localResults.length) {
        searchSongs(q, 30).then(remote => {
          const remoteIds = new Set(remote.map(s => s.id));
          const merged = [...remote, ...localResults.filter(s => !remoteIds.has(s.id))];
          const next = deduplicateSongs(merged.length > 0 ? merged : localResults);
          _searchCache.set(q, next); setCachedSearch(q, next); setResults(next);
        }).catch(() => {});
      }
      return;
    }

    if (!localResults.length) setLoading(true);

    let cancelled = false;
    getCachedSearch(q).then(idbCached => {
      if (cancelled || !idbCached) return;
      _searchCache.set(q, idbCached);
      setResults(idbCached); setSearched(true); setLoading(false);
      searchSongs(q, 30).then(remote => {
        const remoteIds = new Set(remote.map(s => s.id));
        const local = localSearch(q, 20);
        const merged = [...remote, ...local.filter(s => !remoteIds.has(s.id))];
        const next = deduplicateSongs(merged.length > 0 ? merged : local);
        _searchCache.set(q, next); setCachedSearch(q, next); setResults(next);
      }).catch(() => {});
    });

    debounceRef.current = setTimeout(async () => {
      if (cancelled) return;
      try {
        const [remote, local2] = await Promise.all([
          searchSongs(q, 30),
          Promise.resolve(localSearch(q, 20)),
        ]);
        let merged = remote;
        if (remote.length < 5) {
          const remoteIds = new Set(remote.map(s => s.id));
          merged = [...remote, ...local2.filter(s => !remoteIds.has(s.id))];
        }
        const next = deduplicateSongs(merged.length > 0 ? merged : local2);
        _searchCache.set(q, next); setCachedSearch(q, next); setResults(next);
      } catch {
        setResults(deduplicateSongs(localSearch(q, 20)));
      } finally {
        setSearched(true); setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // ── Input handlers ────────────────────────────────────────────────────────

  // Show last 5 recent searches only when input is empty and focused
  const handleInputFocus = useCallback(() => {
    if (!query.trim()) {
      const r = getRecentSearches();
      setRecents(r.slice(0, 5));
      setShowRecents(r.length > 0);
      setActiveRecentIdx(-1);
    }
  }, [query]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (value.trim().length > 0) setShowRecents(false);
  }, []);

  const selectRecent = useCallback((text: string) => {
    setQuery(text);
    setShowRecents(false);
    setActiveRecentIdx(-1);
    saveRecentSearch(text);
    inputRef.current?.blur();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showRecents || recents.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveRecentIdx(prev => (prev + 1) % recents.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveRecentIdx(prev => (prev - 1 + recents.length) % recents.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeRecentIdx >= 0 && activeRecentIdx < recents.length) {
        selectRecent(recents[activeRecentIdx]);
      }
    } else if (e.key === 'Escape') {
      setShowRecents(false);
      setActiveRecentIdx(-1);
    }
  }, [showRecents, recents, activeRecentIdx, selectRecent]);

  // Close recents when clicking outside
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (
        recentsRef.current && !recentsRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowRecents(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const playSong = useCallback((s: Song) => {
    if (current?.id === s.id) togglePlay();
    else playSongs(results.length > 0 ? results : [s], s.id);
    // save to recents when user explicitly plays from search results
    saveRecentSearch(s.title);
  }, [current, togglePlay, playSongs, results]);

  const toggleVoiceSearch = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) { setVoiceError('Voice search is not supported in this browser.'); return; }
    if (voiceListening) {
      rec.stop(); setVoiceListening(false); setInterimTranscript(''); return;
    }
    setVoiceError(null); setInterimTranscript(''); setVoiceListening(true);
    if (current && isPlaying) togglePlay();
    try { rec.start(); }
    catch { setVoiceListening(false); setVoiceError('Voice search could not be started.'); }
  }, [voiceListening, current, isPlaying, togglePlay]);

  const playGenre = useCallback(async (g: typeof GENRES[0]) => {
    const cached = _searchCache.get('genre:' + g.query);
    if (cached) { playSongs(cached, cached[0].id); return; }
    const list = deduplicateSongs(await getArtistSongs(g.query, 10));
    if (list.length) { _searchCache.set('genre:' + g.query, list); playSongs(list, list[0].id); }
  }, [playSongs]);

  const clearQuery = useCallback(() => {
    setQuery('');
    setShowRecents(false);
    setActiveRecentIdx(-1);
    inputRef.current?.focus();
  }, []);

  const resultRows = useMemo(() =>
    results.map((s, i) => (
      <SongRow key={s.id} song={s} index={i}
        isCurrent={current?.id === s.id}
        isPlaying={isPlaying && current?.id === s.id}
        onPlay={() => playSong(s)} />
    )),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [results, current?.id, isPlaying]);

  const browseRows = useMemo(() =>
    browseAll.map((s, i) => (
      <SongRow key={s.id} song={s} index={i}
        isCurrent={current?.id === s.id}
        isPlaying={isPlaying && current?.id === s.id}
        onPlay={() => { if (current?.id === s.id) togglePlay(); else playSongs(browseAll, s.id); }} />
    )),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [browseAll, current?.id, isPlaying]);

  const showResults  = searched && !loading && results.length > 0;
  const showEmpty    = searched && !loading && results.length === 0;

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

        {/* ── Recent searches dropdown — fixed so it always floats above all content ── */}
        {showRecents && recents.length > 0 && (
          <div
            ref={recentsRef}
            style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
            className="fixed z-[999] overflow-hidden rounded-2xl
              border border-white/10 bg-ink-900 shadow-2xl"
          >
            <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-ink-500">
              Recent searches
            </p>
            {recents.map((text, i) => (
              <RecentItem
                key={text}
                text={text}
                active={i === activeRecentIdx}
                onSelect={() => selectRecent(text)}
              />
            ))}
          </div>
        )}
      </div>

      {voiceError && <p className="text-sm text-red-400">{voiceError}</p>}

      {/* ── Voice listening modal ── */}
      {voiceListening && (
        <div onClick={toggleVoiceSearch}
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 backdrop-blur-sm">
          <div onClick={e => e.stopPropagation()}
            className="flex w-[92%] max-w-xs sm:max-w-sm flex-col items-center gap-6 rounded-3xl
              border border-brand-400/20 bg-gradient-to-b from-brand-500/10 to-ink-900/50
              p-5 sm:p-8 shadow-2xl max-h-[80vh] overflow-auto mt-24 sm:mt-0">
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
            <h2 className="mb-3 font-display text-base font-bold text-ink-50 sm:text-lg">Browse genres</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {GENRES.map(g => (
                <button key={g.label} onClick={() => playGenre(g)}
                  className="group relative flex items-center gap-3 overflow-hidden rounded-2xl
                    p-3.5 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: `linear-gradient(135deg, hsl(${g.hue} 55% 28%), hsl(${(g.hue + 50) % 360} 45% 18%))` }}>
                  <span className="text-2xl">{g.icon}</span>
                  <span className="font-semibold text-sm text-white leading-tight">{g.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-display text-base font-bold text-ink-50 sm:text-lg">Trending right now</h2>
            {browseLoading ? (
              <SkeletonRows count={8} />
            ) : browseAll.length > 0 ? (
              <div className="space-y-1">{browseRows}</div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Music2 size={26} className="mb-2 text-ink-600" />
                <p className="text-sm text-ink-500">Couldn't load songs right now.</p>
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <section>
          <div className="mb-3 h-5 w-24 animate-pulse rounded-lg bg-ink-800" />
          <SkeletonRows count={6} />
        </section>
      )}

      {/* ── Empty state ── */}
      {showEmpty && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full border border-white/5 bg-white/[0.03] text-ink-500">
            <SearchIcon size={24} />
          </div>
          <p className="mt-4 text-base font-semibold text-ink-200">No results for "{query}"</p>
          <p className="mt-1 text-xs text-ink-500">Try a different song or artist name.</p>
        </div>
      )}

      {/* ── Results ── */}
      {showResults && (
        <section>
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="font-display text-base font-bold text-ink-50 sm:text-lg">
              {(() => {
                const q = query.trim().toLowerCase();
                const artistMatch = results.filter(s => s.artist.toLowerCase().includes(q));
                if (results.length >= 3 && artistMatch.length >= Math.ceil(results.length * 0.6)) {
                  return <><span className="text-brand-400">{results[0].artist}</span></>;
                }
                return 'Results';
              })()}
            </h2>
            <span className="text-xs text-ink-500">{results.length} songs</span>
          </div>
          <div className="space-y-1">{resultRows}</div>
        </section>
      )}
    </div>
  );
});
