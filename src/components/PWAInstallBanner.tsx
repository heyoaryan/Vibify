/**
 * PWAInstallBanner
 *
 * Shows a contextual "Install Vibify" prompt that works on every platform:
 *
 *  Android / Chrome / Edge / Samsung Internet
 *    → Uses the native beforeinstallprompt API — one-tap install button.
 *
 *  iOS / iPadOS (Safari)
 *    → beforeinstallprompt never fires on WebKit; we detect iOS + non-standalone
 *      and show a step-by-step "Add to Home Screen" guide instead.
 *
 *  macOS (Chrome / Edge / Brave)
 *    → Same beforeinstallprompt path as Android; shows install button.
 *
 *  Already installed (any platform)
 *    → display-mode: standalone OR navigator.standalone — banner is hidden.
 *
 *  Dismissed
 *    → Stored in sessionStorage so it doesn't pop up again this session.
 *      On next visit it may show again (intentional — no permanent cookie spam).
 */

import { useEffect, useRef, useState } from 'react';
import { Download, Share, X, Plus } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type BannerMode =
  | 'hidden'          // not shown
  | 'native'          // Android / Desktop — native prompt available
  | 'ios-guide';      // iOS Safari — manual "Share → Add to Home Screen"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isAlreadyInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  // Covers iPhone, iPad (both old UA and new iPad UA), iPod
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isIOSSafari(): boolean {
  // WebKit on iOS — not Chrome/Firefox for iOS (they can't install PWAs either,
  // but Safari is the only one that can add to home screen)
  return isIOS() && /safari/i.test(navigator.userAgent) && !/crios|fxios|opios/i.test(navigator.userAgent);
}

const DISMISS_KEY = 'vibify-pwa-dismissed';

// In development, force-show the banner by adding ?pwa=1 to the URL
const DEV_FORCE =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('pwa') === '1';

// ─── Component ────────────────────────────────────────────────────────────────

export function PWAInstallBanner({ standalone = false }: { standalone?: boolean }) {
  const [mode, setMode] = useState<BannerMode>('hidden');
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  // bottom class: when standalone=true (login page, no player bar) use bottom-6,
  // otherwise bottom-24 to sit above the player bar
  const bottomCls = standalone ? 'bottom-6 sm:bottom-8' : 'bottom-24 sm:bottom-28';

  useEffect(() => {
    // Already running as PWA — never show (skip in forced dev preview)
    if (!DEV_FORCE && isAlreadyInstalled()) return;

    // User dismissed it this session — don't nag (skip in forced dev preview)
    if (!DEV_FORCE && sessionStorage.getItem(DISMISS_KEY)) return;

    // iOS Safari path — no API, show manual guide
    if (isIOSSafari() || (DEV_FORCE && new URLSearchParams(window.location.search).get('pwa') === 'ios')) {
      const t = setTimeout(() => setMode('ios-guide'), DEV_FORCE ? 500 : 2500);
      return () => clearTimeout(t);
    }

    // Dev force-preview: show native banner immediately
    if (DEV_FORCE) {
      setMode('native');
      return;
    }

    // Android / Desktop — wait for the browser's beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      setMode('native');
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    setMode('hidden');
    sessionStorage.setItem(DISMISS_KEY, '1');
  };

  const handleNativeInstall = async () => {
    if (!promptRef.current) return;
    await promptRef.current.prompt();
    const { outcome } = await promptRef.current.userChoice;
    if (outcome === 'accepted') {
      setMode('hidden');
      promptRef.current = null;
    }
  };

  if (mode === 'hidden') return null;

  // ── iOS guide ──────────────────────────────────────────────────────────────
  if (mode === 'ios-guide') {
    return (
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Install Vibify on your iPhone"
        className={`fixed ${bottomCls} left-1/2 z-[90] w-[92%] max-w-sm -translate-x-1/2`}
      >
        <div className="rounded-2xl border border-white/10 bg-ink-900/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl">
          {/* Header */}
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 19V6l12-3v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-950"/>
                <circle cx="6" cy="19" r="3" fill="currentColor" className="text-ink-950"/>
                <circle cx="18" cy="16" r="3" fill="currentColor" className="text-ink-950"/>
              </svg>
            </div>
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

          {/* Steps */}
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

          {/* Pointer arrow pointing down toward Safari tab bar */}
          <div className="mt-3 flex justify-center">
            <svg width="18" height="10" viewBox="0 0 18 10" fill="none" aria-hidden="true">
              <path d="M1 1l8 8 8-8" stroke="#34d9b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
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
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 19V6l12-3v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-950"/>
            <circle cx="6" cy="19" r="3" fill="currentColor" className="text-ink-950"/>
            <circle cx="18" cy="16" r="3" fill="currentColor" className="text-ink-950"/>
          </svg>
        </div>
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
