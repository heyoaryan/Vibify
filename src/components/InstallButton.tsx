/**
 * InstallButton — smart PWA install control for the top bar.
 *
 * Behaviour by platform:
 *   Android Chrome/Samsung/Edge — Download icon, tap fires native install prompt
 *   Android Firefox/Opera       — Download icon, tap shows ⋮ → Add to Home Screen guide
 *   iOS                         — Download icon, tap shows Share→Add to Home Screen guide
 *   macOS / Windows / Linux     — Download icon always visible, tap opens install guide modal
 *
 * Visibility rules:
 *   hidden (already installed)  → null on mobile; faint icon on desktop (can re-open guide)
 *   checking                    → icon visible immediately — no flash-in after delay
 *   available/guide/installing  → icon always visible with appropriate action
 *   installed                   → check icon briefly
 */

import { CheckCircle, Download } from 'lucide-react';
import { usePWAInstall } from '../pwaInstall';

export function InstallButton({ className = '' }: { className?: string }) {
  const { isDesktopEnv, isChecking, state, install, triggerGuide } = usePWAInstall();

  // ── App already installed ────────────────────────────────────────────────
  if (state === 'hidden') {
    // Desktop: keep the icon so users can manually re-trigger the guide
    if (isDesktopEnv) {
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
    // Mobile: app is installed / not installable — hide
    return null;
  }

  // ── Installed confirmation ────────────────────────────────────────────────
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

  // ── Installing — spinning arc progress ring ───────────────────────────────
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

  // ── Native prompt ready (Android Chrome / Edge / Samsung) ────────────────
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

  // ── Guide states (ios / android / desktop) — re-opens guide on tap ───────
  if (state === 'ios-guide' || state === 'android-guide' || state === 'desktop-guide') {
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

  // ── Checking state — detection running ───────────────────────────────────
  // Show the button immediately so it doesn't flash in after the 2.5s delay.
  // triggerGuide will fire the right action once state resolves.
  if (isChecking) {
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

  return null;
}

export default InstallButton;
