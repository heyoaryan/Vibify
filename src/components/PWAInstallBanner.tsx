/**
 * PWAInstallBanner — bottom-of-screen install guide/card
 *
 * Handles all platforms:
 *   iOS (any browser)     → 3-step Share → Add to Home Screen guide
 *   Desktop Safari        → macOS-specific guide (File menu / Share)
 *   Firefox               → Firefox-specific "Install" steps
 *   Chrome/Edge/Android   → Native install card with icon button + buffer
 *   Installing            → Spinning icon + shimmer progress bar
 *   Installed             → "App Installed!" with Open button
 */

import { CheckCircle, Download, ExternalLink, Globe, Monitor, Plus, Share, Smartphone, X } from 'lucide-react';
import { VibifyLogo } from './VibifyLogo';
import { usePWAInstall } from '../pwaInstall';

export function PWAInstallBanner({ standalone = false }: { standalone?: boolean }) {
  const { state, progress, platform, showBannerCard, install, openApp, dismiss } = usePWAInstall();

  const showCard =
    showBannerCard ||
    (standalone && (state === 'available' || state === 'installing' || state === 'installed'));

  if (!showCard) return null;

  const bottomCls = standalone ? 'bottom-6 sm:bottom-8' : 'bottom-24 sm:bottom-28';
  const cardCls = `fixed ${bottomCls} left-1/2 z-[90] w-[92%] max-w-sm -translate-x-1/2`;

  // ── iOS guide (Safari + Chrome + Firefox on iOS) ─────────────────────────
  if (state === 'ios-guide') {
    return (
      <div role="dialog" aria-modal="false" aria-label="Install Vibify on iOS" className={cardCls}>
        <div className="animate-fade-up rounded-2xl border border-white/10 bg-ink-900/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-3">
            <VibifyLogo size={40} className="shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink-50">Install Vibify</p>
              <p className="flex items-center gap-1 text-xs text-ink-400">
                <Smartphone size={11} /> iPhone / iPad
              </p>
            </div>
            <button onClick={dismiss} aria-label="Dismiss"
              className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.07] text-ink-400 hover:bg-white/10">
              <X size={14} />
            </button>
          </div>

          <ol className="space-y-2.5" aria-label="Installation steps">
            <li className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/20 text-[11px] font-bold text-brand-300">1</span>
              <span className="text-xs text-ink-300">
                Tap the{' '}
                <Share size={12} className="mx-0.5 inline-block align-middle text-brand-300" aria-label="Share" />
                {' '}<strong className="text-ink-100">Share</strong> button in your browser toolbar
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/20 text-[11px] font-bold text-brand-300">2</span>
              <span className="text-xs text-ink-300">
                Scroll and tap{' '}
                <Plus size={12} className="mx-0.5 inline-block align-middle text-brand-300" aria-label="Add" />
                {' '}<strong className="text-ink-100">Add to Home Screen</strong>
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/20 text-[11px] font-bold text-brand-300">3</span>
              <span className="text-xs text-ink-300">
                Tap <strong className="text-ink-100">Add</strong> — Vibify is now on your Home Screen!
              </span>
            </li>
          </ol>

          {/* Down-arrow pointer */}
          <div className="mt-3 flex justify-center">
            <svg width="18" height="10" viewBox="0 0 18 10" fill="none" aria-hidden="true">
              <path d="M1 1l8 8 8-8" stroke="#34dcc2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // ── Desktop manual guide (macOS Safari / Firefox / unsupported) ──────────
  if (state === 'desktop-guide') {
    const isSafari = /^((?!chrome|chromium|android).)*safari/i.test(navigator.userAgent);
    const isFirefox = /firefox/i.test(navigator.userAgent);

    return (
      <div role="dialog" aria-modal="false" aria-label="Install Vibify on desktop" className={cardCls}>
        <div className="animate-fade-up rounded-2xl border border-white/10 bg-ink-900/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-3">
            <VibifyLogo size={40} className="shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink-50">Install Vibify</p>
              <p className="flex items-center gap-1 text-xs text-ink-400">
                <Monitor size={11} />
                {isSafari ? 'macOS Safari' : isFirefox ? 'Firefox' : 'Desktop browser'}
              </p>
            </div>
            <button onClick={dismiss} aria-label="Dismiss"
              className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.07] text-ink-400 hover:bg-white/10">
              <X size={14} />
            </button>
          </div>

          <ol className="space-y-2.5" aria-label="Installation steps">
            {isSafari ? (
              <>
                <li className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/20 text-[11px] font-bold text-brand-300">1</span>
                  <span className="text-xs text-ink-300">
                    In the menu bar, click <strong className="text-ink-100">File</strong>
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/20 text-[11px] font-bold text-brand-300">2</span>
                  <span className="text-xs text-ink-300">
                    Click <strong className="text-ink-100">Add to Dock…</strong>{' '}
                    <span className="text-ink-500">(Safari 17+)</span>
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/20 text-[11px] font-bold text-brand-300">3</span>
                  <span className="text-xs text-ink-300">
                    Click <strong className="text-ink-100">Add</strong> — Vibify appears in your Dock!
                  </span>
                </li>
              </>
            ) : isFirefox ? (
              <>
                <li className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/20 text-[11px] font-bold text-brand-300">1</span>
                  <span className="text-xs text-ink-300">
                    Click the{' '}
                    <Globe size={12} className="mx-0.5 inline-block align-middle text-brand-300" />
                    {' '}icon in the address bar
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/20 text-[11px] font-bold text-brand-300">2</span>
                  <span className="text-xs text-ink-300">
                    Select <strong className="text-ink-100">Install</strong> or use{' '}
                    <strong className="text-ink-100">Tools → Install This Site as an App</strong>
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/20 text-[11px] font-bold text-brand-300">3</span>
                  <span className="text-xs text-ink-300">
                    Confirm — Vibify opens as a standalone app!
                  </span>
                </li>
              </>
            ) : (
              <>
                <li className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/20 text-[11px] font-bold text-brand-300">1</span>
                  <span className="text-xs text-ink-300">
                    Open this page in <strong className="text-ink-100">Chrome</strong> or <strong className="text-ink-100">Edge</strong> for the best install experience
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/20 text-[11px] font-bold text-brand-300">2</span>
                  <span className="text-xs text-ink-300">
                    Click the <Download size={12} className="mx-0.5 inline-block align-middle text-brand-300" /> install icon in the address bar
                  </span>
                </li>
              </>
            )}
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

  // ── Installing — spinning icon + shimmer progress bar ────────────────────
  if (state === 'installing') {
    return (
      <div role="status" aria-label="Installing Vibify" aria-live="polite"
        className={`${cardCls} rounded-2xl border border-white/10 bg-ink-900/95 px-4 py-4 shadow-2xl shadow-black/60 backdrop-blur-xl animate-fade-up`}>

        <div className="flex items-center gap-3 mb-3.5">
          <div className="relative shrink-0 h-10 w-10">
            <svg className="absolute inset-0 animate-spin" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
              <path d="M20 4 A16 16 0 0 1 36 20" stroke="#14c4ad" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <Download size={15} className="text-brand-300" aria-hidden="true" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-50">Installing Vibify…</p>
            <p className="text-xs text-ink-400">
              {platform === 'ios' ? 'Adding to Home Screen' : 'Adding to your device'}
            </p>
          </div>
          <span className="shrink-0 text-sm font-bold tabular-nums text-brand-400">{progress}%</span>
        </div>

        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300"
            style={{ width: `${progress}%`, transition: 'width 0.1s linear' }} aria-hidden="true" />
          <div className="absolute inset-0 rounded-full" aria-hidden="true"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)',
              animation: 'pwaShimmer 1.1s ease-in-out infinite',
            }} />
        </div>

        <style>{`
          @keyframes pwaShimmer {
            0%   { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    );
  }

  // ── Installed ─────────────────────────────────────────────────────────────
  if (state === 'installed') {
    return (
      <div role="status" aria-live="polite" aria-label="Vibify installed"
        className={`${cardCls} rounded-2xl border border-brand-500/30 bg-ink-900/95 px-4 py-3.5 shadow-2xl shadow-black/60 backdrop-blur-xl animate-fade-up`}>
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <VibifyLogo size={40} />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 ring-2 ring-ink-900">
              <CheckCircle size={10} className="text-ink-950" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brand-300">App Installed!</p>
            <p className="text-xs text-ink-400">Vibify is ready on your device</p>
          </div>
          <button onClick={openApp}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-brand-400 active:scale-95">
            <ExternalLink size={12} aria-hidden="true" />
            Open
          </button>
        </div>
      </div>
    );
  }

  // ── Native install prompt (Chrome / Edge / Android / Samsung) ────────────
  return (
    <div role="dialog" aria-modal="false" aria-label="Install Vibify"
      className={`${cardCls} rounded-2xl border border-white/10 bg-ink-900/95 px-4 py-3.5 shadow-2xl shadow-black/60 backdrop-blur-xl animate-fade-up`}>
      <div className="flex items-center gap-3">
        <VibifyLogo size={40} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-50">Install Vibify</p>
          <p className="text-xs text-ink-400">Works offline · feels like a native app</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={install} aria-label="Install Vibify" title="Install Vibify"
            className="relative grid h-10 w-10 place-items-center rounded-full bg-brand-500 text-ink-950 transition hover:bg-brand-400 active:scale-95">
            <Download size={17} aria-hidden="true" />
          </button>
          <button onClick={dismiss} aria-label="Dismiss install banner"
            className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.07] text-ink-400 hover:bg-white/10">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PWAInstallBanner;
