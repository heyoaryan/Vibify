import { useEffect, useState } from 'react';
import { Apple, ExternalLink, Monitor, Phone, Play, ShieldCheck, Smartphone } from 'lucide-react';
import { signIn } from '../auth';

type Step = 'choice' | 'install' | 'browser' | 'auth';
type PlatformKey = 'mac' | 'windows' | 'android' | 'apple';
type AuthMethod = 'phone' | 'google' | null;
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

interface InstallExperienceModalProps {
  open: boolean;
  onClose: () => void;
  installPrompt: BeforeInstallPromptEvent | null;
  onPromptUsed: () => void;
}
const platformMeta: Record<PlatformKey, { title: string; status: string; note: string; store: string }> = {
  mac: {
    title: 'Install For Mac',
    status: 'macOS',
    note: 'Use the app-like install experience on Mac with the same sign-in options.',
    store: 'Native install is being prepared for macOS.',
  },
  windows: {
    title: 'Install For Windows',
    status: 'Windows',
    note: 'Use the same app experience on Windows with smooth launch and offline support.',
    store: 'Desktop installer is being prepared for Windows.',
  },
  android: {
    title: 'Install For Android',
    status: 'Android',
    note: 'Install on Android phones and tablets, then sign in with phone or Google.',
    store: 'Coming soon in Play Store.',
  },
  apple: {
    title: 'Install For Apple',
    status: 'iPhone / iPad',
    note: 'Install on Apple devices and continue with phone or Google sign-in.',
    store: 'Coming soon in Apple Store.',
  },
};

export function InstallExperienceModal({ open, onClose, installPrompt, onPromptUsed }: InstallExperienceModalProps) {
  const [step, setStep] = useState<Step>('choice');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const [installStatus, setInstallStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep('choice');
      setSelectedPlatform(null);
      setAuthMethod(null);
    }
  }, [open]);

  if (!open) return null;

  const handleContinueToAuth = () => setStep('auth');

  const handleInstallRequest = async () => {
    if (!installPrompt) {
      setInstallStatus('Install is unavailable. Please use the browser or add to home screen from your browser menu.');
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallStatus('Installation started — continue signing in after the app is installed.');
      } else {
        setInstallStatus('Installation declined. You can still continue in browser or try install again.');
      }
      onPromptUsed();
    } catch {
      setInstallStatus('Could not start install. Please use the browser menu to install the app.');
    }
  };

  const handleAuthChoice = (method: 'phone' | 'google') => {
    setAuthMethod(method);
    signIn({
      name: method === 'phone' ? 'Phone User' : 'Google User',
      email: method === 'phone' ? 'phone@arsith.local' : 'google@arsith.local',
      phone: method === 'phone' ? '+91 99999 99999' : undefined,
      isGuest: false,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/70 px-3 py-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-ink-900/90 p-4 shadow-2xl shadow-black/40 sm:p-6 md:max-w-3xl lg:max-w-4xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-300">Arsith Tunes</p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              {step === 'choice' && 'Choose how to open Arsith Tunes'}
              {step === 'install' && 'Install Arsith Tunes'}
              {step === 'browser' && 'Continue with browser'}
              {step === 'auth' && 'Login or sign up'}
            </h2>
            <p className="mt-2 text-sm text-ink-300 sm:text-base">
              {step === 'choice' && 'Pick the experience you want to use on this device.'}
              {step === 'install' && 'Choose the device you want to install for, then continue to sign in.'}
              {step === 'browser' && 'The app will open in your browser and you can still sign in with phone or Google.'}
              {step === 'auth' && 'Choose how you want to continue, then enter the app.'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full bg-white/[0.06] px-3 py-2 text-sm text-ink-200">Close</button>
        </div>

        {step === 'choice' && (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <button onClick={() => setStep('install')} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 text-brand-300"><Monitor size={18} /></div>
                <div>
                  <p className="font-semibold text-ink-50">Install</p>
                  <p className="text-sm text-ink-400">Open the install experience</p>
                </div>
              </div>
            </button>
            <button onClick={() => setStep('browser')} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 text-brand-300"><ExternalLink size={18} /></div>
                <div>
                  <p className="font-semibold text-ink-50">Continue with browser</p>
                  <p className="text-sm text-ink-400">Open in the current browser</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {step === 'install' && (
          <div className="mt-6 rounded-3xl border border-brand-400/20 bg-gradient-to-br from-brand-500/10 to-transparent p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-brand-300">Dedicated install page</p>
                <h3 className="mt-1 text-xl font-semibold text-white">Install Arsith Tunes</h3>
              </div>
              <div className="rounded-full bg-white/[0.08] px-3 py-1 text-xs text-ink-200">Choose a platform</div>
            </div>

            <div className="mt-4 grid gap-2">
              {(['mac', 'windows', 'android', 'apple'] as PlatformKey[]).map((platform) => (
                <button
                  key={platform}
                  onClick={() => setSelectedPlatform(platform)}
                  className={`flex items-center justify-between rounded-2xl border p-3 text-left ${selectedPlatform === platform ? 'border-brand-400/50 bg-brand-500/10' : 'border-white/10 bg-white/[0.04]'}`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-ink-50">
                    {platform === 'mac' || platform === 'windows' ? <Monitor size={16} /> : platform === 'android' ? <Play size={16} /> : <Apple size={16} />}
                    {platformMeta[platform].title}
                  </span>
                  <span className="text-xs text-ink-400">{platformMeta[platform].status}</span>
                </button>
              ))}
            </div>

            {selectedPlatform && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-ink-950/50 p-4 text-sm text-ink-300">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 shrink-0 text-brand-300" size={16} />
                  <p>{platformMeta[selectedPlatform].note}</p>
                </div>
                <div className="mt-3 flex items-start gap-2">
                  <ExternalLink className="mt-0.5 shrink-0 text-brand-300" size={16} />
                  <p>{platformMeta[selectedPlatform].store}</p>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3">
              <button
                onClick={handleInstallRequest}
                className="rounded-full bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950"
              >
                {installPrompt ? 'Install Arsith Tunes' : 'Install from browser menu'}
              </button>
              <button onClick={handleContinueToAuth} className="rounded-full bg-white/[0.08] px-4 py-2.5 text-sm font-semibold text-ink-100">
                Continue to login / sign up
              </button>
              <button onClick={() => setStep('choice')} className="rounded-full bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-ink-100">
                Back
              </button>
            </div>

            {installStatus && <p className="mt-3 text-sm text-ink-300">{installStatus}</p>}
          </div>
        )}

        {step === 'browser' && (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
            <div className="flex items-start gap-2">
              <ExternalLink className="mt-0.5 text-brand-300" size={16} />
              <div>
                <h3 className="text-lg font-semibold text-white">You are continuing in the browser</h3>
                <p className="mt-1 text-sm text-ink-300">The app will open in this browser tab and you can still use your phone number or Google account to sign in.</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={handleContinueToAuth} className="rounded-full bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950">
                Continue to login / sign up
              </button>
              <button onClick={() => setStep('choice')} className="rounded-full bg-white/[0.08] px-4 py-2.5 text-sm font-semibold text-ink-100">
                Back
              </button>
            </div>
          </div>
        )}

        {step === 'auth' && (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
            <div className="rounded-2xl border border-white/10 bg-ink-950/50 p-4">
              <p className="text-sm font-semibold text-ink-50">Login or sign up</p>
              <p className="mt-2 text-sm text-ink-300">Guest users can listen to 5 songs in 1 hour. Sign in or sign up to continue beyond that limit.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => handleAuthChoice('phone')} className={`rounded-full px-3 py-2 text-sm ${authMethod === 'phone' ? 'bg-brand-500 text-ink-950' : 'bg-white/[0.07] text-ink-100'}`}>
                  <span className="flex items-center gap-2"><Phone size={14} /> Login with phone number</span>
                </button>
                <button onClick={() => handleAuthChoice('google')} className={`rounded-full px-3 py-2 text-sm ${authMethod === 'google' ? 'bg-brand-500 text-ink-950' : 'bg-white/[0.07] text-ink-100'}`}>
                  <span className="flex items-center gap-2"><Smartphone size={14} /> Continue with Google</span>
                </button>
              </div>
              {authMethod && <p className="mt-3 text-sm text-ink-300">Selected: {authMethod === 'phone' ? 'Phone number' : 'Google'}. This works for the installed app and for the browser flow.</p>}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={onClose} className="rounded-full bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950">Continue to app</button>
              <button onClick={() => setStep('choice')} className="rounded-full bg-white/[0.08] px-4 py-2.5 text-sm font-semibold text-ink-100">Choose another option</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default InstallExperienceModal;
