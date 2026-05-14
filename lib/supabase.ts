// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client público — usado no front-end
export const supabase = createClient<Database>(supabaseUrl, supabaseAnon)

// Client admin — usado nas API Routes (server-side apenas)
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseService, {
  auth: { autoRefreshToken: false, persistSession: false },
})
