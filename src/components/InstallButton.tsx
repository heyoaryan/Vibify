/**
 * InstallButton — inline PWA install control.
 *
 * Renders:
 *   - an "Install" button when the app can be installed,
 *   - a disabled "Installing…" pill while the progress bar animates,
 *   - an "Open" button once installed.
 *
 * Visibility is driven by the shared PWA install context, so it only appears
 * when the app is actually installable (Android/Desktop beforeinstallprompt,
 * or iOS after the guide is dismissed). Used in the desktop sidebar
 * (IconRail) and the mobile/tablet top bar (TopBar).
 */

import { CheckCircle, Download, Loader2 } from 'lucide-react';
import { usePWAInstall } from '../pwaInstall';

export function InstallButton({ className = '' }: { className?: string }) {
  const { canShowInline, state, install, openApp } = usePWAInstall();

  if (!canShowInline) return null;

  if (state === 'installing') {
    return (
      <span
        className={`flex items-center justify-center gap-1.5 rounded-xl bg-brand-500/15 px-3 py-2.5 text-sm font-semibold text-brand-300 ${className}`}
        aria-live="polite"
      >
        <Loader2 size={15} className="animate-spin" />
        Installing…
      </span>
    );
  }

  if (state === 'installed') {
    return (
      <button
        onClick={openApp}
        aria-label="Open installed app"
        className={`flex items-center justify-center gap-1.5 rounded-xl bg-brand-500/15 px-3 py-2.5 text-sm font-semibold text-brand-300 transition hover:bg-brand-500/25 active:scale-95 ${className}`}
      >
        <CheckCircle size={15} />
        Open
      </button>
    );
  }

  return (
    <button
      onClick={install}
      aria-label="Install Vibify"
      title="Install Vibify"
      className={`flex items-center justify-center gap-1.5 rounded-xl bg-brand-500/15 px-3 py-2.5 text-sm font-semibold text-brand-300 transition hover:bg-brand-500/25 active:scale-95 ${className}`}
    >
      <Download size={15} />
      Install
    </button>
  );
}

export default InstallButton;
