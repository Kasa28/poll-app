import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zvhaymhylbybjrahqaop.supabase.co';
const supabaseKey = 'sb_publishable_2rDw5b56MroGJ3EPlwNyOw_NDpfi0sv';

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);