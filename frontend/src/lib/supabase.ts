/**
 * Supabase Client Configuration
 *
 * Initializes and exports the Supabase client instance
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Create frontend/.env.local with:\n" +
      "VITE_SUPABASE_URL=https://njcwzwgjfqfirfnsuvhu.supabase.co\n" +
      "VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qY3d6d2dqZnFmaXJmbnN1dmh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2OTA5NzgsImV4cCI6MjA4NjI2Njk3OH0.LSsEn7PsVEsRxk9JvXMGTSLn1hm_Gz3b05N7qItLYFE",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
