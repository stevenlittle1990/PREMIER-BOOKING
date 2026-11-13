import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Set these in Netlify environment variables (and a local .env for development, or EAS for the phone apps).
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const isWeb = Platform.OS === 'web';

// Null until the database is connected (and during the static web build); screens fall back to the built-in catalog.
// Web keeps the login in the browser; the iPhone/Android app keeps it in the phone's app storage.
export const supabase =
  url && key && (!isWeb || typeof window !== 'undefined')
    ? createClient(url, key, { auth: { storage: isWeb ? undefined : AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: isWeb } })
    : null;

export const hasDatabase = Boolean(url && key);
