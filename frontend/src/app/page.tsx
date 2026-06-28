'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowRight, Play, Zap, Send, CalendarClock, BellRing, Inbox } from 'lucide-react'
import { Footer } from '@/components/footer'
import { StatStrip } from '@/components/landing/stat-strip'
import { StatsSection } from '@/components/landing/stats-section'
import { FlowDemo } from '@/components/landing/flow-demo'
import { HowItWorks } from '@/components/landing/how-it-works'
import { UseCases } from '@/components/landing/use-cases'
import { Faq } from '@/components/landing/faq'
import { DemoWalkthroughModal } from '@/components/demo-walkthrough-modal'

const SIGNUP_HREF = '/login?mode=signup'

export default function LandingPage() {
  const router = useRouter()
  const [demoOpen, setDemoOpen] = useState(false)

  // Render the landing immediately; only send already-signed-in users onward.
  // (Gating the whole page behind a loading flag wedged the back button when
  // returning to a hashed URL like /#how-it-works.)
  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) router.replace('/dashboard')
    })
  }, [router])

  return (
    <div className="bg-background text-foreground">
      {/* Hero */}
      <section className="relative flex min-h-screen items-center overflow-hidden pt-20 pb-24">
        {/* Ambient backdrop */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="animate-aurora-drift absolute -left-24 -top-24 h-[34rem] w-[34rem] rounded-full bg-primary/15 blur-3xl" />
          <div
            className="animate-aurora-drift absolute right-[-6rem] top-10 h-[28rem] w-[28rem] rounded-full bg-sky-400/15 blur-3xl"
            style={{ animationDelay: '-8s' }}
          />
          <svg
            className="absolute inset-0 h-full w-full text-foreground"
            style={{
              maskImage: 'radial-gradient(ellipse 70% 60% at 60% 30%, black 25%, transparent 80%)',
              WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 60% 30%, black 25%, transparent 80%)',
            }}
          >
            <defs>
              <pattern id="hero-dots" width="26" height="26" patternUnits="userSpaceOnUse">
                <circle cx="1.4" cy="1.4" r="1.4" fill="currentColor" opacity="0.06" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-dots)" />
          </svg>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div className="flex flex-col items-center space-y-8 text-center lg:items-start lg:text-left">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Email approvals on autopilot</span>
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-heading font-semibold leading-tight tracking-tight lg:text-[3.4rem]">
                  Approvals that don&apos;t need <span className="text-primary">chasing</span>
                </h1>
                <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
                  Send an approval request by email, set a deadline, and let automatic reminders chase the
                  reply — every response tracked in one place.
                </p>
              </div>

              <div className="flex w-full flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Link
                  href={SIGNUP_HREF}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-7 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
                >
                  Start for free
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <button
                  onClick={() => setDemoOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-7 py-3 font-medium text-foreground transition-colors hover:bg-muted sm:w-auto"
                >
                  <Play className="h-4 w-4 fill-current" />
                  See how it works
                </button>
              </div>

              <div className="flex w-full justify-center border-t border-border pt-6 lg:justify-start">
                <StatStrip />
              </div>
            </div>

            <div className="relative mt-4 flex justify-center lg:mt-0">
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl"
              />
              <div className="relative w-full max-w-md">
                <FlowDemo />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <HowItWorks />

      {/* Features */}
      <section id="features" className="border-t border-border bg-card/40 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <h2 className="mb-3 text-3xl font-heading font-semibold tracking-tight lg:text-4xl">
              From request to decision — automatically
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              YesDrop runs the whole approval loop, so you stop chasing replies and start closing them.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {[
              {
                icon: Send,
                title: 'Send approvals by email',
                description:
                  'Send a request and your approver decides in one click, right from their inbox — no account, no app to install.',
              },
              {
                icon: CalendarClock,
                title: 'Deadlines that enforce themselves',
                description:
                  'Set a respond-by date. Unanswered requests are marked ignored when it passes, so nothing stays open forever.',
              },
              {
                icon: BellRing,
                title: 'Reminders on autopilot',
                description:
                  'Schedule follow-ups and YesDrop nudges non-responders for you. You never send another “just checking in.”',
              },
              {
                icon: Inbox,
                title: 'One inbox for every approval',
                description:
                  'Track status, history, attachments, and reminders for every request in a single dashboard.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="flex gap-4 rounded-xl border border-border bg-background p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="mb-1.5 font-heading text-lg font-semibold text-foreground">{feature.title}</h3>
                  <p className="leading-relaxed text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <UseCases />

      {/* Data-driven stats */}
      <StatsSection />

      {/* FAQ */}
      <Faq />

      {/* CTA */}
      <section className="pb-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center text-primary-foreground shadow-xl shadow-primary/20">
            {/* depth */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="animate-aurora-drift absolute -left-20 -top-24 h-72 w-72 rounded-full bg-sky-400/25 blur-3xl" />
              <div
                className="animate-aurora-drift absolute -bottom-28 right-[-3rem] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl"
                style={{ animationDelay: '-7s' }}
              />
              <svg
                className="absolute inset-0 h-full w-full text-primary-foreground"
                style={{
                  maskImage: 'radial-gradient(ellipse 70% 80% at 50% 50%, black 20%, transparent 75%)',
                  WebkitMaskImage: 'radial-gradient(ellipse 70% 80% at 50% 50%, black 20%, transparent 75%)',
                }}
              >
                <defs>
                  <pattern id="cta-dots" width="24" height="24" patternUnits="userSpaceOnUse">
                    <circle cx="1.4" cy="1.4" r="1.4" fill="currentColor" opacity="0.1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#cta-dots)" />
              </svg>
            </div>

            <div className="relative z-10">
              <h2 className="mb-4 text-3xl font-heading font-semibold tracking-tight lg:text-4xl">
                Ready to stop chasing approvals?
              </h2>
              <p className="mx-auto mb-8 max-w-2xl text-lg text-primary-foreground/80">
                Send your first request in minutes. No credit card required.
              </p>
              <Link
                href={SIGNUP_HREF}
                className="group inline-flex items-center gap-2 rounded-lg bg-background px-8 py-3.5 font-medium text-foreground shadow-lg transition-transform hover:-translate-y-0.5"
              >
                Start for free
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      <DemoWalkthroughModal open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  )
}
