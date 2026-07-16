/**
 * auth.ts — Vibify authentication layer
 *
 * Wraps Supabase Auth so the rest of the app uses a simple, stable API:
 *   useCurrentUser()      → reactive UserProfile (works for both guest & signed-in)
 *   useIsLoggedIn()       → boolean
 *   signInWithGoogle()    → OAuth redirect
 *   signInWithPhone()     → send OTP
 *   verifyOtp()           → verify OTP and sign in
 *   signOut()             → clear session
 *   canGuestPlaySong()    → guest playback gate
 *   consumeGuestPlayback()→ guest playback counter
 *
 * Supabase handles token refresh, session persistence, and the OAuth callback
 * automatically via detectSessionInUrl: true in the client config.
 */

import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  isGuest: boolean;
};

// ─── Guest state ──────────────────────────────────────────────────────────────

const GUEST_LIMIT = 5;
const GUEST_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const GUEST_PLAYBACK_KEY = 'vibify-guest-playback';

type GuestPlayback = { count: number; startedAt: number };

function loadGuestPlayback(): GuestPlayback {
  try {
    const raw = localStorage.getItem(GUEST_PLAYBACK_KEY);
    if (!raw) return { count: 0, startedAt: 0 };
    const p = JSON.parse(raw);
    return { count: Number(p.count) || 0, startedAt: Number(p.startedAt) || 0 };
  } catch {
    return { count: 0, startedAt: 0 };
  }
}

function saveGuestPlayback(s: GuestPlayback) {
  localStorage.setItem(GUEST_PLAYBACK_KEY, JSON.stringify(s));
}

function resetGuestIfStale(s: GuestPlayback): GuestPlayback {
  const now = Date.now();
  if (!s.startedAt || now - s.startedAt > GUEST_WINDOW_MS) {
    const fresh = { count: 0, startedAt: now };
    saveGuestPlayback(fresh);
    return fresh;
  }
  return s;
}

// ─── Internal state ───────────────────────────────────────────────────────────

/** Derive a UserProfile from a Supabase User object */
function profileFromSupabaseUser(user: User): UserProfile {
  const meta = user.user_metadata ?? {};
  // Google OAuth sends full_name + avatar_url; phone auth sends phone
  const name: string =
    meta.full_name ?? meta.name ?? user.email?.split('@')[0] ?? 'User';
  return {
    id: user.id,
    name,
    email: user.email ?? '',
    phone: user.phone ?? undefined,
    avatar: meta.avatar_url ?? meta.picture ?? undefined,
    isGuest: false,
  };
}

const GUEST_PROFILE: UserProfile = {
  id: 'guest',
  name: 'Guest User',
  email: '',
  isGuest: true,
};

// Derive initial profile synchronously from the cached session (if any).
// supabase.auth.getSession() is async, so we start as guest and update below.
let _profile: UserProfile = GUEST_PROFILE;
let _session: Session | null = null;
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((fn) => fn());
}

function applySession(session: Session | null) {
  _session = session;
  _profile = session?.user ? profileFromSupabaseUser(session.user) : GUEST_PROFILE;
  notify();
}

// Bootstrap: pull the persisted session on module load
supabase.auth.getSession().then(({ data }) => {
  applySession(data.session);
});

// Stay in sync with auth state changes (sign-in, sign-out, token refresh,
// OAuth callback redirect, etc.)
supabase.auth.onAuthStateChange((_event, session) => {
  applySession(session);
});

// ─── Public API ───────────────────────────────────────────────────────────────

export function getCurrentUser(): UserProfile {
  return _profile;
}

export function getSession(): Session | null {
  return _session;
}

/** React hook — re-renders whenever auth state changes */
export function useCurrentUser(): UserProfile {
  const [profile, setProfile] = useState<UserProfile>(() => getCurrentUser());

  useEffect(() => {
    // Immediately sync in case auth resolved between render and effect
    setProfile(getCurrentUser());
    const listener = () => setProfile(getCurrentUser());
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  return profile;
}

/** Convenience hook — true when a real user is signed in */
export function useIsLoggedIn(): boolean {
  const user = useCurrentUser();
  return !user.isGuest;
}

// ─── Auth actions ─────────────────────────────────────────────────────────────

/**
 * Kick off Google OAuth.
 * Supabase redirects back to window.location.origin after the user approves.
 * The onAuthStateChange listener above handles the rest automatically.
 */
export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        // Request offline_access so we get a refresh token
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  return { error: error?.message ?? null };
}

/**
 * Send an SMS OTP to the given phone number.
 * Phone must be in E.164 format, e.g. "+919876543210".
 */
export async function signInWithPhone(
  phone: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  return { error: error?.message ?? null };
}

/**
 * Verify the 6-digit OTP received via SMS.
 * On success Supabase sets the session; onAuthStateChange fires and updates profile.
 */
export async function verifyOtp(
  phone: string,
  token: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  return { error: error?.message ?? null };
}

/** Sign out and clear session */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  // applySession(null) is called by onAuthStateChange
}

// ─── Guest playback gate ──────────────────────────────────────────────────────

export function isGuestUser(): boolean {
  return _profile.isGuest;
}

export function getGuestPlaybackStatus() {
  const s = resetGuestIfStale(loadGuestPlayback());
  const remaining = Math.max(0, GUEST_LIMIT - s.count);
  const resetAt = s.startedAt + GUEST_WINDOW_MS;
  return { remaining, resetAt, limit: GUEST_LIMIT };
}

export function canGuestPlaySong(): boolean {
  if (!isGuestUser()) return true;
  const s = resetGuestIfStale(loadGuestPlayback());
  return s.count < GUEST_LIMIT;
}

export function consumeGuestPlayback(): boolean {
  if (!isGuestUser()) return true;
  let s = resetGuestIfStale(loadGuestPlayback());
  if (s.count >= GUEST_LIMIT) return false;
  s = { count: s.count + 1, startedAt: s.startedAt || Date.now() };
  saveGuestPlayback(s);
  return true;
}

// ─── Legacy compat shim ───────────────────────────────────────────────────────
// AccountView / other places call signIn() directly with a UserProfile object.
// Keep this as a no-op shim so old call-sites don't break during migration.
// Real sign-in goes through signInWithGoogle() / verifyOtp().
export function signIn(_user: Partial<UserProfile>) {
  // No-op — real auth is driven by Supabase session events.
  // This shim exists only to avoid breaking any remaining direct call-sites.
}
