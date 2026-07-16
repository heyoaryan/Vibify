import { Heart, Play, Pause, Music2 } from 'lucide-react';
import { memo } from 'react';
import { useLikes } from '../likes';
import { usePlayer } from '../player';
import { Artwork } from '../components/Artwork';
import { formatTime } from '../lib';

export const LibraryView = memo(function LibraryView() {
  const { likedSongs, toggle: toggleLike } = useLikes();
  const { playSongs, current, isPlaying, togglePlay, jumpToQueueItem, queue } = usePlayer();

  const isLikedQueueActive =
    current != null && likedSongs.some(s => s.id === current.id);

  const handlePlayAll = () => {
    if (!likedSongs.length) return;
    if (isLikedQueueActive) {
      togglePlay();
    } else {
      playSongs(likedSongs, likedSongs[0].id);
    }
  };

  const handlePlaySong = (songId: string) => {
    // If this song is already in queue from liked songs context, just jump
    const inQueue = queue.findIndex(s => s.id === songId) !== -1;
    if (isLikedQueueActive && inQueue) {
      jumpToQueueItem(songId);
    } else {
      playSongs(likedSongs, songId);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col pb-32 pt-20 lg:pt-24">

      {/* ── Header ── */}
      <div className="px-4 lg:px-8">
        <div className="flex items-end gap-5">
          {/* Liked Songs cover art */}
          <div
            className="h-28 w-28 shrink-0 rounded-2xl shadow-2xl sm:h-36 sm:w-36"
            style={{
              background: likedSongs.length
                ? `linear-gradient(135deg, hsl(${likedSongs[0].hue} 70% 45%), hsl(${likedSongs[0].hue2} 65% 30%))`
                : 'linear-gradient(135deg, hsl(330 70% 45%), hsl(280 65% 30%))',
            }}
          >
            <div className="flex h-full w-full items-center justify-center">
              <Heart
                size={40}
                className={likedSongs.length ? 'fill-white text-white' : 'text-white/60'}
              />
            </div>
          </div>

          <div className="min-w-0 flex-1 pb-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">Playlist</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-ink-50 sm:text-3xl">
              Liked Songs
            </h1>
            <p className="mt-1 text-sm text-ink-300">
              {likedSongs.length === 0
                ? 'No liked songs yet'
                : `${likedSongs.length} song${likedSongs.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>

        {/* Play button */}
        {likedSongs.length > 0 && (
          <div className="mt-5">
            <button
              onClick={handlePlayAll}
              className="flex h-12 items-center gap-2 rounded-full bg-brand-400 px-6 text-sm
                font-semibold text-ink-950 shadow-glow transition-transform
                hover:scale-105 active:scale-95"
            >
              {isLikedQueueActive && isPlaying
                ? <Pause size={18} className="fill-ink-950" />
                : <Play  size={18} className="fill-ink-950 translate-x-[1px]" />}
              {isLikedQueueActive && isPlaying ? 'Pause' : 'Play all'}
            </button>
          </div>
        )}
      </div>

      {/* ── Song list ── */}
      <div className="mt-6 px-2 lg:px-6">
        {likedSongs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/5
              bg-white/[0.03] text-ink-400">
              <Music2 size={28} />
            </div>
            <p className="text-sm text-ink-300">
              Tap the <Heart size={13} className="inline-block align-middle" /> on any song to save it here.
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {likedSongs.map((song, i) => {
              const isCurrent = current?.id === song.id;
              const playing   = isCurrent && isPlaying;

              return (
                <li key={song.id}>
                  <div className={`group flex items-center gap-3 rounded-xl px-2 py-2
                    transition-colors hover:bg-white/5
                    ${isCurrent ? 'bg-brand-500/10' : ''}`}
                  >
                    {/* Index / playing indicator */}
                    <div className="w-7 shrink-0 text-center">
                      {playing ? (
                        <span className="flex items-end justify-center gap-[2px] h-4">
                          {[0.6, 1, 0.4].map((h, idx) => (
                            <span
                              key={idx}
                              className="w-[2px] rounded-full bg-brand-400 animate-bar-rise"
                              style={{ height: `${h * 100}%`, animationDelay: `${idx * 0.15}s` }}
                            />
                          ))}
                        </span>
                      ) : (
                        <span className={`text-xs tabular-nums
                          ${isCurrent ? 'text-brand-400' : 'text-ink-400'}`}>
                          {i + 1}
                        </span>
                      )}
                    </div>

                    {/* Artwork */}
                    <button
                      onClick={() => handlePlaySong(song.id)}
                      className="relative shrink-0"
                      aria-label={`Play ${song.title}`}
                    >
                      <Artwork
                        title={song.title}
                        hue={song.hue}
                        hue2={song.hue2}
                        imageUrl={song.imageUrl}
                        className="h-11 w-11"
                        rounded="rounded-lg"
                      />
                      <div className="absolute inset-0 grid place-items-center rounded-lg
                        bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        <Play size={14} className="fill-white text-white" />
                      </div>
                    </button>

                    {/* Title + artist */}
                    <button
                      onClick={() => handlePlaySong(song.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className={`truncate text-sm font-medium
                        ${isCurrent ? 'text-brand-400' : 'text-ink-50'}`}>
                        {song.title}
                      </p>
                      <p className="truncate text-xs text-ink-300 mt-0.5">
                        {song.artist} · {song.album}
                      </p>
                    </button>

                    {/* Duration */}
                    <span className="shrink-0 text-xs tabular-nums text-ink-400">
                      {formatTime(song.duration)}
                    </span>

                    {/* Unlike button */}
                    <button
                      onClick={() => toggleLike(song)}
                      aria-label="Unlike"
                      className="shrink-0 rounded-full p-1.5 text-accent-400
                        transition-colors hover:bg-white/10"
                    >
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
