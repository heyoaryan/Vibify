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
    isPopstateRef.current = true;
    window.history.back();
  }, []);

  const canGoBack = history.length > 1;

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
