'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'yesdrop_consent'
const GA_ID = process.env.NEXT_PUBLIC_GA_ID

type Choice = 'granted' | 'denied'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function gtag(...args: any[]) {
  if (typeof window === 'undefined') return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  if (typeof w.gtag === 'function') w.gtag(...args)
}

function applyConsent(choice: Choice) {
  gtag('consent', 'update', {
    analytics_storage: choice === 'granted' ? 'granted' : 'denied',
  })
}

// Cookie-consent gate for GA4 (Consent Mode v2). Analytics defaults to denied;
// this banner lets the visitor accept or decline and persists the choice.
// Returning visitors re-apply their stored choice on load. Renders nothing
// when analytics is disabled (no GA id) or a choice already exists.
export function ConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!GA_ID) return
    const stored = localStorage.getItem(STORAGE_KEY) as Choice | null
    if (stored) {
      applyConsent(stored)
      return
    }
    setVisible(true)
  }, [])

  function choose(choice: Choice) {
    localStorage.setItem(STORAGE_KEY, choice)
    applyConsent(choice)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-muted-foreground">
          We use analytics cookies to understand how YesDrop is used and improve it. See our{' '}
          <Link href="/privacy" className="font-medium text-foreground underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => choose('denied')}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Decline
          </button>
          <button
            onClick={() => choose('granted')}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
