# PWA, Secure Downloads, and Platform Packaging — Arsith Tunes

This document outlines practical, actionable steps to finalize PWA installability, secure downloadable assets, and produce platform-specific installers with signature verification.

## 1. Workbox service worker
- Use the Workbox-based service worker (`/public/sw-workbox.js`) to implement:
  - Precaching of the app shell (manifest, index.html, main JS/CSS assets).
  - Runtime caching rules:
    - Navigation requests: `NetworkFirst` with fallback to `index.html`.
    - Static assets (CSS/JS): `StaleWhileRevalidate`.
    - Images and media thumbnails: `CacheFirst` with a size + age limit.
    - Media streaming (audio files): `NetworkFirst` or custom range request handling.
  - Analytics queueing: enable `workbox-google-analytics` to safely queue offline hits.

Note: We added a basic Workbox sw in `/public/sw.js`. For advanced control, generate the sw at build time using `workbox-build`.

## 2. HTTPS, secure headers, and CDN
- Serve the site via HTTPS with a valid TLS certificate (Let's Encrypt or managed by hosting provider).
- Use security headers (set by server/CDN):
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `Content-Security-Policy` tailored to your script/style origins.
  - `Cross-Origin-Resource-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`.
- When using a CDN, enable `Origin` protection and signed URLs if serving private media.

## 3. Subresource Integrity (SRI)
- For static third-party resources or CDN-served JS/CSS, publish SRI hashes with the assets.
- Example: `<script src="..." integrity="sha256-..." crossorigin="anonymous"></script>`
- For our build, generate SHA-256 checksums for built assets during CI and embed them in release metadata.

## 4. Download verification (client + server)
- Server-side:
  - For each downloadable artifact, produce a SHA-256 checksum (base64) and an optional detached signature.
  - Publish both `artifact` and `artifact.sha256` (or `.sig`) next to the release.
  - Consider using sigstore/cosign for signing artifacts and publishing provenance.
- Client-side:
  - We added `src/components/DownloadVerifier.tsx` to fetch a URL, compute SHA-256 (via Web Crypto), compare to `sha256-<base64>` value, and offer the verified file for saving.
  - This requires the server to publish the checksum string (or SRI-style `sha256-...`) for comparison.

## 5. Platform installers & signing
- macOS (notarized app or signed DMG):
  - Build a native wrapper (e.g., using Electron or Tauri).
  - Code-sign with an Apple Developer ID and submit to Apple notarization service.
  - Publish the signed artifact and provide an accompanying SHA-256 checksum + signature.
- Windows (EXE/MSI):
  - Code-sign binaries using an Authenticode certificate (EV preferred).
  - Provide SHA-256 checksum and signature for users to verify.
- Linux (AppImage, deb, rpm):
  - Sign packages and publish checksums/signatures.

## 6. Release and verification workflow (CI)
- CI jobs should:
  - Build artifacts
  - Produce checksums (SHA-256 base64 and hex)
  - Sign artifacts using `cosign` or vendor certificates
  - Upload to releases (GitHub Releases, S3 + CloudFront)
  - Publish `checksums.txt` and `signatures/` alongside artifacts

## 7. User UX recommendations
- When offering downloads from the web UI, show:
  - The expected checksum (sha256- base64) and a single-click "Verify" that uses the client verifier.
  - A warning if verification fails and deny automatic installation.
- For in-browser installs (PWA), make `navigator.canInstall` prompts contextual and only after a user gesture.

## Next steps we can implement for you
- Integrate Workbox build-time precache via `workbox-build` in the Vite build.
- Add CI scripts (GitHub Actions) to build artifacts, generate SRI/SHA-256, and sign with `cosign`.
- Scaffold platform packaging (Electron/Tauri) and CI notarization steps.

