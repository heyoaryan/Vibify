import { Clock, Flame, Play, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRecentlyPlayed } from '../history';

import { usePlayer } from '../player';
import type { Song } from '../types';
import { Artwork } from '../components/Artwork';
import { SongRowCard } from '../components/Cards';
import { getTrendingSongs, getNewReleases, getArtistSongs, searchSongs, getSongDetails } from '../saavn';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-2">
      <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-ink-700" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-3/4 animate-pulse rounded bg-ink-700" />
        <div className="h-2.5 w-1/2 animate-pulse rounded bg-ink-800" />
      </div>
    </div>
  );
}


function SkeletonAlbum() {
  return (
    <div className="w-36 shrink-0 rounded-2xl border border-white/5 bg-white/[0.03] p-3 sm:w-40 lg:w-44">
      <div className="aspect-square w-full animate-pulse rounded-xl bg-ink-700" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-3/4 animate-pulse rounded bg-ink-700" />
        <div className="h-2.5 w-1/2 animate-pulse rounded bg-ink-800" />
      </div>
    </div>
  );
}

function dedupe(songs: Song[]): Song[] {
  const seen = new Set<string>();
  return songs.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
}

// ── Made For You moods ────────────────────────────────────────────────────────
const MOODS = [
  { label: 'Chill Vibes',    query: 'chill lofi hindi', hue: 200, hue2: 240, icon: '🌙' },
  { label: 'Heartbreak',     query: 'sad breakup hindi songs', hue: 0, hue2: 330, icon: '💔' },
  { label: 'Party Mode',     query: 'party songs bollywood', hue: 55, hue2: 20, icon: '🎉' },
  { label: 'Road Trip',      query: 'road trip songs hindi', hue: 160, hue2: 200, icon: '🚗' },
  { label: 'Late Night',     query: 'late night hindi songs', hue: 250, hue2: 280, icon: '🌃' },
  { label: 'Morning Fresh',  query: 'happy morning songs hindi', hue: 45, hue2: 80, icon: '☀️' },
];

export function HomeView() {
  const { playSongs, current, isPlaying, togglePlay } = usePlayer();
  const historyPlays = useRecentlyPlayed();

  const [quickPicks, setQuickPicks]   = useState<Song[]>([]);
  const [trending, setTrending]       = useState<Song[]>([]);
  const [releases, setReleases]       = useState<Song[]>([]);
  const [madeForYou, setMadeForYou]   = useState<Song[]>([]);
  const [spotlight, setSpotlight]     = useState<Song | null>(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    Promise.all([
      getTrendingSongs(20),
      delay(250).then(() => getNewReleases(20)),
      delay(500).then(() => getArtistSongs('arijit singh', 8)),
      delay(750).then(() => searchSongs('chill hindi 2025', 10)),
    ]).then(([trendingRaw, releasesRaw, arijitRaw, chillRaw]) => {
      const used = new Set<string>();

      const picks = dedupe(trendingRaw).slice(0, 6);
      picks.forEach(s => used.add(s.id));

      const trendingF = dedupe(trendingRaw).filter(s => !used.has(s.id));
      trendingF.forEach(s => used.add(s.id));

      const releasesF = dedupe(releasesRaw).filter(s => !used.has(s.id)).slice(0, 12);
      releasesF.forEach(s => used.add(s.id));

      const mfy = dedupe(chillRaw).filter(s => !used.has(s.id)).slice(0, 10);
      mfy.forEach(s => used.add(s.id));

      const spot = arijitRaw.find(s => !used.has(s.id)) ?? arijitRaw[0] ?? trendingRaw[0] ?? null;

      setQuickPicks(picks);
      setTrending(trendingF);
      setReleases(releasesF);
      setMadeForYou(mfy);
      setSpotlight(spot);
      setLoading(false);
    }).catch((err) => {
      console.error('HomeView fetch error:', err);
      setLoading(false);
    });
  }, []);

  // Derive recently-played songs directly from play history — no separate state needed.
  const recentSongs: Song[] = historyPlays.map((it) => ({
    id: it.songId,
    title: it.title,
    artist: it.artist,
    album: '',
    year: 0,
    duration: 0,
    hue: it.hue,
    hue2: (it.hue + 40) % 360,
    src: '',
    genre: '',
    imageUrl: it.imageUrl,
  }));

  const [fetchingId, setFetchingId] = useState<string | null>(null);

  const play = (s: Song, list: Song[]) => {
    if (current?.id === s.id) { togglePlay(); return; }
    // Songs from recently-played history have no src — fetch fresh details first
    if (!s.src) {
      setFetchingId(s.id);
      getSongDetails(s.id)
        .then(fresh => {
          if (fresh?.src) {
            playSongs([fresh], fresh.id);
          } else {
            // Fallback: search by title + artist and play first result
            return searchSongs(`${s.title} ${s.artist}`, 5).then(results => {
              const match = results[0];
              if (match) playSongs(results, match.id);
            });
          }
        })
        .finally(() => setFetchingId(null));
      return;
    }
    playSongs(list, s.id);
  };

  const playMood = async (mood: typeof MOODS[0]) => {
    const list = await searchSongs(mood.query, 20);
    if (list.length) playSongs(list, list[0].id);
  };

  return (
    <div className="animate-fade-in space-y-8 px-3 pb-12 sm:space-y-10 sm:px-5 lg:px-8">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-2xl border border-white/5
        bg-gradient-to-br from-ink-800/60 via-ink-850 to-ink-900
        p-5 sm:rounded-3xl sm:p-6 lg:p-8">

        <div className="relative">
          <p className="text-xs font-medium text-brand-400 sm:text-sm">{greeting()}</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink-50 text-balance sm:text-3xl lg:text-4xl">
            What sounds right, right now?
          </h1>
          <p className="mt-2 max-w-lg text-sm text-ink-200 sm:text-base">
            Fresh releases, trending tracks, and curated picks — all real, all now.
          </p>
        </div>
      </section>

      {/* ── Quick picks ── */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-ink-50 sm:mb-4 sm:text-xl">Quick picks</h2>
        <div className="no-scrollbar snap-rail flex gap-2.5 overflow-x-auto pb-1 sm:hidden">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-56 shrink-0 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-1.5">
                  <SkeletonRow />
                </div>
              ))
            : quickPicks.map(s => {
                const isCurrent = current?.id === s.id;
                const isThisPlaying = isCurrent && isPlaying;
                return (
                  <button key={s.id} onClick={() => play(s, quickPicks)}
                    className="snap-card group flex w-56 shrink-0 items-center gap-3 overflow-hidden
                      rounded-xl border border-white/5 bg-white/[0.03] pr-3 text-left
                      backdrop-blur-xl transition-all hover:bg-white/[0.06]">
                    <div className="relative h-14 w-14 shrink-0">
                      <Artwork title={s.title} hue={s.hue} hue2={s.hue2} imageUrl={s.imageUrl}
                        className="h-full w-full" rounded="rounded-none" />
                      {isThisPlaying && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <div className="flex items-end gap-[2px] h-4">
                            {[0.6, 1, 0.4].map((h, j) => (
                              <span key={j} className="w-[2px] rounded-full bg-brand-400 animate-bar-rise"
                                style={{ height: `${h * 100}%`, animationDelay: `${j * 0.2}s` }} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`line-clamp-2 text-sm font-semibold leading-snug ${isCurrent ? 'text-brand-400' : 'text-ink-50'}`}>{s.title}</p>
                      <p className="truncate text-xs text-ink-300 mt-0.5">{s.artist}</p>
                    </div>
                  </button>
                );
              })}
        </div>
        <div className="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-1.5">
                  <SkeletonRow />
                </div>
              ))
            : quickPicks.map(s => {
                const isCurrent = current?.id === s.id;
                const isThisPlaying = isCurrent && isPlaying;
                return (
                  <button key={s.id} onClick={() => play(s, quickPicks)}
                    className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-white/5
                      bg-white/[0.03] pr-3 text-left backdrop-blur-xl transition-all hover:bg-white/[0.06]">
                    <div className="relative h-16 w-16 shrink-0">
                      <Artwork title={s.title} hue={s.hue} hue2={s.hue2} imageUrl={s.imageUrl}
                        className="h-full w-full" rounded="rounded-none" />
                      {isThisPlaying && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <div className="flex items-end gap-[2px] h-4">
                            {[0.6, 1, 0.4].map((h, j) => (
                              <span key={j} className="w-[2px] rounded-full bg-brand-400 animate-bar-rise"
                                style={{ height: `${h * 100}%`, animationDelay: `${j * 0.2}s` }} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 py-2">
                      <p className={`line-clamp-2 text-sm font-semibold leading-snug ${isCurrent ? 'text-brand-400' : 'text-ink-50'}`}>{s.title}</p>
                      <p className="truncate text-xs text-ink-300 mt-0.5">{s.artist}</p>
                    </div>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 grid h-9 w-9 translate-x-8 place-items-center rounded-full
                      bg-brand-400 text-ink-950 opacity-0 shadow-glow transition-all duration-300
                      group-hover:translate-x-0 group-hover:opacity-100">
                      <Play size={14} className="fill-ink-950 translate-x-[1px]" />
                    </span>
                  </button>
                );
              })}
        </div>
      </section>

      {/* ── Recently played — SQUARE CARDS ── */}
      <section>
        <div className="mb-3 flex items-center gap-2 sm:mb-4">
          <Clock size={16} className="text-ink-400" />
          <h2 className="font-display text-lg font-bold text-ink-50 sm:text-xl">Recently played</h2>
        </div>
        {recentSongs.length === 0 ? (
          <p className="text-sm text-ink-400">Nothing yet — play a song and it'll show up here.</p>
        ) : (
          <div className="no-scrollbar snap-rail flex gap-3 overflow-x-auto pb-2 sm:gap-4">
            {recentSongs.map(s => {
              const isCurrent = current?.id === s.id;
              const isThisPlaying = isCurrent && isPlaying;
              return (
                <button
                  key={s.id}
                  onClick={() => play(s, recentSongs)}
                  className="snap-card group w-32 shrink-0 text-left sm:w-36 lg:w-40"
                >
                  {/* Square artwork */}
                  <div className="relative aspect-square w-full overflow-hidden rounded-2xl">
                    <Artwork title={s.title} hue={s.hue} hue2={s.hue2} imageUrl={s.imageUrl}
                      className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                      rounded="rounded-2xl" />
                    {/* play overlay */}
                    <div className={`absolute inset-0 flex items-center justify-center rounded-2xl transition-all duration-200
                      ${isThisPlaying ? 'bg-black/40' : 'bg-black/0 group-hover:bg-black/35'}`}>
                      {isThisPlaying
                        ? (
                          <div className="flex items-end gap-[3px] h-5">
                            {[0.6, 1, 0.4, 0.8].map((h, j) => (
                              <span key={j} className="w-[2.5px] rounded-full bg-brand-400 animate-bar-rise"
                                style={{ height: `${h * 100}%`, animationDelay: `${j * 0.15}s` }} />
                            ))}
                          </div>
                        ) : (
                          <span className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink-950
                            opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 scale-75 group-hover:scale-100">
                            <Play size={16} className="fill-ink-950 translate-x-[1px]" />
                          </span>
                        )}
                    </div>
                  </div>
                  {/* text below */}
                  <div className="mt-2.5 px-0.5">
                    <p className={`line-clamp-2 text-xs font-semibold leading-snug sm:text-sm ${isCurrent ? 'text-brand-400' : 'text-ink-50'}`}>
                      {s.title}
                    </p>
                    <p className="truncate text-[10px] text-ink-300 mt-0.5 sm:text-xs">{s.artist}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Trending now ── */}
      <section>
        <div className="mb-3 flex items-center gap-2 sm:mb-4">
          <Flame size={16} className="text-ink-400" />
          <h2 className="font-display text-lg font-bold text-ink-50 sm:text-xl">Trending now</h2>
        </div>
        <div className="no-scrollbar snap-rail flex gap-2.5 overflow-x-auto pb-2 sm:gap-3">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-64 shrink-0 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 sm:w-72 lg:w-80">
                  <SkeletonRow />
                </div>
              ))
            : trending.map(s => (
                <div key={s.id} className="snap-card w-64 shrink-0 sm:w-72 lg:w-80">
                  <SongRowCard song={s} onPlay={() => play(s, trending)}
                    isCurrent={current?.id === s.id} isPlaying={isPlaying && current?.id === s.id} />
                </div>
              ))}
        </div>
      </section>

      {/* ── New releases — each card shows that song's own image ── */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-ink-50 sm:mb-4 sm:text-xl">New releases</h2>
        <div className="no-scrollbar snap-rail flex gap-3 overflow-x-auto pb-2 sm:gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonAlbum key={i} />)
            : releases.map(s => {
                const isCurrent = current?.id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => play(s, releases)}
                    className="snap-card group relative flex w-36 shrink-0 flex-col gap-3 rounded-2xl
                      border border-white/5 bg-white/[0.03] p-3 text-left backdrop-blur-xl
                      transition-all duration-300 hover:bg-white/[0.06] sm:w-40 lg:w-44"
                  >
                    <div className="relative">
                      {/* Song's own image — imageUrl is unique per song from JioSaavn */}
                      <Artwork
                        title={s.title} hue={s.hue} hue2={s.hue2} imageUrl={s.imageUrl}
                        className="w-full aspect-square shadow-lg" rounded="rounded-xl"
                      />
                      <span className="absolute bottom-2 right-2 grid h-8 w-8 translate-y-2 place-items-center
                        rounded-full bg-brand-400 text-ink-950 opacity-0 shadow-glow transition-all duration-300
                        group-hover:translate-y-0 group-hover:opacity-100 sm:h-9 sm:w-9">
                        <Play size={13} className="fill-ink-950 translate-x-[1px]" />
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className={`line-clamp-2 text-xs font-semibold leading-snug sm:text-sm ${isCurrent ? 'text-brand-400' : 'text-ink-50'}`}>
                        {s.title}
                      </p>
                      <p className="truncate text-[10px] text-ink-300 sm:text-xs mt-0.5">{s.artist}</p>
                    </div>
                  </button>
                );
              })}
        </div>
      </section>

      {/* ── Made For You — mood based playlists ── */}
      <section>
        <div className="mb-3 flex items-center gap-2 sm:mb-4">
          <Sparkles size={16} className="text-ink-400" />
          <h2 className="font-display text-lg font-bold text-ink-50 sm:text-xl">Made for you</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {MOODS.map(mood => (
            <button
              key={mood.label}
              onClick={() => playMood(mood)}
              className="group relative h-20 overflow-hidden rounded-2xl p-4 text-left
                transition-transform hover:scale-[1.02] active:scale-[0.98] sm:h-24"
              style={{ background: `linear-gradient(135deg, hsl(${mood.hue} 55% 28%), hsl(${mood.hue2} 50% 18%))` }}
            >
              {/* subtle grain */}
              <div className="pointer-events-none absolute inset-0 opacity-10 mix-blend-overlay"
                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '3px 3px' }} />
              <span className="relative text-lg sm:text-xl">{mood.icon}</span>
              <p className="relative mt-1 line-clamp-2 text-xs font-bold leading-snug text-white drop-shadow sm:text-sm">
                {mood.label}
              </p>
              <Play size={14} className="absolute bottom-3 right-3 fill-white text-white opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </section>

      {/* ── Made for you songs rail ── */}
      {!loading && madeForYou.length > 0 && (
        <section>
          <div className="no-scrollbar snap-rail flex gap-3 overflow-x-auto pb-2 sm:gap-4">
            {madeForYou.map(s => (
              <div key={s.id} className="snap-card w-32 shrink-0 sm:w-36 lg:w-40">
                <button
                  onClick={() => play(s, madeForYou)}
                  className="group w-full text-left"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-2xl">
                    <Artwork title={s.title} hue={s.hue} hue2={s.hue2} imageUrl={s.imageUrl}
                      className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                      rounded="rounded-2xl" />
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/0 group-hover:bg-black/35 transition-all duration-200">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink-950
                        opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 scale-75 group-hover:scale-100">
                        <Play size={16} className="fill-ink-950 translate-x-[1px]" />
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 px-0.5">
                    <p className={`line-clamp-2 text-xs font-semibold leading-snug sm:text-sm ${current?.id === s.id ? 'text-brand-400' : 'text-ink-50'}`}>
                      {s.title}
                    </p>
                    <p className="truncate text-[10px] text-ink-300 mt-0.5 sm:text-xs">{s.artist}</p>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Artist spotlight ── */}
      {!loading && spotlight && (
        <section
          className="relative overflow-hidden rounded-2xl border border-white/5 p-5 sm:rounded-3xl sm:p-6 lg:p-8"
          style={{ background: `linear-gradient(135deg, hsl(${spotlight.hue} 55% 20%), hsl(${spotlight.hue2} 45% 12%))` }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '4px 4px' }} />
          <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <Artwork title={spotlight.title} hue={spotlight.hue} hue2={spotlight.hue2} imageUrl={spotlight.imageUrl}
              className="h-24 w-24 shrink-0 shadow-2xl sm:h-28 sm:w-28 lg:h-32 lg:w-32" rounded="rounded-2xl" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">Artist spotlight</p>
              <h2 className="mt-1 font-display text-xl font-bold text-ink-50 sm:text-2xl lg:text-3xl">{spotlight.artist}</h2>
              <p className="mt-1 max-w-md text-xs text-ink-200 sm:text-sm line-clamp-2">
                "{spotlight.title}" — from {spotlight.album} ({spotlight.year})
              </p>
              <button
                onClick={() => play(spotlight, [spotlight, ...trending])}
                className="mt-3 flex items-center gap-2 rounded-full bg-brand-400 px-4 py-2 text-sm font-semibold
                  text-ink-950 shadow-glow transition-transform hover:scale-105 active:scale-95 sm:mt-4 sm:px-5 sm:py-2.5"
              >
                <Play size={16} className="fill-ink-950 translate-x-[1px]" /> Play
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
