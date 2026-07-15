import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Create a .env file (see .env.example).',
  );
}

// Main client: used for everything, persists the logged-in session.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// A second, throwaway client with no session persistence. We use this only
// when an Admin creates a new team member: calling supabase.auth.signUp on
// the MAIN client would overwrite the admin's own logged-in session with the
// brand new user's session. This isolated client has its own in-memory-only
// auth state, so creating a user never disturbs the admin's session.
export function createIsolatedClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const PRODUCT_PHOTOS_BUCKET = 'product-photos';
