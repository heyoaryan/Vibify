import { Home, Library, Search, Users } from 'lucide-react';
import { useNav } from '../nav';
import type { NavSection } from '../types';

const navItems: { id: NavSection; label: string; icon: typeof Home }[] = [
  { id: 'home',    label: 'Home',    icon: Home },
  { id: 'search',  label: 'Search',  icon: Search },
  { id: 'room',    label: 'Room',    icon: Users },
  { id: 'library', label: 'Library', icon: Library },
];

export function BottomNav() {
  const { view, navigate } = useNav();

  const activeSection: NavSection =
    view.name === 'home' || view.name === 'search' || view.name === 'library' || view.name === 'room'
      ? view.name
      : view.name === 'playlist' ? 'library' : 'home';

  return (
    <nav
      className="relative z-40 flex items-center border-t border-ink-800/60 bg-ink-950/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {navItems.map(({ id, label, icon: Icon }) => {
        const active = activeSection === id;
        return (
          <button
            key={id}
            onClick={() => navigate({ name: id })}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors min-h-[44px] sm:py-3 text-ink-400 hover:text-ink-100"
          >
            <span className="relative flex items-center justify-center">
              <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              {active && (
                <span className="absolute -bottom-1.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-brand-400" />
              )}
            </span>
            <span className="text-[10px] sm:text-xs">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
