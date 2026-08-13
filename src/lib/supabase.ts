import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const globalForSupabase = globalThis as unknown as {
  supabaseAdmin: SupabaseClient | undefined;
};

/**
 * Service-role Supabase client. Server-only — never import this from a
 * Client Component. Used for privileged storage writes (avatar/banner
 * uploads); reads of public asset URLs don't need this client at all.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (globalForSupabase.supabaseAdmin) return globalForSupabase.supabaseAdmin;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use Supabase Storage.",
    );
  }

  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  globalForSupabase.supabaseAdmin = client;
  return client;
}

export const AVATAR_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET ?? "wager-media";
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
