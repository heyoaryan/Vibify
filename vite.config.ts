import { defineConfig, splitVendorChunkPlugin } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Automatically splits node_modules into a stable "vendor" chunk so
    // app code changes don't bust the cached vendor bundle.
    splitVendorChunkPlugin(),
  ],

  // ── Build optimizations ───────────────────────────────────────────────────
  build: {
    // Target modern browsers only (ES2020+). Drops legacy polyfills and
    // enables native optional-chaining, nullish-coalescing, etc. in output.
    target: ['es2020', 'chrome87', 'firefox78', 'safari14', 'edge88'],

    // Raise the warning threshold — our chunks are intentionally split
    chunkSizeWarningLimit: 600,

    // Minify with esbuild (default, fast) — terser gives <2% extra saving
    // but adds 10 s to build time; esbuild is the right trade-off here.
    minify: 'esbuild',

    // CSS minification is on by default in Vite 5
    cssMinify: true,

    rollupOptions: {
      output: {
        // ── Manual chunk splitting ──────────────────────────────────────
        // Splits the bundle into stable, cacheable pieces. Users only
        // re-download the chunk that actually changed after a deploy.
        manualChunks(id) {
          // React runtime — changes almost never
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          // Supabase — large SDK, changes infrequently
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
          // Lucide icons — large icon set, rarely updated
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // All other node_modules go into a shared vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor-misc';
          }
          // Views are already lazy-loaded via React.lazy — Rollup will
          // automatically create separate async chunks for them.
          // No manual override needed here.
        },

        // Stable file names — content-hash fingerprinting for long-lived
        // HTTP cache (immutable assets served with max-age=31536000)
        entryFileNames:  'assets/[name]-[hash].js',
        chunkFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash][extname]',
      },
    },

    // Generate a build manifest so the server can inject preload hints
    // (used by Vercel/Netlify edge functions and Vite SSR if ever added)
    manifest: true,

    // Source maps for production error tracking (hidden — not served publicly)
    // Set to false if you don't use Sentry / error monitoring
    sourcemap: false,
  },

  // ── Dep pre-bundling ──────────────────────────────────────────────────────
  optimizeDeps: {
    // lucide-react is a pure ESM package with hundreds of named exports —
    // pre-bundling it causes the entire icon set to be included even if only
    // a few icons are used. Let Rollup tree-shake it during build instead.
    exclude: ['lucide-react'],
  },

  // ── Dev server ────────────────────────────────────────────────────────────
  server: {
    proxy: {
      // Proxy JioSaavn API calls through the dev server to avoid CORS blocks
      '/jiosaavn': {
        target: 'https://www.jiosaavn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/jiosaavn/, ''),
        secure: true,
      },
      // Proxy lrclib.net to avoid CORS blocks in the browser
      '/lrclib': {
        target: 'https://lrclib.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lrclib/, ''),
        secure: true,
      },
      // Proxy lyrics.ovh to avoid CORS blocks in the browser
      '/lyricsovh': {
        target: 'https://api.lyrics.ovh',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lyricsovh/, ''),
        secure: true,
      },
      // Proxy Jamendo API to avoid CORS blocks in the browser
      '/api/jamendo': {
        target: 'https://api.jamendo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/jamendo/, '/v3.0'),
        secure: true,
      },
    },
  },
});
