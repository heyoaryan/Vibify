import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from 'react';

import type { View } from './types';

type NavContextValue = {
  view: View;
  navigate: (view: View) => void;
  /** History stack for back navigation */
  canGoBack: boolean;
  back: () => void;
};

const NavContext = createContext<NavContextValue | null>(null);

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within <NavProvider>');
  return ctx;
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<View[]>([{ name: 'home' }]);
  const isPopstateRef = useRef(false);
  const currentViewRef = useRef<View>({ name: 'home' });
  const lastBackPressRef = useRef<number>(0);

  const view = history[history.length - 1];
  currentViewRef.current = view;

  const navigate = useCallback((next: View) => {
    setHistory((h) => {
      const last = h[h.length - 1];
      if (JSON.stringify(last) === JSON.stringify(next)) return h;
      const newHistory = [...h, next];
      if (!isPopstateRef.current) {
        window.history.pushState({ view: next }, '');
      }
      isPopstateRef.current = false;
      return newHistory;
    });
  }, []);

  const back = useCallback(() => {
    // If already on home, check for double back to exit
    if (view.name === 'home') {
      const now = Date.now();
      const timeSinceLastBack = now - lastBackPressRef.current;
      
      // If pressed within 2 seconds, allow browser back (exit app)
      if (timeSinceLastBack < 2000) {
        isPopstateRef.current = true;
        window.history.back();
        lastBackPressRef.current = 0;
      } else {
        // First back press on home - show toast and record time
        lastBackPressRef.current = now;
        
        // Show toast notification
        const toastId = 'exit-toast';
        let existing = document.getElementById(toastId);
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl bg-ink-800/95 backdrop-blur-xl border border-white/10 text-white text-sm font-medium shadow-xl animate-fade-up';
        toast.textContent = 'Press back again to exit';
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 2000);
      }
    } else {
      // Not on home - navigate to home
      navigate({ name: 'home' });
      lastBackPressRef.current = 0;
    }
  }, [view.name, navigate]);

  const canGoBack = history.length > 1 && view.name !== 'home';

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const stateView = e.state?.view;
      if (stateView) {
        isPopstateRef.current = true;
        setHistory((h) => {
          for (let i = h.length - 1; i >= 0; i--) {
            if (JSON.stringify(h[i]) === JSON.stringify(stateView)) {
              return h.slice(0, i + 1);
            }
          }
          return [stateView];
        });
      } else {
        const current = currentViewRef.current;
        window.history.replaceState({ view: current }, '');
      }
    };

    window.history.replaceState({ view: { name: 'home' } }, '');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const value = useMemo(
    () => ({ view, navigate, canGoBack, back }),
    [view, navigate, canGoBack, back],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}
