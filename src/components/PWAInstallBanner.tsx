/**
 * PWAInstallBanner
 *
 * Android / Desktop (beforeinstallprompt):
 *   1. Shows "Install Vibify" card
 *   2. User taps Install → native prompt fires
 *   3. If accepted → animated progress bar fills to 100%
 *   4. "Open App" button appears → tapping it focuses/opens the PWA
 *
 * iOS Safari:
 *   → No install API; shows step-by-step Share → Add to Home Screen guide.
 *
 * Already installed:
 *   → Banner is hidden.
 */

import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, Share, X, Plus, CheckCircle } from 'lucide-react';
import { VibifyLogo } from './VibifyLogo';

// ─── Types ────────────────────────────────────────────────────────────────────

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type BannerState =
  | 'hidden'
  | 'native'       // show install button
  | 'installing'   // progress bar animating
  | 'installed'    // show "Open App" button
  | 'ios-guide';   // iOS Safari manual steps

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isAlreadyInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isIOSSafari(): boolean {
  return (
    isIOS() &&
    /safari/i.test(navigator.userAgent) &&
    !/crios|fxios|opios/i.test(navigator.userAgent)
  );
}

const DISMISS_KEY = 'vibify-pwa-dismissed';
const DEV_FORCE =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('pwa') === '1';

// ─── Component ────────────────────────────────────────────────────────────────

export function PWAInstallBanner({ standalone = false }: { standalone?: boolean }) {
  const [state, setState] = useState<BannerState>('hidden');
  // progress: 0–100
  const [progress, setProgress] = useState(0);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  const bottomCls = standalone ? 'bottom-6 sm:bottom-8' : 'bottom-24 sm:bottom-28';

  useEffect(() => {
    if (!DEV_FORCE && isAlreadyInstalled()) return;
    if (!DEV_FORCE && sessionStorage.getItem(DISMISS_KEY)) return;

    if (isIOSSafari() || (DEV_FORCE && new URLSearchParams(window.location.search).get('pwa') === 'ios')) {
      const t = setTimeout(() => setState('ios-guide'), DEV_FORCE ? 500 : 2500);
      return () => clearTimeout(t);
    }

    if (DEV_FORCE) { setState('native'); return; }

    const handler = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      setState('native');
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Cancel rAF on unmount
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const dismiss = () => {
    setState('hidden');
    sessionStorage.setItem(DISMISS_KEY, '1');
  };

  // Animate progress bar from 0 → 100 over ~2.4 s with easing
  const animateProgress = () => {
    startRef.current = null;
    const DURATION = 2400; // ms

    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(elapsed / DURATION, 1);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(Math.round(eased * 100));

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setState('installed');
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const handleNativeInstall = async () => {
    if (!promptRef.current) return;

    setState('installing');
    setProgress(0);

    await promptRef.current.prompt();
    const { outcome } = await promptRef.current.userChoice;
    promptRef.current = null;

    if (outcome === 'accepted') {
      animateProgress();
    } else {
      // User cancelled — go back to install button
      setState('native');
      setProgress(0);
    }
  };

  const handleOpenApp = () => {
    // Try to focus an existing PWA window first, otherwise open it
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'OPEN_APP' });
    }
    // Fallback: open the start_url in a new tab — OS will route it to the PWA
    window.open('/?source=pwa', '_blank');
    setState('hidden');
  };

  if (state === 'hidden') return null;

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

  // ── Installing — progress bar ──────────────────────────────────────────────
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

        {/* Progress bar */}
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300 transition-none"
            style={{ width: `${progress}%` }}
            aria-hidden="true"
          />
          {/* Shimmer overlay */}
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

  // ── Installed — open button ────────────────────────────────────────────────
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
            {/* Green tick badge */}
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 ring-2 ring-ink-900">
              <CheckCircle size={10} className="text-ink-950" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brand-300">App Installed!</p>
            <p className="text-xs text-ink-400">Vibify is on your home screen</p>
          </div>
          <button
            onClick={handleOpenApp}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-brand-400 active:scale-95"
          >
            <ExternalLink size={12} aria-hidden="true" />
            Open
          </button>
        </div>
      </div>
    );
  }

  // ── Native install prompt (Android / Desktop) ──────────────────────────────
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
            onClick={handleNativeInstall}
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
