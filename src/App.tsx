import { useRef, useEffect, useState } from 'react';
import { NavProvider, useNav } from './nav';
import { PlayerProvider } from './player';
import { useLyrics } from './useLyrics';
import { IconRail } from './components/IconRail';
import { BottomNav } from './components/BottomNav';
import { TopBar } from './components/TopBar';
import { PlayerBar } from './components/PlayerBar';
import { HomeView } from './views/HomeView';
import { SearchView } from './views/SearchView';
import { LibraryView } from './views/LibraryView';
import { PlaylistView } from './views/PlaylistView';
import { NowPlayingView } from './views/NowPlayingView';
import { AccountView } from './views/AccountView';
import { SettingsView } from './views/SettingsView';
import { PremiumView } from './views/PremiumView';
import { LoginView } from './views/LoginView';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { NoticeModal } from './components/NoticeModal';
import { useIsLoggedIn } from './auth';
import { supabase } from './supabase';

// ─── Background lyrics prefetcher ────────────────────────────────────────────
// Mounted inside PlayerProvider so it can call usePlayer().
// Calls useLyrics() which triggers a fetch the moment current song changes.
// Result lands in the lyricsApi cache — NowPlayingView reads from that cache
// instantly when the lyrics panel is opened.
function LyricsPrefetcher() {
  useLyrics(); // side-effect only — keep the cache warm
  return null;
}

// ─── View router ──────────────────────────────────────────────────────────────

function ViewRouter({ onNavigate }: { onNavigate: () => void }) {
  const { view } = useNav();
  useEffect(() => {
    onNavigate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  switch (view.name) {
    case 'home':     return <HomeView />;
    case 'search':   return <SearchView />;
    case 'library':  return <LibraryView />;
    case 'playlist': return <PlaylistView id={view.id} />;
    case 'account':  return <AccountView />;
    case 'settings': return <SettingsView />;
    case 'premium':  return <PremiumView />;
    default:         return <HomeView />;
  }
}

// ─── Now Playing full-screen overlay ─────────────────────────────────────────

function NowPlayingOverlay() {
  const { view } = useNav();
  if (view.name !== 'nowplaying') return null;
  return (
    <div className="fixed inset-0 z-50 animate-scale-in">
      <NowPlayingView />
    </div>
  );
}

// ─── Main app shell (shown only when logged in) ───────────────────────────────

function Shell() {
  const mainRef = useRef<HTMLElement>(null);
  const scrollToTop = () =>
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-ink-950 text-ink-50">
      <div className="relative flex min-h-0 flex-1 lg:gap-3 lg:p-3 lg:pb-0">
        {/* Sidebar — hidden on mobile/tablet, shown on lg+ */}
        <aside className="hidden lg:block lg:shrink-0">
          <IconRail />
        </aside>

        {/* Main scrollable content */}
        <main
          ref={mainRef}
          className="relative min-h-0 flex-1 overflow-y-auto
            lg:rounded-t-3xl lg:border lg:border-ink-800/50 lg:bg-ink-900/40"
        >
          <div className="pointer-events-none sticky top-0 z-10 h-24 bg-gradient-to-b
            from-ink-800/30 to-transparent sm:h-28 lg:h-32" />
          <div className="relative -mt-24 sm:-mt-28 lg:-mt-32">
            <TopBar />
            <ViewRouter onNavigate={scrollToTop} />
          </div>
        </main>
      </div>

      {/* Player bar */}
      <PlayerBar />

      {/* Bottom nav — mobile/tablet only */}
      <BottomNav />

      {/* Now Playing fullscreen */}
      <NowPlayingOverlay />

      {/* PWA install banner */}
      <PWAInstallBanner />
    </div>
  );
}

// ─── Splash / loading screen ─────────────────────────────────────────────────
// Shown for the brief moment while Supabase resolves the persisted session on
// first load. Prevents a flash of the login screen for users who are already
// signed in (e.g. returning from a Google OAuth redirect).

function SplashScreen() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-5 bg-ink-950">
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-20"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(10,168,149,0.3) 0%, transparent 70%)',
        }}
      />
      {/* Logo mark */}
      <div className="grid h-16 w-16 place-items-center rounded-2xl
        bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow animate-pulse">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 19V6l12-3v13" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" className="text-ink-950" />
          <circle cx="6" cy="19" r="3" fill="currentColor" className="text-ink-950" />
          <circle cx="18" cy="16" r="3" fill="currentColor" className="text-ink-950" />
        </svg>
      </div>
      <p className="font-display text-xl font-bold tracking-tight text-ink-50">Vibify</p>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const isLoggedIn = useIsLoggedIn();
  const [guestLimitOpen, setGuestLimitOpen] = useState(false);

  // authReady flips to true once Supabase has resolved the initial session.
  // Without this, signed-in users see a login flash on every page load.
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // getSession() resolves immediately if a session is cached in localStorage;
    // it makes a network call only when a token refresh is needed.
    supabase.auth.getSession().then(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    const handleGuestLimit = () => setGuestLimitOpen(true);
    window.addEventListener('vibify-guest-limit', handleGuestLimit as EventListener);
    return () => window.removeEventListener('vibify-guest-limit', handleGuestLimit as EventListener);
  }, []);

  // While session is being resolved, show the branded splash screen
  if (!authReady) {
    return <SplashScreen />;
  }

  // Unauthenticated — show login page (with PWA install banner inside)
  if (!isLoggedIn) {
    return <LoginView />;
  }

  // Authenticated — full app shell
  return (
    <NavProvider>
      <PlayerProvider>
        <LyricsPrefetcher />
        <Shell />
        <NoticeModal
          open={guestLimitOpen}
          onClose={() => setGuestLimitOpen(false)}
          title="Guest limit reached"
        >
          Guest users can listen to 5 songs per hour. Sign in to keep listening without limits.
        </NoticeModal>
      </PlayerProvider>
    </NavProvider>
  );
}
