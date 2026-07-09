// Supabase client for the user's existing project (NOT Lovable Cloud).
// The project URL and publishable anon key are pinned here because the
// auto-managed .env points VITE_SUPABASE_URL at the Lovable Cloud backend,
// which does not contain sg_family_holdings_import.

import { createClient } from "@supabase/supabase-js";

const PROJECT_URL = "https://bdjwhgwoztdocwdvzrem.supabase.co";
const PROJECT_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkandoZ3dvemtkb2N3ZHZ6cmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM2ODkxNTEsImV4cCI6MjA1OTI2NTE1MX0.TmO3HmGMREh1xRbhFOJuxNVDEBiG0NsNKMbCPdRJAp8";

if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.log("[supabase] using project:", PROJECT_URL);
}

export const supabase = createClient(PROJECT_URL, PROJECT_ANON_KEY);
