import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNav } from '../nav';
import { UserAvatar } from './UserAvatar';

export function TopBar() {
  const { canGoBack, back, view, navigate } = useNav();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const title =
    view.name === 'home'     ? 'Home'
    : view.name === 'search'   ? 'Search'
    : view.name === 'library'  ? 'Library'
: view.name === 'playlist' ? 'Playlist'
     : view.name === 'room'     ? 'Listening Room'
     : view.name === 'account'  ? 'Account'
    : view.name === 'settings' ? 'Settings'
    : 'Now Playing';

  useEffect(() => {
    if (!dropdownOpen) return;

    // mousedown for desktop, touchstart for iOS Safari
    const close = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close, { passive: true });
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [dropdownOpen]);

  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 px-4 py-3 sm:px-6 sm:py-4 lg:px-8 lg:py-5">

      {/* Back — desktop only, 44×44 touch target */}
      <button
        onClick={back}
        disabled={!canGoBack}
        aria-label="Go back"
        className="hidden lg:grid h-11 w-11 shrink-0 place-items-center rounded-xl
          bg-ink-800/60 text-ink-100 transition-colors
          enabled:hover:bg-ink-700 disabled:opacity-30"
      >
        <ArrowLeft size={17} />
      </button>

      <h1 className="font-display text-lg font-bold text-ink-50 sm:text-xl lg:text-2xl">
        {title}
      </h1>

      <div className="flex-1" />

      {/* Mobile / tablet: account avatar → dropdown */}
      <div ref={dropdownRef} className="relative lg:hidden">
        {/* Avatar — 44×44 touch target (up from the old 32/36px) */}
        <button
          aria-label="Account menu"
          aria-expanded={dropdownOpen}
          aria-haspopup="true"
          onClick={() => setDropdownOpen(o => !o)}
          className="grid h-11 w-11 place-items-center rounded-full transition-transform hover:scale-105 active:scale-95"
        >
          <UserAvatar size={44} radius="rounded-full" />
        </button>

        {dropdownOpen && (
          <div
            role="menu"
            className="absolute right-0 top-12 w-44 overflow-hidden rounded-2xl
              border border-white/10 bg-ink-850/95 shadow-2xl backdrop-blur-xl
              animate-fade-in"
          >
            <button
              role="menuitem"
              onClick={() => { setDropdownOpen(false); navigate({ name: 'account' }); }}
              className="flex w-full items-center px-4 py-3.5 text-left transition-colors hover:bg-white/5 active:bg-white/10"
            >
              <span className="text-sm font-semibold text-ink-50">Account</span>
            </button>

            <div className="mx-3 h-px bg-white/5" />

            <button
              role="menuitem"
              onClick={() => { setDropdownOpen(false); navigate({ name: 'settings' }); }}
              className="flex w-full items-center px-4 py-3.5 text-left transition-colors hover:bg-white/5 active:bg-white/10"
            >
              <span className="text-sm font-semibold text-ink-50">Settings</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
