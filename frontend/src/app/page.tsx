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

export default function LandingPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const user = await getCurrentUser()
      setIsAuthenticated(!!user)
      if (user) {
        router.push('/dashboard')
      } else {
        setIsLoading(false)
      }
    }
    checkAuth()

    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark')
    }
  }, [router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground">
      {/* Hero Section */}
      <section className="min-h-screen pt-20 pb-32 relative overflow-hidden flex items-center">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-10 w-96 h-96 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-accent/20 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Center: Content */}
            <div className="space-y-8 flex flex-col items-center lg:items-start text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full w-fit">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Fast, simple, and reliable</span>
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl lg:text-6xl font-heading font-bold leading-tight">
                  Approval requests{' '}
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    made simple
                  </span>
                </h1>
                <p className="text-xl text-foreground/70 leading-relaxed max-w-lg">
                  Send approval requests in seconds, get responses instantly, and never miss an update. The easiest way to manage approvals across your organization.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/login">
                  <button className="group px-8 py-3.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all flex items-center gap-2 w-full sm:w-auto justify-center">
                    Get Started Free
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </Link>
                <button
                  onClick={() => setDemoOpen(true)}
                  className="group px-8 py-3.5 bg-secondary text-secondary-foreground font-semibold rounded-xl border border-border hover:bg-secondary/80 transition-colors w-full sm:w-auto flex items-center gap-2 justify-center"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Watch Demo
                </button>
              </div>

              {/* Live, data-driven stat strip (real numbers above threshold, illustrative below) */}
              <div className="pt-4 border-t border-border w-full flex justify-center lg:justify-start">
                <StatStrip />
              </div>

            </div>

            {/* Right: Visual showcase */}
            <div className="relative h-full min-h-[500px] hidden lg:flex items-center justify-center">
              <div className="relative w-full h-full">
                {/* Floating card 1 */}
                <div className="absolute top-0 right-0 w-80 bg-white dark:bg-card rounded-2xl shadow-2xl p-6 border border-border transform hover:translate-y-2 transition-transform duration-300">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                    <span className="text-sm font-medium text-foreground/60">Pending</span>
                  </div>
                  <h3 className="font-heading font-semibold text-foreground mb-2">Budget Approval Q3</h3>
                  <p className="text-sm text-foreground/60 mb-4">Awaiting approval from CEO</p>
                  <div className="text-xs text-foreground/50">2 hours ago</div>
                </div>

                {/* Floating card 2 */}
                <div className="absolute bottom-20 left-0 w-80 bg-white dark:bg-card rounded-2xl shadow-2xl p-6 border border-border transform hover:-translate-y-2 transition-transform duration-300">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                    <span className="text-sm font-medium text-foreground/60">Approved</span>
                  </div>
                  <h3 className="font-heading font-semibold text-foreground mb-2">Contract Review</h3>
                  <p className="text-sm text-foreground/60 mb-4">Approved by Legal Team</p>
                  <div className="text-xs text-foreground/50">5 minutes ago</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white dark:bg-card/50 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-heading font-bold mb-6">
              Everything you need
            </h2>
            <p className="text-xl text-foreground/70 max-w-2xl mx-auto">
              Powerful features designed to make approval workflows effortless
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: 'Lightning Fast',
                description: 'Send approval requests in seconds and track responses in real-time with automatic email notifications',
              },
              {
                icon: Shield,
                title: 'Secure & Reliable',
                description: 'Enterprise-grade security with OAuth 2.0 authentication and encrypted data at rest',
              },
              {
                icon: BarChart3,
                title: 'Full Visibility',
                description: 'Beautiful dashboard with status tracking, analytics, and activity history for all requests',
              },
              {
                icon: Mail,
                title: 'Smart Notifications',
                description: 'Intelligent email system with clickable approval/rejection links — no sign-in required',
              },
              {
                icon: Upload,
                title: 'File Support',
                description: 'Attach any file or document to requests for complete context and easy collaboration',
              },
              {
                icon: CheckCircle,
                title: 'Audit Trail',
                description: 'Complete history of all approvals and rejections for compliance and accountability',
              },
            ].map((feature, i) => (
              <div key={i} className="p-8 bg-background rounded-xl border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300 group">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-heading font-semibold mb-3 text-foreground">{feature.title}</h3>
                <p className="text-foreground/70 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data-driven stats section */}
      <StatsSection />

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <h2 className="text-4xl lg:text-5xl font-heading font-bold mb-6">
            Ready to simplify approvals?
          </h2>
          <p className="text-lg text-foreground/70 mb-8 max-w-2xl mx-auto">
            Join hundreds of teams managing approvals with YesDrop. Get started in minutes, no credit card required.
          </p>
          <Link href="/login">
            <button className="group px-10 py-4 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all inline-flex items-center gap-2">
              Get Started Free
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
        </div>
      </section>

      <Footer />

      <DemoWalkthroughModal open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  )
}
