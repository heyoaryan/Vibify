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
      className="relative z-40 flex items-center border-t border-white/10 bg-ink-950/40 backdrop-blur-3xl lg:hidden"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: '0 -4px 24px -4px rgba(0,0,0,0.3), 0 8px 32px -8px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.08)',
      }}
    >
      {/* Glassmorphism glow overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/[0.02] to-transparent" />
      
      {/* Active indicator with enhanced glassmorphism */}
      <div
        className="pointer-events-none absolute top-1/2 h-10 rounded-2xl border border-white/10 bg-white/[0.12] backdrop-blur-xl shadow-lg transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          left: `calc(${activeIndex * 25}% + 8px)`,
          width: `calc(25% - 16px)`,
          transform: 'translateY(-50%)',
          boxShadow: '0 4px 16px -2px rgba(59, 130, 246, 0.15), inset 0 1px 0 0 rgba(255,255,255,0.15)',
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
            className="relative z-10 flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-all duration-500 min-h-[44px] sm:py-3"
            style={{ 
              color: active ? '#eef3f5' : '#9ca3af',
              transform: active ? 'translateY(-1px)' : 'translateY(0)',
            }}
          >
            <span className="relative flex items-center justify-center">
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 2}
                className="transition-all duration-500 ease-out"
                style={{ 
                  transform: active ? 'scale(1.15)' : 'scale(1)',
                  filter: active ? 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.3))' : 'none',
                }}
              />
              {active && (
                <span className="absolute -bottom-2 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand-400 shadow-[0_0_8px_rgba(59,130,246,0.8)] transition-all duration-500 animate-pulse" />
              )}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold transition-all duration-500">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
