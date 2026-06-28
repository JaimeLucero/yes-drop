'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react'
import { getGoogleStatus, disconnectGoogle } from '@/lib/api'
import { connectGmail } from '@/lib/supabase'

export function useGoogleStatus() {
  return useQuery({ queryKey: ['google-status'], queryFn: getGoogleStatus, staleTime: 30_000 })
}

async function startConnect() {
  try {
    await connectGmail()
  } catch (e) {
    // linkIdentity needs manual linking enabled; fall back to a plain re-auth.
    const { signInWithGoogle } = await import('@/lib/supabase')
    await signInWithGoogle().catch(() => {
      throw e
    })
  }
}

/** Compact gate shown above the send form when Gmail isn't connected. */
export function ConnectGmailBanner() {
  const { data, isLoading } = useGoogleStatus()
  const [busy, setBusy] = useState(false)
  if (isLoading || data?.connected) return null
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <Mail className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">Connect Gmail to send</p>
        <p className="text-sm text-muted-foreground">
          YesDrop sends approval emails from your own Gmail, so replies land straight in your inbox.
        </p>
      </div>
      <button
        onClick={async () => {
          setBusy(true)
          try {
            await startConnect()
          } finally {
            setBusy(false)
          }
        }}
        disabled={busy}
        className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? 'Opening…' : 'Connect Gmail'}
      </button>
    </div>
  )
}

/** Full account card for the settings page. */
export function GmailAccountCard() {
  const { data, isLoading } = useGoogleStatus()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Mail className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Sending account</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Checking…</p>
          ) : data?.connected ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              {data.email || 'Gmail connected'}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No Gmail connected — you can&apos;t send requests yet.</p>
          )}
        </div>
        {!isLoading &&
          (data?.connected ? (
            <button
              onClick={async () => {
                setBusy(true)
                try {
                  await disconnectGoogle()
                  await queryClient.invalidateQueries({ queryKey: ['google-status'] })
                } finally {
                  setBusy(false)
                }
              }}
              disabled={busy}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={async () => {
                setBusy(true)
                try {
                  await startConnect()
                } finally {
                  setBusy(false)
                }
              }}
              disabled={busy}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? 'Opening…' : 'Connect Gmail'}
            </button>
          ))}
      </div>
      {data?.last_error && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Last send error — try reconnecting.
        </p>
      )}
    </div>
  )
}
