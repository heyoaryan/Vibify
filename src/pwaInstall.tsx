/**
 * PWAInstallContext
 *
 * Shared PWA install state + actions so that:
 *   - the bottom Install banner (Android/Desktop/iOS guide) and
 *   - inline Install buttons (sidebar on desktop, top bar on mobile)
 * all stay in sync from a single source of truth.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { InstalledToast } from './components/InstalledToast';

export type InstallState =
  | 'hidden'       // nothing to show
  | 'available'    // install button can be shown
  | 'installing'   // progress bar animating
  | 'installed'    // show "Open App"
  | 'ios-guide';   // iOS Safari manual steps

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

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

interface PWAInstallValue {
  state: InstallState;
  progress: number;
  canShowInline: boolean;        // true when an inline Install button should render
  showBannerCard: boolean;       // true when the bottom card/guide should render
  install: () => void;           // click handler for inline or card Install button
  openApp: () => void;           // click handler for "Open App"
  dismiss: () => void;           // hide banner + inline button for this session
}

const PWAInstallContext = createContext<PWAInstallValue | null>(null);

export function PWAInstallProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<InstallState>('hidden');
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!DEV_FORCE && isAlreadyInstalled()) return;
    if (!DEV_FORCE && sessionStorage.getItem(DISMISS_KEY)) {
      setDismissed(true);
      return;
    }

    if (isIOSSafari() || (DEV_FORCE && new URLSearchParams(window.location.search).get('pwa') === 'ios')) {
      const t = setTimeout(() => setState('ios-guide'), DEV_FORCE ? 500 : 2500);
      return () => clearTimeout(t);
    }

    if (DEV_FORCE) { setState('available'); return; }

    const handler = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      setState('available');
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const dismiss = useCallback(() => {
    setState('hidden');
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, '1');
  }, []);

  const animateProgress = useCallback(() => {
    startRef.current = null;
    const DURATION = 2400;
    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(elapsed / DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(Math.round(eased * 100));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setState('installed');
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const install = useCallback(() => {
    if (!promptRef.current) return;
    setState('installing');
    setProgress(0);
    void (async () => {
      await promptRef.current!.prompt();
      const { outcome } = await promptRef.current!.userChoice;
      promptRef.current = null;
      if (outcome === 'accepted') {
        animateProgress();
      } else {
        setState('available');
        setProgress(0);
      }
    })();
  }, [animateProgress]);

  const openApp = useCallback(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'OPEN_APP' });
    }
    window.open('/?source=pwa', '_blank');
    setState('hidden');
  }, []);

  const visible = !dismissed && state !== 'hidden';
  const canShowInline = visible && (state === 'available' || state === 'installed' || state === 'installing');
  const showBannerCard = visible && state === 'ios-guide';

  const value: PWAInstallValue = {
    state,
    progress,
    canShowInline,
    showBannerCard,
    install,
    openApp,
    dismiss,
  };

  return (
    <PWAInstallContext.Provider value={value}>
      {children}
      <InstalledToast />
    </PWAInstallContext.Provider>
  );
}

export function usePWAInstall(): PWAInstallValue {
  const ctx = useContext(PWAInstallContext);
  if (!ctx) {
    // Safe no-op fallback if used outside the provider.
    return {
      state: 'hidden',
      progress: 0,
      canShowInline: false,
      showBannerCard: false,
      install: () => {},
      openApp: () => {},
      dismiss: () => {},
    };
  }
  return ctx;
}
