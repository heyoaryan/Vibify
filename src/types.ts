export type Song = {
  id: string;
  title: string;
  artist: string;
  album: string;
  /** Year of release */
  year: number;
  /** Duration in seconds */
  duration: number;
  /** Color seed used to generate artwork gradients */
  hue: number;
  /** Second hue for richer gradients */
  hue2: number;
  /** Audio stream URL */
  src: string;
  /** Optional tags / genres */
  genre: string;
  /** Real album art URL from JioSaavn (optional — static songs won't have this) */
  imageUrl?: string;
};

export type Playlist = {
  id: string;
  title: string;
  description: string;
  /** Song ids that belong to the playlist */
  songIds: string[];
  /** Gradient hue seed */
  hue: number;
  hue2: number;
  /** "system" playlists are curated defaults; "user" are created in-app */
  kind: 'system' | 'user';
};

export type RepeatMode = 'off' | 'all' | 'one';

export type View =
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'library' }
  | { name: 'playlist'; id: string }
  | { name: 'nowplaying' }
  | { name: 'account' }
  | { name: 'settings' }
  | { name: 'premium' };

export type NavSection = 'home' | 'search' | 'library';
