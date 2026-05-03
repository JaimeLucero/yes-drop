'use client'

import { Moon, Sun } from 'lucide-react'
import Link from 'next/link'
import { useTheme } from './theme-provider'

export function Navbar() {
  const { theme, toggleTheme } = useTheme()

  return (
    <nav className="fixed top-0 w-full bg-white dark:bg-card border-b border-border z-50">
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
    </nav>
  )
}
