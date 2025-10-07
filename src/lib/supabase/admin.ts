import { createClient } from '@supabase/supabase-js'

// Admin Supabase client using the service role key.
// IMPORTANT: Never import this in client components.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
  }
)