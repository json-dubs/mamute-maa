import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@mamute/config";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error("Supabase URL or anon key missing");
  }

  cachedClient = createClient(url, anonKey, {
    auth: { persistSession: true }
  });
  return cachedClient;
}
