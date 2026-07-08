import { useState } from 'react';
import { Apple, Monitor, Play, Smartphone, Phone, ExternalLink } from 'lucide-react';

export function InstallChoice({ onContinue }: { onContinue: () => void }) {
  const [mode, setMode] = useState<'install' | 'browser'>('install');

  return (
    <div className="space-y-4">
      <div className="flex rounded-full bg-white/[0.05] p-1">
        <button onClick={() => setMode('install')} className={`flex-1 rounded-full px-3 py-2 text-sm ${mode === 'install' ? 'bg-brand-500 text-ink-950' : 'text-ink-200'}`}>Install app</button>
        <button onClick={() => setMode('browser')} className={`flex-1 rounded-full px-3 py-2 text-sm ${mode === 'browser' ? 'bg-brand-500 text-ink-950' : 'text-ink-200'}`}>Continue in browser</button>
      </div>

      {mode === 'install' ? (
        <div className="grid gap-2">
          <button className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"><span className="flex items-center gap-2"><Monitor size={16} /> Install For Mac</span><span className="text-xs text-ink-400">macOS</span></button>
          <button className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"><span className="flex items-center gap-2"><Monitor size={16} /> Install For Windows</span><span className="text-xs text-ink-400">Windows</span></button>
          <button className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"><span className="flex items-center gap-2"><Play size={16} /> Install For Android</span><span className="text-xs text-ink-400">Play Store</span></button>
          <button className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"><span className="flex items-center gap-2"><Apple size={16} /> Install For Apple</span><span className="text-xs text-ink-400">Apple Store</span></button>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-ink-300">
          <p className="font-semibold text-ink-50">Continue in browser</p>
          <p className="mt-2">You will stay in the browser and can sign in with your phone number or Google account.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded-full bg-white/[0.08] px-3 py-2 text-sm text-ink-100"><span className="flex items-center gap-2"><Phone size={14} /> Phone</span></button>
            <button className="rounded-full bg-white/[0.08] px-3 py-2 text-sm text-ink-100"><span className="flex items-center gap-2"><Smartphone size={14} /> Google</span></button>
          </div>
        </div>
      )}

      <button onClick={onContinue} className="w-full rounded-full bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950">Continue</button>
    </div>
  );
}

export default InstallChoice;
