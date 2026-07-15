/**
 * useLyrics — global lyrics state hook
 *
 * Starts fetching immediately when `current` song changes in the player,
 * regardless of whether the lyrics panel is open. Results are cached in
 * lyricsApi so the second call (when panel opens) is instant.
 *
 * Usage:
 *   const { lines, status } = useLyrics();
 */

import { useEffect, useRef, useState } from 'react';
import { usePlayer } from './player';
import { fetchLyrics, type LyricsFetchStatus } from './lyricsApi';
import type { LyricLine } from './lyrics';

export type LyricsState = {
  lines:  LyricLine[];
  status: LyricsFetchStatus;
};

export function useLyrics(): LyricsState {
  const { current } = usePlayer();

  const [state, setState] = useState<LyricsState>({ lines: [], status: 'idle' });

  // Track which song id we fetched last — prevents double-fetching on re-renders
  const fetchedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!current) {
      setState({ lines: [], status: 'idle' });
      fetchedIdRef.current = null;
      return;
    }

    // Already fetched for this exact song — don't re-fetch
    if (fetchedIdRef.current === current.id) return;

    fetchedIdRef.current = current.id;
    setState({ lines: [], status: 'loading' });

    fetchLyrics(current.id, current.title, current.artist)
      .then(result => {
        // Guard: song may have changed while we were awaiting
        if (fetchedIdRef.current !== current.id) return;
        setState(result);
      })
      .catch(() => {
        if (fetchedIdRef.current !== current.id) return;
        setState({ lines: [], status: 'none' });
      });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
