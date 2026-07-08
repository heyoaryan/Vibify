import { useEffect, useState } from 'react';

type UserProfile = {
  name: string;
  email: string;
  phone?: string;
  isGuest: boolean;
  recentActivity?: Array<Record<string, any>>;
  stats?: Array<Record<string, any>>;
};

const defaultGuestUser: UserProfile = {
  name: 'Guest User',
  email: 'guest@arsiththunes.local',
  isGuest: true,
  recentActivity: [],
  stats: [],
};

const GUEST_LIMIT = 5;
const GUEST_WINDOW_MS = 60 * 60 * 1000;
const STORAGE_KEY = 'arsith-user';
const GUEST_PLAYBACK_KEY = 'arsith-guest-playback';

let currentUserState: UserProfile = loadUserFromStorage();
let guestPlaybackState = loadGuestPlaybackState();
const listeners = new Set<() => void>();

function loadUserFromStorage(): UserProfile {
  if (typeof window === 'undefined') return { ...defaultGuestUser };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultGuestUser };
    const parsed = JSON.parse(raw);
    return { ...defaultGuestUser, ...parsed, isGuest: Boolean(parsed.isGuest) };
  } catch {
    return { ...defaultGuestUser };
  }
}

function loadGuestPlaybackState() {
  if (typeof window === 'undefined') return { count: 0, startedAt: 0 };
  try {
    const raw = window.localStorage.getItem(GUEST_PLAYBACK_KEY);
    if (!raw) return { count: 0, startedAt: 0 };
    const parsed = JSON.parse(raw);
    return { count: Number(parsed.count) || 0, startedAt: Number(parsed.startedAt) || 0 };
  } catch {
    return { count: 0, startedAt: 0 };
  }
}

function persistUser() {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUserState));
  }
}

function persistGuestPlaybackState() {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(GUEST_PLAYBACK_KEY, JSON.stringify(guestPlaybackState));
  }
}

function resetGuestPlaybackIfNeeded() {
  const now = Date.now();
  if (!guestPlaybackState.startedAt) {
    guestPlaybackState = { count: 0, startedAt: now };
    persistGuestPlaybackState();
    return;
  }
  if (now - guestPlaybackState.startedAt > GUEST_WINDOW_MS) {
    guestPlaybackState = { count: 0, startedAt: now };
    persistGuestPlaybackState();
  }
}

export function getCurrentUser(): UserProfile {
  return currentUserState;
}

export function useCurrentUser() {
  const [user, setUser] = useState<UserProfile>(getCurrentUser());
  useEffect(() => {
    const listener = () => setUser(getCurrentUser());
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);
  return user;
}

export function signIn(user: Partial<UserProfile>) {
  currentUserState = {
    ...defaultGuestUser,
    ...user,
    isGuest: false,
    recentActivity: currentUserState.recentActivity || [],
    stats: currentUserState.stats || [],
  };
  persistUser();
  notify();
}

export function signOut() {
  currentUserState = {
    ...defaultGuestUser,
    recentActivity: [],
    stats: [],
    isGuest: true,
  };
  guestPlaybackState = { count: 0, startedAt: Date.now() };
  persistUser();
  persistGuestPlaybackState();
  notify();
}

export function isGuestUser() {
  return currentUserState.isGuest;
}

export function getGuestPlaybackStatus() {
  resetGuestPlaybackIfNeeded();
  const remaining = Math.max(0, GUEST_LIMIT - guestPlaybackState.count);
  const resetAt = guestPlaybackState.startedAt + GUEST_WINDOW_MS;
  return { remaining, resetAt, limit: GUEST_LIMIT };
}

export function canGuestPlaySong() {
  if (!isGuestUser()) return true;
  resetGuestPlaybackIfNeeded();
  return guestPlaybackState.count < GUEST_LIMIT;
}

export function consumeGuestPlayback() {
  if (!isGuestUser()) return true;
  resetGuestPlaybackIfNeeded();
  if (guestPlaybackState.count >= GUEST_LIMIT) return false;
  guestPlaybackState = {
    count: guestPlaybackState.count + 1,
    startedAt: guestPlaybackState.startedAt || Date.now(),
  };
  persistGuestPlaybackState();
  return true;
}

function notify() {
  listeners.forEach((listener) => listener());
}
