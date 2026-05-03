import { createBrowserClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function signInWithGoogle() {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  if (error) throw error
  return data
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) return null
  return user
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
}