/**
 * InstallButton — smart PWA install control for the top bar.
 *
 * Behaviour by platform:
 *   Android (Chrome/Samsung/Edge) — Download icon, tap fires native install prompt
 *   iOS                           — Download icon, tap shows Share→Add to Home Screen guide
 *   macOS / Windows / Linux       — Download icon always visible, tap opens install guide modal
 *
 * States:
 *   available       → Download button (native prompt ready)
 *   installing      → Spinning arc (progress feedback)
 *   installed       → Check icon (done)
 *   ios-guide       → Download icon that re-opens the guide
 *   desktop-guide   → Download icon that re-opens the modal
 *   hidden + desktop→ Download icon that triggers guide on click
 *   hidden + mobile → null (nothing to show)
 */

import { CheckCircle, Download } from 'lucide-react';
import { usePWAInstall } from '../pwaInstall';

export function InstallButton({ className = '' }: { className?: string }) {
  const { canShowInline, isDesktopEnv, state, install, triggerGuide } = usePWAInstall();

  // Already installed — show a faint check mark briefly then nothing
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

  // Installing — spinning arc progress ring
  if (state === 'installing') {
    return (
      <span
        aria-live="polite"
        aria-label="Installing Vibify…"
        className={`relative grid h-10 w-10 place-items-center rounded-full bg-brand-500/15 ${className}`}
      >
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

  // Native prompt available (Android Chrome / Edge / Samsung) — one-tap install
  if (state === 'available') {
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

  // iOS or desktop guide states — icon re-opens the guide
  if (state === 'ios-guide' || state === 'desktop-guide') {
    return (
      <button
        onClick={triggerGuide}
        aria-label="Install Vibify"
        title="Install Vibify"
        className={`grid h-10 w-10 place-items-center rounded-full bg-brand-500/15
          text-brand-300 transition hover:bg-brand-500/30 active:scale-95 ${className}`}
      >
        <Download size={17} aria-hidden="true" />
      </button>
    );
  }

  // State is hidden but we're on desktop — always show the button so users
  // can trigger the install guide at any time from the top bar.
  if (isDesktopEnv && !canShowInline) {
    return (
      <button
        onClick={triggerGuide}
        aria-label="Install Vibify"
        title="Install Vibify"
        className={`grid h-10 w-10 place-items-center rounded-full bg-white/[0.06]
          text-ink-400 transition hover:bg-brand-500/20 hover:text-brand-300 active:scale-95 ${className}`}
      >
        <Download size={17} aria-hidden="true" />
      </button>
    );
  }

  // Mobile with nothing to show
  if (!canShowInline) return null;

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
