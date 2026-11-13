import { createClient } from '@supabase/supabase-js';

// Set these in Netlify environment variables (and a local .env for development).
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

// Null until the database is connected; screens fall back to the built-in catalog.
export const supabase =
  url && key && typeof window !== 'undefined'
    ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    : null;

export const hasDatabase = Boolean(url && key);
