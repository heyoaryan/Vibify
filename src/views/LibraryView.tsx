import { Heart, Play, Pause, Music2 } from 'lucide-react';
import { memo } from 'react';
import { useLikes } from '../likes';
import { usePlayer } from '../player';
import { Artwork } from '../components/Artwork';
import { formatTime } from '../lib';

export const LibraryView = memo(function LibraryView() {
  const { likedSongs, toggle: toggleLike } = useLikes();
  const { playSongs, current, isPlaying, togglePlay, jumpToQueueItem, queue } = usePlayer();

  const isLikedQueueActive = current != null && likedSongs.some(s => s.id === current.id);

  const handlePlayAll = () => {
    if (!likedSongs.length) return;
    if (isLikedQueueActive) togglePlay();
    else playSongs(likedSongs, likedSongs[0].id);
  };

  const handlePlaySong = (songId: string) => {
    const inQueue = queue.findIndex(s => s.id === songId) !== -1;
    if (isLikedQueueActive && inQueue) jumpToQueueItem(songId);
    else playSongs(likedSongs, songId);
  };

  const hue1 = likedSongs.length ? likedSongs[0].hue  : 330;
  const hue2 = likedSongs.length ? likedSongs[0].hue2 : 280;

  return (
    <div className="animate-fade-in pb-12">

      {/* ── Hero header — full-bleed gradient ── */}
      <div
        className="relative px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-5 lg:px-8"
        style={{ background: `linear-gradient(180deg, hsl(${hue1} 55% 22%) 0%, transparent 100%)` }}
      >
        <div className="flex items-end gap-4 sm:gap-6">
          {/* Cover art */}
          <div
            className="h-28 w-28 shrink-0 rounded-2xl shadow-2xl sm:h-36 sm:w-36 lg:h-40 lg:w-40"
            style={{ background: `linear-gradient(135deg, hsl(${hue1} 70% 50%), hsl(${hue2} 65% 32%))` }}
          >
            <div className="flex h-full w-full items-center justify-center">
              <Heart
                size={42}
                className={likedSongs.length ? 'fill-white text-white drop-shadow-lg' : 'text-white/40'}
              />
            </div>
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 sm:text-xs">
              Playlist
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
              Liked Songs
            </h1>
            <p className="mt-1 text-xs text-white/50 sm:text-sm">
              {likedSongs.length === 0
                ? 'No songs yet'
                : `${likedSongs.length} song${likedSongs.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>

        {/* Play all button */}
        {likedSongs.length > 0 && (
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handlePlayAll}
              className="flex h-12 w-12 items-center justify-center rounded-full
                bg-brand-400 text-ink-950 shadow-glow transition-all
                hover:scale-105 active:scale-95"
            >
              {isLikedQueueActive && isPlaying
                ? <Pause size={20} className="fill-ink-950" />
                : <Play  size={20} className="fill-ink-950 translate-x-[1px]" />}
            </button>
            <span className="text-sm font-semibold text-ink-200">
              {isLikedQueueActive && isPlaying ? 'Pause' : 'Play all'}
            </span>
          </div>
        )}
      </div>

      {/* ── Song list / empty state ── */}
      <div className="px-2 sm:px-4 lg:px-6">
        {likedSongs.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/5 bg-white/[0.03] text-ink-500">
              <Music2 size={28} />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-200">Nothing here yet</p>
              <p className="mt-1 text-xs text-ink-400">
                Tap the <Heart size={11} className="inline-block align-middle" /> on any song to save it here.
              </p>
            </div>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {likedSongs.map((song, i) => {
              const isCurrent = current?.id === song.id;
              const playing   = isCurrent && isPlaying;

              return (
                <li key={song.id}>
                  <div className={`group flex items-center gap-3 rounded-xl px-2 py-2
                    transition-colors hover:bg-white/5 ${isCurrent ? 'bg-brand-500/10' : ''}`}>

                    {/* Index / eq bars */}
                    <div className="w-7 shrink-0 text-center">
                      {playing ? (
                        <span className="flex items-end justify-center gap-[2px] h-4">
                          {[0.6, 1, 0.4].map((h, idx) => (
                            <span key={idx} className="w-[2px] rounded-full bg-brand-400 animate-bar-rise"
                              style={{ height: `${h * 100}%`, animationDelay: `${idx * 0.15}s` }} />
                          ))}
                        </span>
                      ) : (
                        <span className={`text-xs tabular-nums ${isCurrent ? 'text-brand-400' : 'text-ink-400'}`}>
                          {i + 1}
                        </span>
                      )}
                    </div>

                    {/* Artwork */}
                    <button onClick={() => handlePlaySong(song.id)} aria-label={`Play ${song.title}`}
                      className="relative shrink-0">
                      <Artwork title={song.title} hue={song.hue} hue2={song.hue2}
                        imageUrl={song.imageUrl} className="h-11 w-11" rounded="rounded-lg" />
                      <div className="absolute inset-0 grid place-items-center rounded-lg
                        bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        <Play size={14} className="fill-white text-white" />
                      </div>
                    </button>

                    {/* Title + artist */}
                    <button onClick={() => handlePlaySong(song.id)} className="min-w-0 flex-1 text-left">
                      <p className={`line-clamp-2 break-words text-sm font-medium leading-snug
                        ${isCurrent ? 'text-brand-400' : 'text-ink-50'}`}>
                        {song.title}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-ink-400">
                        {song.artist} · {song.album}
                      </p>
                    </button>

                    {/* Duration */}
                    <span className="hidden shrink-0 text-xs tabular-nums text-ink-400 sm:block">
                      {formatTime(song.duration)}
                    </span>

                    {/* Unlike */}
                    <button onClick={() => toggleLike(song)} aria-label="Unlike"
                      className="shrink-0 rounded-full p-1.5 text-accent-400 transition-colors hover:bg-white/10">
                      <Heart size={15} className="fill-accent-400" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
});
