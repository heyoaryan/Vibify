import { useMemo, useRef } from 'react';
import { Mic2, Loader2, Music2 } from 'lucide-react';
import type { LyricLine } from '../lyrics';
import type { LyricsFetchStatus } from '../lyricsApi';

export type LyricsProps = {
  lines:      LyricLine[];
  position:   number;
  status:     LyricsFetchStatus;
  onSeek:     (t: number) => void;
  songTitle?: string;
};

// ─── Keyframes — injected once into <head> ────────────────────────────────────
const KEYFRAMES = `
  @keyframes lyricIn {
    0%   { opacity: 0; transform: translateY(22px) scale(0.95); }
    100% { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  @keyframes batchIn {
    0%   { opacity: 0; transform: translateY(14px); }
    100% { opacity: 1; transform: translateY(0);    }
  }
  @keyframes beamSweep {
    0%   { -webkit-mask-position: -80% center; mask-position: -80% center; }
    100% { -webkit-mask-position: 180% center; mask-position: 180% center; }
  }
  @keyframes tuneNote {
    0%,100% { transform: translateY(0px);  opacity: 0.4; }
    50%     { transform: translateY(-5px); opacity: 0.9; }
  }
`;
let _injected = false;
function injectStyles() {
  if (_injected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = KEYFRAMES;
  document.head.appendChild(s);
  _injected = true;
}

// ─── ActiveLine: CSS mask-sweep glow ─────────────────────────────────────────
// Uses a single <div> wrapper. The base text is dim; a second absolutely
// positioned copy (same dimensions, block-level) carries the bright beam.
// Block-level containment fixes the "text outside bracket" issue.
function ActiveLine({
  text, animKey, lineDurationMs,
}: {
  text: string; animKey: number; lineDurationMs: number;
}) {
  const sweepMs = Math.max(700, lineDurationMs * 0.75);

  return (
    // Block wrapper — gives the absolute child a proper containing block
    <div
      key={animKey}
      style={{
        position:   'relative',
        display:    'block',
        animation:  'lyricIn 0.42s cubic-bezier(0.22,1,0.36,1) both',
        whiteSpace: 'nowrap',
        overflow:   'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {/* Layer 1: base text — dim white, sets the layout height */}
      <div style={{ color: 'rgba(255,255,255,0.38)', userSelect: 'none',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {text}
      </div>

      {/* Layer 2: bright beam — exact same text, stacked on top */}
      <div
        aria-hidden
        style={{
          position:   'absolute',
          inset:      0,
          color:      '#ffffff',
          textShadow: '0 0 20px rgba(255,255,255,0.9), 0 0 48px rgba(255,255,255,0.4)',
          whiteSpace: 'nowrap',
          overflow:   'hidden',
          WebkitMaskImage: 'linear-gradient(90deg,transparent 0%,#000 28%,#000 72%,transparent 100%)',
          maskImage:       'linear-gradient(90deg,transparent 0%,#000 28%,#000 72%,transparent 100%)',
          WebkitMaskSize:   '58% 100%',
          maskSize:         '58% 100%',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat:       'no-repeat',
          animation:        `beamSweep ${sweepMs}ms 100ms linear both`,
          pointerEvents:    'none',
        }}
      >
        {text}
      </div>
    </div>
  );
}

// ─── Tune symbol row ──────────────────────────────────────────────────────────
function TuneRow({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex h-10 items-center justify-center gap-2">
      {isActive
        ? [0,1,2].map(j => (
            <Music2 key={j} size={15} className="text-white/65"
              style={{ animation: `tuneNote 1s ${j*0.22}s ease-in-out infinite` }} />
          ))
        : <Music2 size={13} className="text-white/28" />
      }
    </div>
  );
}

// ─── Loading ──────────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-8">
      <Loader2 size={22} className="text-white/25 animate-spin" />
      <div className="w-full max-w-[200px] space-y-3">
        {[58,80,46,68,52].map((w,i) => (
          <div key={i} className="mx-auto h-3 rounded-full bg-white/[0.08] animate-pulse"
            style={{ width:`${w}%`, animationDelay:`${i*0.07}s` }} />
        ))}
      </div>
    </div>
  );
}

// ─── No lyrics ────────────────────────────────────────────────────────────────
function NoLyrics({ songTitle }: { songTitle?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-white/[0.06]">
        <Mic2 size={22} className="text-white/25" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-white/35">No lyrics available</p>
        {songTitle && <p className="text-sm text-white/20">"{songTitle}"</p>}
      </div>
    </div>
  );
}

// ─── Responsive font sizes ────────────────────────────────────────────────────
const FONT = {
  active: 'clamp(1.1rem, 3.2vw, 1.6rem)',   // smaller so long lines stay single-line
  near:   'clamp(0.85rem, 2.4vw, 1.15rem)',
  far:    'clamp(0.75rem, 2vw,   1rem)',
};
// When the active line crosses a batch boundary the whole group swaps out
// with a smooth slide-up animation — like Apple Music.
const WINDOW_SIZE   = 4;   // lines visible at once
const LINES_BEFORE  = 1;   // how many past lines to show above active

export function Lyrics({ lines, position, status, onSeek, songTitle }: LyricsProps) {
  injectStyles();

  const prevBatchRef  = useRef(-1);
  const animKeyRef    = useRef(0);
  const prevActiveRef = useRef(-1);
  const lineAnimRef   = useRef(0);

  // ── which line is active ──────────────────────────────────────────────────
  const activeIndex = useMemo(() => {
    if (!lines.length) return -1;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (position >= lines[i].t) idx = i;
      else break;
    }
    return idx;
  }, [lines, position]);

  const hasStarted = lines.length > 0 && position >= lines[0].t;

  // ── line animation key (changes on each new active line) ─────────────────
  if (prevActiveRef.current !== activeIndex) {
    lineAnimRef.current++;
    prevActiveRef.current = activeIndex;
  }
  const lineAnimKey = lineAnimRef.current;

  // ── duration of current line (ms) ────────────────────────────────────────
  const lineDurationMs = useMemo(() => {
    if (activeIndex < 0) return 3000;
    const next = lines[activeIndex + 1];
    return next ? Math.max(800, (next.t - lines[activeIndex].t) * 1000) : 3000;
  }, [lines, activeIndex]);

  // ── batch: group of WINDOW_SIZE lines to display ─────────────────────────
  // Batch start = floor so the active line is always at LINES_BEFORE offset
  const batchStart = useMemo(() => {
    if (activeIndex < 0) return 0;
    return Math.max(0, activeIndex - LINES_BEFORE);
  }, [activeIndex]);

  // Batch key — changes only when we cross to a new batch group
  // We want the batch to "flip" every WINDOW_SIZE lines, not every line
  const batchGroup = Math.floor(batchStart / WINDOW_SIZE);
  if (prevBatchRef.current !== batchGroup) {
    animKeyRef.current++;
    prevBatchRef.current = batchGroup;
  }
  const batchAnimKey = animKeyRef.current;

  // Visible window
  const windowLines = useMemo(() => {
    return lines.slice(batchStart, batchStart + WINDOW_SIZE);
  }, [lines, batchStart]);

  // ── early returns ─────────────────────────────────────────────────────────
  if (status === 'loading' || status === 'idle') return <LoadingSkeleton />;
  if (status === 'none' || !lines.length)        return <NoLyrics songTitle={songTitle} />;

  // ── pre-lyrics: song has started but first lyric hasn't arrived yet ───────
  // Show animated tune notes centred so screen isn't empty
  const preIntro = !hasStarted && lines.length > 0;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-6 sm:px-12">

      {/* Pre-intro tune — visible while song plays before first lyric */}
      {preIntro && (
        <div className="flex items-center justify-center gap-3 mb-2">
          {[0,1,2].map(j => (
            <Music2 key={j} size={20} className="text-white/50"
              style={{ animation: `tuneNote 1.1s ${j*0.25}s ease-in-out infinite` }} />
          ))}
        </div>
      )}

      {/* Batch window — key forces remount + re-animation on batch change */}
      <div
        key={batchAnimKey}
        className="w-full max-w-lg text-center"
        style={{ animation: 'batchIn 0.5s cubic-bezier(0.22,1,0.36,1) both' }}
      >
        <div className="space-y-1">
          {windowLines.map((line, wi) => {
            const globalIdx  = batchStart + wi;
            const isActive   = globalIdx === activeIndex;
            const isPast     = globalIdx  < activeIndex;
            const isFuture   = globalIdx  > activeIndex;
            const showActive = isActive && hasStarted;
            const dist       = Math.abs(globalIdx - activeIndex);

            const opacity = showActive ? 1
              : dist === 0 ? 0.28
              : dist === 1 ? (isPast ? 0.42 : 0.22)
              : 0.15;

            const fontSize = showActive
              ? FONT.active
              : dist === 1 ? FONT.near : FONT.far;

            // instrumental / empty line
            if (!line.text) {
              return (
                <div key={globalIdx}>
                  <TuneRow isActive={showActive} />
                </div>
              );
            }

            return (
              <button
                key={globalIdx}
                type="button"
                onClick={() => onSeek(line.t)}
                className="w-full rounded-xl px-2 py-[5px] text-center"
                style={{
                  fontFamily:    '"Sora", "Plus Jakarta Sans", system-ui, sans-serif',
                  fontWeight:    showActive ? 800 : isPast ? 600 : 500,
                  fontSize,
                  lineHeight:    1.35,
                  opacity,
                  letterSpacing: showActive ? '-0.01em' : '0',
                  filter:        isFuture && hasStarted ? 'blur(0.8px)' : 'none',
                  transition:    'opacity 0.5s ease, font-size 0.4s ease, filter 0.4s ease',
                  whiteSpace:    'nowrap',
                  overflow:      'hidden',
                  textOverflow:  'ellipsis',
                }}
              >
                {showActive
                  ? <ActiveLine text={line.text} animKey={lineAnimKey} lineDurationMs={lineDurationMs} />
                  : line.text
                }
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
