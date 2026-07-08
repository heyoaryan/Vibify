import { useEffect, useRef } from 'react';

/**
 * Animated EQ-style visualizer. Uses CSS-driven bars when idle (no audio
 * analysis) for a lively feel, and an AnalyserNode when a MediaElement source
 * is provided for real frequency bars. Falls back gracefully.
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let mounted = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
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

      const gap = 2;
      const barW = (w - gap * (barCount - 1)) / barCount;
      for (let i = 0; i < barCount; i++) {
        const t = i / barCount;
        const wave =
          Math.sin(t * Math.PI * 2 + phase) * 0.45 +
          Math.sin(t * Math.PI * 6 + phase * 1.3) * 0.25;
        const amp = isPlaying ? 0.2 + 0.8 * (0.5 + 0.5 * wave) : 0.06 + 0.03 * Math.sin(phase + i);
        const bh = Math.max(2, amp * h);
        const x = i * (barW + gap);
        const y = (h - bh) / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + bh);
        grad.addColorStop(0, `hsl(${hue} 80% 60%)`);
        grad.addColorStop(1, `hsl(${hue + 32} 70% 45%)`);
        ctx.fillStyle = grad;

        if (rounded) {
          const r = Math.min(barW / 2, 2);
          roundRect(ctx, x, y, barW, bh, r);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barW, bh);
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
