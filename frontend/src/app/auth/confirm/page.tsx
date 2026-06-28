'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import { BrandLogo } from '@/components/brand-logo'

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function ConfirmInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const token_hash = params.get('token_hash')
      const type = params.get('type') as EmailOtpType | null
      if (!token_hash || !type) {
        setError('This confirmation link is invalid or has expired.')
        return
      }
      const supabase = createClient()
      const { error: verifyError } = await supabase.auth.verifyOtp({ type, token_hash })
      if (verifyError) {
        setError(verifyError.message)
        return
      }
      // Drop the just-verified user straight into creating their first request.
      router.replace('/requests/new?welcome=1')
    }
    run()
  }, [params, router])

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
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
