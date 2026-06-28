'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, signOut } from '@/lib/supabase'

/**
 * Client-side gate for authenticated pages. Redirects to /login when there is
 * no session, and signs out + redirects unverified users (email_confirmed_at
 * null) — so the app stays inaccessible until the email is verified, even if
 * Supabase's "Confirm email" toggle were ever off.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    const check = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!active) return

      if (!user) {
        router.replace('/login')
        return
      }
      if (!user.email_confirmed_at) {
        await signOut()
        router.replace('/login?verify=1')
        return
      }
      setReady(true)
    }
    check()
    return () => {
      active = false
    }
  }, [router])

  if (!ready) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
