import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
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
    },
  },
});
