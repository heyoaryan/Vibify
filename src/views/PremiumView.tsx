import {
  Check,
  Crown,
  Download,
  Headphones,
  Heart,
  Infinity,
  Mic2,
  Music2,
  RadioTower,
  Shuffle,
  SkipForward,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';

/* ─── Mock listening stats (would come from user context in a real app) ─── */
const stats = [
  { label: 'Hours listened', value: '247', sub: 'this year', icon: Headphones },
  { label: 'Songs played', value: '1,842', sub: 'all time', icon: Music2 },
  { label: 'Artists explored', value: '318', sub: 'unique artists', icon: TrendingUp },
  { label: 'Liked songs', value: '94', sub: 'in your library', icon: Heart },
];

/* Weekly bar chart data — hours per day */
const weekActivity = [
  { day: 'Mon', hours: 1.2 },
  { day: 'Tue', hours: 2.8 },
  { day: 'Wed', hours: 0.6 },
  { day: 'Thu', hours: 3.4 },
  { day: 'Fri', hours: 4.1 },
  { day: 'Sat', hours: 5.0 },
  { day: 'Sun', hours: 2.3 },
];
const maxHours = Math.max(...weekActivity.map((d) => d.hours));

/* Top genres */
const genres = [
  { name: 'Hip-Hop', pct: 38 },
  { name: 'R&B', pct: 24 },
  { name: 'Pop', pct: 18 },
  { name: 'Electronic', pct: 12 },
  { name: 'Indie', pct: 8 },
];

/* Feature comparison rows */
const featureRows = [
  { label: 'Audio quality',        free: 'Normal (128 kbps)', premium: 'Very High (320 kbps)', icon: RadioTower },
  { label: 'Ads',                  free: 'Audio + visual ads', premium: 'None, ever',           icon: Zap },
  { label: 'Skips',                free: '6 per hour',         premium: 'Unlimited',             icon: SkipForward },
  { label: 'On-demand playback',   free: 'Shuffle only',       premium: 'Any song, any time',    icon: Shuffle },
  { label: 'Offline downloads',    free: '—',                  premium: 'Up to 10,000 songs',    icon: Download },
  { label: 'Lyrics',               free: 'Basic',              premium: 'Synced line-by-line',   icon: Mic2 },
  { label: 'AI DJ & smart mixes',  free: '—',                  premium: 'Personalised daily',    icon: Sparkles },
  { label: 'Background play',      free: '—',                  premium: 'Always on',             icon: Infinity },
];

/* Plans */
const plans = [
  {
    id: 'mini',
    name: 'Mini',
    price: '₹7',
    period: 'per day',
    description: 'Full Premium for 1 day',
    highlight: false,
    features: ['All Premium features', '1-day access', 'No auto-renewal'],
    cta: 'Try for a day',
  },
  {
    id: 'individual',
    name: 'Individual',
    price: '₹119',
    period: 'per month',
    description: 'The full experience',
    highlight: true,
    badge: 'Most popular',
    features: [
      'Ad-free listening',
      '320 kbps audio',
      'Unlimited skips',
      'Any song on demand',
      'Offline downloads',
      'AI DJ & mixes',
      'Synced lyrics',
      'Background play',
    ],
    cta: 'Get Individual',
  },
  {
    id: 'student',
    name: 'Student',
    price: '₹59',
    period: 'per month',
    description: 'All Individual perks, half price',
    highlight: false,
    badge: 'Save 50%',
    features: ['Everything in Individual', 'Verified student pricing', 'Annual renewal'],
    cta: 'Get Student',
  },
];

/* ─── Component ─────────────────────────────────────────────────────────── */
export function PremiumView() {
  return (
    <div className="animate-fade-in min-h-screen px-4 pb-28 pt-4 lg:px-8">

      {/* ── Hero ── */}
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/20 via-brand-500/15 to-accent-500/20 px-6 py-10 text-center lg:py-14">
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-sm font-semibold text-amber-300">
            <Crown size={14} className="fill-amber-300" />
            Arsith Tunes Premium
          </span>
          <h1 className="mt-3 font-display text-3xl font-bold text-ink-50 lg:text-4xl">
            Your music, no limits
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-300 lg:text-base">
            Skip freely, listen offline, and hear every beat in full quality — zero ads, always.
          </p>
          <button 
            disabled
            title="Premium features currently in building phase"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-brand-400 px-8 py-3 text-sm font-bold text-ink-950 shadow-glow transition-all hover:scale-105 hover:brightness-110 active:scale-95 opacity-50 cursor-not-allowed">
            <Crown size={15} className="fill-ink-950" />
            Try Premium free for 1 month
          </button>
          <p className="mt-2 text-xs text-ink-500">Cancel anytime. No commitment.</p>
        </div>
      </div>

      {/* ── Listening stats ── */}
      <section className="mb-8">
        <h2 className="mb-4 font-display text-lg font-bold text-ink-50">Your listening so far</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(({ label, value, sub, icon: Icon }) => (
            <div
              key={label}
              className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/[0.03] p-4"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
                <Icon size={16} />
              </span>
              <span className="font-display text-2xl font-bold text-ink-50">{value}</span>
              <div className="leading-none">
                <p className="text-xs font-semibold text-ink-200">{label}</p>
                <p className="mt-0.5 text-[10px] text-ink-500">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Weekly activity + top genres (side by side on md+) ── */}
      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">

        {/* Weekly bar chart */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
          <p className="mb-4 text-sm font-semibold text-ink-100">Weekly activity</p>
          <div className="flex items-end justify-between gap-1.5" style={{ height: 80 }}>
            {weekActivity.map(({ day, hours }) => {
              const pct = (hours / maxHours) * 100;
              const isToday = day === 'Sat'; // mock "today"
              return (
                <div key={day} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="relative w-full" style={{ height: 64 }}>
                    <div
                      className={`absolute bottom-0 w-full rounded-t-md transition-all ${
                        isToday ? 'bg-brand-400' : 'bg-brand-500/30'
                      }`}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className={`text-[10px] ${isToday ? 'font-bold text-brand-300' : 'text-ink-500'}`}>
                    {day}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-ink-500">Hours listened per day this week</p>
        </div>

        {/* Top genres */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
          <p className="mb-4 text-sm font-semibold text-ink-100">Top genres</p>
          <div className="flex flex-col gap-3">
            {genres.map(({ name, pct }) => (
              <div key={name}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-ink-200">{name}</span>
                  <span className="text-[11px] font-semibold text-ink-400">{pct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-400 to-accent-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Free vs Premium feature table ── */}
      <section className="mb-8">
        <h2 className="mb-4 font-display text-lg font-bold text-ink-50">Free vs Premium</h2>
        <div className="overflow-hidden rounded-2xl border border-white/5">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr_1fr] border-b border-white/5 bg-white/[0.03] px-4 py-3">
            <span className="text-xs font-semibold text-ink-400">Feature</span>
            <span className="text-center text-xs font-semibold text-ink-400">Free</span>
            <span className="text-center text-xs font-bold text-amber-300">Premium</span>
          </div>
          {featureRows.map(({ label, free, premium, icon: Icon }, i) => (
            <div
              key={label}
              className={`grid grid-cols-[1fr_1fr_1fr] items-center gap-2 px-4 py-3 ${
                i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon size={13} className="shrink-0 text-ink-500" />
                <span className="text-xs text-ink-200">{label}</span>
              </div>
              <span className="text-center text-xs text-ink-500">{free}</span>
              <div className="flex items-center justify-center gap-1">
                <Check size={11} className="shrink-0 text-amber-400" />
                <span className="text-xs font-medium text-amber-200">{premium}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Plans ── */}
      <section className="mb-6">
        <h2 className="mb-4 font-display text-lg font-bold text-ink-50">Choose your plan</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-5 transition-all ${
                plan.highlight
                  ? 'border-brand-400/50 bg-gradient-to-b from-brand-500/10 to-transparent shadow-[0_0_40px_-10px] shadow-brand-500/20'
                  : 'border-white/8 bg-white/[0.02]'
              }`}
            >
              {plan.badge && (
                <span
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold ${
                    plan.highlight ? 'bg-brand-400 text-ink-950' : 'bg-amber-400 text-ink-950'
                  }`}
                >
                  {plan.badge}
                </span>
              )}
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">{plan.name}</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-bold text-ink-50">{plan.price}</span>
                  <span className="text-xs text-ink-400">/{plan.period}</span>
                </div>
                <p className="mt-1 text-xs text-ink-400">{plan.description}</p>
              </div>
              <ul className="mb-6 flex flex-col gap-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-ink-200">
                    <Check size={12} className="mt-0.5 shrink-0 text-brand-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                disabled
                title="Premium features currently in building phase"
                className={`mt-auto w-full rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-95 opacity-50 cursor-not-allowed ${
                  plan.highlight
                    ? 'bg-brand-400 text-ink-950'
                    : 'border border-amber-400/40 text-amber-300'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center text-[11px] text-ink-600">
        Prices include applicable taxes. Subscription auto-renews monthly. Cancel anytime from account settings.
      </p>
    </div>
  );
}
