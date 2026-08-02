import { useEffect, useRef } from 'react';

/**
 * Animated EQ-style visualizer.
 *
 * Perf fixes:
 * - Gradients are created once per hue change (not 48× per frame).
 * - Each bar reuses a pre-built offscreen canvas strip so the hot render loop
 *   only calls fillRect — zero new object allocations per frame.
 * - isPlaying is tracked via a ref inside the effect so toggling play/pause
 *   no longer tears down and recreates the canvas context, ResizeObserver,
 *   or rAF loop — it simply changes animation speed in-place.
 */
export function Visualizer({
  isPlaying,
  hue,
  barCount = 48,
  className = '',
  rounded = true,
}: {
  isPlaying: boolean;
  hue: number;
  barCount?: number;
  className?: string;
  rounded?: boolean;
}) {
  const canvasRef      = useRef<HTMLCanvasElement | null>(null);
  const rafRef         = useRef<number>(0);
  const phaseRef       = useRef(0);
  // ── Ref-based props so the rAF loop always reads the latest value without
  //    needing to be recreated when they change. ──────────────────────────────
  const isPlayingRef   = useRef(isPlaying);
  const hueRef         = useRef(hue);
  const barCountRef    = useRef(barCount);
  const roundedRef     = useRef(rounded);
  // Cache: stores the hue for which the gradient strip was built
  const gradHueRef     = useRef<number | null>(null);
  // Offscreen canvas that holds a single-bar gradient column, reused every frame
  const gradCanvasRef  = useRef<HTMLCanvasElement | null>(null);

  // Keep refs in sync on every render without restarting the effect
  isPlayingRef.current  = isPlaying;
  hueRef.current        = hue;
  barCountRef.current   = barCount;
  roundedRef.current    = rounded;

  // Invalidate gradient cache when hue changes so it is rebuilt on next frame
  useEffect(() => {
    gradHueRef.current = null;
  }, [hue]);

  // ── Single effect: sets up canvas, ResizeObserver, and rAF loop once ───────
  // Only re-runs if the canvas element itself is replaced (practically never).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let mounted = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const rect = canvas.getBoundingClientRect();
      canvas.width  = Math.max(1, Math.floor(rect.width  * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      // Invalidate cached gradient when canvas is resized
      gradHueRef.current = null;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const render = () => {
      if (!mounted) return;

      const playing  = isPlayingRef.current;
      const curHue   = hueRef.current;
      const bars     = barCountRef.current;
      const round    = roundedRef.current;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      phaseRef.current += playing ? 0.045 : 0.008;
      const phase = phaseRef.current;

      const gap  = 2;
      const barW = (w - gap * (bars - 1)) / bars;

      // ── Rebuild gradient strip only when hue or canvas size changes ────────
      if (gradHueRef.current !== curHue || !gradCanvasRef.current ||
          gradCanvasRef.current.height !== h) {
        const gc = gradCanvasRef.current ?? document.createElement('canvas');
        gc.width  = 1;
        gc.height = Math.max(1, h);
        const gctx = gc.getContext('2d')!;
        const grad = gctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, `hsl(${curHue} 80% 60%)`);
        grad.addColorStop(1, `hsl(${curHue + 32} 70% 45%)`);
        gctx.fillStyle = grad;
        gctx.fillRect(0, 0, 1, h);
        gradCanvasRef.current = gc;
        gradHueRef.current = curHue;
      }

      // ── Draw bars using the cached gradient strip ──────────────────────────
      for (let i = 0; i < bars; i++) {
        const t    = i / bars;
        const wave =
          Math.sin(t * Math.PI * 2 + phase) * 0.45 +
          Math.sin(t * Math.PI * 6 + phase * 1.3) * 0.25;
        const amp  = playing
          ? 0.2 + 0.8 * (0.5 + 0.5 * wave)
          : 0.06 + 0.03 * Math.sin(phase + i);
        const bh   = Math.max(2, amp * h);
        const x    = i * (barW + gap);
        const y    = (h - bh) / 2;

        if (round) {
          const r = Math.min(barW / 2, 2);
          roundRect(ctx, x, y, barW, bh, r);
          ctx.save();
          ctx.clip();
          ctx.drawImage(gradCanvasRef.current!, x, y, barW, bh);
          ctx.restore();
        } else {
          ctx.drawImage(gradCanvasRef.current!, 0, y, 1, bh, x, y, barW, bh);
        }
      }

      // Keep the loop alive regardless of play state so the idle animation
      // (slow wave when paused) still runs. Speed is controlled via phase delta above.
      rafRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      mounted = false;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← intentionally empty: all changing values come through refs

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
