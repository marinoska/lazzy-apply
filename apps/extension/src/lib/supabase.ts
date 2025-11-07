import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

// Environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Cached client instance
let cachedClient: SupabaseClient | null = null;

/**
 * Session data stored in Chrome storage
 */
export interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at: number | null;
  user: User | null;
}

/**
 * Validate required environment variables
 */
function validateConfig(): { url: string; anonKey: string } {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file."
    );
  }

  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}

/**
 * Create a new Supabase client instance
 */
function createSupabaseClient(): SupabaseClient {
  const { url, anonKey } = validateConfig();

  return createClient(url, anonKey, {
    auth: {
      // Don't persist session in browser - we handle it manually in Chrome storage
      persistSession: false,
      // Enable auto-refresh to keep users logged in
      autoRefreshToken: true,
      // Don't detect session in URL - we use implicit flow with hash fragments
      detectSessionInUrl: false
    }
  });
}

/**
 * Get or create the Supabase client singleton
 */
export function getSupabase(): SupabaseClient {
  if (!cachedClient) {
    cachedClient = createSupabaseClient();
  }
  return cachedClient;
}
