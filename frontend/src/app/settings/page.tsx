'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AuthGuard } from '@/components/auth-guard'
import { GmailAccountCard } from '@/components/connect-gmail'

export default function SettingsPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-2xl space-y-6 px-6 py-8">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-foreground">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Approval emails are sent from your own Gmail. Replies come back to your inbox.
            </p>
          </div>
          <GmailAccountCard />
        </main>
      </div>
    </AuthGuard>
  )
}
