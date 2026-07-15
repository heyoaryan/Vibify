/**
 * Supabase client — single shared instance for the whole app.
 *
 * Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
 * (copy from .env.example and fill in your project values).
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. ' +
    'Copy .env.example → .env.local and fill in your project values.',
  );
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder',
  {
    auth: {
      // Persist session in localStorage so users stay logged in across reloads
      persistSession: true,
      // Automatically refresh the access token before it expires
      autoRefreshToken: true,
      // Detect the OAuth callback hash/query on page load
      detectSessionInUrl: true,
    },
  },
);
