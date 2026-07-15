import { Clock, Heart, MoreHorizontal, Pause, Play, Shuffle } from 'lucide-react';
import { memo, useState } from 'react';

import { playlistById, songsByIds, formatTime, heroGradient } from '../lib';
import { usePlayer } from '../player';
import { useNav } from '../nav';
import { Artwork } from '../components/Artwork';

export const PlaylistView = memo(function PlaylistView({ id }: { id: string }) {
  const playlist = playlistById(id);
  const { playSongs, current, isPlaying, togglePlay, toggleShuffle, shuffle } = usePlayer();
  const { navigate } = useNav();
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  if (!playlist) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="font-display text-lg text-ink-100">Playlist not found</p>
        <button
          onClick={() => navigate({ name: 'library' })}
          className="mt-3 rounded-full bg-ink-700 px-4 py-2 text-sm text-ink-50 hover:bg-ink-600"
        >
          Back to library
        </button>
      </div>
    );
  }

  const songs = songsByIds(playlist.songIds);
  const totalSec = songs.reduce((acc, s) => acc + s.duration, 0);
  const isThisActive = current && playlist.songIds.includes(current.id);
  const playingThis = isThisActive && isPlaying;

  const handleMainPlay = () => {
    if (isThisActive) { togglePlay(); return; }
    playSongs(songs, songs[0]?.id);
  };

  const handleRowPlay = (songId: string) => {
    if (current?.id === songId) { togglePlay(); return; }
    playSongs(songs, songId);
  };

  return (
    <div className="animate-fade-in pb-12">
      {/* Hero header */}
      <div
        className="relative px-4 pb-6 pt-8 lg:px-8"
        style={{ background: heroGradient(playlist.hue, playlist.hue2) }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-10 mix-blend-overlay"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '4px 4px' }}
        />
        <div className="relative flex flex-col items-center gap-6 md:flex-row md:items-end">
          <Artwork
            title={playlist.title}
            hue={playlist.hue}
            hue2={playlist.hue2}
            className="h-44 w-44 shrink-0 shadow-2xl md:h-52 md:w-52"
            rounded="rounded-2xl"
            variant="wave"
          />
          <div className="min-w-0 flex-1 text-center md:text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-200">Playlist</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white lg:text-5xl text-balance">
              {playlist.title}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-ink-100">{playlist.description}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-ink-200 md:justify-start">
              <span className="font-semibold text-ink-50">Resonance</span>
              <span>·</span>
              <span>{songs.length} songs</span>
              <span>·</span>
              <span className="tabular-nums">{Math.floor(totalSec / 60)} min</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-4 px-4 py-5 lg:px-8">
        <button
          onClick={handleMainPlay}
          aria-label={playingThis ? 'Pause' : 'Play'}
          className="grid h-14 w-14 place-items-center rounded-full bg-brand-400 text-ink-950 shadow-glow transition-transform hover:scale-105 active:scale-95"
        >
          {playingThis ? (
            <Pause size={24} className="fill-ink-950" />
          ) : (
            <Play size={24} className="fill-ink-950 translate-x-[1px]" />
          )}
        </button>
        <button
          onClick={toggleShuffle}
          aria-label="Shuffle"
          className={`rounded-full p-2 transition-colors ${shuffle ? 'text-brand-400' : 'text-ink-200 hover:text-ink-50'}`}
        >
          <Shuffle size={22} />
        </button>
        <button aria-label="Like" className="rounded-full p-2 text-ink-200 transition-colors hover:text-ink-50">
          <Heart size={22} />
        </button>
        <button aria-label="More" className="ml-auto rounded-full p-2 text-ink-200 transition-colors hover:text-ink-50">
          <MoreHorizontal size={24} />
        </button>
      </div>

      {/* Track list */}
      <div className="px-2 lg:px-6">
        <div className="hidden grid-cols-[24px_44px_1fr_auto] items-center gap-3 border-b border-ink-800 px-3 pb-2 text-xs uppercase tracking-wider text-ink-300 md:grid">
          <span className="text-center">#</span>
          <span className="hidden md:block">Title</span>
          <span className="hidden md:block" />
          <span className="flex items-center gap-1"><Clock size={14} /></span>
        </div>

        {songs.map((s, i) => {
          const isCurrent = current?.id === s.id;
          const isLiked = liked[s.id];
          return (
            <div
              key={s.id}
              onClick={() => handleRowPlay(s.id)}
              className="group grid cursor-pointer grid-cols-[24px_44px_1fr_auto] items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/5"
            >
              <span className="text-sm tabular-nums text-ink-300">
                {isCurrent && isPlaying ? (
                  <span className="flex items-end gap-[2px] h-4">
                    {[0.6, 1, 0.4].map((h, j) => (
                      <span key={j} className="w-[2px] rounded-full bg-brand-400 animate-bar-rise" style={{ height: `${h * 100}%`, animationDelay: `${j * 0.2}s` }} />
                    ))}
                  </span>
                ) : (
                  <span className="group-hover:hidden">{i + 1}</span>
                )}
                <Play size={14} className="hidden fill-brand-400 text-brand-400 group-hover:block" />
              </span>
              <Artwork title={s.title} hue={s.hue} hue2={s.hue2} imageUrl={s.imageUrl} className="h-10 w-10" rounded="rounded-md" />
              <div className="min-w-0">
                <p className={`truncate text-sm font-medium ${isCurrent ? 'text-brand-400' : 'text-ink-50'}`}>{s.title}</p>
                <p className="truncate text-xs text-ink-300">{s.artist}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); setLiked((l) => ({ ...l, [s.id]: !l[s.id] })); }}
                  className={`rounded-full p-1 transition-opacity ${isLiked ? 'text-accent-400 opacity-100' : 'text-ink-300 opacity-0 group-hover:opacity-100 hover:text-ink-50'}`}
                >
                  <Heart size={16} className={isLiked ? 'fill-accent-400' : ''} />
                </button>
                <span className="text-xs tabular-nums text-ink-300">{formatTime(s.duration)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
