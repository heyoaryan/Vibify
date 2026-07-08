import { useState } from 'react';
import { Lock, Moon, Wifi, Bell, Shield, Music, Code2 } from 'lucide-react';

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none ${
        enabled ? 'bg-brand-400' : 'bg-ink-600'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-ink-400">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-xl divide-y divide-white/5">
        {children}
      </div>
    </section>
  );
}

export function SettingsView() {
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [highQuality, setHighQuality] = useState(true);
  const [dataSaver, setDataSaver] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [crossfade, setCrossfade] = useState(false);

  return (
    <div className="animate-fade-in space-y-6 px-4 pb-12 lg:px-8">

      {/* Playback */}
      <SectionCard title="Playback">
        <SettingRow
          icon={Music} hue={180}
          label="High quality audio"
          description="Stream at 320kbps"
          right={<Toggle enabled={highQuality} onChange={setHighQuality} />}
        />
        <SettingRow
          icon={Music} hue={260}
          label="Autoplay"
          description="Keep playing similar songs"
          right={<Toggle enabled={autoPlay} onChange={setAutoPlay} />}
        />
        <SettingRow
          icon={Music} hue={210}
          label="Crossfade"
          description="Smooth transitions between songs"
          right={<Toggle enabled={crossfade} onChange={setCrossfade} />}
        />
      </SectionCard>

      {/* Appearance */}
      <SectionCard title="Appearance">
        <SettingRow
          icon={Moon} hue={270}
          label="Dark mode"
          description="Always on dark theme"
          right={<Toggle enabled={darkMode} onChange={setDarkMode} />}
        />
      </SectionCard>

      {/* Data */}
      <SectionCard title="Data & Network">
        <SettingRow
          icon={Wifi} hue={150}
          label="Data saver"
          description="Lower quality on mobile data"
          right={<Toggle enabled={dataSaver} onChange={setDataSaver} />}
        />
      </SectionCard>

      {/* Notifications */}
      <SectionCard title="Notifications">
        <SettingRow
          icon={Bell} hue={40}
          label="Push notifications"
          description="New releases and recommendations"
          right={<Toggle enabled={notifications} onChange={setNotifications} />}
        />
      </SectionCard>

      {/* Privacy */}
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
                highest priority — everything stays between you and ARVINE.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Lock size={12} className="text-brand-400" />
                <span className="text-xs font-medium text-brand-400">End-to-end encrypted</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-ink-400">About</h2>
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-xl">
          {/* Logo + name */}
          <div className="flex flex-col items-center gap-3 px-6 py-8 text-center border-b border-white/5">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-accent-500 shadow-glow">
              <span className="font-display text-xl font-bold text-ink-950">A</span>
            </div>
            <div>
              <p className="font-display text-xl font-bold text-ink-50">Arsith Tunes</p>
              <p className="mt-0.5 text-xs text-ink-400">Version 1.0.0</p>
            </div>
          </div>

          {/* Studio */}
          <div className="flex items-center gap-4 px-4 py-4 border-b border-white/5">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
              style={{ background: 'linear-gradient(135deg, hsl(200 60% 38%), hsl(230 55% 28%))' }}
            >
              <Code2 size={17} />
            </div>
            <div>
              <p className="text-xs text-ink-400">Developed &amp; Designed under</p>
              <p className="text-sm font-semibold text-ink-50">Arsith Studio</p>
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

    </div>
  );
}
