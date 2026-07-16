import { useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { signInWithGoogle, signInWithPhone, verifyOtp } from '../auth';
import { PWAInstallBanner } from '../components/PWAInstallBanner';
import { TermsModal, PrivacyModal } from '../components/LegalModal';
import { VibifyLogo } from '../components/VibifyLogo';

type Step = 'landing' | 'phone' | 'otp';

// ─── Google "G" logo ──────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

// ─── Inline error message ─────────────────────────────────────────────────────

function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs text-red-400">{msg}</p>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LoginViewProps {
  /** Called after a successful sign-in so the parent can dismiss the view.
   *  With Supabase the session is set via onAuthStateChange, so the parent
   *  can also just watch useIsLoggedIn() — this prop is kept for compat. */
  onLogin?: () => void;
}

export function LoginView({ onLogin }: LoginViewProps) {
  const [step, setStep] = useState<Step>('landing');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Used to avoid state updates after unmount on Google redirect
  const unmounted = useRef(false);

  // ── Google OAuth ────────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    // signInWithGoogle() triggers a full-page redirect, so this line is only
    // reached if the call itself failed before redirecting.
    if (!unmounted.current) {
      setLoading(false);
      if (error) setPhoneError(error);
    }
  };

  // ── Phone: send OTP ─────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const cleaned = phone.replace(/\s/g, '');
    // Accept 10-digit local numbers or E.164 format (+country code)
    if (!/^\+?[0-9]{10,15}$/.test(cleaned)) {
      setPhoneError('Enter a valid phone number (10–15 digits, e.g. +919876543210)');
      return;
    }
    // Normalise to E.164: if no leading +, assume India (+91) for 10-digit numbers
    const e164 =
      cleaned.startsWith('+') ? cleaned
      : cleaned.length === 10 ? `+91${cleaned}`
      : `+${cleaned}`;

    setPhoneError('');
    setLoading(true);
    const { error } = await signInWithPhone(e164);
    if (!unmounted.current) {
      setLoading(false);
      if (error) {
        setPhoneError(error);
      } else {
        setPhone(e164); // store normalised form for verifyOtp
        setStep('otp');
      }
    }
  };

  // ── OTP input helpers ───────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (digits.length === 6) {
      setOtp(digits.split(''));
      e.preventDefault();
      document.getElementById('otp-5')?.focus();
    }
  };

  // ── OTP: verify ─────────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      setOtpError('Enter the full 6-digit code');
      return;
    }
    setOtpError('');
    setLoading(true);
    const { error } = await verifyOtp(phone, code);
    if (!unmounted.current) {
      setLoading(false);
      if (error) {
        setOtpError(error);
      } else {
        onLogin?.();
        // onAuthStateChange in auth.ts handles the session update
      }
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-ink-950 px-5 py-10">

      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(10,168,149,0.25) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-sm animate-fade-up">

        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <VibifyLogo
              size={80}
              className="drop-shadow-[0_0_32px_rgba(10,220,180,0.55)]"
            />
          </div>
          <h1 className="font-display text-2xl font-bold text-ink-50">Vibify</h1>
          <p className="mt-1 text-sm text-ink-400">Your music, everywhere</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-white/[0.08] bg-ink-900/70 p-6 shadow-card backdrop-blur-xl">

          {/* ── LANDING ── */}
          {step === 'landing' && (
            <div className="space-y-3">
              <h2 className="mb-5 font-display text-lg font-semibold text-ink-50">
                Sign in or create account
              </h2>

              {/* Google */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.1]
                  bg-white/[0.05] px-4 py-3.5 text-sm font-semibold text-ink-50
                  transition hover:bg-white/[0.09] active:scale-[0.98]
                  disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin text-ink-400" />
                ) : (
                  <GoogleIcon />
                )}
                <span>Continue with Google</span>
                <ChevronRight size={16} className="ml-auto text-ink-500" />
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-white/[0.07]" />
                <span className="text-xs text-ink-500">or</span>
                <div className="h-px flex-1 bg-white/[0.07]" />
              </div>

              {/* Phone — disabled until Version 2 */}
              <div className="relative">
                <button
                  disabled
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06]
                    bg-white/[0.02] px-4 py-3.5 text-sm font-semibold text-ink-500
                    cursor-not-allowed opacity-50"
                >
                  <span className="text-base">📱</span>
                  <span>Continue with phone number</span>
                  <ChevronRight size={16} className="ml-auto text-ink-600" />
                </button>
                <span className="absolute -right-1 -top-2 rounded-full bg-brand-500/20 px-2 py-0.5 text-[10px] font-semibold text-brand-300 ring-1 ring-brand-500/30">
                  Version 2
                </span>
              </div>

              {phoneError && <FieldError msg={phoneError} />}

              <p className="pt-2 text-center text-[11px] leading-relaxed text-ink-500">
                By continuing you agree to our{' '}
                <button
                  onClick={() => setShowTerms(true)}
                  className="text-ink-300 underline underline-offset-2 transition hover:text-ink-100"
                >
                  Terms
                </button>
                {' & '}
                <button
                  onClick={() => setShowPrivacy(true)}
                  className="text-ink-300 underline underline-offset-2 transition hover:text-ink-100"
                >
                  Privacy Policy
                </button>
              </p>
            </div>
          )}

          {/* ── PHONE INPUT ── */}
          {step === 'phone' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setStep('landing'); setPhoneError(''); }}
                  aria-label="Back"
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06]
                    text-ink-400 transition hover:bg-white/[0.1]"
                >
                  <ArrowLeft size={15} />
                </button>
                <h2 className="font-display text-lg font-semibold text-ink-50">
                  Enter phone number
                </h2>
              </div>

              <div>
                <label htmlFor="phone-input" className="mb-1.5 block text-xs font-medium text-ink-400">
                  Phone number
                </label>
                <input
                  id="phone-input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  autoFocus
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setPhoneError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                  className="w-full rounded-xl border border-white/[0.1] bg-white/[0.05]
                    px-4 py-3 text-sm text-ink-50 placeholder-ink-500 outline-none
                    ring-brand-500/60 transition focus:ring-2"
                />
                <FieldError msg={phoneError} />
              </div>

              <button
                onClick={handleSendOtp}
                disabled={loading || !phone.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl
                  bg-brand-500 px-4 py-3 text-sm font-semibold text-ink-950
                  transition hover:bg-brand-400 active:scale-[0.98]
                  disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {loading ? 'Sending…' : 'Send OTP'}
              </button>
            </div>
          )}

          {/* ── OTP VERIFY ── */}
          {step === 'otp' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setStep('phone'); setOtpError(''); setOtp(['','','','','','']); }}
                  aria-label="Back"
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06]
                    text-ink-400 transition hover:bg-white/[0.1]"
                >
                  <ArrowLeft size={15} />
                </button>
                <h2 className="font-display text-lg font-semibold text-ink-50">
                  Verify code
                </h2>
              </div>

              <p className="text-xs text-ink-400">
                We sent a 6-digit code to{' '}
                <span className="font-semibold text-ink-200">{phone}</span>
              </p>

              {/* OTP boxes */}
              <div
                className="flex justify-between gap-2"
                onPaste={handleOtpPaste}
              >
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    autoFocus={i === 0}
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="h-12 w-12 rounded-xl border border-white/[0.1] bg-white/[0.05]
                      text-center text-xl font-bold text-ink-50 outline-none
                      ring-brand-500/60 transition focus:ring-2
                      caret-transparent"
                  />
                ))}
              </div>

              <FieldError msg={otpError} />

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.join('').length < 6}
                className="flex w-full items-center justify-center gap-2 rounded-2xl
                  bg-brand-500 px-4 py-3 text-sm font-semibold text-ink-950
                  transition hover:bg-brand-400 active:scale-[0.98]
                  disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {loading ? 'Verifying…' : 'Verify & continue'}
              </button>

              <button
                onClick={() => { setOtp(['','','','','','']); setOtpError(''); handleSendOtp(); }}
                className="w-full text-center text-xs text-ink-500 underline underline-offset-2
                  transition hover:text-ink-300"
              >
                Resend code
              </button>
            </div>
          )}

        </div>
      </div>

      {/* PWA install banner is shown on the login screen too */}
      <PWAInstallBanner standalone />

      {/* Legal modals */}
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}
