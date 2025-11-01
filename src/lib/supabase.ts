import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log(SUPABASE_URL, SUPABASE_ANON_KEY);
let cachedClient: SupabaseClient | null = null;

function ensureConfig(): { url: string; anonKey: string } {
  if (!SUPABASE_URL) {
    throw new Error("Missing VITE_SUPABASE_URL. Populate it in your .env before building the extension.");
  }
  if (!SUPABASE_ANON_KEY) {
    throw new Error("Missing VITE_SUPABASE_ANON_KEY. Populate it in your .env before building the extension.");
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}

function createSupabaseClient(): SupabaseClient {
  const { url, anonKey } = ensureConfig();
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
      // Using implicit flow (tokens in hash) - simpler for extensions
    }
  });
}

export function getSupabase(): SupabaseClient {
  if (!cachedClient) {
    cachedClient = createSupabaseClient();
  }
  return cachedClient;
}

export type StoredSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number | null;
  user?: any | null;
};
