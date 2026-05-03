'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Plus, Moon, Sun, ChevronLeft, LogOut, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useTheme } from './theme-provider'
import { signOut } from '@/lib/supabase'

export function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  const headerClass = "border-b border-border bg-background/80 backdrop-blur-md h-16"
  const positionClass = pathname === '/' ? "fixed top-0 w-full z-50" : "sticky top-0 z-40"

  // Landing page - public header
  if (pathname === '/') {
    return (
      <header className={`${headerClass} ${positionClass}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="h-8 w-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <span className="text-white font-heading font-bold text-lg">Y</span>
              </div>
              <span className="text-xl font-heading font-bold">YesDrop</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-secondary rounded-lg transition-colors text-foreground"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
            <Link href="/login">
              <button className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors">
                Sign In
              </button>
            </Link>
          </div>
        </div>
      </header>
    )
  }

  // Hide on login and auth callback
  if (pathname === '/login' || pathname === '/auth/callback') {
    return null
  }

  // Dashboard page - authenticated header
  if (pathname === '/dashboard') {
    return (
      <header className={`${headerClass} sticky top-0 z-40`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <span className="text-white font-heading font-bold text-lg">Y</span>
            </div>
            <h1 className="text-lg font-heading font-bold text-foreground">Requests</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-secondary rounded-lg transition-colors text-foreground"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
            <Link href="/requests/new">
              <button className="group inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all">
                <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform" />
                New Request
              </button>
            </Link>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-secondary text-secondary-foreground font-medium rounded-lg border border-border hover:bg-secondary/80 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>
    )
  }

  // Create Request page - authenticated header
  if (pathname === '/requests/new') {
    return (
      <header className={`${headerClass} sticky top-0 z-40`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-semibold group"
          >
            <ChevronLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
            Back
          </button>
          <h1 className="text-lg font-heading font-bold text-foreground">New Request</h1>
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-secondary rounded-lg transition-colors text-foreground"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
        </div>
      </header>
    )
  }

  return null
}
