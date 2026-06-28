'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { connectGoogleToken } from '@/lib/api'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function handleCallback() {
      const supabase = createClient()
      const { data, error: fetchError } = await supabase.auth.getSession()

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      if (data.session) {
        // Capture the one-time Google refresh token for Gmail sending.
        const rt = data.session.provider_refresh_token
        if (rt) {
          try {
            await connectGoogleToken(rt, data.session.user?.email)
          } catch {
            /* non-fatal — user can connect later from settings */
          }
        }
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    }

    handleCallback()
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-8 max-w-md text-center">
          <p className="text-red-600 dark:text-red-400 font-medium">Authentication Error</p>
          <p className="text-red-500 dark:text-red-500 text-sm mt-2">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
        <p className="text-foreground/60 font-medium">Completing sign in...</p>
      </div>
    </div>
  )
}