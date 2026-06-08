// Supabase client — only instantiated when VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY are present in the environment.
// Without them the app runs entirely on dummy-data.ts (no errors).
//
// To activate Supabase:
//   1. Create a project at https://supabase.com
//   2. Add to .env.local:
//        VITE_SUPABASE_URL=https://your-project.supabase.co
//        VITE_SUPABASE_ANON_KEY=your-anon-key
//   3. Run the SQL schema from the project README
//   4. Import your Excel CSVs via Supabase Dashboard → Table Editor
//   5. Restart the dev server — the app switches automatically

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = url && key ? createClient(url, key) : null;
