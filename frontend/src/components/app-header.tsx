'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Moon, Sun, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { useTheme } from './theme-provider'
import { BrandLogo } from './brand-logo'

export function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()

  const headerClass = 'border-b border-border bg-background/80 backdrop-blur-md h-16'

  const themeToggle = (
    <button
      onClick={toggleTheme}
      className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )

  // Landing page - public header
  if (pathname === '/') {
    const navLinks = [
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Features', href: '/#features' },
      { label: 'FAQ', href: '/#faq' },
    ]
    return (
      <header className={`${headerClass} fixed top-0 w-full z-50`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <BrandLogo href="/" />

          <nav className="hidden items-center gap-7 md:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            {themeToggle}
            <Link
              href="/login"
              className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/login?mode=signup"
              className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start for free
            </Link>
          </div>
        </div>
      </header>
    )
  }

  // Dashboard owns its own chrome (sidebar). Login/callback render nothing.
  if (
    pathname === '/dashboard' ||
    pathname === '/login' ||
    pathname === '/auth/callback'
  ) {
    return null
  }

  // Create Request page - authenticated header
  if (pathname === '/requests/new') {
    return (
      <header className={`${headerClass} sticky top-0 z-40`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-medium group"
          >
            <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>
          <h1 className="text-base font-heading font-semibold text-foreground">New request</h1>
          {themeToggle}
        </div>
      </header>
    )
  }

  return null
}
