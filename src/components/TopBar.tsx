import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNav } from '../nav';
import { useCurrentUser } from '../auth';

export function TopBar() {
  const { canGoBack, back, view, navigate } = useNav();
  const user = useCurrentUser();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const title =
    view.name === 'home'     ? 'Home'
    : view.name === 'search'   ? 'Search'
    : view.name === 'library'  ? 'Library'
    : view.name === 'playlist' ? 'Playlist'
    : view.name === 'account'  ? 'Account'
    : view.name === 'settings' ? 'Settings'
    : 'Now Playing';

  useEffect(() => {
    if (!dropdownOpen) return;
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [dropdownOpen]);

  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 px-4 py-3
      sm:px-6 sm:py-4
      lg:px-8 lg:py-5">

      {/* Back — desktop only */}
      <button
        onClick={back}
        disabled={!canGoBack}
        aria-label="Go back"
        className="hidden lg:grid h-9 w-9 shrink-0 place-items-center rounded-xl
          bg-ink-800/60 text-ink-100 transition-colors
          enabled:hover:bg-ink-700 disabled:opacity-30"
      >
        <ArrowLeft size={17} />
      </button>

      <h1 className="font-display text-lg font-bold text-ink-50 sm:text-xl lg:text-2xl">
        {title}
      </h1>

      <div className="flex-1" />

      {/* Desktop search shortcut */}
      <button
        onClick={() => navigate({ name: 'search' })}
        className="hidden lg:flex items-center gap-2 rounded-full bg-ink-800/60
          px-4 py-2 text-sm text-ink-300 transition-colors
          hover:bg-ink-700 hover:text-ink-100"
      >
        Search music
      </button>

      {/* Mobile / tablet: account avatar → dropdown */}
      <div ref={dropdownRef} className="relative lg:hidden">
        <button
          aria-label="Account menu"
          onClick={() => setDropdownOpen(o => !o)}
          className="grid h-8 w-8 place-items-center rounded-full
            bg-gradient-to-br from-brand-400 to-accent-500
            text-xs font-bold text-ink-950 shadow-glow
            transition-transform hover:scale-105 active:scale-95
            sm:h-9 sm:w-9"
        >
          {user.name.charAt(0) || 'G'}
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-10 w-40 overflow-hidden rounded-2xl
            border border-white/10 bg-ink-850/95 shadow-2xl backdrop-blur-xl
            animate-fade-in sm:top-11">

            <button
              onClick={() => { setDropdownOpen(false); navigate({ name: 'account' }); }}
              className="flex w-full items-center px-4 py-3.5 text-left transition-colors hover:bg-white/5"
            >
              <span className="text-sm font-semibold text-ink-50">Account</span>
            </button>

            <div className="mx-3 h-px bg-white/5" />

            <button
              onClick={() => { setDropdownOpen(false); navigate({ name: 'settings' }); }}
              className="flex w-full items-center px-4 py-3.5 text-left transition-colors hover:bg-white/5"
            >
              <span className="text-sm font-semibold text-ink-50">Settings</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
