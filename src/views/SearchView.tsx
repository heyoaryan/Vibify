import { Loader2, Mic, MicOff, Music2, Play, Search as SearchIcon, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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

// Remove duplicate songs by ID, then by (title + artist), then by imageUrl
function deduplicateSongs(songs: Song[]): Song[] {
  const seenIds = new Set<string>();
  const seenTitleArtist = new Set<string>();
  const seenImages = new Set<string>();
  const result: Song[] = [];

  for (const song of songs) {
    if (seenIds.has(song.id)) continue;

    const titleArtistKey = `${song.title.toLowerCase().trim()}|${song.artist.toLowerCase().trim()}`;
    if (seenTitleArtist.has(titleArtistKey)) continue;

    // Same image URL = almost certainly the same song
    if (song.imageUrl && seenImages.has(song.imageUrl)) continue;

    seenIds.add(song.id);
    seenTitleArtist.add(titleArtistKey);
    if (song.imageUrl) seenImages.add(song.imageUrl);
    result.push(song);
  }

  return result;
}

const GENRES = [
  { label: 'Bollywood',      query: 'bollywood hits',            hue: 340 },
  { label: 'Arijit Singh',   query: 'arijit singh',              hue: 210 },
  { label: 'Punjabi',        query: 'punjabi hits',              hue: 30  },
  { label: 'Lo-fi',          query: 'lofi hindi',                hue: 200 },
  { label: 'Romantic',       query: 'romantic hindi songs',      hue: 0   },
  { label: 'Party',          query: 'party songs hindi',         hue: 260 },
  { label: 'Devotional',     query: 'hindi devotional songs',    hue: 45  },
  { label: 'Retro',          query: 'old hindi songs retro',     hue: 170 },
  { label: 'Hip-Hop',        query: 'hindi hip hop rap',         hue: 280 },
  { label: 'Sad Songs',      query: 'sad hindi songs',           hue: 230 },
  { label: 'Item Songs',     query: 'item songs bollywood',      hue: 10  },
  { label: 'Sufi',           query: 'sufi songs hindi',          hue: 150 },
  { label: 'Workout',        query: 'workout gym songs hindi',   hue: 90  },
  { label: 'AR Rahman',      query: 'ar rahman songs',           hue: 190 },
  { label: 'Indie',          query: 'hindi indie songs',         hue: 310 },
  { label: 'Chill',          query: 'chill vibes hindi',         hue: 175 },
  { label: 'Trending',       query: 'trending songs 2024',       hue: 55  },
  { label: 'English Pop',    query: 'english pop hits',          hue: 240 },
];

export function SearchView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Browse all — 10 dynamic songs fetched once on mount
  const [browseAll, setBrowseAll] = useState<Song[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const { playSongs, current, isPlaying, togglePlay } = usePlayer();

  const localSearch = (text: string, limit = 20) => {
    const terms = text.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];

    return ALL_SONGS.filter(song => {
      const haystack = `${song.title} ${song.artist} ${song.album} ${song.genre}`.toLowerCase();
      return terms.every(term => haystack.includes(term));
    }).slice(0, limit);
  };

  // Fetch 10 trending songs for "Browse all" on mount
  useEffect(() => {
    setBrowseLoading(true);
    searchSongs('trending hindi songs 2024', 10)
      .then(songs => setBrowseAll(deduplicateSongs(songs)))
      .catch(() => {})
      .finally(() => setBrowseLoading(false));
  }, []);

  // Listen for "Go to artist" from NowPlayingView action sheet
  // Direct fetch — bypasses debounce so results load immediately on navigation
  useEffect(() => {
    const handler = async (e: Event) => {
      const artist = (e as CustomEvent<string>).detail;
      if (!artist) return;

      // Set the visible query text
      setQuery(artist);
      setLoading(true);
      setSearched(false);

      try {
        const remoteResults = await searchSongs(artist, 20);
        const next = remoteResults.length > 0
          ? deduplicateSongs(remoteResults)
          : deduplicateSongs(localSearch(artist, 20));
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
  // localSearch is defined inside component — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionCtor) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';
      recognition.onresult = event => {
        let interim = '';
        let final = '';
        for (let i = event.results.length - 1; i >= 0; i--) {
          const transcript = event.results[i][0]?.transcript ?? '';
          if (event.results[i].isFinal) {
            final = transcript;
          } else {
            interim = transcript;
          }
        }
        // Only show interim in modal, never final text there
        setInterimTranscript(interim);
        // Only update query with final result, not interim
        if (final) {
          setVoiceError(null);
          setQuery(final);
        }
      };
      recognition.onerror = event => {
        setVoiceListening(false);
        setVoiceError(event.error === 'not-allowed' ? 'Microphone access was denied.' : 'Voice search could not be completed.');
      };
      recognition.onend = () => {
        setVoiceListening(false);
        setInterimTranscript('');
      };
      recognitionRef.current = recognition;
    } else {
      setVoiceSupported(false);
    }

    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) { setResults([]); setSearched(false); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const remoteResults = await searchSongs(q, 20);
        const nextResults = remoteResults.length > 0
          ? deduplicateSongs(remoteResults)
          : deduplicateSongs(localSearch(q, 20));
        setResults(nextResults);
      } catch {
        setResults(deduplicateSongs(localSearch(q, 20)));
      } finally {
        setSearched(true);
        setLoading(false);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const playSong = (s: Song) => {
    if (current?.id === s.id) togglePlay();
    else playSongs(results.length > 0 ? results : [s], s.id);
  };

  const toggleVoiceSearch = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setVoiceError('Voice search is not supported in this browser.');
      return;
    }

    if (voiceListening) {
      recognition.stop();
      setVoiceListening(false);
      setInterimTranscript('');
      return;
    }

    setVoiceError(null);
    setInterimTranscript('');
    setVoiceListening(true);
    
    // Pause currently playing song
    if (current && isPlaying) {
      togglePlay();
    }
    
    try {
      recognition.start();
    } catch {
      setVoiceListening(false);
      setVoiceError('Voice search could not be started.');
    }
  };

  const playGenre = async (g: typeof GENRES[0]) => {
    const list = deduplicateSongs(await getArtistSongs(g.query, 10));
    if (list.length) playSongs(list, list[0].id);
  };

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
          onClick={() => toggleVoiceSearch()}
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-[92%] max-w-xs sm:max-w-sm flex-col items-center gap-6 rounded-3xl border border-brand-400/20 bg-gradient-to-b from-brand-500/10 to-ink-900/50 p-5 sm:p-8 shadow-2xl max-h-[80vh] overflow-auto mt-24 sm:mt-0"
          >

            {/* Animated waveform */}
            <div className="flex items-end justify-center gap-1 h-16">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-gradient-to-t from-brand-400 to-brand-300 animate-pulse"
                  style={{
                    height: `${20 + Math.sin(i * 0.5) * 20}px`,
                    opacity: 0.5 + Math.sin(Date.now() / 100 + i) * 0.5,
                    animation: `wave-motion 0.8s ease-in-out ${i * 0.05}s infinite`,
                  }}
                />
              ))}
            </div>

            {/* Status text */}
            <div className="text-center">
              <p className="font-display text-2xl font-bold text-ink-50">Listening…</p>
              <p className="mt-2 text-sm text-ink-300">Speak a song or artist name</p>
            </div>

            {/* Interim transcript */}
            {interimTranscript && (
              <div className="w-full rounded-2xl border border-brand-400/30 bg-white/[0.03] p-4 backdrop-blur-xl">
                <p className="text-sm text-brand-200">{interimTranscript}</p>
              </div>
            )}

            {/* Stop button */}
            <button
              onClick={toggleVoiceSearch}
              className="mt-4 w-full rounded-xl bg-brand-400 py-2.5 text-sm font-semibold text-ink-950 transition-all hover:scale-105 active:scale-95"
            >
              Stop Listening
            </button>
          </div>

          {/* Keyframe animation */}
          <style>{`
            @keyframes wave-motion {
              0%, 100% { transform: scaleY(0.8); opacity: 0.5; }
              50% { transform: scaleY(1.2); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* ── Browse (no query) ── */}
      {!query.trim() && (
        <>
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-ink-50 sm:mb-4 sm:text-xl">Browse genres</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
              {GENRES.map(g => (
                <button
                  key={g.label}
                  onClick={() => playGenre(g)}
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

            {/* Loading skeleton */}
            {browseLoading && (
              <div className="space-y-1 overflow-hidden rounded-xl">
                {Array.from({ length: 10 }).map((_, i) => (
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
            )}

            {/* Song list */}
            {!browseLoading && browseAll.length > 0 && (
              <div className="overflow-hidden rounded-xl">
                {browseAll.map((s, i) => {
                  const isCurrent = current?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        if (isCurrent) togglePlay();
                        else playSongs(browseAll, s.id);
                      }}
                      className="group grid w-full grid-cols-[20px_40px_1fr_auto] items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/5
                        sm:grid-cols-[24px_44px_1fr_auto] sm:gap-3"
                    >
                      <span className="text-xs tabular-nums text-ink-300 sm:text-sm">
                        {isCurrent && isPlaying
                          ? <span className="flex items-end gap-[2px] h-4">
                              {[0.6, 1, 0.4].map((h, j) => (
                                <span key={j} className="w-[2px] rounded-full bg-brand-400 animate-bar-rise"
                                  style={{ height: `${h * 100}%`, animationDelay: `${j * 0.2}s` }} />
                              ))}
                            </span>
                          : <>
                              <span className="group-hover:hidden">{i + 1}</span>
                              <Play size={13} className="hidden fill-brand-400 text-brand-400 group-hover:block" />
                            </>}
                      </span>
                      <Artwork title={s.title} hue={s.hue} hue2={s.hue2} imageUrl={s.imageUrl}
                        className="h-10 w-10" rounded="rounded-md" />
                  <div className="min-w-0">
                        <p className={`truncate text-xs font-medium sm:text-sm ${isCurrent ? 'text-brand-400' : 'text-ink-50'}`}>{s.title}</p>
                        <p className="truncate text-[10px] text-ink-300 sm:text-xs">{s.artist} · {s.album}</p>
                      </div>
                      <span className="hidden text-xs tabular-nums text-ink-300 sm:block">{formatTime(s.duration)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
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
          <div className="space-y-1 overflow-hidden rounded-xl">
            {Array.from({ length: 7 }).map((_, i) => (
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
            Songs
            <span className="ml-2 text-sm font-normal text-ink-400">{results.length} results</span>
          </h2>
          <div className="overflow-hidden rounded-xl">
            {results.map((s, i) => {
              const isCurrent = current?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => playSong(s)}
                  className="group grid w-full grid-cols-[20px_40px_1fr_auto] items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/5
                    sm:grid-cols-[24px_44px_1fr_auto] sm:gap-3"
                >
                  <span className="text-xs tabular-nums text-ink-300 sm:text-sm">
                    {isCurrent && isPlaying
                      ? <span className="flex items-end gap-[2px] h-4">
                          {[0.6, 1, 0.4].map((h, j) => (
                            <span key={j} className="w-[2px] rounded-full bg-brand-400 animate-bar-rise"
                              style={{ height: `${h * 100}%`, animationDelay: `${j * 0.2}s` }} />
                          ))}
                        </span>
                      : <>
                          <span className="group-hover:hidden">{i + 1}</span>
                          <Play size={13} className="hidden fill-brand-400 text-brand-400 group-hover:block" />
                        </>}
                  </span>
                  <Artwork title={s.title} hue={s.hue} hue2={s.hue2} imageUrl={s.imageUrl}
                    className="h-10 w-10" rounded="rounded-md" />
                  <div className="min-w-0">
                    <p className={`truncate text-xs font-medium sm:text-sm ${isCurrent ? 'text-brand-400' : 'text-ink-50'}`}>{s.title}</p>
                    <p className="truncate text-[10px] text-ink-300 sm:text-xs">{s.artist} · {s.album}</p>
                  </div>
                  <span className="hidden text-xs tabular-nums text-ink-300 sm:block">{formatTime(s.duration)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}    </div>
  );
}
