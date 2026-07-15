import { X } from 'lucide-react';

// ─── Shared scroll sheet ──────────────────────────────────────────────────────

function LegalSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl border border-white/[0.08]
          bg-ink-900 shadow-2xl sm:h-[80vh] sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="font-display text-base font-semibold text-ink-50">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-ink-400
              transition hover:bg-white/[0.1]"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 text-sm leading-relaxed text-ink-300">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1.5 mt-5 font-semibold text-ink-100 first:mt-0">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-ink-300">{children}</p>;
}

// ─── Terms of Service ─────────────────────────────────────────────────────────

export function TermsModal({ onClose }: { onClose: () => void }) {
  return (
    <LegalSheet title="Terms of Service" onClose={onClose}>
      <P>Last updated: July 2026</P>

      <H>1. Acceptance</H>
      <P>
        By accessing or using Vibify ("the Service") you agree to be bound by these Terms. If you
        do not agree, please do not use the Service.
      </P>

      <H>2. Description of Service</H>
      <P>
        Vibify is a music-streaming web application that lets you discover, play, and organise
        songs. The Service is provided "as is" and is currently in active development. Features,
        availability, and content may change without notice.
      </P>

      <H>3. Eligibility</H>
      <P>
        You must be at least 13 years old to use Vibify. By signing in you confirm you meet this
        requirement. Users under 18 should have parental consent.
      </P>

      <H>4. User Accounts</H>
      <P>
        You are responsible for maintaining the confidentiality of your account credentials and for
        all activity that occurs under your account. Notify us immediately if you suspect
        unauthorised access.
      </P>

      <H>5. Acceptable Use</H>
      <P>You agree not to:</P>
      <ul className="mb-3 list-disc pl-5 text-ink-300 space-y-1">
        <li>Use the Service for any unlawful purpose</li>
        <li>Attempt to reverse-engineer, scrape, or abuse the Service's APIs</li>
        <li>Upload or transmit malicious code</li>
        <li>Impersonate any person or entity</li>
      </ul>

      <H>6. Intellectual Property</H>
      <P>
        Music content is streamed via third-party sources. Vibify does not claim ownership of any
        audio content. All Vibify UI, branding, and original code are owned by the Vibify team and
        may not be reproduced without permission.
      </P>

      <H>7. Disclaimer of Warranties</H>
      <P>
        The Service is provided without warranties of any kind, express or implied. We do not
        guarantee uninterrupted availability, accuracy of content, or fitness for a particular
        purpose.
      </P>

      <H>8. Limitation of Liability</H>
      <P>
        To the maximum extent permitted by law, Vibify and its team shall not be liable for any
        indirect, incidental, or consequential damages arising from your use of the Service.
      </P>

      <H>9. Changes to Terms</H>
      <P>
        We may revise these Terms at any time. Continued use of the Service after changes
        constitutes acceptance of the updated Terms.
      </P>

      <H>10. Contact</H>
      <P>
        For questions about these Terms, reach out via the feedback option in the app or through
        our official channels.
      </P>
    </LegalSheet>
  );
}

// ─── Privacy Policy ───────────────────────────────────────────────────────────

export function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <LegalSheet title="Privacy Policy" onClose={onClose}>
      <P>Last updated: July 2026</P>

      <H>1. Information We Collect</H>
      <P>When you sign in we collect:</P>
      <ul className="mb-3 list-disc pl-5 text-ink-300 space-y-1">
        <li>
          <strong className="text-ink-200">Account data</strong> — your name, email address, and
          profile picture provided by Google OAuth or phone authentication.
        </li>
        <li>
          <strong className="text-ink-200">Usage data</strong> — recently played songs and
          listening statistics, stored locally on your device.
        </li>
        <li>
          <strong className="text-ink-200">Device data</strong> — browser type, OS, and general
          location (country-level) for analytics.
        </li>
      </ul>

      <H>2. How We Use Your Information</H>
      <ul className="mb-3 list-disc pl-5 text-ink-300 space-y-1">
        <li>To authenticate you and maintain your session</li>
        <li>To personalise your listening experience (history, recommendations)</li>
        <li>To improve the Service and fix bugs</li>
        <li>To send important Service-related notifications (no marketing spam)</li>
      </ul>

      <H>3. Data Storage</H>
      <P>
        Account data is stored securely via Supabase (PostgreSQL) with encryption at rest and in
        transit. Listening history is stored in your browser's local storage and is never uploaded
        to our servers without your consent.
      </P>

      <H>4. Third-Party Services</H>
      <P>
        We use trusted third-party services for authentication, database storage, and music
        streaming. These services operate under their own privacy policies and do not receive your
        personal data beyond what is necessary to provide the Service.
      </P>

      <H>5. Cookies & Local Storage</H>
      <P>
        We use browser local storage and session storage to remember your preferences and session
        state. No third-party tracking cookies are used.
      </P>

      <H>6. Data Sharing</H>
      <P>
        We do not sell, rent, or share your personal data with third parties for marketing
        purposes. Data may be disclosed if required by law.
      </P>

      <H>7. Your Rights</H>
      <P>You have the right to:</P>
      <ul className="mb-3 list-disc pl-5 text-ink-300 space-y-1">
        <li>Access the personal data we hold about you</li>
        <li>Request correction or deletion of your data</li>
        <li>Withdraw consent at any time by deleting your account</li>
      </ul>

      <H>8. Children's Privacy</H>
      <P>
        Vibify is not directed at children under 13. We do not knowingly collect personal data
        from children under 13.
      </P>

      <H>9. Changes to this Policy</H>
      <P>
        We may update this Privacy Policy periodically. We will notify you of material changes via
        the app.
      </P>

      <H>10. Contact</H>
      <P>
        For privacy-related requests, reach out via the feedback option in the app or through our
        official channels.
      </P>
    </LegalSheet>
  );
}
