'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowRight, CheckCircle, Zap, Shield, BarChart3, Mail, Upload, Play } from 'lucide-react'
import { Footer } from '@/components/footer'
import { StatStrip } from '@/components/landing/stat-strip'
import { StatsSection } from '@/components/landing/stats-section'
import { DemoWalkthroughModal } from '@/components/demo-walkthrough-modal'
import { StatusDot } from '@/components/dashboard/status-meta'

const PREVIEW_ROWS = [
  { title: 'Budget approval — Q3', who: 'cfo@acme.com', status: 'approved' as const, time: '2m' },
  { title: 'Contract review', who: 'legal@acme.com', status: 'pending' as const, time: '1h' },
  { title: 'Vendor MSA renewal', who: 'ops@acme.com', status: 'scheduled' as const, time: 'Tue' },
]

function InboxPreview() {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-heading font-semibold text-foreground">Requests</span>
        <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">New request</span>
      </div>
      <ul className="divide-y divide-border">
        {PREVIEW_ROWS.map((r) => (
          <li key={r.title} className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
              {r.who[0].toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{r.title}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <StatusDot status={r.status} />
                <span className="truncate">{r.who}</span>
              </span>
            </span>
            <span className="data-num shrink-0 text-[11px] text-muted-foreground">{r.time}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [demoOpen, setDemoOpen] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const user = await getCurrentUser()
      if (user) router.push('/dashboard')
      else setIsLoading(false)
    }
    checkAuth()
  }, [router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground">
      {/* Hero */}
      <section className="flex min-h-screen items-center pt-20 pb-24">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div className="flex flex-col items-center space-y-8 text-center lg:items-start lg:text-left">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Fast, simple, reliable</span>
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl font-heading font-bold leading-tight lg:text-6xl">
                  Approval requests, <span className="text-primary">made simple</span>
                </h1>
                <p className="max-w-lg text-xl leading-relaxed text-muted-foreground">
                  Send an approval request in seconds, get a one-click decision by email, and track every
                  response in one place.
                </p>
              </div>

              <div className="flex w-full flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Link
                  href="/login"
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-7 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
                >
                  Get started free
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <button
                  onClick={() => setDemoOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-7 py-3 font-medium text-foreground transition-colors hover:bg-muted sm:w-auto"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Watch demo
                </button>
              </div>

              <div className="flex w-full justify-center border-t border-border pt-6 lg:justify-start">
                <StatStrip />
              </div>
            </div>

            <div className="hidden justify-center lg:flex">
              <InboxPreview />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-card/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-heading font-bold lg:text-5xl">Everything you need</h2>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              Powerful features that make approval workflows effortless.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Zap, title: 'Lightning fast', description: 'Send a request in seconds and track responses in real time with automatic email notifications.' },
              { icon: Shield, title: 'Secure & reliable', description: 'Enterprise-grade security with OAuth 2.0 sign-in and encrypted data at rest.' },
              { icon: BarChart3, title: 'Full visibility', description: 'A clean dashboard with status tracking, analytics, and activity history for every request.' },
              { icon: Mail, title: 'Smart notifications', description: 'Approvers decide straight from the email — clickable approve and reject links, no sign-in.' },
              { icon: Upload, title: 'File support', description: 'Attach any file or document to a request for complete context.' },
              { icon: CheckCircle, title: 'Audit trail', description: 'A complete history of approvals and rejections for compliance and accountability.' },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-background p-7 transition-colors hover:border-primary/40"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-heading font-semibold text-foreground">{feature.title}</h3>
                <p className="leading-relaxed text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data-driven stats */}
      <StatsSection />

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="rounded-2xl bg-primary px-8 py-16 text-center text-primary-foreground">
            <h2 className="mb-4 text-3xl font-heading font-bold lg:text-4xl">Ready to simplify approvals?</h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-primary-foreground/80">
              Get started in minutes. No credit card required.
            </p>
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 rounded-lg bg-background px-8 py-3.5 font-medium text-foreground transition-colors hover:bg-background/90"
            >
              Get started free
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />

      <DemoWalkthroughModal open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  )
}
