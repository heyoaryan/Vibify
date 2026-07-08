import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
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

  const view = history[history.length - 1];
  const navigate = useCallback((next: View) => {
    setHistory((h) => {
      // Avoid pushing duplicate consecutive views
      const last = h[h.length - 1];
      if (JSON.stringify(last) === JSON.stringify(next)) return h;
      return [...h, next];
    });
  }, []);

  const back = useCallback(() => {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  }, []);

  const canGoBack = history.length > 1;

  const value = useMemo(
    () => ({ view, navigate, canGoBack, back }),
    [view, navigate, canGoBack, back],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}
