import { createBrowserClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function origin(): string {
  return typeof window !== 'undefined' ? window.location.origin : ''
}

export async function signInWithGoogle() {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin()}/auth/callback`,
    },
  })
  if (error) throw error
  return data
}

/**
 * Create an account with email + password. With "Confirm email" enabled in
 * Supabase, this returns `session: null` and sends a verification email — the
 * caller should show a "check your inbox" state. Throws on already-registered.
 */
export async function signUpWithEmail(email: string, password: string, fullName?: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
      emailRedirectTo: `${origin()}/auth/confirm`,
    },
  })
  if (error) throw error
  // Supabase returns a user with an empty identities array when the email is
  // already registered (to avoid leaking account existence).
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    throw new Error('An account with this email already exists. Try signing in instead.')
  }
  return data
}

export class EmailNotConfirmedError extends Error {
  constructor() {
    super('Email not confirmed')
    this.name = 'EmailNotConfirmedError'
  }
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    if (/email not confirmed/i.test(error.message)) throw new EmailNotConfirmedError()
    throw error
  }
  return data
}

export async function resendConfirmation(email: string) {
  const supabase = createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${origin()}/auth/confirm` },
  })
  if (error) throw error
}

export async function requestPasswordReset(email: string) {
  const supabase = createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin()}/auth/reset`,
  })
  if (error) throw error
}

export async function updatePassword(newPassword: string) {
  const supabase = createClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
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
