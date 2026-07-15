import { useEffect, useRef } from 'react';

/**
 * Animated EQ-style visualizer.
 *
 * Perf fix: gradients are created once per hue change (not 48× per frame).
 * Each bar reuses a pre-built offscreen canvas strip so the hot render loop
 * only calls fillRect — zero new object allocations per frame.
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
  const canvasRef  = useRef<HTMLCanvasElement | null>(null);
  const rafRef     = useRef<number>(0);
  const phaseRef   = useRef(0);
  // Cache: stores the hue for which the gradient strip was built
  const gradHueRef = useRef<number | null>(null);
  // Offscreen canvas that holds a single-bar gradient column, reused every frame
  const gradCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      phaseRef.current += isPlaying ? 0.045 : 0.008;
      const phase = phaseRef.current;

      const gap  = 2;
      const barW = (w - gap * (barCount - 1)) / barCount;

      // ── Rebuild gradient strip only when hue or canvas size changes ────────
      // We draw into a 1-px-wide offscreen canvas that is the full height of
      // the visible area. Each bar is drawn by copying a scaled portion of
      // this strip, so createLinearGradient is called AT MOST once per frame
      // when something changes — versus 48 times every frame before.
      if (gradHueRef.current !== hue || !gradCanvasRef.current ||
          gradCanvasRef.current.height !== h) {
        const gc = gradCanvasRef.current ?? document.createElement('canvas');
        gc.width  = 1;
        gc.height = Math.max(1, h);
        const gctx = gc.getContext('2d')!;
        const grad = gctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, `hsl(${hue} 80% 60%)`);
        grad.addColorStop(1, `hsl(${hue + 32} 70% 45%)`);
        gctx.fillStyle = grad;
        gctx.fillRect(0, 0, 1, h);
        gradCanvasRef.current = gc;
        gradHueRef.current = hue;
      }

      // ── Draw bars using the cached gradient strip ──────────────────────────
      for (let i = 0; i < barCount; i++) {
        const t    = i / barCount;
        const wave =
          Math.sin(t * Math.PI * 2 + phase) * 0.45 +
          Math.sin(t * Math.PI * 6 + phase * 1.3) * 0.25;
        const amp  = isPlaying
          ? 0.2 + 0.8 * (0.5 + 0.5 * wave)
          : 0.06 + 0.03 * Math.sin(phase + i);
        const bh   = Math.max(2, amp * h);
        const x    = i * (barW + gap);
        const y    = (h - bh) / 2;

        if (rounded) {
          const r = Math.min(barW / 2, 2);
          roundRect(ctx, x, y, barW, bh, r);
          // Clip and draw the gradient strip into this bar's bounding rect
          ctx.save();
          ctx.clip();
          ctx.drawImage(gradCanvasRef.current, x, y, barW, bh);
          ctx.restore();
        } else {
          ctx.drawImage(gradCanvasRef.current, 0, y, 1, bh, x, y, barW, bh);
        }
      }

      if (isPlaying) {
        rafRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      mounted = false;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [isPlaying, hue, barCount, rounded]);

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
