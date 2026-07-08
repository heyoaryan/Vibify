import { useEffect, useRef, useState } from 'react';
import { NavProvider, useNav } from './nav';
import { PlayerProvider } from './player';
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
import { InstallExperienceModal } from './components/InstallExperienceModal';
import { NoticeModal } from './components/NoticeModal';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

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

function NowPlayingOverlay() {
  const { view } = useNav();
  if (view.name !== 'nowplaying') return null;
  return (
    <div className="fixed inset-0 z-50 animate-scale-in">
      <NowPlayingView />
    </div>
  );
}

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
          <div className="pointer-events-none sticky top-0 z-10 h-24 bg-gradient-to-b from-ink-800/30 to-transparent sm:h-28 lg:h-32" />
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
    </div>
  );
}

const INSTALL_REMINDER_MS = 5 * 60 * 1000;

export default function App() {
  const [showInstallFlow, setShowInstallFlow] = useState(false);
  const [guestLimitOpen, setGuestLimitOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const showInstallFlowRef = useRef(showInstallFlow);

  useEffect(() => {
    showInstallFlowRef.current = showInstallFlow;
  }, [showInstallFlow]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = window.sessionStorage.getItem('arsith-install-seen-session');
    const isBrowser = window.matchMedia('(display-mode: browser)').matches || !(window.navigator as any).standalone;

    if (seen !== 'true') {
      setShowInstallFlow(true);
      window.sessionStorage.setItem('arsith-install-last-timestamp', Date.now().toString());
    }

    const installHandler = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', installHandler as EventListener);

    if (isBrowser) {
      const interval = window.setInterval(() => {
        const now = Date.now();
        const last = Number(window.sessionStorage.getItem('arsith-install-last-timestamp') || '0');
        if (now - last >= INSTALL_REMINDER_MS) {
          setShowInstallFlow(true);
          window.sessionStorage.setItem('arsith-install-last-timestamp', now.toString());
        }
      }, INSTALL_REMINDER_MS);

      return () => {
        window.removeEventListener('beforeinstallprompt', installHandler as EventListener);
        window.clearInterval(interval);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', installHandler as EventListener);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleGuestLimit = () => setGuestLimitOpen(true);
    window.addEventListener('arsith-guest-limit', handleGuestLimit as EventListener);
    return () => window.removeEventListener('arsith-guest-limit', handleGuestLimit as EventListener);
  }, []);

  const handleInstallFlowClose = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('arsith-install-seen-session', 'true');
      window.sessionStorage.setItem('arsith-install-last-timestamp', Date.now().toString());
    }
    setShowInstallFlow(false);
  };

  return (
    <NavProvider>
      <PlayerProvider>
        <Shell />
        <InstallExperienceModal
          open={showInstallFlow}
          onClose={handleInstallFlowClose}
          installPrompt={deferredInstallPrompt}
          onPromptUsed={() => setDeferredInstallPrompt(null)}
        />
        <NoticeModal open={guestLimitOpen} onClose={() => setGuestLimitOpen(false)} title="Guest limit reached">
          Guest users can listen to 5 songs in 1 hour. Sign in or sign up to continue beyond that limit.
        </NoticeModal>
      </PlayerProvider>
    </NavProvider>
  );
}
