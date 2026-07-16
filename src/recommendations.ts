import type { Song } from './types';
import { searchSongs, getArtistSongs, getTrendingSongs } from './saavn';
import { getRecentlyPlayed } from './history';

export type TasteProfile = {
  topArtists: string[];
  playCount: number;
};

export function getTasteProfile(): TasteProfile {
  const recent = getRecentlyPlayed();
  
  if (!recent.length) {
    return { topArtists: [], playCount: 0 };
  }
  
  const scores = new Map<string, { count: number; latest: number }>();
  
  for (const play of recent) {
    const entry = scores.get(play.artist) ?? { count: 0, latest: 0 };
    entry.count++;
    entry.latest = Math.max(entry.latest, play.playedAt);
    scores.set(play.artist, entry);
  }
  
  const topArtists = Array.from(scores.entries())
    .map(([artist, { count, latest }]) => ({
      artist,
      score: count * 10 + (latest / Date.now()) * 5,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(x => x.artist);
  
  return { topArtists, playCount: recent.length };
}

export async function getRecommendations(limit = 20): Promise<Song[]> {
  const profile = getTasteProfile();
  
  if (profile.topArtists.length === 0) {
    return getTrendingSongs(limit);
  }
  
  const perArtist = Math.max(5, Math.ceil(limit / profile.topArtists.length));
  const artists = profile.topArtists.slice(0, 4);
  
  const results = await Promise.all(
    artists.map(a => getArtistSongs(a, perArtist))
  );
  
  const allSongs = results.flat();
  
  const seen = new Set<string>();
  const unique = allSongs.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  
  return unique.slice(0, limit);
}

export async function getSimilarSongs(currentSong: Song, limit = 10): Promise<Song[]> {
  const [byArtist] = await Promise.all([
    getArtistSongs(currentSong.artist, limit + 5),
  ]);
  
  const seen = new Set<string>();
  const unique = byArtist
    .filter(s => s.id !== currentSong.id)
    .filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  
  return unique.slice(0, limit);
}

export async function getQuickRecommendations(currentArtist: string, limit = 10): Promise<Song[]> {
  const profile = getTasteProfile();
  const otherArtists = profile.topArtists
    .filter(a => a !== currentArtist)
    .slice(0, 3);
  
  const artistsToSearch = [currentArtist, ...otherArtists];
  const perArtist = Math.ceil(limit / artistsToSearch.length);
  
  const results = await Promise.all(
    artistsToSearch.map(a => searchSongs(a, perArtist))
  );
  
  const allSongs = results.flat();
  
  const seen = new Set<string>();
  const unique = allSongs.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  
  return unique.slice(0, limit);
}
