import {
  Heart, Maximize2, Pause, Play,
  Repeat, Repeat1, Shuffle, SkipBack, SkipForward,
} from 'lucide-react';
import { memo } from 'react';
import { usePlayer, usePlayback } from '../player';
import { useNav } from '../nav';
import { useLikes } from '../likes';
import { Artwork } from './Artwork';

export const PlayerBar = memo(function PlayerBar() {
  const {
    current, isPlaying, repeat, shuffle,
    togglePlay, next, prev, cycleRepeat, toggleShuffle, seek,
  } = usePlayer();
  const { position, duration } = usePlayback();
  const { navigate } = useNav();
  const { isLiked, toggle: toggleLike } = useLikes();

  const songLiked = current ? isLiked(current.id) : false;
  const repeatActive = repeat !== 'off';

  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    seek(ratio * duration);
  };

  return (
    <div className="relative z-30 px-2 pb-1 pt-0 sm:px-3 sm:pb-2 lg:px-4 lg:pb-3">
      {/* Slim progress bar — tap to seek */}
      {current && duration > 0 && (
        <div
          onClick={handleSeek}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.floor(duration)}
          aria-valuenow={Math.floor(position)}
          tabIndex={0}
          className="group relative mx-1 mb-1 h-3 cursor-pointer sm:mx-2"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') seek(Math.min(duration, position + 5));
            else if (e.key === 'ArrowLeft') seek(Math.max(0, position - 5));
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-brand-400"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
            style={{ left: `${progress}%` }}
          />
        </div>
      )}

      {/* Ambient glow */}
      {current && isPlaying && (
        <div className="pointer-events-none absolute inset-x-4 -top-px h-px">
          <div
            className="mx-auto h-full w-1/2 opacity-60 blur-[3px] animate-float-glow"
            style={{ background: `linear-gradient(90deg, transparent, hsl(${current.hue} 80% 55%), transparent)` }}
          />
        </div>
      )}

      <div className="glass-strong relative flex items-center gap-2 rounded-xl px-2 py-1.5
        sm:gap-3 sm:rounded-2xl sm:px-3 sm:py-2
        lg:px-4">

        {/* Left: artwork + info */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {current ? (
            <>
              {/* Artwork tap — 44×44 min touch target */}
              <button
                onClick={() => navigate({ name: 'nowplaying' })}
                aria-label="Open now playing"
                className="group relative shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Artwork
                  title={current.title}
                  hue={current.hue}
                  hue2={current.hue2}
                  imageUrl={current.imageUrl}
                  className="h-10 w-10 sm:h-11 sm:w-11 lg:h-12 lg:w-12"
                  rounded="rounded-lg"
                />
                <div className="absolute inset-0 grid place-items-center rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Maximize2 size={12} className="text-white" />
                </div>
              </button>
              <button
                onClick={() => navigate({ name: 'nowplaying' })}
                aria-label="Open now playing"
                className="min-w-0 flex-1 text-left"
              >
                <p className="line-clamp-2 text-xs font-semibold leading-snug text-ink-50 sm:text-sm">
                  {current.title}
                </p>
                <p className="mt-0.5 line-clamp-1 break-words text-[10px] leading-tight text-ink-300 sm:text-xs">{current.artist}</p>
              </button>
              <button
                onClick={() => current && toggleLike(current)}
                aria-label={songLiked ? 'Unlike' : 'Like'}
                className={`ml-1 hidden shrink-0 rounded-full p-1.5 transition-colors md:block
                  ${songLiked ? 'text-accent-400' : 'text-ink-300 hover:text-ink-50'}`}
              >
                <Heart size={15} className={songLiked ? 'fill-accent-400' : ''} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-ink-300 sm:gap-3">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-ink-800 sm:h-11 sm:w-11" />
              <div>
                <p className="text-xs font-medium text-ink-200 sm:text-sm">Nothing playing</p>
                <p className="text-[10px] sm:text-xs">Pick a song</p>
              </div>
            </div>
          )}
        </div>

        {/* Center: transport controls */}
        <div className="flex items-center gap-0 sm:gap-1">
          {/* Shuffle — hidden on mobile */}
          <button
            onClick={toggleShuffle}
            aria-label="Shuffle"
            className={`hidden rounded-full p-2 transition-colors sm:block
              ${shuffle ? 'text-brand-400' : 'text-ink-300 hover:text-ink-50'}`}
          >
            <Shuffle size={15} />
          </button>

          {/* Previous — 44×44 touch target */}
          <button
            onClick={prev}
            aria-label="Previous"
            className="grid h-11 w-11 place-items-center rounded-full text-ink-100 transition-colors hover:text-ink-50 active:scale-95"
          >
            <SkipBack size={18} className="fill-current sm:hidden" />
            <SkipBack size={20} className="fill-current hidden sm:block" />
          </button>

          {/* Play / Pause — 44×44 on mobile, 40×40 on sm+ (already larger) */}
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="grid h-11 w-11 place-items-center rounded-full bg-ink-50 text-ink-950
              transition-transform hover:scale-105 active:scale-95 sm:h-9 sm:w-9"
          >
            {isPlaying
              ? <Pause size={17} className="fill-ink-950" />
              : <Play size={17} className="fill-ink-950 translate-x-[1px]" />}
          </button>

          {/* Next — 44×44 touch target */}
          <button
            onClick={next}
            aria-label="Next"
            className="grid h-11 w-11 place-items-center rounded-full text-ink-100 transition-colors hover:text-ink-50 active:scale-95"
          >
            <SkipForward size={18} className="fill-current sm:hidden" />
            <SkipForward size={20} className="fill-current hidden sm:block" />
          </button>

          {/* Repeat — hidden on mobile */}
          <button
            onClick={cycleRepeat}
            aria-label="Repeat"
            className={`hidden rounded-full p-2 transition-colors sm:block
              ${repeatActive ? 'text-brand-400' : 'text-ink-300 hover:text-ink-50'}`}
          >
            {repeat === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
          </button>
        </div>

        {/* Right spacer (desktop) */}
        <div className="hidden flex-1 lg:block" />
      </div>
    </div>
  );
});
