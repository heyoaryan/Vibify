import { Clock, Edit3, Heart, Music2, Star } from 'lucide-react';
import { useState } from 'react';
import { useCurrentUser, signIn, signOut } from '../auth';
import { NoticeModal } from '../components/NoticeModal';

export function AccountView() {
  // Use real user data when available. `currentUser` may include `stats` and `recentActivity`.
  // If not present (guest), show empty states instead of mock data.
  const user = useCurrentUser();
  const stats = user.stats || [];
  const activity = user.recentActivity || [];
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  function PremiumButton() {
    return (
      <button
        onClick={() => setShowPremiumModal(true)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03]
          px-4 py-3.5 text-left text-xs font-medium text-ink-100 backdrop-blur-xl transition-colors
          hover:bg-white/[0.06] sm:px-5 sm:py-4 sm:text-sm"
      >
        <span>Upgrade to Premium</span>
        <span className="rounded-full bg-brand-500/20 px-2.5 py-1 text-xs font-semibold text-brand-300">Pro</span>
      </button>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 px-3 pb-12 sm:space-y-8 sm:px-5 lg:px-8">

      {/* Profile card */}
      <section className="relative overflow-hidden rounded-2xl border border-white/5
        bg-gradient-to-br from-ink-800/60 to-ink-900 p-5
        sm:rounded-3xl sm:p-6 lg:p-8">

        <div className="relative flex items-center gap-4 sm:gap-5">
          <div className="relative shrink-0">
            <div className="grid h-16 w-16 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-accent-500
              text-2xl font-bold text-ink-950 shadow-glow sm:h-20 sm:w-20 sm:rounded-2xl sm:text-3xl">
              {user.name.charAt(0) || 'G'}
            </div>
            <button aria-label="Edit profile"
              className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full
                bg-ink-700 text-ink-200 ring-2 ring-ink-900 transition-colors
                hover:bg-ink-600 hover:text-ink-50 sm:h-7 sm:w-7">
              <Edit3 size={11} />
            </button>
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-ink-50 sm:text-2xl">{user.name}</h2>
            <p className="mt-0.5 text-xs text-ink-300 sm:text-sm">{user.email}</p>
            <span className="mt-2 inline-block rounded-full bg-brand-500/20 px-2.5 py-0.5 text-xs font-semibold text-brand-300">
              Free plan
            </span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section>
        <h2 className="mb-3 font-display text-base font-bold text-ink-50 sm:mb-4 sm:text-lg">Your stats</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex flex-col gap-2.5 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 backdrop-blur-xl sm:gap-3 sm:p-4">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-brand-500/15 text-brand-400 sm:h-9 sm:w-9">
                <Icon size={16} />
              </div>
              <div>
                <p className="font-display text-xl font-bold text-ink-50 sm:text-2xl">{value}</p>
                <p className="mt-0.5 text-[10px] text-ink-400 sm:text-xs">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="mb-3 font-display text-base font-bold text-ink-50 sm:mb-4 sm:text-lg">Recently played</h2>
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-xl">
          {activity.map((item, i) => (
            <div key={i}
              className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/5
                border-b border-white/5 last:border-0 sm:px-4 sm:py-3">
              <div className="h-9 w-9 shrink-0 rounded-lg sm:h-10 sm:w-10"
                style={{ background: `linear-gradient(135deg, hsl(${item.hue} 60% 40%), hsl(${(item.hue + 40) % 360} 55% 28%))` }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink-50 sm:text-sm">{item.title}</p>
                <p className="truncate text-[10px] text-ink-400 sm:text-xs">{item.artist}</p>
              </div>
              <span className="shrink-0 text-[10px] text-ink-500 sm:text-xs">{item.time}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <section className="space-y-2">
        <PremiumButton />
        <button
          onClick={() => user.isGuest ? setShowAuthModal(true) : signOut()}
          className="flex w-full items-center rounded-2xl border border-white/5 bg-white/[0.03]
          px-4 py-3.5 text-left text-xs font-medium text-red-400 backdrop-blur-xl transition-colors
          hover:bg-red-500/5 sm:px-5 sm:py-4 sm:text-sm"
        >
          {user.isGuest ? 'Sign in / Sign up' : 'Sign out'}
        </button>
      </section>

      <NoticeModal open={showPremiumModal} onClose={() => setShowPremiumModal(false)} title="Premium — Coming soon">
        Currently in development. Premium features will arrive in Arsith Tunes Version 2 — stay tuned!
      </NoticeModal>

      <NoticeModal open={showAuthModal} onClose={() => setShowAuthModal(false)} title="Sign in / Sign up">
        <div className="space-y-3">
          <p className="text-sm text-ink-300">Choose how you want to continue. Signed-in users can enjoy the full app beyond the guest limit.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { signIn({ name: 'Phone User', email: 'phone@arsith.local', phone: '+91 99999 99999', isGuest: false }); setShowAuthModal(false); }} className="rounded-full bg-brand-500 px-3 py-2 text-sm font-semibold text-ink-950">Continue with phone number</button>
            <button onClick={() => { signIn({ name: 'Google User', email: 'google@arsith.local', isGuest: false }); setShowAuthModal(false); }} className="rounded-full bg-white/[0.08] px-3 py-2 text-sm font-semibold text-ink-100">Continue with Google</button>
          </div>
        </div>
      </NoticeModal>

    </div>
  );
}
