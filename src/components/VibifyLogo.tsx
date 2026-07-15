/**
 * VibifyLogo — shared logo component.
 * Renders the neon music-note logo image at any size.
 * Use this everywhere instead of the old SVG mark.
 */

interface VibifyLogoProps {
  /** Pixel size (width = height). Default 40. */
  size?: number;
  className?: string;
}

export function VibifyLogo({ size = 40, className = '' }: VibifyLogoProps) {
  return (
    <img
      src="/icons/logo.png"
      alt="Vibify"
      width={size}
      height={size}
      draggable={false}
      className={`select-none object-contain rounded-2xl ${className}`}
    />
  );
}
