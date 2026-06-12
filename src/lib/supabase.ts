// Supabase client for the user's existing project (NOT Lovable Cloud).
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from env, with the
// user-provided publishable values as a fallback so the dashboard always
// targets the correct project even if .env is not set in this environment.

import { createClient } from "@supabase/supabase-js";

const FALLBACK_URL = "https://bdjwhgwoztdocwdvzrem.supabase.co";
const FALLBACK_ANON_KEY = "sb_publishable_dvvYgNznrT8fMI3ZwCw3cg_y0YNBgU4";

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const url = envUrl || FALLBACK_URL;
const key = envKey || FALLBACK_ANON_KEY;

if (typeof window !== "undefined") {
  // Temporary debug logs — remove once verified.
  // eslint-disable-next-line no-console
  console.log("[supabase] VITE_SUPABASE_URL exists:", !!envUrl);
  // eslint-disable-next-line no-console
  console.log("[supabase] VITE_SUPABASE_ANON_KEY exists:", !!envKey);
  // eslint-disable-next-line no-console
  console.log("[supabase] using URL:", url);
}

export const supabase = createClient(url, key);
