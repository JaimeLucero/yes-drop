'use client'

import { useState, useEffect } from 'react'
import { LogOut, Plus, Moon, Sun } from 'lucide-react'
import Link from 'next/link'
import { signOut } from '@/lib/supabase'

interface HeaderProps {
  title: string
  subtitle?: string
  showNewButton?: boolean
}

export function Header({ title, subtitle, showNewButton = true }: HeaderProps) {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark')
    setIsDark(isDarkMode)
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    const newDarkState = !isDark
    setIsDark(newDarkState)

    if (newDarkState) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <header className="border-b border-border bg-white dark:bg-card sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">{title}</h1>
            {subtitle && <p className="text-foreground/60 mt-1">{subtitle}</p>}
          </div>
          {showNewButton && (
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 hover:bg-secondary rounded-lg transition-colors text-foreground"
                aria-label="Toggle theme"
              >
                {mounted && isDark ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </button>
              <Link href="/requests/new">
                <button className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors">
                  <Plus className="h-4 w-4" />
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
          )}
        </div>
      </div>
    </header>
  )
}
