import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cached service-role Supabase client for trusted server-only paths
 * (payment webhooks, cron jobs).
 *
 * NEVER expose this client or its results to a request-scoped code path that is
 * reachable by a user without an explicit authorization check — it bypasses RLS.
 */

let cachedClient: SupabaseClient | null = null;
let cachedUrl: string | null = null;
let cachedKey: string | null = null;

export function isAdminConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Returns the shared service-role client, or `null` when the environment is not
 * configured (callers must fail closed instead of assuming an admin context).
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  if (cachedClient && cachedUrl === url && cachedKey === key) {
    return cachedClient;
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  cachedUrl = url;
  cachedKey = key;

  return cachedClient;
}
