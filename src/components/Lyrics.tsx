import { memo, useMemo, useRef } from 'react';
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
    0%   { opacity: 0; transform: translateY(20px) scale(0.96); }
    100% { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  @keyframes batchIn {
    0%   { opacity: 0; transform: translateY(12px); }
    100% { opacity: 1; transform: translateY(0);    }
  }
  @keyframes beamSweep {
    0%   { 
      -webkit-mask-position: -50% center; 
      mask-position: -50% center; 
    }
    100% { 
      -webkit-mask-position: 150% center; 
      mask-position: 150% center; 
    }
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
// Text-bounded beam that stays strictly within text boundaries
// memo'd: only re-renders when animKey or lineDurationMs changes (i.e. new lyric line)
const ActiveLine = memo(function ActiveLine({
  text, animKey, lineDurationMs,
}: {
  text: string; animKey: number; lineDurationMs: number;
}) {
  const sweepMs = Math.max(800, lineDurationMs * 0.8);

  return (
    <div
      key={animKey}
      style={{
        position:   'relative',
        display:    'inline-block',
        animation:  'lyricIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        whiteSpace: 'normal',
        wordWrap:   'break-word',
        overflowWrap: 'break-word',
        lineHeight: 1.45,
        width: '100%',
      }}
    >
      {/* Layer 1: base text — dim white */}
      <div style={{ 
        color: 'rgba(255,255,255,0.45)', 
        userSelect: 'none',
        whiteSpace: 'normal',
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
      }}>
        {text}
      </div>

      {/* Layer 2: bright beam — stacked on top, contained within text */}
      <div
        aria-hidden
        style={{
          position:   'absolute',
          top:        0,
          left:       0,
          right:      0,
          color:      '#ffffff',
          textShadow: '0 0 28px rgba(255,255,255,1), 0 0 56px rgba(255,255,255,0.5)',
          whiteSpace: 'normal',
          wordWrap:   'break-word',
          overflowWrap: 'break-word',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 20%, #000 80%, transparent 100%)',
          maskImage:       'linear-gradient(90deg, transparent 0%, #000 20%, #000 80%, transparent 100%)',
          WebkitMaskSize:   '50% 100%',
          maskSize:         '50% 100%',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat:       'no-repeat',
          WebkitMaskPosition: '-50% center',
          maskPosition:      '-50% center',
          animation:        `beamSweep ${sweepMs}ms 100ms cubic-bezier(0.33, 1, 0.68, 1) both`,
          pointerEvents:    'none',
          overflow:         'hidden',
        }}
      >
        {text}
      </div>
    </div>
  );
});

// ─── Tune symbol row ──────────────────────────────────────────────────────────
const TuneRow = memo(function TuneRow({ isActive }: { isActive: boolean }) {
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
});

// ─── Loading ──────────────────────────────────────────────────────────────────
const LoadingSkeleton = memo(function LoadingSkeleton() {
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
});

// ─── No lyrics ────────────────────────────────────────────────────────────────
const NoLyrics = memo(function NoLyrics({ songTitle }: { songTitle?: string }) {
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
});

// ─── Responsive font sizes ────────────────────────────────────────────────────
const FONT = {
  active: 'clamp(1.4rem, 4vw + 0.2rem, 2.2rem)',   // mobile: ~1.4rem, desktop: ~2.2rem
  near:   'clamp(1rem, 2.5vw + 0.1rem, 1.4rem)',   // mobile: ~1rem, desktop: ~1.4rem
  far:    'clamp(0.9rem, 2vw, 1.2rem)',            // mobile: ~0.9rem, desktop: ~1.2rem
};
// When the active line crosses a batch boundary the whole group swaps out
// with a smooth slide-up animation — like Apple Music.
const WINDOW_SIZE   = 4;   // lines visible at once
const LINES_BEFORE  = 1;   // how many past lines to show above active

export const Lyrics = memo(function Lyrics({ lines, position, status, onSeek, songTitle }: LyricsProps) {
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
    <div className="flex h-full w-full flex-col items-center justify-center px-4 sm:px-8 md:px-12">

      {/* Pre-intro tune — visible while song plays before first lyric */}
      {preIntro && (
        <div className="flex items-center justify-center gap-3 mb-4">
          {[0,1,2].map(j => (
            <Music2 key={j} size={20} className="text-white/50"
              style={{ animation: `tuneNote 1.1s ${j*0.25}s ease-in-out infinite` }} />
          ))}
        </div>
      )}

      {/* Batch window — key forces remount + re-animation on batch change */}
      <div
        key={batchAnimKey}
        className="w-full max-w-2xl text-center"
        style={{ animation: 'batchIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both' }}
      >
        <div className="space-y-2 md:space-y-3">
          {windowLines.map((line, wi) => {
            const globalIdx  = batchStart + wi;
            const isActive   = globalIdx === activeIndex;
            const isPast     = globalIdx  < activeIndex;
            const isFuture   = globalIdx  > activeIndex;
            const showActive = isActive && hasStarted;
            const dist       = Math.abs(globalIdx - activeIndex);

            const opacity = showActive ? 1
              : dist === 0 ? 0.32
              : dist === 1 ? (isPast ? 0.48 : 0.26)
              : 0.18;

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
                className="w-full rounded-xl px-3 py-2 text-center transition-all duration-500 hover:bg-white/5"
                style={{
                  fontFamily:    '"Sora", "Plus Jakarta Sans", system-ui, sans-serif',
                  fontWeight:    showActive ? 800 : isPast ? 600 : 500,
                  fontSize,
                  lineHeight:    showActive ? 1.45 : 1.4,
                  opacity,
                  letterSpacing: showActive ? '-0.015em' : '0',
                  filter:        isFuture && hasStarted ? 'blur(1px)' : 'none',
                  transform:     showActive ? 'scale(1.02)' : 'scale(1)',
                  transition:    'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
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
});
