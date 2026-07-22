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

  const activeIndex = navItems.findIndex((item) => item.id === activeSection);

  return (
    <nav
      className="relative z-40 flex items-center border-t border-white/5 bg-ink-950/30 backdrop-blur-2xl lg:hidden"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: '0 8px 32px -8px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.05)',
      }}
    >
      <div
        className="pointer-events-none absolute top-1/2 h-9 rounded-full bg-white/[0.08] backdrop-blur-sm transition-all duration-300 ease-out"
        style={{
          left: `calc(${activeIndex * 25}% + 6px)`,
          width: `calc(25% - 12px)`,
          transform: 'translateY(-50%)',
        }}
      />
      {navItems.map(({ id, label, icon: Icon }) => {
        const active = activeSection === id;
        return (
          <button
            key={id}
            onClick={() => navigate({ name: id })}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className="relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-all duration-300 min-h-[44px] sm:py-3"
            style={{ color: active ? '#eef3f5' : undefined }}
          >
            <span className="relative flex items-center justify-center">
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 2}
                className="transition-transform duration-300"
                style={{ transform: active ? 'scale(1.1)' : 'scale(1)' }}
              />
              {active && (
                <span className="absolute -bottom-1.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-brand-400 transition-all duration-300" />
              )}
            </span>
            <span className="text-[10px] sm:text-xs transition-all duration-300">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
