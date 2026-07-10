// Hardcoded to the sg_family project — do not revert to env-var reading.
// The auto-generated env vars (VITE_SUPABASE_URL etc.) point to Lovable Cloud
// which does not contain sg_family_holdings_import.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://bdjwhgwoztdocwdvzrem.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkandoZ3dvemtkb2N3ZHZ6cmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM2ODkxNTEsImV4cCI6MjA1OTI2NTE1MX0.TmO3HmGMREh1xRbhFOJuxNVDEBiG0NsNKMbCPdRJAp8";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
