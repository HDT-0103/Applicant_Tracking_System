import { createClient } from '@supabase/supabase-js'

// Next reads .env from its project directory (src/frontend), not the repo root,
// so the npm scripts load the root .env via env-cmd. Without that these are
// undefined and supabase-js fails with a bare "supabaseUrl is required".
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    !supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL',
    !supabaseAnonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ].filter(Boolean).join(', ')

  throw new Error(
    `Missing ${missing}. Add them to the repo-root .env and start the app with ` +
    `"npm run dev" (which loads that file via env-cmd). Note that NEXT_PUBLIC_ ` +
    `variables are inlined at build time, so restart after changing them.`,
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
