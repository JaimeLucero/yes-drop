'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient, resendConfirmation } from '@/lib/supabase'
import { BrandLogo } from '@/components/brand-logo'

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

const DONE = '/requests/new?welcome=1'

function ConfirmInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let done = false
    const finish = () => {
      if (done) return
      done = true
      router.replace(DONE)
    }

    // If the Supabase /verify redirect already established a session, we're done —
    // don't call verifyOtp again (that re-consumes a one-time token → 403/"stuck").
    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish()
    })

    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) return finish()

      const token_hash = params.get('token_hash')
      const type = params.get('type') as EmailOtpType | null
      if (token_hash && type) {
        const { error: verifyError } = await supabase.auth.verifyOtp({ type, token_hash })
        if (!done) {
          if (verifyError) setError(verifyError.message)
          else finish()
        }
        return
      }

      // Default ConfirmationURL flow: the ssr client exchanges the code/hash on load
      // (detectSessionInUrl). Give it a moment; onAuthStateChange resolves the success path.
      setTimeout(async () => {
        if (done) return
        const {
          data: { session: s2 },
        } = await supabase.auth.getSession()
        if (s2) finish()
        else setError('This confirmation link is invalid or has expired.')
      }, 4000)
    }

    run()
    return () => sub.data.subscription.unsubscribe()
  }, [params, router])

  const handleResend = async () => {
    const email = params.get('email')
    if (!email) return
    setResending(true)
    try {
      await resendConfirmation(email)
      setResent(true)
    } catch {
      /* ignore */
    } finally {
      setResending(false)
    }
  }

  const email = params.get('email')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <div className="mb-8">
        <BrandLogo href="/" />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {error ? (
          <div className="space-y-4">
            <h1 className="text-lg font-heading font-semibold text-foreground">We couldn&apos;t confirm your email</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            {resent ? (
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Sent — check your inbox for a fresh link.
              </p>
            ) : (
              email && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-sm font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  {resending ? 'Sending…' : 'Resend confirmation email'}
                </button>
              )
            )}
            <Link
              href="/login"
              className="mt-2 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <Spinner label="Confirming your email…" />
        )}
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/30">
          <Spinner label="Confirming your email…" />
        </div>
      }
    >
      <ConfirmInner />
    </Suspense>
  )
}
