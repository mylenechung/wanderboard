// src/supabaseClient.js
// ---------------------------------------------------------
// Install the client:  npm install @supabase/supabase-js
//
// Add these to your Vercel environment variables
// (and to a local .env for dev):
//   VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJh...
// ---------------------------------------------------------
import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnon = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    "Missing Supabase env vars. " +
    "Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnon);
