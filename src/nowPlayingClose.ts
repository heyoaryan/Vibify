import { createContext, useContext } from 'react';

/**
 * Provides the animated close callback for the NowPlaying overlay.
 * NowPlayingView calls this instead of nav.back() so the slide-down
 * exit animation plays before the overlay unmounts.
 */
export const NowPlayingCloseCtx = createContext<(() => void) | null>(null);

export function useNowPlayingClose(): () => void {
  const fn = useContext(NowPlayingCloseCtx);
  if (!fn) throw new Error('useNowPlayingClose must be used inside NowPlayingOverlay');
  return fn;
}
