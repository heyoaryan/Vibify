/**
 * Service Worker registration + update handling for Vibify PWA.
 *
 * - Registers /sw.js on page load
 * - Detects when a new SW is waiting and fires a custom DOM event
 *   so the UI can show an "Update available" prompt
 * - Dispatches 'vibify-sw-updated' when the new SW takes control,
 *   triggering an automatic page reload to apply the update
 */

const SW_PATH = '/sw.js';

function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(SW_PATH, {
        // 'classic' scope works for all same-origin PWAs
        scope: '/',
        // Bypass browser HTTP cache for the SW script itself so updates
        // are fetched immediately (default is to honour Cache-Control)
        updateViaCache: 'none',
      });

      // Check for updates every time the user visits a new page
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            // A new version is cached and ready — notify the UI
            window.dispatchEvent(new CustomEvent('vibify-sw-update-ready'));
          }
        });
      });

      // When the new SW takes control, reload once to apply the update
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!reloading) {
          reloading = true;
          window.location.reload();
        }
      });

      // Trigger an immediate check (catches updates between visits)
      if (registration.waiting) {
        window.dispatchEvent(new CustomEvent('vibify-sw-update-ready'));
      }

    } catch (err) {
      // Non-fatal — app still works without SW
      console.warn('[Vibify SW] Registration failed:', err);
    }
  });
}

registerSW();
