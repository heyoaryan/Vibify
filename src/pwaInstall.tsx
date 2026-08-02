/**
 * PWAInstallContext — cross-platform install state
 *
 * Platform coverage:
 *   ✅ Android Chrome / Samsung Internet / Edge  → beforeinstallprompt API; fallback → android-guide
 *   ✅ Android Firefox / Opera / other Android   → android-guide (⋮ → Add to Home Screen)
 *   ✅ iOS Safari                                → Share → Add to Home Screen guide
 *   ✅ iOS Chrome / Firefox / other iOS browsers → same Share guide (Apple restriction)
 *   ✅ macOS / Windows / Linux Chrome / Edge     → beforeinstallprompt API
 *   ✅ macOS Safari (desktop)                    → desktop manual guide
 *   ✅ Desktop Firefox                           → desktop manual guide fallback
 *   ✅ Already installed (any platform)          → nothing shown
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
  | 'checking'        // detection running — show button but state not yet known
  | 'hidden'          // genuinely nothing to show (already installed / unsupported)
  | 'available'       // native prompt ready (Chrome/Edge/Android/Samsung)
  | 'installing'      // progress animation running
  | 'installed'       // show "Open App"
  | 'ios-guide'       // iOS any browser — Share menu steps
  | 'android-guide'   // Android Firefox/Opera/Samsung fallback — ⋮ → Add to Home Screen
  | 'desktop-guide';  // macOS Safari / Desktop Firefox / unsupported — manual steps

// ─── Platform helpers ─────────────────────────────────────────────────────────

function isAlreadyInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

function isDesktopSafari(): boolean {
  return (
    !isIOS() &&
    !isAndroid() &&
    /^((?!chrome|chromium|android).)*safari/i.test(navigator.userAgent)
  );
}

function isFirefox(): boolean {
  return /firefox|fxios/i.test(navigator.userAgent);
}

/** True on any non-iOS, non-Android desktop/laptop environment */
function isDesktop(): boolean {
  return !isIOS() && !isAndroid();
}

// ─── Types ────────────────────────────────────────────────────────────────────

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export type InstallPlatform = 'native' | 'ios' | 'android-manual' | 'desktop-manual';

interface PWAInstallValue {
  state: InstallState;
  progress: number;
  platform: InstallPlatform;
  isDesktopEnv: boolean;
  isChecking: boolean;
  canShowInline: boolean;
  showBannerCard: boolean;
  install: () => void;
  openApp: () => void;
  dismiss: () => void;
  /** Manually show the install guide for the current platform (for the top-bar button). */
  triggerGuide: () => void;
}

const PWAInstallContext = createContext<PWAInstallValue | null>(null);

const DISMISS_KEY = 'vibify-pwa-dismissed';

// Dev query-param overrides: ?pwa=1 | ?pwa=ios | ?pwa=desktop
const DEV_OVERRIDE =
  import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('pwa')
    : null;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PWAInstallProvider({ children }: { children: ReactNode }) {
  const [state, setState]       = useState<InstallState>('checking');
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>('native');

  const promptRef  = useRef<BeforeInstallPromptEvent | null>(null);
  const rafRef     = useRef<number | null>(null);
  const startRef   = useRef<number | null>(null);

  useEffect(() => {
    if (!DEV_OVERRIDE && isAlreadyInstalled()) {
      setState('hidden');
      return;
    }
    if (!DEV_OVERRIDE && sessionStorage.getItem(DISMISS_KEY)) {
      setDismissed(true);
      setState('hidden');
      return;
    }

    // ── Dev overrides ──────────────────────────────────────────────────────
    if (DEV_OVERRIDE === 'ios') {
      setPlatform('ios');
      setTimeout(() => setState('ios-guide'), 500);
      return;
    }
    if (DEV_OVERRIDE === 'desktop') {
      setPlatform('desktop-manual');
      setTimeout(() => setState('desktop-guide'), 500);
      return;
    }
    if (DEV_OVERRIDE === 'android') {
      setPlatform('android-manual');
      setTimeout(() => setState('android-guide'), 500);
      return;
    }
    if (DEV_OVERRIDE === '1') {
      setPlatform('native');
      setState('available');
      return;
    }

    // ── iOS (any browser) — Apple restricts install to Share menu ─────────
    if (isIOS()) {
      setPlatform('ios');
      const t = setTimeout(() => setState('ios-guide'), 2500);
      return () => clearTimeout(t);
    }

    // ── Android ───────────────────────────────────────────────────────────
    if (isAndroid()) {
      const androidFirefox = isFirefox();
      // Firefox on Android has no beforeinstallprompt — show guide immediately
      if (androidFirefox) {
        setPlatform('android-manual');
        const t = setTimeout(() => setState('android-guide'), 2500);
        return () => clearTimeout(t);
      }

      // Chrome / Samsung / Edge on Android → wait for native prompt
      // If it hasn't fired within 4 s, fall back to manual guide
      setPlatform('native');
      let promptReceived = false;
      const handler = (e: Event) => {
        e.preventDefault();
        promptReceived = true;
        promptRef.current = e as BeforeInstallPromptEvent;
        setState('available');
      };
      window.addEventListener('beforeinstallprompt', handler);

      const fallbackTimer = setTimeout(() => {
        if (!promptReceived) {
          // Native prompt didn't fire — browser may have suppressed it
          // (user already dismissed, engagement heuristics not met, etc.)
          // Show the manual guide so mobile users still have a path to install.
          setPlatform('android-manual');
          setState('android-guide');
        }
      }, 4000);

      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
        clearTimeout(fallbackTimer);
      };
    }

    // ── Desktop Safari / Desktop Firefox — no beforeinstallprompt support ─
    if (isDesktopSafari() || isFirefox()) {
      setPlatform('desktop-manual');
      const t = setTimeout(() => setState('desktop-guide'), 2500);
      return () => clearTimeout(t);
    }

    // ── Desktop Chrome / Edge / Samsung — native prompt ───────────────────
    setPlatform('native');
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
    } else if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.active) reg.active.postMessage({ type: 'OPEN_APP' });
      });
    }
    setState('hidden');
  }, []);

  /**
   * Called when the user taps the install button in the top bar.
   * - Native (Android Chrome/Edge): fires the beforeinstallprompt directly.
   *   If the prompt was already dismissed by the browser, shows a fallback guide.
   * - iOS: shows the Share-menu guide card.
   * - Desktop Safari / Firefox / unsupported: shows the desktop guide card.
   */
  const triggerGuide = useCallback(() => {
    if (platform === 'native') {
      if (promptRef.current) {
        // Native prompt available — fire it immediately
        install();
      } else {
        // Prompt was already dismissed or not yet fired
        // Show the right guide based on whether we're on Android or desktop
        setDismissed(false);
        if (isAndroid()) {
          setState('android-guide');
        } else {
          setState('desktop-guide');
        }
      }
    } else if (platform === 'ios') {
      setDismissed(false);
      setState('ios-guide');
    } else if (platform === 'android-manual') {
      setDismissed(false);
      setState('android-guide');
    } else {
      // desktop-manual (macOS Safari, Desktop Firefox, etc.)
      setDismissed(false);
      setState('desktop-guide');
    }
  }, [platform, install]);

  const visible        = !dismissed && state !== 'hidden' && state !== 'checking';
  const canShowInline  = visible && (state === 'available' || state === 'installing' || state === 'installed');
  const showBannerCard = visible && (state === 'ios-guide' || state === 'android-guide' || state === 'desktop-guide');
  const isDesktopEnv   = isDesktop();
  // True while we haven't yet determined if install is possible
  const isChecking     = state === 'checking';

  const value: PWAInstallValue = {
    state, progress, platform,
    isDesktopEnv, isChecking, canShowInline, showBannerCard,
    install, openApp, dismiss, triggerGuide,
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
    return {
      state: 'checking', progress: 0, platform: 'native',
      isDesktopEnv: false, isChecking: true, canShowInline: false, showBannerCard: false,
      install: () => {}, openApp: () => {}, dismiss: () => {}, triggerGuide: () => {},
    };
  }
  return ctx;
}
