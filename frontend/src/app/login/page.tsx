'use client'

import { useState } from 'react'
import { signInWithGoogle } from '@/lib/supabase'
import { AlertCircle, Zap, CheckCircle, Lock } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      setError(null)
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background overflow-hidden">
      {/* Left: Sophisticated branding */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        {/* Gradient background - sophisticated dark blue to accent */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-primary/90 to-primary/70"></div>

        {/* Animated background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/30 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/20 rounded-full blur-3xl -ml-32 -mb-32"></div>

        {/* Content */}
        <div className="relative z-10 p-12 flex flex-col justify-between h-full">
          <div>
            <Link href="/">
              <div className="flex items-center gap-3 cursor-pointer group w-fit">
                <div className="h-10 w-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center group-hover:bg-white/30 transition-colors">
                  <span className="text-white font-heading font-bold text-xl">Y</span>
                </div>
                <span className="text-2xl font-heading font-bold text-white">YesDrop</span>
              </div>
            </Link>
            <p className="text-white/80 text-lg mt-4">Approval requests, simplified</p>
          </div>

          <div className="space-y-8 mb-12">
            {[
              { Icon: Zap, title: 'Lightning Fast', desc: 'Send requests in seconds' },
              { Icon: CheckCircle, title: 'Stay Organized', desc: 'One unified dashboard' },
              { Icon: Lock, title: 'Share Securely', desc: 'Attach files & documents' },
            ].map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-12 w-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <item.Icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-white/70 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-white/60 text-sm">
            <p>© 2026 YesDrop. Approval workflows made simple.</p>
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 relative">
        {/* Subtle background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none"></div>

        <div className="w-full max-w-md relative z-10">
          {/* Logo for mobile */}
          <Link href="/" className="lg:hidden mb-8 inline-flex items-center gap-2 group">
            <div className="h-10 w-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <span className="text-white font-heading font-bold text-lg">Y</span>
            </div>
            <span className="text-xl font-heading font-bold">YesDrop</span>
          </Link>

          {/* Heading */}
          <div className="mb-10">
            <h1 className="text-4xl font-heading font-bold text-foreground mb-3">
              Welcome back
            </h1>
            <p className="text-lg text-foreground/70">
              Sign in to manage your approval requests
            </p>
          </div>

          {/* Error state */}
          {error && (
            <div className="mb-8 flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
            </div>
          )}

          {/* Google sign-in button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full relative group mb-6"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl blur-lg group-hover:blur-xl transition-all opacity-0 group-hover:opacity-100"></div>
            <div className="relative flex items-center justify-center gap-3 px-6 py-3.5 bg-white dark:bg-card border-2 border-border rounded-xl font-medium text-foreground hover:border-primary/30 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed group">
              <svg className="h-5 w-5 group-disabled:opacity-50" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
            </div>
          </button>


          {/* Footer text */}
          <p className="text-xs text-foreground/50 text-center">
            By signing in, you agree to our{' '}
            <a href="#" className="text-primary hover:underline">
              Terms of Service
            </a>
            {' '}and{' '}
            <a href="#" className="text-primary hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}