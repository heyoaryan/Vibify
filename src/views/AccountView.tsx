import { Clock, Edit3, Headphones, Music2, Star, TrendingUp } from 'lucide-react';
import { memo, useState } from 'react';
import { useCurrentUser, signOut } from '../auth';
import { useRecentlyPlayed, useListenStats } from '../history';
import { NoticeModal } from '../components/NoticeModal';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Format a unix-ms timestamp as a short relative label, e.g. "2 min ago" */
function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Format total seconds as "Xh Ym" */
function formatListenTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── component ────────────────────────────────────────────────────────────────

export const AccountView = memo(function AccountView() {
  const user = useCurrentUser();
  const recentPlays = useRecentlyPlayed();
  const listenStats = useListenStats();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // Build stats cards from live data
  const stats = [
    {
      label: 'Songs played',
      value: recentPlays.length > 0 ? String(recentPlays.length) : '0',
      icon: Music2,
    },
    {
      label: 'Listening time',
      value: listenStats.totalSeconds > 0 ? formatListenTime(listenStats.totalSeconds) : '—',
      icon: Headphones,
    },
    {
      label: 'Hours this week',
      value: listenStats.hours > 0 ? `${listenStats.hours}h` : '—',
      icon: Clock,
    },
    {
      label: 'Active streak',
      value: '—', // placeholder for future streak tracking
      icon: TrendingUp,
    },
  ];

  // Avatar initials from name or phone
  const initial = user.name.charAt(0).toUpperCase() || '?';

  function PremiumButton() {
    return (
      <button
        onClick={() => setShowPremiumModal(true)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03]
          px-4 py-3.5 text-left text-xs font-medium text-ink-100 backdrop-blur-xl transition-colors
          hover:bg-white/[0.06] sm:px-5 sm:py-4 sm:text-sm"
      >
        <span className="flex items-center gap-2">
          <Star size={14} className="text-brand-400" />
          Upgrade to Premium
        </span>
        <span className="rounded-full bg-brand-500/20 px-2.5 py-1 text-xs font-semibold text-brand-300">
          Soon
        </span>
      </button>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 px-3 pb-12 sm:space-y-8 sm:px-5 lg:px-8">

      {/* ── Profile card ── */}
      <section className="relative overflow-hidden rounded-2xl border border-white/5
        bg-gradient-to-br from-ink-800/60 to-ink-900 p-5
        sm:rounded-3xl sm:p-6 lg:p-8">

        <div className="relative flex items-center gap-4 sm:gap-5">
          <div className="relative shrink-0">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-16 w-16 rounded-xl object-cover shadow-glow sm:h-20 sm:w-20 sm:rounded-2xl"
              />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-xl bg-gradient-to-br
                from-brand-400 to-accent-500 text-2xl font-bold text-ink-950 shadow-glow
                sm:h-20 sm:w-20 sm:rounded-2xl sm:text-3xl">
                {initial}
              </div>
            )}
            <button
              aria-label="Edit profile"
              className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full
                bg-ink-700 text-ink-200 ring-2 ring-ink-900 transition-colors
                hover:bg-ink-600 hover:text-ink-50 sm:h-7 sm:w-7"
            >
              <Edit3 size={11} />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-bold text-ink-50 sm:text-2xl">
              {user.name}
            </h2>
            {user.email && (
              <p className="mt-0.5 truncate text-xs text-ink-300 sm:text-sm">{user.email}</p>
            )}
            {user.phone && !user.email && (
              <p className="mt-0.5 text-xs text-ink-300 sm:text-sm">{user.phone}</p>
            )}
            <span className="mt-2 inline-block rounded-full bg-brand-500/20 px-2.5 py-0.5
              text-xs font-semibold text-brand-300">
              Free plan
            </span>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section>
        <h2 className="mb-3 font-display text-base font-bold text-ink-50 sm:mb-4 sm:text-lg">
          Your stats
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex flex-col gap-2.5 rounded-2xl border border-white/5
                bg-white/[0.03] p-3.5 backdrop-blur-xl sm:gap-3 sm:p-4"
            >
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-brand-500/15
                text-brand-400 sm:h-9 sm:w-9">
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

      {/* ── Recently played ── */}
      <section>
        <h2 className="mb-3 font-display text-base font-bold text-ink-50 sm:mb-4 sm:text-lg">
          Recently played
        </h2>

        {recentPlays.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl
            border border-white/5 bg-white/[0.03] py-10 backdrop-blur-xl">
            <Music2 size={28} className="text-ink-600" />
            <p className="text-sm text-ink-500">Nothing played yet — start listening!</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/5
            bg-white/[0.03] backdrop-blur-xl">
            {recentPlays.slice(0, 15).map((item) => (
              <div
                key={`${item.songId}-${item.playedAt}`}
                className="flex items-center gap-3 border-b border-white/5 px-3 py-2.5
                  transition-colors last:border-0 hover:bg-white/5 sm:px-4 sm:py-3"
              >
                {/* Artwork */}
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-9 w-9 shrink-0 rounded-lg object-cover sm:h-10 sm:w-10"
                  />
                ) : (
                  <div
                    className="h-9 w-9 shrink-0 rounded-lg sm:h-10 sm:w-10"
                    style={{
                      background: `linear-gradient(135deg,
                        hsl(${item.hue} 60% 40%),
                        hsl(${(item.hue + 40) % 360} 55% 28%))`,
                    }}
                  />
                )}

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink-50 sm:text-sm">
                    {item.title}
                  </p>
                  <p className="truncate text-[10px] text-ink-400 sm:text-xs">
                    {item.artist}
                  </p>
                </div>

                {/* Time */}
                <span className="shrink-0 text-[10px] text-ink-500 sm:text-xs">
                  {timeAgo(item.playedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Actions ── */}
      <section className="space-y-2">
        <PremiumButton />

        <button
          onClick={() => setShowSignOutConfirm(true)}
          className="flex w-full items-center rounded-2xl border border-white/5 bg-white/[0.03]
            px-4 py-3.5 text-left text-xs font-medium text-red-400 backdrop-blur-xl
            transition-colors hover:bg-red-500/5 sm:px-5 sm:py-4 sm:text-sm"
        >
          Sign out
        </button>
      </section>

      {/* ── Modals ── */}
      <NoticeModal
        open={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        title="Premium — Coming soon"
      >
        Currently in development. Premium features will arrive in Vibify Version 2 — stay tuned!
      </NoticeModal>

      <NoticeModal
        open={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        title="Sign out?"
        hideClose
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-300">
            Your recently played history is saved locally and will be available when you sign
            back in.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowSignOutConfirm(false); signOut(); }}
              className="flex-1 rounded-xl bg-red-500/20 px-4 py-2.5 text-sm
                font-semibold text-red-400 transition hover:bg-red-500/30"
            >
              Sign out
            </button>
            <button
              onClick={() => setShowSignOutConfirm(false)}
              className="flex-1 rounded-xl bg-white/[0.07] px-4 py-2.5 text-sm
                font-semibold text-ink-200 transition hover:bg-white/[0.1]"
            >
              Cancel
            </button>
          </div>
        </div>
      </NoticeModal>

    </div>
  );
});
