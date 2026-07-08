import {
  ChevronDown, Heart, ListMusic, Mic2, MoreHorizontal,
  Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward,
} from 'lucide-react';
import { useState } from 'react';

import { usePlayer } from '../player';
import { useNav } from '../nav';
import { formatTime, gradientStyle } from '../lib';
import { lyricsForSong } from '../lyrics';
import type { Song } from '../types';
import { Artwork } from '../components/Artwork';
import { SeekSlider } from '../components/Sliders';
import { Lyrics } from '../components/Lyrics';
import { Visualizer } from '../components/Visualizer';

type Panel = 'lyrics' | 'queue';

export function NowPlayingView() {
  const {
    current, isPlaying, position, duration,
    repeat, shuffle, togglePlay, next, prev,
    seek, cycleRepeat, toggleShuffle, queue, index, playSongs,
  } = usePlayer();
  const { back } = useNav();
  const [liked, setLiked] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);

  if (!current) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-ink-950 text-center">
        <p className="font-display text-lg text-ink-100">No song selected</p>
        <button onClick={back} className="rounded-full bg-ink-700 px-4 py-2 text-sm text-ink-50 hover:bg-ink-600">Go back</button>
      </div>
    );
  }

  const dur = duration || current.duration;
  const lyricsLines = lyricsForSong(current.id);
  const upNext = queue.slice(index + 1, index + 8);
  const showPanel = panel !== null;
  const togglePanel = (p: Panel) => setPanel(c => c === p ? null : p);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-ink-950">
      {/* Background */}
      <div className="absolute inset-0 scale-125">
        <div className="absolute inset-0" style={{ background: gradientStyle(current.hue, current.hue2, 160) }} />
      </div>
      <div className="absolute inset-0 backdrop-blur-md" />
      <div className="absolute inset-0 bg-black/65" />

      {/* Top bar */}
      <div className="relative z-10 flex shrink-0 items-center justify-between px-4 py-3 sm:py-4 lg:px-8 lg:py-5">
        <button onClick={back} aria-label="Close"
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition-transform hover:scale-105">
          <ChevronDown size={20} />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50 sm:text-[11px]">Playing from album</p>
          <p className="text-xs font-semibold text-white sm:text-sm">{current.album}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => togglePanel('lyrics')} aria-label="Lyrics"
            className={`grid h-9 w-9 place-items-center rounded-full backdrop-blur transition-all hover:scale-105
              ${panel === 'lyrics' ? 'bg-brand-400/30 text-brand-300' : 'bg-white/10 text-white'}`}>
            <Mic2 size={16} />
          </button>
          <button onClick={() => togglePanel('queue')} aria-label="Queue"
            className={`grid h-9 w-9 place-items-center rounded-full backdrop-blur transition-all hover:scale-105
              ${panel === 'queue' ? 'bg-brand-400/30 text-brand-300' : 'bg-white/10 text-white'}`}>
            <ListMusic size={16} />
          </button>
          <button aria-label="More"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition-transform hover:scale-105">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* Body — vertically centred between top-bar and transport */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 sm:gap-4 sm:px-8 lg:px-16">

        {/* Art slot — crossfades with lyrics/queue */}
        <div className="relative mx-auto w-full max-w-[300px] sm:max-w-[340px] lg:max-w-[380px]">
          <div className="relative aspect-square w-full">

            {/* Album art */}
            <div className={`absolute inset-0 transition-all duration-300 ease-out ${
              showPanel ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <div className="absolute -inset-3 rounded-3xl opacity-40 blur-2xl sm:-inset-4"
                style={{ background: `linear-gradient(135deg, hsl(${current.hue} 70% 45%), hsl(${current.hue2} 70% 30%))` }} />
              <div className={`relative w-full h-full overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10
                transition-transform duration-700 sm:rounded-3xl ${isPlaying ? 'scale-[1.02]' : 'scale-100'}`}>
                <Artwork title={current.title} hue={current.hue} hue2={current.hue2}
                  imageUrl={current.imageUrl} className="h-full w-full" rounded="rounded-2xl" />
                <div className="absolute inset-0 rounded-2xl ring-inset ring-1 ring-white/5 sm:rounded-3xl" />
              </div>
            </div>

            {/* Lyrics / Queue panel */}
            <div className={`absolute inset-0 overflow-hidden rounded-2xl transition-all duration-300 ease-out sm:rounded-3xl ${
              showPanel ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(14px)' }}>
              {panel === 'lyrics' && (
                <Lyrics lines={lyricsLines} position={position} onSeek={seek} onLineClick={() => setPanel(null)} songTitle={current.title} />
              )}
              {panel === 'queue' && (
                <QueueList upNext={upNext} onPlay={id => { playSongs(queue, id); setPanel(null); }} />
              )}
            </div>
          </div>
        </div>

        {/* Visualizer */}
        <div className={`h-7 w-full max-w-[300px] transition-all duration-500 sm:h-9 sm:max-w-[340px] lg:max-w-[380px] ${
          showPanel ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
          <Visualizer isPlaying={isPlaying} hue={current.hue} barCount={48} className="h-full w-full" />
        </div>

        {/* Title + like */}
        <div className="flex w-full max-w-[300px] items-start justify-between gap-3 px-0.5 sm:max-w-[340px] lg:max-w-[380px]">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold text-white break-words leading-tight sm:text-2xl">{current.title}</h1>
            <p className="mt-0.5 text-sm text-white/60 truncate">{current.artist}</p>
          </div>
          <button onClick={() => setLiked(l => !l)} aria-label={liked ? 'Unlike' : 'Like'}
            className={`shrink-0 rounded-full p-1.5 transition-colors sm:p-2 ${liked ? 'text-accent-400' : 'text-white/80 hover:text-white'}`}>
            <Heart size={22} className={liked ? 'fill-accent-400' : ''} />
          </button>
        </div>
      </div>

      {/* Transport */}
      <div className="relative z-10 shrink-0 px-4 pb-8 pt-1 sm:px-8 sm:pb-10 lg:px-16">
        <div className="mx-auto w-full max-w-xs space-y-2 sm:max-w-[340px] sm:space-y-3 lg:max-w-[380px]">
          <div>
            <SeekSlider value={position} max={dur} onSeek={seek} ariaLabel="Seek" />
            <div className="flex justify-between text-[10px] tabular-nums text-white/50 sm:text-xs">
              <span>{formatTime(position)}</span>
              <span>{formatTime(dur)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={toggleShuffle} aria-label="Shuffle"
              className={`rounded-full p-1.5 transition-colors sm:p-2 ${shuffle ? 'text-brand-400' : 'text-white/55 hover:text-white'}`}>
              <Shuffle size={18} />
            </button>
            <button onClick={prev} aria-label="Previous"
              className="rounded-full p-1.5 text-white transition-transform hover:scale-110 sm:p-2">
              <SkipBack size={24} className="fill-current sm:hidden" />
              <SkipBack size={28} className="fill-current hidden sm:block" />
            </button>
            <button onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}
              className="grid h-13 w-13 place-items-center rounded-full bg-white text-ink-950 shadow-xl
                transition-transform hover:scale-105 active:scale-95 h-12 w-12 sm:h-14 sm:w-14">
              {isPlaying
                ? <Pause size={22} className="fill-ink-950 sm:hidden" />
                : <Play size={22} className="fill-ink-950 translate-x-[1px] sm:hidden" />}
              {isPlaying
                ? <Pause size={26} className="fill-ink-950 hidden sm:block" />
                : <Play size={26} className="fill-ink-950 translate-x-[1px] hidden sm:block" />}
            </button>
            <button onClick={next} aria-label="Next"
              className="rounded-full p-1.5 text-white transition-transform hover:scale-110 sm:p-2">
              <SkipForward size={24} className="fill-current sm:hidden" />
              <SkipForward size={28} className="fill-current hidden sm:block" />
            </button>
            <button onClick={cycleRepeat} aria-label="Repeat"
              className={`rounded-full p-1.5 transition-colors sm:p-2 ${repeat !== 'off' ? 'text-brand-400' : 'text-white/55 hover:text-white'}`}>
              {(() => { const I = repeat === 'one' ? Repeat1 : Repeat; return <I size={18} />; })()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QueueList({ upNext, onPlay }: { upNext: Song[]; onPlay: (id: string) => void }) {
  if (!upNext.length)
    return <div className="flex h-full items-center justify-center text-xs text-white/45 sm:text-sm">Nothing else in the queue.</div>;
  return (
    <div className="no-scrollbar h-full overflow-y-auto py-3 px-2">
      <p className="mb-2.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/45 sm:text-xs">Next up</p>
      <div className="space-y-0.5">
        {upNext.map(s => (
          <button key={s.id} onClick={() => onPlay(s.id)}
            className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-white/10 sm:gap-3">
            <Artwork title={s.title} hue={s.hue} hue2={s.hue2} imageUrl={s.imageUrl}
              className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" rounded="rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-xs font-medium leading-snug text-white sm:text-sm">{s.title}</p>
              <p className="truncate text-[10px] text-white/45 sm:text-xs">{s.artist}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
