import { Bell, Lock, Moon, Music, Shield, Wifi, Zap } from 'lucide-react';
import { memo, useState } from 'react';
import { useSettings, type AudioQuality } from '../settings';
import { NoticeModal } from '../components/NoticeModal';
import { VibifyLogo } from '../components/VibifyLogo';

// ── Reusable toggle switch ────────────────────────────────────────────────────
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
        transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900
        ${enabled ? 'bg-brand-400' : 'bg-ink-600'}`}
    >
      <span
        className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow
          transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

// ── Setting row ───────────────────────────────────────────────────────────────
function SettingRow({
  icon: Icon,
  label,
  description,
  right,
  hue = 210,
}: {
  icon: React.ElementType;
  label: string;
  description?: string;
  right: React.ReactNode;
  hue?: number;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
        style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 38%), hsl(${(hue + 30) % 360} 55% 28%))` }}
      >
        <Icon size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-50">{label}</p>
        {description && <p className="mt-0.5 text-xs text-ink-400">{description}</p>}
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

// ── Section card ─────────────────────────────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-ink-400">{title}</h2>
      <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-xl">
        {children}
      </div>
    </section>
  );
}

// ── Quality chip selector ─────────────────────────────────────────────────────
function QualitySelector({ value, onChange }: { value: AudioQuality; onChange: (q: AudioQuality) => void }) {
  const options: { q: AudioQuality; label: string }[] = [
    { q: '96',  label: '96' },
    { q: '160', label: '160' },
    { q: '320', label: '320' },
  ];
  return (
    <div className="flex items-center gap-1">
      {options.map(({ q, label }) => (
        <button
          key={q}
          onClick={() => onChange(q)}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors
            ${value === q
              ? 'bg-brand-400 text-ink-950'
              : 'bg-ink-700 text-ink-300 hover:bg-ink-600 hover:text-ink-50'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Crossfade selector ────────────────────────────────────────────────────────
function CrossfadeSelector({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const options = [0, 2, 4, 6] as const;
  return (
    <div className="flex items-center gap-1">
      {options.map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors
            ${value === n
              ? 'bg-brand-400 text-ink-950'
              : 'bg-ink-700 text-ink-300 hover:bg-ink-600 hover:text-ink-50'}`}
        >
          {n === 0 ? 'Off' : `${n}s`}
        </button>
      ))}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export const SettingsView = memo(function SettingsView() {
  const [settings, update] = useSettings();
  const [notifModal, setNotifModal] = useState(false);

  // Notifications require browser permission
  const handleNotifications = async (enabled: boolean) => {
    if (!enabled) {
      update({ notifications: false });
      return;
    }
    if (!('Notification' in window)) {
      setNotifModal(true);
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      update({ notifications: true });
      new Notification('Vibify', { body: 'Notifications enabled!', icon: '/icons/logo.png' });
    } else {
      update({ notifications: false });
      setNotifModal(true);
    }
  };

  return (
    <div className="animate-fade-in space-y-6 px-4 pb-12 lg:px-8">

      {/* ── Playback ── */}
      <SectionCard title="Playback">
        <SettingRow
          icon={Music} hue={180}
          label="Audio quality"
          description={settings.dataSaver ? 'Overridden by Data Saver (96 kbps)' : `Streaming at ${settings.audioQuality} kbps`}
          right={
            <QualitySelector
              value={settings.audioQuality}
              onChange={q => update({ audioQuality: q })}
            />
          }
        />
        <SettingRow
          icon={Zap} hue={260}
          label="Autoplay"
          description="Keep playing similar songs when queue ends"
          right={<Toggle enabled={settings.autoPlay} onChange={v => update({ autoPlay: v })} />}
        />
        <SettingRow
          icon={Music} hue={210}
          label="Crossfade"
          description={settings.crossfadeSecs === 0 ? 'Disabled' : `${settings.crossfadeSecs}s fade between songs`}
          right={
            <CrossfadeSelector
              value={settings.crossfadeSecs}
              onChange={n => update({ crossfadeSecs: n })}
            />
          }
        />
      </SectionCard>

      {/* ── Appearance ── */}
      <SectionCard title="Appearance">
        <SettingRow
          icon={Moon} hue={270}
          label="Dark mode"
          description="Vibify uses dark theme only"
          right={
            <span className="rounded-full bg-brand-500/20 px-2.5 py-1 text-xs font-semibold text-brand-300">
              Always on
            </span>
          }
        />
      </SectionCard>

      {/* ── Data & Network ── */}
      <SectionCard title="Data & Network">
        <SettingRow
          icon={Wifi} hue={150}
          label="Data saver"
          description="Caps streaming to 96 kbps on mobile data"
          right={<Toggle enabled={settings.dataSaver} onChange={v => update({ dataSaver: v })} />}
        />
      </SectionCard>

      {/* ── Notifications ── */}
      <SectionCard title="Notifications">
        <SettingRow
          icon={Bell} hue={40}
          label="Push notifications"
          description="New releases and recommendations"
          right={<Toggle enabled={settings.notifications} onChange={handleNotifications} />}
        />
      </SectionCard>

      {/* ── Privacy ── */}
      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-ink-400">Privacy</h2>
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-xl">
          <div className="flex items-start gap-4 px-4 py-5">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
              style={{ background: 'linear-gradient(135deg, hsl(340 60% 38%), hsl(10 55% 28%))' }}
            >
              <Shield size={18} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink-50">Your data is fully secure</p>
              <p className="text-xs leading-relaxed text-ink-400">
                All your personal information and listening history is fully encrypted end-to-end.
                We never share, sell, or expose your data to third parties. Your privacy is our
                highest priority — everything stays between you and Vibify.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Lock size={12} className="text-brand-400" />
                <span className="text-xs font-medium text-brand-400">End-to-end encrypted</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-ink-400">About</h2>
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-xl">

          {/* Logo + name */}
          <div className="flex flex-col items-center gap-3 border-b border-white/5 px-6 py-8 text-center">
            <VibifyLogo size={72} className="drop-shadow-[0_0_20px_rgba(10,168,149,0.5)]" />
            <div>
              <p className="font-display text-xl font-bold text-ink-50">Vibify</p>
              <p className="mt-0.5 text-xs text-ink-400">Version 1.0.0</p>
            </div>
          </div>

          {/* Developer */}
          <div className="flex items-center gap-4 px-4 py-4">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 text-xs font-bold text-ink-950">
              AS
            </div>
            <div>
              <p className="text-xs text-ink-400">Developer</p>
              <p className="text-sm font-semibold text-ink-50">Aryan Singh Thakur</p>
            </div>
          </div>
        </div>
      </section>

      {/* Notification permission denied modal */}
      <NoticeModal
        open={notifModal}
        onClose={() => setNotifModal(false)}
        title="Notifications blocked"
      >
        <p className="text-sm text-ink-300">
          Your browser has blocked notifications for this site. To enable them, open your
          browser settings and allow notifications for this origin, then try again.
        </p>
      </NoticeModal>
    </div>
  );
});
