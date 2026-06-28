'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  MailCheck,
} from 'lucide-react'
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  resendConfirmation,
  requestPasswordReset,
  getCurrentUser,
  EmailNotConfirmedError,
} from '@/lib/supabase'
import { BrandLogo } from '@/components/brand-logo'
import { ShowcasePanel } from '@/components/auth/showcase-panel'

type Mode = 'signin' | 'signup' | 'forgot' | 'sent'

const HEADINGS: Record<Exclude<Mode, 'sent'>, { title: string; subtitle: string }> = {
  signin: { title: 'Welcome back', subtitle: 'Sign in to manage your approval requests.' },
  signup: { title: 'Create your account', subtitle: 'Start sending approval requests in seconds.' },
  forgot: { title: 'Reset your password', subtitle: "Enter your email and we'll send a reset link." },
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()

  const [checking, setChecking] = useState(true)
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'signin')
  const [sentKind, setSentKind] = useState<'verify' | 'reset'>('verify')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    params.get('verify') === '1' ? 'Please verify your email, then sign in.' : null
  )
  const [needsConfirm, setNeedsConfirm] = useState(false)

  // Redirect away if already signed in.
  useEffect(() => {
    let active = true
    getCurrentUser().then((user) => {
      if (!active) return
      if (user) router.replace('/dashboard')
      else setChecking(false)
    })
    return () => {
      active = false
    }
  }, [router])

  const resetFeedback = () => {
    setError(null)
    setNeedsConfirm(false)
  }

  const switchMode = (next: Mode) => {
    resetFeedback()
    setConfirmPassword('')
    setMode(next)
  }

  const handleGoogle = async () => {
    resetFeedback()
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setLoading(false)
    }
  }

  const handleResend = async () => {
    resetFeedback()
    setLoading(true)
    try {
      await resendConfirmation(email)
      setSentKind('verify')
      setMode('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the email.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    resetFeedback()
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
        router.replace('/dashboard')
        return
      }
      if (mode === 'signup') {
        if (password.length < 8) {
          setError('Password must be at least 8 characters.')
          setLoading(false)
          return
        }
        if (password !== confirmPassword) {
          setError("Passwords don't match.")
          setLoading(false)
          return
        }
        const data = await signUpWithEmail(email, password, fullName || undefined)
        if (data.session) {
          router.replace('/dashboard')
          return
        }
        setSentKind('verify')
        setMode('sent')
      }
      if (mode === 'forgot') {
        await requestPasswordReset(email)
        setSentKind('reset')
        setMode('sent')
      }
    } catch (err) {
      if (err instanceof EmailNotConfirmedError) {
        setError('Your email is not verified yet.')
        setNeedsConfirm(true)
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Left: form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <BrandLogo href="/" />
          </div>

          {mode === 'sent' ? (
            <SentView
              kind={sentKind}
              email={email}
              onResend={sentKind === 'verify' ? handleResend : undefined}
              loading={loading}
              onBack={() => switchMode('signin')}
            />
          ) : (
            <>
              <div className="mb-8">
                <h1 className="mb-2 text-2xl font-heading font-semibold tracking-tight text-foreground">{HEADINGS[mode].title}</h1>
                <p className="text-sm text-muted-foreground">{HEADINGS[mode].subtitle}</p>
              </div>

              {error && (
                <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
                    {needsConfirm && (
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={loading}
                        className="text-sm font-semibold text-red-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-red-300"
                      >
                        Resend verification email
                      </button>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <Field label="Full name" htmlFor="full-name">
                    <IconInput
                      id="full-name"
                      icon={<UserIcon className="h-4 w-4" />}
                      type="text"
                      value={fullName}
                      onChange={setFullName}
                      placeholder="Your name"
                      autoComplete="name"
                    />
                  </Field>
                )}

                <Field label="Email" htmlFor="email">
                  <IconInput
                    id="email"
                    icon={<Mail className="h-4 w-4" />}
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                  />
                </Field>

                {mode !== 'forgot' && (
                  <Field
                    label="Password"
                    htmlFor="password"
                    action={
                      mode === 'signin' ? (
                        <button
                          type="button"
                          onClick={() => switchMode('forgot')}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Forgot password?
                        </button>
                      ) : undefined
                    }
                  >
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        required
                        className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </Field>
                )}

                {mode === 'signup' && (
                  <Field label="Confirm password" htmlFor="confirm-password">
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        id="confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        required
                        className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                      />
                    </div>
                  </Field>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading
                    ? 'Please wait…'
                    : mode === 'signin'
                      ? 'Sign in'
                      : mode === 'signup'
                        ? 'Create account'
                        : 'Send reset link'}
                </button>
              </form>

              {mode === 'forgot' ? (
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="mt-6 block w-full text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  Back to sign in
                </button>
              ) : (
                <>
                  <div className="my-6 flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-xs font-medium text-muted-foreground">OR</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <button
                    onClick={handleGoogle}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <GoogleIcon />
                    Continue with Google
                  </button>

                  <p className="mt-6 text-center text-sm text-muted-foreground">
                    {mode === 'signin' ? (
                      <>
                        Don&apos;t have an account?{' '}
                        <button onClick={() => switchMode('signup')} className="font-semibold text-primary hover:underline">
                          Sign up
                        </button>
                      </>
                    ) : (
                      <>
                        Already have an account?{' '}
                        <button onClick={() => switchMode('signin')} className="font-semibold text-primary hover:underline">
                          Sign in
                        </button>
                      </>
                    )}
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: product showcase panel */}
      <ShowcasePanel />
    </div>
  )
}

function SentView({
  kind,
  email,
  onResend,
  loading,
  onBack,
}: {
  kind: 'verify' | 'reset'
  email: string
  onResend?: () => void
  loading: boolean
  onBack: () => void
}) {
  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        {kind === 'verify' ? (
          <MailCheck className="h-7 w-7 text-primary" />
        ) : (
          <CheckCircle2 className="h-7 w-7 text-primary" />
        )}
      </div>
      <div>
        <h1 className="text-xl font-heading font-semibold tracking-tight text-foreground">Check your inbox</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {kind === 'verify' ? (
            <>
              We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Click it to
              activate your account, then sign in.
            </>
          ) : (
            <>
              We sent a password reset link to <span className="font-medium text-foreground">{email}</span>.
            </>
          )}
        </p>
      </div>
      {kind === 'verify' && onResend && (
        <button
          type="button"
          onClick={onResend}
          disabled={loading}
          className="text-sm font-semibold text-primary hover:underline disabled:opacity-50"
        >
          Resend email
        </button>
      )}
      <button type="button" onClick={onBack} className="block w-full text-center text-sm text-muted-foreground hover:text-foreground">
        Back to sign in
      </button>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  action,
  children,
}: {
  label: string
  htmlFor: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {action}
      </div>
      {children}
    </div>
  )
}

function IconInput({
  id,
  icon,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
}: {
  id: string
  icon: React.ReactNode
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  required?: boolean
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
      />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  )
}
