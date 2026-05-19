import { createClient } from '@supabase/supabase-js';

/**
 * Public Supabase project URL.
 *
 * Used to connect the frontend application with the Supabase project.
 */
const supabaseUrl = 'https://zvhaymhylbybjrahqaop.supabase.co';

/**
 * Public Supabase anon/publishable key.
 *
 * This key is safe for frontend usage when Supabase Row Level Security
 * policies are configured correctly.
 */
const supabaseKey = 'sb_publishable_2rDw5b56MroGJ3EPlwNyOw_NDpfi0sv';

/**
 * Supabase client instance used for database requests.
 *
 * Reused across the application to read and write survey data.
 */
export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);