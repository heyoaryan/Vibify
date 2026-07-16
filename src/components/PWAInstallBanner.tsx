/**
 * PWAInstallBanner
 *
 * Bottom-of-screen card for PWA install. Two modes:
 *
 *  - Default (in app shell): only renders the iOS Safari manual guide, because
 *    the actual Install button lives inline (sidebar on desktop, top bar on
 *    mobile) via <InstallButton />.
 *
 *  - standalone (login screen): no inline button exists, so the native
 *    Install / Installing / Installed card is also shown here.
 *
 *  iOS Safari (all modes): shows the step-by-step Share → Add to Home Screen
 *  guide, since there is no install API.
 */

import { CheckCircle, Download, ExternalLink, Plus, Share, X } from 'lucide-react';
import { VibifyLogo } from './VibifyLogo';
import { usePWAInstall } from '../pwaInstall';

export function PWAInstallBanner({ standalone = false }: { standalone?: boolean }) {
  const { state, progress, showBannerCard, install, openApp, dismiss } = usePWAInstall();

  // In-app: only the iOS guide goes in the banner (inline button handles the rest).
  // standalone: also show the native install/installing/installed card.
  const showCard =
    showBannerCard ||
    (standalone && (state === 'available' || state === 'installing' || state === 'installed'));

  if (!showCard) return null;

  const bottomCls = standalone ? 'bottom-6 sm:bottom-8' : 'bottom-24 sm:bottom-28';

  // ── iOS guide ──────────────────────────────────────────────────────────────
  if (state === 'ios-guide') {
    return (
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Install Vibify on your iPhone"
        className={`fixed ${bottomCls} left-1/2 z-[90] w-[92%] max-w-sm -translate-x-1/2`}
      >
        <div className="rounded-2xl border border-white/10 bg-ink-900/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-3">
            <VibifyLogo size={40} className="shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink-50">Install Vibify</p>
              <p className="text-xs text-ink-400">Add to your Home Screen</p>
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.07] text-ink-400 hover:bg-white/10"
            >
              <X size={14} />
            </button>
          </div>
          <ol className="space-y-2.5" aria-label="Installation steps">
            <li className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/20 text-[11px] font-bold text-brand-300">1</span>
              <span className="text-xs text-ink-300">
                Tap the <Share size={12} className="mx-0.5 inline-block align-middle text-brand-300" aria-label="Share" /> <strong className="text-ink-100">Share</strong> button at the bottom of Safari
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/20 text-[11px] font-bold text-brand-300">2</span>
              <span className="text-xs text-ink-300">
                Scroll down and tap <Plus size={12} className="mx-0.5 inline-block align-middle text-brand-300" aria-label="Add" /> <strong className="text-ink-100">Add to Home Screen</strong>
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/20 text-[11px] font-bold text-brand-300">3</span>
              <span className="text-xs text-ink-300">
                Tap <strong className="text-ink-100">Add</strong> — done! Open Vibify from your Home Screen.
              </span>
            </li>
          </ol>
          <div className="mt-3 flex justify-center">
            <svg width="18" height="10" viewBox="0 0 18 10" fill="none" aria-hidden="true">
              <path d="M1 1l8 8 8-8" stroke="#34dcc2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // ── Installing — progress bar (standalone only) ────────────────────────────
  if (state === 'installing') {
    return (
      <div
        role="status"
        aria-label="Installing Vibify"
        aria-live="polite"
        className={`fixed ${bottomCls} left-1/2 z-[90] w-[92%] max-w-sm -translate-x-1/2 rounded-2xl border border-white/10 bg-ink-900/95 px-4 py-3.5 shadow-2xl shadow-black/60 backdrop-blur-xl`}
      >
        <div className="flex items-center gap-3 mb-3">
          <VibifyLogo size={40} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-50">Installing Vibify…</p>
            <p className="text-xs text-ink-400">Adding to your home screen</p>
          </div>
          <span className="shrink-0 text-sm font-bold tabular-nums text-brand-400">
            {progress}%
          </span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300 transition-none"
            style={{ width: `${progress}%` }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
              animation: 'progressShimmer 1.2s ease-in-out infinite',
            }}
            aria-hidden="true"
          />
        </div>
        <style>{`
          @keyframes progressShimmer {
            0%   { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    );
  }

  // ── Installed — open button (standalone only) ──────────────────────────────
  if (state === 'installed') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Vibify installed"
        className={`fixed ${bottomCls} left-1/2 z-[90] w-[92%] max-w-sm -translate-x-1/2 rounded-2xl border border-brand-500/30 bg-ink-900/95 px-4 py-3.5 shadow-2xl shadow-black/60 backdrop-blur-xl animate-fade-up`}
      >
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <VibifyLogo size={40} />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 ring-2 ring-ink-900">
              <CheckCircle size={10} className="text-ink-950" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brand-300">App Installed!</p>
            <p className="text-xs text-ink-400">Vibify is on your home screen</p>
          </div>
          <button
            onClick={openApp}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-brand-400 active:scale-95"
          >
            <ExternalLink size={12} aria-hidden="true" />
            Open
          </button>
        </div>
      </div>
    );
  }

  // ── Native install prompt (standalone only) ────────────────────────────────
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Install Vibify"
      className={`fixed ${bottomCls} left-1/2 z-[90] w-[92%] max-w-sm -translate-x-1/2 rounded-2xl border border-white/10 bg-ink-900/95 px-4 py-3.5 shadow-2xl shadow-black/60 backdrop-blur-xl`}
    >
      <div className="flex items-center gap-3">
        <VibifyLogo size={40} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-50">Install Vibify</p>
          <p className="text-xs text-ink-400">Add to home screen — works offline too</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={install}
            className="flex items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-brand-400 active:scale-95"
          >
            <Download size={13} aria-hidden="true" />
            Install
          </button>
          <button
            onClick={dismiss}
            aria-label="Dismiss install banner"
            className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.07] text-ink-400 hover:bg-white/10"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PWAInstallBanner;
