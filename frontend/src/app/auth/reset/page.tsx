'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Lock, Eye, EyeOff } from 'lucide-react'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient, updatePassword } from '@/lib/supabase'
import { BrandLogo } from '@/components/brand-logo'

type Phase = 'verifying' | 'form' | 'error'

function Spinner() {
  return <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
}

function ResetInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [phase, setPhase] = useState<Phase>('verifying')
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const run = async () => {
      const supabase = createClient()
      // Session-first: the recovery /verify redirect may already have signed the
      // user in. Don't re-verify a one-time token (that 403s and wedges).
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        setPhase('form')
        return
      }

      const token_hash = params.get('token_hash')
      const type = (params.get('type') || 'recovery') as EmailOtpType
      if (token_hash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({ type, token_hash })
        if (verifyError) {
          setError(verifyError.message)
          setPhase('error')
          return
        }
        setPhase('form')
        return
      }

      setError('This reset link is invalid or has expired.')
      setPhase('error')
    }
    run()
  }, [params])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updatePassword(password)
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.')
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <div className="mb-8">
        <BrandLogo href="/" />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        {phase === 'verifying' && (
          <div className="py-6 text-center">
            <Spinner />
            <p className="mt-4 text-sm text-muted-foreground">Verifying your reset link…</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-4 text-center">
            <h1 className="text-lg font-heading font-semibold text-foreground">Reset link problem</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Back to sign in
            </Link>
          </div>
        )}

        {phase === 'form' && (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <h1 className="text-xl font-heading font-semibold text-foreground">Set a new password</h1>
              <p className="mt-1 text-sm text-muted-foreground">Choose a password to finish resetting your account.</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-sm font-medium text-foreground">
                New password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="new-password"
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/30">
          <Spinner />
        </div>
      }
    >
      <ResetInner />
    </Suspense>
  )
}
