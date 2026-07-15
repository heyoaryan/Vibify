import { Play, Plus } from 'lucide-react';
import { memo } from 'react';

import type { Playlist, Song } from '../types';
import { usePlayer } from '../player';
import { useNav } from '../nav';
import { songsByIds } from '../lib';
import { Artwork } from './Artwork';

export const PlaylistCard = memo(function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const { playSongs, current, isPlaying, togglePlay } = usePlayer();
  const { navigate } = useNav();

  const songs = songsByIds(playlist.songIds);
  const isThisPlaying = current && playlist.songIds.includes(current.id) && isPlaying;
  const isCurrentPaused = current && playlist.songIds.includes(current.id) && !isPlaying;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isThisPlaying || isCurrentPaused) { togglePlay(); return; }
    playSongs(songs, songs[0]?.id);
  };

  return (
    <button
      onClick={() => navigate({ name: 'playlist', id: playlist.id })}
      className="group relative flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-left backdrop-blur-xl transition-all duration-300 hover:border-white/10 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60"
    >
      <div className="relative">
        <Artwork
          title={playlist.title}
          hue={playlist.hue}
          hue2={playlist.hue2}
          variant="wave"
          className="w-full aspect-square shadow-lg"
          rounded="rounded-xl"
        />
        <button
          onClick={handlePlay}
          aria-label={isThisPlaying ? 'Pause' : 'Play'}
          className="absolute bottom-2 right-2 grid h-11 w-11 translate-y-2 place-items-center rounded-full bg-brand-400 text-ink-950 opacity-0 shadow-glow transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 hover:scale-105 active:scale-95"
        >
          <Play size={18} className="fill-ink-950 translate-x-[1px]" />
        </button>
      </div>
      <div className="min-w-0">
        <h3 className="truncate font-semibold text-ink-50">{playlist.title}</h3>
        <p className="mt-0.5 line-clamp-2 text-sm text-ink-300">{playlist.description}</p>
      </div>
    </button>
  );
});

export const SongRowCard = memo(function SongRowCard({
  song,
  onPlay,
  isCurrent,
  isPlaying,
}: {
  song: Song;
  onPlay: () => void;
  isCurrent: boolean;
  isPlaying: boolean;
}) {
  return (
    <button
      onClick={onPlay}
      className="group flex items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/5"
    >
      <div className="relative h-12 w-12 shrink-0">
        <Artwork title={song.title} hue={song.hue} hue2={song.hue2} imageUrl={song.imageUrl} className="h-full w-full" rounded="rounded-lg" />
        <div className="absolute inset-0 grid place-items-center rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <Play size={16} className="fill-white text-white" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`line-clamp-2 text-sm font-medium leading-snug ${isCurrent ? 'text-brand-400' : 'text-ink-50'}`}>{song.title}</p>
        <p className="truncate text-xs text-ink-300 mt-0.5">{song.artist}</p>
      </div>
      {isCurrent && isPlaying && (
        <div className="flex items-end gap-[2px] h-4 shrink-0">
          {[0.6, 1, 0.4].map((h, i) => (
            <span key={i} className="w-[2px] rounded-full bg-brand-400 animate-bar-rise" style={{ height: `${h * 100}%`, animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      )}
    </button>
  );
});

export const PlayNextButton = memo(function PlayNextButton({ song }: { song: Song }) {
  const { playNext } = usePlayer();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); playNext(song); }}
      aria-label="Play next"
      className="grid h-8 w-8 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/10 hover:text-ink-50"
    >
      <Plus size={16} />
    </button>
  );
});
