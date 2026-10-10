"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Publishable values. Safe to ship to the browser; row-level security in the
// database is what protects the data. Override with env vars if needed.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jeyywoicnsxnmyrkpxji.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable__TnHan3g_cM5VvEEzAJkSw_g_zKAU04";

/** "local" runs entirely in the browser on sample data (used for offline previews). */
export const DATA_MODE: "supabase" | "local" = process.env.NEXT_PUBLIC_DATA_MODE === "local" ? "local" : "supabase";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(URL, KEY, {
      auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
