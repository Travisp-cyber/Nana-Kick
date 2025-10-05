import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

/**
 * Server Supabase client for use in Server Components, Route Handlers, and Server Actions.
 * The cookie adapters allow Supabase Auth to refresh/set cookies during SSR when possible.
 *
 * Usage:
 *   import { createClient } from '@/lib/supabase/server'
 *   const supabase = createClient()
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // In immutable header contexts (e.g., static rendering), this will no-op.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options, maxAge: 0 })
          } catch {
            // In immutable header contexts, this will no-op.
          }
        },
      },
    },
  )
}
