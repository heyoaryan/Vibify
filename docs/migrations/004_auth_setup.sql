-- ============================================================
-- Migration 004 — Auth providers setup notes
-- ============================================================
-- These settings are configured via the Supabase Dashboard
-- (Authentication → Providers), NOT via SQL.
-- This file documents exactly what needs to be enabled.
-- ============================================================

-- ── 1. Google OAuth ─────────────────────────────────────────
--
-- Dashboard path:
--   Authentication → Providers → Google → Enable
--
-- Required fields:
--   Client ID      → from Google Cloud Console (OAuth 2.0)
--   Client Secret  → from Google Cloud Console
--
-- Authorised redirect URI to add in Google Cloud Console:
--   https://<your-project-ref>.supabase.co/auth/v1/callback
--
-- In src/auth.ts, redirectTo is set to:
--   window.location.origin   (your Vercel deployment URL)
--
-- Add this to "Allowed Redirect URLs" in Supabase Dashboard:
--   Authentication → URL Configuration → Redirect URLs
--   https://your-vercel-app.vercel.app          (production)
--   http://localhost:5173                        (local dev)


-- ── 2. Phone / SMS OTP ──────────────────────────────────────
--
-- Dashboard path:
--   Authentication → Providers → Phone → Enable
--
-- Requires a Twilio (or equivalent) account:
--   Twilio Account SID
--   Twilio Auth Token
--   Twilio Verify Service SID  OR  "From" phone number
--
-- OTP expiry (recommended): 600 seconds (10 min)
-- OTP length: 6 digits
--
-- In src/auth.ts:
--   signInWithPhone(phone)  → sends SMS OTP
--   verifyOtp(phone, token) → verifies 6-digit OTP


-- ── 3. Site URL ─────────────────────────────────────────────
--
-- Dashboard path:
--   Authentication → URL Configuration → Site URL
--
-- Set to your production Vercel URL:
--   https://your-vercel-app.vercel.app
--
-- Add localhost as an additional redirect URL for local dev:
--   http://localhost:5173


-- ── 4. JWT expiry (optional tuning) ─────────────────────────
--
-- Dashboard path:
--   Authentication → JWT Settings
--
-- Default: 3600 s (1 hour access token)
-- Refresh token rotation is enabled by default — leave it on.
-- The Supabase client in src/supabase.ts sets autoRefreshToken: true
-- so tokens refresh silently without user interaction.


-- ── 5. SQL: expose auth.uid() helper (already built-in) ─────
--
-- Supabase exposes auth.uid() in every RLS policy automatically.
-- No extra SQL needed. The policies in migrations 001–003 use it.
