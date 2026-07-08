import type { Playlist, Song } from './types';

/**
 * Static fallback songs — used by the curated playlist feature.
 * Home and Search now stream real songs from the JioSaavn API (saavn.sumit.co).
 */
export const songs: Song[] = [
  { id: 's1',  title: 'Midnight Drive',    artist: 'Lumen Atlas',      album: 'Neon Cartography', year: 2023, duration: 372, hue: 210, hue2: 280, genre: 'Electronic', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 's2',  title: 'Paper Planes',      artist: 'The Hollow Coast', album: 'After the Rain',   year: 2022, duration: 426, hue: 150, hue2: 190, genre: 'Indie',       src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 's3',  title: 'Velvet Static',     artist: 'Mara Solene',      album: 'Quiet Cinema',     year: 2024, duration: 290, hue: 340, hue2: 30,  genre: 'Dream Pop',   src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: 's4',  title: 'Glass Towers',      artist: 'Kite Field',       album: 'Architecture',     year: 2021, duration: 303, hue: 200, hue2: 230, genre: 'Synthwave',   src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { id: 's5',  title: 'Sundown Avenue',    artist: 'Coral & June',     album: 'Long Light',       year: 2023, duration: 280, hue: 30,  hue2: 60,  genre: 'Folk',        src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  { id: 's6',  title: 'Northern Lights',   artist: 'Aurora Bay',       album: 'Polar Bloom',      year: 2022, duration: 365, hue: 180, hue2: 260, genre: 'Ambient',     src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
  { id: 's7',  title: 'Echo Chamber',      artist: 'The Hollow Coast', album: 'After the Rain',   year: 2022, duration: 334, hue: 280, hue2: 320, genre: 'Indie',       src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
  { id: 's8',  title: 'Crystal Tide',      artist: 'Mara Solene',      album: 'Quiet Cinema',     year: 2024, duration: 271, hue: 190, hue2: 210, genre: 'Dream Pop',   src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { id: 's9',  title: 'Gravity Pull',      artist: 'Kite Field',       album: 'Architecture',     year: 2021, duration: 341, hue: 260, hue2: 290, genre: 'Synthwave',   src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' },
  { id: 's10', title: 'Golden Hour',       artist: 'Coral & June',     album: 'Long Light',       year: 2023, duration: 292, hue: 45,  hue2: 25,  genre: 'Folk',        src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' },
  { id: 's11', title: 'Deep Currents',     artist: 'Aurora Bay',       album: 'Polar Bloom',      year: 2022, duration: 318, hue: 170, hue2: 200, genre: 'Ambient',     src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3' },
  { id: 's12', title: 'Neon Rain',         artist: 'Lumen Atlas',      album: 'Neon Cartography', year: 2023, duration: 396, hue: 300, hue2: 340, genre: 'Electronic',  src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3' },
];

/**
 * Curated playlists — these reference static song IDs above.
 * Shown in Quick picks, Made for you, Library, and the sidebar.
 */
export const playlists: Playlist[] = [
  {
    id: 'p1',
    title: 'Focus Flow',
    description: 'Steady beats to keep you in the zone.',
    songIds: ['s6', 's11', 's4', 's9', 's1'],
    hue: 180, hue2: 260, kind: 'system',
  },
  {
    id: 'p2',
    title: 'Late Night Drive',
    description: 'Synth-soaked tracks for empty highways.',
    songIds: ['s1', 's4', 's9', 's12', 's6'],
    hue: 260, hue2: 300, kind: 'system',
  },
  {
    id: 'p3',
    title: 'Acoustic Mornings',
    description: 'Warm, sunlit songs to start the day.',
    songIds: ['s5', 's10', 's2', 's8'],
    hue: 30, hue2: 45, kind: 'system',
  },
  {
    id: 'p4',
    title: 'Dream Pop Essentials',
    description: 'Hazy textures and soft reverbs.',
    songIds: ['s3', 's8', 's6', 's11'],
    hue: 340, hue2: 30, kind: 'system',
  },
];

export const ALL_SONGS = songs;
export const ALL_PLAYLISTS = playlists;
