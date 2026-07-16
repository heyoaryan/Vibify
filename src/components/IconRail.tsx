import { Home, Library, Search, Settings, Users } from 'lucide-react';
import { useCurrentUser } from '../auth';
import { UserAvatar } from './UserAvatar';
import { VibifyLogo } from './VibifyLogo';
import { useNav } from '../nav';
import type { NavSection } from '../types';

const navItems: { id: NavSection; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'library', label: 'Library', icon: Library },
];

export function IconRail({
  expanded = true,
  onClose,
}: {
  expanded?: boolean;
  onClose?: () => void;
}) {
  const { view, navigate } = useNav();
  const user = useCurrentUser();

  const activeSection: NavSection =
    view.name === 'home' || view.name === 'search' || view.name === 'library' || view.name === 'room'
      ? view.name
      : view.name === 'playlist'
        ? 'library'
        : 'home';

  const handleNav = (id: NavSection) => {
    navigate({ name: id });
    onClose?.();
  };

  const content = (
    <div className="flex h-full flex-col gap-1">
      {/* Brand */}
      <div className={`mb-4 flex items-center gap-3 ${expanded ? 'px-3 pt-3' : 'justify-center pt-3'}`}>
        <VibifyLogo size={40} className="shrink-0 transition-transform hover:scale-105" />
        {expanded && (
          <span className="font-display text-xl font-bold tracking-tight text-ink-50">
            Vibify
          </span>
        )}
      </div>

      {/* Primary nav */}
      {navItems.map(({ id, label, icon: Icon }) => {
        const active = activeSection === id;
        return (
          <button
            key={id}
            onClick={() => handleNav(id)}
            aria-label={label}
            title={label}
            className={`group relative flex items-center gap-4 rounded-xl py-3 font-semibold transition-all duration-200 ${
              expanded ? 'px-3' : 'justify-center'
            } ${
              active
                ? 'bg-brand-500/15 text-brand-300'
                : 'text-ink-300 hover:bg-ink-800/50 hover:text-ink-50'
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-brand-400" />
            )}
            <Icon size={22} strokeWidth={active ? 2.4 : 2} />
            {expanded && <span className="text-sm">{label}</span>}
          </button>
        );
      })}



      {/* Room — directly below Library in primary nav */}
        <button
          onClick={() => { navigate({ name: 'room' }); onClose?.(); }}
          aria-label="Room"
          title="Listening Room"
          className={`group relative flex items-center gap-4 rounded-xl py-3 font-semibold transition-all duration-200 ${
            view.name === 'room'
              ? 'bg-brand-500/15 text-brand-300'
              : 'text-ink-300 hover:bg-ink-800/50 hover:text-ink-50'
          } ${expanded ? 'px-3' : 'justify-center'}`}
        >
          {view.name === 'room' && (
            <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-brand-400" />
          )}
          <Users size={22} strokeWidth={view.name === 'room' ? 2.4 : 2} />
          {expanded && <span className="text-sm">Room</span>}
        </button>

       {/* Bottom: Account first, then Settings below */}
      <div className="mt-auto flex flex-col gap-2">
        {/* Account */}
        <button
          onClick={() => { navigate({ name: 'account' }); onClose?.(); }}
          className={`flex w-full items-center gap-3 rounded-xl p-2 transition-colors hover:bg-ink-700/50 ${expanded ? '' : 'justify-center'}`}
        >
          <UserAvatar size={32} radius="rounded-full" />
          {expanded && <span className="text-sm font-medium text-ink-100">{user.name}</span>}
        </button>

        {/* Settings — below account */}
        <button
          onClick={() => { navigate({ name: 'settings' }); onClose?.(); }}
          aria-label="Settings"
          title="Settings"
          className={`group relative flex items-center gap-4 rounded-xl py-3 font-semibold transition-all duration-200 hover:bg-ink-800/50 hover:text-ink-50 ${
            view.name === 'settings' ? 'bg-brand-500/15 text-brand-300' : 'text-ink-300'
          } ${expanded ? 'px-3' : 'justify-center'}`}
        >
          <Settings size={20} />
          {expanded && <span className="text-sm">Settings</span>}
        </button>
      </div>
    </div>
  );

  if (expanded) {
    return <div className="h-full w-56 p-3">{content}</div>;
  }

  return <div className="h-full w-20 p-2">{content}</div>;
}
