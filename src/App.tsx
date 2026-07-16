import { useRef, useEffect, useState, lazy, Suspense } from 'react';
import { NavProvider, useNav } from './nav';
import { PlayerProvider } from './player';
import { useLyrics } from './useLyrics';
import { IconRail } from './components/IconRail';
import { BottomNav } from './components/BottomNav';
import { TopBar } from './components/TopBar';
import { PlayerBar } from './components/PlayerBar';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { NoticeModal } from './components/NoticeModal';
import { VibifyLogo } from './components/VibifyLogo';
import { useIsLoggedIn } from './auth';
import { supabase } from './supabase';

// ─── Lazy-loaded views ────────────────────────────────────────────────────────
// Each view is only downloaded when first navigated to, keeping the initial
// JS bundle small and first-paint fast.
const HomeView       = lazy(() => import('./views/HomeView').then(m => ({ default: m.HomeView })));
  const SearchView     = lazy(() => import('./views/SearchView').then(m => ({ default: m.SearchView })));
  const LibraryView    = lazy(() => import('./views/LibraryView').then(m => ({ default: m.LibraryView })));
  const PlaylistView   = lazy(() => import('./views/PlaylistView').then(m => ({ default: m.PlaylistView })));
  const RoomView       = lazy(() => import('./views/RoomView').then(m => ({ default: m.RoomView })));
  const NowPlayingView = lazy(() => import('./views/NowPlayingView').then(m => ({ default: m.NowPlayingView })));
  const AccountView    = lazy(() => import('./views/AccountView').then(m => ({ default: m.AccountView })));
  const SettingsView   = lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
  const PremiumView    = lazy(() => import('./views/PremiumView').then(m => ({ default: m.PremiumView })));
  const LoginView      = lazy(() => import('./views/LoginView').then(m => ({ default: m.LoginView })));

// Minimal inline fallback — just a dark screen, no spinner flash for fast loads
function ViewFallback() {
  return <div className="h-full w-full bg-ink-950" />;
}

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

  const content = (() => {
    switch (view.name) {
      case 'home':     return <HomeView />;
      case 'search':   return <SearchView />;
      case 'library':  return <LibraryView />;
case 'playlist': return <PlaylistView id={view.id} />;
      case 'room':     return <RoomView />;
      case 'account':  return <AccountView />;
      case 'settings': return <SettingsView />;
      case 'premium':  return <PremiumView />;
      default:         return <HomeView />;
    }
  })();

  return (
    <Suspense fallback={<ViewFallback />}>
      {content}
    </Suspense>
  );
}

// ─── Now Playing full-screen overlay ─────────────────────────────────────────

function NowPlayingOverlay() {
  const { view } = useNav();
  if (view.name !== 'nowplaying') return null;
  return (
    <div className="fixed inset-0 z-50 animate-scale-in">
      <Suspense fallback={<ViewFallback />}>
        <NowPlayingView />
      </Suspense>
    </div>
  );
}

// ─── Main app shell (shown only when logged in) ───────────────────────────────

function Shell() {
  const mainRef = useRef<HTMLElement>(null);
  const scrollToTop = () =>
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  const { view } = useNav();

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
          <div className="relative -mt-24 sm:-mt-28 lg:-mt-32 flex flex-col min-h-0">
            <TopBar />
            <ViewRouter onNavigate={scrollToTop} />
          </div>
        </main>
      </div>

      {/* Player bar — hidden in room view */}
      {view.name !== 'room' && <PlayerBar />}

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
      <VibifyLogo size={64} className="animate-pulse drop-shadow-[0_0_24px_rgba(10,168,149,0.6)]" />
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
    return (
      <Suspense fallback={<ViewFallback />}>
        <LoginView />
      </Suspense>
    );
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
