import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const looksLikeJwt = (value: string) => value?.split('.').length === 3;

// Create a placeholder client that will fail gracefully if credentials are missing
let supabaseInstance: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
  if (!isValidHttpUrl(supabaseUrl)) {
    console.warn('[Supabase] VITE_SUPABASE_URL is not a valid URL:', supabaseUrl);
  }
  if (!looksLikeJwt(supabaseAnonKey)) {
    console.warn(
      '[Supabase] VITE_SUPABASE_ANON_KEY does not look like a Supabase anon key (JWT). Realtime will fail if this is wrong.'
    );
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
      // Free-tier friendly; prevents aggressive event bursts.
      params: { eventsPerSecond: 10 },
    },
  });
} else {
  console.warn('Supabase credentials not configured. Some features will not work.');
  // Create a mock client for development - will show errors but won't crash
  supabaseInstance = createClient('https://placeholder.supabase.co', 'placeholder-key');
}

export const supabase = supabaseInstance;
