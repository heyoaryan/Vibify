/**
 * InstallButton — inline PWA install control.
 *
 * Shows only an icon (no text label) so it doesn't clutter the top bar.
 *   - Download icon when installable
 *   - Animated buffering ring while installing
 *   - Check icon once installed
 */

import { CheckCircle, Download } from 'lucide-react';
import { usePWAInstall } from '../pwaInstall';

export function InstallButton({ className = '' }: { className?: string }) {
  const { canShowInline, state, install } = usePWAInstall();

  if (!canShowInline) return null;

  // ── Installing — pulsing buffer ring ───────────────────────────────────────
  if (state === 'installing') {
    return (
      <span
        aria-live="polite"
        aria-label="Installing Vibify…"
        className={`relative grid h-10 w-10 place-items-center rounded-full bg-brand-500/15 ${className}`}
      >
        {/* Spinning arc */}
        <svg
          className="absolute inset-0 animate-spin"
          viewBox="0 0 40 40"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <path
            d="M20 4 A16 16 0 0 1 36 20"
            stroke="#14c4ad"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <Download size={15} className="text-brand-300" aria-hidden="true" />
      </span>
    );
  }

  // ── Installed ───────────────────────────────────────────────────────────────
  if (state === 'installed') {
    return (
      <span
        aria-label="Vibify installed"
        className={`grid h-10 w-10 place-items-center rounded-full bg-brand-500/20 text-brand-300 ${className}`}
      >
        <CheckCircle size={17} />
      </span>
    );
  }

  // ── Available — icon-only install button ────────────────────────────────────
  return (
    <button
      onClick={install}
      aria-label="Install Vibify"
      title="Install Vibify"
      className={`grid h-10 w-10 place-items-center rounded-full bg-brand-500/15
        text-brand-300 transition hover:bg-brand-500/30 active:scale-95 ${className}`}
    >
      <Download size={17} aria-hidden="true" />
    </button>
  );
}

export default InstallButton;
