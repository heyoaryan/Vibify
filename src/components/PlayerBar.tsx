import {
  Heart, Maximize2, Pause, Play,
  Repeat, Repeat1, Shuffle, SkipBack, SkipForward,
} from 'lucide-react';
import { useState } from 'react';
import { usePlayer } from '../player';
import { useNav } from '../nav';
import { Artwork } from './Artwork';

export function PlayerBar() {
  const {
    current, isPlaying, repeat, shuffle,
    togglePlay, next, prev, cycleRepeat, toggleShuffle,
  } = usePlayer();
  const { navigate } = useNav();
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const isLiked = current ? liked[current.id] : false;
  const repeatActive = repeat !== 'off';

  return (
    <div className="relative z-30 px-2 pb-1 pt-0 sm:px-3 sm:pb-2 lg:px-4 lg:pb-3">
      {/* Ambient glow */}
      {current && isPlaying && (
        <div className="pointer-events-none absolute inset-x-4 -top-px h-px">
          <div
            className="mx-auto h-full w-1/2 opacity-60 blur-[3px] animate-float-glow"
            style={{ background: `linear-gradient(90deg, transparent, hsl(${current.hue} 80% 55%), transparent)` }}
          />
        </div>
      )}

      <div className="glass-strong relative flex items-center gap-2 rounded-xl px-2 py-2
        sm:gap-3 sm:rounded-2xl sm:px-3 sm:py-2.5
        lg:px-4">

        {/* Left: artwork + info */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {current ? (
            <>
              <button
                onClick={() => navigate({ name: 'nowplaying' })}
                aria-label="Open now playing"
                className="group relative shrink-0"
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
              <div className="min-w-0">
                <p className="line-clamp-2 text-xs font-semibold leading-snug text-ink-50 sm:text-sm">{current.title}</p>
                <p className="truncate text-[10px] text-ink-300 sm:text-xs">{current.artist}</p>
              </div>
              <button
                onClick={() => current && setLiked(l => ({ ...l, [current.id]: !l[current.id] }))}
                aria-label={isLiked ? 'Unlike' : 'Like'}
                className={`ml-1 hidden shrink-0 rounded-full p-1.5 transition-colors md:block
                  ${isLiked ? 'text-accent-400' : 'text-ink-300 hover:text-ink-50'}`}
              >
                <Heart size={15} className={isLiked ? 'fill-accent-400' : ''} />
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

        {/* Center: transport */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={toggleShuffle}
            aria-label="Shuffle"
            className={`hidden rounded-full p-1 transition-colors sm:block
              ${shuffle ? 'text-brand-400' : 'text-ink-300 hover:text-ink-50'}`}
          >
            <Shuffle size={15} />
          </button>
          <button onClick={prev} aria-label="Previous"
            className="rounded-full p-1 text-ink-100 transition-colors hover:text-ink-50 sm:p-1.5">
            <SkipBack size={18} className="fill-current sm:hidden" />
            <SkipBack size={20} className="fill-current hidden sm:block" />
          </button>
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="grid h-8 w-8 place-items-center rounded-full bg-ink-50 text-ink-950
              transition-transform hover:scale-105 active:scale-95 sm:h-9 sm:w-9"
          >
            {isPlaying
              ? <Pause size={15} className="fill-ink-950 sm:hidden" />
              : <Play size={15} className="fill-ink-950 translate-x-[1px] sm:hidden" />}
            {isPlaying
              ? <Pause size={17} className="fill-ink-950 hidden sm:block" />
              : <Play size={17} className="fill-ink-950 translate-x-[1px] hidden sm:block" />}
          </button>
          <button onClick={next} aria-label="Next"
            className="rounded-full p-1 text-ink-100 transition-colors hover:text-ink-50 sm:p-1.5">
            <SkipForward size={18} className="fill-current sm:hidden" />
            <SkipForward size={20} className="fill-current hidden sm:block" />
          </button>
          <button
            onClick={cycleRepeat}
            aria-label="Repeat"
            className={`hidden rounded-full p-1 transition-colors sm:block
              ${repeatActive ? 'text-brand-400' : 'text-ink-300 hover:text-ink-50'}`}
          >
            {(() => { const I = repeat === 'one' ? Repeat1 : Repeat; return <I size={15} />; })()}
          </button>
        </div>

        {/* Right spacer (desktop) */}
        <div className="hidden flex-1 lg:block" />
      </div>
    </div>
  );
}
