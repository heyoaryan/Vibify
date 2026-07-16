/**
 * InstalledToast — centered "App Installed!" popup shown on every screen
 * once the PWA install completes. Works across all screen sizes.
 */

import { CheckCircle } from 'lucide-react';
import { VibifyLogo } from './VibifyLogo';
import { usePWAInstall } from '../pwaInstall';

export function InstalledToast() {
  const { state } = usePWAInstall();

  if (state !== 'installed') return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        role="status"
        aria-live="polite"
        aria-label="Vibify installed"
        className="pointer-events-auto w-full max-w-xs animate-fade-up rounded-3xl border border-brand-500/30 bg-ink-900/95 px-6 py-7 text-center shadow-2xl shadow-black/60 backdrop-blur-xl"
      >
        <div className="relative mx-auto mb-4 w-fit">
          <VibifyLogo size={56} />
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 ring-2 ring-ink-900">
            <CheckCircle size={13} className="text-ink-950" />
          </span>
        </div>
        <p className="text-base font-semibold text-brand-300">App Installed!</p>
        <p className="mt-0.5 text-xs text-ink-400">Vibify is on your home screen</p>
        {/* Non-clickable label — the PWA opens automatically via the SW */}
        <span className="mx-auto mt-5 flex w-fit items-center justify-center gap-1.5 rounded-full bg-brand-500/15 px-5 py-2.5 text-sm font-semibold text-brand-300">
          Open App
        </span>
      </div>
    </div>
  );
}

export default InstalledToast;
