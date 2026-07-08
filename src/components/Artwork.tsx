import { useState } from 'react';
import { gradientStyle } from '../lib';

type ArtworkProps = {
  title: string;
  hue: number;
  hue2: number;
  /** Real album art URL from JioSaavn — shown instead of gradient when available */
  imageUrl?: string;
  className?: string;
  variant?: 'album' | 'wave' | 'vinyl';
  rounded?: string;
};

/**
 * Album-style cover art.
 * When `imageUrl` is provided, shows the real album photo.
 * Falls back to layered gradients and geometric shapes when not available.
 * `vinyl` variant adds a center label hole for the spinning record look.
 */
export function Artwork({
  title,
  hue,
  hue2,
  imageUrl,
  className = '',
  variant = 'album',
  rounded = 'rounded-md',
}: ArtworkProps) {
  const [imgError, setImgError] = useState(false);

  // Show real image if we have a URL and it hasn't errored
  const showRealImage = Boolean(imageUrl) && !imgError;

  const shape = (title.charCodeAt(0) + title.length) % 5;

  if (showRealImage) {
    return (
      <div className={`relative overflow-hidden contain-content ${rounded} ${className}`}>
        <img
          src={imageUrl}
          alt={title}
          onError={() => setImgError(true)}
          className="h-full w-full object-cover transform-gpu"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
        {/* subtle vignette overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        {/* wave glyph for playlist variant on top of real image */}
        {variant === 'wave' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-end gap-[3px] h-1/3">
              {[0.5, 0.9, 0.6, 1, 0.4, 0.8, 0.55].map((h, i) => (
                <span key={i} className="w-[3px] rounded-full bg-white/70" style={{ height: `${h * 100}%` }} />
              ))}
            </div>
          </div>
        )}
        {variant === 'vinyl' && (
          <div className="absolute left-1/2 top-1/2 h-[38%] w-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
        )}
      </div>
    );
  }

  // Fallback: gradient + geometric shapes
  return (
    <div
      className={`relative overflow-hidden contain-content ${rounded} ${className}`}
      style={{ background: gradientStyle(hue, hue2, 135) }}
    >
      {/* primary glow */}
      <div
        className="absolute -top-1/3 -right-1/4 w-3/4 h-3/4 rounded-full opacity-60 blur-2xl"
        style={{ background: `hsl(${hue2} 85% 62% / 0.5)` }}
      />
      {/* secondary glow */}
      <div
        className="absolute -bottom-1/4 -left-1/4 w-2/3 h-2/3 rounded-full opacity-40 blur-2xl"
        style={{ background: `hsl(${hue} 85% 55% / 0.35)` }}
      />

      {/* geometric overlay */}
      {shape === 0 && (
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: `conic-gradient(from 210deg at 70% 30%, hsl(${hue2} 90% 65% / 0.7), transparent 40%)` }}
        />
      )}
      {shape === 1 && (
        <div className="absolute left-1/2 top-1/2 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-[45%] border border-white/20 opacity-50" />
      )}
      {shape === 2 && (
        <div className="absolute inset-0 opacity-25">
          <div className="absolute left-[18%] top-[18%] h-1/3 w-1/3 rounded-full bg-white/70 blur-md" />
          <div className="absolute right-[20%] bottom-[22%] h-1/4 w-1/4 rounded-full bg-white/50 blur-md" />
        </div>
      )}
      {shape === 3 && (
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: `repeating-linear-gradient(110deg, transparent 0 14px, hsl(${hue2} 90% 70% / 0.4) 14px 16px)`,
          }}
        />
      )}
      {shape === 4 && (
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, hsl(${hue} 80% 60% / 0.3) 0 2px, transparent 2px 22px)`,
          }}
        />
      )}

      {/* vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-white/5" />
      {/* grain */}
      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '3px 3px' }}
      />

      {/* wave glyph for playlist variant */}
      {variant === 'wave' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-end gap-[3px] h-1/3">
            {[0.5, 0.9, 0.6, 1, 0.4, 0.8, 0.55].map((h, i) => (
              <span key={i} className="w-[3px] rounded-full bg-white/80" style={{ height: `${h * 100}%` }} />
            ))}
          </div>
        </div>
      )}

      {/* vinyl center label hole */}
      {variant === 'vinyl' && (
        <div className="absolute left-1/2 top-1/2 h-[38%] w-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
      )}
    </div>
  );
}
