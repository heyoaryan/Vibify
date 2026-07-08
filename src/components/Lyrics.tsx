import { useEffect, useMemo, useRef } from 'react';
import { Mic2 } from 'lucide-react';
import type { LyricLine } from '../lyrics';

type LyricsProps = {
  lines: LyricLine[];
  position: number;
  onSeek: (t: number) => void;
  onLineClick?: () => void;
  songTitle?: string;
};

export function Lyrics({ lines, position, onSeek, onLineClick, songTitle }: LyricsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLDivElement | null>(null);

  const activeIndex = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (position >= lines[i].t) idx = i;
      else break;
    }
    return idx;
  }, [lines, position]);

  // Auto-scroll active line to center
  useEffect(() => {
    const container = containerRef.current;
    const active = activeRef.current;
    if (!container || !active) return;
    const cRect = container.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    const offset = aRect.top - cRect.top - cRect.height / 2 + aRect.height / 2;
    container.scrollTo({ top: container.scrollTop + offset, behavior: 'smooth' });
  }, [activeIndex]);

  const handleLineClick = (line: LyricLine) => {
    if (!line.text) return;
    onSeek(line.t);
    const container = containerRef.current;
    const active = activeRef.current;
    if (container && active) {
      const cRect = container.getBoundingClientRect();
      const aRect = active.getBoundingClientRect();
      const offset = aRect.top - cRect.top - cRect.height / 2 + aRect.height / 2;
      container.scrollTo({ top: container.scrollTop + offset, behavior: 'smooth' });
    }
    if (onLineClick) setTimeout(onLineClick, 350);
  };

  // No lyrics available — show proper empty state
  if (lines.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-white/10">
          <Mic2 size={24} className="text-white/50" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/80">Lyrics not available</p>
          {songTitle && (
            <p className="mt-1 text-xs text-white/40">
              No lyrics found for "{songTitle}"
            </p>
          )}
          <p className="mt-2 text-xs text-white/30">
            Lyrics aren't available for this track yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="no-scrollbar h-full overflow-y-auto px-2 py-[40%]">
      <div className="space-y-3 text-center">
        {lines.map((line, i) => {
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          const isEmpty = line.text.length === 0;
          return (
            <div
              key={i}
              ref={isActive ? activeRef : undefined}
              onClick={() => handleLineClick(line)}
              className={[
                'rounded-lg px-2 py-1 transition-all duration-300',
                isEmpty ? 'h-3' : 'cursor-pointer',
                !isEmpty && isActive
                  ? 'text-2xl font-bold text-white scale-[1.02] sm:text-3xl'
                  : '',
                !isEmpty && !isActive && isPast
                  ? 'text-xl font-semibold text-white/35 hover:text-white/60 sm:text-2xl'
                  : '',
                !isEmpty && !isActive && !isPast
                  ? 'text-xl font-semibold text-white/30 hover:text-white/55 sm:text-2xl'
                  : '',
              ].join(' ')}
            >
              {!isEmpty && line.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
