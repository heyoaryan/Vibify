import {
  ChevronDown, Heart, ListMusic, Mic2, MoreHorizontal,
  Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward,
  Share2, ListPlus, User, Info, X, Check, ChevronRight,
} from 'lucide-react';
import { useState, useEffect, memo } from 'react';

// ─── Shimmer keyframes — injected once ───────────────────────────────────────
const NP_KEYFRAMES = `
  @keyframes npShineR2L {
    0%   { transform: translateX(80%);  opacity: 0; }
    8%   { opacity: 1; }
    92%  { opacity: 1; }
    100% { transform: translateX(-80%); opacity: 0; }
  }
  @keyframes npShineL2R {
    0%   { transform: translateX(-80%); opacity: 0; }
    8%   { opacity: 1; }
    92%  { opacity: 1; }
    100% { transform: translateX(80%);  opacity: 0; }
  }
`;
let _npInjected = false;
function injectNPStyles() {
  if (_npInjected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = NP_KEYFRAMES;
  document.head.appendChild(s);
  _npInjected = true;
}

import { usePlayer, usePlayback } from '../player';
import { useNav } from '../nav';
import { formatTime, gradientStyle } from '../lib';
import { useLyrics } from '../useLyrics';
import type { Song } from '../types';
import { Artwork } from '../components/Artwork';
import { SeekSlider } from '../components/Sliders';
import { Lyrics } from '../components/Lyrics';
import { Visualizer } from '../components/Visualizer';
import { useLikes } from '../likes';

// ─────────────────────────────────────────────────────────────────────────────
// Shared backdrop + portal wrapper
// ─────────────────────────────────────────────────────────────────────────────
function Overlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Lock body scroll while overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape key
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop — click to dismiss */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Sheet  (3-dot menu)
// ─────────────────────────────────────────────────────────────────────────────
function ActionSheet({ song, onClose }: { song: Song; onClose: () => void }) {
  const { playNext } = usePlayer();
  const { navigate } = useNav();
  const [copied, setCopied] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const handleShare = async () => {
    const text = `${song.title} — ${song.artist}`;
    if (navigator.share) {
      try { await navigator.share({ title: song.title, text, url: window.location.href }); }
      catch { /* cancelled */ }
      onClose();
    } else {
      try { await navigator.clipboard.writeText(text); } catch { /* denied */ }
      setCopied(true);
      setTimeout(() => { setCopied(false); onClose(); }, 1400);
    }
  };

  const handlePlayNext = () => { playNext(song); onClose(); };

  const handleGoToArtist = () => {
    onClose();
    navigate({ name: 'search' });
    // Wait for SearchView to mount and register its event listener
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('vibify-search', { detail: song.artist }));
    }, 180);
  };

  return (
    <Overlay onClose={onClose}>
      {/*
        Exact same container as QueueDrawer:
        Mobile  → slides up from bottom, full-width, 80dvh height, rounded top corners
        Desktop → centered modal card, 70dvh height, max-w-md, all rounded corners
      */}
      <div
        className={[
          'relative z-10 flex w-full flex-col overflow-hidden',
          // mobile — content-driven height, cap at 85dvh so it never overflows screen
          'max-h-[85dvh] rounded-t-3xl',
          // desktop — same content-driven, centered card
          'sm:mb-6 sm:max-w-md sm:rounded-3xl',
          // same animations as queue
          'animate-sheet-up sm:animate-sheet-in',
          // same glass bg
          'border border-white/10 bg-ink-900/96 shadow-2xl backdrop-blur-2xl',
        ].join(' ')}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pb-1 pt-3 sm:hidden">
          <div className="h-[5px] w-12 rounded-full bg-white/20" />
        </div>

        {/* Header — same pattern as queue drawer */}
        <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] px-5 py-3.5">
          <Artwork
            title={song.title} hue={song.hue} hue2={song.hue2} imageUrl={song.imageUrl}
            className="h-12 w-12 shrink-0" rounded="rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-bold text-white">{song.title}</p>
            <p className="truncate text-xs text-white/40">{song.artist} · {song.album}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white/60
              transition-colors hover:bg-white/20 hover:text-white"
          >
            <X size={17} />
          </button>
        </div>

        {/* Scrollable actions list */}
        <div
          className="no-scrollbar overflow-y-auto py-2"
          style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' }}
        >
          <ul>
            {/* Share */}
            <ActionRow
              icon={copied ? Check : Share2}
              iconBg="hsl(200 60% 36%)"
              label={copied ? 'Copied!' : ((navigator as Navigator & { share?: () => void }).share ? 'Share song' : 'Copy song info')}
              onClick={handleShare}
              active={copied}
            />
            {/* Play next */}
            <ActionRow
              icon={ListPlus}
              iconBg="hsl(260 55% 38%)"
              label="Play next"
              onClick={handlePlayNext}
            />
            {/* Go to artist */}
            <ActionRow
              icon={User}
              iconBg="hsl(170 50% 32%)"
              label={`Go to artist · ${song.artist}`}
              onClick={handleGoToArtist}
              suffix={<ChevronRight size={15} className="text-white/30" />}
            />
            {/* Song info — toggle */}
            <ActionRow
              icon={Info}
              iconBg="hsl(30 55% 34%)"
              label="Song info"
              onClick={() => setShowInfo(v => !v)}
              suffix={
                <ChevronRight
                  size={15}
                  className={`text-white/30 transition-transform duration-200 ${showInfo ? 'rotate-90' : ''}`}
                />
              }
            />

            {/* Expandable song info panel */}
            {showInfo && (
              <li className="mx-4 mb-1 mt-0.5 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03]">
                {(
                  [
                    ['Title',    song.title],
                    ['Artist',   song.artist],
                    ['Album',    song.album],
                    ['Year',     String(song.year)],
                    ['Genre',    song.genre],
                    ['Duration', formatTime(song.duration)],
                  ] as [string, string][]
                ).map(([label, value], i, arr) => (
                  <div
                    key={label}
                    className={`flex items-center justify-between gap-4 px-4 py-2.5 text-xs
                      ${i < arr.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
                  >
                    <span className="shrink-0 text-white/40">{label}</span>
                    <span className="truncate text-right font-medium text-white/80">{value}</span>
                  </div>
                ))}
              </li>
            )}
          </ul>
        </div>
      </div>
    </Overlay>
  );
}

function ActionRow({
  icon: Icon,
  iconBg,
  label,
  onClick,
  suffix,
  active = false,
}: {
  icon: React.ElementType;
  iconBg: string;
  label: string;
  onClick: () => void;
  suffix?: React.ReactNode;
  active?: boolean;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors
          hover:bg-white/[0.05] active:bg-white/10 ${active ? 'text-brand-400' : 'text-white'}`}
      >
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          style={{ background: iconBg }}
        >
          <Icon size={17} className="text-white" />
        </div>
        <span className="flex-1 text-sm font-medium">{label}</span>
        {suffix}
      </button>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue Drawer  (full list of upcoming songs)
// ─────────────────────────────────────────────────────────────────────────────
function QueueDrawer({
  queue,
  currentIndex,
  onPlay,
  onClose,
}: {
  queue: Song[];
  currentIndex: number;
  onPlay: (id: string) => void;
  onClose: () => void;
}) {
  const nowPlaying = queue[currentIndex];
  const upNext     = queue.slice(currentIndex + 1);
  const played     = queue.slice(0, currentIndex);

  return (
    <Overlay onClose={onClose}>
      <div
        className={[
          'relative z-10 flex w-full flex-col overflow-hidden',
          // mobile: 80% of screen height, slide up from bottom
          'h-[80dvh] rounded-t-3xl',
          // desktop: centered modal, fixed size
          'sm:mb-6 sm:h-[70dvh] sm:max-w-md sm:rounded-3xl',
          'animate-sheet-up sm:animate-sheet-in',
          'border border-white/10 bg-ink-900/96 shadow-2xl backdrop-blur-2xl',
        ].join(' ')}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-1 pt-3 sm:hidden">
          <div className="h-[5px] w-12 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
          <div>
            <p className="font-display text-base font-bold text-white">Queue</p>
            <p className="text-xs text-white/40">{upNext.length} songs up next</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close queue"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/60
              transition-colors hover:bg-white/20 hover:text-white"
          >
            <X size={17} />
          </button>
        </div>

        {/* Scrollable list */}
        <div className="no-scrollbar flex-1 overflow-y-auto">

          {/* Now playing */}
          {nowPlaying && (
            <section className="px-4 pt-4 pb-2">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-brand-400/80">
                Now playing
              </p>
              <QueueRow
                song={nowPlaying}
                isCurrent
                onPlay={() => { onPlay(nowPlaying.id); onClose(); }}
              />
            </section>
          )}

          {/* Up next */}
          {upNext.length > 0 && (
            <section className="px-4 pb-2">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                Up next
              </p>
              <div className="space-y-0.5">
                {upNext.map(s => (
                  <QueueRow
                    key={s.id}
                    song={s}
                    onPlay={() => { onPlay(s.id); onClose(); }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Previously played */}
          {played.length > 0 && (
            <section className="px-4 pb-6">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/20">
                Previously played
              </p>
              <div className="space-y-0.5 opacity-50">
                {[...played].reverse().map(s => (
                  <QueueRow
                    key={s.id}
                    song={s}
                    onPlay={() => { onPlay(s.id); onClose(); }}
                  />
                ))}
              </div>
            </section>
          )}

          {queue.length === 0 && (
            <div className="flex h-40 items-center justify-center text-sm text-white/30">
              Queue is empty
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

function QueueRow({
  song,
  isCurrent = false,
  onPlay,
}: {
  song: Song;
  isCurrent?: boolean;
  onPlay: () => void;
}) {
  return (
    <button
      onClick={onPlay}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left
        transition-colors hover:bg-white/[0.07] active:bg-white/10
        ${isCurrent ? 'bg-brand-500/10 ring-1 ring-brand-400/20' : ''}`}
    >
      <div className="relative shrink-0">
        <Artwork
          title={song.title} hue={song.hue} hue2={song.hue2} imageUrl={song.imageUrl}
          className="h-11 w-11" rounded="rounded-xl"
        />
        {isCurrent && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
            <span className="flex items-end gap-[2px] h-4">
              {[0.6, 1, 0.4].map((h, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-brand-400 animate-bar-rise"
                  style={{ height: `${h * 100}%`, animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${isCurrent ? 'text-brand-300' : 'text-white'}`}>
          {song.title}
        </p>
        <p className="truncate text-xs text-white/40">{song.artist} · {song.album}</p>
      </div>
      <span className="shrink-0 text-xs tabular-nums text-white/25">{formatTime(song.duration)}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LyricsPanel — subscribes to 60fps PlaybackContext.
// Isolated so the rest of NowPlayingView doesn't re-render on every position tick.
// ─────────────────────────────────────────────────────────────────────────────
const LyricsPanel = memo(function LyricsPanel({
  seek,
  lyricsLines,
  lyricsStatus,
  songTitle,
}: {
  seek: (s: number) => void;
  lyricsLines: import('../lyrics').LyricLine[];
  lyricsStatus: import('../lyricsApi').LyricsFetchStatus;
  songTitle: string;
}) {
  const { position } = usePlayback();
  return (
    <Lyrics
      lines={lyricsLines}
      position={position}
      status={lyricsStatus}
      onSeek={seek}
      songTitle={songTitle}
    />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SeekBar — subscribes to 60fps PlaybackContext.
// Isolated so NowPlayingView body doesn't re-render on every position tick.
// ─────────────────────────────────────────────────────────────────────────────
const SeekBar = memo(function SeekBar({
  seek,
  songDuration,
}: {
  seek: (s: number) => void;
  songDuration: number;
}) {
  const { position, duration } = usePlayback();
  const dur = duration || songDuration;
  return (
    <div>
      <SeekSlider value={position} max={dur} onSeek={seek} ariaLabel="Seek" />
       <div className="flex justify-between text-xs font-medium tabular-nums text-white/60 sm:text-sm">
         <span className="shrink-0">{formatTime(position)}</span>
         <span className="shrink-0">{formatTime(dur)}</span>
       </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main NowPlayingView
// ─────────────────────────────────────────────────────────────────────────────
export function NowPlayingView() {
  injectNPStyles();
  const {
    current, isPlaying,
    repeat, shuffle, togglePlay, next, prev,
    seek, cycleRepeat, toggleShuffle, queue, index, jumpToQueueItem,
  } = usePlayer();
  const { back } = useNav();
  const { isLiked, toggle: toggleLike } = useLikes();

  const songLiked = isLiked(current?.id ?? '');
  const [lyricsOpen,      setLyricsOpen]      = useState(false);
  const [queueOpen,       setQueueOpen]       = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);

  // ── Lyrics — fetched in background by LyricsPrefetcher in App.tsx.
  //    useLyrics() reads from the same cache so result is instant when
  //    the panel opens (fetch already completed in the background).
  const { lines: lyricsLines, status: lyricsStatus } = useLyrics();

  if (!current) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-ink-950 text-center">
        <p className="font-display text-lg text-ink-100">No song selected</p>
        <button onClick={back} className="rounded-full bg-ink-700 px-4 py-2 text-sm text-ink-50 hover:bg-ink-600">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-ink-950">

      {/* ── Background ── */}
      <div className="absolute inset-0 scale-125">
        <div className="absolute inset-0" style={{ background: gradientStyle(current.hue, current.hue2, 160) }} />
      </div>
      <div className="absolute inset-0 backdrop-blur-md" />
      <div className="absolute inset-0 bg-black/65" />

      {/* ── Full-screen shimmer ── */}
      <div aria-hidden className="absolute inset-0 z-[1] overflow-hidden pointer-events-none">
        <div style={{
          position:   'absolute',
          top: '-30%', bottom: '-30%',
          left: '-80%', right: '-80%',
          background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)',
          animation:  'npShineR2L 4.5s ease-in-out infinite',
        }} />
        <div style={{
          position:   'absolute',
          top: '-30%', bottom: '-30%',
          left: '-80%', right: '-80%',
          background: 'linear-gradient(75deg, transparent 30%, rgba(255,255,255,0.055) 50%, transparent 70%)',
          animation:  'npShineL2R 6s 2.25s ease-in-out infinite',
        }} />
      </div>

      {/* ── Top bar ── */}
      <div
        className="relative z-10 flex shrink-0 items-center justify-between px-4 py-3 sm:py-4 lg:px-8 lg:py-5"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <button
          onClick={back}
          aria-label="Close"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white
            backdrop-blur transition-transform hover:scale-105 active:scale-95"
        >
          <ChevronDown size={20} />
        </button>

         <div className="min-w-0 flex-1 px-2 text-center">
           <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50 sm:text-[11px]">
             Playing from album
           </p>
           <p className="break-words text-xs font-semibold leading-tight text-white sm:text-sm">{current.album}</p>
         </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setLyricsOpen(v => !v)}
            aria-label="Lyrics"
            aria-pressed={lyricsOpen}
            className={`grid h-11 w-11 place-items-center rounded-full backdrop-blur
              transition-all hover:scale-105 active:scale-95
              ${lyricsOpen ? 'bg-brand-400/30 text-brand-300' : 'bg-white/10 text-white'}`}
          >
            <Mic2 size={16} />
          </button>
          <button
            onClick={() => setQueueOpen(true)}
            aria-label="Queue"
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white
              backdrop-blur transition-all hover:scale-105 active:scale-95"
          >
            <ListMusic size={16} />
          </button>
          <button
            onClick={() => setActionSheetOpen(true)}
            aria-label="More options"
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white
              backdrop-blur transition-transform hover:scale-105 active:scale-95"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3
        px-4 sm:gap-4 sm:px-8 lg:px-16">

        {/* LyricsPanel subscribes to position internally — keeps body from re-rendering at 60fps */}
        {lyricsOpen && (
          <div className="absolute inset-0 z-10">
            <LyricsPanel
              seek={seek}
              lyricsLines={lyricsLines}
              lyricsStatus={lyricsStatus}
              songTitle={current.title}
            />
          </div>
        )}

        {/* Album art — hidden when lyrics open */}
        <div className={`relative mx-auto w-full max-w-[300px] transition-all duration-300 ease-out
          sm:max-w-[340px] lg:max-w-[380px]
          ${lyricsOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="relative aspect-square w-full">
            <div
              className="absolute -inset-3 rounded-3xl opacity-40 blur-2xl sm:-inset-4"
              style={{ background: `linear-gradient(135deg, hsl(${current.hue} 70% 45%), hsl(${current.hue2} 70% 30%))` }}
            />
            <div className={`relative h-full w-full overflow-hidden rounded-2xl shadow-2xl
              ring-1 ring-white/10 transition-transform duration-700 sm:rounded-3xl
              ${isPlaying ? 'scale-[1.02]' : 'scale-100'}`}>
              <Artwork
                title={current.title} hue={current.hue} hue2={current.hue2}
                imageUrl={current.imageUrl} className="h-full w-full" rounded="rounded-2xl"
              />
              <div className="absolute inset-0 rounded-2xl ring-inset ring-1 ring-white/5 sm:rounded-3xl" />
            </div>
          </div>
        </div>

        {/* Visualizer — hidden when lyrics open */}
        <div className={`h-7 w-full max-w-[300px] transition-all duration-500
          sm:h-9 sm:max-w-[340px] lg:max-w-[380px]
          ${lyricsOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 scale-100'}`}>
          <Visualizer isPlaying={isPlaying} hue={current.hue} barCount={48} className="h-full w-full" />
        </div>

        {/* Title + like — hidden when lyrics open */}
        <div className={`flex w-full max-w-[300px] items-start justify-between gap-3 px-0.5
          transition-all duration-300 sm:max-w-[340px] lg:max-w-[380px]
          ${lyricsOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
           <div className="min-w-0">
             <h1 className="break-words font-display text-xl font-bold leading-tight text-white sm:text-2xl">
               {current.title}
             </h1>
             <p className="mt-0.5 break-words text-sm leading-snug text-white/60">{current.artist}</p>
           </div>
          <button
            onClick={() => current && toggleLike(current)}
            aria-label={songLiked ? 'Unlike' : 'Like'}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors
              ${songLiked ? 'text-accent-400' : 'text-white/70 hover:text-white'}`}
          >
            <Heart size={22} className={songLiked ? 'fill-accent-400' : ''} />
          </button>
        </div>
      </div>

      {/* ── Transport ── */}
      <div
        className="relative z-10 shrink-0 px-4 pt-1 sm:px-8 lg:px-16"
        style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))' }}
      >
        <div className="mx-auto w-full max-w-xs space-y-2 sm:max-w-[340px] sm:space-y-3 lg:max-w-[380px]">
          {/* SeekBar subscribes to position internally */}
          <SeekBar seek={seek} songDuration={current.duration} />
          <div className="flex items-center justify-between">
            <button onClick={toggleShuffle} aria-label="Shuffle"
              className={`grid h-11 w-11 place-items-center rounded-full transition-colors
                ${shuffle ? 'text-brand-400' : 'text-white/55 hover:text-white'}`}>
              <Shuffle size={18} />
            </button>
            <button onClick={prev} aria-label="Previous"
              className="grid h-11 w-11 place-items-center rounded-full text-white
                transition-transform hover:scale-110 active:scale-95">
              <SkipBack size={26} className="fill-current" />
            </button>
            <button onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}
              className="grid h-14 w-14 place-items-center rounded-full bg-white text-ink-950
                shadow-xl transition-transform hover:scale-105 active:scale-95">
              {isPlaying
                ? <Pause size={24} className="fill-ink-950" />
                : <Play  size={24} className="fill-ink-950 translate-x-[1px]" />}
            </button>
            <button onClick={next} aria-label="Next"
              className="grid h-11 w-11 place-items-center rounded-full text-white
                transition-transform hover:scale-110 active:scale-95">
              <SkipForward size={26} className="fill-current" />
            </button>
            <button onClick={cycleRepeat} aria-label="Repeat"
              className={`grid h-11 w-11 place-items-center rounded-full transition-colors
                ${repeat !== 'off' ? 'text-brand-400' : 'text-white/55 hover:text-white'}`}>
              {repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Overlays ── */}
      {actionSheetOpen && (
        <ActionSheet song={current} onClose={() => setActionSheetOpen(false)} />
      )}

      {queueOpen && (
        <QueueDrawer
          queue={queue}
          currentIndex={index}
          onPlay={id => { jumpToQueueItem(id); }}
          onClose={() => setQueueOpen(false)}
        />
      )}
    </div>
  );
}
